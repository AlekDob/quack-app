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
        },
        SlashCommand {
            name: "clear".to_string(),
            description: "Clear the current conversation history".to_string(),
            content: "Clear all messages from the current session".to_string(),
            is_builtin: true,
            parameters: None,
        },
        SlashCommand {
            name: "reset".to_string(),
            description: "Reset the conversation to a fresh state".to_string(),
            content: "Start a new conversation from scratch".to_string(),
            is_builtin: true,
            parameters: None,
        },
        SlashCommand {
            name: "model".to_string(),
            description: "Switch between Claude models".to_string(),
            content: "Change the active Claude model (sonnet, opus, etc.)".to_string(),
            is_builtin: true,
            parameters: Some(vec!["model_name".to_string()]),
        },
        SlashCommand {
            name: "session".to_string(),
            description: "Manage conversation sessions".to_string(),
            content: "Create, save, or load conversation sessions".to_string(),
            is_builtin: true,
            parameters: Some(vec!["action".to_string(), "session_id".to_string()]),
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

/// List all slash commands (builtin + custom)
#[tauri::command]
pub fn list_slash_commands(_app: AppHandle, base_path: String) -> Result<SlashCommandsResponse, String> {
    let builtin = get_builtin_commands();
    let mut custom = Vec::new();

    // Read custom commands from .claude/commands/
    let commands_dir = PathBuf::from(&base_path).join(".claude/commands");

    if commands_dir.exists() && commands_dir.is_dir() {
        match fs::read_dir(&commands_dir) {
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

                            custom.push(SlashCommand {
                                name: cmd_name,
                                description: cmd_description,
                                content: body,
                                is_builtin: false,
                                parameters,
                            });
                        }
                    }
                }
            }
            Err(e) => {
                eprintln!("Failed to read commands directory: {}", e);
            }
        }
    }

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
