use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;

/// Bundled command: /background - Run commands or agents in background
/// This command is installed automatically for all Quack users on first run
const BUNDLED_COMMAND_BACKGROUND: &str = include_str!("../../.claude/commands/background.md");

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

/// SDK built-in slash commands — handled natively by the Claude Code CLI.
/// These are passed through to the SDK as raw "/command" text (no expansion).
const SDK_BUILTIN_COMMANDS: &[(&str, &str)] = &[
    ("compact", "Compress conversation history to save context"),
    ("context", "Show context window usage and token counts"),
    ("cost", "Show session cost and token usage breakdown"),
    ("diff", "Show file changes made in this session"),
    ("doctor", "Run diagnostics and check configuration"),
    ("init", "Initialize CLAUDE.md and project configuration"),
    ("memory", "Show active memory files"),
    ("mcp", "Show MCP server connection status"),
    ("model", "Show or change the active model"),
    ("permissions", "Show current tool permissions"),
    ("review", "Review code changes made in this session"),
    ("status", "Show session status and configuration"),
    ("undo", "Undo the last file change"),
];

/// Quack built-in slash commands — handled by Quack, not the SDK.
/// These have actual content that gets expanded like custom commands.
const QUACK_BUILTIN_COMMANDS: &[(&str, &str, &str)] = &[
    (
        "brain",
        "Update Quack Brain with session discoveries",
        "Update the Quack Brain with the progress and discoveries made in this session. Only add new items not already documented — check existing brain entries before creating duplicates.",
    ),
];

/// Check if a command name is an SDK built-in slash command
fn is_sdk_builtin(command_name: &str) -> bool {
    SDK_BUILTIN_COMMANDS.iter().any(|(name, _)| *name == command_name)
}

/// Get the content of a Quack built-in command
fn get_quack_builtin_content(command_name: &str) -> Option<&'static str> {
    QUACK_BUILTIN_COMMANDS.iter()
        .find(|(name, _, _)| *name == command_name)
        .map(|(_, _, content)| *content)
}

/// Built-in commands: SDK commands + Quack commands
fn get_builtin_commands() -> Vec<SlashCommand> {
    let mut commands: Vec<SlashCommand> = SDK_BUILTIN_COMMANDS
        .iter()
        .map(|(name, desc)| SlashCommand {
            name: name.to_string(),
            description: desc.to_string(),
            content: String::new(),
            is_builtin: true,
            parameters: None,
            scope: "sdk".to_string(),
        })
        .collect();

    // Add Quack built-in commands
    commands.extend(QUACK_BUILTIN_COMMANDS.iter().map(|(name, desc, content)| SlashCommand {
        name: name.to_string(),
        description: desc.to_string(),
        content: content.to_string(),
        is_builtin: true,
        parameters: None,
        scope: "quack".to_string(),
    }));

    commands
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

    // 3. Deduplicate: project commands override global commands with the same name
    // This ensures that if a user has both a global and project command with the same name,
    // only the project-level command is shown (project takes precedence)
    for project_cmd in project_commands {
        // Remove any existing global command with the same name
        custom.retain(|cmd| cmd.name.to_lowercase() != project_cmd.name.to_lowercase());
        // Add the project command
        custom.push(project_cmd);
    }

    // Sort commands alphabetically by name (ignore scope priority for consistent UX)
    custom.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

    log::info!("🦆 Total custom commands (after dedup): {}", custom.len());

    Ok(SlashCommandsResponse { builtin, custom })
}

/// Create a new custom command
#[tauri::command]
pub fn create_slash_command(
    _app: AppHandle,
    base_path: String,
    name: String,
    content: String,
    scope: Option<String>,
) -> Result<(), String> {
    // Determine target directory based on scope
    let commands_dir = match scope.as_deref() {
        Some("global") => {
            // Global: ~/.claude/commands/
            let home_dir = std::env::var("HOME")
                .map_err(|_| "Could not determine home directory")?;
            PathBuf::from(home_dir).join(".claude/commands")
        }
        _ => {
            // Project (default): <base_path>/.claude/commands/
            PathBuf::from(&base_path).join(".claude/commands")
        }
    };

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

    log::info!("🦆 Created {:?} command: {}", scope.as_deref().unwrap_or("project"), name);

    Ok(())
}

/// Update an existing custom command
#[tauri::command]
pub fn update_slash_command(
    _app: AppHandle,
    base_path: String,
    name: String,
    content: String,
    scope: Option<String>,
) -> Result<(), String> {
    // Determine target directory based on scope
    let commands_dir = match scope.as_deref() {
        Some("global") => {
            let home_dir = std::env::var("HOME")
                .map_err(|_| "Could not determine home directory")?;
            PathBuf::from(home_dir).join(".claude/commands")
        }
        _ => {
            PathBuf::from(&base_path).join(".claude/commands")
        }
    };

    let file_path = commands_dir.join(format!("{}.md", name));

    if !file_path.exists() {
        return Err(format!("Command '{}' does not exist", name));
    }

    fs::write(&file_path, content)
        .map_err(|e| format!("Failed to update command file: {}", e))?;

    log::info!("🦆 Updated {:?} command: {}", scope.as_deref().unwrap_or("project"), name);

    Ok(())
}

