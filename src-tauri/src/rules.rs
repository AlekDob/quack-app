use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;

/// Get home directory cross-platform (HOME on Unix, USERPROFILE on Windows)
fn get_home_dir() -> Result<String, String> {
    std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|_| "Could not determine home directory".to_string())
}


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Rule {
    pub id: String,
    pub name: String,
    pub content: String,
    #[serde(rename = "filePath")]
    pub file_path: String,
    pub scope: String, // "project" | "global"
    #[serde(rename = "createdAt")]
    pub created_at: u64,
    #[serde(rename = "updatedAt")]
    pub updated_at: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RulesResponse {
    pub project: Vec<Rule>,
    pub global: Vec<Rule>,
}

/// Read rules from a directory with specified scope
fn read_rules_from_dir(dir_path: &PathBuf, scope: &str) -> Vec<Rule> {
    let mut rules = Vec::new();

    if dir_path.exists() && dir_path.is_dir() {
        match fs::read_dir(dir_path) {
            Ok(entries) => {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.extension().and_then(|s| s.to_str()) == Some("md") {
                        if let Ok(content) = fs::read_to_string(&path) {
                            let name = path
                                .file_stem()
                                .and_then(|s| s.to_str())
                                .unwrap_or("unknown")
                                .to_string();

                            // Get file metadata for timestamps
                            let (created_at, updated_at) = if let Ok(metadata) = fs::metadata(&path) {
                                let created = metadata
                                    .created()
                                    .ok()
                                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                                    .map(|d| d.as_secs())
                                    .unwrap_or(0);
                                let modified = metadata
                                    .modified()
                                    .ok()
                                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                                    .map(|d| d.as_secs())
                                    .unwrap_or(0);
                                (created, modified)
                            } else {
                                (0, 0)
                            };

                            let id = format!("{}:{}", scope, name);

                            rules.push(Rule {
                                id,
                                name,
                                content,
                                file_path: path.to_string_lossy().to_string(),
                                scope: scope.to_string(),
                                created_at,
                                updated_at,
                            });
                        }
                    }
                }
            }
            Err(e) => {
                log::warn!("Failed to read rules directory {:?}: {}", dir_path, e);
            }
        }
    }

    // Sort by name
    rules.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    rules
}

/// List all rules (global + project)
#[tauri::command]
pub fn list_rules(_app: AppHandle, base_path: String) -> Result<RulesResponse, String> {
    // Read GLOBAL rules from ~/.claude/rules/
    let global_rules = if let Ok(home_dir) = get_home_dir() {
        let global_rules_dir = PathBuf::from(home_dir).join(".claude/rules");
        log::info!("Reading global rules from: {:?}", global_rules_dir);
        let rules = read_rules_from_dir(&global_rules_dir, "global");
        log::info!("Found {} global rules", rules.len());
        rules
    } else {
        Vec::new()
    };

    // Read PROJECT rules from .claude/rules/
    let project_rules_dir = PathBuf::from(&base_path).join(".claude/rules");
    log::info!("Reading project rules from: {:?}", project_rules_dir);
    let project_rules = read_rules_from_dir(&project_rules_dir, "project");
    log::info!("Found {} project rules", project_rules.len());

    Ok(RulesResponse {
        project: project_rules,
        global: global_rules,
    })
}

/// Create a new rule
#[tauri::command]
pub fn create_rule(
    _app: AppHandle,
    base_path: String,
    name: String,
    content: String,
    scope: String,
) -> Result<String, String> {
    let rules_dir = if scope == "global" {
        let home_dir = get_home_dir()
            .map_err(|_| "Could not determine home directory")?;
        PathBuf::from(home_dir).join(".claude/rules")
    } else {
        PathBuf::from(&base_path).join(".claude/rules")
    };

    // Create directory if it doesn't exist
    if !rules_dir.exists() {
        fs::create_dir_all(&rules_dir)
            .map_err(|e| format!("Failed to create rules directory: {}", e))?;
    }

    let file_path = rules_dir.join(format!("{}.md", name));

    // Check if rule already exists
    if file_path.exists() {
        return Err(format!("Rule '{}' already exists", name));
    }

    fs::write(&file_path, &content)
        .map_err(|e| format!("Failed to write rule file: {}", e))?;

    log::info!("Created rule '{}' in {:?}", name, file_path);
    Ok(file_path.to_string_lossy().to_string())
}

