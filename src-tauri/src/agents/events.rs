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
