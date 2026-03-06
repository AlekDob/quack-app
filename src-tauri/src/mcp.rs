use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};
use tokio::process::{Child, Command};
use tokio::io::{AsyncBufReadExt, BufReader};

/// Global state for managing active MCP server processes
pub struct MCPProcessManager {
    processes: Mutex<HashMap<String, Child>>,
}

impl MCPProcessManager {
    pub fn new() -> Self {
        Self {
            processes: Mutex::new(HashMap::new()),
        }
    }

    pub fn store_process(&self, server_id: String, child: Child) {
        if let Ok(mut processes) = self.processes.lock() {
            processes.insert(server_id, child);
        }
    }

    pub async fn kill_process(&self, server_id: &str) -> Result<(), String> {
        // Extract child from mutex and immediately drop the lock
        let mut child = {
            let mut processes = self.processes.lock()
                .map_err(|_| "Failed to lock process manager".to_string())?;
            processes.remove(server_id)
        }; // Lock is dropped here

        // Now we can safely await without holding the lock
        if let Some(child) = child.as_mut() {
            child.kill().await
                .map_err(|e| format!("Failed to kill process: {}", e))?;
        }
        Ok(())
    }

    pub fn is_running(&self, server_id: &str) -> bool {
        if let Ok(processes) = self.processes.lock() {
            processes.contains_key(server_id)
        } else {
            false
        }
    }
}