/// Update an existing rule
#[tauri::command]
pub fn update_rule(
    _app: AppHandle,
    base_path: String,
    name: String,
    content: String,
    scope: String,
) -> Result<(), String> {
    let rules_dir = if scope == "global" {
        let home_dir = get_home_dir()
            .map_err(|_| "Could not determine home directory")?;
        PathBuf::from(home_dir).join(".claude/rules")
    } else {
        PathBuf::from(&base_path).join(".claude/rules")
    };

    let file_path = rules_dir.join(format!("{}.md", name));

    if !file_path.exists() {
        return Err(format!("Rule '{}' does not exist", name));
    }

    fs::write(&file_path, content)
        .map_err(|e| format!("Failed to update rule file: {}", e))?;

    log::info!("Updated rule '{}' at {:?}", name, file_path);
    Ok(())
}

/// Delete a rule
#[tauri::command]
pub fn delete_rule(
    _app: AppHandle,
    base_path: String,
    name: String,
    scope: String,
) -> Result<(), String> {
    let rules_dir = if scope == "global" {
        let home_dir = get_home_dir()
            .map_err(|_| "Could not determine home directory")?;
        PathBuf::from(home_dir).join(".claude/rules")
    } else {
        PathBuf::from(&base_path).join(".claude/rules")
    };

    let file_path = rules_dir.join(format!("{}.md", name));

    if !file_path.exists() {
        return Err(format!("Rule '{}' does not exist", name));
    }

    fs::remove_file(&file_path)
        .map_err(|e| format!("Failed to delete rule file: {}", e))?;

    log::info!("Deleted rule '{}' from {:?}", name, file_path);
    Ok(())
}

/// Detailed rule information for the RuleViewer component
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuleDetails {
    pub name: String,
    pub content: String,
    pub description: Option<String>,
    pub globs: Option<Vec<String>>,
    pub scope: String,
    pub file_path: String,
}

/// Parse frontmatter from rule markdown file
fn parse_rule_frontmatter(content: &str) -> (Option<String>, Option<Vec<String>>, String) {
    let lines: Vec<&str> = content.lines().collect();

    if lines.is_empty() || lines[0] != "---" {
        // No frontmatter
        return (None, None, content.to_string());
    }

    let mut description: Option<String> = None;
    let mut globs: Option<Vec<String>> = None;
    let mut end_index = 1;
    let mut in_globs = false;
    let mut globs_list: Vec<String> = Vec::new();

    for (i, line) in lines.iter().enumerate().skip(1) {
        if *line == "---" {
            end_index = i + 1;
            break;
        }

        // Check if we're collecting glob entries
        if in_globs {
            if line.trim().starts_with("- ") {
                let glob = line.trim().trim_start_matches("- ").trim_matches('"').to_string();
                globs_list.push(glob);
                continue;
            } else {
                in_globs = false;
            }
        }

        if let Some((key, value)) = line.split_once(':') {
            let key = key.trim();
            let value = value.trim();

            match key {
                "description" => description = Some(value.trim_matches('"').to_string()),
                "globs" => {
                    // Check if globs is inline array or multi-line
                    if value.starts_with('[') {
                        // Inline array
                        let parsed: Vec<String> = value
                            .trim_matches(|c| c == '[' || c == ']')
                            .split(',')
                            .map(|s| s.trim().trim_matches('"').to_string())
                            .filter(|s| !s.is_empty())
                            .collect();
                        if !parsed.is_empty() {
                            globs = Some(parsed);
                        }
                    } else if value.is_empty() {
                        // Multi-line globs
                        in_globs = true;
                    }
                }
                _ => {}
            }
        }
    }

    // Set globs from collected list if any
    if !globs_list.is_empty() {
        globs = Some(globs_list);
    }

    let body = if end_index < lines.len() {
        lines[end_index..].join("\n").trim().to_string()
    } else {
        String::new()
    };

    (description, globs, body)
}

