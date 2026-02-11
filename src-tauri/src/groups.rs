use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

// ============================================
// Group Structs
// ============================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectGroupMember {
    pub path: String,
    pub role: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectGroup {
    pub id: String,
    pub name: String,
    pub projects: Vec<ProjectGroupMember>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    pub created_at: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
}

// ============================================
// Path Helpers
// ============================================

fn get_groups_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("/tmp"))
        .join(".quack")
        .join("groups")
}

fn get_group_dir(group_id: &str) -> PathBuf {
    get_groups_dir().join(group_id)
}

fn get_group_file(group_id: &str) -> PathBuf {
    get_group_dir(group_id).join("group.json")
}

fn get_group_claude_md(group_id: &str) -> PathBuf {
    get_group_dir(group_id).join("CLAUDE.md")
}

/// Slugify a group name into a valid directory name
fn slugify(name: &str) -> String {
    name.to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '-' { c } else { '-' })
        .collect::<String>()
        .trim_matches('-')
        .to_string()
}

// ============================================
// CLAUDE.md Injection into Project CLAUDE.md
// ============================================

const GROUP_CONTEXT_START: &str = "<!-- QUACK_GROUP_CONTEXT_START -->";
const GROUP_CONTEXT_END: &str = "<!-- QUACK_GROUP_CONTEXT_END -->";

/// Build the group context block to inject into each project's CLAUDE.md
fn build_group_context_block(group: &ProjectGroup, current_project_path: &str) -> String {
    let mut block = String::new();
    block.push_str(GROUP_CONTEXT_START);
    block.push_str("\n");
    block.push_str(&format!("## Project Group: {}\n\n", group.name));
    block.push_str("This project belongs to a multi-project group. You have access to sibling projects:\n\n");
    block.push_str("| Project | Path | Role |\n");
    block.push_str("|---------|------|------|\n");

    for project in &group.projects {
        let label = project.label.as_deref().unwrap_or_else(|| {
            Path::new(&project.path)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("unknown")
        });
        let marker = if project.path == current_project_path { " **(current)**" } else { "" };
        block.push_str(&format!(
            "| {}{} | `{}` | {} |\n",
            label, marker, project.path, project.role
        ));
    }

    block.push_str("\nWhen working cross-project, read the sibling project's CLAUDE.md for context.\n\n");
    block.push_str(GROUP_CONTEXT_END);
    block
}

/// Remove existing group context block from content
fn remove_group_context(content: &str) -> String {
    if let Some(start_idx) = content.find(GROUP_CONTEXT_START) {
        let end_marker = format!("{}\n", GROUP_CONTEXT_END);
        if let Some(end_idx) = content.find(&end_marker) {
            let before = content[..start_idx].trim_end_matches('\n');
            let after = &content[end_idx + end_marker.len()..];
            return format!("{}\n{}", before, after);
        }
        // Fallback: end marker without trailing newline
        if let Some(end_idx) = content.find(GROUP_CONTEXT_END) {
            let before = content[..start_idx].trim_end_matches('\n');
            let after = &content[end_idx + GROUP_CONTEXT_END.len()..];
            return format!("{}\n{}", before, after);
        }
    }
    content.to_string()
}

/// Inject group context into a project's CLAUDE.md
fn inject_group_context(project_path: &Path, group: &ProjectGroup) -> Result<(), String> {
    let claude_md_path = project_path.join("CLAUDE.md");

    if !claude_md_path.exists() {
        return Ok(()); // No CLAUDE.md, nothing to inject into
    }

    let existing = fs::read_to_string(&claude_md_path)
        .map_err(|e| format!("Failed to read CLAUDE.md at {}: {}", claude_md_path.display(), e))?;

    // Remove old group context if present
    let content = remove_group_context(&existing);

    // Build new group context block
    let project_path_str = project_path.to_string_lossy().to_string();
    let block = build_group_context_block(group, &project_path_str);

    // Insert after QUACK_TEAM_ROSTER_END, or QUACK_AGENT_HEADER_END, or at the top
    let final_content = if let Some(idx) = content.find("<!-- QUACK_TEAM_ROSTER_END -->") {
        let marker = "<!-- QUACK_TEAM_ROSTER_END -->";
        let insert_pos = idx + marker.len();
        let after = &content[insert_pos..];
        let skip = after.len() - after.trim_start_matches('\n').len();
        format!(
            "{}\n\n{}\n{}",
            &content[..insert_pos + skip],
            block,
            &content[insert_pos + skip..]
        )
    } else if let Some(idx) = content.find("<!-- QUACK_AGENT_HEADER_END -->") {
        let marker = "<!-- QUACK_AGENT_HEADER_END -->";
        let insert_pos = idx + marker.len();
        let after = &content[insert_pos..];
        let skip = after.len() - after.trim_start_matches('\n').len();
        format!(
            "{}\n\n{}\n{}",
            &content[..insert_pos + skip],
            block,
            &content[insert_pos + skip..]
        )
    } else {
        // Prepend at the top (before existing content)
        format!("{}\n\n{}", block, content)
    };

    fs::write(&claude_md_path, final_content)
        .map_err(|e| format!("Failed to write CLAUDE.md: {}", e))?;

    Ok(())
}

