//! Unified agent event contract.
//! Authoritative source: documentation/research/codex-cli-events.md §6 (spike, verified).
//! NOTE: Codex `error` has only {type,message} — no code/recoverable (spike §4.3).
//! NOTE: PermissionRequest has NO source via `codex exec` (spike §4.6).
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AgentBackendKind {
    Claude,
    Codex,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum QuackAgentEvent {
    SessionStarted {
        backend_session_id: String,
        model: Option<String>,
        backend: AgentBackendKind,
    },
    TextDelta { content: String },
    ToolCallStart { id: String, name: String, args: serde_json::Value },
    ToolCallEnd { id: String, output: String, error: Option<String> },
    Usage {
        input_tokens: u64,
        output_tokens: u64,
        cached_tokens: u64,
        cost_usd: Option<f64>,
    },
    Error { code: String, message: String, recoverable: bool },
    SessionEnded { reason: String },
}

/// Map a backend-native tool/item identifier to Quack's canonical tool name.
/// Codex 0.42 `--experimental-json` exposes a single `command_execution`
/// item type (spike §7, VERIFIED -- `apply_patch`/`shell`/`view` do NOT exist).
pub fn normalize_tool_name(backend: AgentBackendKind, raw: &str) -> &str {
    match (backend, raw) {
        (AgentBackendKind::Codex, "command_execution") => "Bash",
        // Claude tool_use names are already canonical; pass through.
        _ => raw,
    }
}

/// Infer Quack error `code` + `recoverable` from a Codex `error.message`.
/// Spike §4.3: Codex `error` event has ONLY {type,message}; no native fields.
fn classify_codex_error(message: &str) -> (String, bool) {
    let m = message.to_ascii_lowercase();
    if m.contains("401") || m.contains("refresh token") || m.contains("unauthorized") {
        return ("auth".into(), false);
    }
    if m.contains("timed out") || m.contains("timeout") {
        return ("timeout".into(), true);
    }
    // A line still saying "retrying" is a transient retry, not terminal (spike §4.3).
    let recoverable = m.contains("retrying");
    ("stream".into(), recoverable)
}

/// Translate ONE Codex `--experimental-json` stdout event into a QuackAgentEvent.
/// Returns None for events Quack does not surface (e.g. non-command item.started).
/// Surface contract: spike §4.1-§4.3, mapping table §6 ([S] rows).
pub fn codex_stream_to_quack(v: serde_json::Value) -> Option<QuackAgentEvent> {
    match v.get("type").and_then(|t| t.as_str())? {
        "session.created" => Some(QuackAgentEvent::SessionStarted {
            backend_session_id: v.get("session_id")?.as_str()?.to_string(),
            model: None,
            backend: AgentBackendKind::Codex,
        }),
        "item.started" => {
            let item = v.get("item")?;
            if item.get("item_type")?.as_str()? != "command_execution" {
                return None;
            }
            Some(QuackAgentEvent::ToolCallStart {
                id: item.get("id")?.as_str()?.to_string(),
                name: normalize_tool_name(
                    AgentBackendKind::Codex,
                    item.get("item_type")?.as_str()?,
                ).to_string(),
                args: serde_json::json!({
                    "command": item.get("command").and_then(|c| c.as_str()).unwrap_or("")
                }),
            })
        }
        "item.completed" => {
            let item = v.get("item")?;
            match item.get("item_type")?.as_str()? {
                "command_execution" => {
                    let status = item.get("status").and_then(|s| s.as_str()).unwrap_or("");
                    let exit_code = item.get("exit_code").and_then(|c| c.as_i64()).unwrap_or(0);
                    let out = item.get("aggregated_output")
                        .and_then(|o| o.as_str()).unwrap_or("").to_string();
                    let error = if status == "failed" || exit_code != 0 {
                        Some(if out.is_empty() {
                            format!("command failed (exit {exit_code})")
                        } else { out.clone() })
                    } else { None };
                    Some(QuackAgentEvent::ToolCallEnd {
                        id: item.get("id")?.as_str()?.to_string(),
                        output: out,
                        error,
                    })
                }
                "assistant_message" => Some(QuackAgentEvent::TextDelta {
                    content: item.get("text")?.as_str()?.to_string(),
                }),
                _ => None,
            }
        }
        "error" => {
            let message = v.get("message")?.as_str()?.to_string();
            let (code, recoverable) = classify_codex_error(&message);
            Some(QuackAgentEvent::Error { code, message, recoverable })
        }
        _ => None,
    }
}

#[cfg(test)]
mod codex_stream_tests {
    use super::*;

    fn parse_all(jsonl: &str) -> Vec<QuackAgentEvent> {
        jsonl.lines()
            .filter(|l| !l.trim().is_empty())
            .filter_map(|l| serde_json::from_str::<serde_json::Value>(l).ok())
            .filter_map(codex_stream_to_quack)
            .collect()
    }

    #[test]
    fn maps_session_created() {
        let ev = codex_stream_to_quack(
            serde_json::json!({"type":"session.created","session_id":"abc-123"})
        ).unwrap();
        assert_eq!(ev, QuackAgentEvent::SessionStarted {
            backend_session_id: "abc-123".into(),
            model: None,
            backend: AgentBackendKind::Codex,
        });
    }

    #[test]
    fn command_execution_started_is_toolcallstart() {
        let ev = codex_stream_to_quack(serde_json::json!({
            "type":"item.started",
            "item":{"id":"item_0","item_type":"command_execution",
                    "command":"bash -lc 'echo hi'","aggregated_output":"","status":"in_progress"}
        })).unwrap();
        match ev {
            QuackAgentEvent::ToolCallStart { id, name, args } => {
                assert_eq!(id, "item_0");
                assert_eq!(name, "Bash");
                assert_eq!(args["command"], "bash -lc 'echo hi'");
            }
            other => panic!("expected ToolCallStart, got {other:?}"),
        }
    }

    #[test]
    fn command_execution_completed_is_toolcallend_with_output() {
        let ev = codex_stream_to_quack(serde_json::json!({
            "type":"item.completed",
            "item":{"id":"item_1","item_type":"command_execution",
                    "command":"bash -lc 'cat note.txt'","aggregated_output":"PING\n",
                    "exit_code":0,"status":"completed"}
        })).unwrap();
        assert_eq!(ev, QuackAgentEvent::ToolCallEnd {
            id: "item_1".into(), output: "PING\n".into(), error: None,
        });
    }

    #[test]
    fn failed_command_execution_carries_error() {
        let ev = codex_stream_to_quack(serde_json::json!({
            "type":"item.completed",
            "item":{"id":"item_0","item_type":"command_execution",
                    "command":"bash -lc 'echo X > b.txt'",
                    "aggregated_output":"bash: b.txt: Operation not permitted\n",
                    "exit_code":-1,"status":"failed"}
        })).unwrap();
        match ev {
            QuackAgentEvent::ToolCallEnd { error: Some(e), .. } => {
                assert!(e.contains("Operation not permitted"));
            }
            other => panic!("expected ToolCallEnd with error, got {other:?}"),
        }
    }

    #[test]
    fn assistant_message_is_textdelta() {
        let ev = codex_stream_to_quack(serde_json::json!({
            "type":"item.completed",
            "item":{"id":"item_2","item_type":"assistant_message","text":"Done."}
        })).unwrap();
        assert_eq!(ev, QuackAgentEvent::TextDelta { content: "Done.".into() });
    }

    #[test]
    fn error_event_has_no_code_or_recoverable_natively() {
        let ev = codex_stream_to_quack(serde_json::json!({
            "type":"error","message":"Failed to refresh token: 401 Unauthorized"
        })).unwrap();
        match ev {
            QuackAgentEvent::Error { code, message, recoverable } => {
                assert_eq!(message, "Failed to refresh token: 401 Unauthorized");
                assert_eq!(code, "auth");
                assert!(!recoverable);
            }
            other => panic!("expected Error, got {other:?}"),
        }
    }

    #[test]
    fn item_started_non_command_is_ignored() {
        assert!(codex_stream_to_quack(serde_json::json!({
            "type":"item.started",
            "item":{"id":"x","item_type":"assistant_message","status":"in_progress"}
        })).is_none());
    }

    #[test]
    fn full_fixture_stream_shape() {
        let raw = include_str!("fixtures/codex_stream_tool_run.jsonl");
        let evs = parse_all(raw);
        assert!(matches!(evs.first(), Some(QuackAgentEvent::SessionStarted { .. })));
        assert!(matches!(evs.last(), Some(QuackAgentEvent::Error { .. })));
        assert_eq!(evs.iter().filter(|e| matches!(e, QuackAgentEvent::ToolCallStart { .. })).count(), 1);
        assert_eq!(evs.iter().filter(|e| matches!(e, QuackAgentEvent::ToolCallEnd { .. })).count(), 2);
        assert_eq!(evs.iter().filter(|e| matches!(e, QuackAgentEvent::TextDelta { .. })).count(), 1);
    }
}

#[cfg(test)]
mod tool_name_tests {
    use super::*;

    #[test]
    fn codex_command_execution_maps_to_bash() {
        // Spike §7 VERIFIED: codex 0.42 --experimental-json has ONLY
        // item_type "command_execution" (it shells out everything).
        assert_eq!(normalize_tool_name(AgentBackendKind::Codex, "command_execution"), "Bash");
    }

    #[test]
    fn codex_unknown_item_type_passes_through() {
        assert_eq!(normalize_tool_name(AgentBackendKind::Codex, "mystery"), "mystery");
    }

    #[test]
    fn claude_names_pass_through_unchanged() {
        assert_eq!(normalize_tool_name(AgentBackendKind::Claude, "Edit"), "Edit");
        assert_eq!(normalize_tool_name(AgentBackendKind::Claude, "Bash"), "Bash");
    }
}