/// Get detailed information about a specific rule
#[tauri::command]
pub fn get_rule_details(
    _app: AppHandle,
    name: String,
    working_dir: Option<String>,
    scope: String,
) -> Result<RuleDetails, String> {
    let rules_dir = if scope == "global" {
        let home_dir = get_home_dir()
            .map_err(|_| "Could not determine home directory")?;
        PathBuf::from(home_dir).join(".claude/rules")
    } else {
        let base = working_dir.ok_or("Working directory is required for project rules")?;
        PathBuf::from(&base).join(".claude/rules")
    };

    let file_path = rules_dir.join(format!("{}.md", name));

    if !file_path.exists() {
        return Err(format!("Rule '{}' not found", name));
    }

    let full_content = fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read rule file: {}", e))?;

    let (description, globs, body) = parse_rule_frontmatter(&full_content);

    Ok(RuleDetails {
        name,
        content: body,
        description,
        globs,
        scope,
        file_path: file_path.to_string_lossy().to_string(),
    })
}

/// Save rule content (create or update)
#[tauri::command]
pub fn save_rule_content(
    _app: AppHandle,
    name: String,
    content: String,
    description: Option<String>,
    globs: Option<Vec<String>>,
    scope: String,
    working_dir: Option<String>,
) -> Result<(), String> {
    let rules_dir = if scope == "global" {
        let home_dir = get_home_dir()
            .map_err(|_| "Could not determine home directory")?;
        PathBuf::from(home_dir).join(".claude/rules")
    } else {
        let base = working_dir.ok_or("Working directory is required for project rules")?;
        PathBuf::from(&base).join(".claude/rules")
    };

    // Create directory if it doesn't exist
    if !rules_dir.exists() {
        fs::create_dir_all(&rules_dir)
            .map_err(|e| format!("Failed to create rules directory: {}", e))?;
    }

    let file_path = rules_dir.join(format!("{}.md", name));

    // Build content with frontmatter if description or globs exist
    let full_content = if description.is_some() || globs.is_some() {
        let mut frontmatter_lines = vec!["---".to_string()];
        if let Some(desc) = &description {
            frontmatter_lines.push(format!("description: \"{}\"", desc));
        }
        if let Some(g) = &globs {
            if !g.is_empty() {
                frontmatter_lines.push("globs:".to_string());
                for glob in g {
                    frontmatter_lines.push(format!("  - \"{}\"", glob));
                }
            }
        }
        frontmatter_lines.push("---".to_string());
        format!("{}\n\n{}", frontmatter_lines.join("\n"), content)
    } else {
        content
    };

    fs::write(&file_path, full_content)
        .map_err(|e| format!("Failed to write rule file: {}", e))?;

    log::info!("🦆 Saved {} rule: {}", scope, name);

    Ok(())
}

/// Bundled rule definition for automatic installation
struct BundledRule {
    name: &'static str,
    content: &'static str,
}

/// List of bundled rules to install for all Quack users
const BUNDLED_RULES: &[BundledRule] = &[];

/// Install bundled rules to ~/.claude/rules/ on first run
///
/// This function is called during app startup and ensures that
/// all Quack users have access to essential global rules.
///
/// Rules are only installed if they don't already exist, preserving
/// any user customizations.
pub fn install_bundled_rules() -> Result<(), String> {
    let home_dir = get_home_dir()
        .map_err(|_| "Could not determine home directory")?;

    let global_rules_dir = PathBuf::from(home_dir).join(".claude/rules");

    // Create directory if it doesn't exist
    if !global_rules_dir.exists() {
        fs::create_dir_all(&global_rules_dir)
            .map_err(|e| format!("Failed to create global rules directory: {}", e))?;
        log::info!("🦆 Created global rules directory: {:?}", global_rules_dir);
    }

    let mut installed_count = 0;
    let mut skipped_count = 0;

    for rule in BUNDLED_RULES {
        let file_path = global_rules_dir.join(format!("{}.md", rule.name));

        if file_path.exists() {
            // Rule already exists, don't overwrite user customizations
            log::debug!("🦆 Bundled rule '{}' already exists, skipping", rule.name);
            skipped_count += 1;
        } else {
            // Install the bundled rule
            fs::write(&file_path, rule.content)
                .map_err(|e| format!("Failed to install bundled rule '{}': {}", rule.name, e))?;
            log::info!("🦆 Installed bundled rule: {}", rule.name);
            installed_count += 1;
        }
    }

    if installed_count > 0 {
        log::info!(
            "🦆 Bundled rules installation complete: {} installed, {} already present",
            installed_count,
            skipped_count
        );
    }

    Ok(())
}
