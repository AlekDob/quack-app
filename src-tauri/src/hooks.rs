use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::fs;
use std::path::PathBuf;
use uuid::Uuid;

/// Hook type matching Claude Agent SDK hook events
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub enum HookType {
    PreToolUse,
    PostToolUse,
    Notification,
    Stop,
    SubagentStop,
}

impl HookType {
    fn as_str(&self) -> &'static str {
        match self {
            HookType::PreToolUse => "PreToolUse",
            HookType::PostToolUse => "PostToolUse",
            HookType::Notification => "Notification",
            HookType::Stop => "Stop",
            HookType::SubagentStop => "SubagentStop",
        }
    }

    fn from_str(s: &str) -> Option<Self> {
        match s {
            "PreToolUse" => Some(HookType::PreToolUse),
            "PostToolUse" => Some(HookType::PostToolUse),
            "Notification" => Some(HookType::Notification),
            "Stop" => Some(HookType::Stop),
            "SubagentStop" => Some(HookType::SubagentStop),
            _ => None,
        }
    }
}

/// Hook scope - project-level or global
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum HookScope {
    Project,
    Global,
}

/// Individual hook action (the actual command to run)
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct HookAction {
    #[serde(rename = "type")]
    pub action_type: String, // "command"
    pub command: String,
}

/// Hook matcher entry in settings.json
/// Format: { "matcher": "optional", "hooks": [{ "type": "command", "command": "..." }] }
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct HookMatcher {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub matcher: Option<String>,
    pub hooks: Vec<HookAction>,
}

/// Full hook configuration with metadata (for UI)
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct HookConfig {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub hook_type: HookType,
    pub matcher: String,      // Tool name or "*" for all
    pub command: String,      // Shell command
    pub enabled: bool,
    pub scope: HookScope,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

/// Settings.json hooks section - maps hook type to array of matchers
#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct HooksSettings {
    #[serde(default, rename = "PreToolUse", skip_serializing_if = "Vec::is_empty")]
    pub pre_tool_use: Vec<HookMatcher>,
    #[serde(default, rename = "PostToolUse", skip_serializing_if = "Vec::is_empty")]
    pub post_tool_use: Vec<HookMatcher>,
    #[serde(default, rename = "Notification", skip_serializing_if = "Vec::is_empty")]
    pub notification: Vec<HookMatcher>,
    #[serde(default, rename = "Stop", skip_serializing_if = "Vec::is_empty")]
    pub stop: Vec<HookMatcher>,
    #[serde(default, rename = "SubagentStop", skip_serializing_if = "Vec::is_empty")]
    pub subagent_stop: Vec<HookMatcher>,
}

/// Full settings.json structure (partial - only hooks section)
#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct ClaudeSettings {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hooks: Option<HooksSettings>,
    #[serde(flatten)]
    pub other: HashMap<String, serde_json::Value>,
}

/// Quack-specific hook metadata stored separately
#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct QuackHooksMetadata {
    pub hooks: Vec<HookMetadata>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct HookMetadata {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub enabled: bool,
    // Store the command to match hooks from settings.json
    pub command: String,
    pub hook_type: String,
    pub matcher: Option<String>,
}

fn get_project_settings_path(working_dir: &str) -> PathBuf {
    PathBuf::from(working_dir).join(".claude").join("settings.json")
}

fn get_global_settings_path() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("~"));
    home.join(".claude").join("settings.json")
}

fn get_quack_hooks_metadata_path(working_dir: Option<&str>, scope: &HookScope) -> PathBuf {
    match scope {
        HookScope::Project => {
            let wd = working_dir.unwrap_or(".");
            PathBuf::from(wd).join(".quack").join("hooks-metadata.json")
        }
        HookScope::Global => {
            let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("~"));
            home.join(".quack").join("hooks-metadata.json")
        }
    }
}

/// Generate a deterministic ID from hook properties
/// This ensures the same hook always gets the same ID
fn generate_deterministic_id(command: &str, hook_type: &str, scope: &str, matcher: Option<&str>) -> String {
    let mut hasher = DefaultHasher::new();
    command.hash(&mut hasher);
    hook_type.hash(&mut hasher);
    scope.hash(&mut hasher);
    if let Some(m) = matcher {
        m.hash(&mut hasher);
    }
    format!("hook_{:x}", hasher.finish())
}

fn read_settings(path: &PathBuf) -> Result<ClaudeSettings> {
    if !path.exists() {
        return Ok(ClaudeSettings::default());
    }
    let content = fs::read_to_string(path)?;
    let settings: ClaudeSettings = serde_json::from_str(&content)?;
    Ok(settings)
}

