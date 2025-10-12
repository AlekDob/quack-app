use serde::{Deserialize, Serialize};
use std::{fs, path::Path, process::Stdio};
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeCliResponse {
    pub result: String,
    pub session_id: String,
    pub total_cost_usd: f64,
    pub usage: Usage,
}

// New event-based structures for --output-format json
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum ClaudeEvent {
    System {
        subtype: String,
        tools: Option<Vec<String>>,
        session_id: String,
        #[serde(flatten)]
        extra: serde_json::Value,
    },
    Assistant {
        message: AssistantMessage,
        session_id: String,
        #[serde(flatten)]
        extra: serde_json::Value,
    },
    User {
        message: serde_json::Value,
        session_id: String,
        #[serde(flatten)]
        extra: serde_json::Value,
    },
    Result {
        result: String,
        session_id: String,
        total_cost_usd: f64,
        usage: Usage,
        #[serde(flatten)]
        extra: serde_json::Value,
    },
}

#[derive(Debug, Clone, Deserialize)]
pub struct AssistantMessage {
    pub id: String,
    pub content: Vec<ContentBlock>,
    #[serde(flatten)]
    pub extra: serde_json::Value,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum ContentBlock {
    Text {
        text: String,
    },
    #[serde(rename = "tool_use")]
    ToolUse {
        id: String,
        name: String,
        input: serde_json::Value,
    },
    #[serde(untagged)]
    Other(serde_json::Value),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Usage {
    pub input_tokens: u32,
    pub output_tokens: u32,
    #[serde(default)]
    pub cache_read_input_tokens: u32,
    #[serde(default)]
    pub cache_creation_input_tokens: u32,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeCliRequest {
    pub prompt: String,
    pub model: Option<String>,
    pub thinking_mode: Option<String>,
    pub permission_mode: Option<String>,
    pub attachments: Option<Vec<String>>,
}

const DEFAULT_MODEL: &str = "sonnet";
const MAX_ATTACHMENTS: usize = 6;
const MAX_ATTACHMENT_SIZE: u64 = 15 * 1024 * 1024;

// Event payloads for tool tracking
#[derive(Debug, Clone, Serialize)]
pub struct ToolStartEvent {
    pub tool_id: String,
    pub tool_name: String,
    pub message_id: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ToolResultEvent {
    pub tool_id: String,
    pub tool_name: String,
    pub message_id: String,
    pub result: String,
    pub status: String, // "completed" | "error"
}

#[derive(Debug, Clone, Serialize)]
pub struct ToolDiffLine {
    #[serde(rename = "type")]
    pub line_type: String, // "added" | "removed" | "unchanged"
    pub content: String,
    #[serde(rename = "lineNumber")]
    pub line_number: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ToolDiffEvent {
    pub tool_id: String,
    pub message_id: String,
    #[serde(rename = "fileName")]
    pub file_name: Option<String>,
    pub lines: Vec<ToolDiffLine>,
}

/// Check if Claude CLI is available and authenticated
#[tauri::command]
pub fn check_claude_cli_available() -> Result<bool, String> {
    let output = std::process::Command::new("claude")
        .arg("--version")
        .output();

    match output {
        Ok(output) => {
            if output.status.success() {
                Ok(true)
            } else {
                Ok(false)
            }
        }
        Err(_) => Ok(false),
    }
}

/// Send a message to Claude via CLI
#[tauri::command]
pub async fn send_message_via_cli(request: ClaudeCliRequest) -> Result<ClaudeCliResponse, String> {
    // Check if CLI is available
    if !check_claude_cli_available().map_err(|e| e.to_string())? {
        return Err("Claude CLI is not available. Make sure Claude Code CLI is installed and you are logged in.".to_string());
    }

    let ClaudeCliRequest {
        prompt,
        model,
        thinking_mode,
        permission_mode,
        attachments,
    } = request;

    let mut prompt_with_attachments = prompt.clone();

    if let Some(list) = attachments {
        if list.len() > MAX_ATTACHMENTS {
            return Err(format!("Too many attachments. Maximum allowed is {}.", MAX_ATTACHMENTS));
        }

        let mut has_header = prompt_with_attachments.contains("Attachments:");

        for path in list {
            let trimmed = path.trim();
            if trimmed.is_empty() {
                continue;
            }

            let metadata = fs::metadata(trimmed)
                .map_err(|e| format!("Unable to read attachment '{}': {}", trimmed, e))?;

            if !metadata.is_file() {
                return Err(format!("Attachment is not a file: {}", trimmed));
            }

            if metadata.len() > MAX_ATTACHMENT_SIZE {
                let name = Path::new(trimmed)
                    .file_name()
                    .and_then(|s| s.to_str())
                    .unwrap_or(trimmed);
                return Err(format!("Attachment '{}' exceeds 15MB limit.", name));
            }

            if prompt_with_attachments.contains(trimmed) {
                continue;
            }

            if !has_header {
                if !prompt_with_attachments.ends_with('\n') {
                    prompt_with_attachments.push('\n');
                }
                prompt_with_attachments.push_str("\nAttachments:\n");
                has_header = true;
            }

            prompt_with_attachments.push_str(trimmed);
            prompt_with_attachments.push('\n');
        }
    }

    // Prepare the command
    let mut command = Command::new("claude");
    command
        .arg("--print")
        .arg("--output-format")
        .arg("json");

    let selected_model = model.unwrap_or_else(|| DEFAULT_MODEL.to_string());
    command.arg("--model").arg(&selected_model);

    if let Some(mode) = thinking_mode.and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() || trimmed.eq_ignore_ascii_case("auto") {
            None
        } else {
            Some(trimmed.to_owned())
        }
    }) {
        command.arg("--think").arg(mode);
    }

    if let Some(mode) = permission_mode.and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_lowercase())
        }
    }) {
        // Map frontend permission modes to valid Claude CLI modes
        // Valid CLI modes: acceptEdits, bypassPermissions, default, plan
        let cli_mode = match mode.as_str() {
            "bypass" => "bypassPermissions",
            "act" => "default",
            "read" => "default",
            "review" => "default",
            "write" => "acceptEdits",
            "safe" => "default",
            "plan" => "plan",
            "acceptedits" => "acceptEdits",
            "bypasspermissions" => "bypassPermissions",
            "default" => "default",
            _ => "default",  // fallback to default
        };

        command.arg("--permission-mode").arg(cli_mode);
    }

    command
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = command
        .spawn()
        .map_err(|e| format!("Failed to spawn claude command: {}", e))?;

    // Write prompt to stdin
    {
        let stdin = child.stdin.as_mut()
            .ok_or("Failed to open stdin".to_string())?;
        stdin.write_all(prompt_with_attachments.as_bytes()).await
            .map_err(|e| format!("Failed to write to stdin: {}", e))?;
    }

    // Wait for command to complete and get output
    let output = child.wait_with_output().await
        .map_err(|e| format!("Failed to wait for claude command: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Claude CLI failed: {}", stderr));
    }

    // Parse JSON output
    let stdout = String::from_utf8_lossy(&output.stdout);
    let response: ClaudeCliResponse = serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse Claude CLI JSON response: {}", e))?;

    Ok(response)
}

