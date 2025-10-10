use anyhow::{Context, Result};
use keyring::Entry;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeCredentials {
    pub auth_type: AuthType,
    pub token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AuthType {
    OAuth,
    ApiKey,
}

#[derive(Debug, Deserialize)]
struct ClaudeCredsFile {
    #[serde(default)]
    session_key: Option<String>,
    #[serde(default)]
    api_key: Option<String>,
    #[serde(default)]
    access_token: Option<String>,
}

/// Try to read Claude credentials from multiple sources in priority order:
/// 1. macOS Keychain (if on macOS)
/// 2. ~/.claude/.credentials.json file
/// 3. Return None if not found
pub fn get_claude_credentials() -> Result<Option<ClaudeCredentials>> {
    // Try macOS Keychain first
    if let Ok(Some(creds)) = try_keychain_credentials() {
        log::info!("Found Claude credentials in macOS Keychain");
        return Ok(Some(creds));
    }

    // Try credentials file
    if let Ok(Some(creds)) = try_credentials_file() {
        log::info!("Found Claude credentials in ~/.claude/.credentials.json");
        return Ok(Some(creds));
    }

    log::info!("No Claude CLI credentials found");
    Ok(None)
}

/// Try to read credentials from macOS Keychain
fn try_keychain_credentials() -> Result<Option<ClaudeCredentials>> {
    #[cfg(target_os = "macos")]
    {
        // Try different keychain service names that Claude Code might use
        let service_names = vec![
            "claude-code",
            "claude",
            "anthropic-claude",
            "com.anthropic.claude-code",
        ];

        for service in service_names {
            // Try to read OAuth token
            if let Ok(entry) = Entry::new(service, "oauth_token") {
                if let Ok(token) = entry.get_password() {
                    if !token.is_empty() {
                        return Ok(Some(ClaudeCredentials {
                            auth_type: AuthType::OAuth,
                            token,
                        }));
                    }
                }
            }

            // Try to read API key
            if let Ok(entry) = Entry::new(service, "api_key") {
                if let Ok(token) = entry.get_password() {
                    if !token.is_empty() {
                        return Ok(Some(ClaudeCredentials {
                            auth_type: AuthType::ApiKey,
                            token,
                        }));
                    }
                }
            }

            // Try generic "token" key
            if let Ok(entry) = Entry::new(service, "token") {
                if let Ok(token) = entry.get_password() {
                    if !token.is_empty() {
                        // Default to OAuth if found in keychain
                        return Ok(Some(ClaudeCredentials {
                            auth_type: AuthType::OAuth,
                            token,
                        }));
                    }
                }
            }
        }
    }

    Ok(None)
}

/// Try to read credentials from ~/.claude/.credentials.json
fn try_credentials_file() -> Result<Option<ClaudeCredentials>> {
    let home = dirs::home_dir().context("Unable to find home directory")?;
    let creds_path = home.join(".claude").join(".credentials.json");

    if !creds_path.exists() {
        return Ok(None);
    }

    let contents = std::fs::read_to_string(&creds_path)
        .with_context(|| format!("Unable to read credentials file: {:?}", creds_path))?;

    let creds: ClaudeCredsFile = serde_json::from_str(&contents)
        .context("Unable to parse credentials file")?;

    // Try different fields in priority order
    if let Some(session_key) = creds.session_key {
        if !session_key.is_empty() {
            return Ok(Some(ClaudeCredentials {
                auth_type: AuthType::OAuth,
                token: session_key,
            }));
        }
    }

    if let Some(access_token) = creds.access_token {
        if !access_token.is_empty() {
            return Ok(Some(ClaudeCredentials {
                auth_type: AuthType::OAuth,
                token: access_token,
            }));
        }
    }

    if let Some(api_key) = creds.api_key {
        if !api_key.is_empty() {
            return Ok(Some(ClaudeCredentials {
                auth_type: AuthType::ApiKey,
                token: api_key,
            }));
        }
    }

    Ok(None)
}

/// Check if Claude CLI is authenticated (has valid credentials)
pub fn is_claude_cli_authenticated() -> bool {
    get_claude_credentials()
        .map(|creds| creds.is_some())
        .unwrap_or(false)
}

/// Get the path to Claude credentials file
pub fn get_credentials_file_path() -> Option<PathBuf> {
    dirs::home_dir().map(|home| home.join(".claude").join(".credentials.json"))
}

// Tauri commands

#[tauri::command]
pub fn get_claude_cli_credentials() -> Result<Option<ClaudeCredentials>, String> {
    get_claude_credentials().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn check_claude_cli_auth() -> bool {
    is_claude_cli_authenticated()
}

#[tauri::command]
pub fn get_credentials_path() -> Option<String> {
    get_credentials_file_path().map(|p| p.to_string_lossy().to_string())
}
