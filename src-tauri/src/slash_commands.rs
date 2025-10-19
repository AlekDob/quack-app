use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlashCommand {
    pub name: String,
    pub description: String,
    pub content: String,
    #[serde(rename = "isBuiltin")]
    pub is_builtin: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parameters: Option<Vec<String>>,
    pub scope: String, // "global" | "project" | "builtin"
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SlashCommandsResponse {
    pub builtin: Vec<SlashCommand>,
    pub custom: Vec<SlashCommand>,
}

/// Built-in Claude Code commands
/// Source: https://docs.claude.com/en/api/agent-sdk/slash-commands
fn get_builtin_commands() -> Vec<SlashCommand> {
    vec![
        SlashCommand {
            name: "help".to_string(),
            description: "Show available commands and keyboard shortcuts".to_string(),
            content: "Display help information for Claude Code".to_string(),
            is_builtin: true,
            parameters: None,
            scope: "builtin".to_string(),
        },
        SlashCommand {
            name: "clear".to_string(),
            description: "Clear the current conversation history".to_string(),
            content: "Clear all messages from the current session".to_string(),
            is_builtin: true,
            parameters: None,
            scope: "builtin".to_string(),
        },
        SlashCommand {
            name: "reset".to_string(),
            description: "Reset the conversation to a fresh state".to_string(),
            content: "Start a new conversation from scratch".to_string(),
            is_builtin: true,
            parameters: None,
            scope: "builtin".to_string(),
        },
        SlashCommand {
            name: "model".to_string(),
            description: "Switch between Claude models".to_string(),
            content: "Change the active Claude model (sonnet, opus, etc.)".to_string(),
            is_builtin: true,
            parameters: Some(vec!["model_name".to_string()]),
            scope: "builtin".to_string(),
        },
        SlashCommand {
            name: "session".to_string(),
            description: "Manage conversation sessions".to_string(),
            content: "Create, save, or load conversation sessions".to_string(),
            is_builtin: true,
            parameters: Some(vec!["action".to_string(), "session_id".to_string()]),
            scope: "builtin".to_string(),
        },
    ]
}

/// Parse frontmatter from markdown file
fn parse_frontmatter(content: &str) -> (Option<String>, Option<String>, Option<Vec<String>>, String) {
    let lines: Vec<&str> = content.lines().collect();

    if lines.is_empty() || lines[0] != "---" {
        // No frontmatter
        return (None, None, None, content.to_string());
    }

    let mut name: Option<String> = None;
    let mut description: Option<String> = None;
    let mut parameters: Option<Vec<String>> = None;
    let mut end_index = 1;

    for (i, line) in lines.iter().enumerate().skip(1) {
        if *line == "---" {
            end_index = i + 1;
            break;
        }

        if let Some((key, value)) = line.split_once(':') {
            let key = key.trim();
            let value = value.trim();

            match key {
                "name" => name = Some(value.to_string()),
                "description" => description = Some(value.to_string()),
                "parameters" => {
                    // Parse array: [param1, param2, ...]
                    let params: Vec<String> = value
                        .trim_matches(|c| c == '[' || c == ']')
                        .split(',')
                        .map(|s| s.trim().to_string())
                        .filter(|s| !s.is_empty())
                        .collect();
                    if !params.is_empty() {
                        parameters = Some(params);
                    }
                }
                _ => {}
            }
        }
    }

    let body = if end_index < lines.len() {
        lines[end_index..].join("\n").trim().to_string()
    } else {
        String::new()
    };

    (name, description, parameters, body)
}

/// Read commands from a directory with specified scope
fn read_commands_from_dir(dir_path: &PathBuf, scope: &str) -> Vec<SlashCommand> {
    let mut commands = Vec::new();

    if dir_path.exists() && dir_path.is_dir() {
        match fs::read_dir(dir_path) {
            Ok(entries) => {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.extension().and_then(|s| s.to_str()) == Some("md") {
                        if let Ok(content) = fs::read_to_string(&path) {
                            let (name, description, parameters, body) = parse_frontmatter(&content);

                            let cmd_name = name.unwrap_or_else(|| {
                                path.file_stem()
                                    .and_then(|s| s.to_str())
                                    .unwrap_or("unknown")
                                    .to_string()
                            });

                            let cmd_description = description.unwrap_or_else(|| {
                                "Custom command".to_string()
                            });

                            commands.push(SlashCommand {
                                name: cmd_name,
                                description: cmd_description,
                                content: body,
                                is_builtin: false,
                                parameters,
                                scope: scope.to_string(),
                            });
                        }
                    }
                }
            }
            Err(e) => {
                eprintln!("🦆 Failed to read commands directory {:?}: {}", dir_path, e);
            }
        }
    }

    commands
}

