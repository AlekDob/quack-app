use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ContextFile {
    pub name: String,
    pub scope: String, // "global" or "project"
    pub exists: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ContextDetails {
    pub content: String,
    pub scope: String,
    pub file_path: String,
}

/// Get the global CLAUDE.md directory (~/.claude/)
fn get_global_claude_directory() -> Result<PathBuf, String> {
    let home_dir = dirs::home_dir().ok_or_else(|| "Failed to get home directory".to_string())?;
    Ok(home_dir.join(".claude"))
}

/// Get the project CLAUDE.md location (.claude/ or root)
fn get_project_claude_directory(working_dir: Option<String>) -> Result<PathBuf, String> {
    let base_dir = if let Some(ref dir) = working_dir {
        PathBuf::from(dir)
    } else {
        std::env::current_dir().map_err(|e| format!("Failed to get current directory: {}", e))?
    };

    // Check if .claude/CLAUDE.md exists first
    let dotclaude_path = base_dir.join(".claude");
    if dotclaude_path.exists() && dotclaude_path.is_dir() {
        return Ok(dotclaude_path);
    }

    // Otherwise return the project root (for CLAUDE.md in root)
    Ok(base_dir)
}

/// List available CLAUDE.md files (Global and Project)
#[tauri::command]
pub fn list_claude_md_files(working_dir: Option<String>) -> Result<Vec<ContextFile>, String> {
    let mut files = Vec::new();

    // Global CLAUDE.md
    let global_dir = get_global_claude_directory()?;
    let global_file = global_dir.join("CLAUDE.md");
    files.push(ContextFile {
        name: "Global Context".to_string(),
        scope: "global".to_string(),
        exists: global_file.exists(),
    });

    // Project CLAUDE.md
    let project_dir = get_project_claude_directory(working_dir)?;
    let dotclaude_file = project_dir.join("CLAUDE.md");
    let root_file = project_dir.parent().unwrap_or(&project_dir).join("CLAUDE.md");

    let project_exists = dotclaude_file.exists() || root_file.exists();
    files.push(ContextFile {
        name: "Project Context".to_string(),
        scope: "project".to_string(),
        exists: project_exists,
    });

    Ok(files)
}

/// Get CLAUDE.md content for a specific scope
#[tauri::command]
pub fn get_claude_md_details(
    scope: String,
    working_dir: Option<String>,
) -> Result<ContextDetails, String> {
    let file_path = if scope == "global" {
        let global_dir = get_global_claude_directory()?;
        global_dir.join("CLAUDE.md")
    } else {
        // Project scope: check .claude/CLAUDE.md first, then root CLAUDE.md
        let project_dir = get_project_claude_directory(working_dir.clone())?;
        let dotclaude_file = project_dir.join("CLAUDE.md");

        if dotclaude_file.exists() {
            dotclaude_file
        } else {
            // Try root CLAUDE.md
            let base_dir = if let Some(ref dir) = working_dir {
                PathBuf::from(dir)
            } else {
                std::env::current_dir()
                    .map_err(|e| format!("Failed to get current directory: {}", e))?
            };
            base_dir.join("CLAUDE.md")
        }
    };

    if !file_path.exists() {
        return Err(format!("CLAUDE.md not found in {} scope", scope));
    }

    let content = fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read CLAUDE.md: {}", e))?;

    let file_path_str = file_path
        .to_str()
        .ok_or_else(|| "Invalid file path".to_string())?
        .to_string();

    Ok(ContextDetails {
        content,
        scope,
        file_path: file_path_str,
    })
}

/// Save CLAUDE.md content for a specific scope
#[tauri::command]
pub fn save_claude_md_content(
    content: String,
    scope: String,
    working_dir: Option<String>,
) -> Result<(), String> {
    let file_path = if scope == "global" {
        let global_dir = get_global_claude_directory()?;
        // Ensure the directory exists
        fs::create_dir_all(&global_dir)
            .map_err(|e| format!("Failed to create global .claude directory: {}", e))?;
        global_dir.join("CLAUDE.md")
    } else {
        // Project scope: prefer .claude/CLAUDE.md if .claude/ exists, otherwise root
        let project_dir = get_project_claude_directory(working_dir.clone())?;
        let dotclaude_dir = if let Some(ref dir) = working_dir {
            PathBuf::from(dir).join(".claude")
        } else {
            std::env::current_dir()
                .map_err(|e| format!("Failed to get current directory: {}", e))?
                .join(".claude")
        };

        if dotclaude_dir.exists() && dotclaude_dir.is_dir() {
            dotclaude_dir.join("CLAUDE.md")
        } else {
            // Save to root CLAUDE.md
            let base_dir = if let Some(ref dir) = working_dir {
                PathBuf::from(dir)
            } else {
                std::env::current_dir()
                    .map_err(|e| format!("Failed to get current directory: {}", e))?
            };
            base_dir.join("CLAUDE.md")
        }
    };

    fs::write(&file_path, content)
        .map_err(|e| format!("Failed to write CLAUDE.md: {}", e))?;

    Ok(())
}
