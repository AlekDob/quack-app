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

/// Try to read credentials from multiple possible locations
/// Claude Code can store credentials in several places:
/// 1. ~/.claude.json (new format with oauthAccount)
/// 2. ~/.claude/.credentials.json (common format)
/// 3. ~/.config/claude-code/auth.json (recent/remote configurations)
fn try_credentials_file() -> Result<Option<ClaudeCredentials>> {
    let home = dirs::home_dir().context("Unable to find home directory")?;

    // List of all possible credential file locations (in priority order)
    let credential_paths = vec![
        // Priority 1: ~/.claude.json (newest format with OAuth)
        (home.join(".claude.json"), true), // is_oauth_format
        // Priority 2: ~/.claude/.credentials.json (standard format)
        (home.join(".claude").join(".credentials.json"), false),
        // Priority 3: ~/.config/claude-code/auth.json (alternative location)
        (home.join(".config").join("claude-code").join("auth.json"), false),
    ];

    // Try each path in order
    for (path, is_oauth_format) in credential_paths {
        if !path.exists() {
            continue;
        }

        log::info!("[Auth] Checking {:?}", path);

        let contents = match std::fs::read_to_string(&path) {
            Ok(c) => c,
            Err(e) => {
                log::warn!("[Auth] Failed to read {:?}: {}", path, e);
                continue;
            }
        };

        // Handle OAuth format (~/.claude.json)
        if is_oauth_format {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&contents) {
                if let Some(oauth_account) = json.get("oauthAccount") {
                    if oauth_account.is_object() {
                        log::info!("[Auth] Found OAuth account in {:?}", path);
                        return Ok(Some(ClaudeCredentials {
                            auth_type: AuthType::OAuth,
                            token: "oauth_configured".to_string(),
                        }));
                    }
                }
            }
            continue;
        }

        // Handle standard credentials format
        let creds: ClaudeCredsFile = match serde_json::from_str(&contents) {
            Ok(c) => c,
            Err(e) => {
                log::warn!("[Auth] Failed to parse {:?}: {}", path, e);
                continue;
            }
        };

        // Try different fields in priority order
        if let Some(session_key) = creds.session_key {
            if !session_key.is_empty() {
                log::info!("[Auth] Found session_key in {:?}", path);
                return Ok(Some(ClaudeCredentials {
                    auth_type: AuthType::OAuth,
                    token: session_key,
                }));
            }
        }

        if let Some(access_token) = creds.access_token {
            if !access_token.is_empty() {
                log::info!("[Auth] Found access_token in {:?}", path);
                return Ok(Some(ClaudeCredentials {
                    auth_type: AuthType::OAuth,
                    token: access_token,
                }));
            }
        }

        if let Some(api_key) = creds.api_key {
            if !api_key.is_empty() {
                log::info!("[Auth] Found api_key in {:?}", path);
                return Ok(Some(ClaudeCredentials {
                    auth_type: AuthType::ApiKey,
                    token: api_key,
                }));
            }
        }

        log::info!("[Auth] {:?} exists but contains no valid credentials", path);
    }

    log::info!("[Auth] No credentials found in any known location");
    Ok(None)
}

/// Check if Claude CLI is authenticated (has valid credentials)
pub fn is_claude_cli_authenticated() -> bool {
    get_claude_credentials()
        .map(|creds| creds.is_some())
        .unwrap_or(false)
}