fn write_settings(path: &PathBuf, settings: &ClaudeSettings) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let content = serde_json::to_string_pretty(settings)?;
    fs::write(path, content)?;
    Ok(())
}

fn read_hooks_metadata(path: &PathBuf) -> Result<QuackHooksMetadata> {
    if !path.exists() {
        return Ok(QuackHooksMetadata::default());
    }
    let content = fs::read_to_string(path)?;
    let metadata: QuackHooksMetadata = serde_json::from_str(&content)?;
    Ok(metadata)
}

fn write_hooks_metadata(path: &PathBuf, metadata: &QuackHooksMetadata) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let content = serde_json::to_string_pretty(metadata)?;
    fs::write(path, content)?;
    Ok(())
}

fn get_hooks_from_settings<'a>(settings: &'a HooksSettings, hook_type: &HookType) -> &'a Vec<HookMatcher> {
    match hook_type {
        HookType::PreToolUse => &settings.pre_tool_use,
        HookType::PostToolUse => &settings.post_tool_use,
        HookType::Notification => &settings.notification,
        HookType::Stop => &settings.stop,
        HookType::SubagentStop => &settings.subagent_stop,
    }
}

fn get_hooks_from_settings_mut<'a>(settings: &'a mut HooksSettings, hook_type: &HookType) -> &'a mut Vec<HookMatcher> {
    match hook_type {
        HookType::PreToolUse => &mut settings.pre_tool_use,
        HookType::PostToolUse => &mut settings.post_tool_use,
        HookType::Notification => &mut settings.notification,
        HookType::Stop => &mut settings.stop,
        HookType::SubagentStop => &mut settings.subagent_stop,
    }
}

/// List all hooks (project + global)
#[tauri::command]
pub fn list_hooks(working_dir: Option<String>) -> Result<Vec<HookConfig>, String> {
    list_hooks_impl(working_dir.as_deref()).map_err(|e| e.to_string())
}

