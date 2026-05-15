//! Codex adapter: spawn `codex exec --experimental-json` per query (no daemon —
//! Codex has native session mgmt). Two surfaces (spike §3): stdout stream for
//! live events, rollout JSONL tail for token usage. Emits `codex-event:{agent_id}`
//! with the SAME wrapper shape as the Claude path (claude_cli.rs:461).
use async_trait::async_trait;
use std::path::Path;
use std::process::Stdio;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use super::backend::{AgentBackend, AuthStatus, BackendSessionHandle, StartSessionParams};
use super::events::{codex_rollout_to_usage, codex_stream_to_quack, AgentBackendKind, QuackAgentEvent};

const CODEX_BIN: &str = "codex";

pub fn build_codex_args(working_dir: &str, model: Option<&str>, prompt: &str) -> Vec<String> {
    let mut a = vec![
        "exec".into(), "--experimental-json".into(),
        "--sandbox".into(), "workspace-write".into(),
        "--skip-git-repo-check".into(),
        "-c".into(), "mcp_servers={}".into(),
        "--cd".into(), working_dir.into(),
    ];
    if let Some(m) = model { a.push("-c".into()); a.push(format!("model={m}")); }
    a.push(prompt.into());
    a
}

pub fn build_codex_resume_args(working_dir: &str, session_id: &str, prompt: &str) -> Vec<String> {
    vec![
        "exec".into(), "--experimental-json".into(),
        "--sandbox".into(), "workspace-write".into(),
        "--skip-git-repo-check".into(),
        "-c".into(), "mcp_servers={}".into(),
        "--cd".into(), working_dir.into(),
        "resume".into(), session_id.into(), prompt.into(),
    ]
}

pub fn rollout_filename_matches(file_name: &str, session_id: &str) -> bool {
    file_name.starts_with("rollout-") && file_name.ends_with(".jsonl")
        && file_name.contains(session_id)
}

pub struct CodexBackend { pub app: AppHandle }

impl CodexBackend {
    fn emit(&self, agent_id: &str, session_key: &str, turn_id: &Option<String>, ev: &QuackAgentEvent) {
        let wrapped = serde_json::json!({
            "sessionKey": session_key, "turnId": turn_id, "event": ev
        });
        let _ = self.app.emit(&format!("codex-event:{agent_id}"), &wrapped);
    }

    async fn run(&self, args: Vec<String>, p: &StartSessionParams) -> Result<Option<String>, String> {
        let mut child = Command::new(CODEX_BIN)
            .args(&args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("failed to spawn codex: {e}"))?;
        let stdout = child.stdout.take().ok_or("no codex stdout")?;
        let mut lines = BufReader::new(stdout).lines();
        let mut session_id: Option<String> = None;

        while let Ok(Some(line)) = lines.next_line().await {
            let Ok(v) = serde_json::from_str::<serde_json::Value>(&line) else { continue };
            if let Some(sid) = v.get("session_id").and_then(|s| s.as_str()) {
                session_id = Some(sid.to_string());
            }
            if let Some(ev) = codex_stream_to_quack(v) {
                self.emit(&p.agent_id, &p.session_key, &p.turn_id, &ev);
            }
        }
        let _ = child.wait().await;

        if let Some(ref sid) = session_id {
            if let Some(usage) = read_last_usage_for_session(sid).await {
                self.emit(&p.agent_id, &p.session_key, &p.turn_id, &usage);
            }
        }
        self.emit(&p.agent_id, &p.session_key, &p.turn_id,
                  &QuackAgentEvent::SessionEnded { reason: "completed".into() });
        Ok(session_id)
    }
}

async fn read_last_usage_for_session(session_id: &str) -> Option<QuackAgentEvent> {
    let home = std::env::var("HOME").ok()?;
    let base = Path::new(&home).join(".codex").join("sessions");
    let mut found: Option<std::path::PathBuf> = None;
    for entry in walk_jsonl(&base) {
        let fname = entry.file_name()?.to_str()?.to_string();
        if rollout_filename_matches(&fname, session_id) {
            found = Some(entry);
        }
    }
    let content = tokio::fs::read_to_string(found?).await.ok()?;
    content.lines().rev()
        .filter_map(|l| serde_json::from_str::<serde_json::Value>(l).ok())
        .find_map(|v| codex_rollout_to_usage(&v))
}

