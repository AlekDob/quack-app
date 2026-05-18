//! Unified agent event contract.
//! Authoritative source: codex-cli 0.130 `--json` stream, verified live
//! 2026-05-18 (fixtures/codex_stream_tool_run.jsonl, _subagent, _skill_discovery).
//! 0.130 schema (vs the obsolete 0.42 `--experimental-json`):
//!   thread.started{thread_id} / turn.started / item.{started,completed} with
//!   item.type / agent_message / turn.completed{usage}.
//! NOTE: Codex `error` has only {type,message} — no code/recoverable.
//! NOTE: PermissionRequest has NO source via `codex exec` (non-interactive).
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
/// Codex 0.130 shells everything via `command_execution`; `collab_tool_call`
/// (subagents) and `mcp_tool_call` carry their own `tool`/`server` names and
/// are resolved directly in `codex_tool_identity`, not here.
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

/// Resolve (id, canonical tool name, command/summary) for a Codex 0.130 tool
/// item. Returns None for item types Quack does not surface as a tool.
fn codex_tool_identity(item: &serde_json::Value) -> Option<(String, String, String)> {
    let id = item.get("id")?.as_str()?.to_string();
    match item.get("type")?.as_str()? {
        "command_execution" => Some((
            id,
            normalize_tool_name(AgentBackendKind::Codex, "command_execution").to_string(),
            item.get("command").and_then(|c| c.as_str()).unwrap_or("").to_string(),
        )),
        // Subagents (0.130): spawn_agent / wait collaboration tools.
        "collab_tool_call" => Some((
            id,
            item.get("tool").and_then(|t| t.as_str()).unwrap_or("collab_tool_call").to_string(),
            item.get("prompt").and_then(|p| p.as_str()).unwrap_or("").to_string(),
        )),
        "mcp_tool_call" => {
            let server = item.get("server").and_then(|s| s.as_str()).unwrap_or("mcp");
            let tool = item.get("tool").and_then(|t| t.as_str()).unwrap_or("call");
            Some((id, format!("{server}.{tool}"), String::new()))
        }
        _ => None,
    }
}

/// Concise output for a completed collab/mcp tool item (subagent reply or the
/// first MCP text result, char-truncated so events stay lean).
fn codex_aux_tool_output(item: &serde_json::Value) -> String {
    if let Some(states) = item.get("agents_states").and_then(|s| s.as_object()) {
        let msgs: Vec<String> = states.values()
            .filter_map(|st| st.get("message").and_then(|m| m.as_str()))
            .map(|s| s.to_string())
            .collect();
        if !msgs.is_empty() {
            return msgs.join("\n");
        }
    }
    if let Some(text) = item.get("result").and_then(|r| r.get("content"))
        .and_then(|c| c.as_array()).and_then(|a| a.first())
        .and_then(|x| x.get("text")).and_then(|t| t.as_str())
    {
        let t = text.trim();
        let truncated: String = t.chars().take(2000).collect();
        return if truncated.len() < t.len() { format!("{truncated}…") } else { truncated };
    }
    String::new()
}