/// MCP Server configuration with support for multiple transport types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum MCPServerConfig {
    /// Standard input/output transport (command-line based)
    Stdio {
        command: String,
        args: Vec<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        env: Option<HashMap<String, String>>,
    },
    /// HTTP transport (REST API based)
    Http {
        url: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        headers: Option<HashMap<String, String>>,
        #[serde(skip_serializing_if = "Option::is_none")]
        method: Option<String>, // Default: "POST"
        #[serde(skip_serializing_if = "Option::is_none")]
        env: Option<HashMap<String, String>>,
    },
    /// Server-Sent Events transport (event streaming)
    Sse {
        url: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        headers: Option<HashMap<String, String>>,
        #[serde(skip_serializing_if = "Option::is_none")]
        env: Option<HashMap<String, String>>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MCPConfigFile {
    #[serde(rename = "mcpServers")]
    pub mcp_servers: HashMap<String, MCPServerConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MCPServer {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub server_type: String,
    pub transport: String, // "stdio" | "http" | "sse"

    // Stdio fields
    #[serde(skip_serializing_if = "Option::is_none")]
    pub command: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub args: Option<Vec<String>>,

    // HTTP/SSE fields
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub headers: Option<HashMap<String, String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub method: Option<String>,

    // Common fields
    #[serde(skip_serializing_if = "Option::is_none")]
    pub env: Option<HashMap<String, String>>,
    pub enabled: bool,
    pub status: String, // "stopped" | "starting" | "running" | "error"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    pub scope: String, // "global" | "project" - indicates where the MCP is configured
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MCPTemplate {
    pub id: String,
    pub name: String,
    pub description: String,
    #[serde(rename = "type")]
    pub template_type: String,
    pub icon: String,
    pub config: MCPServerConfig,
}

/// Normalize Windows extended paths (remove \\?\ prefix)
fn normalize_path(path: &str) -> String {
    if path.starts_with(r"\\?\") {
        path[4..].to_string()
    } else {
        path.to_string()
    }
}

/// Get the path to .mcp.json file in the project root
fn get_mcp_config_path(_app: &AppHandle, working_dir: Option<String>) -> Result<PathBuf, String> {
    let base_path = if let Some(dir) = working_dir {
        // Use provided working directory if not empty
        if !dir.is_empty() {
            // Normalize path to remove \\?\ prefix on Windows
            PathBuf::from(normalize_path(&dir))
        } else {
            // If empty string, use current working directory (project root)
            std::env::current_dir()
                .map_err(|e| format!("Failed to get current directory: {}", e))?
        }
    } else {
        // If no working_dir provided, use current working directory
        // This ensures we read from the project root when the app starts
        std::env::current_dir()
            .map_err(|e| format!("Failed to get current directory: {}", e))?
    };

    log::info!("🔍 Looking for .mcp.json at: {}", base_path.display());
    Ok(base_path.join(".mcp.json"))
}

/// Get the path to global MCP config (~/.claude.json)
fn get_global_mcp_config_path() -> Result<PathBuf, String> {
    // On Windows, use USERPROFILE; on Unix, use HOME
    let home_dir = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .map_err(|_| "Failed to get home directory (neither USERPROFILE nor HOME set)".to_string())?;
    Ok(PathBuf::from(home_dir).join(".claude.json"))
}

/// Get the path to global ~/.mcp.json (user-level MCP servers)
fn get_global_mcp_json_path() -> Result<PathBuf, String> {
    let home_dir = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .map_err(|_| "Failed to get home directory (neither USERPROFILE nor HOME set)".to_string())?;
    Ok(PathBuf::from(home_dir).join(".mcp.json"))
}

/// Get the path to ~/.claude/.mcp.json (Claude Code CLI global MCP servers)
fn get_claude_dir_mcp_json_path() -> Result<PathBuf, String> {
    let home_dir = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .map_err(|_| "Failed to get home directory (neither USERPROFILE nor HOME set)".to_string())?;
    Ok(PathBuf::from(home_dir).join(".claude").join(".mcp.json"))
}

/// Structure for reading ~/.claude.json which has a different format
#[derive(Debug, Clone, Serialize, Deserialize)]
struct ClaudeConfig {
    #[serde(default)]
    projects: HashMap<String, ProjectConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ProjectConfig {
    #[serde(rename = "mcpServers", default)]
    mcp_servers: HashMap<String, MCPServerConfig>,
}

/// Read MCP servers from ~/.claude.json for a specific project path
fn read_global_mcp_config(working_dir: Option<&String>) -> Result<MCPConfigFile, String> {
    let global_path = get_global_mcp_config_path()?;

    log::info!("🌍 [MCP DEBUG] Checking global config at: {}", global_path.display());

    if !global_path.exists() {
        log::warn!("⚠️ [MCP DEBUG] ~/.claude.json NOT FOUND");
        return Ok(MCPConfigFile {
            mcp_servers: HashMap::new(),
        });
    }

    log::info!("✅ [MCP DEBUG] ~/.claude.json exists");
    let content = fs::read_to_string(&global_path)
        .map_err(|e| format!("Failed to read ~/.claude.json: {}", e))?;

    let claude_config: ClaudeConfig = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse ~/.claude.json: {}", e))?;

    log::info!("📦 [MCP DEBUG] ~/.claude.json has {} project entries", claude_config.projects.len());

    // If we have a working_dir, try to get project-specific MCP servers
    if let Some(dir) = working_dir {
        log::info!("🔍 [MCP DEBUG] Looking for project-specific MCP servers for: {}", dir);

        // Normalize path (resolve to absolute path)
        let normalized_path = std::fs::canonicalize(dir)
            .ok()
            .and_then(|p| p.to_str().map(String::from))
            .unwrap_or_else(|| dir.clone());

        log::info!("🔍 [MCP DEBUG] Normalized path: {}", normalized_path);

        if let Some(project_config) = claude_config.projects.get(&normalized_path) {
            log::info!("✅ [MCP DEBUG] Found project config with {} MCP servers", project_config.mcp_servers.len());
            for (server_id, _) in &project_config.mcp_servers {
                log::info!("  - {}", server_id);
            }
            return Ok(MCPConfigFile {
                mcp_servers: project_config.mcp_servers.clone(),
            });
        } else {
            log::warn!("⚠️ [MCP DEBUG] No project config found for path: {}", normalized_path);
            log::info!("📋 [MCP DEBUG] Available project paths in ~/.claude.json:");
            for project_path in claude_config.projects.keys() {
                log::info!("  - {}", project_path);
            }
        }
    } else {
        log::info!("ℹ️ [MCP DEBUG] No working_dir provided, skipping global config");
    }

    // No project-specific config found, return empty
    Ok(MCPConfigFile {
        mcp_servers: HashMap::new(),
    })
}

/// Flexible MCP server config for parsing .mcp.json (type field is optional, defaults to stdio)
#[derive(Debug, Clone, Deserialize)]
struct FlexibleMCPServerConfig {
    #[serde(rename = "type", default)]
    server_type: Option<String>,
    command: Option<String>,
    args: Option<Vec<String>>,
    url: Option<String>,
    headers: Option<HashMap<String, String>>,
    method: Option<String>,
    env: Option<HashMap<String, String>>,
}

#[derive(Debug, Clone, Deserialize)]
struct FlexibleMCPConfigFile {
    #[serde(rename = "mcpServers")]
    mcp_servers: HashMap<String, FlexibleMCPServerConfig>,
}

/// Read and parse .mcp.json file (with flexible type detection)
fn read_mcp_config(path: &PathBuf) -> Result<MCPConfigFile, String> {
    log::info!("📂 [MCP DEBUG] Attempting to read MCP config from: {}", path.display());

    if !path.exists() {
        log::warn!("⚠️ [MCP DEBUG] .mcp.json NOT FOUND at: {}", path.display());
        return Ok(MCPConfigFile {
            mcp_servers: HashMap::new(),
        });
    }

    log::info!("✅ [MCP DEBUG] .mcp.json exists at: {}", path.display());
    let content = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read .mcp.json: {}", e))?;

    log::info!("📄 [MCP DEBUG] File content length: {} bytes", content.len());

    // Parse with flexible structure first
    let flexible_config: FlexibleMCPConfigFile = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse .mcp.json: {}", e))?;

    // Convert to proper MCPConfigFile with type inference
    let mut mcp_servers = HashMap::new();

    for (id, flex_config) in flexible_config.mcp_servers {
        let server_type = flex_config.server_type.as_deref().unwrap_or("stdio");

        let config = match server_type {
            "http" => {
                let url = flex_config.url.ok_or_else(|| format!("Server '{}': URL required for HTTP transport", id))?;
                MCPServerConfig::Http {
                    url,
                    headers: flex_config.headers,
                    method: flex_config.method,
                    env: flex_config.env,
                }
            }
            "sse" => {
                let url = flex_config.url.ok_or_else(|| format!("Server '{}': URL required for SSE transport", id))?;
                MCPServerConfig::Sse {
                    url,
                    headers: flex_config.headers,
                    env: flex_config.env,
                }
            }
            _ => {
                // Default to stdio (most common)
                let command = flex_config.command.ok_or_else(|| format!("Server '{}': command required for stdio transport", id))?;
                let args = flex_config.args.unwrap_or_default();
                MCPServerConfig::Stdio {
                    command,
                    args,
                    env: flex_config.env,
                }
            }
        };

        log::info!("  - {} (type: {})", id, server_type);
        mcp_servers.insert(id, config);
    }

    log::info!("🎯 [MCP DEBUG] Loaded {} MCP servers from .mcp.json", mcp_servers.len());
    Ok(MCPConfigFile { mcp_servers })
}

/// Write MCP config to .mcp.json file
fn write_mcp_config(path: &PathBuf, config: &MCPConfigFile) -> Result<(), String> {
    let content = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize MCP config: {}", e))?;

    fs::write(path, content)
        .map_err(|e| format!("Failed to write .mcp.json: {}", e))
}

/// Write MCP servers to ~/.claude.json for a specific project
fn write_global_mcp_config(
    working_dir: &str,
    mcp_servers: HashMap<String, MCPServerConfig>,
) -> Result<(), String> {
    let global_path = get_global_mcp_config_path()?;

    log::info!("🌍 [MCP WRITE] Writing to ~/.claude.json for project: {}", working_dir);

    // Read existing config or create new one
    let mut claude_config: ClaudeConfig = if global_path.exists() {
        let content = fs::read_to_string(&global_path)
            .map_err(|e| format!("Failed to read ~/.claude.json: {}", e))?;
        serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse ~/.claude.json: {}", e))?
    } else {
        log::info!("📝 [MCP WRITE] ~/.claude.json doesn't exist, creating new one");
        ClaudeConfig {
            projects: HashMap::new(),
        }
    };

    // Normalize the working directory path
    let normalized_path = std::fs::canonicalize(working_dir)
        .ok()
        .and_then(|p| p.to_str().map(String::from))
        .unwrap_or_else(|| working_dir.to_string());

    log::info!("📍 [MCP WRITE] Normalized path: {}", normalized_path);

    // Create or update project entry
    let project_config = ProjectConfig {
        mcp_servers,
    };

    claude_config.projects.insert(normalized_path.clone(), project_config);

    // Write back to file
    let content = serde_json::to_string_pretty(&claude_config)
        .map_err(|e| format!("Failed to serialize ~/.claude.json: {}", e))?;

    fs::write(&global_path, content)
        .map_err(|e| format!("Failed to write ~/.claude.json: {}", e))?;

    log::info!("✅ [MCP WRITE] Successfully wrote to ~/.claude.json");
    Ok(())
}

/// Convert MCPConfigFile to list of MCPServer with specified scope
fn config_to_servers(config: MCPConfigFile, scope: &str) -> Vec<MCPServer> {
    config
        .mcp_servers
        .into_iter()
        .map(|(id, server_config)| {
            match server_config {
                MCPServerConfig::Stdio { command, args, env } => {
                    let server_type = infer_server_type(&id, &command);
                    MCPServer {
                        id: id.clone(),
                        name: id,
                        server_type,
                        transport: "stdio".to_string(),
                        command: Some(command),
                        args: Some(args),
                        url: None,
                        headers: None,
                        method: None,
                        env,
                        enabled: true,
                        status: "stopped".to_string(),
                        error: None,
                        scope: scope.to_string(),
                    }
                }
                MCPServerConfig::Http { url, headers, method, env } => {
                    let server_type = infer_server_type(&id, &url);
                    MCPServer {
                        id: id.clone(),
                        name: id,
                        server_type,
                        transport: "http".to_string(),
                        command: None,
                        args: None,
                        url: Some(url),
                        headers,
                        method,
                        env,
                        enabled: true,
                        status: "stopped".to_string(),
                        error: None,
                        scope: scope.to_string(),
                    }
                }
                MCPServerConfig::Sse { url, headers, env } => {
                    let server_type = infer_server_type(&id, &url);
                    MCPServer {
                        id: id.clone(),
                        name: id,
                        server_type,
                        transport: "sse".to_string(),
                        command: None,
                        args: None,
                        url: Some(url),
                        headers,
                        method: None,
                        env,
                        enabled: true,
                        status: "stopped".to_string(),
                        error: None,
                        scope: scope.to_string(),
                    }
                }
            }
        })
        .collect()
}

/// Infer server type from ID and command
fn infer_server_type(id: &str, command: &str) -> String {
    let id_lower = id.to_lowercase();
    let command_lower = command.to_lowercase();

    if id_lower.contains("github") || command_lower.contains("github") {
        "github".to_string()
    } else if id_lower.contains("slack") || command_lower.contains("slack") {
        "slack".to_string()
    } else if id_lower.contains("filesystem") || id_lower.contains("fs") || command_lower.contains("filesystem") {
        "filesystem".to_string()
    } else if id_lower.contains("database") || id_lower.contains("db") || id_lower.contains("postgres") || id_lower.contains("sqlite") {
        "database".to_string()
    } else if id_lower.contains("puppeteer") || command_lower.contains("puppeteer") {
        "puppeteer".to_string()
    } else if id_lower.contains("playwright") || command_lower.contains("playwright") {
        "playwright".to_string()
    } else {
        "custom".to_string()
    }
}

/// Start an MCP server process (stdio transport only)
async fn start_mcp_server(
    app: &AppHandle,
    server: &mut MCPServer,
) -> Result<(), String> {
    // Only stdio servers need to be started
    if server.transport != "stdio" {
        server.status = "running".to_string(); // HTTP/SSE servers are always "running"
        return Ok(());
    }

    let command = server.command.as_ref()
        .ok_or("Command required for stdio transport")?;
    let args = server.args.as_ref()
        .ok_or("Args required for stdio transport")?;

    // Spawn the MCP server process
    // On Windows, use cmd /c to run npx/node commands to ensure PATH is resolved
    #[cfg(target_os = "windows")]
    let (actual_command, actual_args) = {
        if command == "npx" || command == "node" || command == "npm" {
            // Use cmd /c to run the command, which properly resolves .cmd files
            let mut cmd_args = vec!["/c".to_string(), command.clone()];
            cmd_args.extend(args.iter().cloned());
            ("cmd".to_string(), cmd_args)
        } else {
            (command.clone(), args.clone())
        }
    };

    #[cfg(not(target_os = "windows"))]
    let (actual_command, actual_args) = (command.clone(), args.clone());

    let mut cmd = Command::new(&actual_command);
    cmd.args(&actual_args)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());

    // Brain: gotcha-shell-env-gui-launch
    // Inject login shell environment so MCP servers can find node, npx, etc.
    // when Quack is launched from Finder (GUI) instead of terminal.
    for (key, value) in crate::shell_env::get_login_env() {
        cmd.env(key, value);
    }

    // Add server-specific environment variables (overrides login env)
    if let Some(env) = &server.env {
        for (key, value) in env {
            cmd.env(key, value);
        }
    }

    // Windows: Hide console window
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = cmd.spawn()
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                format!("Command '{}' not found. Make sure it's installed and in PATH.", command)
            } else {
                format!("Failed to spawn MCP server: {}", e)
            }
        })?;

    // Capture stderr for logging
    if let Some(stderr) = child.stderr.take() {
        let server_id = server.id.clone();
        let app_handle = app.clone();
        tauri::async_runtime::spawn(async move {
            let reader = BufReader::new(stderr);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                log::debug!("MCP[{}] stderr: {}", server_id, line);
                // Emit to frontend for debugging
                let _ = app_handle.emit("mcp-server-log", (server_id.clone(), line));
            }
            log::info!("MCP[{}] stderr reader task ended", server_id);
        });
    }

    // Store the process in the global manager
    let process_manager: tauri::State<MCPProcessManager> = app.state();
    process_manager.store_process(server.id.clone(), child);

    server.status = "running".to_string();
    server.error = None;

    log::info!("🔌 MCP server '{}' started successfully", server.id);
    Ok(())
}

