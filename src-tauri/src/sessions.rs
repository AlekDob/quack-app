use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use tauri::command;

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

/// List all session IDs from all project directories
#[command]
pub fn list_sessions() -> Result<Vec<String>, String> {
    let project_dirs = get_projects_dirs()?;
    let mut session_ids = Vec::new();

    for project_dir in project_dirs {
        for entry in fs::read_dir(&project_dir)
            .map_err(|e| format!("Failed to read project directory: {}", e))?
        {
            let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
            let path = entry.path();

            // Only include .jsonl files (session history files)
            if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("jsonl") {
                if let Some(file_stem) = path.file_stem().and_then(|s| s.to_str()) {
                    session_ids.push(file_stem.to_string());
                }
            }

            // TEMPORARY: Limit to 50 sessions to prevent crash
            if session_ids.len() >= 50 {
                break;
            }
        }

        if session_ids.len() >= 50 {
            break;
        }
    }

    Ok(session_ids)
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

/// Get session info from a session file
#[command]
pub fn get_session_info(session_id: String) -> Result<SessionInfo, String> {
    let session_file = find_session_file(&session_id)?;

    let content = fs::read_to_string(&session_file)
        .map_err(|e| format!("Failed to read session file: {}", e))?;

    // Parse session metadata
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
    ) = parse_session_metadata(&content)?;

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
    ) = parse_session_metadata(&content)?;

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

    fs::remove_file(&session_file)
        .map_err(|e| format!("Failed to delete session file: {}", e))?;

    Ok(())
}

/// Parse session metadata from jsonl content
fn parse_session_metadata(
    content: &str,
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

        let event: Value = serde_json::from_str(line)
            .map_err(|e| format!("Failed to parse JSON line: {}", e))?;

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
            if let Some(message) = event["message"].as_object() {
                if let Some(content) = message["content"].as_str() {
                    // Skip meta messages and command messages
                    let is_meta = event["isMeta"].as_bool().unwrap_or(false);
                    let is_command = content.contains("<command-name>") || content.contains("<local-command");

                    if !is_meta && !is_command && !content.is_empty() {
                        title = content
                            .chars()
                            .take(60)
                            .collect::<String>()
                            .trim()
                            .to_string();
                        if title.len() >= 57 {
                            title.truncate(57);
                            title.push_str("...");
                        }
                        first_user_message = false;
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

        let event: Value = serde_json::from_str(line)
            .map_err(|e| format!("Failed to parse JSON line: {}", e))?;

        let is_meta = event["isMeta"].as_bool().unwrap_or(false);

        // Extract user messages
        if event["type"] == "user" && !is_meta {
            if let Some(message) = event["message"].as_object() {
                if let Some(content) = message["content"].as_str() {
                    // Skip command messages
                    if !content.contains("<command-name>") && !content.contains("<local-command") {
                        messages.push(SessionHistoryMessage {
                            role: "user".to_string(),
                            content: content.to_string(),
                            timestamp: None,
                        });
                    }
                }
            }
        }

        // Extract assistant messages
        if event["type"] == "assistant" {
            if let Some(message) = event["message"].as_object() {
                if let Some(content_array) = message["content"].as_array() {
                    let mut assistant_text = String::new();
                    for block in content_array {
                        if block["type"] == "text" {
                            if let Some(text) = block["text"].as_str() {
                                assistant_text.push_str(text);
                            }
                        }
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
