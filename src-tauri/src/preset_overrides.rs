//! Disk-backed built-in preset overrides — avoids localStorage quota when
//! editing Jack / Milo / Nora / Vera / Lia from the Team drawer.

use serde_json::Value;
use std::path::PathBuf;

fn app_data_dir() -> Result<PathBuf, String> {
    let base = dirs::data_dir().ok_or_else(|| "no app data dir".to_string())?;
    let dir = base.join("codetta");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn overrides_path() -> Result<PathBuf, String> {
    Ok(app_data_dir()?.join("preset-overrides.json"))
}

#[tauri::command]
pub fn preset_overrides_load() -> Result<Value, String> {
    let path = overrides_path()?;
    if !path.exists() {
        return Ok(serde_json::json!({}));
    }
    let s = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&s).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn preset_overrides_save(data: Value) -> Result<(), String> {
    let path = overrides_path()?;
    let s = serde_json::to_string_pretty(&data).map_err(|e| e.to_string())?;
    crate::atomic::write(&path, s.as_bytes()).map_err(|e| e.to_string())
}
