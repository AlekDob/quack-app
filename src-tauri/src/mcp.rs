use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

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

/// Get the path to .mcp.json file in the project root
fn get_mcp_config_path(app: &AppHandle, working_dir: Option<String>) -> Result<PathBuf, String> {
    let base_path = if let Some(dir) = working_dir {
        PathBuf::from(dir)
    } else {
        app.path()
            .app_config_dir()
            .map_err(|e| format!("Failed to get app config dir: {}", e))?
    };

    Ok(base_path.join(".mcp.json"))
}

/// Get the path to global MCP config (~/.claude.json)
fn get_global_mcp_config_path() -> Result<PathBuf, String> {
    let home_dir = std::env::var("HOME")
        .map_err(|_| "Failed to get HOME directory".to_string())?;
    Ok(PathBuf::from(home_dir).join(".claude.json"))
}

/// Read and parse .mcp.json file
fn read_mcp_config(path: &PathBuf) -> Result<MCPConfigFile, String> {
    if !path.exists() {
        return Ok(MCPConfigFile {
            mcp_servers: HashMap::new(),
        });
    }

    let content = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read .mcp.json: {}", e))?;

    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse .mcp.json: {}", e))
}

/// Write MCP config to .mcp.json file
fn write_mcp_config(path: &PathBuf, config: &MCPConfigFile) -> Result<(), String> {
    let content = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize MCP config: {}", e))?;

    fs::write(path, content)
        .map_err(|e| format!("Failed to write .mcp.json: {}", e))
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

/// List all MCP servers from both global (~/.claude.json) and project (.mcp.json) configs
#[tauri::command]
pub async fn list_mcp_servers(
    app: AppHandle,
    working_dir: Option<String>,
) -> Result<Vec<MCPServer>, String> {
    let mut all_servers = Vec::new();

    // Read global MCP config from ~/.claude.json
    if let Ok(global_path) = get_global_mcp_config_path() {
        if let Ok(global_config) = read_mcp_config(&global_path) {
            let global_servers = config_to_servers(global_config, "global");
            all_servers.extend(global_servers);
        }
    }

    // Read project MCP config from .mcp.json
    let project_path = get_mcp_config_path(&app, working_dir)?;
    if let Ok(project_config) = read_mcp_config(&project_path) {
        let project_servers = config_to_servers(project_config, "project");
        all_servers.extend(project_servers);
    }

    Ok(all_servers)
}

/// Get a single MCP server by ID (searches both global and project configs)
#[tauri::command]
pub async fn get_mcp_server(
    app: AppHandle,
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

    // First check global config
    if let Ok(global_path) = get_global_mcp_config_path() {
        if let Ok(global_config) = read_mcp_config(&global_path) {
            if let Some(server_config) = global_config.mcp_servers.get(&server_id) {
                return Ok(Some(config_to_server(server_id, server_config, "global")));
            }
        }
    }

    // Then check project config
    let project_path = get_mcp_config_path(&app, working_dir)?;
    let project_config = read_mcp_config(&project_path)?;

    if let Some(server_config) = project_config.mcp_servers.get(&server_id) {
        Ok(Some(config_to_server(server_id, server_config, "project")))
    } else {
        Ok(None)
    }
}

/// Save or update an MCP server
#[tauri::command]
pub async fn save_mcp_server(
    app: AppHandle,
    server: MCPServer,
    working_dir: Option<String>,
) -> Result<(), String> {
    let config_path = get_mcp_config_path(&app, working_dir)?;
    let mut config = read_mcp_config(&config_path)?;

    let server_config = match server.transport.as_str() {
        "stdio" => MCPServerConfig::Stdio {
            command: server.command.ok_or("Command required for stdio transport")?,
            args: server.args.ok_or("Args required for stdio transport")?,
            env: server.env,
        },
        "http" => MCPServerConfig::Http {
            url: server.url.ok_or("URL required for HTTP transport")?,
            headers: server.headers,
            method: server.method,
            env: server.env,
        },
        "sse" => MCPServerConfig::Sse {
            url: server.url.ok_or("URL required for SSE transport")?,
            headers: server.headers,
            env: server.env,
        },
        _ => return Err(format!("Unknown transport type: {}", server.transport)),
    };

    config.mcp_servers.insert(server.id, server_config);
    write_mcp_config(&config_path, &config)
}

/// Delete an MCP server
#[tauri::command]
pub async fn delete_mcp_server(
    app: AppHandle,
    server_id: String,
    working_dir: Option<String>,
) -> Result<(), String> {
    let config_path = get_mcp_config_path(&app, working_dir)?;
    let mut config = read_mcp_config(&config_path)?;

    config.mcp_servers.remove(&server_id);
    write_mcp_config(&config_path, &config)
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

    // Try to spawn the process
    let mut child = Command::new(command)
        .args(args)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                format!("Command '{}' not found. Make sure it's installed and in PATH.", command)
            } else {
                format!("Failed to spawn process: {}", e)
            }
        })?;

    // Wait up to 2 seconds to see if process starts successfully
    match tokio::time::timeout(Duration::from_secs(2), child.wait()).await {
        Ok(Ok(status)) => {
            // Process exited within 2 seconds
            if status.success() {
                Ok(true) // Process ran and exited successfully
            } else {
                Err(format!("Process exited with error code: {}", status.code().unwrap_or(-1)))
            }
        }
        Ok(Err(e)) => {
            Err(format!("Process error: {}", e))
        }
        Err(_) => {
            // Timeout - process is still running (good sign for MCP servers!)
            child.kill().await.ok(); // Clean up
            Ok(true) // Process started and stayed alive
        }
    }
}

/// Test MCP server connection (performs actual connectivity test)
#[tauri::command]
pub async fn test_mcp_connection(
    _app: AppHandle,
    server: MCPServer,
) -> Result<bool, String> {
    // Perform actual connection test based on transport type
    match server.transport.as_str() {
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
    }
}
