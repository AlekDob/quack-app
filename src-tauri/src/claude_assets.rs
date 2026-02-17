// Claude Assets Manager - Tauri Commands
// Manages .claude/ folder assets across multiple projects

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

/// Asset types that can be managed
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ClaudeAssetType {
    Droid,
    Command,
    Rule,
    Skill,
    Mcp,
    Hook,
}

/// Metadata parsed from YAML frontmatter
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AssetMetadata {
    pub name: Option<String>,
    pub description: Option<String>,
    pub model: Option<String>,
    pub tools: Option<Vec<String>>,
    #[serde(rename = "allowed-tools")]
    pub allowed_tools: Option<String>,
    #[serde(rename = "argument-hint")]
    pub argument_hint: Option<String>,
    #[serde(rename = "alwaysApply")]
    pub always_apply: Option<bool>,
    pub globs: Option<Vec<String>>,
}

/// A single Claude asset
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeAsset {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub asset_type: String,
    pub path: String,
    pub relative_path: String,
    pub project_path: String,
    pub project_name: String,
    pub metadata: AssetMetadata,
    pub is_directory: bool,
    pub size: u64,
    pub modified_at: u64,
}

/// All assets for a single project
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectAssets {
    pub droids: Vec<ClaudeAsset>,
    pub commands: Vec<ClaudeAsset>,
    pub rules: Vec<ClaudeAsset>,
    pub skills: Vec<ClaudeAsset>,
    pub mcps: Vec<ClaudeAsset>,
    pub hooks: Vec<ClaudeAsset>,
}

/// Asset counts summary
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetCounts {
    pub droids: usize,
    pub commands: usize,
    pub rules: usize,
    pub skills: usize,
    pub mcps: usize,
    pub hooks: usize,
    pub total: usize,
}

/// A project with its .claude/ assets
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeProject {
    pub name: String,
    pub path: String,
    pub branch: Option<String>,
    pub has_claude_folder: bool,
    pub assets: ProjectAssets,
    pub asset_counts: AssetCounts,
}

/// Parse YAML frontmatter from markdown content
fn parse_frontmatter(content: &str) -> AssetMetadata {
    if !content.starts_with("---") {
        return AssetMetadata::default();
    }

    let parts: Vec<&str> = content.splitn(3, "---").collect();
    if parts.len() < 3 {
        return AssetMetadata::default();
    }

    let yaml_str = parts[1].trim();
    serde_yaml::from_str(yaml_str).unwrap_or_default()
}