/// List all slash commands (builtin + global + project custom)
#[tauri::command]
pub fn list_slash_commands(_app: AppHandle, base_path: String) -> Result<SlashCommandsResponse, String> {
    let builtin = get_builtin_commands();
    let mut custom = Vec::new();

    // 1. Read GLOBAL commands from ~/.claude/commands/
    if let Ok(home_dir) = std::env::var("HOME") {
        let global_commands_dir = PathBuf::from(home_dir).join(".claude/commands");
        log::info!("🦆 Reading global commands from: {:?}", global_commands_dir);
        let global_commands = read_commands_from_dir(&global_commands_dir, "global");
        log::info!("🦆 Found {} global commands", global_commands.len());
        custom.extend(global_commands);
    }

    // 2. Read PROJECT commands from .claude/commands/
    let project_commands_dir = PathBuf::from(&base_path).join(".claude/commands");
    log::info!("🦆 Reading project commands from: {:?}", project_commands_dir);
    let project_commands = read_commands_from_dir(&project_commands_dir, "project");
    log::info!("🦆 Found {} project commands", project_commands.len());
    custom.extend(project_commands);

    // Sort commands: builtin first, then global, then project, then alphabetically by name
    custom.sort_by(|a, b| {
        match (a.scope.as_str(), b.scope.as_str()) {
            ("global", "project") => std::cmp::Ordering::Less,
            ("project", "global") => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    log::info!("🦆 Total custom commands: {}", custom.len());

    Ok(SlashCommandsResponse { builtin, custom })
}

/// Create a new custom command
#[tauri::command]
pub fn create_slash_command(
    _app: AppHandle,
    base_path: String,
    name: String,
    content: String,
) -> Result<(), String> {
    let commands_dir = PathBuf::from(&base_path).join(".claude/commands");

    // Create directory if it doesn't exist
    if !commands_dir.exists() {
        fs::create_dir_all(&commands_dir)
            .map_err(|e| format!("Failed to create commands directory: {}", e))?;
    }

    let file_path = commands_dir.join(format!("{}.md", name));

    // Check if command already exists
    if file_path.exists() {
        return Err(format!("Command '{}' already exists", name));
    }

    fs::write(&file_path, content)
        .map_err(|e| format!("Failed to write command file: {}", e))?;

    Ok(())
}

/// Update an existing custom command
#[tauri::command]
pub fn update_slash_command(
    _app: AppHandle,
    base_path: String,
    name: String,
    content: String,
) -> Result<(), String> {
    let commands_dir = PathBuf::from(&base_path).join(".claude/commands");
    let file_path = commands_dir.join(format!("{}.md", name));

    if !file_path.exists() {
        return Err(format!("Command '{}' does not exist", name));
    }

    fs::write(&file_path, content)
        .map_err(|e| format!("Failed to update command file: {}", e))?;

    Ok(())
}

/// Delete a custom command
#[tauri::command]
pub fn delete_slash_command(_app: AppHandle, base_path: String, name: String) -> Result<(), String> {
    let commands_dir = PathBuf::from(&base_path).join(".claude/commands");
    let file_path = commands_dir.join(format!("{}.md", name));

    if !file_path.exists() {
        return Err(format!("Command '{}' does not exist", name));
    }

    fs::remove_file(&file_path)
        .map_err(|e| format!("Failed to delete command file: {}", e))?;

    Ok(())
}
