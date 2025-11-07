// 🔐 Secure Keychain Management for Quack App
// Stores sensitive API keys in macOS Keychain instead of plain text
//
// Security improvements:
// - All API keys stored in system keychain
// - Keys encrypted by macOS
// - Keys never written to disk in plain text
// - Automatic fallback to preferences store for migration

use anyhow::{Context, Result};
use keyring::Entry;
use tauri::AppHandle;

// Keychain service identifier for Quack
const KEYCHAIN_SERVICE: &str = "com.quack.terminal";

// Key identifiers
const CLAUDE_API_KEY: &str = "claude_api_key";
const OPENAI_API_KEY: &str = "openai_api_key";

/// Store Claude API key securely in macOS Keychain
pub fn store_claude_key(api_key: &str) -> Result<()> {
    let entry = Entry::new(KEYCHAIN_SERVICE, CLAUDE_API_KEY)
        .context("Failed to create keychain entry for Claude API key")?;

    entry
        .set_password(api_key)
        .context("Failed to store Claude API key in keychain")?;

    log::info!("🔐 Claude API key stored securely in macOS Keychain");
    Ok(())
}

/// Retrieve Claude API key from macOS Keychain
pub fn get_claude_key() -> Result<Option<String>> {
    let entry = Entry::new(KEYCHAIN_SERVICE, CLAUDE_API_KEY)
        .context("Failed to create keychain entry for Claude API key")?;

    match entry.get_password() {
        Ok(key) if !key.is_empty() => {
            log::debug!("🔐 Claude API key retrieved from keychain");
            Ok(Some(key))
        }
        Ok(_) => Ok(None), // Empty key
        Err(_) => Ok(None), // Key not found
    }
}

/// Delete Claude API key from keychain
pub fn delete_claude_key() -> Result<()> {
    let entry = Entry::new(KEYCHAIN_SERVICE, CLAUDE_API_KEY)
        .context("Failed to create keychain entry for Claude API key")?;

    match entry.delete_credential() {
        Ok(_) => {
            log::info!("🔐 Claude API key deleted from keychain");
            Ok(())
        }
        Err(_) => Ok(()), // Already deleted or not found
    }
}

/// Store OpenAI API key securely in macOS Keychain
pub fn store_openai_key(api_key: &str) -> Result<()> {
    let entry = Entry::new(KEYCHAIN_SERVICE, OPENAI_API_KEY)
        .context("Failed to create keychain entry for OpenAI API key")?;

    entry
        .set_password(api_key)
        .context("Failed to store OpenAI API key in keychain")?;

    log::info!("🔐 OpenAI API key stored securely in macOS Keychain");
    Ok(())
}

/// Retrieve OpenAI API key from macOS Keychain
pub fn get_openai_key() -> Result<Option<String>> {
    let entry = Entry::new(KEYCHAIN_SERVICE, OPENAI_API_KEY)
        .context("Failed to create keychain entry for OpenAI API key")?;

    match entry.get_password() {
        Ok(key) if !key.is_empty() => {
            log::debug!("🔐 OpenAI API key retrieved from keychain");
            Ok(Some(key))
        }
        Ok(_) => Ok(None), // Empty key
        Err(_) => Ok(None), // Key not found
    }
}

/// Delete OpenAI API key from keychain
pub fn delete_openai_key() -> Result<()> {
    let entry = Entry::new(KEYCHAIN_SERVICE, OPENAI_API_KEY)
        .context("Failed to create keychain entry for OpenAI API key")?;

    match entry.delete_credential() {
        Ok(_) => {
            log::info!("🔐 OpenAI API key deleted from keychain");
            Ok(())
        }
        Err(_) => Ok(()), // Already deleted or not found
    }
}

// ===========================================
// MIGRATION HELPERS
// ===========================================

/// Migrate API keys from preferences store to keychain
/// This should be called on app startup to migrate existing users
pub async fn migrate_keys_to_keychain(app: &AppHandle) -> Result<()> {
    use crate::preferences;

    log::info!("🔄 Checking for API keys to migrate to keychain...");

    // Get current preferences
    let prefs = preferences::get_preferences(app.clone())
        .await
        .map_err(|e| anyhow::anyhow!("Failed to get preferences for migration: {}", e))?;

    let mut migrated = false;

    // Migrate Claude API key if exists
    if let Some(claude_key) = prefs.claude_api_key {
        if !claude_key.is_empty() {
            if let Err(e) = store_claude_key(&claude_key) {
                log::warn!("⚠️ Failed to migrate Claude API key to keychain: {}", e);
            } else {
                log::info!("✅ Migrated Claude API key to keychain");
                migrated = true;
            }
        }
    }

    // Migrate OpenAI API key if exists
    if let Some(openai_key) = prefs.openai_api_key {
        if !openai_key.is_empty() {
            if let Err(e) = store_openai_key(&openai_key) {
                log::warn!("⚠️ Failed to migrate OpenAI API key to keychain: {}", e);
            } else {
                log::info!("✅ Migrated OpenAI API key to keychain");
                migrated = true;
            }
        }
    }

    if migrated {
        log::info!("🎉 API key migration to keychain completed!");
    } else {
        log::debug!("ℹ️ No API keys to migrate");
    }

    Ok(())
}

// ===========================================
// TAURI COMMANDS
// ===========================================

#[tauri::command]
pub fn set_claude_api_key_secure(api_key: String) -> Result<(), String> {
    store_claude_key(&api_key).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_claude_api_key_secure() -> Result<Option<String>, String> {
    get_claude_key().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_claude_api_key_secure() -> Result<(), String> {
    delete_claude_key().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_openai_api_key_secure(api_key: String) -> Result<(), String> {
    store_openai_key(&api_key).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_openai_api_key_secure() -> Result<Option<String>, String> {
    get_openai_key().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_openai_api_key_secure() -> Result<(), String> {
    delete_openai_key().map_err(|e| e.to_string())
}

/// Check if API keys are stored in keychain
#[tauri::command]
pub fn check_api_keys_in_keychain() -> Result<(bool, bool), String> {
    let has_claude = get_claude_key()
        .map(|k| k.is_some())
        .unwrap_or(false);

    let has_openai = get_openai_key()
        .map(|k| k.is_some())
        .unwrap_or(false);

    Ok((has_claude, has_openai))
}
