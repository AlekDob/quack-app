use serde::{Deserialize, Serialize};
use std::{collections::HashMap, fs, path::{Path, PathBuf}, process::Stdio, sync::Mutex};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_shell::ShellExt;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, Command};
use tokio::sync::Mutex as TokioMutex;
use once_cell::sync::Lazy;

// =============================================================================
// ACTIVE PROCESS MANAGEMENT (for bidirectional communication)
// =============================================================================

/// Store active Node.js SDK processes with their stdin handles
/// Key: agent_id, Value: ChildStdin handle
static ACTIVE_PROCESSES: Lazy<TokioMutex<HashMap<String, ChildStdin>>> =
    Lazy::new(|| TokioMutex::new(HashMap::new()));

/// Send a message to an active SDK process via stdin
pub async fn send_to_process(agent_id: &str, message: &str) -> Result<(), String> {
    let mut processes = ACTIVE_PROCESSES.lock().await;

    if let Some(stdin) = processes.get_mut(agent_id) {
        let line = format!("{}\n", message);
        stdin.write_all(line.as_bytes()).await
            .map_err(|e| format!("Failed to write to process stdin: {}", e))?;
        stdin.flush().await
            .map_err(|e| format!("Failed to flush process stdin: {}", e))?;
        log::info!("[SDK] 📤 Sent message to process {}: {}...", agent_id, &message[..std::cmp::min(100, message.len())]);
        Ok(())
    } else {
        Err(format!("No active process found for agent: {}", agent_id))
    }
}

/// Register an active process stdin
async fn register_process_stdin(agent_id: String, stdin: ChildStdin) {
    let mut processes = ACTIVE_PROCESSES.lock().await;
    processes.insert(agent_id.clone(), stdin);
    log::info!("[SDK] 📝 Registered stdin for agent: {}", agent_id);
}

/// Unregister a process when it completes
async fn unregister_process(agent_id: &str) {
    let mut processes = ACTIVE_PROCESSES.lock().await;
    processes.remove(agent_id);
    log::info!("[SDK] 🗑️ Unregistered stdin for agent: {}", agent_id);
}

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
    // Agent event (subagent start/stop) - SDK 0.1.54+
    Agent {
        action: Option<String>,
        agent_name: Option<String>,
        agent_type: Option<String>,
        session_id: Option<String>,
        #[serde(flatten)]
        extra: serde_json::Value,
    },
    // Complete event (stream finished)
    Complete {
        #[serde(flatten)]
        extra: serde_json::Value,
    },
    // Kanban event (from kanban-tools MCP server)
    #[serde(rename = "kanban_event")]
    KanbanEvent {
        #[serde(rename = "eventType")]
        event_type: String,
        payload: serde_json::Value,
        timestamp: u64,
    },
    // AskUserQuestion event - requires user input (SDK v0.1.71+)
    #[serde(rename = "ask_user_question")]
    AskUserQuestion {
        #[serde(rename = "requestId")]
        request_id: String,
        questions: Vec<AskUserQuestionQuestion>,
    },
}

/// Question structure for AskUserQuestion tool
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AskUserQuestionQuestion {
    pub question: String,
    pub header: String,
    pub options: Vec<AskUserQuestionOption>,
    #[serde(rename = "multiSelect")]
    pub multi_select: bool,
}

/// Option structure for AskUserQuestion
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AskUserQuestionOption {
    pub label: String,
    pub description: String,
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
        #[serde(default)]
        id: Option<String>, // Made optional for robustness
        name: String,
        input: serde_json::Value,
    },
    // Thinking block (SDK 0.1.54+ extended thinking)
    Thinking {
        thinking: String,
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
    // ✅ Session ID for conversation continuity (resume support)
    pub session_id: Option<String>,
    // ✅ Structured outputs support (beta)
    pub output_format: Option<serde_json::Value>,
    // ✅ Effort parameter: 'low' | 'medium' | 'high' (SDK 0.1.54+)
    pub effort: Option<String>,
    // ✅ Setting sources control (to prevent "Prompt is too long" errors)
    pub setting_sources: Option<Vec<String>>,
    // 🗣️ Allowed tools list (SDK v0.1.57+) - enables specific tools like AskUserQuestion
    pub allowed_tools: Option<Vec<String>>,
    // 🧠 Auto Memory Search - search Brain before each query (SDK 0.2.1+)
    // Default: true (enabled). Set to false to disable.
    pub auto_memory_search_enabled: Option<bool>,
    // 🦆 SESSION-FIRST: Frontend session key for routing events to correct chat session
    // This allows parallel conversations - each stream knows where to write its events
    pub session_key: Option<String>,
}

const DEFAULT_MODEL: &str = "sonnet";
const MAX_ATTACHMENTS: usize = 6;
const MAX_ATTACHMENT_SIZE: u64 = 15 * 1024 * 1024;

