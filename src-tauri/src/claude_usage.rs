// Live Claude plan-limit usage — same data as Claude Code's /usage panel.
// OAuth token source:
//   macOS  → Keychain service "Claude Code-credentials" (CLI default since ~2025)
//   Linux/Windows → ~/.claude/.credentials.json

use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Duration;

const USAGE_URL: &str = "https://api.anthropic.com/api/oauth/usage";
const PROFILE_URL: &str = "https://api.anthropic.com/api/oauth/profile";
const TOKEN_URL: &str = "https://console.anthropic.com/v1/oauth/token";
const CLIENT_ID: &str = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";
#[cfg(target_os = "macos")]
const KEYCHAIN_SERVICE: &str = "Claude Code-credentials";

enum CredStore {
    #[cfg(target_os = "macos")]
    Keychain,
    File(PathBuf),
}

fn user_home() -> Result<PathBuf, String> {
    if let Some(h) = std::env::var_os("HOME") {
        let p = PathBuf::from(h);
        if p.is_absolute() {
            return Ok(p);
        }
    }
    #[cfg(windows)]
    if let Some(p) = std::env::var_os("USERPROFILE") {
        return Ok(PathBuf::from(p));
    }
    #[cfg(not(windows))]
    if let Ok(user) = std::env::var("USER") {
        let p = PathBuf::from(format!("/Users/{}", user));
        if p.is_dir() {
            return Ok(p);
        }
    }
    dirs::home_dir().ok_or_else(|| "no home dir".to_string())
}

fn cred_file_path(home: &Path) -> PathBuf {
    home.join(".claude").join(".credentials.json")
}

#[cfg(target_os = "macos")]
fn read_keychain_credentials() -> Result<Value, String> {
    let out = Command::new("security")
        .args(["find-generic-password", "-s", KEYCHAIN_SERVICE, "-w"])
        .output()
        .map_err(|e| format!("keychain read failed: {}", e))?;
    if !out.status.success() {
        return Err("Claude Code OAuth not in Keychain".to_string());
    }
    let raw = String::from_utf8_lossy(&out.stdout).trim().to_string();
    serde_json::from_str(&raw).map_err(|e| format!("keychain credentials parse: {}", e))
}

#[cfg(target_os = "macos")]
fn write_keychain_credentials(cred: &Value) -> Result<(), String> {
    let raw = serde_json::to_string(cred).map_err(|e| e.to_string())?;
    let status = Command::new("security")
        .args([
            "add-generic-password",
            "-U",
            "-s",
            KEYCHAIN_SERVICE,
            "-w",
            &raw,
        ])
        .status()
        .map_err(|e| format!("keychain write failed: {}", e))?;
    if status.success() {
        Ok(())
    } else {
        Err("could not update Claude Code Keychain entry".to_string())
    }
}

fn read_file_credentials(path: &Path) -> Result<Value, String> {
    let raw = std::fs::read_to_string(path)
        .map_err(|_| format!("no credentials at {}", path.display()))?;
    serde_json::from_str(&raw).map_err(|e| format!("credentials parse: {}", e))
}

fn load_credentials(home: &Path) -> Result<(Value, CredStore), String> {
    #[cfg(target_os = "macos")]
    if let Ok(cred) = read_keychain_credentials() {
        return Ok((cred, CredStore::Keychain));
    }
    let path = cred_file_path(home);
    let cred = read_file_credentials(&path).map_err(|_| {
        "Claude Code OAuth not found (macOS Keychain or ~/.claude/.credentials.json) — run `claude /login`".to_string()
    })?;
    Ok((cred, CredStore::File(path)))
}

fn save_credentials(store: &CredStore, cred: &Value) -> Result<(), String> {
    match store {
        #[cfg(target_os = "macos")]
        CredStore::Keychain => write_keychain_credentials(cred),
        CredStore::File(path) => {
            let out = serde_json::to_string_pretty(cred).map_err(|e| e.to_string())?;
            std::fs::write(path, out).map_err(|e| format!("could not save credentials: {}", e))
        }
    }
}

fn oauth_agent() -> ureq::Agent {
    ureq::Agent::config_builder()
        .timeout_global(Some(Duration::from_secs(10)))
        .build()
        .into()
}

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn token_expired(oauth: &Value) -> bool {
    let expires_at = oauth.get("expiresAt").and_then(|v| v.as_i64()).unwrap_or(0);
    expires_at > 0 && expires_at < now_ms()
}

fn oauth_get(url: &str, token: &str) -> Result<Value, String> {
    let mut resp = oauth_agent()
        .get(url)
        .header("Authorization", &format!("Bearer {}", token))
        .header("anthropic-beta", "oauth-2025-04-20")
        .call()
        .map_err(|e| format!("request failed: {}", e))?;
    resp.body_mut()
        .read_json::<Value>()
        .map_err(|e| format!("bad response: {}", e))
}