/// List all MCP servers from both .mcp.json (project) and ~/.claude.json (global)
/// Automatically starts enabled stdio servers
#[tauri::command]
pub async fn list_mcp_servers(
    app: AppHandle,
    working_dir: Option<String>,
) -> Result<Vec<MCPServer>, String> {
    log::info!("🦆 [MCP DEBUG] ========================================");
    log::info!("🦆 [MCP DEBUG] list_mcp_servers called with working_dir: {:?}", working_dir);
    log::info!("🦆 [MCP DEBUG] ========================================");

    let mut all_servers = Vec::new();

    // 1. First, read from .mcp.json in the project directory (highest priority)
    log::info!("📖 [MCP DEBUG] Step 1: Reading from .mcp.json in project directory");
    if let Some(ref dir) = working_dir {
        let mcp_json_path = get_mcp_config_path(&app, Some(dir.clone()))?;
        if let Ok(project_config) = read_mcp_config(&mcp_json_path) {
            let servers = config_to_servers(project_config, "project");
            log::info!("✅ [MCP DEBUG] Loaded {} servers from .mcp.json", servers.len());
            all_servers.extend(servers);
        } else {
            log::warn!("⚠️ [MCP DEBUG] Failed to read .mcp.json");
        }
    }

    // 2. Then, read from ~/.claude.json (for servers not in .mcp.json)
    log::info!("📖 [MCP DEBUG] Step 2: Reading from ~/.claude.json");
    if let Ok(global_config) = read_global_mcp_config(working_dir.as_ref()) {
        let global_servers = config_to_servers(global_config, "global");
        log::info!("✅ [MCP DEBUG] Loaded {} servers from ~/.claude.json", global_servers.len());

        // Only add servers that aren't already loaded from .mcp.json
        for server in global_servers {
            if !all_servers.iter().any(|s| s.id == server.id) {
                all_servers.push(server);
            } else {
                log::info!("ℹ️ [MCP DEBUG] Skipping '{}' from ~/.claude.json (already in .mcp.json)", server.id);
            }
        }
    } else {
        log::warn!("⚠️ [MCP DEBUG] Failed to read ~/.claude.json");
    }

    // 3. Also read from ~/.mcp.json (user-level global MCP servers)
    log::info!("📖 [MCP DEBUG] Step 3: Reading from ~/.mcp.json (user-level global)");
    if let Ok(global_mcp_json_path) = get_global_mcp_json_path() {
        if let Ok(user_config) = read_mcp_config(&global_mcp_json_path) {
            let user_servers = config_to_servers(user_config, "global");
            log::info!("✅ [MCP DEBUG] Loaded {} servers from ~/.mcp.json", user_servers.len());

            // Only add servers that aren't already loaded
            for server in user_servers {
                if !all_servers.iter().any(|s| s.id == server.id) {
                    all_servers.push(server);
                } else {
                    log::info!("ℹ️ [MCP DEBUG] Skipping '{}' from ~/.mcp.json (already loaded)", server.id);
                }
            }
        } else {
            log::warn!("⚠️ [MCP DEBUG] Failed to read ~/.mcp.json");
        }
    }

    // 4. Also read from ~/.claude/.mcp.json (Claude Code CLI global MCP servers)
    log::info!("📖 [MCP DEBUG] Step 4: Reading from ~/.claude/.mcp.json (Claude Code CLI)");
    if let Ok(claude_dir_mcp_path) = get_claude_dir_mcp_json_path() {
        if let Ok(claude_dir_config) = read_mcp_config(&claude_dir_mcp_path) {
            let claude_dir_servers = config_to_servers(claude_dir_config, "global");
            log::info!("✅ [MCP DEBUG] Loaded {} servers from ~/.claude/.mcp.json", claude_dir_servers.len());

            for server in claude_dir_servers {
                if !all_servers.iter().any(|s| s.id == server.id) {
                    all_servers.push(server);
                } else {
                    log::info!("ℹ️ [MCP DEBUG] Skipping '{}' from ~/.claude/.mcp.json (already loaded)", server.id);
                }
            }
        } else {
            log::warn!("⚠️ [MCP DEBUG] Failed to read ~/.claude/.mcp.json");
        }
    }

    log::info!("📊 [MCP DEBUG] Total servers: {}", all_servers.len());
    for server in &all_servers {
        log::info!("  - {} (scope: {}, transport: {}, enabled: {})", server.id, server.scope, server.transport, server.enabled);
    }

    // Auto-start enabled stdio servers
    log::info!("🚀 [MCP DEBUG] Step 4: Auto-starting enabled stdio servers");
    let process_manager: tauri::State<MCPProcessManager> = app.state();
    for server in &mut all_servers {
        if server.enabled && server.transport == "stdio" {
            // Check if already running
            if process_manager.is_running(&server.id) {
                server.status = "running".to_string();
                log::info!("✅ [MCP DEBUG] Server '{}' already running", server.id);
            } else {
                // Try to start the server
                log::info!("🔄 [MCP DEBUG] Starting server '{}'", server.id);
                if let Err(e) = start_mcp_server(&app, server).await {
                    log::error!("❌ [MCP DEBUG] Failed to start MCP server '{}': {}", server.id, e);
                    server.status = "error".to_string();
                    server.error = Some(e);
                } else {
                    log::info!("✅ [MCP DEBUG] Server '{}' started successfully", server.id);
                }
            }
        } else if server.transport == "http" || server.transport == "sse" {
            // HTTP/SSE servers are always "running" if configured
            server.status = if server.enabled { "running".to_string() } else { "stopped".to_string() };
            log::info!("ℹ️ [MCP DEBUG] Server '{}' is {} (HTTP/SSE)", server.id, server.status);
        }
    }

    log::info!("🎉 [MCP DEBUG] Returning {} total servers to frontend", all_servers.len());
    log::info!("🦆 [MCP DEBUG] ========================================");

    Ok(all_servers)
}

