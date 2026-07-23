use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Clone)]
pub struct WorkspaceMeta {
    pub id: String,
    pub name: String,
    pub root: String,
    #[serde(default)]
    pub last_opened: i64,
}

#[derive(Serialize, Deserialize, Default, Clone)]
pub struct WorkspacesIndex {
    #[serde(default)]
    pub recent: Vec<WorkspaceMeta>,
    #[serde(default)]
    pub active_id: Option<String>,
    #[serde(default)]
    pub open_ids: Vec<String>,
}

fn app_data_dir() -> Result<PathBuf, String> {
    let base = dirs::data_dir().ok_or_else(|| "no app data dir".to_string())?;
    let dir = base.join("codetta");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn workspaces_file() -> Result<PathBuf, String> {
    Ok(app_data_dir()?.join("workspaces.json"))
}

fn workspace_state_file(id: &str) -> Result<PathBuf, String> {
    let dir = app_data_dir()?.join("workspaces").join(id);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("state.json"))
}

// Per-project colors live on disk (not localStorage) so a full/blocked
// localStorage quota can never break color persistence. One global map
// keyed by normalized workspace root, mirroring the frontend key.
fn workspace_colors_file() -> Result<PathBuf, String> {
    Ok(app_data_dir()?.join("colors.json"))
}

#[tauri::command]
pub fn workspaces_load() -> Result<WorkspacesIndex, String> {
    let path = workspaces_file()?;
    if !path.exists() {
        return Ok(WorkspacesIndex::default());
    }
    let s = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&s).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn workspaces_save(index: WorkspacesIndex) -> Result<(), String> {
    let path = workspaces_file()?;
    let s = serde_json::to_string_pretty(&index).map_err(|e| e.to_string())?;
    crate::atomic::write(&path, s.as_bytes()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn workspace_state_load(id: String) -> Result<serde_json::Value, String> {
    let path = workspace_state_file(&id)?;
    if !path.exists() {
        return Ok(serde_json::Value::Null);
    }
    let s = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&s).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn workspace_state_save(id: String, state: serde_json::Value) -> Result<(), String> {
    let path = workspace_state_file(&id)?;
    let s = serde_json::to_string_pretty(&state).map_err(|e| e.to_string())?;
    crate::atomic::write(&path, s.as_bytes()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn workspace_colors_load() -> Result<serde_json::Value, String> {
    let path = workspace_colors_file()?;
    if !path.exists() {
        return Ok(serde_json::json!({}));
    }
    let s = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&s).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn workspace_colors_save(map: serde_json::Value) -> Result<(), String> {
    let path = workspace_colors_file()?;
    let s = serde_json::to_string_pretty(&map).map_err(|e| e.to_string())?;
    crate::atomic::write(&path, s.as_bytes()).map_err(|e| e.to_string())
}
