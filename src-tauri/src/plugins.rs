use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Plugin {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: PluginCategory,
    pub version: String,
    pub author: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub repository: Option<String>,
    pub installed: bool,
    pub source: PluginSource,
    pub metadata: PluginMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PluginCategory {
    Agent,
    Command,
    Hook,
    Setting,
    Mcp,
    Stack,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PluginSource {
    Davila7,
    Aitmpl,
    Custom,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginMetadata {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
    pub tags: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dependencies: Option<Vec<String>>,
}

/// Get the path to .claude directory
fn get_claude_directory(working_dir: Option<String>) -> Result<PathBuf, String> {
    let base_path = if let Some(dir) = working_dir {
        PathBuf::from(dir)
    } else {
        std::env::current_dir()
            .map_err(|e| format!("Failed to get current directory: {}", e))?
    };

    Ok(base_path.join(".claude"))
}

/// List all available plugins from configured sources
#[tauri::command]
pub async fn list_available_plugins(
    _app: AppHandle,
    working_dir: Option<String>,
) -> Result<Vec<Plugin>, String> {
    // For now, we'll return a mock list
    // TODO: Fetch from davila7 and aitmpl repositories
    let mut plugins = Vec::new();

    // Mock plugins for testing
    plugins.push(Plugin {
        id: "business-marketing-security-auditor".to_string(),
        name: "Security Auditor".to_string(),
        description: "Comprehensive security audit agent for your codebase".to_string(),
        category: PluginCategory::Agent,
        version: "1.0.0".to_string(),
        author: "davila7".to_string(),
        repository: Some("https://github.com/davila7/claude-code-templates".to_string()),
        installed: false,
        source: PluginSource::Davila7,
        metadata: PluginMetadata {
            icon: Some("🔒".to_string()),
            tags: vec!["security".to_string(), "audit".to_string()],
            dependencies: None,
        },
    });

    plugins.push(Plugin {
        id: "performance-optimize-bundle".to_string(),
        name: "Bundle Optimizer".to_string(),
        description: "Analyze and optimize your bundle size".to_string(),
        category: PluginCategory::Command,
        version: "1.2.0".to_string(),
        author: "davila7".to_string(),
        repository: Some("https://github.com/davila7/claude-code-templates".to_string()),
        installed: false,
        source: PluginSource::Davila7,
        metadata: PluginMetadata {
            icon: Some("⚡".to_string()),
            tags: vec!["performance".to_string(), "optimization".to_string()],
            dependencies: None,
        },
    });

    // Check which plugins are already installed
    let installed_plugins = get_installed_plugins(working_dir)?;
    for plugin in &mut plugins {
        plugin.installed = installed_plugins.iter().any(|p| p.id == plugin.id);
    }

    Ok(plugins)
}

/// Get list of installed plugins
fn get_installed_plugins(working_dir: Option<String>) -> Result<Vec<Plugin>, String> {
    let claude_dir = get_claude_directory(working_dir)?;
    let manifest_path = claude_dir.join("plugins").join("manifest.json");

    if !manifest_path.exists() {
        return Ok(Vec::new());
    }

    let content = fs::read_to_string(&manifest_path)
        .map_err(|e| format!("Failed to read plugin manifest: {}", e))?;

    let plugins: Vec<Plugin> = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse plugin manifest: {}", e))?;

    Ok(plugins)
}

/// Get installed plugins for display
#[tauri::command]
pub async fn list_installed_plugins(
    _app: AppHandle,
    working_dir: Option<String>,
) -> Result<Vec<Plugin>, String> {
    get_installed_plugins(working_dir)
}

/// Install a plugin
#[tauri::command]
pub async fn install_plugin(
    _app: AppHandle,
    plugin: Plugin,
    working_dir: Option<String>,
) -> Result<(), String> {
    let claude_dir = get_claude_directory(working_dir.clone())?;

    // Create .claude directory if it doesn't exist
    if !claude_dir.exists() {
        fs::create_dir_all(&claude_dir)
            .map_err(|e| format!("Failed to create .claude directory: {}", e))?;
    }

    // Create plugins directory if it doesn't exist
    let plugins_dir = claude_dir.join("plugins");
    if !plugins_dir.exists() {
        fs::create_dir_all(&plugins_dir)
            .map_err(|e| format!("Failed to create plugins directory: {}", e))?;
    }

    // TODO: Download plugin files from repository
    // For now, we just mark it as installed in the manifest

    // Update manifest
    let mut installed = get_installed_plugins(working_dir.clone())?;
    if !installed.iter().any(|p| p.id == plugin.id) {
        let mut plugin_to_install = plugin.clone();
        plugin_to_install.installed = true;
        installed.push(plugin_to_install);

        let manifest_path = plugins_dir.join("manifest.json");
        let content = serde_json::to_string_pretty(&installed)
            .map_err(|e| format!("Failed to serialize manifest: {}", e))?;

        fs::write(&manifest_path, content)
            .map_err(|e| format!("Failed to write manifest: {}", e))?;
    }

    Ok(())
}

/// Uninstall a plugin
#[tauri::command]
pub async fn uninstall_plugin(
    _app: AppHandle,
    plugin_id: String,
    working_dir: Option<String>,
) -> Result<(), String> {
    let claude_dir = get_claude_directory(working_dir.clone())?;
    let plugins_dir = claude_dir.join("plugins");
    let manifest_path = plugins_dir.join("manifest.json");

    if !manifest_path.exists() {
        return Err("No plugins installed".to_string());
    }

    let mut installed = get_installed_plugins(working_dir)?;
    installed.retain(|p| p.id != plugin_id);

    let content = serde_json::to_string_pretty(&installed)
        .map_err(|e| format!("Failed to serialize manifest: {}", e))?;

    fs::write(&manifest_path, content)
        .map_err(|e| format!("Failed to write manifest: {}", e))?;

    Ok(())
}

/// Search plugins by query
#[tauri::command]
pub async fn search_plugins(
    app: AppHandle,
    query: String,
    working_dir: Option<String>,
) -> Result<Vec<Plugin>, String> {
    let all_plugins = list_available_plugins(app, working_dir).await?;
    let query_lower = query.to_lowercase();

    let filtered: Vec<Plugin> = all_plugins
        .into_iter()
        .filter(|p| {
            p.name.to_lowercase().contains(&query_lower)
                || p.description.to_lowercase().contains(&query_lower)
                || p.metadata.tags.iter().any(|t| t.to_lowercase().contains(&query_lower))
        })
        .collect();

    Ok(filtered)
}
