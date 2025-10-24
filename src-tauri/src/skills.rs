use std::{fs, path::PathBuf};

use anyhow::{anyhow, Context, Result};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct SkillInfo {
    pub name: String,
    pub description: String,
    pub file_path: String,
    pub scope: String, // "global" or "project"
}

#[derive(Serialize, Clone)]
pub struct SkillDetails {
    pub name: String,
    pub description: String,
    pub file_path: String,
    pub content: String,
}

/// List all skills from .claude/skills/ directory
#[tauri::command]
pub fn list_skills(working_dir: Option<String>) -> Result<Vec<SkillInfo>, String> {
    list_skills_impl(working_dir).map_err(|err| err.to_string())
}

/// Get detailed information about a specific skill
#[tauri::command]
pub fn get_skill_details(
    name: String,
    working_dir: Option<String>,
    scope: Option<String>,
) -> Result<SkillDetails, String> {
    get_skill_details_impl(name, working_dir, scope).map_err(|err| err.to_string())
}

/// Check if .claude/skills directory exists in the given path
#[tauri::command]
pub fn check_skills_directory(working_dir: Option<String>) -> Result<bool, String> {
    check_skills_directory_impl(working_dir).map_err(|err| err.to_string())
}

fn list_skills_impl(working_dir: Option<String>) -> Result<Vec<SkillInfo>> {
    let mut skills = Vec::new();

    // 1. Read GLOBAL skills from ~/.claude/skills/
    if let Ok(home_dir) = std::env::var("HOME") {
        let global_skills_dir = PathBuf::from(home_dir).join(".claude").join("skills");

        if global_skills_dir.exists() {
            log::info!("Found global skills directory at: {:?}", global_skills_dir);

            if let Ok(entries) = fs::read_dir(&global_skills_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();

                    // Check if it's a direct .md file
                    if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("md") {
                        match parse_skill_file_with_scope(&path, "global") {
                            Ok(skill_info) => {
                                log::info!("Successfully parsed global skill: {}", skill_info.name);
                                skills.push(skill_info);
                            }
                            Err(e) => {
                                log::error!("Failed to parse global skill file {:?}: {}", path, e);
                            }
                        }
                    }
                    // Check if it's a directory with SKILL.md inside
                    else if path.is_dir() {
                        let skill_md = path.join("SKILL.md");
                        if skill_md.exists() {
                            match parse_skill_file_with_scope(&skill_md, "global") {
                                Ok(skill_info) => {
                                    log::info!("Successfully parsed global skill from directory: {}", skill_info.name);
                                    skills.push(skill_info);
                                }
                                Err(e) => {
                                    log::error!("Failed to parse global skill directory {:?}: {}", path, e);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // 2. Read PROJECT skills from .claude/skills/
    let current = if let Some(dir) = working_dir {
        PathBuf::from(dir)
    } else {
        std::env::current_dir()
            .context("Unable to get current working directory")?
    };

    let project_skills_dir = current.join(".claude").join("skills");

    if project_skills_dir.exists() {
        log::info!("Found project skills directory at: {:?}", project_skills_dir);

        let entries = fs::read_dir(&project_skills_dir)
            .with_context(|| format!("Unable to read skills directory: {:?}", project_skills_dir))?;

        for entry in entries {
            let entry = entry?;
            let path = entry.path();

            // Check if it's a direct .md file
            if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("md") {
                match parse_skill_file_with_scope(&path, "project") {
                    Ok(skill_info) => {
                        log::info!("Successfully parsed project skill: {}", skill_info.name);
                        skills.push(skill_info);
                    }
                    Err(e) => {
                        log::error!("Failed to parse project skill file {:?}: {}", path, e);
                    }
                }
            }
            // Check if it's a directory with SKILL.md inside
            else if path.is_dir() {
                let skill_md = path.join("SKILL.md");
                if skill_md.exists() {
                    match parse_skill_file_with_scope(&skill_md, "project") {
                        Ok(skill_info) => {
                            log::info!("Successfully parsed project skill from directory: {}", skill_info.name);
                            skills.push(skill_info);
                        }
                        Err(e) => {
                            log::error!("Failed to parse project skill directory {:?}: {}", path, e);
                        }
                    }
                }
            }
        }
    }

    log::info!("Total skills found: {} (global + project)", skills.len());

    // Sort skills: first by scope (global first), then by name
    skills.sort_by(|a, b| {
        match (a.scope.as_str(), b.scope.as_str()) {
            ("global", "project") => std::cmp::Ordering::Less,
            ("project", "global") => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    Ok(skills)
}

fn get_skill_details_impl(
    name: String,
    working_dir: Option<String>,
    scope: Option<String>,
) -> Result<SkillDetails> {
    // Determine which directory to use based on scope
    let skills_dir = match scope.as_deref() {
        Some("global") => {
            // Global skills: ~/.claude/skills/
            let home = std::env::var("HOME")
                .context("Unable to get HOME directory")?;
            PathBuf::from(home).join(".claude").join("skills")
        }
        _ => {
            // Project skills: .claude/skills/ in working directory
            let current = if let Some(dir) = working_dir {
                PathBuf::from(dir)
            } else {
                std::env::current_dir()
                    .context("Unable to get current working directory")?
            };
            current.join(".claude").join("skills")
        }
    };

    if !skills_dir.exists() {
        return Err(anyhow!(
            "Skills directory not found at: {:?}",
            skills_dir
        ));
    }

    // Try to find the skill file - check both patterns:
    // 1. Direct .md file: skill-name.md
    // 2. Directory with SKILL.md: skill-name/SKILL.md

    let direct_skill_path = skills_dir.join(format!("{}.md", name));
    let dir_skill_path = skills_dir.join(&name).join("SKILL.md");

    let skill_path = if direct_skill_path.exists() {
        direct_skill_path
    } else if dir_skill_path.exists() {
        dir_skill_path
    } else {
        return Err(anyhow!(
            "Skill file not found: {} (tried both {}.md and {}/SKILL.md) in {:?}",
            name,
            name,
            name,
            skills_dir
        ));
    };

    parse_skill_file_with_content(&skill_path)
}

/// Parse skill file with scope - extracts name and description from content
fn parse_skill_file_with_scope(path: &PathBuf, scope: &str) -> Result<SkillInfo> {
    let content = fs::read_to_string(path)
        .with_context(|| format!("Unable to read skill file: {:?}", path))?;

    // Extract name from filename or parent directory name
    let name = if path.file_name().and_then(|s| s.to_str()) == Some("SKILL.md") {
        // If file is SKILL.md, use parent directory name
        path.parent()
            .and_then(|p| p.file_name())
            .and_then(|s| s.to_str())
            .ok_or_else(|| anyhow!("Invalid skill directory: {:?}", path))?
            .to_string()
    } else {
        // Otherwise use filename without .md extension
        path.file_stem()
            .and_then(|s| s.to_str())
            .ok_or_else(|| anyhow!("Invalid skill filename: {:?}", path))?
            .to_string()
    };

    // Extract description from first line (if it starts with "# ")
    let description = content
        .lines()
        .find(|line| line.starts_with("# "))
        .map(|line| line.trim_start_matches("# ").to_string())
        .unwrap_or_else(|| "No description".to_string());

    Ok(SkillInfo {
        name,
        description,
        file_path: path.to_string_lossy().to_string(),
        scope: scope.to_string(),
    })
}

/// Parse skill file with full content
fn parse_skill_file_with_content(path: &PathBuf) -> Result<SkillDetails> {
    let content = fs::read_to_string(path)
        .with_context(|| format!("Unable to read skill file: {:?}", path))?;

    // Extract name from filename or parent directory name
    let name = if path.file_name().and_then(|s| s.to_str()) == Some("SKILL.md") {
        // If file is SKILL.md, use parent directory name
        path.parent()
            .and_then(|p| p.file_name())
            .and_then(|s| s.to_str())
            .ok_or_else(|| anyhow!("Invalid skill directory: {:?}", path))?
            .to_string()
    } else {
        // Otherwise use filename without .md extension
        path.file_stem()
            .and_then(|s| s.to_str())
            .ok_or_else(|| anyhow!("Invalid skill filename: {:?}", path))?
            .to_string()
    };

    // Extract description from first line (if it starts with "# ")
    let description = content
        .lines()
        .find(|line| line.starts_with("# "))
        .map(|line| line.trim_start_matches("# ").to_string())
        .unwrap_or_else(|| "No description".to_string());

    Ok(SkillDetails {
        name,
        description,
        file_path: path.to_string_lossy().to_string(),
        content,
    })
}

fn check_skills_directory_impl(working_dir: Option<String>) -> Result<bool> {
    // Use provided working directory or current directory
    let current = if let Some(dir) = working_dir {
        PathBuf::from(dir)
    } else {
        std::env::current_dir()
            .context("Unable to get current working directory")?
    };

    // Check for .claude/skills ONLY in the specified directory (don't traverse up)
    let skills_dir = current.join(".claude").join("skills");
    Ok(skills_dir.exists())
}
