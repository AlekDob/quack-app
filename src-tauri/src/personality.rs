use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use anyhow::{Result, Context};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentPersonality {
    pub id: String,
    pub name: String,
    pub role: String,
    pub personality: String,
    pub quirks: String,
    #[serde(rename = "communicationStyle")]
    pub communication_style: String,
    pub specialties: Vec<String>,
    pub skills: Vec<String>,
    pub expressions: Vec<String>,
}

impl Default for AgentPersonality {
    fn default() -> Self {
        Self {
            id: "default".to_string(),
            name: "Jack".to_string(),
            role: "Product Manager at Quack Agency".to_string(),
            personality: "You coordinate feature development and sprint planning. You work on specific branches and invoke Protocol Droids when you need specialized expertise.".to_string(),
            quirks: "You always respond with frequent 'quack quack' expressions and focus on coordinating work rather than doing it yourself.".to_string(),
            communication_style: "friendly".to_string(),
            specialties: vec![],
            skills: vec![],
            expressions: vec!["Quack quack!".to_string(), "Let me coordinate this with the right Protocol Droid!".to_string()],
        }
    }
}

/// Get the .quack directory path for a project
fn get_quack_dir(project_path: &Path) -> PathBuf {
    project_path.join(".quack")
}

/// Get the agent personalities directory
fn get_personalities_dir(project_path: &Path) -> PathBuf {
    get_quack_dir(project_path).join("agent-personalities")
}

/// Save agent personality to JSON file
#[tauri::command]
pub fn save_agent_personality(
    project_path: String,
    personality: AgentPersonality,
) -> Result<(), String> {
    save_agent_personality_impl(&PathBuf::from(project_path), personality)
        .map_err(|e| e.to_string())
}

fn save_agent_personality_impl(
    project_path: &Path,
    personality: AgentPersonality,
) -> Result<()> {
    let personalities_dir = get_personalities_dir(project_path);

    // Ensure directory exists
    fs::create_dir_all(&personalities_dir)
        .context("Failed to create personalities directory")?;

    let file_path = personalities_dir.join(format!("{}.json", personality.id));
    let json = serde_json::to_string_pretty(&personality)
        .context("Failed to serialize personality")?;

    fs::write(&file_path, json)
        .context("Failed to write personality file")?;

    Ok(())
}

/// Load agent personality from JSON file
#[tauri::command]
pub fn load_agent_personality(
    project_path: String,
    personality_id: String,
) -> Result<AgentPersonality, String> {
    load_agent_personality_impl(&PathBuf::from(project_path), &personality_id)
        .map_err(|e| e.to_string())
}

fn load_agent_personality_impl(
    project_path: &Path,
    personality_id: &str,
) -> Result<AgentPersonality> {
    let personalities_dir = get_personalities_dir(project_path);
    let file_path = personalities_dir.join(format!("{}.json", personality_id));

    if !file_path.exists() {
        // Return default personality if file doesn't exist
        return Ok(AgentPersonality::default());
    }

    let json = fs::read_to_string(&file_path)
        .context("Failed to read personality file")?;

    let personality: AgentPersonality = serde_json::from_str(&json)
        .context("Failed to parse personality JSON")?;

    Ok(personality)
}

/// Process CLAUDE.md template with personality variables
#[tauri::command]
pub fn inject_personality_to_claude_md(
    project_path: String,
    personality: AgentPersonality,
) -> Result<String, String> {
    inject_personality_to_claude_md_impl(&PathBuf::from(project_path), personality)
        .map_err(|e| e.to_string())
}

