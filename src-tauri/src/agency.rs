use std::{fs, path::PathBuf};

use anyhow::{anyhow, Context, Result};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct AgentInfo {
    pub name: String,
    pub description: String,
    pub model: String,
    pub color: String,
    pub file_path: String,
    pub scope: String, // "global" or "project"
}

#[derive(Serialize, Clone)]
pub struct AgentDetails {
    pub name: String,
    pub description: String,
    pub model: String,
    pub color: String,
    pub file_path: String,
    pub content: String,
}

/// List all agents from .claude/agents/ directory
#[tauri::command]
pub fn list_agents(working_dir: Option<String>) -> Result<Vec<AgentInfo>, String> {
    list_agents_impl(working_dir).map_err(|err| err.to_string())
}

/// Get detailed information about a specific agent
#[tauri::command]
pub fn get_agent_details(
    name: String,
    working_dir: Option<String>,
    scope: Option<String>,
) -> Result<AgentDetails, String> {
    get_agent_details_impl(name, working_dir, scope).map_err(|err| err.to_string())
}

/// Check if .claude/agents directory exists in the given path
#[tauri::command]
pub fn check_agents_directory(working_dir: Option<String>) -> Result<bool, String> {
    check_agents_directory_impl(working_dir).map_err(|err| err.to_string())
}

/// Create .claude/agents directory structure
#[tauri::command]
pub fn create_agents_directory(working_dir: Option<String>) -> Result<String, String> {
    create_agents_directory_impl(working_dir).map_err(|err| err.to_string())
}

/// Save/update an agent file
#[tauri::command]
pub fn save_agent(
    original_name: String,
    name: String,
    description: String,
    model: String,
    color: String,
    content: String,
    working_dir: Option<String>,
) -> Result<String, String> {
    save_agent_impl(original_name, name, description, model, color, content, working_dir)
        .map_err(|err| err.to_string())
}

