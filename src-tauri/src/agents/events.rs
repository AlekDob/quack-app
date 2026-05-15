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