/// Minimum supported Node.js version (major)
const MIN_NODE_VERSION: u32 = 18;

/// Get home directory robustly (works even when $HOME is not set)
/// This is important for apps launched from Finder which don't inherit shell environment
fn get_home_dir() -> Option<PathBuf> {
    // Try $HOME first (fastest)
    if let Ok(home) = std::env::var("HOME") {
        if !home.is_empty() {
            return Some(PathBuf::from(home));
        }
    }

    // Fallback: Use platform-specific method
    #[cfg(target_os = "macos")]
    {
        // On macOS, use NSHomeDirectory equivalent via getpwuid
        use std::ffi::CStr;
        unsafe {
            let uid = libc::getuid();
            let pwd = libc::getpwuid(uid);
            if !pwd.is_null() {
                let home = CStr::from_ptr((*pwd).pw_dir);
                if let Ok(home_str) = home.to_str() {
                    return Some(PathBuf::from(home_str));
                }
            }
        }
    }

    None
}

/// Parse Node.js version from `node --version` output (e.g., "v22.8.0" -> 22)
fn parse_node_major_version(version_str: &str) -> Option<u32> {
    let trimmed = version_str.trim().trim_start_matches('v');
    trimmed.split('.').next()?.parse().ok()
}

/// Check if Node.js version is compatible (>= MIN_NODE_VERSION)
fn is_node_version_compatible(node_path: &Path) -> bool {
    if let Ok(output) = std::process::Command::new(node_path)
        .arg("--version")
        .output()
    {
        if output.status.success() {
            if let Ok(version_str) = String::from_utf8(output.stdout) {
                if let Some(major) = parse_node_major_version(&version_str) {
                    let compatible = major >= MIN_NODE_VERSION;
                    log::info!("[Node.js] Version check: {} (major: {}, compatible: {})",
                        version_str.trim(), major, compatible);
                    return compatible;
                }
            }
        }
    }
    // If we can't determine version, assume compatible
    log::warn!("[Node.js] Could not determine version for {:?}, assuming compatible", node_path);
    true
}

/// Find system Node.js executable (fallback when sidecar is not available)
/// This searches common Node.js installation paths with robust home directory detection
fn find_system_node_executable() -> Option<PathBuf> {
    log::info!("[Node.js] Searching for system Node.js installation...");

    // Get home directory robustly (works even when launched from Finder)
    let home_dir = get_home_dir();
    log::info!("[Node.js] Home directory: {:?}", home_dir);

    // 🎯 PRIORITY 1: Try Volta's which command (if Volta is available)
    // Volta respects the toolchain and version management even from Finder
    if let Ok(output) = std::process::Command::new("volta")
        .args(["which", "node"])
        .output()
    {
        if output.status.success() {
            if let Ok(path_str) = String::from_utf8(output.stdout) {
                let path = PathBuf::from(path_str.trim());
                if path.exists() && is_node_version_compatible(&path) {
                    log::info!("[Node.js] ✅ Found via Volta: {:?}", path);
                    return Some(path);
                }
            }
        }
    }

    // 🎯 PRIORITY 2: Check Volta directory directly (for Finder launch)
    if let Some(ref home) = home_dir {
        let volta_node = home.join(".volta/bin/node");
        if volta_node.exists() && is_node_version_compatible(&volta_node) {
            log::info!("[Node.js] ✅ Found Volta Node.js at: {:?}", volta_node);
            return Some(volta_node);
        }
    }

    // 🎯 PRIORITY 3: Try standard PATH (works for dev mode and Terminal launch)
    if let Ok(output) = std::process::Command::new("which").arg("node").output() {
        if output.status.success() {
            if let Ok(path_str) = String::from_utf8(output.stdout) {
                let path = PathBuf::from(path_str.trim());
                if path.exists() && is_node_version_compatible(&path) {
                    log::info!("[Node.js] ✅ Found via PATH: {:?}", path);
                    return Some(path);
                }
            }
        }
    }

    // 🎯 PRIORITY 4: Common installation paths (macOS/Linux)
    let common_paths = vec![
        "/opt/homebrew/bin/node",        // Homebrew ARM Mac (most common now)
        "/usr/local/bin/node",           // Homebrew Intel Mac
        "/usr/bin/node",                 // System package managers
        "/opt/local/bin/node",           // MacPorts
    ];

    for path_str in &common_paths {
        let path = PathBuf::from(path_str);
        if path.exists() && is_node_version_compatible(&path) {
            log::info!("[Node.js] ✅ Found at common path: {:?}", path);
            return Some(path);
        }
    }

    // 🎯 PRIORITY 5: Check NVM installations (~/.nvm/versions/node/*/bin/node)
    // Important: This works even when NVM is not initialized (Finder launch)
    if let Some(ref home) = home_dir {
        let nvm_dir = home.join(".nvm/versions/node");

        if nvm_dir.exists() {
            log::info!("[Node.js] Found NVM directory, scanning versions...");
            if let Ok(entries) = fs::read_dir(&nvm_dir) {
                // Get all version directories
                let mut versions: Vec<_> = entries
                    .filter_map(|e| e.ok())
                    .filter(|e| e.path().is_dir())
                    .collect();

                // Sort by version number (extract from dir name like "v20.18.0")
                versions.sort_by(|a, b| {
                    let a_ver = a.file_name().to_string_lossy()
                        .trim_start_matches('v')
                        .split('.')
                        .next()
                        .and_then(|s| s.parse::<u32>().ok())
                        .unwrap_or(0);
                    let b_ver = b.file_name().to_string_lossy()
                        .trim_start_matches('v')
                        .split('.')
                        .next()
                        .and_then(|s| s.parse::<u32>().ok())
                        .unwrap_or(0);
                    b_ver.cmp(&a_ver) // Descending order (latest first)
                });

                // Try each version, latest first, but only compatible ones
                for entry in versions {
                    let node_path = entry.path().join("bin/node");
                    if node_path.exists() && is_node_version_compatible(&node_path) {
                        log::info!("[Node.js] ✅ Found NVM version: {:?}", node_path);
                        return Some(node_path);
                    }
                }
            }
        }

        // Check user-specific paths
        let user_paths = vec![
            home.join(".local/bin/node"),
            home.join("bin/node"),
        ];

        for path in user_paths {
            if path.exists() && is_node_version_compatible(&path) {
                log::info!("[Node.js] ✅ Found in user directory: {:?}", path);
                return Some(path);
            }
        }
    }

    log::warn!("[Node.js] ❌ System Node.js executable not found in any common location");
    log::warn!("[Node.js] Searched: Volta, PATH, common paths, NVM, user directories");
    log::warn!("[Node.js] Minimum required version: Node.js {}", MIN_NODE_VERSION);
    None
}

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

