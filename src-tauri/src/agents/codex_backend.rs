//! Codex adapter: spawn `codex exec --json` per query (no daemon — Codex has
//! native session mgmt). codex-cli 0.130: SINGLE surface — the stdout stream
//! carries everything including per-turn usage in `turn.completed` (the 0.42
//! rollout-JSONL tail is gone). stdin MUST be closed or `codex exec` blocks
//! on "Reading additional input from stdin…". Emits `codex-event:{agent_id}`
//! with the SAME wrapper shape as the Claude path (claude_cli.rs:461).
use async_trait::async_trait;
use std::process::Stdio;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use super::backend::{AgentBackend, AuthStatus, BackendSessionHandle, StartSessionParams};
use super::events::{codex_stream_to_quack, AgentBackendKind, QuackAgentEvent};

const CODEX_BIN: &str = "codex";

pub fn build_codex_args(working_dir: &str, model: Option<&str>, prompt: &str) -> Vec<String> {
    let mut a = vec![
        "exec".into(), "--json".into(),
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
        "exec".into(), "--json".into(),
        "--sandbox".into(), "workspace-write".into(),
        "--skip-git-repo-check".into(),
        "-c".into(), "mcp_servers={}".into(),
        "--cd".into(), working_dir.into(),
        "resume".into(), session_id.into(), prompt.into(),
    ]
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
        // Brain: gotcha-shell-env-gui-launch
        // GUI-launched .app has minimal PATH and won't find `codex` (Homebrew/npm
        // installs live outside the bundle's inherited PATH). Inject the
        // login-shell env captured by shell_env so prod matches dev.
        let mut cmd = Command::new(CODEX_BIN);
        for (k, v) in crate::shell_env::get_login_env() {
            cmd.env(k, v);
        }
        let mut child = cmd
            .args(&args)
            // stdin MUST be closed: codex-cli 0.130 `exec` blocks on
            // "Reading additional input from stdin…" even with a prompt arg.
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("failed to spawn codex: {e}"))?;
        let stdout = child.stdout.take().ok_or("no codex stdout")?;
        let mut lines = BufReader::new(stdout).lines();
        let mut session_id: Option<String> = None;

        while let Ok(Some(line)) = lines.next_line().await {
            let Ok(v) = serde_json::from_str::<serde_json::Value>(&line) else { continue };
            // 0.130 carries the backend session id as `thread_id`
            // (`thread.started`); keep `session_id` as a defensive fallback.
            if let Some(sid) = v.get("thread_id").or_else(|| v.get("session_id"))
                .and_then(|s| s.as_str())
            {
                session_id = Some(sid.to_string());
            }
            if let Some(ev) = codex_stream_to_quack(v) {
                self.emit(&p.agent_id, &p.session_key, &p.turn_id, &ev);
            }
        }
        let _ = child.wait().await;

        // 0.130: per-turn usage already arrived in-stream via `turn.completed`
        // (translated by codex_stream_to_quack). No rollout-file tail needed.
        // SessionEnded is still synthesized as the turn-lifecycle backstop the
        // frontend relies on (placeholder finalization).
        self.emit(&p.agent_id, &p.session_key, &p.turn_id,
                  &QuackAgentEvent::SessionEnded { reason: "completed".into() });
        Ok(session_id)
    }
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
/// Parse the stdout `error` stream; exit code is unreliable. stdin closed so
/// 0.130 `exec` does not block on "Reading additional input from stdin…".
pub async fn codex_auth_probe() -> Result<bool, String> {
    let tmp = std::env::temp_dir();
    // Brain: gotcha-shell-env-gui-launch — see run() above for context.
    let mut cmd = Command::new(CODEX_BIN);
    for (k, v) in crate::shell_env::get_login_env() {
        cmd.env(k, v);
    }
    let out = cmd
        .args(["exec","--json","--sandbox","read-only",
               "--skip-git-repo-check","-c","mcp_servers={}",
               "--cd", tmp.to_str().unwrap_or("/tmp"),
               "Reply exactly: AUTH_OK"])
        .stdin(Stdio::null())
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
    fn codex_args_are_json_and_isolated() {
        let args = build_codex_args("/work", None, "hello");
        assert!(args.contains(&"--json".to_string()));
        assert!(!args.contains(&"--experimental-json".to_string()));
        assert!(args.contains(&"--skip-git-repo-check".to_string()));
        assert!(args.windows(2).any(|w| w[0] == "-c" && w[1] == "mcp_servers={}"));
        assert!(args.contains(&"hello".to_string()));
    }

    #[test]
    fn codex_resume_args_put_flags_before_subcommand() {
        let args = build_codex_resume_args("/work", "sid-1", "again");
        let resume_pos = args.iter().position(|a| a == "resume").unwrap();
        let json_pos = args.iter().position(|a| a == "--json").unwrap();
        assert!(json_pos < resume_pos, "flags must precede `resume`");
        assert_eq!(args[resume_pos + 1], "sid-1");
    }
}
