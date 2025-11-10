use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use anyhow::{Result, Context};

/// REDESIGNED: More practical and focused on actual development needs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentPersonality {
    pub id: String,
    pub name: String,
    pub role: String, // Mission/Role (e.g., "Backend Performance Specialist")

    // New practical fields
    #[serde(rename = "technicalContext", skip_serializing_if = "Option::is_none")]
    pub technical_context: Option<String>, // Free-form technical context
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rules: Option<Vec<String>>, // Rules & best practices
    #[serde(rename = "communicationStyle")]
    pub communication_style: String, // How the agent communicates
    #[serde(rename = "customNotes", skip_serializing_if = "Option::is_none")]
    pub custom_notes: Option<String>, // Additional free-form notes

    // Legacy fields (kept for backwards compatibility)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub personality: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub quirks: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub specialties: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub skills: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expressions: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub intro: Option<String>,
}

impl Default for AgentPersonality {
    fn default() -> Self {
        Self {
            id: "default".to_string(),
            name: "Jack".to_string(),
            role: "Product Manager at Quack Agency".to_string(),
            technical_context: Some("Coordinates feature development across multiple tech stacks (Tauri, Next.js, Flutter, etc.)".to_string()),
            rules: Some(vec![
                "Always coordinate with specialized Protocol Droids for technical work".to_string(),
                "Respond with frequent 'quack quack' expressions".to_string(),
                "Focus on planning and coordination, not implementation".to_string(),
            ]),
            communication_style: "friendly".to_string(),
            custom_notes: Some("Experienced PM specializing in feature delivery and team coordination. Works on specific branches and delegates to specialists.".to_string()),
            // Legacy fields (backwards compatibility)
            personality: Some("You coordinate feature development and sprint planning. You work on specific branches and invoke Protocol Droids when you need specialized expertise.".to_string()),
            quirks: Some("You always respond with frequent 'quack quack' expressions and focus on coordinating work rather than doing it yourself.".to_string()),
            specialties: Some(vec![]),
            skills: Some(vec![]),
            expressions: Some(vec!["Quack quack!".to_string(), "Let me coordinate this with the right Protocol Droid!".to_string()]),
            intro: Some("Experienced PM specializing in feature delivery and team coordination".to_string()),
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

/// Helper function to load agents from a directory
fn load_agents_from_dir(agents_dir: &Path) -> Vec<(String, String)> {
    let mut agents = Vec::new();

    if !agents_dir.exists() {
        return agents;
    }

    if let Ok(entries) = fs::read_dir(agents_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("md") {
                match fs::read_to_string(&path) {
                    Ok(content) => {
                        // Parse name and description from frontmatter
                        let mut name = None;
                        let mut description = None;
                        let mut in_frontmatter = false;

                        for (idx, line) in content.lines().enumerate() {
                            // Skip empty lines at the start
                            if idx == 0 && line.trim().is_empty() {
                                continue;
                            }

                            // Handle YAML frontmatter delimiters
                            if line.trim() == "---" {
                                if idx == 0 || (idx == 1 && content.lines().next().map_or(false, |l| l.trim().is_empty())) {
                                    in_frontmatter = true;
                                    continue;
                                } else if in_frontmatter {
                                    // End of frontmatter
                                    break;
                                }
                            }

                            let trimmed = line.trim();

                            if trimmed.starts_with("name:") {
                                let value = trimmed.trim_start_matches("name:").trim();
                                if !value.is_empty() {
                                    name = Some(value.to_string());
                                }
                            } else if trimmed.starts_with("description:") {
                                let value = trimmed.trim_start_matches("description:").trim();
                                // Extract first part before | if present
                                let desc = value.split('|')
                                    .next()
                                    .unwrap_or(value)
                                    .trim();
                                if !desc.is_empty() {
                                    description = Some(desc.to_string());
                                }
                            }

                            // Stop after reasonable number of lines
                            if idx > 20 {
                                break;
                            }

                            if name.is_some() && description.is_some() {
                                break;
                            }
                        }

                        match (name, description) {
                            (Some(n), Some(d)) => {
                                agents.push((n, d));
                            }
                            (None, Some(_)) => {
                                eprintln!("⚠️  Agent file {:?} missing 'name' field", path.file_name().unwrap_or_default());
                            }
                            (Some(_), None) => {
                                eprintln!("⚠️  Agent file {:?} missing 'description' field", path.file_name().unwrap_or_default());
                            }
                            (None, None) => {
                                eprintln!("⚠️  Agent file {:?} missing both 'name' and 'description' fields", path.file_name().unwrap_or_default());
                            }
                        }
                    }
                    Err(e) => {
                        eprintln!("⚠️  Failed to read agent file {:?}: {}", path.file_name().unwrap_or_default(), e);
                    }
                }
            }
        }
    }

    agents
}

/// Helper function to load skills from a directory
/// Skills are in subdirectories, each containing a SKILL.md file
fn load_skills_from_dir(skills_dir: &Path) -> Vec<(String, String)> {
    let mut skills = Vec::new();

    if !skills_dir.exists() {
        return skills;
    }

    if let Ok(entries) = fs::read_dir(skills_dir) {
        for entry in entries.flatten() {
            let skill_dir_path = entry.path();

            // Only process directories
            if !skill_dir_path.is_dir() {
                continue;
            }

            // Look for SKILL.md inside the skill directory
            let skill_md_path = skill_dir_path.join("SKILL.md");
            if !skill_md_path.exists() {
                eprintln!("⚠️  Skill directory {:?} missing SKILL.md file", skill_dir_path.file_name().unwrap_or_default());
                continue;
            }

            match fs::read_to_string(&skill_md_path) {
                Ok(content) => {
                    // Parse name and description from frontmatter
                    let mut name = None;
                    let mut description = None;
                    let mut in_frontmatter = false;

                    for (idx, line) in content.lines().enumerate() {
                        // Skip empty lines at the start
                        if idx == 0 && line.trim().is_empty() {
                            continue;
                        }

                        // Handle YAML frontmatter delimiters
                        if line.trim() == "---" {
                            if idx == 0 || (idx == 1 && content.lines().next().map_or(false, |l| l.trim().is_empty())) {
                                in_frontmatter = true;
                                continue;
                            } else if in_frontmatter {
                                // End of frontmatter
                                break;
                            }
                        }

                        let trimmed = line.trim();

                        if trimmed.starts_with("name:") {
                            let value = trimmed.trim_start_matches("name:").trim();
                            if !value.is_empty() {
                                name = Some(value.to_string());
                            }
                        } else if trimmed.starts_with("description:") {
                            let value = trimmed.trim_start_matches("description:").trim();
                            // Extract first part before | if present
                            let desc = value.split('|')
                                .next()
                                .unwrap_or(value)
                                .trim();
                            if !desc.is_empty() {
                                description = Some(desc.to_string());
                            }
                        }

                        // Stop after reasonable number of lines
                        if idx > 20 {
                            break;
                        }

                        if name.is_some() && description.is_some() {
                            break;
                        }
                    }

                    match (name, description) {
                        (Some(n), Some(d)) => {
                            skills.push((n, d));
                        }
                        (None, Some(_)) => {
                            eprintln!("⚠️  Skill file {:?} missing 'name' field", skill_md_path);
                        }
                        (Some(_), None) => {
                            eprintln!("⚠️  Skill file {:?} missing 'description' field", skill_md_path);
                        }
                        (None, None) => {
                            eprintln!("⚠️  Skill file {:?} missing both 'name' and 'description' fields", skill_md_path);
                        }
                    }
                }
                Err(e) => {
                    eprintln!("⚠️  Failed to read skill file {:?}: {}", skill_md_path, e);
                }
            }
        }
    }

    skills
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

    // Generate agent header with NEW structure
    let mut agent_header = String::new();
    agent_header.push_str("<!-- QUACK_AGENT_HEADER_START - DO NOT EDIT MANUALLY -->\n");
    agent_header.push_str(&format!("Your name is **{}**, and you're the **{}**.\n\n",
        personality.name, personality.role));

    // Technical Context
    if let Some(technical_context) = &personality.technical_context {
        if !technical_context.is_empty() {
            agent_header.push_str(&format!("**Technical Context:**\n{}\n\n", technical_context));
        }
    }

    // Rules & Best Practices
    if let Some(rules) = &personality.rules {
        if !rules.is_empty() {
            agent_header.push_str("**Rules & Best Practices:**\n");
            for rule in rules {
                agent_header.push_str(&format!("- {}\n", rule));
            }
            agent_header.push('\n');
        }
    }

    // Communication Style
    agent_header.push_str(&format!("**Communication Style:** {}\n\n", personality.communication_style));

    // Custom Notes
    if let Some(custom_notes) = &personality.custom_notes {
        if !custom_notes.is_empty() {
            agent_header.push_str(&format!("**Notes:**\n{}\n\n", custom_notes));
        }
    }

    // Add Protocol Droids section
    agent_header.push_str("**Protocol Droids Available:**\n");
    agent_header.push_str("You have access to specialized protocol droids (subagents) that assist you:\n\n");

    // Load project-specific Protocol Droids from .claude/agents/
    let project_agents_dir = project_path.join(".claude").join("agents");
    let project_droids = load_agents_from_dir(&project_agents_dir);

    // Add project-specific droids first
    if !project_droids.is_empty() {
        agent_header.push_str("**Project-Specific Protocol Droids:**\n");
        for (name, desc) in project_droids {
            agent_header.push_str(&format!("  - `{}` → {}\n", name, desc));
        }
        agent_header.push('\n');
    }

    // Load global Protocol Droids from ~/.claude/agents/
    if let Some(home_dir) = std::env::var_os("HOME") {
        let global_agents_dir = PathBuf::from(home_dir).join(".claude").join("agents");
        let global_droids = load_agents_from_dir(&global_agents_dir);

        if !global_droids.is_empty() {
            agent_header.push_str("**Global Protocol Droids:**\n");
            for (name, desc) in global_droids {
                agent_header.push_str(&format!("  - `{}` → {}\n", name, desc));
            }
            agent_header.push('\n');
        }
    }
    agent_header.push_str("- **Your role**: Coordinate the implementation, delegate to Protocol Droids for specialized work\n");
    agent_header.push_str("- **Remember**: You're a PM managing a feature/sprint on a specific branch, not a technical specialist!\n\n");

    // Add Skills section
    agent_header.push_str("**Skills Available:**\n");
    agent_header.push_str("You have access to specialized skills that provide domain expertise:\n\n");

    // Load project-specific Skills from .claude/skills/
    let project_skills_dir = project_path.join(".claude").join("skills");
    let project_skills = load_skills_from_dir(&project_skills_dir);

    // Add project-specific skills first
    if !project_skills.is_empty() {
        agent_header.push_str("**Project-Specific Skills:**\n");
        for (name, desc) in project_skills {
            agent_header.push_str(&format!("  - `{}` → {}\n", name, desc));
        }
        agent_header.push('\n');
    }

    // Load global Skills from ~/.claude/skills/
    if let Some(home_dir) = std::env::var_os("HOME") {
        let global_skills_dir = PathBuf::from(home_dir).join(".claude").join("skills");
        let global_skills = load_skills_from_dir(&global_skills_dir);

        if !global_skills.is_empty() {
            agent_header.push_str("**Global Skills:**\n");
            for (name, desc) in global_skills {
                agent_header.push_str(&format!("  - `{}` → {}\n", name, desc));
            }
            agent_header.push('\n');
        }
    }
    agent_header.push_str("- **Usage**: Invoke skills when you need specialized knowledge or guidance in specific domains\n\n");

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