/// Get a single MCP server by ID (searches both global and project configs)
#[tauri::command]
pub async fn get_mcp_server(
    _app: AppHandle,
    server_id: String,
    working_dir: Option<String>,
) -> Result<Option<MCPServer>, String> {
    // Helper to convert config to MCPServer
    let config_to_server = |id: String, config: &MCPServerConfig, scope: &str| -> MCPServer {
        match config {
            MCPServerConfig::Stdio { command, args, env } => {
                let server_type = infer_server_type(&id, command);
                MCPServer {
                    id: id.clone(),
                    name: id,
                    server_type,
                    transport: "stdio".to_string(),
                    command: Some(command.clone()),
                    args: Some(args.clone()),
                    url: None,
                    headers: None,
                    method: None,
                    env: env.clone(),
                    enabled: true,
                    status: "stopped".to_string(),
                    error: None,
                    scope: scope.to_string(),
                }
            }
            MCPServerConfig::Http { url, headers, method, env } => {
                let server_type = infer_server_type(&id, url);
                MCPServer {
                    id: id.clone(),
                    name: id,
                    server_type,
                    transport: "http".to_string(),
                    command: None,
                    args: None,
                    url: Some(url.clone()),
                    headers: headers.clone(),
                    method: method.clone(),
                    env: env.clone(),
                    enabled: true,
                    status: "stopped".to_string(),
                    error: None,
                    scope: scope.to_string(),
                }
            }
            MCPServerConfig::Sse { url, headers, env } => {
                let server_type = infer_server_type(&id, url);
                MCPServer {
                    id: id.clone(),
                    name: id,
                    server_type,
                    transport: "sse".to_string(),
                    command: None,
                    args: None,
                    url: Some(url.clone()),
                    headers: headers.clone(),
                    method: None,
                    env: env.clone(),
                    enabled: true,
                    status: "stopped".to_string(),
                    error: None,
                    scope: scope.to_string(),
                }
            }
        }
    };

    // Check ONLY ~/.claude.json
    if let Ok(global_config) = read_global_mcp_config(working_dir.as_ref()) {
        if let Some(server_config) = global_config.mcp_servers.get(&server_id) {
            return Ok(Some(config_to_server(server_id, server_config, "project")));
        }
    }

    Ok(None)
}