/// Delete a custom command
#[tauri::command]
pub fn delete_slash_command(
    _app: AppHandle,
    base_path: String,
    name: String,
    scope: Option<String>,
) -> Result<(), String> {
    // Determine target directory based on scope
    let commands_dir = match scope.as_deref() {
        Some("global") => {
            let home_dir = std::env::var("HOME")
                .map_err(|_| "Could not determine home directory")?;
            PathBuf::from(home_dir).join(".claude/commands")
        }
        _ => {
            PathBuf::from(&base_path).join(".claude/commands")
        }
    };

    let file_path = commands_dir.join(format!("{}.md", name));

    if !file_path.exists() {
        return Err(format!("Command '{}' does not exist", name));
    }

    fs::remove_file(&file_path)
        .map_err(|e| format!("Failed to delete command file: {}", e))?;

    log::info!("🦆 Deleted {:?} command: {}", scope.as_deref().unwrap_or("project"), name);

    Ok(())
}

/// Expand a slash command by reading its content and replacing placeholders
/// The expanded content is wrapped in <command-context> tags to give the AI
/// full context about how to execute the command.
#[tauri::command]
pub fn expand_slash_command(
    _app: AppHandle,
    base_path: String,
    command_name: String,
    args: String,
) -> Result<String, String> {
    log::info!("🦆 Expanding slash command: {} with args: {}", command_name, args);

    // SDK built-in commands are passed through as raw text — the CLI handles them natively
    if is_sdk_builtin(&command_name) {
        let raw = if args.is_empty() {
            format!("/{}", command_name)
        } else {
            format!("/{} {}", command_name, args)
        };
        log::info!("🦆 SDK built-in command: {}", raw);
        return Ok(raw);
    }

    // Quack built-in commands have their own content — expand inline
    if let Some(content) = get_quack_builtin_content(&command_name) {
        log::info!("🦆 Quack built-in command: /{}", command_name);
        return Ok(content.to_string());
    }

    // Try to find command in project commands first
    let project_commands_dir = PathBuf::from(&base_path).join(".claude/commands");
    let project_file = project_commands_dir.join(format!("{}.md", command_name));

    // Then try global commands
    let global_file = if let Ok(home_dir) = std::env::var("HOME") {
        Some(PathBuf::from(home_dir).join(format!(".claude/commands/{}.md", command_name)))
    } else {
        None
    };

    // Determine which file to use
    let command_file = if project_file.exists() {
        log::info!("🦆 Found project command: {:?}", project_file);
        project_file
    } else if let Some(gf) = global_file {
        if gf.exists() {
            log::info!("🦆 Found global command: {:?}", gf);
            gf
        } else {
            return Err(format!("Command '{}' not found", command_name));
        }
    } else {
        return Err(format!("Command '{}' not found", command_name));
    };

    // Read command content (the full file including frontmatter)
    let full_content = fs::read_to_string(&command_file)
        .map_err(|e| format!("Failed to read command file: {}", e))?;

    // Parse frontmatter to get description and body
    let (_, description, _, body) = parse_frontmatter(&full_content);
    let cmd_description = description.unwrap_or_else(|| "Custom command".to_string());

    // Replace $ARGUMENTS placeholder with actual arguments
    let expanded = body.replace("$ARGUMENTS", &args);

    // Replace numbered placeholders $1, $2, etc. with space-separated arguments
    let args_vec: Vec<&str> = args.split_whitespace().collect();
    let mut expanded_body = expanded.clone();

    for (i, arg) in args_vec.iter().enumerate() {
        let placeholder = format!("${}", i + 1);
        expanded_body = expanded_body.replace(&placeholder, arg);
    }

    // Wrap in command-context tags so the AI knows this is a command definition
    // that it should execute according to the instructions
    let final_content = format!(
        r#"<command-context name="{}" description="{}">
The user invoked the /{} command. Follow the instructions below to execute it.

---

{}

</command-context>

User's command: /{} {}

Execute the command according to the instructions in <command-context> above."#,
        command_name,
        cmd_description,
        command_name,
        expanded_body,
        command_name,
        args
    );

    log::info!("🦆 Expanded command with context ({} chars)", final_content.len());

    Ok(final_content)
}

/// Detailed command information for the CommandViewer component
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandDetails {
    pub name: String,
    pub description: String,
    pub content: String,
    pub parameters: Option<Vec<String>>,
    pub scope: String,
    pub file_path: String,
}

