use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;

/// Bundled rule: MCP Memory as Second Brain
/// This rule is installed automatically for all Quack users on first run
const BUNDLED_RULE_MCP_MEMORY: &str = include_str!("../../.claude/rules/use-mcp-memory-second-brain.md");

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
    let mut project_rules = Vec::new();
    let mut global_rules = Vec::new();

    // Read GLOBAL rules from ~/.claude/rules/
    if let Ok(home_dir) = std::env::var("HOME") {
        let global_rules_dir = PathBuf::from(home_dir).join(".claude/rules");
        log::info!("Reading global rules from: {:?}", global_rules_dir);
        global_rules = read_rules_from_dir(&global_rules_dir, "global");
        log::info!("Found {} global rules", global_rules.len());
    }

    // Read PROJECT rules from .claude/rules/
    let project_rules_dir = PathBuf::from(&base_path).join(".claude/rules");
    log::info!("Reading project rules from: {:?}", project_rules_dir);
    project_rules = read_rules_from_dir(&project_rules_dir, "project");
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
) -> Result<(), String> {
    let rules_dir = if scope == "global" {
        let home_dir = std::env::var("HOME")
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

    fs::write(&file_path, content)
        .map_err(|e| format!("Failed to write rule file: {}", e))?;

    log::info!("Created rule '{}' in {:?}", name, file_path);
    Ok(())
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
        let home_dir = std::env::var("HOME")
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
        let home_dir = std::env::var("HOME")
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

/// Bundled rule definition for automatic installation
struct BundledRule {
    name: &'static str,
    content: &'static str,
}

/// List of bundled rules to install for all Quack users
const BUNDLED_RULES: &[BundledRule] = &[
    BundledRule {
        name: "use-mcp-memory-second-brain",
        content: BUNDLED_RULE_MCP_MEMORY,
    },
];

/// Install bundled rules to ~/.claude/rules/ on first run
///
/// This function is called during app startup and ensures that
/// all Quack users have access to essential global rules.
///
/// Rules are only installed if they don't already exist, preserving
/// any user customizations.
pub fn install_bundled_rules() -> Result<(), String> {
    let home_dir = std::env::var("HOME")
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
