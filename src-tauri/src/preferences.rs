use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tauri_plugin_store::StoreExt;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppPreferences {
    pub show_performance_monitor: bool,
    #[serde(default)]
    pub openai_api_key: Option<String>,
    #[serde(default = "default_ai_model")]
    pub ai_model: String,
}

fn default_ai_model() -> String {
    "gpt-4o-mini".to_string()
}

impl Default for AppPreferences {
    fn default() -> Self {
        Self {
            show_performance_monitor: false,
            openai_api_key: None,
            ai_model: default_ai_model(),
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
