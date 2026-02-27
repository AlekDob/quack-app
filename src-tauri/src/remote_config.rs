//! Remote API Configuration
//!
//! Load/save remote API settings (enabled, token, port) via Tauri Store.
//! Config file: quack-remote.json

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use tauri_plugin_store::StoreExt;

use crate::remote_auth;

const REMOTE_STORE: &str = "quack-remote.json";
const REMOTE_KEY: &str = "remote";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteConfig {
    /// Enable Remote API (binds to 0.0.0.0 instead of 127.0.0.1)
    #[serde(default)]
    pub enabled: bool,
    /// Bearer auth token (32-char hex)
    #[serde(default)]
    pub token: Option<String>,
    /// Port (default 6768)
    #[serde(default = "default_port")]
    pub port: u16,
}

fn default_port() -> u16 {
    6768
}

impl Default for RemoteConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            token: None,
            port: default_port(),
        }
    }
}

/// Load remote config from Tauri Store, generating a token if missing
pub fn load_config(app: &AppHandle) -> RemoteConfig {
    let store = match app.store(REMOTE_STORE) {
        Ok(s) => s,
        Err(e) => {
            log::warn!("Failed to open remote store: {}", e);
            return RemoteConfig::default();
        }
    };

    let mut config = store
        .get(REMOTE_KEY)
        .and_then(|v| serde_json::from_value::<RemoteConfig>(v.clone()).ok())
        .unwrap_or_default();

    // Generate token on first use
    if config.token.is_none() {
        config.token = Some(remote_auth::generate_token());
        save_config_to_store(&store, &config);
        log::info!("🔑 Generated new Remote API token");
    }

    config
}

/// Save remote config to Tauri Store
pub fn save_config(app: &AppHandle, config: &RemoteConfig) -> Result<(), String> {
    let store = app
        .store(REMOTE_STORE)
        .map_err(|e| format!("Failed to open remote store: {}", e))?;

    save_config_to_store(&store, config);
    Ok(())
}

fn save_config_to_store(
    store: &tauri_plugin_store::Store<tauri::Wry>,
    config: &RemoteConfig,
) {
    if let Ok(value) = serde_json::to_value(config) {
        store.set(REMOTE_KEY, value);
    }
}

// ─── Tauri Commands ────────────────────────────────────────────────

#[tauri::command]
pub async fn get_remote_config(app: AppHandle) -> Result<RemoteConfig, String> {
    let mut config = load_config(&app);
    // Return the actual runtime port (dev mode uses port+1 to avoid conflict)
    if cfg!(debug_assertions) {
        config.port += 1;
    }
    Ok(config)
}

#[tauri::command]
pub async fn set_remote_enabled(app: AppHandle, enabled: bool) -> Result<RemoteConfig, String> {
    let mut config = load_config(&app);
    config.enabled = enabled;
    save_config(&app, &config)?;

    // Update auth state
    let auth = app.state::<remote_auth::RemoteAuthState>();
    auth.set_enabled(enabled).await;

    log::info!(
        "🌐 Remote API {}",
        if enabled { "ENABLED (0.0.0.0)" } else { "DISABLED (127.0.0.1)" }
    );

    Ok(config)
}

#[tauri::command]
pub async fn regenerate_remote_token(app: AppHandle) -> Result<RemoteConfig, String> {
    let mut config = load_config(&app);
    let new_token = remote_auth::generate_token();
    config.token = Some(new_token.clone());
    save_config(&app, &config)?;

    // Update auth state
    let auth = app.state::<remote_auth::RemoteAuthState>();
    auth.set_token(new_token).await;

    log::info!("🔑 Remote API token regenerated");
    Ok(config)
}

#[tauri::command]
pub async fn get_local_ip() -> Result<String, String> {
    get_local_ip_address().ok_or_else(|| "Could not determine local IP".to_string())
}

#[tauri::command]
pub async fn get_local_hostname() -> Result<String, String> {
    hostname::get()
        .map_err(|e| format!("Could not get hostname: {}", e))
        .and_then(|h| {
            h.into_string()
                .map_err(|_| "Hostname contains invalid UTF-8".to_string())
        })
        .map(|name| {
            // Append .local for mDNS if not already present
            if name.ends_with(".local") {
                name
            } else {
                format!("{}.local", name)
            }
        })
}

/// Get the local LAN IP address
pub fn get_local_ip_address() -> Option<String> {
    use std::net::UdpSocket;
    // Connect to a public DNS to determine outgoing interface
    let socket = UdpSocket::bind("0.0.0.0:0").ok()?;
    socket.connect("8.8.8.8:80").ok()?;
    let addr = socket.local_addr().ok()?;
    Some(addr.ip().to_string())
}