/// Remove group context from a project's CLAUDE.md
fn remove_group_context_from_project(project_path: &Path) -> Result<(), String> {
    let claude_md_path = project_path.join("CLAUDE.md");
    if !claude_md_path.exists() {
        return Ok(());
    }

    let content = fs::read_to_string(&claude_md_path)
        .map_err(|e| format!("Failed to read CLAUDE.md: {}", e))?;

    if !content.contains(GROUP_CONTEXT_START) {
        return Ok(());
    }

    let cleaned = remove_group_context(&content);
    fs::write(&claude_md_path, cleaned)
        .map_err(|e| format!("Failed to write CLAUDE.md: {}", e))?;

    Ok(())
}

// ============================================
// CLAUDE.md Generation (Reference-Only for ~/.quack/groups/)
// ============================================

fn generate_group_claude_md(group: &ProjectGroup) -> String {
    let mut md = String::new();

    md.push_str(&format!("# Project Group: {}\n\n", group.name));
    md.push_str("This agent operates within a multi-project group.\n");
    md.push_str("Consult each project's CLAUDE.md for specific context.\n\n");

    md.push_str("## Projects\n\n");
    md.push_str("| Role | Project | CLAUDE.md |\n");
    md.push_str("|------|---------|----------|\n");

    for project in &group.projects {
        let label = project.label.as_deref().unwrap_or_else(|| {
            Path::new(&project.path)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("unknown")
        });
        md.push_str(&format!(
            "| {} | {} | {}/CLAUDE.md |\n",
            project.role, label, project.path
        ));
    }

    if let Some(notes) = &group.notes {
        md.push_str(&format!("\n## Cross-Project Notes\n\n{}\n", notes));
    }

    md
}

// ============================================
// Group CRUD Commands
// ============================================

#[tauri::command]
pub fn create_group(
    name: String,
    projects: Vec<ProjectGroupMember>,
    color: Option<String>,
    notes: Option<String>,
) -> Result<ProjectGroup, String> {
    if projects.len() < 2 {
        return Err("A group must contain at least 2 projects".to_string());
    }

    // Validate that all project paths exist
    for project in &projects {
        if !Path::new(&project.path).exists() {
            return Err(format!("Project path does not exist: {}", project.path));
        }
    }

    let id = slugify(&name);
    let group_dir = get_group_dir(&id);

    // Create group directory
    fs::create_dir_all(&group_dir)
        .map_err(|e| format!("Failed to create group directory: {}", e))?;

    let group = ProjectGroup {
        id: id.clone(),
        name,
        projects,
        color,
        created_at: chrono::Utc::now().timestamp_millis(),
        notes,
    };

    // Save group.json
    let json = serde_json::to_string_pretty(&group)
        .map_err(|e| format!("Failed to serialize group: {}", e))?;
    fs::write(get_group_file(&id), &json)
        .map_err(|e| format!("Failed to write group file: {}", e))?;

    // Generate CLAUDE.md (reference-only, with links to each project's CLAUDE.md)
    let claude_md = generate_group_claude_md(&group);
    fs::write(get_group_claude_md(&id), &claude_md)
        .map_err(|e| format!("Failed to write group CLAUDE.md: {}", e))?;

    // Inject group context into each project's CLAUDE.md
    for project in &group.projects {
        let project_path = Path::new(&project.path);
        if let Err(e) = inject_group_context(project_path, &group) {
            eprintln!("Warning: failed to inject group context into {}: {}", project.path, e);
        }
    }

    Ok(group)
}