/// Generate a unique ID from path
fn generate_id(path: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let mut hasher = DefaultHasher::new();
    path.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

/// Get current git branch for a project
fn get_git_branch(project_path: &Path) -> Option<String> {
    let head_path = project_path.join(".git/HEAD");
    if let Ok(content) = fs::read_to_string(head_path) {
        if content.starts_with("ref: refs/heads/") {
            return Some(content.trim_start_matches("ref: refs/heads/").trim().to_string());
        }
    }
    None
}

/// List MCP servers from .mcp.json file in project root
fn list_mcp_servers(project_path: &Path, project_name: &str) -> Vec<ClaudeAsset> {
    let mut assets = Vec::new();
    let mcp_json_path = project_path.join(".mcp.json");

    if !mcp_json_path.exists() {
        return assets;
    }

    let content = match fs::read_to_string(&mcp_json_path) {
        Ok(c) => c,
        Err(_) => return assets,
    };

    let json: serde_json::Value = match serde_json::from_str(&content) {
        Ok(j) => j,
        Err(_) => return assets,
    };

    if let Some(servers) = json.get("mcpServers").and_then(|s| s.as_object()) {
        for (name, config) in servers {
            let command = config.get("command")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let args = config.get("args")
                .and_then(|v| v.as_array())
                .map(|arr| arr.iter()
                    .filter_map(|v| v.as_str())
                    .collect::<Vec<_>>()
                    .join(" "))
                .unwrap_or_default();

            let description = format!("{} {}", command, args);

            let modified_at = fs::metadata(&mcp_json_path)
                .and_then(|m| m.modified())
                .map(|t| t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs())
                .unwrap_or(0);

            let size = fs::metadata(&mcp_json_path).map(|m| m.len()).unwrap_or(0);

            assets.push(ClaudeAsset {
                id: generate_id(&format!("{}/.mcp.json#{}", project_path.to_string_lossy(), name)),
                name: name.clone(),
                asset_type: "mcp".to_string(),
                path: mcp_json_path.to_string_lossy().to_string(),
                relative_path: format!(".mcp.json#{}", name),
                project_path: project_path.to_string_lossy().to_string(),
                project_name: project_name.to_string(),
                metadata: AssetMetadata {
                    name: Some(name.clone()),
                    description: Some(description),
                    ..Default::default()
                },
                is_directory: false,
                size,
                modified_at,
            });
        }
    }

    assets
}

/// List all assets of a specific type in a project
fn list_assets_of_type(
    project_path: &Path,
    project_name: &str,
    asset_type: &str,
    folder_name: &str,
) -> Vec<ClaudeAsset> {
    let mut assets = Vec::new();
    let folder_path = project_path.join(".claude").join(folder_name);

    if !folder_path.exists() {
        return assets;
    }

    if let Ok(entries) = fs::read_dir(&folder_path) {
        for entry in entries.flatten() {
            let path = entry.path();
            let name = path.file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("unknown")
                .to_string();

            // Skip hidden files and non-relevant files
            if name.starts_with('.') {
                continue;
            }

            let is_directory = path.is_dir();
            let is_valid = match asset_type {
                "droid" | "command" | "rule" => {
                    path.extension().map_or(false, |e| e == "md")
                }
                "skill" => {
                    // Skills can be .md files or directories with SKILL.md
                    path.extension().map_or(false, |e| e == "md") ||
                    (is_directory && path.join("SKILL.md").exists())
                }
                "mcp" => {
                    path.extension().map_or(false, |e| e == "json")
                }
                _ => false,
            };

            if !is_valid {
                continue;
            }

            // Get metadata from file
            let mut metadata = AssetMetadata::default();
            let size;
            let modified_at;

            if is_directory {
                // For skill directories, read SKILL.md
                let skill_md = path.join("SKILL.md");
                if let Ok(content) = fs::read_to_string(&skill_md) {
                    metadata = parse_frontmatter(&content);
                }
                size = 0;
            } else {
                if let Ok(content) = fs::read_to_string(&path) {
                    if asset_type != "mcp" {
                        metadata = parse_frontmatter(&content);
                    } else {
                        // Parse JSON for MCP
                        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                            if let Some(servers) = json.get("mcpServers") {
                                if let Some(obj) = servers.as_object() {
                                    if let Some((_, server)) = obj.iter().next() {
                                        metadata.description = server.get("description")
                                            .and_then(|v| v.as_str())
                                            .map(|s| s.to_string());
                                    }
                                }
                            }
                        }
                    }
                }
                size = fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
            }

            modified_at = fs::metadata(&path)
                .and_then(|m| m.modified())
                .map(|t| t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs())
                .unwrap_or(0);

            let relative_path = format!("{}/{}", folder_name, path.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or(""));

            assets.push(ClaudeAsset {
                id: generate_id(&path.to_string_lossy()),
                name,
                asset_type: asset_type.to_string(),
                path: path.to_string_lossy().to_string(),
                relative_path,
                project_path: project_path.to_string_lossy().to_string(),
                project_name: project_name.to_string(),
                metadata,
                is_directory,
                size,
                modified_at,
            });
        }
    }

    assets
}

/// List all Claude assets for a project
#[tauri::command]
pub fn list_claude_assets(project_path: String) -> Result<ClaudeProject, String> {
    let path = PathBuf::from(&project_path);

    if !path.exists() {
        return Err(format!("Project path does not exist: {}", project_path));
    }

    let project_name = path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    let claude_folder = path.join(".claude");
    let has_claude_folder = claude_folder.exists();

    let droids = list_assets_of_type(&path, &project_name, "droid", "agents");
    let commands = list_assets_of_type(&path, &project_name, "command", "commands");
    let rules = list_assets_of_type(&path, &project_name, "rule", "rules");
    let skills = list_assets_of_type(&path, &project_name, "skill", "skills");

    // MCPs are in .mcp.json in project root, not in .claude/mcps/
    let mcps = list_mcp_servers(&path, &project_name);

    // TODO: Parse hooks from settings.json
    let hooks = Vec::new();

    let asset_counts = AssetCounts {
        droids: droids.len(),
        commands: commands.len(),
        rules: rules.len(),
        skills: skills.len(),
        mcps: mcps.len(),
        hooks: hooks.len(),
        total: droids.len() + commands.len() + rules.len() + skills.len() + mcps.len() + hooks.len(),
    };

    let branch = get_git_branch(&path);

    Ok(ClaudeProject {
        name: project_name,
        path: project_path,
        branch,
        has_claude_folder,
        assets: ProjectAssets {
            droids,
            commands,
            rules,
            skills,
            mcps,
            hooks,
        },
        asset_counts,
    })
}