/// Save or update an MCP server to .mcp.json (project) or ~/.claude.json (global)
#[tauri::command]
pub async fn save_mcp_server(
    app: AppHandle,
    server: MCPServer,
    working_dir: Option<String>,
) -> Result<(), String> {
    log::info!("💾 [MCP SAVE] Saving MCP server '{}' (scope: {})", server.id, server.scope);

    // Create server config from MCPServer
    let server_config = match server.transport.as_str() {
        "stdio" => MCPServerConfig::Stdio {
            command: server.command.clone().ok_or("Command required for stdio transport")?,
            args: server.args.clone().ok_or("Args required for stdio transport")?,
            env: server.env.clone(),
        },
        "http" => MCPServerConfig::Http {
            url: server.url.clone().ok_or("URL required for HTTP transport")?,
            headers: server.headers.clone(),
            method: server.method.clone(),
            env: server.env.clone(),
        },
        "sse" => MCPServerConfig::Sse {
            url: server.url.clone().ok_or("URL required for SSE transport")?,
            headers: server.headers.clone(),
            env: server.env.clone(),
        },
        _ => return Err(format!("Unknown transport type: {}", server.transport)),
    };

    // Determine where to save based on scope (default to project)
    let scope = if server.scope.is_empty() { "project" } else { &server.scope };

    if scope == "project" {
        // Save to .mcp.json in project directory
        let mcp_json_path = get_mcp_config_path(&app, working_dir.clone())?;
        log::info!("💾 [MCP SAVE] Writing to .mcp.json at: {}", mcp_json_path.display());

        // Read existing config or create new one
        let mut existing_config = read_mcp_config(&mcp_json_path)?;

        // Insert or update the server
        existing_config.mcp_servers.insert(server.id.clone(), server_config);

        // Write back to .mcp.json
        write_mcp_config(&mcp_json_path, &existing_config)?;

        log::info!("✅ [MCP SAVE] Successfully saved MCP server '{}' to .mcp.json", server.id);
    } else {
        // Save to ~/.mcp.json (global scope)
        let global_mcp_json_path = get_global_mcp_json_path()?;
        log::info!("💾 [MCP SAVE] Writing to ~/.mcp.json at: {}", global_mcp_json_path.display());

        // Read existing config or create new one
        let mut existing_config = if global_mcp_json_path.exists() {
            read_mcp_config(&global_mcp_json_path)?
        } else {
            MCPConfigFile {
                mcp_servers: HashMap::new(),
            }
        };

        // Insert or update the server
        existing_config.mcp_servers.insert(server.id.clone(), server_config);

        // Write back to ~/.mcp.json
        write_mcp_config(&global_mcp_json_path, &existing_config)?;

        log::info!("✅ [MCP SAVE] Successfully saved MCP server '{}' to ~/.mcp.json", server.id);
    }

    Ok(())
}

