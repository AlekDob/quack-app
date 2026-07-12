//! Workspace-scoped Works store — `.codetta/works/snapshot.json` + `events.jsonl`.

use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};

fn works_dir(ws_root: &str) -> Result<PathBuf, String> {
    let root = PathBuf::from(ws_root);
    if !root.is_absolute() {
        return Err("workspace root must be absolute".into());
    }
    let dir = root.join(".codetta").join("works");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn snapshot_path(ws_root: &str) -> Result<PathBuf, String> {
    Ok(works_dir(ws_root)?.join("snapshot.json"))
}

fn events_path(ws_root: &str) -> Result<PathBuf, String> {
    Ok(works_dir(ws_root)?.join("events.jsonl"))
}

fn default_snapshot() -> serde_json::Value {
    serde_json::json!({
        "version": 1,
        "labels": [{ "id": "hotfix", "name": "hotfix", "color": "semantic-warning" }],
        "modules": [],
        "cycles": [],
        "items": [],
        "viewPrefs": { "layout": "list", "groupBy": "status" },
        "nextSeq": 1
    })
}

#[tauri::command]
pub fn works_load(ws_root: String) -> Result<serde_json::Value, String> {
    let path = snapshot_path(&ws_root)?;
    if !path.exists() {
        return Ok(default_snapshot());
    }
    let s = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&s).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn works_save(ws_root: String, snapshot: serde_json::Value) -> Result<(), String> {
    let path = snapshot_path(&ws_root)?;
    let s = serde_json::to_string_pretty(&snapshot).map_err(|e| e.to_string())?;
    crate::atomic::write(&path, s.as_bytes()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn works_append_event(ws_root: String, event: serde_json::Value) -> Result<(), String> {
    let path = events_path(&ws_root)?;
    let line = serde_json::to_string(&event).map_err(|e| e.to_string())?;
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| e.to_string())?;
    writeln!(file, "{line}").map_err(|e| e.to_string())?;
    Ok(())
}

#[allow(dead_code)]
fn is_under_root(root: &Path, target: &Path) -> bool {
    root.canonicalize()
        .ok()
        .zip(target.canonicalize().ok())
        .map(|(r, t)| t.starts_with(r))
        .unwrap_or(false)
}
