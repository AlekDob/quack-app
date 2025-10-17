use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MCPServerConfig {
    pub command: String,
    pub args: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub env: Option<HashMap<String, String>>,
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
    pub command: String,
    pub args: Vec<String>,
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
            let server_type = infer_server_type(&id, &server_config.command);
            MCPServer {
                id: id.clone(),
                name: id,
                server_type,
                command: server_config.command,
                args: server_config.args,
                env: server_config.env,
                enabled: true,
                status: "stopped".to_string(),
                error: None,
                scope: scope.to_string(),
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
    // First check global config
    if let Ok(global_path) = get_global_mcp_config_path() {
        if let Ok(global_config) = read_mcp_config(&global_path) {
            if let Some(server_config) = global_config.mcp_servers.get(&server_id) {
                let server_type = infer_server_type(&server_id, &server_config.command);
                return Ok(Some(MCPServer {
                    id: server_id.clone(),
                    name: server_id,
                    server_type,
                    command: server_config.command.clone(),
                    args: server_config.args.clone(),
                    env: server_config.env.clone(),
                    enabled: true,
                    status: "stopped".to_string(),
                    error: None,
                    scope: "global".to_string(),
                }));
            }
        }
    }

    // Then check project config
    let project_path = get_mcp_config_path(&app, working_dir)?;
    let project_config = read_mcp_config(&project_path)?;

    if let Some(server_config) = project_config.mcp_servers.get(&server_id) {
        let server_type = infer_server_type(&server_id, &server_config.command);
        Ok(Some(MCPServer {
            id: server_id.clone(),
            name: server_id,
            server_type,
            command: server_config.command.clone(),
            args: server_config.args.clone(),
            env: server_config.env.clone(),
            enabled: true,
            status: "stopped".to_string(),
            error: None,
            scope: "project".to_string(),
        }))
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

    let server_config = MCPServerConfig {
        command: server.command,
        args: server.args,
        env: server.env,
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
            config: MCPServerConfig {
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
            config: MCPServerConfig {
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
            config: MCPServerConfig {
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
            config: MCPServerConfig {
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
            config: MCPServerConfig {
                command: "npx".to_string(),
                args: vec!["@modelcontextprotocol/server-puppeteer".to_string()],
                env: None,
            },
        },
    ])
}

/// Test MCP server connection (basic validation)
#[tauri::command]
pub async fn test_mcp_connection(
    _app: AppHandle,
    server: MCPServer,
) -> Result<bool, String> {
    // Basic validation: check if command exists and is executable
    // In a real implementation, you might try to spawn the process briefly

    if server.command.is_empty() {
        return Err("Command cannot be empty".to_string());
    }

    if server.args.is_empty() {
        return Err("Args cannot be empty".to_string());
    }

    // Validate environment variables format
    if let Some(env) = &server.env {
        for (key, value) in env {
            if key.is_empty() {
                return Err("Environment variable key cannot be empty".to_string());
            }
            if value.is_empty() {
                return Err(format!("Environment variable {} value cannot be empty", key));
            }
        }
    }

    Ok(true)
}