/// Delete an MCP server from .mcp.json (project) or ~/.claude.json (global)
/// First tries to find and remove from .mcp.json, falls back to ~/.claude.json
#[tauri::command]
pub async fn delete_mcp_server(
    app: AppHandle,
    server_id: String,
    working_dir: Option<String>,
) -> Result<(), String> {
    log::info!("🗑️ [MCP DELETE] Deleting MCP server '{}'", server_id);

    // Try to delete from .mcp.json first (project scope)
    let mcp_json_path = get_mcp_config_path(&app, working_dir.clone())?;
    log::info!("🔍 [MCP DELETE] Looking for server in .mcp.json at: {}", mcp_json_path.display());

    if mcp_json_path.exists() {
        let mut project_config = read_mcp_config(&mcp_json_path)?;

        if project_config.mcp_servers.contains_key(&server_id) {
            // Found in .mcp.json - remove it
            project_config.mcp_servers.remove(&server_id);
            write_mcp_config(&mcp_json_path, &project_config)?;
            log::info!("✅ [MCP DELETE] Successfully deleted MCP server '{}' from .mcp.json", server_id);
            return Ok(());
        }
    }

    // Not found in .mcp.json, try ~/.claude.json (global scope)
    log::info!("🔍 [MCP DELETE] Server not in .mcp.json, checking ~/.claude.json");

    let work_dir = if let Some(dir) = working_dir {
        if !dir.is_empty() {
            dir
        } else {
            std::env::current_dir()
                .map_err(|e| format!("Failed to get current directory: {}", e))?
                .to_str()
                .ok_or("Failed to convert path to string")?
                .to_string()
        }
    } else {
        std::env::current_dir()
            .map_err(|e| format!("Failed to get current directory: {}", e))?
            .to_str()
            .ok_or("Failed to convert path to string")?
            .to_string()
    };

    // Read existing MCP servers from ~/.claude.json
    let mut existing_servers = if let Ok(global_config) = read_global_mcp_config(Some(&work_dir)) {
        global_config.mcp_servers
    } else {
        return Err(format!("MCP server '{}' not found in .mcp.json or ~/.claude.json", server_id));
    };

    // Remove the server from ~/.claude.json
    if existing_servers.remove(&server_id).is_some() {
        // Write back to ~/.claude.json
        write_global_mcp_config(&work_dir, existing_servers)?;
        log::info!("✅ [MCP DELETE] Successfully deleted MCP server '{}' from ~/.claude.json", server_id);
        return Ok(());
    }

    // Not found in ~/.claude.json either, try ~/.mcp.json
    log::info!("🔍 [MCP DELETE] Server not in ~/.claude.json, checking ~/.mcp.json");
    if let Ok(global_mcp_json_path) = get_global_mcp_json_path() {
        if global_mcp_json_path.exists() {
            let mut user_config = read_mcp_config(&global_mcp_json_path)?;
            if user_config.mcp_servers.remove(&server_id).is_some() {
                write_mcp_config(&global_mcp_json_path, &user_config)?;
                log::info!("✅ [MCP DELETE] Successfully deleted MCP server '{}' from ~/.mcp.json", server_id);
                return Ok(());
            }
        }
    }

    // Not found in ~/.mcp.json either, try ~/.claude/.mcp.json
    log::info!("🔍 [MCP DELETE] Server not in ~/.mcp.json, checking ~/.claude/.mcp.json");
    if let Ok(claude_dir_mcp_path) = get_claude_dir_mcp_json_path() {
        if claude_dir_mcp_path.exists() {
            let mut claude_dir_config = read_mcp_config(&claude_dir_mcp_path)?;
            if claude_dir_config.mcp_servers.remove(&server_id).is_some() {
                write_mcp_config(&claude_dir_mcp_path, &claude_dir_config)?;
                log::info!("✅ [MCP DELETE] Successfully deleted MCP server '{}' from ~/.claude/.mcp.json", server_id);
                return Ok(());
            }
        }
    }

    Err(format!("MCP server '{}' not found in .mcp.json, ~/.claude.json, ~/.mcp.json, or ~/.claude/.mcp.json", server_id))
}