fn list_agents_impl(working_dir: Option<String>) -> Result<Vec<AgentInfo>> {
    let mut agents = Vec::new();

    // 1. Read GLOBAL agents from ~/.claude/agents/
    if let Ok(home_dir) = std::env::var("HOME") {
        let global_agents_dir = PathBuf::from(home_dir).join(".claude").join("agents");

        if global_agents_dir.exists() {
            log::info!("Found global agents directory at: {:?}", global_agents_dir);

            if let Ok(entries) = fs::read_dir(&global_agents_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();

                    if path.extension().and_then(|s| s.to_str()) == Some("md") {
                        match parse_agent_file_with_scope(&path, "global") {
                            Ok(agent_info) => {
                                log::info!("Successfully parsed global agent: {}", agent_info.name);
                                agents.push(agent_info);
                            }
                            Err(e) => {
                                log::error!("Failed to parse global agent file {:?}: {}", path, e);
                            }
                        }
                    }
                }
            }
        }
    }

    // 2. Read PROJECT agents from .claude/agents/
    let current = if let Some(dir) = working_dir {
        PathBuf::from(dir)
    } else {
        std::env::current_dir()
            .context("Unable to get current working directory")?
    };

    let project_agents_dir = current.join(".claude").join("agents");

    if project_agents_dir.exists() {
        log::info!("Found project agents directory at: {:?}", project_agents_dir);

        let entries = fs::read_dir(&project_agents_dir)
            .with_context(|| format!("Unable to read agents directory: {:?}", project_agents_dir))?;

        for entry in entries {
            let entry = entry?;
            let path = entry.path();

            // Only process .md files
            if path.extension().and_then(|s| s.to_str()) == Some("md") {
                match parse_agent_file_with_scope(&path, "project") {
                    Ok(agent_info) => {
                        log::info!("Successfully parsed project agent: {}", agent_info.name);
                        agents.push(agent_info);
                    }
                    Err(e) => {
                        log::error!("Failed to parse project agent file {:?}: {}", path, e);
                    }
                }
            }
        }
    }

    log::info!("Total agents found: {} (global + project)", agents.len());

    // Sort agents: first by scope (global first), then by name
    agents.sort_by(|a, b| {
        match (a.scope.as_str(), b.scope.as_str()) {
            ("global", "project") => std::cmp::Ordering::Less,
            ("project", "global") => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    Ok(agents)
}

fn get_agent_details_impl(
    name: String,
    working_dir: Option<String>,
    scope: Option<String>,
) -> Result<AgentDetails> {
    // Determine which directory to use based on scope
    let agents_dir = match scope.as_deref() {
        Some("global") => {
            // Global agents: ~/.claude/agents/
            let home = std::env::var("HOME")
                .context("Unable to get HOME directory")?;
            PathBuf::from(home).join(".claude").join("agents")
        }
        _ => {
            // Project agents: .claude/agents/ in working directory
            let current = if let Some(dir) = working_dir {
                PathBuf::from(dir)
            } else {
                std::env::current_dir()
                    .context("Unable to get current working directory")?
            };
            current.join(".claude").join("agents")
        }
    };

    if !agents_dir.exists() {
        return Err(anyhow!(
            "Agents directory not found at: {:?}",
            agents_dir
        ));
    }

    // Try to find the agent file
    let agent_path = agents_dir.join(format!("{}.md", name));

    if !agent_path.exists() {
        return Err(anyhow!(
            "Agent file not found: {} in {:?}",
            name,
            agents_dir
        ));
    }

    parse_agent_file_with_content(&agent_path)
}

/// Parse agent file and extract frontmatter + content
fn parse_agent_file(path: &PathBuf) -> Result<AgentInfo> {
    parse_agent_file_with_scope(path, "project")
}

/// Parse agent file with scope
fn parse_agent_file_with_scope(path: &PathBuf, scope: &str) -> Result<AgentInfo> {
    let content = fs::read_to_string(path)
        .with_context(|| format!("Unable to read agent file: {:?}", path))?;

    let (frontmatter, _) = extract_frontmatter(&content)?;

    Ok(AgentInfo {
        name: frontmatter.name,
        description: frontmatter.description,
        model: frontmatter.model,
        color: frontmatter.color,
        file_path: path.to_string_lossy().to_string(),
        scope: scope.to_string(),
    })
}

/// Parse agent file with full content
fn parse_agent_file_with_content(path: &PathBuf) -> Result<AgentDetails> {
    let file_content = fs::read_to_string(path)
        .with_context(|| format!("Unable to read agent file: {:?}", path))?;

    let (frontmatter, content) = extract_frontmatter(&file_content)?;

    Ok(AgentDetails {
        name: frontmatter.name,
        description: frontmatter.description,
        model: frontmatter.model,
        color: frontmatter.color,
        file_path: path.to_string_lossy().to_string(),
        content,
    })
}

#[derive(Deserialize)]
struct AgentFrontmatter {
    name: String,
    description: String,
    model: String,
    color: String,
}

/// Extract YAML frontmatter and content from markdown file
fn extract_frontmatter(content: &str) -> Result<(AgentFrontmatter, String)> {
    // Find frontmatter delimiters (---)
    let lines: Vec<&str> = content.lines().collect();

    if lines.is_empty() || lines[0] != "---" {
        return Err(anyhow!("Invalid frontmatter: file must start with ---"));
    }

    // Find closing ---
    let end_index = lines.iter()
        .skip(1)
        .position(|&line| line == "---")
        .ok_or_else(|| anyhow!("Invalid frontmatter: missing closing ---"))?;

    // Extract YAML lines (between the two ---)
    let yaml_lines = &lines[1..end_index + 1];

    // Parse fields manually using regex (more robust for complex descriptions)
    let mut name = String::new();
    let mut description = String::new();
    let mut model = String::new();
    let mut color = String::new();

    for line in yaml_lines {
        let line = line.trim();
        if line.starts_with("name:") {
            name = line.trim_start_matches("name:").trim().to_string();
        } else if line.starts_with("description:") {
            description = line.trim_start_matches("description:").trim().to_string();
        } else if line.starts_with("model:") {
            model = line.trim_start_matches("model:").trim().to_string();
        } else if line.starts_with("color:") {
            color = line.trim_start_matches("color:").trim().to_string();
        }
    }

    if name.is_empty() || model.is_empty() || color.is_empty() {
        return Err(anyhow!("Missing required fields in frontmatter (name, model, color)"));
    }

    let frontmatter = AgentFrontmatter {
        name,
        description,
        model,
        color,
    };

    // Extract markdown content (after closing ---)
    let content_start = end_index + 2; // Skip closing --- and next line
    let markdown_content = if content_start < lines.len() {
        lines[content_start..].join("\n")
    } else {
        String::new()
    };

    Ok((frontmatter, markdown_content))
}

fn check_agents_directory_impl(working_dir: Option<String>) -> Result<bool> {
    // Use provided working directory or current directory
    let current = if let Some(dir) = working_dir {
        PathBuf::from(dir)
    } else {
        std::env::current_dir()
            .context("Unable to get current working directory")?
    };

    // Check for .claude/agents ONLY in the specified directory (don't traverse up)
    let agents_dir = current.join(".claude").join("agents");
    Ok(agents_dir.exists())
}

fn save_agent_impl(
    original_name: String,
    name: String,
    description: String,
    model: String,
    color: String,
    content: String,
    working_dir: Option<String>,
) -> Result<String> {
    // Use provided working directory or current directory
    let current = if let Some(dir) = working_dir {
        PathBuf::from(dir)
    } else {
        std::env::current_dir()
            .context("Unable to get current working directory")?
    };

    // Look for .claude/agents ONLY in the specified directory (don't traverse up)
    let agents_dir = current.join(".claude").join("agents");

    if !agents_dir.exists() {
        return Err(anyhow!("Agents directory not found in: {:?}. Please setup Quack Agency for this project.", current));
    }

    let old_path = agents_dir.join(format!("{}.md", original_name));
    let new_path = agents_dir.join(format!("{}.md", name));

    // Build the new file content
    let mut file_content = String::new();
    file_content.push_str("---\n");
    file_content.push_str(&format!("name: {}\n", name));
    if !description.is_empty() {
        file_content.push_str(&format!("description: {}\n", description));
    }
    file_content.push_str(&format!("model: {}\n", model));
    file_content.push_str(&format!("color: {}\n", color));
    file_content.push_str("---\n");
    file_content.push_str("\n");
    file_content.push_str(&content);

    // Write the file
    fs::write(&new_path, file_content)
        .with_context(|| format!("Failed to write agent file: {:?}", new_path))?;

    // If name changed, delete old file
    if original_name != name && old_path.exists() {
        fs::remove_file(&old_path)
            .with_context(|| format!("Failed to remove old agent file: {:?}", old_path))?;
    }

    log::info!("Agent saved successfully: {}", name);
    Ok(new_path.to_string_lossy().to_string())
}

fn create_agents_directory_impl(working_dir: Option<String>) -> Result<String> {
    // Use provided working directory or current directory
    let current = if let Some(dir) = working_dir {
        PathBuf::from(dir)
    } else {
        std::env::current_dir()
            .context("Unable to get current working directory")?
    };

    let claude_dir = current.join(".claude");
    let agents_dir = claude_dir.join("agents");

    // Create directories
    fs::create_dir_all(&agents_dir)
        .with_context(|| format!("Failed to create agents directory: {:?}", agents_dir))?;

    log::info!("Created agents directory at: {:?}", agents_dir);
    Ok(agents_dir.to_string_lossy().to_string())
}
