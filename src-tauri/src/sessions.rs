use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::RwLock;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::command;
use rayon::prelude::*;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SessionInfo {
    pub id: String,
    pub title: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub message_count: i32,
    pub total_tokens: i32,
    pub total_cost: f64,
    pub status: String,
    pub working_directory: Option<String>,
    pub model: Option<String>,
    pub agent_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SessionHistoryMessage {
    pub role: String,
    pub content: String,
    pub timestamp: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UsageStats {
    pub input_tokens: i32,
    pub output_tokens: i32,
    pub cache_creation_input_tokens: i32,
    pub cache_read_input_tokens: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SessionDetails {
    pub id: String,
    pub title: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub message_count: i32,
    pub total_tokens: i32,
    pub total_cost: f64,
    pub status: String,
    pub working_directory: Option<String>,
    pub model: Option<String>,
    pub agent_name: Option<String>,
    pub messages: Vec<SessionHistoryMessage>,
    pub usage: UsageStats,
}

// Session file metadata for fast sorting
#[derive(Debug)]
struct SessionFileInfo {
    pub id: String,
    pub path: PathBuf,
    pub modified: SystemTime,
}

// In-memory cache for session metadata
lazy_static::lazy_static! {
    static ref SESSION_CACHE: RwLock<HashMap<String, (SessionInfo, SystemTime)>> =
        RwLock::new(HashMap::new());
}

const CACHE_TTL_SECS: u64 = 60; // Cache for 1 minute

/// Safe truncate for UTF-8 strings at character boundary
fn safe_truncate(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        return s.to_string();
    }

    // Find the last valid character boundary at or before max_len
    let mut truncate_at = max_len;
    while truncate_at > 0 && !s.is_char_boundary(truncate_at) {
        truncate_at -= 1;
    }

    s[..truncate_at].to_string()
}

/// Get all projects directories in ~/.claude/projects/
fn get_projects_dirs() -> Result<Vec<PathBuf>, String> {
    let home = dirs::home_dir().ok_or("Failed to get home directory")?;
    let projects_dir = home.join(".claude").join("projects");

    if !projects_dir.exists() {
        return Ok(Vec::new());
    }

    let mut project_dirs = Vec::new();

    for entry in fs::read_dir(&projects_dir)
        .map_err(|e| format!("Failed to read projects directory: {}", e))?
    {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();

        if path.is_dir() {
            project_dirs.push(path);
        }
    }

    Ok(project_dirs)
}

/// Get all session files with metadata for sorting
fn get_all_session_files() -> Result<Vec<SessionFileInfo>, String> {
    let project_dirs = get_projects_dirs()?;

    // Collect all session files in parallel
    let session_files: Vec<SessionFileInfo> = project_dirs
        .par_iter()
        .flat_map(|project_dir| {
            fs::read_dir(project_dir)
                .ok()
                .map(|entries| {
                    entries
                        .filter_map(|entry| {
                            entry.ok().and_then(|e| {
                                let path = e.path();

                                // Only include .jsonl files
                                if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("jsonl") {
                                    let file_stem = path.file_stem().and_then(|s| s.to_str())?;
                                    let metadata = fs::metadata(&path).ok()?;

                                    Some(SessionFileInfo {
                                        id: file_stem.to_string(),
                                        path: path.clone(),
                                        modified: metadata.modified().ok()?,
                                    })
                                } else {
                                    None
                                }
                            })
                        })
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default()
        })
        .collect();

    Ok(session_files)
}

/// List all session IDs, sorted by most recently updated
#[command]
pub fn list_sessions() -> Result<Vec<String>, String> {
    let mut session_files = get_all_session_files()?;

    // Sort by modified time (most recent first)
    session_files.sort_by(|a, b| b.modified.cmp(&a.modified));

    // Return just the IDs
    Ok(session_files.into_iter().map(|sf| sf.id).collect())
}

/// Find the session file path by session ID
fn find_session_file(session_id: &str) -> Result<PathBuf, String> {
    let project_dirs = get_projects_dirs()?;

    for project_dir in project_dirs {
        let session_file = project_dir.join(format!("{}.jsonl", session_id));
        if session_file.exists() {
            return Ok(session_file);
        }
    }

    Err(format!("Session {} not found in any project", session_id))
}

/// Fast metadata extraction - only reads first and last lines
fn extract_session_metadata_fast(session_file: &PathBuf) -> Result<SessionInfo, String> {
    let content = fs::read_to_string(session_file)
        .map_err(|e| format!("Failed to read session file: {}", e))?;

    let lines: Vec<&str> = content.lines().filter(|l| !l.trim().is_empty()).collect();

    if lines.is_empty() {
        return Err("Empty session file".to_string());
    }

    // 🦆 SIDECHAIN FILTER: Skip sessions that are Claude SDK sidechains (warmup sessions)
    // These are automatically created by Claude Code SDK for prefetching and have "isSidechain": true
    if let Ok(first_event) = serde_json::from_str::<Value>(lines[0]) {
        if first_event["isSidechain"].as_bool() == Some(true) {
            return Err("Sidechain session (SDK warmup) - skipped".to_string());
        }
    }

    let mut title = String::from("Untitled Session");
    let mut created_at = 0i64;
    let mut updated_at = 0i64;
    let mut message_count = 0;
    let mut total_tokens = 0;
    let mut total_cost = 0.0;
    let status = "completed".to_string();
    let mut working_directory: Option<String> = None;
    let mut model: Option<String> = None;

    // Parse first line for created_at and initial metadata
    if let Ok(first_event) = serde_json::from_str::<Value>(lines[0]) {
        if let Some(timestamp_str) = first_event["timestamp"].as_str() {
            if let Ok(parsed) = chrono::DateTime::parse_from_rfc3339(timestamp_str) {
                created_at = parsed.timestamp_millis();
                log::debug!("Parsed created_at timestamp: {} -> {}", timestamp_str, created_at);
            } else {
                log::warn!("Failed to parse timestamp: {}", timestamp_str);
            }
        }
        if let Some(cwd) = first_event["cwd"].as_str() {
            working_directory = Some(cwd.to_string());
        }
    }

    // If no working_directory found in JSONL, use the project directory path
    if working_directory.is_none() {
        if let Some(parent) = session_file.parent() {
            if let Some(project_name) = parent.file_name() {
                if let Some(project_name_str) = project_name.to_str() {
                    working_directory = Some(parent.to_string_lossy().to_string());
                    log::debug!("Using project directory as working_directory: {}", project_name_str);
                }
            }
        }
    }

    // Parse last few lines for updated_at and accumulated stats
    let last_lines_start = lines.len().saturating_sub(20); // Check last 20 lines for efficiency
    for i in last_lines_start..lines.len() {
        if let Ok(event) = serde_json::from_str::<Value>(lines[i]) {
            // Update timestamp
            if let Some(timestamp_str) = event["timestamp"].as_str() {
                if let Ok(parsed) = chrono::DateTime::parse_from_rfc3339(timestamp_str) {
                    updated_at = parsed.timestamp_millis();
                }
            }

            // Check for result event with totals
            if event["type"] == "result" {
                if let Some(usage) = event["usage"].as_object() {
                    if let Some(input) = usage["input_tokens"].as_i64() {
                        total_tokens = (total_tokens as i64 + input) as i32;
                    }
                    if let Some(output) = usage["output_tokens"].as_i64() {
                        total_tokens = (total_tokens as i64 + output) as i32;
                    }
                }
                if let Some(cost) = event["total_cost_usd"].as_f64() {
                    total_cost = cost;
                } else if let Some(cost) = event["cost_usd"].as_f64() {
                    total_cost += cost;
                }
            }

            // Extract model
            if event["type"] == "assistant" && model.is_none() {
                if let Some(m) = event["model"].as_str() {
                    model = Some(m.to_string());
                }
            }
        }
    }

    // Quick scan for title and message count (sample middle section)
    let sample_size = lines.len().min(100);
    let mut found_title = false;

    for i in 0..sample_size {
        if let Ok(event) = serde_json::from_str::<Value>(lines[i]) {
            // Count non-meta messages
            if (event["type"] == "user" || event["type"] == "assistant")
                && !event["isMeta"].as_bool().unwrap_or(false) {
                message_count += 1;
            }

            // Get first user message as title
            if !found_title && event["type"] == "user" && !event["isMeta"].as_bool().unwrap_or(false) {
                if let Some(message) = event["message"].as_object() {
                    // Content can be either string or array
                    let content_text = if let Some(content_str) = message["content"].as_str() {
                        Some(content_str.to_string())
                    } else if let Some(content_array) = message["content"].as_array() {
                        // Extract text from array of content blocks
                        let mut text = String::new();
                        for block in content_array {
                            if block["type"] == "text" {
                                if let Some(t) = block["text"].as_str() {
                                    text.push_str(t);
                                }
                            }
                        }
                        if !text.is_empty() {
                            Some(text)
                        } else {
                            None
                        }
                    } else {
                        None
                    };

                    if let Some(content) = content_text {
                        if !content.contains("<command-name>") && !content.contains("<local-command") && !content.is_empty() {
                            let trimmed = content.trim();
                            if trimmed.len() > 60 {
                                title = format!("{}...", safe_truncate(trimmed, 57));
                            } else {
                                title = trimmed.to_string();
                            }
                            found_title = true;
                        }
                    }
                }
            }
        }
    }

    // If we couldn't get updated_at, use file modified time
    if updated_at == 0 {
        if let Ok(metadata) = fs::metadata(session_file) {
            if let Ok(modified) = metadata.modified() {
                if let Ok(duration) = modified.duration_since(UNIX_EPOCH) {
                    updated_at = duration.as_millis() as i64;
                    log::debug!("Using file modified time for updated_at: {}", updated_at);
                }
            }
        }
    }

    // If we couldn't get created_at, use updated_at or file created time
    if created_at == 0 {
        if updated_at > 0 {
            created_at = updated_at;
        } else {
            // Last resort: use file metadata
            if let Ok(metadata) = fs::metadata(session_file) {
                if let Ok(created) = metadata.created() {
                    if let Ok(duration) = created.duration_since(UNIX_EPOCH) {
                        created_at = duration.as_millis() as i64;
                        updated_at = created_at; // Also set updated_at
                        log::debug!("Using file created time as fallback: {}", created_at);
                    }
                }
            }
        }
    }

    let session_id = session_file
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("unknown")
        .to_string();

    Ok(SessionInfo {
        id: session_id,
        title,
        created_at,
        updated_at,
        message_count,
        total_tokens,
        total_cost,
        status,
        working_directory,
        model,
        agent_name: None,
    })
}

/// Get session info with caching
#[command]
pub fn get_session_info(session_id: String) -> Result<SessionInfo, String> {
    // Check cache first
    {
        let cache = SESSION_CACHE.read().map_err(|e| format!("Cache lock error: {}", e))?;
        if let Some((cached_info, cached_time)) = cache.get(&session_id) {
            if let Ok(elapsed) = SystemTime::now().duration_since(*cached_time) {
                if elapsed.as_secs() < CACHE_TTL_SECS {
                    return Ok(cached_info.clone());
                }
            }
        }
    }

    // Not in cache or expired, fetch fresh
    let session_file = find_session_file(&session_id)?;
    let session_info = extract_session_metadata_fast(&session_file)?;

    // Update cache
    {
        let mut cache = SESSION_CACHE.write().map_err(|e| format!("Cache lock error: {}", e))?;
        cache.insert(session_id.clone(), (session_info.clone(), SystemTime::now()));

        // Clean old entries if cache is too large
        if cache.len() > 500 {
            let now = SystemTime::now();
            cache.retain(|_, (_, time)| {
                if let Ok(elapsed) = now.duration_since(*time) {
                    elapsed.as_secs() < CACHE_TTL_SECS
                } else {
                    false
                }
            });
        }
    }

    Ok(session_info)
}

/// Get sessions with full info, sorted by updated_at
#[command]
pub fn get_all_sessions_info() -> Result<Vec<SessionInfo>, String> {
    let session_files = get_all_session_files()?;

    // Process files in parallel for speed
    let mut sessions: Vec<SessionInfo> = session_files
        .par_iter()
        .filter_map(|sf| {
            extract_session_metadata_fast(&sf.path)
                .map_err(|e| log::error!("Failed to parse session {}: {}", sf.id, e))
                .ok()
        })
        .collect();

    // Sort by updated_at (most recent first)
    sessions.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));

    Ok(sessions)
}

/// Get full session details including messages
#[command]
pub fn get_session_details(session_id: String) -> Result<SessionDetails, String> {
    let session_file = find_session_file(&session_id)?;

    let content = fs::read_to_string(&session_file)
        .map_err(|e| format!("Failed to read session file: {}", e))?;

    // Parse metadata
    let (
        title,
        created_at,
        updated_at,
        message_count,
        total_tokens,
        total_cost,
        status,
        working_directory,
        model,
    ) = parse_session_metadata_with_path(&content, &session_file)?;

    // Parse messages
    let (messages, usage) = parse_session_messages(&content)?;

    Ok(SessionDetails {
        id: session_id,
        title,
        created_at,
        updated_at,
        message_count,
        total_tokens,
        total_cost,
        status,
        working_directory,
        model,
        agent_name: None,
        messages,
        usage,
    })
}

/// Delete a session file
#[command]
pub fn delete_session(session_id: String) -> Result<(), String> {
    let session_file = find_session_file(&session_id)?;

    // Log the file path for debugging
    log::info!("Attempting to delete session file: {:?}", session_file);

    // Check if file exists
    if !session_file.exists() {
        return Err(format!("Session file not found: {:?}", session_file));
    }

    // Check if file is writable
    if let Ok(metadata) = fs::metadata(&session_file) {
        if metadata.permissions().readonly() {
            return Err("Session file is read-only, cannot delete".to_string());
        }
    }

    // Attempt to delete the file
    match fs::remove_file(&session_file) {
        Ok(_) => {
            log::info!("Successfully deleted session file: {:?}", session_file);

            // Remove from cache
            {
                let mut cache = SESSION_CACHE.write()
                    .map_err(|e| format!("Cache lock error: {}", e))?;
                cache.remove(&session_id);
            }

            Ok(())
        }
        Err(e) => {
            let error_msg = match e.kind() {
                std::io::ErrorKind::PermissionDenied => {
                    "Permission denied. The file may be open in another application.".to_string()
                }
                std::io::ErrorKind::NotFound => {
                    "File not found. It may have already been deleted.".to_string()
                }
                _ => {
                    format!("Failed to delete file: {}. Error kind: {:?}", e, e.kind())
                }
            };

            log::error!("Delete failed for {:?}: {}", session_file, error_msg);
            Err(error_msg)
        }
    }
}

/// Reset agent session - deletes session file AND clears agent's session state
/// This is used when user clicks "Reset Agent" to start completely fresh
#[command]
pub fn reset_agent_session(
    agent_id: String,
    session_id: String,
    session_state: tauri::State<crate::SessionState>,
) -> Result<(), String> {
    log::info!("Resetting agent session: agent_id={}, session_id={}", agent_id, session_id);

    // 1. Delete the session file (if it exists)
    if let Err(e) = delete_session(session_id.clone()) {
        log::warn!("Failed to delete session file for {}: {}", session_id, e);
        // Continue even if delete fails - we still want to clear the state
    }

    // 2. Clear session state mapping for this agent
    session_state.remove_session(&agent_id);
    log::info!("Cleared session state for agent: {}", agent_id);

    Ok(())
}

/// Parse session metadata from jsonl content (full scan for details view)
fn parse_session_metadata_with_path(
    content: &str,
    session_file: &PathBuf,
) -> Result<
    (
        String,
        i64,
        i64,
        i32,
        i32,
        f64,
        String,
        Option<String>,
        Option<String>,
    ),
    String,
> {
    let lines: Vec<&str> = content.lines().collect();

    if lines.is_empty() {
        return Err("Empty session file".to_string());
    }

    let mut title = String::from("Untitled Session");
    let mut created_at = 0i64;
    let mut updated_at = 0i64;
    let mut message_count = 0;
    let mut total_tokens = 0;
    let mut total_cost = 0.0;
    let status = "completed".to_string();
    let mut working_directory: Option<String> = None;
    let mut model: Option<String> = None;
    let mut first_user_message = true;

    for line in lines {
        if line.trim().is_empty() {
            continue;
        }

        let event: Value = match serde_json::from_str(line) {
            Ok(v) => v,
            Err(e) => {
                log::warn!("Skipping malformed JSON line: {}", e);
                continue;
            }
        };

        // Extract timestamps
        if let Some(timestamp_str) = event["timestamp"].as_str() {
            if let Ok(parsed) = chrono::DateTime::parse_from_rfc3339(timestamp_str) {
                let ts = parsed.timestamp_millis();
                if created_at == 0 {
                    created_at = ts;
                }
                updated_at = ts;
            }
        }

        // Extract cwd
        if working_directory.is_none() {
            if let Some(cwd) = event["cwd"].as_str() {
                working_directory = Some(cwd.to_string());
            }
        }

        // Extract model from assistant events
        if event["type"] == "assistant" && model.is_none() {
            if let Some(m) = event["model"].as_str() {
                model = Some(m.to_string());
            }
        }

        // Extract first user message as title
        if event["type"] == "user" && first_user_message {
            let is_meta = event["isMeta"].as_bool().unwrap_or(false);

            if !is_meta {
                if let Some(message) = event["message"].as_object() {
                    // Content can be either string or array
                    let content_text = if let Some(content_str) = message["content"].as_str() {
                        Some(content_str.to_string())
                    } else if let Some(content_array) = message["content"].as_array() {
                        // Extract text from array of content blocks
                        let mut text = String::new();
                        for block in content_array {
                            if block["type"] == "text" {
                                if let Some(t) = block["text"].as_str() {
                                    text.push_str(t);
                                }
                            }
                        }
                        if !text.is_empty() {
                            Some(text)
                        } else {
                            None
                        }
                    } else {
                        None
                    };

                    if let Some(content) = content_text {
                        let is_command = content.contains("<command-name>") || content.contains("<local-command");

                        if !is_command && !content.is_empty() {
                            let trimmed = content.trim();
                            if trimmed.len() > 60 {
                                title = format!("{}...", safe_truncate(trimmed, 57));
                            } else {
                                title = trimmed.to_string();
                            }
                            first_user_message = false;
                        }
                    }
                }
            }
        }

        // Count messages (user and assistant, excluding meta)
        if (event["type"] == "user" || event["type"] == "assistant") && !event["isMeta"].as_bool().unwrap_or(false) {
            message_count += 1;
        }

        // Accumulate token usage from result events
        if event["type"] == "result" {
            if let Some(usage) = event["usage"].as_object() {
                if let Some(input) = usage["input_tokens"].as_i64() {
                    total_tokens += input as i32;
                }
                if let Some(output) = usage["output_tokens"].as_i64() {
                    total_tokens += output as i32;
                }
            }

            if let Some(cost) = event["cost_usd"].as_f64() {
                total_cost += cost;
            } else if let Some(cost) = event["total_cost_usd"].as_f64() {
                total_cost = cost;
            }
        }
    }

    // If no working_directory found in JSONL, use the project directory path
    if working_directory.is_none() {
        if let Some(parent) = session_file.parent() {
            if let Some(project_name) = parent.file_name() {
                if let Some(project_name_str) = project_name.to_str() {
                    working_directory = Some(parent.to_string_lossy().to_string());
                    log::debug!("Using project directory as working_directory: {}", project_name_str);
                }
            }
        }
    }

    Ok((
        title,
        created_at,
        updated_at,
        message_count,
        total_tokens,
        total_cost,
        status,
        working_directory,
        model,
    ))
}

/// Create a compact summary of a tool use for mobile display
fn summarize_tool_use(name: &str, input: &Value) -> String {
    let detail = match name {
        "Read" | "read" => input["file_path"].as_str()
            .map(|p| short_path(p))
            .unwrap_or_default(),
        "Write" | "write" => input["file_path"].as_str()
            .map(|p| short_path(p))
            .unwrap_or_default(),
        "Edit" | "edit" => input["file_path"].as_str()
            .map(|p| short_path(p))
            .unwrap_or_default(),
        "Bash" | "bash" => input["command"].as_str()
            .map(|c| {
                let trimmed = c.trim();
                if trimmed.len() > 60 {
                    let end = trimmed.char_indices()
                        .map(|(i, _)| i)
                        .take_while(|&i| i <= 57)
                        .last()
                        .unwrap_or(0);
                    format!("{}...", &trimmed[..end])
                } else {
                    trimmed.to_string()
                }
            })
            .unwrap_or_default(),
        "Glob" | "glob" => input["pattern"].as_str()
            .unwrap_or("")
            .to_string(),
        "Grep" | "grep" => input["pattern"].as_str()
            .unwrap_or("")
            .to_string(),
        // Brain: WS01 SDK 0.3.150 — Task tools (TaskCreate/Update/Get/List)
        // replaced TodoWrite in headless mode (deprecated 0.2.136, switched 0.3.142).
        // All produce empty session-title details to avoid noisy titles.
        "TodoWrite" | "TodoRead" | "TaskCreate" | "TaskUpdate" | "TaskGet" | "TaskList" => String::new(),
        // Brain: gotcha-agent-tool-name-task-agent-migration
        // agent-sdk 0.2.x emits "Task" as tool name; next minor release will migrate to "Agent".
        // Matching both keeps us forward-compatible across the rename.
        "Task" | "Agent" => input["description"].as_str()
            .unwrap_or("")
            .to_string(),
        _ => {
            // MCP tools: mcp__server__tool → "server tool"
            if name.starts_with("mcp__") {
                let parts: Vec<&str> = name.split("__").skip(1).collect();
                parts.join(" ")
            } else {
                String::new()
            }
        }
    };

    if detail.is_empty() {
        name.to_string()
    } else {
        format!("{} → {}", name, detail)
    }
}

/// Shorten a file path to just filename or last 2 segments
fn short_path(path: &str) -> String {
    let parts: Vec<&str> = path.split('/').filter(|s| !s.is_empty()).collect();
    if parts.len() <= 2 {
        parts.join("/")
    } else {
        format!("{}/{}", parts[parts.len() - 2], parts[parts.len() - 1])
    }
}

/// Parse messages and usage from jsonl content
fn parse_session_messages(
    content: &str,
) -> Result<(Vec<SessionHistoryMessage>, UsageStats), String> {
    let lines: Vec<&str> = content.lines().collect();
    let mut messages = Vec::new();

    let mut total_input = 0;
    let mut total_output = 0;
    let mut total_cache_creation = 0;
    let mut total_cache_read = 0;

    for line in lines {
        if line.trim().is_empty() {
            continue;
        }

        let event: Value = match serde_json::from_str(line) {
            Ok(v) => v,
            Err(e) => {
                log::warn!("Skipping malformed JSON line: {}", e);
                continue;
            }
        };

        let is_meta = event["isMeta"].as_bool().unwrap_or(false);

        // Extract user messages
        if event["type"] == "user" && !is_meta {
            if let Some(message) = event["message"].as_object() {
                // Content can be either string or array
                let content_text = if let Some(content_str) = message["content"].as_str() {
                    Some(content_str.to_string())
                } else if let Some(content_array) = message["content"].as_array() {
                    // Extract text from array of content blocks
                    let mut text = String::new();
                    for block in content_array {
                        if block["type"] == "text" {
                            if let Some(t) = block["text"].as_str() {
                                text.push_str(t);
                            }
                        }
                    }
                    if !text.is_empty() {
                        Some(text)
                    } else {
                        None
                    }
                } else {
                    None
                };

                if let Some(content) = content_text {
                    // Skip command messages
                    if !content.contains("<command-name>") && !content.contains("<local-command") {
                        // Skip context messages that contain both User: and Assistant: prefixes
                        // These are conversation summaries sent when resuming a session
                        // and would show duplicated content in the UI
                        let is_context_message = content.starts_with("User:")
                            && content.contains("\nAssistant:");

                        if !is_context_message {
                            messages.push(SessionHistoryMessage {
                                role: "user".to_string(),
                                content: content.to_string(),
                                timestamp: None,
                            });
                        }
                    }
                }
            }
        }

        // Extract assistant messages and tool uses
        if event["type"] == "assistant" {
            if let Some(message) = event["message"].as_object() {
                if let Some(content_array) = message["content"].as_array() {
                    let mut assistant_text = String::new();
                    let mut tool_uses: Vec<String> = Vec::new();

                    for block in content_array {
                        if block["type"] == "text" {
                            if let Some(text) = block["text"].as_str() {
                                assistant_text.push_str(text);
                            }
                        } else if block["type"] == "tool_use" {
                            if let Some(name) = block["name"].as_str() {
                                let summary = summarize_tool_use(name, &block["input"]);
                                tool_uses.push(summary);
                            }
                        }
                    }

                    // Insert tool use pills before the text response
                    if !tool_uses.is_empty() {
                        messages.push(SessionHistoryMessage {
                            role: "tool".to_string(),
                            content: tool_uses.join("\n"),
                            timestamp: None,
                        });
                    }

                    if !assistant_text.is_empty() {
                        messages.push(SessionHistoryMessage {
                            role: "assistant".to_string(),
                            content: assistant_text,
                            timestamp: None,
                        });
                    }
                }
            }
        }

        // Accumulate usage stats
        if event["type"] == "result" {
            if let Some(usage) = event["usage"].as_object() {
                if let Some(input) = usage["input_tokens"].as_i64() {
                    total_input += input as i32;
                }
                if let Some(output) = usage["output_tokens"].as_i64() {
                    total_output += output as i32;
                }
                if let Some(cache_creation) = usage["cache_creation_input_tokens"].as_i64() {
                    total_cache_creation += cache_creation as i32;
                }
                if let Some(cache_read) = usage["cache_read_input_tokens"].as_i64() {
                    total_cache_read += cache_read as i32;
                }
            }
        }
    }

    let usage = UsageStats {
        input_tokens: total_input,
        output_tokens: total_output,
        cache_creation_input_tokens: total_cache_creation,
        cache_read_input_tokens: total_cache_read,
    };

    Ok((messages, usage))
}

/// Result of tailing a Claude Code interactive transcript (feature 069, Fase 4).
#[derive(Debug, Serialize, Clone)]
pub struct TranscriptTail {
    /// Usage from the LAST assistant message that carried a `usage` object.
    /// This is the per-turn (context-fill) usage, NOT a sum across the session.
    pub usage: UsageStats,
    /// Last non-empty assistant text block (for refreshing the session preview).
    pub last_text: Option<String>,
    /// total_cost_usd if a `result` line carried it.
    pub total_cost_usd: Option<f64>,
}

/// Parse the tail of a Claude Code transcript JSONL (the `transcript_path` from
/// the Stop hook) to recover per-turn token usage + the last assistant text.
/// Embedded-CLI mode has no SDK event stream, so this backfills the stamina bar.
///
/// Reads only the last ~512KB to stay cheap on long sessions (the final turn's
/// data lives at the end). A multi-byte char on the read boundary is harmless
/// here (lossy on the dropped partial first line only). Returns zeroed usage
/// (→ UI shows N/A) rather than erroring when nothing parseable is found.
/// Brain: 069-embedded-cli-hooks-pivot
#[command]
pub fn parse_transcript_tail(path: String) -> Result<TranscriptTail, String> {
    use std::io::{Read, Seek, SeekFrom};

    const TAIL_BYTES: u64 = 512 * 1024;
    let mut file = fs::File::open(&path).map_err(|e| format!("open {path}: {e}"))?;
    let len = file.metadata().map_err(|e| e.to_string())?.len();
    let start = len.saturating_sub(TAIL_BYTES);
    if start > 0 {
        file.seek(SeekFrom::Start(start)).map_err(|e| e.to_string())?;
    }
    let mut buf = Vec::new();
    file.read_to_end(&mut buf).map_err(|e| e.to_string())?;
    let content = String::from_utf8_lossy(&buf);

    let mut lines: Vec<&str> = content.lines().collect();
    // Drop the (likely partial) first line when we seeked into the file.
    if start > 0 && !lines.is_empty() {
        lines.remove(0);
    }

    let mut usage = UsageStats {
        input_tokens: 0,
        output_tokens: 0,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
    };
    let mut last_text: Option<String> = None;
    let mut total_cost_usd: Option<f64> = None;

    for line in lines {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let event: Value = match serde_json::from_str(line) {
            Ok(v) => v,
            Err(_) => continue,
        };

        if event["type"] == "assistant" {
            if let Some(message) = event["message"].as_object() {
                // Last assistant usage wins → per-turn context fill.
                if let Some(u) = message.get("usage").and_then(|x| x.as_object()) {
                    let get = |k: &str| u.get(k).and_then(|v| v.as_i64()).unwrap_or(0) as i32;
                    usage = UsageStats {
                        input_tokens: get("input_tokens"),
                        output_tokens: get("output_tokens"),
                        cache_creation_input_tokens: get("cache_creation_input_tokens"),
                        cache_read_input_tokens: get("cache_read_input_tokens"),
                    };
                }
                if let Some(content_array) = message.get("content").and_then(|c| c.as_array()) {
                    let mut text = String::new();
                    for block in content_array {
                        if block["type"] == "text" {
                            if let Some(t) = block["text"].as_str() {
                                text.push_str(t);
                            }
                        }
                    }
                    if !text.trim().is_empty() {
                        last_text = Some(text);
                    }
                }
            }
        } else if event["type"] == "result" {
            if let Some(c) = event.get("total_cost_usd").and_then(|v| v.as_f64()) {
                total_cost_usd = Some(c);
            }
        }
    }

    Ok(TranscriptTail {
        usage,
        last_text,
        total_cost_usd,
    })
}

/// Resume a session - get complete session data for resuming conversation
#[command]
pub fn resume_session(session_id: String) -> Result<SessionDetails, String> {
    // Reuse get_session_details which already loads full conversation
    get_session_details(session_id)
}

/// Get messages for an agent chat by agent ID and optional session ID
/// This is used to load chat history when reopening an agent
#[allow(dead_code)]
#[command]
pub fn get_agent_chat_messages(
    agent_id: String,
    session_id: Option<String>,
) -> Result<Vec<SessionHistoryMessage>, String> {
    // If session_id is provided, try to load from that specific session
    if let Some(sid) = session_id {
        match get_session_details(sid) {
            Ok(details) => return Ok(details.messages),
            Err(e) => {
                log::warn!("Failed to load session {}: {}", agent_id, e);
                // Fall through to return empty messages
            }
        }
    }

    // If no session_id or session not found, return empty messages
    // (agent will start fresh)
    Ok(Vec::new())
}

/// Save agent chat messages to storage
/// This creates/updates the session file with the provided messages
#[allow(dead_code)]
#[command]
pub fn save_agent_chat_messages(
    agent_id: String,
    messages: Vec<SessionHistoryMessage>,
    _session_id: Option<String>,
) -> Result<(), String> {
    // For now, we don't save messages separately from sessions
    // The Claude Agent SDK handles saving to .jsonl files
    // This is a placeholder for future implementation if needed
    log::debug!(
        "save_agent_chat_messages called for agent {} with {} messages",
        agent_id,
        messages.len()
    );
    Ok(())
}