/// Get predefined MCP server templates
#[tauri::command]
pub async fn get_mcp_templates() -> Result<Vec<MCPTemplate>, String> {
    Ok(vec![
        MCPTemplate {
            id: "filesystem".to_string(),
            name: "Filesystem".to_string(),
            description: "Access local files and directories".to_string(),
            template_type: "filesystem".to_string(),
            icon: "folder".to_string(),
            config: MCPServerConfig::Stdio {
                command: "npx".to_string(),
                args: vec!["@modelcontextprotocol/server-filesystem".to_string()],
                env: Some({
                    let mut env = HashMap::new();
                    env.insert("ALLOWED_PATHS".to_string(), "/path/to/projects".to_string());
                    env
                }),
            },
        },
        MCPTemplate {
            id: "github".to_string(),
            name: "GitHub".to_string(),
            description: "Interact with GitHub repositories".to_string(),
            template_type: "github".to_string(),
            icon: "github".to_string(),
            config: MCPServerConfig::Stdio {
                command: "npx".to_string(),
                args: vec!["@modelcontextprotocol/server-github".to_string()],
                env: Some({
                    let mut env = HashMap::new();
                    env.insert("GITHUB_TOKEN".to_string(), "${GITHUB_TOKEN}".to_string());
                    env
                }),
            },
        },
        MCPTemplate {
            id: "slack".to_string(),
            name: "Slack".to_string(),
            description: "Send and receive Slack messages".to_string(),
            template_type: "slack".to_string(),
            icon: "slack".to_string(),
            config: MCPServerConfig::Stdio {
                command: "npx".to_string(),
                args: vec!["@modelcontextprotocol/server-slack".to_string()],
                env: Some({
                    let mut env = HashMap::new();
                    env.insert("SLACK_TOKEN".to_string(), "${SLACK_TOKEN}".to_string());
                    env
                }),
            },
        },
        MCPTemplate {
            id: "postgres".to_string(),
            name: "PostgreSQL".to_string(),
            description: "Query PostgreSQL databases".to_string(),
            template_type: "database".to_string(),
            icon: "database".to_string(),
            config: MCPServerConfig::Stdio {
                command: "npx".to_string(),
                args: vec!["@modelcontextprotocol/server-postgres".to_string()],
                env: Some({
                    let mut env = HashMap::new();
                    env.insert("DATABASE_URL".to_string(), "${DATABASE_URL}".to_string());
                    env
                }),
            },
        },
        MCPTemplate {
            id: "puppeteer".to_string(),
            name: "Puppeteer".to_string(),
            description: "Browser automation with Puppeteer".to_string(),
            template_type: "puppeteer".to_string(),
            icon: "browser".to_string(),
            config: MCPServerConfig::Stdio {
                command: "npx".to_string(),
                args: vec!["@modelcontextprotocol/server-puppeteer".to_string()],
                env: None,
            },
        },
        MCPTemplate {
            id: "context7".to_string(),
            name: "Context7".to_string(),
            description: "Semantic search and knowledge base powered by Upstash Vector".to_string(),
            template_type: "database".to_string(),
            icon: "database".to_string(),
            config: MCPServerConfig::Stdio {
                command: "npx".to_string(),
                args: vec!["-y".to_string(), "@upstash/context7-mcp".to_string()],
                env: Some({
                    let mut env = HashMap::new();
                    env.insert("CONTEXT7_API_KEY".to_string(), "${CONTEXT7_API_KEY}".to_string());
                    env
                }),
            },
        },
    ])
}

/// Test HTTP/SSE server connection by making an actual HTTP request
async fn test_http_connection(
    url: &str,
    headers: &Option<HashMap<String, String>>,
    method: Option<&str>,
) -> Result<bool, String> {
    use std::time::Duration;

    // Create HTTP client with timeout
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    // Build request with appropriate HTTP method (default to GET for testing)
    let http_method = method.unwrap_or("GET");
    let mut request = match http_method.to_uppercase().as_str() {
        "GET" => client.get(url),
        "POST" => client.post(url),
        "PUT" => client.put(url),
        "PATCH" => client.patch(url),
        "DELETE" => client.delete(url),
        "HEAD" => client.head(url),
        _ => client.get(url), // Fallback to GET for unknown methods
    };

    // Add custom headers if provided
    if let Some(headers) = headers {
        for (key, value) in headers {
            request = request.header(key, value);
        }
    }

    // Send request
    match request.send().await {
        Ok(response) => {
            let status = response.status();
            if status.is_success() || status.is_redirection() {
                Ok(true)
            } else {
                Err(format!("Server returned HTTP {}: {}", status.as_u16(), status.canonical_reason().unwrap_or("Unknown")))
            }
        }
        Err(e) => {
            if e.is_timeout() {
                Err("Connection timeout after 5 seconds".to_string())
            } else if e.is_connect() {
                Err(format!("Connection failed: {}", e))
            } else {
                Err(format!("Request failed: {}", e))
            }
        }
    }
}

