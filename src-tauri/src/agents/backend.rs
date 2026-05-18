//! The agent-level abstraction boundary (decision doc). Adapters are THIN
//! wrappers over complete agent harnesses — they do not reimplement the loop.
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use super::events::AgentBackendKind;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartSessionParams {
    pub agent_id: String,
    pub session_key: String,
    pub working_dir: String,
    pub model: Option<String>,
    /// Frontend turn id, echoed back in every emitted event (parity with Claude path).
    pub turn_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackendSessionHandle {
    pub backend: AgentBackendKind,
    pub backend_session_id: Option<String>,
    pub agent_id: String,
    pub session_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum AuthStatus {
    Ready { method: String },
    NotConfigured,
    Expired { detail: String },
}

#[async_trait]
pub trait AgentBackend: Send + Sync {
    fn kind(&self) -> AgentBackendKind;
    async fn auth_status(&self) -> AuthStatus;
    async fn send_message(
        &self,
        params: StartSessionParams,
        prompt: String,
    ) -> Result<BackendSessionHandle, String>;
    async fn resume(
        &self,
        backend_session_id: &str,
        params: StartSessionParams,
        prompt: String,
    ) -> Result<BackendSessionHandle, String>;
    async fn cancel(&self, session_key: &str) -> Result<(), String>;
}
