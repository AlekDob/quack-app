use std::{fs, path::PathBuf};

use anyhow::{anyhow, Context, Result};
use serde::{Deserialize, Serialize};

// Bundled skills — embedded at compile time from templates/skills/
const BUNDLED_SKILL_FEATURE_CREATOR: &str = include_str!("../templates/skills/feature-creator.md");
const BUNDLED_SKILL_QUACK_BRAIN: &str = include_str!("../templates/skills/quack-brain.md");
const BUNDLED_SKILL_WHITEBOARD: &str = include_str!("../templates/skills/whiteboard.md");
const BUNDLED_SKILL_QUACK_REMOTE: &str = include_str!("../templates/skills/quack-remote.md");

#[derive(Serialize, Deserialize, Clone)]
pub struct SkillInfo {
    pub name: String,
    pub description: String,
    pub file_path: String,
    pub scope: String, // "global", "project", or "plugin"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub plugin: Option<String>,
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
    if let Some(home_dir) = dirs::home_dir() {
        let global_skills_dir = home_dir.join(".claude").join("skills");

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
        PathBuf::from(normalize_path(&dir))
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

    // 3. Read PLUGIN skills from ~/.claude/plugins/installed_plugins.json
    match list_plugin_skills() {
        Ok(mut plugin_skills) => {
            log::info!("Found {} plugin skills", plugin_skills.len());
            skills.append(&mut plugin_skills);
        }
        Err(e) => {
            log::debug!("Skipping plugin skills: {}", e);
        }
    }

    log::info!("Total skills found: {} (global + project + plugin)", skills.len());

    // Sort: global -> project -> plugin, alphabetical within each group
    skills.sort_by(|a, b| {
        fn rank(scope: &str) -> u8 {
            match scope {
                "global" => 0,
                "project" => 1,
                "plugin" => 2,
                _ => 3,
            }
        }
        rank(a.scope.as_str())
            .cmp(&rank(b.scope.as_str()))
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(skills)
}

/// Walk `~/.claude/plugins/installed_plugins.json` and return one `SkillInfo`
/// per `{installPath}/skills/*/SKILL.md` found.
/// Names are returned as `<plugin>:<skill-name>` to match the SDK's namespaced form.
// Brain: gotcha-claude-plugin-skills-discovery
fn list_plugin_skills() -> Result<Vec<SkillInfo>> {
    let home = dirs::home_dir().ok_or_else(|| anyhow!("No home directory"))?;
    let manifest_path = home.join(".claude").join("plugins").join("installed_plugins.json");
    if !manifest_path.exists() {
        return Ok(Vec::new());
    }

    let raw = fs::read_to_string(&manifest_path)
        .with_context(|| format!("Unable to read {:?}", manifest_path))?;
    let manifest: serde_json::Value = serde_json::from_str(&raw)
        .with_context(|| format!("Invalid JSON in {:?}", manifest_path))?;

    let plugins = match manifest.get("plugins").and_then(|v| v.as_object()) {
        Some(obj) => obj,
        None => return Ok(Vec::new()),
    };

    let mut skills = Vec::new();
    for (key, entries) in plugins {
        // Key format: "<plugin-name>@<marketplace>"
        let plugin_name = key.split('@').next().unwrap_or(key);

        let first = match entries.as_array().and_then(|a| a.first()) {
            Some(v) => v,
            None => continue,
        };
        let install_path = match first.get("installPath").and_then(|v| v.as_str()) {
            Some(p) => PathBuf::from(normalize_path(p)),
            None => continue,
        };
        let skills_dir = install_path.join("skills");
        if !skills_dir.exists() {
            continue;
        }

        let entries = match fs::read_dir(&skills_dir) {
            Ok(e) => e,
            Err(err) => {
                log::warn!("Unable to read plugin skills dir {:?}: {}", skills_dir, err);
                continue;
            }
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let skill_md = path.join("SKILL.md");
            if !skill_md.exists() {
                continue;
            }
            let skill_dir_name = match path.file_name().and_then(|s| s.to_str()) {
                Some(n) => n.to_string(),
                None => continue,
            };
            let content = match fs::read_to_string(&skill_md) {
                Ok(c) => c,
                Err(err) => {
                    log::warn!("Unable to read {:?}: {}", skill_md, err);
                    continue;
                }
            };
            skills.push(SkillInfo {
                name: format!("{}:{}", plugin_name, skill_dir_name),
                description: extract_description(&content),
                file_path: normalize_path(&skill_md.to_string_lossy()),
                scope: "plugin".to_string(),
                plugin: Some(plugin_name.to_string()),
            });
        }
    }

    Ok(skills)
}

/// Resolve a plugin skill name of the form `<plugin>:<skill>` to its SKILL.md path
/// by consulting `installed_plugins.json`.
fn resolve_plugin_skill_path(name: &str) -> Result<PathBuf> {
    let (plugin_name, skill_name) = name
        .split_once(':')
        .ok_or_else(|| anyhow!("Plugin skill name must be 'plugin:skill', got: {}", name))?;

    let home = dirs::home_dir().ok_or_else(|| anyhow!("No home directory"))?;
    let manifest_path = home.join(".claude").join("plugins").join("installed_plugins.json");
    if !manifest_path.exists() {
        return Err(anyhow!("Plugin manifest no longer exists — skill may have been uninstalled"));
    }
    let raw = fs::read_to_string(&manifest_path)
        .with_context(|| format!("Unable to read {:?}", manifest_path))?;
    let manifest: serde_json::Value = serde_json::from_str(&raw)
        .with_context(|| format!("Invalid JSON in {:?}", manifest_path))?;

    let plugins = manifest
        .get("plugins")
        .and_then(|v| v.as_object())
        .ok_or_else(|| anyhow!("No 'plugins' object in manifest"))?;

    for (key, entries) in plugins {
        if key.split('@').next().unwrap_or(key) != plugin_name {
            continue;
        }
        let install_path = entries
            .as_array()
            .and_then(|a| a.first())
            .and_then(|v| v.get("installPath"))
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("No installPath for plugin '{}'", plugin_name))?;
        let skill_md = PathBuf::from(normalize_path(install_path))
            .join("skills")
            .join(skill_name)
            .join("SKILL.md");
        if skill_md.exists() {
            return Ok(skill_md);
        }
        return Err(anyhow!("Skill file not found: {:?}", skill_md));
    }

    Err(anyhow!("Plugin '{}' not installed", plugin_name))
}

fn get_skill_details_impl(
    name: String,
    working_dir: Option<String>,
    scope: Option<String>,
) -> Result<SkillDetails> {
    // Plugin skills live outside the global/project trees — resolve via manifest.
    if scope.as_deref() == Some("plugin") {
        let skill_path = resolve_plugin_skill_path(&name)?;
        let content = fs::read_to_string(&skill_path)
            .with_context(|| format!("Unable to read skill file: {:?}", skill_path))?;
        return Ok(SkillDetails {
            name: name.clone(),
            description: extract_description(&content),
            file_path: normalize_path(&skill_path.to_string_lossy()),
            content,
        });
    }

    // Determine which directory to use based on scope
    let skills_dir = match scope.as_deref() {
        Some("global") => {
            // Global skills: ~/.claude/skills/
            let home = dirs::home_dir()
                .ok_or_else(|| anyhow!("Unable to get home directory"))?;
            home.join(".claude").join("skills")
        }
        _ => {
            // Project skills: .claude/skills/ in working directory
            let current = if let Some(dir) = working_dir {
                PathBuf::from(normalize_path(&dir))
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

    let description = extract_description(&content);

    Ok(SkillInfo {
        name,
        description,
        file_path: normalize_path(&path.to_string_lossy()),
        scope: scope.to_string(),
        plugin: None,
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

    let description = extract_description(&content);

    Ok(SkillDetails {
        name,
        description,
        file_path: normalize_path(&path.to_string_lossy()),
        content,
    })
}

/// Extract a skill's description from its markdown content.
/// Prefers YAML frontmatter `description:`, falls back to the first `# ` heading,
/// and finally to a "No description" placeholder.
fn extract_description(content: &str) -> String {
    if let Some(desc) = extract_frontmatter_field(content, "description") {
        return desc;
    }
    content
        .lines()
        .find(|line| line.starts_with("# "))
        .map(|line| line.trim_start_matches("# ").to_string())
        .unwrap_or_else(|| "No description".to_string())
}

/// Pull a scalar field out of the leading YAML frontmatter block.
/// Strips surrounding single/double quotes. Returns None if no frontmatter
/// or the field is missing.
///
/// Only supports inline scalar values (`field: value` or `field: "value"`).
/// Block scalars (`field: >-` / `field: |` with indented continuation lines)
/// are NOT parsed — the field will return None and callers fall back to the
/// `# Heading` description (or `"No description"`). In practice skill authors
/// use inline descriptions; revisit if that assumption breaks.
fn extract_frontmatter_field(content: &str, field: &str) -> Option<String> {
    if !content.starts_with("---") {
        return None;
    }
    let rest = &content[3..];
    let end = rest.find("\n---")?;
    let frontmatter = &rest[..end];

    let prefix = format!("{}:", field);
    for line in frontmatter.lines() {
        let trimmed = line.trim_start();
        if let Some(value) = trimmed.strip_prefix(&prefix) {
            let value = value.trim();
            let value = value
                .strip_prefix('"')
                .and_then(|v| v.strip_suffix('"'))
                .or_else(|| value.strip_prefix('\'').and_then(|v| v.strip_suffix('\'')))
                .unwrap_or(value);
            if value.is_empty() {
                return None;
            }
            return Some(value.to_string());
        }
    }
    None
}

/// Normalize path by removing \\?\ prefix added by fs::canonicalize on Windows
fn normalize_path(path: &str) -> String {
    if path.starts_with(r"\\?\") {
        path[4..].to_string()
    } else {
        path.to_string()
    }
}

fn check_skills_directory_impl(working_dir: Option<String>) -> Result<bool> {
    // Use provided working directory or current directory
    let current = if let Some(dir) = working_dir {
        PathBuf::from(normalize_path(&dir))
    } else {
        std::env::current_dir()
            .context("Unable to get current working directory")?
    };

    // Check for .claude/skills ONLY in the specified directory (don't traverse up)
    let skills_dir = current.join(".claude").join("skills");
    Ok(skills_dir.exists())
}

// ---------------------------------------------------------------------------
// Built-in Skills Installation (semver-aware)
// ---------------------------------------------------------------------------

struct BundledSkill {
    name: &'static str,
    content: &'static str,
}

const BUNDLED_SKILLS: &[BundledSkill] = &[
    BundledSkill {
        name: "feature-creator",
        content: BUNDLED_SKILL_FEATURE_CREATOR,
    },
    BundledSkill {
        name: "quack-brain",
        content: BUNDLED_SKILL_QUACK_BRAIN,
    },
    BundledSkill {
        name: "whiteboard",
        content: BUNDLED_SKILL_WHITEBOARD,
    },
    BundledSkill {
        name: "quack-remote",
        content: BUNDLED_SKILL_QUACK_REMOTE,
    },
];

/// Extract `version: X.Y.Z` from YAML frontmatter in markdown content.
/// Returns None if no frontmatter or no version field.
fn extract_version(content: &str) -> Option<(u32, u32, u32)> {
    extract_frontmatter_field(content, "version").as_deref().and_then(parse_semver)
}

/// Parse "1.2.3" into (1, 2, 3)
fn parse_semver(s: &str) -> Option<(u32, u32, u32)> {
    let parts: Vec<&str> = s.split('.').collect();
    if parts.len() != 3 {
        return None;
    }
    Some((
        parts[0].parse().ok()?,
        parts[1].parse().ok()?,
        parts[2].parse().ok()?,
    ))
}

/// Returns true if `bundled` version is newer than `local` version.
fn is_newer(bundled: (u32, u32, u32), local: (u32, u32, u32)) -> bool {
    bundled > local
}

/// Install bundled skills to ~/.claude/skills/ on app startup.
///
/// Semver-aware: installs if skill doesn't exist, or updates if bundled
/// version is higher than the locally installed version.
/// Preserves user customizations: if local file has no version field
/// (meaning user edited it and removed frontmatter), skip update.
pub fn install_bundled_skills() -> std::result::Result<(), String> {
    let home_dir = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|_| "Could not determine home directory".to_string())?;

    let global_skills_dir = PathBuf::from(home_dir).join(".claude").join("skills");

    // Create directory if it doesn't exist
    if !global_skills_dir.exists() {
        fs::create_dir_all(&global_skills_dir)
            .map_err(|e| format!("Failed to create global skills directory: {}", e))?;
        log::info!("Created global skills directory: {:?}", global_skills_dir);
    }

    let mut installed = 0;
    let mut updated = 0;
    let mut skipped = 0;

    for skill in BUNDLED_SKILLS {
        let skill_dir = global_skills_dir.join(skill.name);
        let skill_file = skill_dir.join("SKILL.md");

        let bundled_version = extract_version(skill.content);

        if skill_file.exists() {
            // Skill exists — check version
            let local_content = fs::read_to_string(&skill_file).unwrap_or_default();
            let local_version = extract_version(&local_content);

            match (bundled_version, local_version) {
                (Some(bv), Some(lv)) if is_newer(bv, lv) => {
                    // Bundled is newer — update
                    fs::write(&skill_file, skill.content)
                        .map_err(|e| format!("Failed to update skill '{}': {}", skill.name, e))?;
                    log::info!(
                        "Updated bundled skill '{}': {}.{}.{} -> {}.{}.{}",
                        skill.name, lv.0, lv.1, lv.2, bv.0, bv.1, bv.2
                    );
                    updated += 1;
                }
                (Some(_bv), None) => {
                    // Local has no version — user may have customized, skip
                    log::debug!(
                        "Bundled skill '{}' exists without version, skipping (user customized?)",
                        skill.name
                    );
                    skipped += 1;
                }
                _ => {
                    // Same version or local is newer — skip
                    log::debug!("Bundled skill '{}' is up to date, skipping", skill.name);
                    skipped += 1;
                }
            }
        } else {
            // Skill doesn't exist — fresh install
            fs::create_dir_all(&skill_dir)
                .map_err(|e| format!("Failed to create skill directory '{}': {}", skill.name, e))?;
            fs::write(&skill_file, skill.content)
                .map_err(|e| format!("Failed to install skill '{}': {}", skill.name, e))?;
            log::info!("Installed bundled skill: {}", skill.name);
            installed += 1;
        }
    }

    if installed > 0 || updated > 0 {
        log::info!(
            "Bundled skills: {} installed, {} updated, {} skipped",
            installed, updated, skipped
        );
    }

    Ok(())
}