/// Get the path to Claude credentials file (finds the actual existing file)
pub fn get_credentials_file_path() -> Option<PathBuf> {
    let home = dirs::home_dir()?;

    // Check all possible credential file locations
    let possible_paths = vec![
        home.join(".claude.json"),
        home.join(".claude").join(".credentials.json"),
        home.join(".config").join("claude-code").join("auth.json"),
    ];

    // Return the first path that actually exists
    possible_paths.iter()
        .find(|p| p.exists())
        .cloned()
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

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthDebugInfo {
    // Environment
    anthropic_api_key: bool,
    claude_code_use_bedrock: bool,
    claude_code_use_vertex: bool,
    node_version: String,
    platform: String,

    // Claude CLI
    cli_available: bool,
    cli_path: Option<String>,
    cli_version: Option<String>,

    // Credentials
    credentials_path: Option<String>,
    credentials_exists: bool,
    credentials_valid: bool,

    // SDK
    sdk_version: String,
    last_error: Option<String>,
}

#[tauri::command]
pub fn get_auth_debug_info() -> Result<AuthDebugInfo, String> {
    use crate::claude_cli::check_claude_cli_available;

    // Check environment variables — also check login shell env for GUI-launched Quack
    // Brain: fix-bedrock-env-vars-gui-launch
    let login_env = crate::shell_env::get_login_env();
    let process_bedrock = std::env::var("CLAUDE_CODE_USE_BEDROCK").ok();
    let login_bedrock = login_env.get("CLAUDE_CODE_USE_BEDROCK").cloned();
    log::info!("[AuthDebug] CLAUDE_CODE_USE_BEDROCK — process: {:?}, login_shell: {:?}, login_env_size: {}",
        process_bedrock, login_bedrock, login_env.len());

    let anthropic_api_key = std::env::var("ANTHROPIC_API_KEY").is_ok()
        || login_env.contains_key("ANTHROPIC_API_KEY");
    let claude_code_use_bedrock = process_bedrock.as_deref()
        .or(login_bedrock.as_deref())
        .map(|v| v == "1")
        .unwrap_or(false);
    let claude_code_use_vertex = std::env::var("CLAUDE_CODE_USE_VERTEX")
        .or_else(|_| login_env.get("CLAUDE_CODE_USE_VERTEX").cloned().ok_or(()))
        .map(|v| v == "1")
        .unwrap_or(false);

    // Get Node.js version
    let node_version = {
        let mut cmd = std::process::Command::new("node");
        cmd.arg("--version");

        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }

        cmd.output()
            .ok()
            .and_then(|o| String::from_utf8(o.stdout).ok())
            .map(|v| v.trim().to_string())
            .unwrap_or_else(|| "Not found".to_string())
    };

    // Get platform
    let platform = format!("{} {}", std::env::consts::OS, std::env::consts::ARCH);

    // Check Claude CLI
    let cli_available = check_claude_cli_available().unwrap_or(false);
    let cli_path = if cli_available {
        crate::claude_cli::find_claude_cli_path()
    } else {
        None
    };

    let cli_version = cli_path.as_ref().and_then(|path| {
        let mut cmd = std::process::Command::new(path);
        cmd.arg("--version");

        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }

        cmd.output()
            .ok()
            .and_then(|o| String::from_utf8(o.stdout).ok())
            .map(|v| v.trim().to_string())
    });

    // Check credentials in all possible locations
    let home = dirs::home_dir().ok_or("Unable to find home directory")?;

    let possible_paths = vec![
        home.join(".claude.json"),
        home.join(".claude").join(".credentials.json"),
        home.join(".config").join("claude-code").join("auth.json"),
    ];

    // Find which path actually exists
    let existing_path = possible_paths.iter()
        .find(|p| p.exists())
        .cloned();

    let credentials_path = existing_path
        .as_ref()
        .map(|p| p.to_string_lossy().to_string())
        .or_else(|| Some("~/.claude/.credentials.json (or ~/.claude.json or ~/.config/claude-code/auth.json)".to_string()));

    let credentials_exists = existing_path.is_some();
    let credentials_valid = get_claude_credentials()
        .map(|c| c.is_some())
        .unwrap_or(false);

    // Get SDK version from package.json
    let sdk_version = "0.1.14".to_string(); // From your package.json

    Ok(AuthDebugInfo {
        anthropic_api_key,
        claude_code_use_bedrock,
        claude_code_use_vertex,
        node_version,
        platform,
        cli_available,
        cli_path,
        cli_version,
        credentials_path,
        credentials_exists,
        credentials_valid,
        sdk_version,
        last_error: None, // We'll implement error tracking later if needed
    })
}