/// Get detailed information about a specific command
#[tauri::command]
pub fn get_command_details(
    _app: AppHandle,
    name: String,
    working_dir: Option<String>,
    scope: String,
) -> Result<CommandDetails, String> {
    let commands_dir = if scope == "global" {
        let home_dir = std::env::var("HOME")
            .map_err(|_| "Could not determine home directory")?;
        PathBuf::from(home_dir).join(".claude/commands")
    } else {
        let base = working_dir.ok_or("Working directory is required for project commands")?;
        PathBuf::from(&base).join(".claude/commands")
    };

    let file_path = commands_dir.join(format!("{}.md", name));

    if !file_path.exists() {
        return Err(format!("Command '{}' not found", name));
    }

    let full_content = fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read command file: {}", e))?;

    let (parsed_name, description, parameters, body) = parse_frontmatter(&full_content);

    Ok(CommandDetails {
        name: parsed_name.unwrap_or_else(|| name.clone()),
        description: description.unwrap_or_else(|| "Custom command".to_string()),
        content: body,
        parameters,
        scope,
        file_path: file_path.to_string_lossy().to_string(),
    })
}

/// Save command content (create or update)
#[tauri::command]
pub fn save_command_content(
    _app: AppHandle,
    name: String,
    content: String,
    description: String,
    parameters: Option<Vec<String>>,
    scope: String,
    working_dir: Option<String>,
) -> Result<(), String> {
    let commands_dir = if scope == "global" {
        let home_dir = std::env::var("HOME")
            .map_err(|_| "Could not determine home directory")?;
        PathBuf::from(home_dir).join(".claude/commands")
    } else {
        let base = working_dir.ok_or("Working directory is required for project commands")?;
        PathBuf::from(&base).join(".claude/commands")
    };

    // Create directory if it doesn't exist
    if !commands_dir.exists() {
        fs::create_dir_all(&commands_dir)
            .map_err(|e| format!("Failed to create commands directory: {}", e))?;
    }

    let file_path = commands_dir.join(format!("{}.md", name));

    // Build frontmatter
    let mut frontmatter_lines = vec!["---".to_string()];
    frontmatter_lines.push(format!("name: {}", name));
    frontmatter_lines.push(format!("description: {}", description));
    if let Some(params) = &parameters {
        if !params.is_empty() {
            frontmatter_lines.push(format!("parameters: [{}]", params.join(", ")));
        }
    }
    frontmatter_lines.push("---".to_string());
    frontmatter_lines.push(String::new());

    let full_content = format!("{}\n{}", frontmatter_lines.join("\n"), content);

    fs::write(&file_path, full_content)
        .map_err(|e| format!("Failed to write command file: {}", e))?;

    log::info!("🦆 Saved {} command: {}", scope, name);

    Ok(())
}

/// Bundled command definition for automatic installation
struct BundledCommand {
    name: &'static str,
    content: &'static str,
}

/// List of bundled commands to install for all Quack users
/// These are core Quack features that should be available in any project
const BUNDLED_COMMANDS: &[BundledCommand] = &[
    BundledCommand {
        name: "background",
        content: BUNDLED_COMMAND_BACKGROUND,
    },
];

/// Install bundled commands to ~/.claude/commands/ on first run
///
/// This function is called during app startup and ensures that
/// all Quack users have access to essential global commands like /background.
///
/// Commands are only installed if they don't already exist, preserving
/// any user customizations.
pub fn install_bundled_commands() -> Result<(), String> {
    let home_dir = std::env::var("HOME")
        .map_err(|_| "Could not determine home directory")?;

    let global_commands_dir = PathBuf::from(home_dir).join(".claude/commands");

    // Create directory if it doesn't exist
    if !global_commands_dir.exists() {
        fs::create_dir_all(&global_commands_dir)
            .map_err(|e| format!("Failed to create global commands directory: {}", e))?;
        log::info!("🦆 Created global commands directory: {:?}", global_commands_dir);
    }

    let mut installed_count = 0;
    let mut skipped_count = 0;

    for cmd in BUNDLED_COMMANDS {
        let file_path = global_commands_dir.join(format!("{}.md", cmd.name));

        if file_path.exists() {
            // Command already exists, don't overwrite user customizations
            log::debug!("🦆 Bundled command '{}' already exists, skipping", cmd.name);
            skipped_count += 1;
        } else {
            // Install the bundled command
            fs::write(&file_path, cmd.content)
                .map_err(|e| format!("Failed to install bundled command '{}': {}", cmd.name, e))?;
            log::info!("🦆 Installed bundled command: /{}", cmd.name);
            installed_count += 1;
        }
    }

    if installed_count > 0 {
        log::info!(
            "🦆 Bundled commands installation complete: {} installed, {} already present",
            installed_count,
            skipped_count
        );
    }

    Ok(())
}