#[tauri::command]
pub fn list_groups() -> Result<Vec<ProjectGroup>, String> {
    let groups_dir = get_groups_dir();

    if !groups_dir.exists() {
        return Ok(vec![]);
    }

    let mut groups = Vec::new();
    let entries = fs::read_dir(&groups_dir)
        .map_err(|e| format!("Failed to read groups directory: {}", e))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            let group_file = path.join("group.json");
            if group_file.exists() {
                let content = fs::read_to_string(&group_file)
                    .map_err(|e| format!("Failed to read group file: {}", e))?;
                if let Ok(group) = serde_json::from_str::<ProjectGroup>(&content) {
                    groups.push(group);
                }
            }
        }
    }

    // Sort by creation time, newest first
    groups.sort_by(|a, b| b.created_at.cmp(&a.created_at));

    Ok(groups)
}

#[tauri::command]
pub fn get_group(group_id: String) -> Result<Option<ProjectGroup>, String> {
    let group_file = get_group_file(&group_id);

    if !group_file.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&group_file)
        .map_err(|e| format!("Failed to read group file: {}", e))?;
    let group: ProjectGroup = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse group file: {}", e))?;

    Ok(Some(group))
}

#[tauri::command]
pub fn update_group(
    group_id: String,
    name: Option<String>,
    projects: Option<Vec<ProjectGroupMember>>,
    color: Option<String>,
    notes: Option<String>,
) -> Result<ProjectGroup, String> {
    let group_file = get_group_file(&group_id);

    if !group_file.exists() {
        return Err(format!("Group not found: {}", group_id));
    }

    let content = fs::read_to_string(&group_file)
        .map_err(|e| format!("Failed to read group file: {}", e))?;
    let mut group: ProjectGroup = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse group file: {}", e))?;

    // Apply updates
    if let Some(n) = name {
        group.name = n;
    }
    if let Some(p) = projects {
        if p.len() < 2 {
            return Err("A group must contain at least 2 projects".to_string());
        }
        group.projects = p;
    }
    if let Some(c) = color {
        group.color = Some(c);
    }
    if let Some(n) = notes {
        group.notes = Some(n);
    }

    // Save updated group.json
    let json = serde_json::to_string_pretty(&group)
        .map_err(|e| format!("Failed to serialize group: {}", e))?;
    fs::write(&group_file, &json)
        .map_err(|e| format!("Failed to write group file: {}", e))?;

    // Regenerate CLAUDE.md
    let claude_md = generate_group_claude_md(&group);
    fs::write(get_group_claude_md(&group_id), &claude_md)
        .map_err(|e| format!("Failed to write group CLAUDE.md: {}", e))?;

    // Re-inject group context into each project's CLAUDE.md
    for project in &group.projects {
        let project_path = Path::new(&project.path);
        if let Err(e) = inject_group_context(project_path, &group) {
            eprintln!("Warning: failed to inject group context into {}: {}", project.path, e);
        }
    }

    Ok(group)
}

#[tauri::command]
pub fn delete_group(group_id: String) -> Result<(), String> {
    let group_dir = get_group_dir(&group_id);

    if !group_dir.exists() {
        return Err(format!("Group not found: {}", group_id));
    }

    // Read group data before deleting to clean up project CLAUDE.md files
    let group_file = get_group_file(&group_id);
    if let Ok(content) = fs::read_to_string(&group_file) {
        if let Ok(group) = serde_json::from_str::<ProjectGroup>(&content) {
            for project in &group.projects {
                let project_path = Path::new(&project.path);
                if let Err(e) = remove_group_context_from_project(project_path) {
                    eprintln!("Warning: failed to remove group context from {}: {}", project.path, e);
                }
            }
        }
    }

    fs::remove_dir_all(&group_dir)
        .map_err(|e| format!("Failed to delete group directory: {}", e))?;

    Ok(())
}

/// Re-inject group context into all projects for all groups.
/// Call this at app startup to ensure CLAUDE.md files are in sync.
#[tauri::command]
pub fn sync_group_contexts() -> Result<u32, String> {
    let groups = list_groups()?;
    let mut count: u32 = 0;

    for group in &groups {
        for project in &group.projects {
            let project_path = Path::new(&project.path);
            if let Err(e) = inject_group_context(project_path, group) {
                eprintln!("Warning: failed to sync group context for {}: {}", project.path, e);
            } else {
                count += 1;
            }
        }
    }

    Ok(count)
}

/// Find which group a project belongs to (if any)
#[tauri::command]
pub fn get_group_for_project(project_path: String) -> Result<Option<ProjectGroup>, String> {
    let groups = list_groups()?;

    for group in groups {
        if group.projects.iter().any(|p| p.path == project_path) {
            return Ok(Some(group));
        }
    }

    Ok(None)
}
