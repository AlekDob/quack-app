use serde::{Deserialize, Serialize};
use std::{fs, path::Path, process::Stdio};
use tauri::{AppHandle, Emitter, Manager};
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
#[derive(Debug, Clone, Serialize, Deserialize)]
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssistantMessage {
    pub id: String,
    pub content: Vec<ContentBlock>,
    #[serde(flatten)]
    pub extra: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
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

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentConfig {
    pub name: String,
    pub description: String,
    pub model: String,
    pub file_path: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeCliRequest {
    pub prompt: String,
    pub model: Option<String>,
    pub thinking_mode: Option<String>,
    pub permission_mode: Option<String>,
    pub attachments: Option<Vec<String>>,
    pub agents: Option<Vec<AgentConfig>>,
    pub cwd: Option<String>,
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

/// Find the Claude CLI executable path with robust search including NVM and user directories
fn find_claude_cli_path() -> Option<String> {
    // Strategy: Search in order of preference
    // 1. Common system paths (Homebrew, MacPorts, system-wide)
    // 2. User-specific paths (~/.local/bin, ~/bin)
    // 3. NVM paths (~/.nvm/versions/node/*/bin/claude)
    // 4. Fallback to 'which claude' to use system PATH

    let mut search_paths: Vec<String> = vec![
        // Standard package manager paths
        "/opt/homebrew/bin/claude".to_string(),         // Homebrew on Apple Silicon
        "/usr/local/bin/claude".to_string(),            // Homebrew on Intel Mac
        "/opt/local/bin/claude".to_string(),            // MacPorts
        "/usr/bin/claude".to_string(),                  // System-wide install
    ];

    // Add user-specific paths
    if let Ok(home) = std::env::var("HOME") {
        search_paths.push(format!("{}/.local/bin/claude", home));
        search_paths.push(format!("{}/bin/claude", home));

        // Search in NVM directories
        let nvm_base = format!("{}/.nvm/versions/node", home);
        if let Ok(entries) = fs::read_dir(&nvm_base) {
            for entry in entries.filter_map(Result::ok) {
                let node_version_path = entry.path();
                if node_version_path.is_dir() {
                    let claude_path = node_version_path.join("bin/claude");
                    if let Some(path_str) = claude_path.to_str() {
                        search_paths.push(path_str.to_string());
                    }
                }
            }
        }
    }

    // Try each search path
    for path in &search_paths {
        if Path::new(path).exists() {
            // Verify it's executable by running --version
            let output = std::process::Command::new(path)
                .arg("--version")
                .output();

            if let Ok(output) = output {
                if output.status.success() {
                    log::info!("Found Claude CLI at: {}", path);
                    return Some(path.to_string());
                }
            }
        }
    }

    // Fallback: Try using 'which' to find claude in PATH
    if let Ok(output) = std::process::Command::new("which")
        .arg("claude")
        .output()
    {
        if output.status.success() {
            if let Ok(path) = String::from_utf8(output.stdout) {
                let path = path.trim();
                if !path.is_empty() && Path::new(path).exists() {
                    log::info!("Found Claude CLI via 'which' at: {}", path);
                    return Some(path.to_string());
                }
            }
        }
    }

    log::warn!("Claude CLI not found in any known location");
    None
}

/// Check if Claude CLI is available and authenticated
#[tauri::command]
pub fn check_claude_cli_available() -> Result<bool, String> {
    Ok(find_claude_cli_path().is_some())
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
        ..
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

    // Find Claude CLI path
    let claude_path = find_claude_cli_path()
        .ok_or_else(|| "Claude CLI not found. Please ensure it's installed and in your PATH.".to_string())?;

    // Prepare the command
    let mut command = Command::new(claude_path);
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

    // Map frontend permission modes to CLI permission modes
    // Note: "act" mode (auto-approve) is the CLI default, so we omit --permission-mode flag
    if let Some(mode) = permission_mode.and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_lowercase())
        }
    }) {
        match mode.as_str() {
            "bypass" => {
                command.arg("--permission-mode").arg("bypassPermissions");
            }
            "plan" => {
                command.arg("--permission-mode").arg("plan");
            }
            "act" => {
                // Do nothing - CLI default is auto-approve
            }
            _ => {
                // Unknown mode - fallback to auto-approve (do nothing)
            }
        }
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
    agent_id: String,
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
        ..
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

    // Find Claude CLI path
    let claude_path = find_claude_cli_path()
        .ok_or_else(|| "Claude CLI not found. Please ensure it's installed and in your PATH.".to_string())?;

    // Prepare the command with verbose mode for tool tracking
    let mut command = Command::new(claude_path);
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

    // Map frontend permission modes to CLI permission modes
    // Note: "act" mode (auto-approve) is the CLI default, so we omit --permission-mode flag
    if let Some(mode) = permission_mode.and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_lowercase())
        }
    }) {
        match mode.as_str() {
            "bypass" => {
                command.arg("--permission-mode").arg("bypassPermissions");
            }
            "plan" => {
                command.arg("--permission-mode").arg("plan");
            }
            "act" => {
                // Do nothing - CLI default is auto-approve
            }
            _ => {
                // Unknown mode - fallback to auto-approve (do nothing)
            }
        }
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

    // Read stderr only for logging (tool tracking now done via JSON parsing)
    if let Some(stderr) = child.stderr.take() {
        let mut stderr_reader = BufReader::new(stderr).lines();
        // Spawn task to log stderr (but don't emit tool events - handled by JSON)
        tokio::spawn(async move {
            while let Ok(Some(line)) = stderr_reader.next_line().await {
                // Log stderr for debugging
                log::info!("[Claude stderr] {}", line);
            }
        });
    }

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

    // Emit each event to the frontend for real-time visualization
    for event in &events {
        let event_name = format!("claude-event:{}", agent_id);
        let _ = app.emit(&event_name, event);
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

/// Send a message to Claude via Node.js SDK with real-time streaming
#[tauri::command]
pub async fn send_message_via_sdk_streaming(
    app: AppHandle,
    agent_id: String,
    request: ClaudeCliRequest,
    session_state: tauri::State<'_, crate::SessionState>,
) -> Result<ClaudeCliResponse, String> {
    let ClaudeCliRequest {
        prompt,
        model,
        thinking_mode,
        permission_mode,
        agents,
        cwd,
        attachments,
    } = request;

    // Use provided cwd or fallback to current directory
    let working_dir = cwd.or_else(|| {
        std::env::current_dir()
            .ok()
            .and_then(|p| p.to_str().map(|s| s.to_string()))
    });

    // Get existing session ID for this agent (for resume)
    let current_session_id = session_state.get_session(&agent_id);

    if let Some(ref session_id) = current_session_id {
        log::info!("[SDK] Resuming session for agent {}: {}", agent_id, session_id);
    } else {
        log::info!("[SDK] Starting new session for agent {}", agent_id);
    }

    // Build config JSON for Node.js script
    // Note: permissionMode mapping for Agent SDK:
    // - undefined (not set) = auto-approve (our "act" mode)
    // - "plan" = planning only
    // - "bypassPermissions" = no confirmations (our "bypass" mode)

    // DEBUG: Log the received permission_mode
    log::info!("[SDK DEBUG] Received permission_mode from frontend: {:?}", permission_mode);

    let permission_value = permission_mode.as_ref().and_then(|mode| match mode.as_str() {
        "bypass" => {
            log::info!("[SDK DEBUG] Mapping 'bypass' -> 'bypassPermissions'");
            Some(serde_json::Value::String("bypassPermissions".to_string()))
        }
        "plan" => {
            log::info!("[SDK DEBUG] Mapping 'plan' -> 'plan'");
            Some(serde_json::Value::String("plan".to_string()))
        }
        "act" => {
            log::info!("[SDK DEBUG] Mapping 'act' -> undefined (omitting permissionMode)");
            None // undefined = auto-approve in SDK
        }
        _ => {
            log::warn!("[SDK DEBUG] Unknown permission mode '{}', defaulting to auto-approve (omitting permissionMode)", mode);
            None // fallback to auto-approve
        }
    });

    let mut config = serde_json::json!({
        "prompt": prompt,
        "model": model.unwrap_or_else(|| DEFAULT_MODEL.to_string()),
        "thinkingMode": thinking_mode,
        "cwd": working_dir,
        "sessionId": current_session_id, // Pass session ID for resume
    });

    // Add permissionMode only if explicitly set (not "act")
    if let Some(perm) = permission_value {
        log::info!("[SDK DEBUG] Adding permissionMode to config: {:?}", perm);
        config["permissionMode"] = perm;
    } else {
        log::info!("[SDK DEBUG] Omitting permissionMode from config (will use SDK default: auto-approve)");
    }

    // DEBUG: Log final config
    log::info!("[SDK DEBUG] Final config JSON: {}", config.to_string());

    // Add agents if provided
    if let Some(agent_list) = agents {
        config["agents"] = serde_json::json!(agent_list);
    }

    // Add attachments if provided (for image support)
    if let Some(attachment_list) = attachments {
        config["attachments"] = serde_json::json!(attachment_list);
        log::info!("[SDK DEBUG] Adding {} attachments to config", attachment_list.len());
    }

    let config_str = config.to_string();

    // Get path to Node.js script using Tauri's resource resolver for production builds
    let script_path = app
        .path()
        .resolve("node-sdk/stream-claude.js", tauri::path::BaseDirectory::Resource)
        .map_err(|e| format!("Failed to resolve node-sdk path: {}", e))?;

    if !script_path.exists() {
        return Err(format!("Node.js SDK script not found at: {:?}", script_path));
    }

    // Spawn Node.js process
    let mut command = Command::new("node");
    command
        .arg(&script_path)
        .arg(&config_str)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = command
        .spawn()
        .map_err(|e| format!("Failed to spawn Node.js SDK script: {}", e))?;

    // Read stdout for events (in foreground to stream in real-time)
    let stdout = child.stdout.take()
        .ok_or("Failed to capture stdout".to_string())?;
    let mut stdout_reader = BufReader::new(stdout).lines();

    // Move stderr logging to background
    if let Some(stderr) = child.stderr.take() {
        tokio::spawn(async move {
            let mut stderr_reader = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = stderr_reader.next_line().await {
                log::error!("[Node.js SDK stderr] {}", line);
            }
        });
    }

    // Track final response
    let mut final_result: Option<ClaudeCliResponse> = None;

    // Stream stdout events in real-time (foreground task)
    while let Ok(Some(line)) = stdout_reader.next_line().await {
        // Parse JSON event
        if let Ok(event) = serde_json::from_str::<ClaudeEvent>(&line) {
            // Capture and save session ID from system init event
            if let ClaudeEvent::System { session_id, .. } = &event {
                log::info!("[SDK] Captured session ID for agent {}: {}", agent_id, session_id);
                session_state.set_session(agent_id.clone(), session_id.clone());
            }

            // Emit event to frontend immediately
            let event_name = format!("claude-event:{}", agent_id);
            let _ = app.emit(&event_name, &event);

            // Check if this is the final result
            if let ClaudeEvent::Result { result, session_id, total_cost_usd, usage, .. } = &event {
                final_result = Some(ClaudeCliResponse {
                    result: result.clone(),
                    session_id: session_id.clone(),
                    total_cost_usd: *total_cost_usd,
                    usage: usage.clone(),
                });
            }
        }
    }

    // Wait for process to complete
    let status = child.wait().await
        .map_err(|e| format!("Failed to wait for Node.js process: {}", e))?;

    if !status.success() {
        return Err(format!("Node.js SDK script failed with status: {}", status));
    }

    // Return final response
    final_result.ok_or_else(|| {
        "No result event found in Node.js SDK output".to_string()
    })
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