fn walk_jsonl(base: &Path) -> Vec<std::path::PathBuf> {
    let mut out = vec![];
    let mut stack = vec![base.to_path_buf()];
    while let Some(dir) = stack.pop() {
        let Ok(rd) = std::fs::read_dir(&dir) else { continue };
        for e in rd.flatten() {
            let path = e.path();
            if path.is_dir() { stack.push(path); }
            else if path.extension().and_then(|x| x.to_str()) == Some("jsonl") { out.push(path); }
        }
    }
    out
}

#[async_trait]
impl AgentBackend for CodexBackend {
    fn kind(&self) -> AgentBackendKind { AgentBackendKind::Codex }

    async fn auth_status(&self) -> AuthStatus {
        match codex_auth_probe().await {
            Ok(true) => AuthStatus::Ready { method: "apikey".into() },
            Ok(false) => AuthStatus::Expired { detail: "codex login required".into() },
            Err(_) => AuthStatus::NotConfigured,
        }
    }

    async fn send_message(&self, params: StartSessionParams, prompt: String)
        -> Result<BackendSessionHandle, String> {
        let args = build_codex_args(&params.working_dir, params.model.as_deref(), &prompt);
        let sid = self.run(args, &params).await?;
        Ok(BackendSessionHandle {
            backend: AgentBackendKind::Codex,
            backend_session_id: sid,
            agent_id: params.agent_id,
            session_key: params.session_key,
        })
    }

    async fn resume(&self, backend_session_id: &str, params: StartSessionParams, prompt: String)
        -> Result<BackendSessionHandle, String> {
        let args = build_codex_resume_args(&params.working_dir, backend_session_id, &prompt);
        let sid = self.run(args, &params).await?;
        Ok(BackendSessionHandle {
            backend: AgentBackendKind::Codex,
            backend_session_id: sid.or_else(|| Some(backend_session_id.to_string())),
            agent_id: params.agent_id,
            session_key: params.session_key,
        })
    }

    async fn cancel(&self, _session_key: &str) -> Result<(), String> {
        // Spike §4.6: codex exec is spawn-per-query; cancel = kill the child.
        // M1: handled by dropping the spawned task (tracked in M3 hardening).
        Ok(())
    }
}

/// Probe auth without a turn cost: a 1-token read-only exec.
/// Spike §4.4: parse stdout `error` stream; exit code is unreliable.
pub async fn codex_auth_probe() -> Result<bool, String> {
    let tmp = std::env::temp_dir();
    let out = Command::new(CODEX_BIN)
        .args(["exec","--experimental-json","--sandbox","read-only",
               "--skip-git-repo-check","-c","mcp_servers={}",
               "--cd", tmp.to_str().unwrap_or("/tmp"),
               "Reply exactly: AUTH_OK"])
        .output().await.map_err(|e| e.to_string())?;
    let s = String::from_utf8_lossy(&out.stdout);
    if s.contains("Failed to refresh token") || s.contains("401") { return Ok(false); }
    Ok(s.contains("AUTH_OK"))
}

#[tauri::command]
pub async fn codex_auth_status() -> Result<bool, String> {
    codex_auth_probe().await
}

#[cfg(test)]
mod codex_backend_tests {
    use super::*;

    #[test]
    fn rollout_glob_matches_session_id() {
        let name = "rollout-2026-05-15T16-02-44-019e2bf2-5d04-7ba3-b7a9-17ab8ccf2896.jsonl";
        assert!(rollout_filename_matches(name, "019e2bf2-5d04-7ba3-b7a9-17ab8ccf2896"));
        assert!(!rollout_filename_matches(name, "deadbeef"));
    }

    #[test]
    fn codex_args_are_experimental_json_and_isolated() {
        let args = build_codex_args("/work", None, "hello");
        assert!(args.contains(&"--experimental-json".to_string()));
        assert!(args.contains(&"--skip-git-repo-check".to_string()));
        assert!(args.windows(2).any(|w| w[0] == "-c" && w[1] == "mcp_servers={}"));
        assert!(args.contains(&"hello".to_string()));
    }

    #[test]
    fn codex_resume_args_put_flags_before_subcommand() {
        let args = build_codex_resume_args("/work", "sid-1", "again");
        let resume_pos = args.iter().position(|a| a == "resume").unwrap();
        let json_pos = args.iter().position(|a| a == "--experimental-json").unwrap();
        assert!(json_pos < resume_pos, "flags must precede `resume`");
        assert_eq!(args[resume_pos + 1], "sid-1");
    }
}
