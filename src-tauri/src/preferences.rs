use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::{AppHandle, Emitter};
use tauri_plugin_store::StoreExt;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppPreferences {
    pub show_performance_monitor: bool,
    #[serde(default)]
    pub openai_api_key: Option<String>,
    #[serde(default)]
    pub claude_api_key: Option<String>,
    #[serde(default = "default_ai_model")]
    pub ai_model: String,
    #[serde(default = "default_image_model")]
    pub image_model: String,
    #[serde(default = "default_background")]
    pub background_image: String,
    // Mobile notifications settings
    #[serde(default)]
    pub telegram_bot_token: Option<String>,
    #[serde(default)]
    pub telegram_chat_id: Option<String>,
    #[serde(default)]
    pub ntfy_topic: Option<String>,
    #[serde(default)]
    pub enable_mobile_notifications: bool,
    // Quack Central Bot settings
    #[serde(default)]
    pub telegram_unique_id: Option<String>,
    #[serde(default)]
    pub telegram_linked_chat_id: Option<i64>,
    // Mute Telegram bidirectional notifications
    #[serde(default)]
    pub telegram_mute_notifications: bool,
    // Terminal shell preference (None = auto-detect from $SHELL)
    // Brain: fix-shell-env-gui-launch
    #[serde(default)]
    pub default_shell: Option<String>,
    // Brain: 037-anthropic-compatible-providers
    // Namespaced API keys for Anthropic-compatible providers (z.ai, MiniMax, etc.).
    // Map key = provider id (e.g. "zai"), value = base64-encoded token.
    // Additive: does NOT replace `openai_api_key` / `claude_api_key`.
    #[serde(default)]
    pub provider_api_keys: HashMap<String, String>,
}

fn default_ai_model() -> String {
    "gpt-4o-mini".to_string()
}

fn default_image_model() -> String {
    "gpt-image-1.5".to_string()
}

fn default_background() -> String {
    "gradient-midnight".to_string()
}

impl Default for AppPreferences {
    fn default() -> Self {
        Self {
            show_performance_monitor: false,
            openai_api_key: None,
            claude_api_key: None,
            ai_model: default_ai_model(),
            image_model: default_image_model(),
            background_image: default_background(),
            telegram_bot_token: None,
            telegram_chat_id: None,
            ntfy_topic: None,
            enable_mobile_notifications: false,
            telegram_unique_id: None,
            telegram_linked_chat_id: None,
            telegram_mute_notifications: false,
            default_shell: None,
            provider_api_keys: HashMap::new(),
        }
    }
}

const PREFERENCES_STORE: &str = "app-preferences.json";
const PREFERENCES_KEY: &str = "preferences";

#[tauri::command]
pub async fn get_preferences(app: AppHandle) -> Result<AppPreferences, String> {
    let store = app
        .store(PREFERENCES_STORE)
        .map_err(|e| format!("Failed to load preferences store: {}", e))?;

    let prefs = store
        .get(PREFERENCES_KEY)
        .and_then(|v| serde_json::from_value::<AppPreferences>(v.clone()).ok())
        .unwrap_or_default();

    Ok(prefs)
}