fn refresh_oauth(store: &CredStore, cred: &mut Value) -> Result<String, String> {
    let oauth = cred
        .get_mut("claudeAiOauth")
        .ok_or_else(|| "not signed in via claude.ai OAuth".to_string())?;
    let refresh = oauth
        .get("refreshToken")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "no refresh token — run `claude /login`".to_string())?;
    let body = json!({
        "grant_type": "refresh_token",
        "refresh_token": refresh,
        "client_id": CLIENT_ID,
    });
    let mut resp = oauth_agent()
        .post(TOKEN_URL)
        .header("Content-Type", "application/json")
        .send_json(body)
        .map_err(|e| format!("token refresh failed: {}", e))?;
    let tok: Value = resp
        .body_mut()
        .read_json()
        .map_err(|e| format!("token refresh bad response: {}", e))?;
    let access = tok
        .get("access_token")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "token refresh missing access_token".to_string())?;
    let oauth_obj = oauth
        .as_object_mut()
        .ok_or_else(|| "oauth credentials not an object".to_string())?;
    oauth_obj.insert("accessToken".into(), Value::String(access.to_string()));
    if let Some(rt) = tok.get("refresh_token").and_then(|v| v.as_str()) {
        oauth_obj.insert("refreshToken".into(), Value::String(rt.to_string()));
    }
    if let Some(exp) = tok.get("expires_in").and_then(|v| v.as_i64()) {
        oauth_obj.insert(
            "expiresAt".into(),
            Value::Number((now_ms() + exp * 1000).into()),
        );
    }
    save_credentials(store, cred)?;
    Ok(access.to_string())
}

fn resolve_access_token(home: &Path) -> Result<(String, Value), String> {
    let (mut cred, store) = load_credentials(home)?;
    let oauth_snapshot = cred
        .get("claudeAiOauth")
        .cloned()
        .ok_or_else(|| "not signed in via claude.ai OAuth".to_string())?;
    let token = if token_expired(&oauth_snapshot) {
        refresh_oauth(&store, &mut cred)?
    } else {
        oauth_snapshot
            .get("accessToken")
            .and_then(|v| v.as_str())
            .ok_or_else(|| "no access token in credentials".to_string())?
            .to_string()
    };
    let oauth = cred
        .get("claudeAiOauth")
        .cloned()
        .unwrap_or(Value::Null);
    Ok((token, oauth))
}

fn oauth_subscription(oauth: &Value) -> Value {
    oauth
        .get("subscriptionType")
        .cloned()
        .unwrap_or(Value::Null)
}

fn has_non_oauth_cli_auth(cred: &Value) -> bool {
    for key in ["anthropicApiKey", "apiKey", "api_key"] {
        if cred
            .get(key)
            .and_then(|v| v.as_str())
            .is_some_and(|s| !s.is_empty())
        {
            return true;
        }
    }
    false
}

/// Lightweight auth probe — reads local credentials only (no usage API).
/// Returns `{ status, reason?, subscriptionType? }` where status is one of
/// `signed_in`, `signed_out`, or `needs_login`.
///
/// Async wrapper: the body spawns the `security` keychain subprocess and may
/// refresh the OAuth token over HTTP (blocking `ureq`). Tauri runs non-async
/// commands on the MAIN thread, so this used to freeze the whole window on a
/// slow/offline network. Same pattern as `git.rs::off_thread`.
#[tauri::command]
pub async fn claude_auth_status() -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(claude_auth_status_blocking)
        .await
        .map_err(|e| e.to_string())?
}

fn claude_auth_status_blocking() -> Result<Value, String> {
    let home = user_home()?;
    let (mut cred, store) = match load_credentials(&home) {
        Ok(pair) => pair,
        Err(_) => {
            return Ok(json!({
                "status": "signed_out",
                "reason": "no_credentials",
            }));
        }
    };
    if has_non_oauth_cli_auth(&cred) {
        return Ok(json!({
            "status": "signed_in",
            "reason": "api_key",
        }));
    }
    let oauth_snapshot = match cred.get("claudeAiOauth").cloned() {
        Some(o) => o,
        None => {
            return Ok(json!({
                "status": "signed_out",
                "reason": "no_oauth",
            }));
        }
    };
    if !token_expired(&oauth_snapshot) {
        let has_access = oauth_snapshot
            .get("accessToken")
            .and_then(|v| v.as_str())
            .is_some_and(|s| !s.is_empty());
        if has_access {
            return Ok(json!({
                "status": "signed_in",
                "subscriptionType": oauth_subscription(&oauth_snapshot),
            }));
        }
        return Ok(json!({
            "status": "needs_login",
            "reason": "no_access_token",
        }));
    }
    match refresh_oauth(&store, &mut cred) {
        Ok(_) => {
            let oauth = cred
                .get("claudeAiOauth")
                .cloned()
                .unwrap_or(Value::Null);
            Ok(json!({
                "status": "signed_in",
                "subscriptionType": oauth_subscription(&oauth),
            }))
        }
        Err(_) => Ok(json!({
            "status": "needs_login",
            "reason": "refresh_failed",
        })),
    }
}

/// Returns `{ usage, profile, subscriptionType, rateLimitTier }`.
///
/// Async wrapper: the body makes sequential blocking HTTP calls (usage +
/// profile, plus a possible token refresh — each with a 10s timeout). On the
/// main thread that froze the UI for up to ~30s per poll when offline. Runs
/// off-thread via `spawn_blocking` (ureq stays sync).
#[tauri::command]
pub async fn claude_usage_limits() -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(claude_usage_limits_blocking)
        .await
        .map_err(|e| e.to_string())?
}

fn claude_usage_limits_blocking() -> Result<Value, String> {
    let home = user_home()?;
    let (token, oauth) = resolve_access_token(&home)?;
    let usage = oauth_get(USAGE_URL, &token)?;
    let profile = oauth_get(PROFILE_URL, &token).unwrap_or(Value::Null);
    Ok(json!({
        "usage": usage,
        "profile": profile,
        "subscriptionType": oauth.get("subscriptionType").cloned().unwrap_or(Value::Null),
        "rateLimitTier": oauth.get("rateLimitTier").cloned().unwrap_or(Value::Null),
    }))
}
