//! Unified on-disk session discovery for agent CLIs (Claude Code, Cursor, OpenCode).
//! Quack links these ids to ChatSession rows via `providerSessionIds`.

use crate::provider_path::encode_project_path;
use crate::session_jsonl::{extract_user_text, parse_session_jsonl, trim_oneline, LoadedMessage};
use std::fs;
use std::io::BufRead;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

#[derive(serde::Serialize, Clone)]
pub struct CliSessionSummary {
    pub provider: String,
    pub id: String,
    pub title: String,
    pub preview: String,
    pub cost_usd: f64,
    pub turn_count: usize,
    pub last_turn_at_ms: u64,
}

#[tauri::command]
pub fn provider_list_sessions(
    provider: String,
    cwd: String,
) -> Result<Vec<CliSessionSummary>, String> {
    match provider.as_str() {
        "claude-code" => list_claude_sessions(&cwd),
        "cursor-cli" => list_cursor_sessions(&cwd),
        "opencode-cli" => list_opencode_sessions(&cwd),
        other => Err(format!("unknown provider: {}", other)),
    }
}

#[tauri::command]
pub fn provider_load_session(
    provider: String,
    cwd: String,
    session_id: String,
) -> Result<Vec<LoadedMessage>, String> {
    match provider.as_str() {
        "claude-code" => load_claude_session(&cwd, &session_id),
        "cursor-cli" => load_cursor_session(&cwd, &session_id),
        "opencode-cli" => Err(
            "OpenCode transcript load not yet supported — resume via chat works".into(),
        ),
        other => Err(format!("unknown provider: {}", other)),
    }
}

fn home() -> Result<PathBuf, String> {
    dirs::home_dir().ok_or_else(|| "no home dir".to_string())
}

fn mtime_ms(path: &Path) -> u64 {
    fs::metadata(path)
        .ok()
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn summarize_jsonl(path: &Path, provider: &str, id: String) -> Option<CliSessionSummary> {
    let file = fs::File::open(path).ok()?;
    let reader = std::io::BufReader::new(file);
    let mut first_user: Option<String> = None;
    let mut last_user: Option<String> = None;
    let mut cost_usd: f64 = 0.0;
    let mut turn_count: usize = 0;
    let mut buf = String::with_capacity(4 * 1024);
    let mut r = reader;
    loop {
        buf.clear();
        match BufRead::read_line(&mut r, &mut buf) {
            Ok(0) => break,
            Ok(_) => {
                let line = buf.trim();
                if line.is_empty() {
                    continue;
                }
                let v: serde_json::Value = match serde_json::from_str(line) {
                    Ok(v) => v,
                    Err(_) => continue,
                };
                let ty = v.get("type").and_then(|x| x.as_str()).unwrap_or("");
                if ty == "user" {
                    if let Some(t) = extract_user_text(&v) {
                        turn_count += 1;
                        if first_user.is_none() {
                            first_user = Some(t.clone());
                        }
                        last_user = Some(t);
                    }
                } else if ty == "result" {
                    if let Some(c) = v.get("cost_usd").and_then(|x| x.as_f64()) {
                        cost_usd += c;
                    }
                }
            }
            Err(_) => break,
        }
    }
    let title = trim_oneline(first_user.as_deref().unwrap_or("Untitled"), 80);
    let preview = trim_oneline(last_user.as_deref().unwrap_or(&title), 140);
    Some(CliSessionSummary {
        provider: provider.to_string(),
        id,
        title,
        preview,
        cost_usd,
        turn_count,
        last_turn_at_ms: mtime_ms(path),
    })
}

fn list_claude_sessions(cwd: &str) -> Result<Vec<CliSessionSummary>, String> {
    let dir = home()?
        .join(".claude")
        .join("projects")
        .join(encode_project_path(cwd));
    list_jsonl_dir(&dir, "claude-code", false)
}

fn list_cursor_sessions(cwd: &str) -> Result<Vec<CliSessionSummary>, String> {
    let base = home()?
        .join(".cursor")
        .join("projects")
        .join(encode_project_path(cwd))
        .join("agent-transcripts");
    list_jsonl_dir(&base, "cursor-cli", true)
}

fn list_jsonl_dir(
    dir: &Path,
    provider: &str,
    nested: bool,
) -> Result<Vec<CliSessionSummary>, String> {
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut sessions = Vec::new();
    if nested {
        for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
            let entry = match entry {
                Ok(e) => e,
                Err(_) => continue,
            };
            if !entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                continue;
            }
            let id = entry.file_name().to_string_lossy().to_string();
            let jsonl = entry.path().join(format!("{}.jsonl", id));
            if jsonl.exists() {
                if let Some(s) = summarize_jsonl(&jsonl, provider, id) {
                    sessions.push(s);
                }
            }
        }
    } else {
        for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
            let entry = match entry {
                Ok(e) => e,
                Err(_) => continue,
            };
            let path = entry.path();
            if path.extension().and_then(|x| x.to_str()) != Some("jsonl") {
                continue;
            }
            let id = path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_string();
            if id.is_empty() {
                continue;
            }
            if let Some(s) = summarize_jsonl(&path, provider, id) {
                sessions.push(s);
            }
        }
    }
    sessions.sort_by(|a, b| b.last_turn_at_ms.cmp(&a.last_turn_at_ms));
    Ok(sessions)
}