/// Translate ONE Codex 0.130 `--json` stdout event into a QuackAgentEvent.
/// Returns None for events Quack does not surface (turn.started, non-tool
/// item.started, the non-JSON "Reading additional input…" preamble line).
/// Verified live against fixtures/codex_stream_tool_run.jsonl (2026-05-18).
pub fn codex_stream_to_quack(v: serde_json::Value) -> Option<QuackAgentEvent> {
    match v.get("type").and_then(|t| t.as_str())? {
        // 0.130: the backend session id arrives as `thread_id`. No model in
        // the stream (UI labels Codex sessions gpt-5-codex separately).
        "thread.started" => Some(QuackAgentEvent::SessionStarted {
            backend_session_id: v.get("thread_id")?.as_str()?.to_string(),
            model: None,
            backend: AgentBackendKind::Codex,
        }),
        "item.started" => {
            let (id, name, command) = codex_tool_identity(v.get("item")?)?;
            Some(QuackAgentEvent::ToolCallStart {
                id,
                name,
                args: serde_json::json!({ "command": command }),
            })
        }
        "item.completed" => {
            let item = v.get("item")?;
            match item.get("type")?.as_str()? {
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
                "agent_message" => Some(QuackAgentEvent::TextDelta {
                    content: item.get("text")?.as_str()?.to_string(),
                }),
                // Subagent / MCP activity → surface as a completed tool call.
                "collab_tool_call" | "mcp_tool_call" => Some(QuackAgentEvent::ToolCallEnd {
                    id: item.get("id")?.as_str()?.to_string(),
                    output: codex_aux_tool_output(item),
                    error: None,
                }),
                _ => None,
            }
        }
        // 0.130: per-turn usage is IN-STREAM (was rollout-file-only on 0.42).
        "turn.completed" => {
            let u = v.get("usage")?;
            Some(QuackAgentEvent::Usage {
                input_tokens: u.get("input_tokens").and_then(|n| n.as_u64()).unwrap_or(0),
                output_tokens: u.get("output_tokens").and_then(|n| n.as_u64()).unwrap_or(0),
                cached_tokens: u.get("cached_input_tokens").and_then(|n| n.as_u64()).unwrap_or(0),
                cost_usd: None,
            })
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
    fn maps_thread_started() {
        let ev = codex_stream_to_quack(
            serde_json::json!({"type":"thread.started","thread_id":"abc-123"})
        ).unwrap();
        assert_eq!(ev, QuackAgentEvent::SessionStarted {
            backend_session_id: "abc-123".into(),
            model: None,
            backend: AgentBackendKind::Codex,
        });
    }

    #[test]
    fn turn_started_is_ignored() {
        assert!(codex_stream_to_quack(serde_json::json!({"type":"turn.started"})).is_none());
    }

    #[test]
    fn command_execution_started_is_toolcallstart() {
        let ev = codex_stream_to_quack(serde_json::json!({
            "type":"item.started",
            "item":{"id":"item_0","type":"command_execution",
                    "command":"/bin/zsh -lc 'echo hi'","aggregated_output":"",
                    "exit_code":null,"status":"in_progress"}
        })).unwrap();
        match ev {
            QuackAgentEvent::ToolCallStart { id, name, args } => {
                assert_eq!(id, "item_0");
                assert_eq!(name, "Bash");
                assert_eq!(args["command"], "/bin/zsh -lc 'echo hi'");
            }
            other => panic!("expected ToolCallStart, got {other:?}"),
        }
    }

    #[test]
    fn command_execution_completed_is_toolcallend_with_output() {
        let ev = codex_stream_to_quack(serde_json::json!({
            "type":"item.completed",
            "item":{"id":"item_0","type":"command_execution",
                    "command":"/bin/zsh -lc 'cat note.txt'","aggregated_output":"PING\n",
                    "exit_code":0,"status":"completed"}
        })).unwrap();
        assert_eq!(ev, QuackAgentEvent::ToolCallEnd {
            id: "item_0".into(), output: "PING\n".into(), error: None,
        });
    }

    #[test]
    fn failed_command_execution_carries_error() {
        let ev = codex_stream_to_quack(serde_json::json!({
            "type":"item.completed",
            "item":{"id":"item_0","type":"command_execution",
                    "command":"/bin/zsh -lc 'echo X > b.txt'",
                    "aggregated_output":"zsh: operation not permitted: b.txt\n",
                    "exit_code":1,"status":"failed"}
        })).unwrap();
        match ev {
            QuackAgentEvent::ToolCallEnd { error: Some(e), .. } => {
                assert!(e.contains("operation not permitted"));
            }
            other => panic!("expected ToolCallEnd with error, got {other:?}"),
        }
    }

    #[test]
    fn agent_message_is_textdelta() {
        let ev = codex_stream_to_quack(serde_json::json!({
            "type":"item.completed",
            "item":{"id":"item_1","type":"agent_message","text":"done"}
        })).unwrap();
        assert_eq!(ev, QuackAgentEvent::TextDelta { content: "done".into() });
    }

    #[test]
    fn turn_completed_maps_in_stream_usage() {
        let ev = codex_stream_to_quack(serde_json::json!({
            "type":"turn.completed",
            "usage":{"input_tokens":45761,"cached_input_tokens":41728,
                     "output_tokens":124,"reasoning_output_tokens":64}
        })).unwrap();
        assert_eq!(ev, QuackAgentEvent::Usage {
            input_tokens: 45761, output_tokens: 124, cached_tokens: 41728, cost_usd: None,
        });
    }

    #[test]
    fn error_event_classified() {
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
    fn non_tool_item_started_is_ignored() {
        assert!(codex_stream_to_quack(serde_json::json!({
            "type":"item.started",
            "item":{"id":"x","type":"agent_message","status":"in_progress"}
        })).is_none());
    }

    #[test]
    fn full_tool_run_fixture_shape() {
        // Includes the non-JSON "Reading additional input…" preamble line,
        // which must be skipped (parse_all filters non-JSON).
        let raw = include_str!("fixtures/codex_stream_tool_run.jsonl");
        let evs = parse_all(raw);
        assert!(matches!(evs.first(), Some(QuackAgentEvent::SessionStarted { .. })));
        assert!(matches!(evs.last(), Some(QuackAgentEvent::Usage { .. })));
        assert_eq!(evs.iter().filter(|e| matches!(e, QuackAgentEvent::ToolCallStart { .. })).count(), 1);
        assert_eq!(evs.iter().filter(|e| matches!(e, QuackAgentEvent::ToolCallEnd { .. })).count(), 1);
        assert_eq!(evs.iter().filter(|e| matches!(e, QuackAgentEvent::TextDelta { .. })).count(), 1);
    }

    #[test]
    fn subagent_fixture_surfaces_collab_and_child_result() {
        let raw = include_str!("fixtures/codex_subagent.jsonl");
        let evs = parse_all(raw);
        assert!(matches!(evs.first(), Some(QuackAgentEvent::SessionStarted { .. })));
        // The `wait` collab tool completes carrying the child's "42" message.
        assert!(evs.iter().any(|e| matches!(
            e, QuackAgentEvent::ToolCallEnd { output, .. } if output.contains("42"))));
        assert!(evs.iter().any(|e| matches!(
            e, QuackAgentEvent::TextDelta { content } if content.contains("42"))));
        assert!(matches!(evs.last(), Some(QuackAgentEvent::Usage { .. })));
    }

    #[test]
    fn skill_discovery_fixture_parses_without_panic() {
        // Large mcp_tool_call result (posthog resources) must not panic the
        // char-truncation and must still yield the skill token in a TextDelta.
        let raw = include_str!("fixtures/codex_skill_discovery.jsonl");
        let evs = parse_all(raw);
        assert!(evs.iter().any(|e| matches!(e, QuackAgentEvent::ToolCallEnd { .. })));
        assert!(evs.iter().any(|e| matches!(
            e, QuackAgentEvent::TextDelta { content } if content.contains("QUACKSPIKE_OK_7F3A"))));
    }
}

/// Translate a Claude Agent SDK event (raw JSON, as emitted by stream-daemon.js
/// and parsed in claude_cli.rs) into a QuackAgentEvent. Subset for Milestone 1.
/// Claude is the existing default — this adapter is additive, it does NOT
/// replace the existing `claude-event:{agent_id}` path (zero behavior change).
pub fn claude_event_to_quack(v: &serde_json::Value) -> Option<QuackAgentEvent> {
    match v.get("type")?.as_str()? {
        "system" if v.get("subtype").and_then(|s| s.as_str()) == Some("init") => {
            Some(QuackAgentEvent::SessionStarted {
                backend_session_id: v.get("session_id")?.as_str()?.to_string(),
                model: v.get("model").and_then(|m| m.as_str()).map(String::from),
                backend: AgentBackendKind::Claude,
            })
        }
        "result" => {
            let u = v.get("usage")?;
            Some(QuackAgentEvent::Usage {
                input_tokens: u.get("input_tokens").and_then(|n| n.as_u64()).unwrap_or(0),
                output_tokens: u.get("output_tokens").and_then(|n| n.as_u64()).unwrap_or(0),
                cached_tokens: u.get("cache_read_input_tokens").and_then(|n| n.as_u64()).unwrap_or(0),
                cost_usd: v.get("total_cost_usd").and_then(|c| c.as_f64()),
            })
        }
        "error" => {
            let message = v.get("error").and_then(|e| e.get("message"))
                .and_then(|m| m.as_str())
                .or_else(|| v.get("message").and_then(|m| m.as_str()))
                .unwrap_or("unknown error").to_string();
            Some(QuackAgentEvent::Error { code: "claude".into(), message, recoverable: false })
        }
        _ => None,
    }
}

#[cfg(test)]
mod claude_event_tests {
    use super::*;

    #[test]
    fn system_init_is_session_started() {
        let v = serde_json::json!({
            "type":"system","subtype":"init",
            "session_id":"claude-sess-1","model":"claude-opus-4-7"
        });
        assert_eq!(claude_event_to_quack(&v).unwrap(), QuackAgentEvent::SessionStarted {
            backend_session_id: "claude-sess-1".into(),
            model: Some("claude-opus-4-7".into()),
            backend: AgentBackendKind::Claude,
        });
    }

    #[test]
    fn result_event_maps_usage() {
        let v = serde_json::json!({
            "type":"result","subtype":"success","session_id":"s",
            "total_cost_usd":0.012,
            "usage":{"input_tokens":10,"output_tokens":5,"cache_read_input_tokens":3,"cache_creation_input_tokens":2}
        });
        assert_eq!(claude_event_to_quack(&v).unwrap(), QuackAgentEvent::Usage {
            input_tokens: 10, output_tokens: 5, cached_tokens: 3, cost_usd: Some(0.012),
        });
    }

    #[test]
    fn error_event_is_recoverable_false_by_default() {
        let v = serde_json::json!({"type":"error","error":{"message":"boom"}});
        match claude_event_to_quack(&v).unwrap() {
            QuackAgentEvent::Error { message, .. } => assert_eq!(message, "boom"),
            other => panic!("got {other:?}"),
        }
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
