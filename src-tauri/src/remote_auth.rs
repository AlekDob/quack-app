//! Remote API Authentication
//!
//! Bearer token state for /api/* routes. Token is a 32-char hex string
//! generated once and stored in quack-remote.json via Tauri Store.
//! Auth is checked inline by ApiState::check_auth() in each handler.

use std::sync::Arc;
use tokio::sync::RwLock;

// ─── Auth State ────────────────────────────────────────────────────

/// Shared auth state — holds token and remote-enabled flag
#[derive(Clone)]
pub struct RemoteAuthState {
    token: Arc<RwLock<Option<String>>>,
    enabled: Arc<RwLock<bool>>,
}

impl RemoteAuthState {
    pub fn new() -> Self {
        Self {
            token: Arc::new(RwLock::new(None)),
            enabled: Arc::new(RwLock::new(false)),
        }
    }

    pub async fn set_token(&self, token: String) {
        *self.token.write().await = Some(token);
    }

    pub async fn get_token(&self) -> Option<String> {
        self.token.read().await.clone()
    }

    pub async fn set_enabled(&self, enabled: bool) {
        *self.enabled.write().await = enabled;
    }

    pub async fn is_enabled(&self) -> bool {
        *self.enabled.read().await
    }
}

// ─── Token Generation ──────────────────────────────────────────────

/// Generate a new 32-char hex token
pub fn generate_token() -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    let bytes: [u8; 16] = rng.gen();
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}