fn inject_personality_to_claude_md_impl(
    project_path: &Path,
    personality: AgentPersonality,
) -> Result<String> {
    let claude_md_path = project_path.join("CLAUDE.md");

    // Generate agent header
    let mut agent_header = String::new();
    agent_header.push_str("<!-- QUACK_AGENT_HEADER_START - DO NOT EDIT MANUALLY -->\n");
    agent_header.push_str(&format!("Your name is **{}**, and you're the **{}**.\n\n",
        personality.name, personality.role));
    agent_header.push_str(&format!("{}\n\n", personality.personality));
    agent_header.push_str(&format!("{}\n\n", personality.quirks));
    agent_header.push_str(&format!("**Communication Style:** {}\n\n", personality.communication_style));

    if !personality.specialties.is_empty() {
        agent_header.push_str("**Your Specialties:**\n");
        for specialty in &personality.specialties {
            agent_header.push_str(&format!("- {}\n", specialty));
        }
        agent_header.push('\n');
    }

    if !personality.skills.is_empty() {
        agent_header.push_str("**Skills to Remember:**\n");
        for skill in &personality.skills {
            agent_header.push_str(&format!("- {}\n", skill));
        }
        agent_header.push('\n');
    }

    if !personality.expressions.is_empty() {
        agent_header.push_str("**Favorite Expressions:**\n");
        for expression in &personality.expressions {
            agent_header.push_str(&format!("- {}\n", expression));
        }
        agent_header.push('\n');
    }

    // Add Protocol Droids section
    agent_header.push_str("**Protocol Droids Available:**\n");
    agent_header.push_str("You have access to specialized protocol droids (subagents) that assist you:\n");
    agent_header.push_str("- Located in `.claude/agents/` (both project-level and global)\n");
    agent_header.push_str("- These are technical specialists you invoke for specific expertise:\n");
    agent_header.push_str("  - `julie-designer` → Frontend/UI specialist\n");
    agent_header.push_str("  - `john-backend` → Backend/API specialist\n");
    agent_header.push_str("  - `giuseppe-git-manager` → Git workflow specialist\n");
    agent_header.push_str("  - `test-engineer` → Testing/QA specialist\n");
    agent_header.push_str("  - `security-auditor` → Security specialist\n");
    agent_header.push_str("- **Your role**: Coordinate the implementation, delegate to Protocol Droids for specialized work\n");
    agent_header.push_str("- **Remember**: You're a PM managing a feature/sprint on a specific branch, not a technical specialist!\n\n");

    agent_header.push_str("<!-- QUACK_AGENT_HEADER_END -->\n\n");

    // Read existing CLAUDE.md or create new one
    let existing_content = if claude_md_path.exists() {
        fs::read_to_string(&claude_md_path)
            .context("Failed to read CLAUDE.md")?
    } else {
        String::from("# CLAUDE.md\n\n**IMPORTANT: This CLAUDE.md file is your compass!** Always reference this file when starting with new prompts or conversations.\n\n")
    };

    // Remove old agent header if exists
    let user_content = if existing_content.contains("<!-- QUACK_AGENT_HEADER_START") {
        let start_marker = "<!-- QUACK_AGENT_HEADER_START";
        let end_marker = "<!-- QUACK_AGENT_HEADER_END -->\n\n";

        if let Some(start_idx) = existing_content.find(start_marker) {
            if let Some(end_idx) = existing_content.find(end_marker) {
                let before = &existing_content[..start_idx];
                let after = &existing_content[end_idx + end_marker.len()..];
                format!("{}{}", before, after)
            } else {
                existing_content
            }
        } else {
            existing_content
        }
    } else {
        existing_content
    };

    // Inject new agent header
    let final_content = if user_content.starts_with("# CLAUDE.md") {
        // Insert after the main header
        let lines: Vec<&str> = user_content.lines().collect();
        let mut result = String::new();

        // Add first few lines (header)
        let header_end = lines.iter().position(|&line| line.is_empty()).unwrap_or(2);
        for (_i, line) in lines.iter().enumerate().take(header_end + 1) {
            result.push_str(line);
            result.push('\n');
        }

        // Add agent header
        result.push_str(&agent_header);

        // Add rest of content
        for line in lines.iter().skip(header_end + 1) {
            result.push_str(line);
            result.push('\n');
        }

        result
    } else {
        format!("{}{}", agent_header, user_content)
    };

    // Write updated CLAUDE.md
    fs::write(&claude_md_path, &final_content)
        .context("Failed to write CLAUDE.md")?;

    Ok(final_content)
}