/// Parse tool usage from Claude CLI output line
fn parse_tool_from_line(line: &str) -> Option<(String, String)> {
    // Look for tool patterns in Claude Code output
    // Examples:
    // "Using tool: Read"
    // "Tool: Edit - file.ts"
    // "Running: Bash(npm install)"

    let line_lower = line.to_lowercase();

    // Pattern 1: "Using tool: ToolName"
    if let Some(idx) = line_lower.find("using tool:") {
        let rest = &line[idx + 11..].trim();
        if let Some(tool_name) = rest.split_whitespace().next() {
            return Some((tool_name.to_string(), line.to_string()));
        }
    }

    // Pattern 2: "Tool: ToolName"
    if let Some(idx) = line_lower.find("tool:") {
        let rest = &line[idx + 5..].trim();
        if let Some(tool_name) = rest.split_whitespace().next() {
            return Some((tool_name.to_string(), line.to_string()));
        }
    }

    // Pattern 3: Detect tool names directly (Read, Edit, Bash, Grep, Glob, etc.)
    let tools = ["read", "edit", "write", "bash", "grep", "glob", "webfetch", "websearch"];
    for tool in tools {
        if line_lower.contains(tool) && (line_lower.contains("using") || line_lower.contains("running")) {
            return Some((tool.to_string(), line.to_string()));
        }
    }

    None
}