fn load_claude_session(cwd: &str, session_id: &str) -> Result<Vec<LoadedMessage>, String> {
    let path = home()?
        .join(".claude")
        .join("projects")
        .join(encode_project_path(cwd))
        .join(format!("{}.jsonl", session_id));
    if !path.exists() {
        return Err(format!("session {} not found at {:?}", session_id, path));
    }
    parse_session_jsonl(&path)
}

fn load_cursor_session(cwd: &str, session_id: &str) -> Result<Vec<LoadedMessage>, String> {
    let path = home()?
        .join(".cursor")
        .join("projects")
        .join(encode_project_path(cwd))
        .join("agent-transcripts")
        .join(session_id)
        .join(format!("{}.jsonl", session_id));
    if !path.exists() {
        return Err(format!("session {} not found at {:?}", session_id, path));
    }
    parse_session_jsonl(&path)
}

fn list_opencode_sessions(cwd: &str) -> Result<Vec<CliSessionSummary>, String> {
    let storage = home()?
        .join(".local")
        .join("share")
        .join("opencode")
        .join("storage")
        .join("session");
    if !storage.exists() {
        return Ok(Vec::new());
    }
    let mut sessions = Vec::new();
    let cwd_norm = normalize_cwd(cwd);
    for hash_entry in fs::read_dir(&storage).map_err(|e| e.to_string())? {
        let hash_dir = match hash_entry {
            Ok(e) => e.path(),
            Err(_) => continue,
        };
        if !hash_dir.is_dir() {
            continue;
        }
        let entries = match fs::read_dir(&hash_dir) {
            Ok(e) => e,
            Err(_) => continue,
        };
        for entry in entries {
            let entry = match entry {
                Ok(e) => e,
                Err(_) => continue,
            };
            if let Some(s) = parse_opencode_session_file(&entry.path(), &cwd_norm) {
                sessions.push(s);
            }
        }
    }
    sessions.sort_by(|a, b| b.last_turn_at_ms.cmp(&a.last_turn_at_ms));
    Ok(sessions)
}

fn parse_opencode_session_file(path: &Path, cwd_norm: &str) -> Option<CliSessionSummary> {
    if path.extension().and_then(|x| x.to_str()) != Some("json") {
        return None;
    }
    let name = path.file_stem().and_then(|s| s.to_str()).unwrap_or("");
    if !name.starts_with("ses_") {
        return None;
    }
    let raw = fs::read_to_string(path).ok()?;
    let v: serde_json::Value = serde_json::from_str(&raw).ok()?;
    let dir_field = v
        .get("directory")
        .or_else(|| v.get("cwd"))
        .and_then(|x| x.as_str())
        .unwrap_or("");
    if !dir_field.is_empty() && normalize_cwd(dir_field) != cwd_norm {
        return None;
    }
    let id = v
        .get("id")
        .and_then(|x| x.as_str())
        .unwrap_or(name)
        .to_string();
    let title = v
        .get("title")
        .and_then(|x| x.as_str())
        .map(|s| trim_oneline(s, 80))
        .unwrap_or_else(|| "OpenCode session".to_string());
    let updated = v
        .get("time")
        .and_then(|t| t.get("updated"))
        .and_then(|x| x.as_u64())
        .or_else(|| v.get("updated_at").and_then(|x| x.as_u64()))
        .unwrap_or_else(|| mtime_ms(path));
    let turn_count = v
        .get("message_count")
        .and_then(|x| x.as_u64())
        .unwrap_or(0) as usize;
    Some(CliSessionSummary {
        provider: "opencode-cli".into(),
        id,
        title,
        preview: String::new(),
        cost_usd: v.get("cost").and_then(|x| x.as_f64()).unwrap_or(0.0),
        turn_count,
        last_turn_at_ms: updated,
    })
}

fn normalize_cwd(cwd: &str) -> String {
    let p = Path::new(cwd);
    fs::canonicalize(p)
        .map(|x| x.to_string_lossy().to_string())
        .unwrap_or_else(|_| cwd.to_string())
}