/// Copy an MCP server configuration to another project
fn copy_mcp_to_project(
    source_path: &str,
    mcp_name: &str,
    dest_project: &str,
) -> Result<String, String> {
    let source_mcp_json = PathBuf::from(source_path);
    let dest_mcp_json = PathBuf::from(dest_project).join(".mcp.json");

    // Read source .mcp.json
    let source_content = fs::read_to_string(&source_mcp_json)
        .map_err(|e| format!("Failed to read source .mcp.json: {}", e))?;

    let source_json: serde_json::Value = serde_json::from_str(&source_content)
        .map_err(|e| format!("Failed to parse source .mcp.json: {}", e))?;

    // Get the specific MCP server config
    let mcp_config = source_json
        .get("mcpServers")
        .and_then(|s| s.get(mcp_name))
        .ok_or_else(|| format!("MCP server '{}' not found in source", mcp_name))?
        .clone();

    // Read or create destination .mcp.json
    let mut dest_json: serde_json::Value = if dest_mcp_json.exists() {
        let content = fs::read_to_string(&dest_mcp_json)
            .map_err(|e| format!("Failed to read destination .mcp.json: {}", e))?;
        serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse destination .mcp.json: {}", e))?
    } else {
        serde_json::json!({ "mcpServers": {} })
    };

    // Add the MCP server to destination
    if let Some(servers) = dest_json.get_mut("mcpServers") {
        if let Some(obj) = servers.as_object_mut() {
            obj.insert(mcp_name.to_string(), mcp_config);
        }
    }

    // Write destination .mcp.json
    let formatted = serde_json::to_string_pretty(&dest_json)
        .map_err(|e| format!("Failed to serialize .mcp.json: {}", e))?;

    fs::write(&dest_mcp_json, formatted)
        .map_err(|e| format!("Failed to write destination .mcp.json: {}", e))?;

    Ok(dest_mcp_json.to_string_lossy().to_string())
}

/// Copy an asset from one project to another
#[tauri::command]
pub fn copy_claude_asset(
    source_path: String,
    dest_project: String,
    asset_type: String,
    new_name: Option<String>,
) -> Result<String, String> {
    // Special handling for MCP assets
    if asset_type == "mcp" {
        // source_path is path to .mcp.json, we need to extract the MCP name
        // The relative_path format is ".mcp.json#mcpName"
        let mcp_name = new_name.ok_or_else(|| "MCP name is required".to_string())?;
        return copy_mcp_to_project(&source_path, &mcp_name, &dest_project);
    }

    let source = PathBuf::from(&source_path);

    if !source.exists() {
        return Err(format!("Source asset does not exist: {}", source_path));
    }

    // Determine destination folder
    let folder_name = match asset_type.as_str() {
        "droid" => "agents",
        "command" => "commands",
        "rule" => "rules",
        "skill" => "skills",
        _ => return Err(format!("Unknown asset type: {}", asset_type)),
    };

    let dest_folder = PathBuf::from(&dest_project).join(".claude").join(folder_name);

    // Create folder if it doesn't exist
    if !dest_folder.exists() {
        fs::create_dir_all(&dest_folder)
            .map_err(|e| format!("Failed to create destination folder: {}", e))?;
    }

    // Determine destination filename
    let file_name = if let Some(name) = new_name {
        let ext = source.extension()
            .and_then(|e| e.to_str())
            .unwrap_or("md");
        format!("{}.{}", name, ext)
    } else {
        source.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("asset")
            .to_string()
    };

    let dest_path = dest_folder.join(&file_name);

    // Copy file or directory
    if source.is_dir() {
        copy_dir_recursive(&source, &dest_path)
            .map_err(|e| format!("Failed to copy directory: {}", e))?;
    } else {
        fs::copy(&source, &dest_path)
            .map_err(|e| format!("Failed to copy file: {}", e))?;
    }

    Ok(dest_path.to_string_lossy().to_string())
}

/// Recursively copy a directory
fn copy_dir_recursive(src: &Path, dst: &Path) -> std::io::Result<()> {
    fs::create_dir_all(dst)?;

    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let path = entry.path();
        let dest_path = dst.join(entry.file_name());

        if path.is_dir() {
            copy_dir_recursive(&path, &dest_path)?;
        } else {
            fs::copy(&path, &dest_path)?;
        }
    }

    Ok(())
}

/// Delete an asset
#[tauri::command]
pub fn delete_claude_asset(asset_path: String, is_directory: bool) -> Result<(), String> {
    let path = PathBuf::from(&asset_path);

    if !path.exists() {
        return Err(format!("Asset does not exist: {}", asset_path));
    }

    if is_directory {
        fs::remove_dir_all(&path)
            .map_err(|e| format!("Failed to delete directory: {}", e))?;
    } else {
        fs::remove_file(&path)
            .map_err(|e| format!("Failed to delete file: {}", e))?;
    }

    Ok(())
}

/// Move an asset from one project to another
#[tauri::command]
pub fn move_claude_asset(
    source_path: String,
    dest_project: String,
    asset_type: String,
) -> Result<String, String> {
    // First copy
    let new_path = copy_claude_asset(source_path.clone(), dest_project, asset_type, None)?;

    // Then delete source
    let source = PathBuf::from(&source_path);
    if source.is_dir() {
        fs::remove_dir_all(&source)
            .map_err(|e| format!("Failed to delete source directory: {}", e))?;
    } else {
        fs::remove_file(&source)
            .map_err(|e| format!("Failed to delete source file: {}", e))?;
    }

    Ok(new_path)
}

/// Read asset content
#[tauri::command]
pub fn read_claude_asset(asset_path: String) -> Result<String, String> {
    fs::read_to_string(&asset_path)
        .map_err(|e| format!("Failed to read asset: {}", e))
}