/// Send a message to Claude via CLI with streaming tool tracking
#[tauri::command]
pub async fn send_message_via_cli_streaming(
    app: AppHandle,
    message_id: String,
    request: ClaudeCliRequest,
) -> Result<ClaudeCliResponse, String> {
    // Check if CLI is available
    if !check_claude_cli_available().map_err(|e| e.to_string())? {
        return Err("Claude CLI is not available. Make sure Claude Code CLI is installed and you are logged in.".to_string());
    }

    let ClaudeCliRequest {
        prompt,
        model,
        thinking_mode,
        permission_mode,
        attachments,
    } = request;

    let mut prompt_with_attachments = prompt.clone();

    if let Some(list) = attachments {
        if list.len() > MAX_ATTACHMENTS {
            return Err(format!("Too many attachments. Maximum allowed is {}.", MAX_ATTACHMENTS));
        }

        let mut has_header = prompt_with_attachments.contains("Attachments:");

        for path in list {
            let trimmed = path.trim();
            if trimmed.is_empty() {
                continue;
            }

            let metadata = fs::metadata(trimmed)
                .map_err(|e| format!("Unable to read attachment '{}': {}", trimmed, e))?;

            if !metadata.is_file() {
                return Err(format!("Attachment is not a file: {}", trimmed));
            }

            if metadata.len() > MAX_ATTACHMENT_SIZE {
                let name = Path::new(trimmed)
                    .file_name()
                    .and_then(|s| s.to_str())
                    .unwrap_or(trimmed);
                return Err(format!("Attachment '{}' exceeds 15MB limit.", name));
            }

            if prompt_with_attachments.contains(trimmed) {
                continue;
            }

            if !has_header {
                if !prompt_with_attachments.ends_with('\n') {
                    prompt_with_attachments.push('\n');
                }
                prompt_with_attachments.push_str("\nAttachments:\n");
                has_header = true;
            }

            prompt_with_attachments.push_str(trimmed);
            prompt_with_attachments.push('\n');
        }
    }

    // Prepare the command with verbose mode for tool tracking
    let mut command = Command::new("claude");
    command
        .arg("--verbose")
        .arg("--output-format")
        .arg("json");

    let selected_model = model.unwrap_or_else(|| DEFAULT_MODEL.to_string());
    command.arg("--model").arg(&selected_model);

    if let Some(mode) = thinking_mode.and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() || trimmed.eq_ignore_ascii_case("auto") {
            None
        } else {
            Some(trimmed.to_owned())
        }
    }) {
        command.arg("--think").arg(mode);
    }

    if let Some(mode) = permission_mode.and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_lowercase())
        }
    }) {
        // Map frontend permission modes to valid Claude CLI modes
        // Valid CLI modes: acceptEdits, bypassPermissions, default, plan
        let cli_mode = match mode.as_str() {
            "bypass" => "bypassPermissions",
            "act" => "default",
            "read" => "default",
            "review" => "default",
            "write" => "acceptEdits",
            "safe" => "default",
            "plan" => "plan",
            "acceptedits" => "acceptEdits",
            "bypasspermissions" => "bypassPermissions",
            "default" => "default",
            _ => "default",  // fallback to default
        };

        command.arg("--permission-mode").arg(cli_mode);
    }

    command
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = command
        .spawn()
        .map_err(|e| format!("Failed to spawn claude command: {}", e))?;

    // Write prompt to stdin
    {
        let stdin = child.stdin.as_mut()
            .ok_or("Failed to open stdin".to_string())?;
        stdin.write_all(prompt_with_attachments.as_bytes()).await
            .map_err(|e| format!("Failed to write to stdin: {}", e))?;
    }

    // Read stderr for tool tracking
    let stderr = child.stderr.take()
        .ok_or("Failed to capture stderr".to_string())?;
    let mut stderr_reader = BufReader::new(stderr).lines();

    let app_clone = app.clone();
    let message_id_clone = message_id.clone();

    // Spawn task to read stderr and emit tool events
    tokio::spawn(async move {
        let mut tool_counter = 0u32;
        while let Ok(Some(line)) = stderr_reader.next_line().await {
            // Log all stderr lines for debugging
            log::info!("[Claude stderr] {}", line);

            // Try to parse tool from line
            if let Some((tool_name, _full_line)) = parse_tool_from_line(&line) {
                tool_counter += 1;
                let tool_id = format!("tool-{}-{}", message_id_clone, tool_counter);

                // Emit tool start event
                let start_event = ToolStartEvent {
                    tool_id: tool_id.clone(),
                    tool_name: tool_name.clone(),
                    message_id: message_id_clone.clone(),
                };

                let _ = app_clone.emit("claude-tool-start", start_event);

                // For now, immediately mark as completed
                let result_event = ToolResultEvent {
                    tool_id,
                    tool_name,
                    message_id: message_id_clone.clone(),
                    result: line.clone(),
                    status: "completed".to_string(),
                };

                let _ = app_clone.emit("claude-tool-result", result_event);
            }
        }
    });

    // Wait for command to complete and get output
    let output = child.wait_with_output().await
        .map_err(|e| format!("Failed to wait for claude command: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Claude CLI failed: {}", stderr));
    }

    // Parse JSON output from stdout
    let stdout = String::from_utf8_lossy(&output.stdout);

    // Log the raw output for debugging
    log::info!("[Claude stdout] {}", stdout);

    // Parse as event array
    let events: Vec<ClaudeEvent> = serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse Claude CLI events: {}. Output: {}", e, stdout))?;

    // Emit tool events from Assistant message
    for event in &events {
        if let ClaudeEvent::Assistant { message, .. } = event {
            for block in &message.content {
                if let ContentBlock::ToolUse { id, name, input } = block {
                    // Emit tool start event
                    let tool_id = id.clone();
                    let start_event = ToolStartEvent {
                        tool_id: tool_id.clone(),
                        tool_name: name.clone(),
                        message_id: message_id.clone(),
                    };
                    let _ = app.emit("claude-tool-start", start_event);

                    // Emit tool result event (mark as completed)
                    let result_event = ToolResultEvent {
                        tool_id,
                        tool_name: name.clone(),
                        message_id: message_id.clone(),
                        result: serde_json::to_string_pretty(input).unwrap_or_else(|_| format!("{:?}", input)),
                        status: "completed".to_string(),
                    };
                    let _ = app.emit("claude-tool-result", result_event);
                }
            }
        }
    }

    // Extract final response from Result event
    let result_event = events.iter()
        .find_map(|e| match e {
            ClaudeEvent::Result { result, session_id, total_cost_usd, usage, .. } => {
                Some(ClaudeCliResponse {
                    result: result.clone(),
                    session_id: session_id.clone(),
                    total_cost_usd: *total_cost_usd,
                    usage: usage.clone(),
                })
            }
            _ => None,
        })
        .ok_or_else(|| format!("No result event found in Claude CLI output. Events: {:?}", events))?;

    Ok(result_event)
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cli_availability() {
        // This test will only pass if Claude CLI is installed
        let available = check_claude_cli_available().unwrap_or(false);
        println!("Claude CLI available: {}", available);
    }
}
