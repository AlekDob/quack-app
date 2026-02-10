use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use anyhow::{Result, Context};
use uuid::Uuid;

use crate::personality::{AgentPersonality, load_agent_personality};

// ============================================
// Team Structs
// ============================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TeamMember {
    pub agent_id: String,
    pub name: String,
    pub role: String,
    pub communication_style: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub selected_skills: Option<Vec<String>>,
    pub is_lead: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TeamConfig {
    pub id: String,
    pub name: String,
    pub project_path: String,
    pub lead_agent_id: String,
    pub members: Vec<TeamMember>,
    pub created_at: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub task_description: Option<String>,
}

// ============================================
// Path Helpers
// ============================================

fn get_teams_dir(project_path: &Path) -> PathBuf {
    project_path.join(".quack").join("teams")
}

fn get_team_file(project_path: &Path, team_id: &str) -> PathBuf {
    get_teams_dir(project_path).join(format!("{}.json", team_id))
}

// ============================================
// Roster Markers
// ============================================

const ROSTER_START: &str = "<!-- QUACK_TEAM_ROSTER_START -->";
const ROSTER_END: &str = "<!-- QUACK_TEAM_ROSTER_END -->";

// ============================================
// Team CRUD Commands
// ============================================

#[tauri::command]
pub fn create_team(
    project_path: String,
    team_name: String,
    lead_agent_id: String,
    member_agent_ids: Vec<String>,
    task_description: Option<String>,
) -> Result<TeamConfig, String> {
    create_team_impl(
        &PathBuf::from(&project_path),
        &team_name,
        &lead_agent_id,
        &member_agent_ids,
        task_description.as_deref(),
    )
    .map_err(|e| e.to_string())
}

fn create_team_impl(
    project_path: &Path,
    team_name: &str,
    lead_agent_id: &str,
    member_agent_ids: &[String],
    task_description: Option<&str>,
) -> Result<TeamConfig> {
    let teams_dir = get_teams_dir(project_path);
    fs::create_dir_all(&teams_dir)
        .context("Failed to create teams directory")?;

    let team_id = Uuid::new_v4().to_string();
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;

    let project_str = project_path.to_string_lossy().to_string();

    // Build members from agent personalities
    let mut members = Vec::new();
    for agent_id in member_agent_ids {
        let personality = load_agent_personality(project_str.clone(), agent_id.clone())
            .unwrap_or_else(|_| AgentPersonality::default());

        members.push(TeamMember {
            agent_id: agent_id.clone(),
            name: personality.name.clone(),
            role: personality.role.clone(),
            communication_style: personality.communication_style.clone(),
            selected_skills: personality.selected_skills.clone(),
            is_lead: agent_id == lead_agent_id,
        });
    }

    let team = TeamConfig {
        id: team_id,
        name: team_name.to_string(),
        project_path: project_str,
        lead_agent_id: lead_agent_id.to_string(),
        members,
        created_at: now,
        task_description: task_description.map(|s| s.to_string()),
    };

    // Save team config
    let file_path = get_team_file(project_path, &team.id);
    let json = serde_json::to_string_pretty(&team)
        .context("Failed to serialize team config")?;
    fs::write(&file_path, json)
        .context("Failed to write team config file")?;

    // Inject roster into CLAUDE.md
    inject_team_roster_impl(project_path, &team)?;

    Ok(team)
}

#[tauri::command]
pub fn disband_team(
    project_path: String,
    team_id: String,
) -> Result<(), String> {
    disband_team_impl(&PathBuf::from(&project_path), &team_id)
        .map_err(|e| e.to_string())
}

fn disband_team_impl(project_path: &Path, _team_id: &str) -> Result<()> {
    // Remove roster from CLAUDE.md first
    remove_team_roster_impl(project_path)?;

    // Delete ALL team files (not just the specific one)
    // This prevents orphan files from previous create/disband cycles
    let teams_dir = get_teams_dir(project_path);
    if teams_dir.exists() {
        if let Ok(entries) = fs::read_dir(&teams_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|s| s.to_str()) == Some("json") {
                    let _ = fs::remove_file(&path);
                }
            }
        }
    }

    Ok(())
}

#[tauri::command]
pub fn get_active_team(
    project_path: String,
) -> Result<Option<TeamConfig>, String> {
    get_active_team_impl(&PathBuf::from(&project_path))
        .map_err(|e| e.to_string())
}