#[tauri::command]
pub async fn set_preference(
    app: AppHandle,
    key: String,
    value: bool,
) -> Result<(), String> {
    let store = app
        .store(PREFERENCES_STORE)
        .map_err(|e| format!("Failed to load preferences store: {}", e))?;

    let mut prefs = store
        .get(PREFERENCES_KEY)
        .and_then(|v| serde_json::from_value::<AppPreferences>(v.clone()).ok())
        .unwrap_or_default();

    match key.as_str() {
        "show_performance_monitor" => {
            prefs.show_performance_monitor = value;
        }
        _ => return Err(format!("Unknown preference key: {}", key)),
    }

    store.set(
        PREFERENCES_KEY.to_string(),
        serde_json::to_value(&prefs).map_err(|e| e.to_string())?,
    );

    store.save().map_err(|e| e.to_string())?;

    // Emit event to notify frontend
    app.emit("preferences-changed", &prefs)
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn toggle_performance_monitor(app: AppHandle) -> Result<bool, String> {
    let store = app
        .store(PREFERENCES_STORE)
        .map_err(|e| format!("Failed to load preferences store: {}", e))?;

    let mut prefs = store
        .get(PREFERENCES_KEY)
        .and_then(|v| serde_json::from_value::<AppPreferences>(v.clone()).ok())
        .unwrap_or_default();

    prefs.show_performance_monitor = !prefs.show_performance_monitor;

    store.set(
        PREFERENCES_KEY.to_string(),
        serde_json::to_value(&prefs).map_err(|e| e.to_string())?,
    );

    store.save().map_err(|e| e.to_string())?;

    // Emit event to notify frontend
    app.emit("preferences-changed", &prefs)
        .map_err(|e| e.to_string())?;

    Ok(prefs.show_performance_monitor)
}

#[tauri::command]
pub async fn set_ai_api_key(app: AppHandle, key: String) -> Result<(), String> {
    let store = app
        .store(PREFERENCES_STORE)
        .map_err(|e| format!("Failed to load preferences store: {}", e))?;

    let mut prefs = store
        .get(PREFERENCES_KEY)
        .and_then(|v| serde_json::from_value::<AppPreferences>(v.clone()).ok())
        .unwrap_or_default();

    prefs.openai_api_key = Some(key);

    store.set(
        PREFERENCES_KEY.to_string(),
        serde_json::to_value(&prefs).map_err(|e| e.to_string())?,
    );

    store.save().map_err(|e| e.to_string())?;

    // Emit event to notify frontend
    app.emit("preferences-changed", &prefs)
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn get_ai_api_key(app: AppHandle) -> Result<Option<String>, String> {
    let prefs = get_preferences(app).await?;
    Ok(prefs.openai_api_key)
}

// Brain: 037-anthropic-compatible-providers
// Namespaced provider API key storage. Stores base64-encoded tokens
// per provider id. Does NOT touch the legacy `openai_api_key` field.
#[tauri::command]
pub async fn save_provider_api_key(
    app: AppHandle,
    provider_id: String,
    token: String,
) -> Result<(), String> {
    use base64::{engine::general_purpose::STANDARD, Engine};

    let store = app
        .store(PREFERENCES_STORE)
        .map_err(|e| format!("Failed to load preferences store: {}", e))?;

    let mut prefs = store
        .get(PREFERENCES_KEY)
        .and_then(|v| serde_json::from_value::<AppPreferences>(v.clone()).ok())
        .unwrap_or_default();

    if token.is_empty() {
        prefs.provider_api_keys.remove(&provider_id);
    } else {
        let encoded = STANDARD.encode(token.as_bytes());
        prefs.provider_api_keys.insert(provider_id, encoded);
    }

    store.set(
        PREFERENCES_KEY.to_string(),
        serde_json::to_value(&prefs).map_err(|e| e.to_string())?,
    );
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn get_provider_api_key(
    app: AppHandle,
    provider_id: String,
) -> Result<Option<String>, String> {
    use base64::{engine::general_purpose::STANDARD, Engine};

    let prefs = get_preferences(app).await?;
    let encoded = match prefs.provider_api_keys.get(&provider_id) {
        Some(v) => v.clone(),
        None => return Ok(None),
    };
    let bytes = STANDARD
        .decode(encoded)
        .map_err(|e| format!("Failed to decode provider token: {}", e))?;
    let token = String::from_utf8(bytes)
        .map_err(|e| format!("Invalid UTF-8 in provider token: {}", e))?;
    Ok(Some(token))
}

#[tauri::command]
pub async fn set_ai_model(app: AppHandle, model: String) -> Result<(), String> {
    let store = app
        .store(PREFERENCES_STORE)
        .map_err(|e| format!("Failed to load preferences store: {}", e))?;

    let mut prefs = store
        .get(PREFERENCES_KEY)
        .and_then(|v| serde_json::from_value::<AppPreferences>(v.clone()).ok())
        .unwrap_or_default();

    prefs.ai_model = model;

    store.set(
        PREFERENCES_KEY.to_string(),
        serde_json::to_value(&prefs).map_err(|e| e.to_string())?,
    );

    store.save().map_err(|e| e.to_string())?;

    // Emit event to notify frontend
    app.emit("preferences-changed", &prefs)
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn get_ai_model(app: AppHandle) -> Result<String, String> {
    let prefs = get_preferences(app).await?;
    Ok(prefs.ai_model)
}

#[tauri::command]
pub async fn set_image_model(app: AppHandle, model: String) -> Result<(), String> {
    let store = app
        .store(PREFERENCES_STORE)
        .map_err(|e| format!("Failed to load preferences store: {}", e))?;

    let mut prefs = store
        .get(PREFERENCES_KEY)
        .and_then(|v| serde_json::from_value::<AppPreferences>(v.clone()).ok())
        .unwrap_or_default();

    prefs.image_model = model;

    store.set(
        PREFERENCES_KEY.to_string(),
        serde_json::to_value(&prefs).map_err(|e| e.to_string())?,
    );

    store.save().map_err(|e| e.to_string())?;

    app.emit("preferences-changed", &prefs)
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn get_image_model(app: AppHandle) -> Result<String, String> {
    let prefs = get_preferences(app).await?;
    Ok(prefs.image_model)
}

#[tauri::command]
pub async fn get_background_image(app: AppHandle) -> Result<String, String> {
    let prefs = get_preferences(app).await?;
    Ok(prefs.background_image)
}

#[tauri::command]
pub async fn set_background_image(app: AppHandle, image: String) -> Result<(), String> {
    let store = app
        .store(PREFERENCES_STORE)
        .map_err(|e| format!("Failed to load preferences store: {}", e))?;

    let mut prefs = store
        .get(PREFERENCES_KEY)
        .and_then(|v| serde_json::from_value::<AppPreferences>(v.clone()).ok())
        .unwrap_or_default();

    prefs.background_image = image;

    store.set(
        PREFERENCES_KEY.to_string(),
        serde_json::to_value(&prefs).map_err(|e| e.to_string())?,
    );

    store.save().map_err(|e| e.to_string())?;

    // Emit event to notify frontend
    app.emit("preferences-changed", &prefs)
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn set_claude_api_key(app: AppHandle, key: String) -> Result<(), String> {
    let store = app
        .store(PREFERENCES_STORE)
        .map_err(|e| format!("Failed to load preferences store: {}", e))?;

    let mut prefs = store
        .get(PREFERENCES_KEY)
        .and_then(|v| serde_json::from_value::<AppPreferences>(v.clone()).ok())
        .unwrap_or_default();

    prefs.claude_api_key = Some(key);

    store.set(
        PREFERENCES_KEY.to_string(),
        serde_json::to_value(&prefs).map_err(|e| e.to_string())?,
    );

    store.save().map_err(|e| e.to_string())?;

    // Emit event to notify frontend
    app.emit("preferences-changed", &prefs)
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn get_claude_api_key(app: AppHandle) -> Result<Option<String>, String> {
    let prefs = get_preferences(app).await?;
    Ok(prefs.claude_api_key)
}

#[tauri::command]
pub async fn list_available_backgrounds(app: AppHandle) -> Result<Vec<String>, String> {
    use std::fs;
    use tauri::Manager;

    // Get the resource path relative to the app
    let resource_path = app
        .path()
        .resource_dir()
        .map_err(|e| format!("Failed to get resource directory: {}", e))?;

    let backgrounds_path = resource_path.join("images").join("backgrounds");

    if !backgrounds_path.exists() {
        return Ok(vec![]);
    }

    let entries = fs::read_dir(&backgrounds_path)
        .map_err(|e| format!("Failed to read backgrounds directory: {}", e))?;

    let mut backgrounds = Vec::new();

    for entry in entries {
        if let Ok(entry) = entry {
            let path = entry.path();
            if path.is_file() {
                if let Some(ext) = path.extension() {
                    let ext_str = ext.to_string_lossy().to_lowercase();
                    if ext_str == "png" || ext_str == "jpg" || ext_str == "jpeg" {
                        if let Some(filename) = path.file_name() {
                            backgrounds.push(filename.to_string_lossy().to_string());
                        }
                    }
                }
            }
        }
    }

    backgrounds.sort();
    Ok(backgrounds)
}

// Mobile Notifications Preferences
#[tauri::command]
pub async fn set_telegram_config(
    app: AppHandle,
    token: String,
    chat_id: String,
) -> Result<(), String> {
    let store = app
        .store(PREFERENCES_STORE)
        .map_err(|e| format!("Failed to load preferences store: {}", e))?;

    let mut prefs = store
        .get(PREFERENCES_KEY)
        .and_then(|v| serde_json::from_value::<AppPreferences>(v.clone()).ok())
        .unwrap_or_default();

    prefs.telegram_bot_token = Some(token);
    prefs.telegram_chat_id = Some(chat_id);

    store.set(
        PREFERENCES_KEY.to_string(),
        serde_json::to_value(&prefs).map_err(|e| e.to_string())?,
    );

    store.save().map_err(|e| e.to_string())?;

    app.emit("preferences-changed", &prefs)
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn get_telegram_config(app: AppHandle) -> Result<(Option<String>, Option<String>), String> {
    let prefs = get_preferences(app).await?;
    Ok((prefs.telegram_bot_token, prefs.telegram_chat_id))
}

#[tauri::command]
pub async fn set_ntfy_topic(app: AppHandle, topic: String) -> Result<(), String> {
    let store = app
        .store(PREFERENCES_STORE)
        .map_err(|e| format!("Failed to load preferences store: {}", e))?;

    let mut prefs = store
        .get(PREFERENCES_KEY)
        .and_then(|v| serde_json::from_value::<AppPreferences>(v.clone()).ok())
        .unwrap_or_default();

    prefs.ntfy_topic = Some(topic);

    store.set(
        PREFERENCES_KEY.to_string(),
        serde_json::to_value(&prefs).map_err(|e| e.to_string())?,
    );

    store.save().map_err(|e| e.to_string())?;

    app.emit("preferences-changed", &prefs)
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn get_ntfy_topic(app: AppHandle) -> Result<Option<String>, String> {
    let prefs = get_preferences(app).await?;
    Ok(prefs.ntfy_topic)
}

#[tauri::command]
pub async fn set_mobile_notifications_enabled(
    app: AppHandle,
    enabled: bool,
) -> Result<(), String> {
    let store = app
        .store(PREFERENCES_STORE)
        .map_err(|e| format!("Failed to load preferences store: {}", e))?;

    let mut prefs = store
        .get(PREFERENCES_KEY)
        .and_then(|v| serde_json::from_value::<AppPreferences>(v.clone()).ok())
        .unwrap_or_default();

    prefs.enable_mobile_notifications = enabled;

    store.set(
        PREFERENCES_KEY.to_string(),
        serde_json::to_value(&prefs).map_err(|e| e.to_string())?,
    );

    store.save().map_err(|e| e.to_string())?;

    app.emit("preferences-changed", &prefs)
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn get_mobile_notifications_enabled(app: AppHandle) -> Result<bool, String> {
    let prefs = get_preferences(app).await?;
    Ok(prefs.enable_mobile_notifications)
}

// Quack Central Bot Preferences
#[tauri::command]
pub async fn save_telegram_link(
    app: AppHandle,
    unique_id: String,
    chat_id: i64,
) -> Result<(), String> {
    let store = app
        .store(PREFERENCES_STORE)
        .map_err(|e| format!("Failed to load preferences store: {}", e))?;

    let mut prefs = store
        .get(PREFERENCES_KEY)
        .and_then(|v| serde_json::from_value::<AppPreferences>(v.clone()).ok())
        .unwrap_or_default();

    prefs.telegram_unique_id = Some(unique_id);
    prefs.telegram_linked_chat_id = Some(chat_id);

    store.set(
        PREFERENCES_KEY.to_string(),
        serde_json::to_value(&prefs).map_err(|e| e.to_string())?,
    );

    store.save().map_err(|e| e.to_string())?;

    app.emit("preferences-changed", &prefs)
        .map_err(|e| e.to_string())?;

    log::info!("🦆 Saved Telegram link: unique_id={}, chat_id={}", prefs.telegram_unique_id.as_ref().unwrap(), chat_id);

    Ok(())
}

#[tauri::command]
pub async fn get_telegram_link(app: AppHandle) -> Result<(Option<String>, Option<i64>), String> {
    let prefs = get_preferences(app).await?;
    Ok((prefs.telegram_unique_id, prefs.telegram_linked_chat_id))
}

/// Initialize Quack Central Bot token (called on first run or setup)
#[tauri::command]
pub async fn initialize_central_bot_token(app: AppHandle) -> Result<(), String> {
    let store = app
        .store(PREFERENCES_STORE)
        .map_err(|e| format!("Failed to load preferences store: {}", e))?;

    let mut prefs = store
        .get(PREFERENCES_KEY)
        .and_then(|v| serde_json::from_value::<AppPreferences>(v.clone()).ok())
        .unwrap_or_default();

    // 🔐 Set the Quack Central Bot token (obfuscated for security)
    // Uses telegram_obfuscation module to reconstruct token at runtime
    let token = crate::telegram_obfuscation::get_telegram_token()
        .map_err(|e| format!("Failed to get Telegram token: {}", e))?;
    prefs.telegram_bot_token = Some(token);

    store.set(
        PREFERENCES_KEY.to_string(),
        serde_json::to_value(&prefs).map_err(|e| e.to_string())?,
    );

    store.save().map_err(|e| e.to_string())?;

    log::info!("🦆 Initialized Quack Central Bot token (@JackTheDuck_bot)");

    Ok(())
}

// Shell preference commands
// Brain: fix-shell-env-gui-launch

#[derive(Debug, Clone, Serialize)]
pub struct ShellInfo {
    pub path: String,
    pub name: String,
}

/// List shells available on the system by reading /etc/shells (macOS/Linux).
#[tauri::command]
pub fn list_available_shells() -> Result<Vec<ShellInfo>, String> {
    let mut shells = Vec::new();

    #[cfg(not(target_os = "windows"))]
    {
        // Read /etc/shells for the system's list of valid login shells
        if let Ok(content) = std::fs::read_to_string("/etc/shells") {
            for line in content.lines() {
                let line = line.trim();
                if line.starts_with('/') {
                    let path = std::path::Path::new(line);
                    if path.exists() {
                        let name = path
                            .file_name()
                            .map(|n| n.to_string_lossy().to_string())
                            .unwrap_or_else(|| line.to_string());
                        shells.push(ShellInfo {
                            path: line.to_string(),
                            name,
                        });
                    }
                }
            }
        }

        // Ensure at least the detected system shell is in the list
        if shells.is_empty() {
            let system_shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
            let name = std::path::Path::new(&system_shell)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| system_shell.clone());
            shells.push(ShellInfo {
                path: system_shell,
                name,
            });
        }
    }

    #[cfg(target_os = "windows")]
    {
        shells.push(ShellInfo {
            path: "pwsh".to_string(),
            name: "PowerShell Core".to_string(),
        });
        shells.push(ShellInfo {
            path: "powershell.exe".to_string(),
            name: "Windows PowerShell".to_string(),
        });
        shells.push(ShellInfo {
            path: "cmd.exe".to_string(),
            name: "Command Prompt".to_string(),
        });
    }

    // Deduplicate by path (retain only first occurrence)
    let mut seen = std::collections::HashSet::new();
    shells.retain(|s| seen.insert(s.path.clone()));

    Ok(shells)
}

/// Get the user's preferred default shell (None = auto-detect).
#[tauri::command]
pub async fn get_default_shell(app: AppHandle) -> Result<Option<String>, String> {
    let prefs = get_preferences(app).await?;
    Ok(prefs.default_shell)
}

/// Set the user's preferred default shell. Pass empty string to reset to auto-detect.
#[tauri::command]
pub async fn set_default_shell(app: AppHandle, shell: String) -> Result<(), String> {
    let store = app
        .store(PREFERENCES_STORE)
        .map_err(|e| format!("Failed to load preferences store: {}", e))?;

    let mut prefs = store
        .get(PREFERENCES_KEY)
        .and_then(|v| serde_json::from_value::<AppPreferences>(v.clone()).ok())
        .unwrap_or_default();

    prefs.default_shell = if shell.is_empty() {
        None
    } else {
        // Validate the shell path exists before saving
        if !std::path::Path::new(&shell).exists() {
            return Err(format!("Shell not found: {}", shell));
        }
        Some(shell)
    };

    store.set(
        PREFERENCES_KEY.to_string(),
        serde_json::to_value(&prefs).map_err(|e| e.to_string())?,
    );

    store.save().map_err(|e| e.to_string())?;

    app.emit("preferences-changed", &prefs)
        .map_err(|e| e.to_string())?;

    Ok(())
}

// Telegram mute notifications toggle

#[tauri::command]
pub async fn get_telegram_mute(app: AppHandle) -> Result<bool, String> {
    let prefs = get_preferences(app).await?;
    Ok(prefs.telegram_mute_notifications)
}

#[tauri::command]
pub async fn set_telegram_mute(
    app: AppHandle,
    muted: bool,
) -> Result<(), String> {
    let store = app
        .store(PREFERENCES_STORE)
        .map_err(|e| format!("Failed to load preferences store: {}", e))?;

    let mut prefs = store
        .get(PREFERENCES_KEY)
        .and_then(|v| serde_json::from_value::<AppPreferences>(v.clone()).ok())
        .unwrap_or_default();

    prefs.telegram_mute_notifications = muted;

    store.set(
        PREFERENCES_KEY.to_string(),
        serde_json::to_value(&prefs).map_err(|e| e.to_string())?,
    );

    store.save().map_err(|e| e.to_string())?;

    app.emit("preferences-changed", &prefs)
        .map_err(|e| e.to_string())?;

    Ok(())
}
