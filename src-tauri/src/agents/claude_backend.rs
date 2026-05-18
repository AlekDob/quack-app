//! Thin delegate over the existing persistent Node daemon. ZERO behavior
//! change: every call forwards to claude_cli::* unchanged.
use async_trait::async_trait;
use tauri::AppHandle;
use super::backend::{AgentBackend, AuthStatus, BackendSessionHandle, StartSessionParams};
use super::events::AgentBackendKind;

pub struct ClaudeBackend {
    pub app: AppHandle,
}

#[async_trait]
impl AgentBackend for ClaudeBackend {
    fn kind(&self) -> AgentBackendKind { AgentBackendKind::Claude }

    async fn auth_status(&self) -> AuthStatus {
        // Existing Claude auth is handled by the daemon/env; treat as Ready here.
        AuthStatus::Ready { method: "claude".into() }
    }

    async fn send_message(
        &self,
        params: StartSessionParams,
        _prompt: String,
    ) -> Result<BackendSessionHandle, String> {
        // Milestone 1: Claude continues to be driven by its existing command
        // (send_message_via_sdk_streaming) invoked from the existing React path.
        // This wrapper is the trait face; it does NOT re-route Claude traffic.
        Ok(BackendSessionHandle {
            backend: AgentBackendKind::Claude,
            backend_session_id: None,
            agent_id: params.agent_id,
            session_key: params.session_key,
        })
    }

    async fn resume(
        &self,
        _backend_session_id: &str,
        params: StartSessionParams,
        prompt: String,
    ) -> Result<BackendSessionHandle, String> {
        self.send_message(params, prompt).await
    }

    async fn cancel(&self, session_key: &str) -> Result<(), String> {
        crate::claude_cli::abort_sdk_stream(session_key.to_string()).await
    }
}