fn get_active_team_impl(project_path: &Path) -> Result<Option<TeamConfig>> {
    let teams_dir = get_teams_dir(project_path);
    if !teams_dir.exists() {
        return Ok(None);
    }

    // Return the most recent team (by created_at)
    let mut latest: Option<TeamConfig> = None;

    if let Ok(entries) = fs::read_dir(&teams_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                if let Ok(content) = fs::read_to_string(&path) {
                    if let Ok(team) = serde_json::from_str::<TeamConfig>(&content) {
                        match &latest {
                            None => latest = Some(team),
                            Some(current) if team.created_at > current.created_at => {
                                latest = Some(team);
                            }
                            _ => {}
                        }
                    }
                }
            }
        }
    }

    Ok(latest)
}

// ============================================
// CLAUDE.md Roster Injection
// ============================================

fn inject_team_roster_impl(
    project_path: &Path,
    team: &TeamConfig,
) -> Result<()> {
    let claude_md_path = project_path.join("CLAUDE.md");

    let existing = if claude_md_path.exists() {
        fs::read_to_string(&claude_md_path)
            .context("Failed to read CLAUDE.md")?
    } else {
        return Ok(()); // No CLAUDE.md, nothing to inject into
    };

    // Remove old roster if present
    let content = remove_roster_from_string(&existing);

    // Build roster block
    let roster = build_roster_block(team);

    // Insert roster after QUACK_AGENT_HEADER_END (if present) or at the end
    let final_content = if let Some(idx) = content.find("<!-- QUACK_AGENT_HEADER_END -->") {
        let end_marker = "<!-- QUACK_AGENT_HEADER_END -->";
        let insert_pos = idx + end_marker.len();
        // Find the end of the line (skip trailing newlines)
        let after = &content[insert_pos..];
        let skip = after.len() - after.trim_start_matches('\n').len();
        format!(
            "{}\n\n{}\n{}",
            &content[..insert_pos + skip],
            roster,
            &content[insert_pos + skip..]
        )
    } else {
        // Append at the end
        format!("{}\n\n{}\n", content.trim_end(), roster)
    };

    fs::write(&claude_md_path, final_content)
        .context("Failed to write CLAUDE.md")?;

    Ok(())
}

fn remove_team_roster_impl(project_path: &Path) -> Result<()> {
    let claude_md_path = project_path.join("CLAUDE.md");
    if !claude_md_path.exists() {
        return Ok(());
    }

    let content = fs::read_to_string(&claude_md_path)
        .context("Failed to read CLAUDE.md")?;

    if !content.contains(ROSTER_START) {
        return Ok(());
    }

    let cleaned = remove_roster_from_string(&content);
    fs::write(&claude_md_path, cleaned)
        .context("Failed to write CLAUDE.md")?;

    Ok(())
}

fn remove_roster_from_string(content: &str) -> String {
    if let Some(start_idx) = content.find(ROSTER_START) {
        let end_marker = format!("{}\n", ROSTER_END);
        if let Some(end_idx) = content.find(&end_marker) {
            let before = content[..start_idx].trim_end_matches('\n');
            let after = &content[end_idx + end_marker.len()..];
            return format!("{}\n{}", before, after);
        }
        // Fallback: end marker without trailing newline
        if let Some(end_idx) = content.find(ROSTER_END) {
            let before = content[..start_idx].trim_end_matches('\n');
            let after = &content[end_idx + ROSTER_END.len()..];
            return format!("{}\n{}", before, after);
        }
    }
    content.to_string()
}

fn build_roster_block(team: &TeamConfig) -> String {
    let mut block = String::new();
    block.push_str(ROSTER_START);
    block.push('\n');
    block.push_str(&format!("## Agent Team: \"{}\"\n\n", team.name));

    if let Some(desc) = &team.task_description {
        block.push_str(&format!("**Task:** {}\n\n", desc));
    }

    for member in &team.members {
        let prefix = if member.is_lead {
            "### Team Lead"
        } else {
            "### Teammate"
        };
        block.push_str(&format!("{}: {}\n", prefix, member.name));
        block.push_str(&format!(
            "**Role:** {} | **Style:** {}\n",
            member.role, member.communication_style
        ));

        if let Some(skills) = &member.selected_skills {
            if !skills.is_empty() {
                block.push_str(&format!(
                    "**Preferred Skills:** {}\n",
                    skills.join(", ")
                ));
            }
        }
        block.push('\n');
    }

    block.push_str(ROSTER_END);
    block
}