fn list_hooks_impl(working_dir: Option<&str>) -> Result<Vec<HookConfig>> {
    let mut hooks = Vec::new();

    // Load project hooks
    if let Some(wd) = working_dir {
        let project_path = get_project_settings_path(wd);
        if let Ok(settings) = read_settings(&project_path) {
            if let Some(hooks_settings) = &settings.hooks {
                let metadata_path = get_quack_hooks_metadata_path(Some(wd), &HookScope::Project);
                let metadata = read_hooks_metadata(&metadata_path).unwrap_or_default();

                for hook_type in [HookType::PreToolUse, HookType::PostToolUse, HookType::Notification, HookType::Stop, HookType::SubagentStop] {
                    for matcher_entry in get_hooks_from_settings(hooks_settings, &hook_type) {
                        for hook_action in &matcher_entry.hooks {
                            if hook_action.action_type == "command" {
                                // Find metadata by command
                                let meta = metadata.hooks.iter().find(|m| m.command == hook_action.command);
                                let matcher_str = matcher_entry.matcher.clone().unwrap_or_else(|| "*".to_string());

                                // Use deterministic ID for hooks without metadata
                                let id = meta.map(|m| m.id.clone()).unwrap_or_else(|| {
                                    generate_deterministic_id(
                                        &hook_action.command,
                                        hook_type.as_str(),
                                        "project",
                                        matcher_entry.matcher.as_deref()
                                    )
                                });
                                let name = meta.map(|m| m.name.clone()).unwrap_or_else(|| {
                                    format!("{} hook", hook_type.as_str())
                                });
                                let enabled = meta.map(|m| m.enabled).unwrap_or(true);
                                let description = meta.and_then(|m| m.description.clone());

                                hooks.push(HookConfig {
                                    id,
                                    name,
                                    hook_type: hook_type.clone(),
                                    matcher: matcher_str,
                                    command: hook_action.command.clone(),
                                    enabled,
                                    scope: HookScope::Project,
                                    description,
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    // Load global hooks
    let global_path = get_global_settings_path();
    if let Ok(settings) = read_settings(&global_path) {
        if let Some(hooks_settings) = &settings.hooks {
            let metadata_path = get_quack_hooks_metadata_path(None, &HookScope::Global);
            let metadata = read_hooks_metadata(&metadata_path).unwrap_or_default();

            for hook_type in [HookType::PreToolUse, HookType::PostToolUse, HookType::Notification, HookType::Stop, HookType::SubagentStop] {
                for matcher_entry in get_hooks_from_settings(hooks_settings, &hook_type) {
                    for hook_action in &matcher_entry.hooks {
                        if hook_action.action_type == "command" {
                            let meta = metadata.hooks.iter().find(|m| m.command == hook_action.command);
                            let matcher_str = matcher_entry.matcher.clone().unwrap_or_else(|| "*".to_string());

                            // Use deterministic ID for hooks without metadata
                            let id = meta.map(|m| m.id.clone()).unwrap_or_else(|| {
                                generate_deterministic_id(
                                    &hook_action.command,
                                    hook_type.as_str(),
                                    "global",
                                    matcher_entry.matcher.as_deref()
                                )
                            });
                            let name = meta.map(|m| m.name.clone()).unwrap_or_else(|| {
                                format!("{} hook", hook_type.as_str())
                            });
                            let enabled = meta.map(|m| m.enabled).unwrap_or(true);
                            let description = meta.and_then(|m| m.description.clone());

                            hooks.push(HookConfig {
                                id,
                                name,
                                hook_type: hook_type.clone(),
                                matcher: matcher_str,
                                command: hook_action.command.clone(),
                                enabled,
                                scope: HookScope::Global,
                                description,
                            });
                        }
                    }
                }
            }
        }
    }

    Ok(hooks)
}

/// Save a new hook or update existing
#[tauri::command]
pub fn save_hook(working_dir: Option<String>, hook: HookConfig) -> Result<HookConfig, String> {
    save_hook_impl(working_dir.as_deref(), hook).map_err(|e| e.to_string())
}

fn save_hook_impl(working_dir: Option<&str>, mut hook: HookConfig) -> Result<HookConfig> {
    // Generate ID if not provided
    if hook.id.is_empty() {
        hook.id = Uuid::new_v4().to_string();
    }

    let settings_path = match hook.scope {
        HookScope::Project => {
            let wd = working_dir.ok_or_else(|| anyhow!("Working directory required for project hook"))?;
            get_project_settings_path(wd)
        }
        HookScope::Global => get_global_settings_path(),
    };

    // Read existing settings
    let mut settings = read_settings(&settings_path).unwrap_or_default();

    // Ensure hooks section exists
    if settings.hooks.is_none() {
        settings.hooks = Some(HooksSettings::default());
    }
    let hooks_settings = settings.hooks.as_mut().unwrap();

    // Get the appropriate hook type list
    let hooks_list = get_hooks_from_settings_mut(hooks_settings, &hook.hook_type);

    // Check if there's an existing entry with the same matcher
    let matcher_opt = if hook.matcher == "*" { None } else { Some(hook.matcher.clone()) };

    let existing_idx = hooks_list.iter().position(|m| m.matcher == matcher_opt);

    if let Some(idx) = existing_idx {
        // Add to existing matcher's hooks array if not already present
        let matcher_entry = &mut hooks_list[idx];
        if !matcher_entry.hooks.iter().any(|h| h.command == hook.command) {
            matcher_entry.hooks.push(HookAction {
                action_type: "command".to_string(),
                command: hook.command.clone(),
            });
        }
    } else {
        // Create new matcher entry
        hooks_list.push(HookMatcher {
            matcher: matcher_opt,
            hooks: vec![HookAction {
                action_type: "command".to_string(),
                command: hook.command.clone(),
            }],
        });
    }

    // Write settings
    write_settings(&settings_path, &settings)?;

    // Save metadata
    let metadata_path = get_quack_hooks_metadata_path(working_dir, &hook.scope);
    let mut metadata = read_hooks_metadata(&metadata_path).unwrap_or_default();

    // Update or add metadata
    if let Some(existing) = metadata.hooks.iter_mut().find(|m| m.id == hook.id) {
        existing.name = hook.name.clone();
        existing.description = hook.description.clone();
        existing.enabled = hook.enabled;
        existing.command = hook.command.clone();
        existing.hook_type = hook.hook_type.as_str().to_string();
        existing.matcher = if hook.matcher == "*" { None } else { Some(hook.matcher.clone()) };
    } else {
        metadata.hooks.push(HookMetadata {
            id: hook.id.clone(),
            name: hook.name.clone(),
            description: hook.description.clone(),
            enabled: hook.enabled,
            command: hook.command.clone(),
            hook_type: hook.hook_type.as_str().to_string(),
            matcher: if hook.matcher == "*" { None } else { Some(hook.matcher.clone()) },
        });
    }

    write_hooks_metadata(&metadata_path, &metadata)?;

    Ok(hook)
}

/// Delete a hook
#[tauri::command]
pub fn delete_hook(working_dir: Option<String>, hook_id: String, scope: String) -> Result<(), String> {
    delete_hook_impl(working_dir.as_deref(), &hook_id, &scope).map_err(|e| e.to_string())
}

fn delete_hook_impl(working_dir: Option<&str>, hook_id: &str, scope: &str) -> Result<()> {
    let hook_scope = if scope == "global" { HookScope::Global } else { HookScope::Project };

    // Get settings path
    let settings_path = match hook_scope {
        HookScope::Project => {
            let wd = working_dir.ok_or_else(|| anyhow!("Working directory required for project hook"))?;
            get_project_settings_path(wd)
        }
        HookScope::Global => get_global_settings_path(),
    };

    // Load metadata
    let metadata_path = get_quack_hooks_metadata_path(working_dir, &hook_scope);
    let mut metadata = read_hooks_metadata(&metadata_path).unwrap_or_default();

    // Try to find hook info - either from metadata or by listing current hooks
    let hook_meta = metadata.hooks.iter().find(|m| m.id == hook_id).cloned();

    // If not in metadata, search in current hooks list by ID
    let hook_info: Option<(String, String)> = if let Some(meta) = &hook_meta {
        Some((meta.command.clone(), meta.hook_type.clone()))
    } else {
        // List all hooks and find by ID
        let all_hooks = list_hooks_impl(working_dir)?;
        all_hooks.iter()
            .find(|h| h.id == hook_id)
            .map(|h| (h.command.clone(), h.hook_type.as_str().to_string()))
    };

    if let Some((command, hook_type_str)) = hook_info {
        // Remove from settings.json
        let mut settings = read_settings(&settings_path).unwrap_or_default();

        if let Some(hooks_settings) = &mut settings.hooks {
            if let Some(hook_type) = HookType::from_str(&hook_type_str) {
                let hooks_list = get_hooks_from_settings_mut(hooks_settings, &hook_type);

                // Remove the command from any matcher entry
                for matcher_entry in hooks_list.iter_mut() {
                    matcher_entry.hooks.retain(|h| h.command != command);
                }

                // Remove empty matcher entries
                hooks_list.retain(|m| !m.hooks.is_empty());
            }

            write_settings(&settings_path, &settings)?;
        }
    }

    // Remove from metadata (if exists)
    metadata.hooks.retain(|m| m.id != hook_id);
    write_hooks_metadata(&metadata_path, &metadata)?;

    log::info!("Deleted hook {} from both settings.json and metadata", hook_id);

    Ok(())
}

/// Toggle hook enabled/disabled
#[tauri::command]
pub fn toggle_hook(working_dir: Option<String>, hook_id: String, enabled: bool) -> Result<(), String> {
    toggle_hook_impl(working_dir.as_deref(), &hook_id, enabled).map_err(|e| e.to_string())
}

/// Get Claude Code env vars from global settings.json
#[tauri::command]
pub fn get_claude_env_vars() -> Result<HashMap<String, String>, String> {
    get_claude_env_vars_impl().map_err(|e| e.to_string())
}

fn get_claude_env_vars_impl() -> Result<HashMap<String, String>> {
    let path = get_global_settings_path();
    let settings = read_settings(&path)?;
    let mut result = HashMap::new();

    if let Some(env_val) = settings.other.get("env") {
        if let Some(env_obj) = env_val.as_object() {
            for (key, val) in env_obj {
                if let Some(s) = val.as_str() {
                    result.insert(key.clone(), s.to_string());
                }
            }
        }
    }

    Ok(result)
}

/// Set a Claude Code env var in global settings.json
#[tauri::command]
pub fn set_claude_env_var(key: String, value: Option<String>) -> Result<(), String> {
    set_claude_env_var_impl(&key, value.as_deref()).map_err(|e| e.to_string())
}

fn set_claude_env_var_impl(key: &str, value: Option<&str>) -> Result<()> {
    let path = get_global_settings_path();
    let mut settings = read_settings(&path).unwrap_or_default();

    let env_obj = settings.other
        .entry("env".to_string())
        .or_insert_with(|| serde_json::Value::Object(serde_json::Map::new()));

    if let Some(obj) = env_obj.as_object_mut() {
        match value {
            Some(v) => { obj.insert(key.to_string(), serde_json::Value::String(v.to_string())); }
            None => { obj.remove(key); }
        }
        // Clean up empty env object
        if obj.is_empty() {
            settings.other.remove("env");
        }
    }

    write_settings(&path, &settings)?;
    Ok(())
}

fn toggle_hook_impl(working_dir: Option<&str>, hook_id: &str, enabled: bool) -> Result<()> {
    // Try both project and global metadata
    for scope in [HookScope::Project, HookScope::Global] {
        let metadata_path = get_quack_hooks_metadata_path(working_dir, &scope);
        let mut metadata = read_hooks_metadata(&metadata_path).unwrap_or_default();

        if let Some(hook) = metadata.hooks.iter_mut().find(|m| m.id == hook_id) {
            hook.enabled = enabled;
            write_hooks_metadata(&metadata_path, &metadata)?;
            return Ok(());
        }
    }

    Err(anyhow!("Hook not found: {}", hook_id))
}