/// Find the Claude CLI executable path with robust search including NVM, Volta, and user directories
pub fn find_claude_cli_path() -> Option<String> {
    // Strategy: Search in order of preference
    // 1. Try Volta's 'which claude' first (respects Volta toolchain)
    // 2. Common system paths (Homebrew, MacPorts, system-wide)
    // 3. User-specific paths (~/.local/bin, ~/bin)
    // 4. NVM paths (~/.nvm/versions/node/*/bin/claude)
    // 5. Volta paths (~/.volta/bin/claude)
    // 6. Fallback to system 'which claude'

    log::info!("[Claude CLI] Starting search for Claude executable...");

    // 🎯 PRIORITY 1: Try Volta's which command (if Volta is available)
    // This respects Volta's toolchain and version management
    if let Ok(output) = std::process::Command::new("volta")
        .args(["which", "claude"])
        .output()
    {
        if output.status.success() {
            if let Ok(path_str) = String::from_utf8(output.stdout) {
                let path = path_str.trim();
                if !path.is_empty() && Path::new(path).exists() {
                    log::info!("[Claude CLI] ✅ Found via Volta: {}", path);
                    return Some(path.to_string());
                }
            }
        }
    }

    let mut search_paths: Vec<String> = vec![
        // Standard package manager paths
        "/opt/homebrew/bin/claude".to_string(),         // Homebrew on Apple Silicon
        "/usr/local/bin/claude".to_string(),            // Homebrew on Intel Mac
        "/opt/local/bin/claude".to_string(),            // MacPorts
        "/usr/bin/claude".to_string(),                  // System-wide install
    ];

    // Add user-specific paths
    if let Ok(home) = std::env::var("HOME") {
        // Volta-managed global binaries (high priority)
        search_paths.push(format!("{}/.volta/bin/claude", home));

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

        // Search in Volta toolchain directories
        let volta_base = format!("{}/.volta/tools/image/claude", home);
        if let Ok(entries) = fs::read_dir(&volta_base) {
            for entry in entries.filter_map(Result::ok) {
                let version_path = entry.path();
                if version_path.is_dir() {
                    let claude_path = version_path.join("bin/claude");
                    if let Some(path_str) = claude_path.to_str() {
                        search_paths.push(path_str.to_string());
                    }
                }
            }
        }
    }

    // Try each search path
    log::info!("[Claude CLI] Checking {} search paths...", search_paths.len());
    for path in &search_paths {
        if Path::new(path).exists() {
            // Verify it's executable by running --version
            log::debug!("[Claude CLI] Testing path: {}", path);
            let output = std::process::Command::new(path)
                .arg("--version")
                .output();

            if let Ok(output) = output {
                if output.status.success() {
                    if let Ok(version) = String::from_utf8(output.stdout) {
                        log::info!("[Claude CLI] ✅ Found at: {} (version: {})", path, version.trim());
                    } else {
                        log::info!("[Claude CLI] ✅ Found at: {}", path);
                    }
                    return Some(path.to_string());
                }
            }
        }
    }

    // Fallback: Try using 'which' to find claude in PATH
    log::info!("[Claude CLI] Trying 'which claude' as fallback...");
    if let Ok(output) = std::process::Command::new("which")
        .arg("claude")
        .output()
    {
        if output.status.success() {
            if let Ok(path) = String::from_utf8(output.stdout) {
                let path = path.trim();
                if !path.is_empty() && Path::new(path).exists() {
                    log::info!("[Claude CLI] ✅ Found via 'which' at: {}", path);
                    return Some(path.to_string());
                }
            }
        }
    }

    log::warn!("[Claude CLI] ❌ Not found in any known location");
    log::warn!("[Claude CLI] Searched {} paths + Volta + system PATH", search_paths.len());
    log::warn!("[Claude CLI] Tip: Install via 'npm install -g @anthropic-ai/claude-code' or use ANTHROPIC_API_KEY");
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
    // 🔍 DEBUG: Log every API call with full details
    let debug_timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    log::info!("[SDK DEBUG WARMUP] 🚀 send_message_via_sdk_streaming CALLED at {}", debug_timestamp);
    log::info!("[SDK DEBUG WARMUP] agent_id={}, prompt={}", agent_id, request.prompt.chars().take(100).collect::<String>());
    
    let ClaudeCliRequest {
        prompt,
        model,
        thinking_mode,
        permission_mode,
        agents,
        cwd,
        attachments,
        session_id, // ✅ Extract session_id for use in session management
        output_format, // ✅ Extract output_format for structured outputs
        effort, // ✅ Extract effort parameter (SDK 0.1.54+)
        setting_sources, // ✅ Extract setting_sources to control prompt length
        allowed_tools, // 🗣️ Extract allowed_tools for AskUserQuestion etc.
        auto_memory_search_enabled, // 🧠 Auto Memory Search (SDK 0.2.1+)
        session_key, // 🦆 SESSION-FIRST: Frontend session key for event routing
    } = request;

    // 🦆 SESSION-FIRST: Use session_key or fallback to agent_id for event routing
    let event_session_key = session_key.unwrap_or_else(|| agent_id.clone());

    // Use provided cwd or fallback to current directory
    let working_dir = cwd.or_else(|| {
        std::env::current_dir()
            .ok()
            .and_then(|p| p.to_str().map(|s| s.to_string()))
    });

    // 🦆 SESSIONS-FIRST: Use ONLY the session_id from request
    // DO NOT fallback to agent_id - each AgentSession must have its own Claude session
    // If session_id is None, Claude SDK will create a NEW session
    let current_session_id = session_id.clone();

    if let Some(ref sid) = current_session_id {
        log::info!("[SDK] 🦆 SESSIONS-FIRST: Resuming existing Claude session: {}", sid);
    } else {
        log::info!("[SDK] 🦆 SESSIONS-FIRST: Creating NEW Claude session (no session_id provided)");
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

    // Add outputFormat if provided (for structured outputs)
    if let Some(output_fmt) = output_format {
        config["outputFormat"] = output_fmt;
        log::info!("[SDK DEBUG] Adding outputFormat to config for structured outputs");
    }

    // Add effort parameter if provided (SDK 0.1.54+)
    // Controls quality vs speed/cost tradeoff: 'low', 'medium', 'high'
    if let Some(effort_level) = effort {
        config["effort"] = serde_json::Value::String(effort_level.clone());
        log::info!("[SDK DEBUG] Adding effort parameter to config: {}", effort_level);
    }

    // Add settingSources if provided (to control prompt length)
    // Default (if not provided): ['project'] only
    // To disable all automatic loading: pass empty array []
    // Full context: ['project', 'user', 'local']
    if let Some(sources) = setting_sources {
        config["settingSources"] = serde_json::Value::Array(
            sources.iter().map(|s| serde_json::Value::String(s.clone())).collect()
        );
        log::info!("[SDK DEBUG] Adding settingSources to config: {:?}", sources);
    } else {
        log::info!("[SDK DEBUG] Using default settingSources: ['project']");
    }

    // 🗣️ Add allowedTools if provided (SDK v0.1.57+)
    // This enables specific tools like AskUserQuestion
    if let Some(tools) = allowed_tools {
        config["allowedTools"] = serde_json::Value::Array(
            tools.iter().map(|t| serde_json::Value::String(t.clone())).collect()
        );
        log::info!("[SDK DEBUG] Adding allowedTools to config: {:?}", tools);
    }

    // 🧠 Add autoMemorySearchEnabled (SDK 0.2.1+)
    // Default: true (enabled). Only add to config if explicitly set to false.
    let auto_memory_enabled = auto_memory_search_enabled.unwrap_or(true);
    config["autoMemorySearchEnabled"] = serde_json::Value::Bool(auto_memory_enabled);
    log::info!("[SDK DEBUG] Auto Memory Search enabled: {}", auto_memory_enabled);

    let config_str = config.to_string();

    // Get path to Node.js script using Tauri's resource resolver for production builds
    let script_path = app
        .path()
        .resolve("node-sdk/stream-claude.js", tauri::path::BaseDirectory::Resource)
        .map_err(|e| format!("Failed to resolve node-sdk path: {}", e))?;

    log::info!("[SDK DEBUG] Resolved script path: {:?}", script_path);

    if !script_path.exists() {
        log::error!("[SDK DEBUG] Script not found at path: {:?}", script_path);
        return Err(format!("Node.js SDK script not found at: {:?}", script_path));
    }

    log::info!("[SDK DEBUG] Script found successfully");

    // Get the node-sdk directory (parent of the script) for node_modules resolution
    let node_sdk_dir = script_path.parent()
        .ok_or("Failed to get node-sdk directory".to_string())?;

    // Determine Node.js executable path
    // Strategy:
    // 1. In production mode: Try bundled sidecar first, then fallback to system Node.js
    // 2. In development mode: Use system Node.js directly
    log::info!("[SDK] Looking for Node.js executable...");

    let is_production = !cfg!(debug_assertions);
    let target_arch = if cfg!(target_arch = "aarch64") {
        "aarch64"
    } else if cfg!(target_arch = "x86_64") {
        "x86_64"
    } else {
        "unknown"
    };

    log::info!("[SDK] Mode: {}, Architecture: {}",
        if is_production { "production" } else { "development" },
        target_arch
    );

    let node_path = if is_production {
        // Production mode: Try bundled sidecar first
        // Note: Tauri places sidecar binaries in Contents/MacOS/ with the base name only
        let sidecar_name = "node-sidecar";

        log::info!("[SDK] Looking for sidecar binary: {}", sidecar_name);

        // Strategy 1: Try using app.path().resolve_resource
        // Tauri should automatically find the sidecar in Contents/MacOS/
        let sidecar_path = app.path().resolve(
            sidecar_name,
            tauri::path::BaseDirectory::Resource
        ).ok().or_else(|| {
            // Strategy 2: Manual path construction
            // Try to locate the app bundle and construct the path manually
            if let Ok(exe_path) = std::env::current_exe() {
                // exe_path is: /path/to/Quack.app/Contents/MacOS/Quack
                if let Some(macos_dir) = exe_path.parent() {
                    let manual_path = macos_dir.join(sidecar_name);
                    log::info!("[SDK] Trying manual sidecar path: {:?}", manual_path);
                    if manual_path.exists() {
                        return Some(manual_path);
                    }
                }
            }
            None
        });

        match sidecar_path {
            Some(path) if path.exists() => {
                log::info!("[SDK] ✅ Found bundled Node.js sidecar at: {:?}", path);
                Some(path)
            }
            Some(path) => {
                log::warn!("[SDK] ⚠️ Sidecar path resolved but file does not exist: {:?}", path);
                log::warn!("[SDK] Falling back to system Node.js...");
                find_system_node_executable()
            }
            None => {
                log::warn!("[SDK] ⚠️ Failed to resolve sidecar path");
                log::warn!("[SDK] Falling back to system Node.js...");
                find_system_node_executable()
            }
        }
    } else {
        // Development mode: Use system Node.js directly (faster iteration)
        log::info!("[SDK] Development mode - using system Node.js");
        find_system_node_executable()
    };

    let node_path = node_path
        .ok_or_else(|| {
            log::error!("[SDK] ❌ Node.js executable not found!");
            log::error!("[SDK] Production mode: {}", is_production);
            log::error!("[SDK] Target architecture: {}", target_arch);
            if is_production {
                "Node.js executable not found. The bundled Node.js sidecar could not be located. Please reinstall the application.".to_string()
            } else {
                "Node.js executable not found. Please install Node.js or ensure it's in your PATH.".to_string()
            }
        })?;

    log::info!("[SDK] Using Node.js at: {:?}", node_path);

    // Determine if we're using the bundled sidecar or system Node.js
    let using_sidecar = node_path.to_string_lossy().contains("node-sidecar");

    // Create the command with the resolved Node.js path
    let mut command = Command::new(&node_path);
    command
        .arg(&script_path)
        .arg(&config_str)
        .current_dir(node_sdk_dir)
        .stdin(Stdio::piped())   // Enable stdin for bidirectional communication (AskUserQuestion)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    // ✅ ENVIRONMENT ISOLATION: When using bundled sidecar, remove NVM/Volta variables
    // that could interfere with the bundled Node.js runtime
    if using_sidecar {
        log::info!("[SDK] 🔒 Using bundled sidecar - isolating NVM/Volta environment variables");

        // Remove NVM-specific variables that could cause conflicts
        command.env_remove("NVM_DIR");
        command.env_remove("NVM_BIN");
        command.env_remove("NVM_INC");
        command.env_remove("NVM_CD_FLAGS");
        command.env_remove("NVM_RC_VERSION");

        // Remove Volta-specific variables
        command.env_remove("VOLTA_HOME");

        // Remove Node.js module resolution variables that could interfere
        command.env_remove("NODE_PATH");

        // Set a clean PATH that doesn't include NVM/Volta bin directories
        if let Ok(current_path) = std::env::var("PATH") {
            let clean_path: Vec<&str> = current_path
                .split(':')
                .filter(|p| {
                    !p.contains(".nvm/") &&
                    !p.contains(".volta/") &&
                    !p.contains("nvm/versions/")
                })
                .collect();
            let new_path = clean_path.join(":");
            log::info!("[SDK] 🧹 Cleaned PATH (removed NVM/Volta): {} entries", clean_path.len());
            command.env("PATH", new_path);
        }
    }

    // ✅ Try to read Claude Code credentials and pass to Node.js SDK (optional)
    // The SDK can also use ANTHROPIC_API_KEY from environment if already set
    use crate::claude_auth;

    // Check if ANTHROPIC_API_KEY is already in environment (user-provided)
    let has_env_key = std::env::var("ANTHROPIC_API_KEY").is_ok();

    if has_env_key {
        log::info!("[SDK] ✅ ANTHROPIC_API_KEY found in environment, using it");
        // Pass through existing environment variable
        if let Ok(key) = std::env::var("ANTHROPIC_API_KEY") {
            command.env("ANTHROPIC_API_KEY", key);
        }
    } else {
        // Try to read from Claude Code credentials
        match claude_auth::get_claude_credentials() {
            Ok(Some(credentials)) => {
                log::info!("[SDK] ✅ Found Claude Code credentials (type: {:?})", credentials.auth_type);

                // Only set ANTHROPIC_API_KEY for API key authentication
                // For OAuth, the SDK will read credentials from ~/.claude.json automatically
                match credentials.auth_type {
                    crate::claude_auth::AuthType::ApiKey => {
                        log::info!("[SDK] Setting ANTHROPIC_API_KEY from credentials file");
                        command.env("ANTHROPIC_API_KEY", &credentials.token);
                    }
                    crate::claude_auth::AuthType::OAuth => {
                        log::info!("[SDK] OAuth authentication detected - SDK will use ~/.claude.json automatically");
                        // Don't set ANTHROPIC_API_KEY for OAuth - let SDK handle it
                    }
                }
            }
            Ok(None) => {
                log::warn!("[SDK] ⚠️ No Claude Code credentials found");
                log::warn!("[SDK] SDK will attempt to use default credentials or fail with helpful error");
                // Don't block - let SDK handle it and provide error
            }
            Err(e) => {
                log::warn!("[SDK] ⚠️ Failed to read Claude Code credentials: {}", e);
                log::warn!("[SDK] SDK will attempt to use default credentials or fail with helpful error");
                // Don't block - let SDK handle it
            }
        }
    }

    // Add node directory to PATH for SDK child processes (if using system Node.js)
    if !node_path.to_string_lossy().contains("node-sidecar") {
        if let Some(node_dir) = node_path.parent() {
            let current_path = std::env::var("PATH").unwrap_or_default();
            let node_dir_str = node_dir.to_string_lossy();
            let new_path = if current_path.is_empty() {
                node_dir_str.to_string()
            } else {
                format!("{}:{}", node_dir_str, current_path)
            };
            log::info!("[SDK DEBUG] Setting PATH with node directory: {}", new_path);
            command.env("PATH", new_path);
        }
    }

    log::info!("[SDK DEBUG] Spawning Node.js process with script: {:?}", script_path);
    log::info!("[SDK DEBUG] Working directory: {:?}", node_sdk_dir);

    let mut child = command
        .spawn()
        .map_err(|e| {
            log::error!("[SDK DEBUG] Failed to spawn Node.js process: {}", e);
            format!("Failed to spawn Node.js SDK script: {}", e)
        })?;

    log::info!("[SDK DEBUG] Node.js process spawned successfully");

    // Take stdin for bidirectional communication (AskUserQuestion)
    if let Some(stdin) = child.stdin.take() {
        register_process_stdin(agent_id.clone(), stdin).await;
    }

    // Read stdout for events (in foreground to stream in real-time)
    let stdout = child.stdout.take()
        .ok_or("Failed to capture stdout".to_string())?;
    let mut stdout_reader = BufReader::new(stdout).lines();

    // Capture stderr for error reporting
    let stderr_handle = if let Some(stderr) = child.stderr.take() {
        Some(tokio::spawn(async move {
            let mut stderr_reader = BufReader::new(stderr).lines();
            let mut stderr_lines = Vec::new();
            while let Ok(Some(line)) = stderr_reader.next_line().await {
                log::error!("[Node.js SDK stderr] {}", line);
                stderr_lines.push(line);
            }
            stderr_lines
        }))
    } else {
        None
    };

    // Track final response
    let mut final_result: Option<ClaudeCliResponse> = None;

    // Stream stdout events in real-time (foreground task)
    while let Ok(Some(line)) = stdout_reader.next_line().await {
        // Parse JSON event
        match serde_json::from_str::<ClaudeEvent>(&line) {
            Ok(event) => {
                // Log event type for debugging
                match &event {
                    ClaudeEvent::System { session_id, .. } => {
                        // 🦆 SESSIONS-FIRST: Log session ID, but DON'T store in global state
                        // The frontend stores claudeSessionId in each AgentSession
                        log::info!("[SDK] 🦆 Claude session ID: {} (frontend will store in AgentSession)", session_id);
                        // DEPRECATED: session_state.set_session(agent_id.clone(), session_id.clone());
                    }
                    ClaudeEvent::Assistant { message, .. } => {
                        // Log content blocks for debugging Task tool detection
                        log::info!("[SDK] 📝 Assistant event with {} content blocks", message.content.len());
                        for (idx, block) in message.content.iter().enumerate() {
                            match block {
                                ContentBlock::Text { text } => {
                                    log::info!("[SDK]   Block {}: Text ({}...)", idx, &text[..std::cmp::min(50, text.len())]);
                                }
                                ContentBlock::ToolUse { name, input, .. } => {
                                    // Check for Task tool specifically
                                    if name.to_lowercase() == "task" {
                                        log::info!("[SDK]   Block {}: 🎯 Task TOOL_USE - subagent: {:?}", idx, input.get("subagent_type"));
                                    } else {
                                        log::info!("[SDK]   Block {}: ToolUse({})", idx, name);
                                    }
                                }
                                ContentBlock::Thinking { thinking } => {
                                    log::info!("[SDK]   Block {}: Thinking ({}...)", idx, &thinking[..std::cmp::min(50, thinking.len())]);
                                }
                                ContentBlock::Other(val) => {
                                    log::info!("[SDK]   Block {}: Other - type={:?}", idx, val.get("type"));
                                }
                            }
                        }
                    }
                    ClaudeEvent::Agent { action, agent_name, agent_type, .. } => {
                        log::info!("[SDK] 🤖 Agent event: action={:?}, name={:?}, type={:?}",
                            action, agent_name, agent_type);
                    }
                    ClaudeEvent::Complete { .. } => {
                        log::info!("[SDK] ✅ Stream complete event received");
                    }
                    ClaudeEvent::KanbanEvent { event_type, payload, timestamp } => {
                        log::info!("[SDK] 📋 Kanban event: type={}, timestamp={}", event_type, timestamp);
                        // Emit kanban-specific event to frontend for real-time UI updates
                        let kanban_event_name = "kanban:update".to_string();
                        match app.emit(&kanban_event_name, serde_json::json!({
                            "eventType": event_type,
                            "payload": payload,
                            "timestamp": timestamp,
                            "agentId": agent_id
                        })) {
                            Ok(_) => {
                                log::info!("[SDK] 📋 Emitted kanban:update event to frontend");
                            }
                            Err(e) => {
                                log::error!("[SDK] ❌ Failed to emit kanban event: {:?}", e);
                            }
                        }
                    }
                    ClaudeEvent::AskUserQuestion { request_id, questions } => {
                        log::info!("[SDK] 🗣️ AskUserQuestion event: requestId={}, {} questions", request_id, questions.len());
                        // Emit ask_user_question event to frontend
                        let ask_event_name = format!("ask-user-question:{}", agent_id);
                        match app.emit(&ask_event_name, serde_json::json!({
                            "requestId": request_id,
                            "questions": questions,
                            "agentId": agent_id
                        })) {
                            Ok(_) => {
                                log::info!("[SDK] 🗣️ Emitted ask-user-question event to frontend");
                            }
                            Err(e) => {
                                log::error!("[SDK] ❌ Failed to emit ask-user-question event: {:?}", e);
                            }
                        }
                    }
                    _ => {}
                }

                // Emit event to frontend immediately
                let event_name = format!("claude-event:{}", agent_id);

                // Debug: Log before emitting to verify Task events are sent
                if let ClaudeEvent::Assistant { message, .. } = &event {
                    for block in &message.content {
                        if let ContentBlock::ToolUse { name, .. } = block {
                            if name.to_lowercase() == "task" {
                                log::info!("[SDK] 🚀 EMITTING Task tool event to frontend: {}", event_name);
                            }
                        }
                    }
                }

                // 🦆 SESSION-FIRST: Wrap event with session_key for proper routing
                let wrapped_event = serde_json::json!({
                    "sessionKey": event_session_key,
                    "event": &event
                });

                match app.emit(&event_name, &wrapped_event) {
                    Ok(_) => {}
                    Err(e) => {
                        log::error!("[SDK] ❌ EMIT FAILED: {:?}", e);
                    }
                }

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
            Err(e) => {
                // Try to parse as raw JSON to forward unknown events
                if let Ok(raw_value) = serde_json::from_str::<serde_json::Value>(&line) {
                    log::warn!("[SDK] ⚠️ Unknown event type, forwarding raw: {:?}", raw_value.get("type"));
                    // 🦆 SESSION-FIRST: Wrap raw event with session_key
                    let wrapped_event = serde_json::json!({
                        "sessionKey": event_session_key,
                        "event": &raw_value
                    });
                    let event_name = format!("claude-event:{}", agent_id);
                    let _ = app.emit(&event_name, &wrapped_event);
                } else {
                    log::error!("[SDK] ❌ Failed to parse event: {} - Line: {}", e, &line[..std::cmp::min(200, line.len())]);
                }
            }
        }
    }

    // Wait for process to complete
    let status = child.wait().await
        .map_err(|e| format!("Failed to wait for Node.js process: {}", e))?;

    // Cleanup: unregister the process stdin
    unregister_process(&agent_id).await;

    // Collect stderr if available
    let stderr_output = if let Some(handle) = stderr_handle {
        handle.await.unwrap_or_default()
    } else {
        Vec::new()
    };

    if !status.success() {
        let stderr_text = if !stderr_output.is_empty() {
            format!("\n\nStderr output:\n{}", stderr_output.join("\n"))
        } else {
            String::new()
        };

        return Err(format!(
            "Node.js SDK script failed with status: {}{}",
            status,
            stderr_text
        ));
    }

    // Return final response
    final_result.ok_or_else(|| {
        "No result event found in Node.js SDK output".to_string()
    })
}

/// Send a tool result back to the Claude SDK for interactive tools like AskUserQuestion
/// This creates a new SDK call with the tool result to continue the conversation
#[tauri::command]
pub async fn send_tool_result_to_sdk(
    app: AppHandle,
    session_id: String,
    tool_use_id: String,
    result: String,
    working_directory: Option<String>,
) -> Result<(), String> {
    log::info!("[SDK] 🗣️ Sending tool result for tool_use_id: {}", tool_use_id);

    // Get the Node.js script path
    let script_path = get_sdk_script_path(&app)?;

    // Build the tool result config
    let config = serde_json::json!({
        "toolResult": {
            "type": "tool_result",
            "tool_use_id": tool_use_id,
            "content": result,
        },
        "sessionId": session_id,
        "cwd": working_directory,
    });

    let config_json = serde_json::to_string(&config)
        .map_err(|e| format!("Failed to serialize tool result config: {}", e))?;

    log::info!("[SDK] 🗣️ Tool result config: {}", config_json);

    // Spawn Node.js process to send the tool result
    let mut command = Command::new("node");
    command
        .arg(&script_path)
        .arg("--tool-result")
        .arg(&config_json)
        .current_dir(working_directory.as_deref().unwrap_or("."))
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let child = command.spawn()
        .map_err(|e| format!("Failed to spawn Node.js for tool result: {}", e))?;

    let output = child.wait_with_output().await
        .map_err(|e| format!("Failed to wait for tool result process: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        log::error!("[SDK] Tool result failed: {}", stderr);
        return Err(format!("Tool result failed: {}", stderr));
    }

    log::info!("[SDK] 🗣️ Tool result sent successfully");
    Ok(())
}

/// Send answers to an AskUserQuestion request via stdin to the active SDK process
/// This uses the bidirectional communication system to respond to the Node.js process
#[tauri::command]
pub async fn answer_user_question(
    agent_id: String,
    request_id: String,
    answers: serde_json::Value,
) -> Result<(), String> {
    log::info!("[SDK] 🗣️ Answering user question for agent: {}, requestId: {}", agent_id, request_id);
    log::info!("[SDK] 🗣️ Answers: {:?}", answers);

    // Build the response message
    let response = serde_json::json!({
        "requestId": request_id,
        "answers": answers,
    });

    let message = serde_json::to_string(&response)
        .map_err(|e| format!("Failed to serialize answer: {}", e))?;

    // Send to the active process via stdin
    send_to_process(&agent_id, &message).await?;

    log::info!("[SDK] 🗣️ Answer sent successfully");
    Ok(())
}

/// Helper to get the SDK script path
fn get_sdk_script_path(app: &AppHandle) -> Result<PathBuf, String> {
    // Try to find the bundled script first
    let resource_path = app.path().resource_dir()
        .map_err(|e| format!("Failed to get resource dir: {}", e))?;

    let script_path = resource_path.join("node-sdk").join("stream-claude.js");
    if script_path.exists() {
        return Ok(script_path);
    }

    // Fallback to development path
    let dev_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("node-sdk")
        .join("stream-claude.js");

    if dev_path.exists() {
        return Ok(dev_path);
    }

    Err("Could not find stream-claude.js script".to_string())
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