/// Test stdio server connection by attempting to spawn the process
async fn test_stdio_connection(
    command: &str,
    args: &[String],
) -> Result<bool, String> {
    use std::time::Duration;
    use tokio::process::Command;

    // On Windows, use cmd /c to run npx/node commands to ensure PATH is resolved
    #[cfg(target_os = "windows")]
    let (actual_command, actual_args): (String, Vec<String>) = {
        if command == "npx" || command == "node" || command == "npm" {
            let mut cmd_args = vec!["/c".to_string(), command.to_string()];
            cmd_args.extend(args.iter().cloned());
            ("cmd".to_string(), cmd_args)
        } else {
            (command.to_string(), args.to_vec())
        }
    };

    #[cfg(not(target_os = "windows"))]
    let (actual_command, actual_args) = (command.to_string(), args.to_vec());

    // Try to spawn the process
    let mut cmd = Command::new(&actual_command);
    cmd.args(&actual_args)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());

    // Brain: gotcha-shell-env-gui-launch
    // Inject login shell environment for test spawns too
    for (key, value) in crate::shell_env::get_login_env() {
        cmd.env(key, value);
    }

    // Windows: Hide console window
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = cmd.spawn()
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                format!("Command '{}' not found. Make sure it's installed and in PATH.", command)
            } else {
                format!("Failed to spawn process: {}", e)
            }
        })?;

    // Poll with try_wait() instead of wait().
    // IMPORTANT: Tokio's child.wait() closes stdin before waiting (deadlock prevention),
    // which causes MCP stdio servers to see EOF on stdin and exit with code 1.
    // try_wait() is non-blocking and does NOT close stdin.
    let poll_interval = Duration::from_millis(200);
    let max_polls = 10; // 10 × 200ms = 2s

    for _ in 0..max_polls {
        tokio::time::sleep(poll_interval).await;

        match child.try_wait() {
            Ok(Some(status)) => {
                // Process exited prematurely — read stderr for diagnosis
                let stderr_text = if let Some(stderr) = child.stderr.take() {
                    let reader = BufReader::new(stderr);
                    let mut lines = reader.lines();
                    let mut output = String::new();
                    while let Ok(Some(line)) = lines.next_line().await {
                        if output.len() < 2000 {
                            output.push_str(&line);
                            output.push('\n');
                        }
                    }
                    output
                } else {
                    String::new()
                };

                log::error!("[MCP TEST] Process exited early: code={:?} stderr={}", status.code(), stderr_text.trim());

                return if status.success() {
                    Ok(true)
                } else {
                    let msg = if stderr_text.is_empty() {
                        format!("Process exited with error code: {}", status.code().unwrap_or(-1))
                    } else {
                        format!("Process exited with error code {}: {}", status.code().unwrap_or(-1), stderr_text.trim())
                    };
                    Err(msg)
                };
            }
            Ok(None) => continue, // Still running — good
            Err(e) => return Err(format!("Process error: {}", e)),
        }
    }

    // Process survived 2 seconds — test passed, clean up
    child.kill().await.ok();
    Ok(true)
}

/// Test MCP server connection (performs actual connectivity test)
#[tauri::command]
pub async fn test_mcp_connection(
    _app: AppHandle,
    server: MCPServer,
) -> Result<bool, String> {
    log::info!("[MCP TEST] Testing connection for '{}' (transport: {}, command: {:?}, args: {:?})",
        server.id, server.transport, server.command, server.args);

    // Perform actual connection test based on transport type
    let result = match server.transport.as_str() {
        "stdio" => {
            // Validate fields first
            let command = server.command.as_ref()
                .ok_or("Command is required for stdio transport")?;
            let args = server.args.as_ref()
                .ok_or("Args are required for stdio transport")?;

            if command.is_empty() {
                return Err("Command cannot be empty".to_string());
            }

            // Test actual stdio connection
            test_stdio_connection(command, args).await
        }
        "http" | "sse" => {
            // Validate fields first
            let url = server.url.as_ref()
                .ok_or(format!("URL is required for {} transport", server.transport))?;

            if url.is_empty() {
                return Err("URL cannot be empty".to_string());
            }

            // Validate URL format
            if !url.starts_with("http://") && !url.starts_with("https://") {
                return Err("URL must start with http:// or https://".to_string());
            }

            // Test actual HTTP connection with configured method
            test_http_connection(url, &server.headers, server.method.as_deref()).await
        }
        _ => {
            Err(format!("Unknown transport type: {}", server.transport))
        }
    };

    log::info!("[MCP TEST] Result for '{}': {:?}", server.id, result);
    result
}

/// Stop a running MCP server (stdio only)
#[tauri::command]
pub async fn stop_mcp_server(
    app: AppHandle,
    server_id: String,
) -> Result<(), String> {
    let process_manager: tauri::State<MCPProcessManager> = app.state();
    process_manager.kill_process(&server_id).await?;
    log::info!("🔌 MCP server '{}' stopped", server_id);
    Ok(())
}

/// Restart an MCP server (stdio only)
#[tauri::command]
pub async fn restart_mcp_server(
    app: AppHandle,
    server_id: String,
    working_dir: Option<String>,
) -> Result<(), String> {
    // Stop the server first
    let process_manager: tauri::State<MCPProcessManager> = app.state();
    let _ = process_manager.kill_process(&server_id).await;

    // Get server configuration
    let mut server = get_mcp_server(app.clone(), server_id.clone(), working_dir).await?
        .ok_or("Server not found")?;

    // Start it again
    start_mcp_server(&app, &mut server).await?;
    log::info!("🔌 MCP server '{}' restarted", server_id);
    Ok(())
}

/// Get the status of an MCP server (running, stopped, error)
#[tauri::command]
pub async fn get_mcp_server_status(
    app: AppHandle,
    server_id: String,
) -> Result<String, String> {
    let process_manager: tauri::State<MCPProcessManager> = app.state();
    if process_manager.is_running(&server_id) {
        Ok("running".to_string())
    } else {
        Ok("stopped".to_string())
    }
}
