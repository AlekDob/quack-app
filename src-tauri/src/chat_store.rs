//! Disk-backed chat transcript store — no localStorage quota.
//! Layout: ~/Library/Application Support/codetta/chats/{wsId}/{sessionId}.json

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

const MAX_SESSIONS: usize = 30;

#[derive(Serialize, Deserialize, Default, Clone)]
struct SessionIndex {
    #[serde(default)]
    ids: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ProviderLink {
    pub ws_id: String,
    pub quack_session_id: String,
    pub title: String,
}

#[derive(Serialize, Deserialize, Default)]
struct ProviderLinkIndex {
    #[serde(default)]
    links: HashMap<String, ProviderLink>,
}

#[derive(Serialize)]
pub struct ChatWorkspaceSnapshot {
    pub ids: Vec<String>,
    pub sessions: Vec<serde_json::Value>,
}

fn app_data_dir() -> Result<PathBuf, String> {
    let base = dirs::data_dir().ok_or_else(|| "no app data dir".to_string())?;
    let dir = base.join("codetta");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn ws_dir(ws_id: &str) -> Result<PathBuf, String> {
    let dir = app_data_dir()?.join("chats").join(ws_id);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn index_path(ws_id: &str) -> Result<PathBuf, String> {
    Ok(ws_dir(ws_id)?.join("__idx__.json"))
}

fn session_path(ws_id: &str, session_id: &str) -> Result<PathBuf, String> {
    Ok(ws_dir(ws_id)?.join(format!("{}.json", session_id)))
}

fn links_path() -> Result<PathBuf, String> {
    Ok(app_data_dir()?.join("chats").join("provider-links.json"))
}

fn read_index(ws_id: &str) -> Result<SessionIndex, String> {
    let path = index_path(ws_id)?;
    if !path.exists() {
        return Ok(SessionIndex::default());
    }
    let s = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&s).map_err(|e| e.to_string())
}

fn write_index(ws_id: &str, index: &SessionIndex) -> Result<(), String> {
    let path = index_path(ws_id)?;
    let s = serde_json::to_string(index).map_err(|e| e.to_string())?;
    crate::atomic::write(&path, s.as_bytes()).map_err(|e| e.to_string())
}

fn read_links() -> Result<ProviderLinkIndex, String> {
    let path = links_path()?;
    if !path.exists() {
        return Ok(ProviderLinkIndex::default());
    }
    let s = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&s).map_err(|e| e.to_string())
}

fn write_links(index: &ProviderLinkIndex) -> Result<(), String> {
    let path = links_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let s = serde_json::to_string_pretty(index).map_err(|e| e.to_string())?;
    crate::atomic::write(&path, s.as_bytes()).map_err(|e| e.to_string())
}

fn link_key(provider: &str, cli_id: &str) -> String {
    format!("{}:{}", provider, cli_id)
}

fn upsert_provider_links(ws_id: &str, session: &serde_json::Value) {
    let session_id = session
        .get("id")
        .and_then(|x| x.as_str())
        .unwrap_or("");
    if session_id.is_empty() {
        return;
    }
    let title = session
        .get("title")
        .and_then(|x| x.as_str())
        .unwrap_or("Untitled")
        .to_string();
    let ids_obj = session.get("providerSessionIds").and_then(|x| x.as_object());
    let legacy_cc = session
        .get("claudeSessionId")
        .and_then(|x| x.as_str());
    let mut pairs: Vec<(&str, &str)> = Vec::new();
    if let Some(map) = ids_obj {
        for (k, v) in map {
            if let Some(s) = v.as_str() {
                pairs.push((k.as_str(), s));
            }
        }
    }
    if let Some(cc) = legacy_cc {
        if !pairs.iter().any(|(k, _)| *k == "claude-code") {
            pairs.push(("claude-code", cc));
        }
    }
    if pairs.is_empty() {
        return;
    }
    let mut index = read_links().unwrap_or_default();
    for (provider, cli_id) in pairs {
        index.links.insert(
            link_key(provider, cli_id),
            ProviderLink {
                ws_id: ws_id.to_string(),
                quack_session_id: session_id.to_string(),
                title: title.clone(),
            },
        );
    }
    let _ = write_links(&index);
}

fn remove_provider_links_for_session(session: &serde_json::Value) {
    let ids_obj = session.get("providerSessionIds").and_then(|x| x.as_object());
    let legacy_cc = session
        .get("claudeSessionId")
        .and_then(|x| x.as_str());
    let mut keys: Vec<String> = Vec::new();
    if let Some(map) = ids_obj {
        for (k, v) in map {
            if let Some(s) = v.as_str() {
                keys.push(link_key(k, s));
            }
        }
    }
    if let Some(cc) = legacy_cc {
        keys.push(link_key("claude-code", cc));
    }
    if keys.is_empty() {
        return;
    }
    let mut index = read_links().unwrap_or_default();
    for k in keys {
        index.links.remove(&k);
    }
    let _ = write_links(&index);
}

#[tauri::command]
pub fn chat_store_load_workspace(ws_id: String) -> Result<ChatWorkspaceSnapshot, String> {
    // Index only — session bodies load on demand via chat_store_load.
    let index = read_index(&ws_id)?;
    Ok(ChatWorkspaceSnapshot {
        ids: index.ids,
        sessions: Vec::new(),
    })
}

#[tauri::command]
pub fn chat_store_load(
    ws_id: String,
    session_id: String,
) -> Result<Option<serde_json::Value>, String> {
    let path = session_path(&ws_id, &session_id)?;
    if !path.exists() {
        return Ok(None);
    }
    let s = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let v: serde_json::Value = serde_json::from_str(&s).map_err(|e| e.to_string())?;
    Ok(Some(v))
}

#[tauri::command]
pub fn chat_store_save(ws_id: String, session: serde_json::Value) -> Result<(), String> {
    let session_id = session
        .get("id")
        .and_then(|x| x.as_str())
        .ok_or_else(|| "session.id required".to_string())?
        .to_string();
    let path = session_path(&ws_id, &session_id)?;
    let s = serde_json::to_string(&session).map_err(|e| e.to_string())?;
    crate::atomic::write(&path, s.as_bytes()).map_err(|e| e.to_string())?;

    let prev = read_index(&ws_id)?;
    let ids: Vec<String> = std::iter::once(session_id.clone())
        .chain(
            prev.ids
                .iter()
                .filter(|id| **id != session_id)
                .cloned(),
        )
        .take(MAX_SESSIONS)
        .collect();
    let evicted: Vec<String> = prev
        .ids
        .into_iter()
        .filter(|id| !ids.contains(&id))
        .collect();
    for id in evicted {
        let p = session_path(&ws_id, &id)?;
        if p.exists() {
            if let Ok(s) = fs::read_to_string(&p) {
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(&s) {
                    remove_provider_links_for_session(&v);
                }
            }
            let _ = fs::remove_file(p);
        }
    }
    write_index(&ws_id, &SessionIndex { ids })?;
    upsert_provider_links(&ws_id, &session);
    Ok(())
}

#[tauri::command]
pub fn chat_store_delete(ws_id: String, session_id: String) -> Result<(), String> {
    let path = session_path(&ws_id, &session_id)?;
    if path.exists() {
        if let Ok(s) = fs::read_to_string(&path) {
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&s) {
                remove_provider_links_for_session(&v);
            }
        }
        let _ = fs::remove_file(path);
    }
    let prev = read_index(&ws_id)?;
    write_index(
        &ws_id,
        &SessionIndex {
            ids: prev
                .ids
                .into_iter()
                .filter(|id| id != &session_id)
                .collect(),
        },
    )
}

#[tauri::command]
pub fn chat_store_lookup_link(
    provider: String,
    cli_session_id: String,
) -> Result<Option<ProviderLink>, String> {
    let index = read_links()?;
    Ok(index.links.get(&link_key(&provider, &cli_session_id)).cloned())
}

#[tauri::command]
pub fn chat_store_all_links() -> Result<Vec<ProviderLink>, String> {
    let index = read_links()?;
    Ok(index.links.into_values().collect())
}
