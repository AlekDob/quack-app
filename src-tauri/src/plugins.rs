use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::io::{Read, Write};
use tauri::{AppHandle, Emitter};
use reqwest;
use zip::ZipArchive;

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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scope: Option<PluginScope>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PluginScope {
    Global,
    Project,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginManifest {
    pub name: String,
    pub description: String,
    pub version: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub author: Option<PluginAuthor>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginAuthor {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketplaceManifest {
    pub name: String,
    pub owner: MarketplaceOwner,
    pub plugins: Vec<MarketplacePlugin>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketplaceOwner {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketplacePlugin {
    pub name: String,
    pub source: String,
    pub description: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub author: Option<PluginAuthor>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub license: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub keywords: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub commands: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agents: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hooks: Option<Vec<String>>,
    #[serde(rename = "mcpServers")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mcp_servers: Option<Vec<String>>,
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

/// Get the path to .claude directory (project-level)
fn get_claude_directory(working_dir: Option<String>) -> Result<PathBuf, String> {
    let base_path = if let Some(dir) = working_dir {
        PathBuf::from(dir)
    } else {
        std::env::current_dir()
            .map_err(|e| format!("Failed to get current directory: {}", e))?
    };

    Ok(base_path.join(".claude"))
}

/// Get the path to global .claude directory (~/.claude)
fn get_global_claude_directory() -> Result<PathBuf, String> {
    let home_dir = dirs::home_dir()
        .ok_or_else(|| "Failed to get home directory".to_string())?;
    Ok(home_dir.join(".claude"))
}

/// Get the appropriate .claude directory based on scope
fn get_claude_directory_for_scope(scope: &PluginScope, working_dir: Option<String>) -> Result<PathBuf, String> {
    match scope {
        PluginScope::Global => get_global_claude_directory(),
        PluginScope::Project => get_claude_directory(working_dir),
    }
}

/// Download plugin from GitHub repository
async fn download_plugin_from_github(repo_url: &str) -> Result<Vec<u8>, String> {
    // Convert repository URL to ZIP download URL
    // Example: https://github.com/davila7/claude-code-templates
    // Becomes: https://github.com/davila7/claude-code-templates/archive/refs/heads/main.zip
    let zip_url = if repo_url.ends_with('/') {
        format!("{}archive/refs/heads/main.zip", repo_url)
    } else {
        format!("{}/archive/refs/heads/main.zip", repo_url)
    };

    let response = reqwest::get(&zip_url)
        .await
        .map_err(|e| format!("Failed to download plugin: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Failed to download plugin: HTTP {}", response.status()));
    }

    let bytes = response.bytes()
        .await
        .map_err(|e| format!("Failed to read plugin data: {}", e))?;

    Ok(bytes.to_vec())
}

/// Detect if repository is a marketplace or single plugin
fn detect_repository_type(archive: &mut ZipArchive<std::io::Cursor<Vec<u8>>>) -> Result<(bool, Option<MarketplaceManifest>), String> {
    // Look for marketplace.json in .claude-plugin directory
    for i in 0..archive.len() {
        let file_path = {
            let file = archive.by_index(i)
                .map_err(|e| format!("Failed to read archive entry: {}", e))?;
            file.name().to_string()
        };

        // Check for .claude-plugin/marketplace.json
        if file_path.contains(".claude-plugin/marketplace.json") {
            let mut file = archive.by_index(i)
                .map_err(|e| format!("Failed to read marketplace.json: {}", e))?;

            let mut content = String::new();
            file.read_to_string(&mut content)
                .map_err(|e| format!("Failed to read marketplace.json content: {}", e))?;

            let manifest: MarketplaceManifest = serde_json::from_str(&content)
                .map_err(|e| format!("Failed to parse marketplace.json: {}", e))?;

            return Ok((true, Some(manifest)));
        }
    }

    // Not a marketplace - it's a single plugin repository
    Ok((false, None))
}

/// Extract plugin files from ZIP archive
/// Supports both marketplace repositories (multiple plugins) and single plugin repositories
fn extract_plugin_files(zip_data: Vec<u8>, plugin_id: &str, scope: &PluginScope, working_dir: Option<String>) -> Result<(), String> {
    println!("🦆 EXTRACT START: plugin_id={}, scope={:?}, working_dir={:?}", plugin_id, scope, working_dir);

    let cursor = std::io::Cursor::new(zip_data.clone());
    let mut archive = ZipArchive::new(cursor)
        .map_err(|e| format!("Failed to open ZIP archive: {}", e))?;

    println!("🦆 ZIP opened successfully, {} files found", archive.len());

    let claude_dir = get_claude_directory_for_scope(scope, working_dir)?;
    println!("🦆 Target .claude directory: {:?}", claude_dir);

    // Create .claude directory if it doesn't exist
    if !claude_dir.exists() {
        println!("🦆 Creating .claude directory...");
        fs::create_dir_all(&claude_dir)
            .map_err(|e| format!("Failed to create .claude directory: {}", e))?;
    }

    // Detect repository type
    println!("🦆 Detecting repository type...");
    let (is_marketplace, marketplace_manifest) = detect_repository_type(&mut archive)?;
    println!("🦆 Repository type: marketplace={}, has_manifest={}", is_marketplace, marketplace_manifest.is_some());

    // Re-open archive after detection
    let cursor = std::io::Cursor::new(zip_data);
    let mut archive = ZipArchive::new(cursor)
        .map_err(|e| format!("Failed to re-open ZIP archive: {}", e))?;

    if is_marketplace {
        // MARKETPLACE REPOSITORY: Extract specific plugin using manifest file paths
        println!("🦆 MARKETPLACE MODE: Looking for plugin '{}'", plugin_id);

        // Find the plugin from marketplace manifest
        let plugin_manifest = marketplace_manifest
            .as_ref()
            .and_then(|m| m.plugins.iter().find(|p| p.name == plugin_id))
            .ok_or_else(|| format!("Plugin '{}' not found in marketplace", plugin_id))?;

        println!("🦆 Found plugin in manifest: {}", plugin_manifest.name);

        // Get the root directory name from first archive entry (e.g., "claude-code-templates-main")
        let root_dir = {
            if archive.len() > 0 {
                let first_file = archive.by_index(0)
                    .map_err(|e| format!("Failed to read first archive entry: {}", e))?;
                let name = first_file.name();
                name.split('/').next().unwrap_or("").to_string()
            } else {
                return Err("Empty ZIP archive".to_string());
            }
        };
        println!("🦆 Archive root directory: {}", root_dir);

        // Collect all file paths to extract from the plugin manifest
        let mut files_to_extract = Vec::new();

        if let Some(agents) = &plugin_manifest.agents {
            for agent_path in agents {
                files_to_extract.push((agent_path.clone(), "agents"));
            }
        }

        if let Some(commands) = &plugin_manifest.commands {
            for command_path in commands {
                files_to_extract.push((command_path.clone(), "commands"));
            }
        }

        if let Some(hooks) = &plugin_manifest.hooks {
            for hook_path in hooks {
                files_to_extract.push((hook_path.clone(), "hooks"));
            }
        }

        if let Some(mcp_servers) = &plugin_manifest.mcp_servers {
            for mcp_path in mcp_servers {
                files_to_extract.push((mcp_path.clone(), "mcps"));
            }
        }

        println!("🦆 Files to extract: {} total", files_to_extract.len());

        // Extract each file
        let mut files_extracted = 0;
        for (relative_path, dest_type) in files_to_extract {
            // Convert relative path to full ZIP path
            // Example: "./cli-tool/components/agents/documentation/technical-writer.md"
            // becomes "claude-code-templates-main/cli-tool/components/agents/documentation/technical-writer.md"
            let clean_path = relative_path.trim_start_matches("./");
            let full_path = format!("{}/{}", root_dir, clean_path);

            println!("🦆 Looking for file in ZIP: {}", full_path);

            // Find and extract this file from the archive
            let mut found = false;
            for i in 0..archive.len() {
                let mut file = archive.by_index(i)
                    .map_err(|e| format!("Failed to read archive entry: {}", e))?;

                if file.name() == full_path {
                    println!("🦆 Found file in archive!");
                    found = true;

                    if file.is_dir() {
                        println!("🦆 Skipping (is directory)");
                        break;
                    }

                    // Extract filename from path
                    let filename = std::path::Path::new(clean_path)
                        .file_name()
                        .ok_or_else(|| "Invalid file path".to_string())?
                        .to_string_lossy()
                        .to_string();

                    // Determine destination path
                    let dest_path = claude_dir.join(dest_type).join(&filename);
                    println!("🦆 Extracting to: {:?}", dest_path);

                    // Create parent directory if needed
                    if let Some(parent) = dest_path.parent() {
                        if !parent.exists() {
                            println!("🦆 Creating parent directory: {:?}", parent);
                            fs::create_dir_all(parent)
                                .map_err(|e| format!("Failed to create directory: {}", e))?;
                        }
                    }

                    // Extract file
                    let mut dest_file = fs::File::create(&dest_path)
                        .map_err(|e| format!("Failed to create file: {}", e))?;

                    let mut buffer = Vec::new();
                    file.read_to_end(&mut buffer)
                        .map_err(|e| format!("Failed to read file from archive: {}", e))?;

                    dest_file.write_all(&buffer)
                        .map_err(|e| format!("Failed to write file: {}", e))?;

                    files_extracted += 1;
                    println!("🦆 ✅ File extracted successfully!");
                    break;
                }
            }

            if !found {
                println!("🦆 ⚠️ WARNING: File not found in archive: {}", full_path);
            }
        }

        println!("🦆 MARKETPLACE EXTRACTION COMPLETE: {} files extracted", files_extracted);
    } else {
        // SINGLE PLUGIN REPOSITORY: Extract from root .claude-plugin directory
        println!("🦆 SINGLE PLUGIN MODE");

        let mut files_extracted = 0;
        for i in 0..archive.len() {
            let mut file = archive.by_index(i)
                .map_err(|e| format!("Failed to read archive entry: {}", e))?;

            let file_path = file.name().to_string();

            // Skip if not in a .claude-plugin directory
            if !file_path.contains(".claude-plugin/") {
                continue;
            }

            println!("🦆 Processing file: {}", file_path);

            // Extract the relative path after .claude-plugin/
            let parts: Vec<&str> = file_path.split(".claude-plugin/").collect();
            if parts.len() < 2 {
                println!("🦆 Skipping (invalid path structure): {}", file_path);
                continue;
            }

            let relative_path = parts[1];
            if relative_path.is_empty() || file.is_dir() {
                println!("🦆 Skipping (empty or directory): {}", file_path);
                continue;
            }

            // Determine destination based on file type
            let dest_path = if relative_path.starts_with("agents/") {
                claude_dir.join("agents").join(&relative_path[7..])
            } else if relative_path.starts_with("commands/") {
                claude_dir.join("commands").join(&relative_path[9..])
            } else if relative_path.starts_with("skills/") {
                claude_dir.join("skills").join(&relative_path[7..])
            } else if relative_path.starts_with("hooks/") {
                claude_dir.join("hooks").join(&relative_path[6..])
            } else {
                println!("🦆 Skipping (not agents/commands/skills/hooks): {}", relative_path);
                continue; // Skip plugin.json and other metadata files
            };

            println!("🦆 Extracting to: {:?}", dest_path);

            // Create parent directories if needed
            if let Some(parent) = dest_path.parent() {
                if !parent.exists() {
                    println!("🦆 Creating parent directory: {:?}", parent);
                    fs::create_dir_all(parent)
                        .map_err(|e| format!("Failed to create directory: {}", e))?;
                }
            }

            // Extract file
            let mut dest_file = fs::File::create(&dest_path)
                .map_err(|e| format!("Failed to create file: {}", e))?;

            let mut buffer = Vec::new();
            file.read_to_end(&mut buffer)
                .map_err(|e| format!("Failed to read file from archive: {}", e))?;

            dest_file.write_all(&buffer)
                .map_err(|e| format!("Failed to write file: {}", e))?;

            files_extracted += 1;
            println!("🦆 ✅ File extracted successfully!");
        }

        println!("🦆 SINGLE PLUGIN EXTRACTION COMPLETE: {} files extracted", files_extracted);
    }

    println!("🦆 EXTRACT FINISHED SUCCESSFULLY!");
    Ok(())
}

/// Fetch marketplace manifest from GitHub repository
async fn fetch_marketplace_manifest(repo_url: &str) -> Result<Option<MarketplaceManifest>, String> {
    // Convert repository URL to raw GitHub URL for marketplace.json
    // Example: https://github.com/davila7/claude-code-templates
    // Becomes: https://raw.githubusercontent.com/davila7/claude-code-templates/main/.claude-plugin/marketplace.json
    let raw_url = repo_url
        .replace("github.com", "raw.githubusercontent.com")
        .trim_end_matches('/')
        .to_string();

    let _manifest_url = format!("{}/.claude-plugin/marketplace.json", raw_url.replace("/main", ""));
    let manifest_url_main = format!("{}/main/.claude-plugin/marketplace.json", raw_url);

    // Try both URLs (some repos use main, others master)
    let response = match reqwest::get(&manifest_url_main).await {
        Ok(resp) if resp.status().is_success() => resp,
        _ => {
            // Fallback to master branch
            let manifest_url_master = format!("{}/master/.claude-plugin/marketplace.json", raw_url);
            reqwest::get(&manifest_url_master)
                .await
                .map_err(|e| format!("Failed to fetch marketplace.json: {}", e))?
        }
    };

    if !response.status().is_success() {
        return Ok(None); // Not a marketplace
    }

    let content = response.text()
        .await
        .map_err(|e| format!("Failed to read marketplace.json: {}", e))?;

    let manifest: MarketplaceManifest = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse marketplace.json: {}", e))?;

    Ok(Some(manifest))
}

/// List all available plugins from configured sources
#[tauri::command]
pub async fn list_available_plugins(
    _app: AppHandle,
    working_dir: Option<String>,
) -> Result<Vec<Plugin>, String> {
    let mut plugins = Vec::new();

    // Fetch from davila7/claude-code-templates marketplace
    let davila7_repo = "https://github.com/davila7/claude-code-templates";
    match fetch_marketplace_manifest(davila7_repo).await {
        Ok(Some(manifest)) => {
            // Convert marketplace plugins to our Plugin struct
            for mp in manifest.plugins {
                // Determine category based on plugin contents
                let category = if mp.agents.as_ref().map(|a| !a.is_empty()).unwrap_or(false) {
                    PluginCategory::Agent
                } else if mp.commands.as_ref().map(|c| !c.is_empty()).unwrap_or(false) {
                    PluginCategory::Command
                } else if mp.hooks.as_ref().map(|h| !h.is_empty()).unwrap_or(false) {
                    PluginCategory::Hook
                } else if mp.mcp_servers.as_ref().map(|m| !m.is_empty()).unwrap_or(false) {
                    PluginCategory::Mcp
                } else {
                    PluginCategory::Stack
                };

                // Create a representative plugin entry
                plugins.push(Plugin {
                    id: mp.name.clone(),
                    name: mp.name.split('-').map(|w| {
                        let mut chars = w.chars();
                        match chars.next() {
                            None => String::new(),
                            Some(f) => f.to_uppercase().chain(chars).collect(),
                        }
                    }).collect::<Vec<_>>().join(" "),
                    description: mp.description.clone(),
                    category,
                    version: mp.version.unwrap_or_else(|| "1.0.0".to_string()),
                    author: mp.author
                        .as_ref()
                        .map(|a| a.name.clone())
                        .unwrap_or_else(|| manifest.owner.name.clone()),
                    repository: Some(davila7_repo.to_string()),
                    installed: false,
                    source: PluginSource::Davila7,
                    metadata: PluginMetadata {
                        icon: None,
                        tags: mp.keywords.unwrap_or_else(Vec::new),
                        dependencies: None,
                    },
                    scope: None,
                });
            }
        }
        Ok(None) => {
            eprintln!("No marketplace manifest found at {}", davila7_repo);
        }
        Err(e) => {
            eprintln!("Error fetching marketplace manifest: {}", e);
        }
    }

    // If no plugins found from API, use fallback mock data
    if plugins.is_empty() {
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
            scope: None,
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
            scope: None,
        });
    }

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
    app: AppHandle,
    plugin: Plugin,
    scope: PluginScope,
    working_dir: Option<String>,
) -> Result<(), String> {
    println!("🦆 ========================================");
    println!("🦆 INSTALL PLUGIN: {} ({})", plugin.name, plugin.id);
    println!("🦆 Scope: {:?}, Working Dir: {:?}", scope, working_dir);
    println!("🦆 ========================================");

    // Get the repository URL
    let repo_url = plugin.repository.as_ref()
        .ok_or_else(|| "Plugin has no repository URL".to_string())?;

    println!("🦆 Repository URL: {}", repo_url);

    // Download plugin from GitHub
    println!("🦆 Downloading ZIP from GitHub...");
    let zip_data = download_plugin_from_github(repo_url).await?;
    println!("🦆 Downloaded {} bytes", zip_data.len());

    // Extract plugin files to appropriate directory
    println!("🦆 Starting extraction...");
    extract_plugin_files(zip_data, &plugin.id, &scope, working_dir.clone())?;

    // Get the appropriate claude directory for manifest
    let claude_dir = get_claude_directory_for_scope(&scope, working_dir.clone())?;
    let plugins_dir = claude_dir.join("plugins");
    println!("🦆 Plugins directory: {:?}", plugins_dir);

    // Create plugins directory if it doesn't exist
    if !plugins_dir.exists() {
        println!("🦆 Creating plugins directory...");
        fs::create_dir_all(&plugins_dir)
            .map_err(|e| format!("Failed to create plugins directory: {}", e))?;
    }

    // Update manifest
    let manifest_path = plugins_dir.join("manifest.json");
    println!("🦆 Manifest path: {:?}", manifest_path);

    let mut installed = if manifest_path.exists() {
        println!("🦆 Reading existing manifest...");
        let content = fs::read_to_string(&manifest_path)
            .map_err(|e| format!("Failed to read manifest: {}", e))?;
        serde_json::from_str(&content)
            .unwrap_or_else(|_| Vec::new())
    } else {
        println!("🦆 No existing manifest, creating new one");
        Vec::new()
    };

    if !installed.iter().any(|p: &Plugin| p.id == plugin.id) {
        println!("🦆 Adding plugin to manifest...");
        let mut plugin_to_install = plugin.clone();
        plugin_to_install.installed = true;
        plugin_to_install.scope = Some(scope);
        installed.push(plugin_to_install);

        let content = serde_json::to_string_pretty(&installed)
            .map_err(|e| format!("Failed to serialize manifest: {}", e))?;

        fs::write(&manifest_path, content)
            .map_err(|e| format!("Failed to write manifest: {}", e))?;

        println!("🦆 Manifest updated successfully!");
    } else {
        println!("🦆 Plugin already in manifest, skipping...");
    }

    println!("🦆 ========================================");
    println!("🦆 INSTALLATION COMPLETE!");
    println!("🦆 ========================================");

    // Emit event to notify frontend that plugins were installed
    println!("🦆 Emitting plugin-installed event...");
    app.emit("plugin-installed", &plugin.category)
        .map_err(|e| format!("Failed to emit event: {}", e))?;

    Ok(())
}

/// Remove plugin files from filesystem
fn remove_plugin_files(plugin_id: &str, scope: &PluginScope, working_dir: Option<String>) -> Result<(), String> {
    let claude_dir = get_claude_directory_for_scope(scope, working_dir)?;

    // List of directories where plugin files might be located
    let directories = vec!["agents", "commands", "skills", "hooks"];

    for dir_name in directories {
        let dir_path = claude_dir.join(dir_name);
        if !dir_path.exists() {
            continue;
        }

        // Read directory entries
        let entries = fs::read_dir(&dir_path)
            .map_err(|e| format!("Failed to read {} directory: {}", dir_name, e))?;

        for entry in entries {
            let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
            let path = entry.path();

            // Check if this file/folder belongs to the plugin
            // Plugin files might be named after plugin_id or contain it
            if let Some(file_name) = path.file_name() {
                let name_str = file_name.to_string_lossy();

                // Match files/folders that belong to this plugin
                // This is a heuristic - ideally we'd track exact files in manifest
                if name_str.contains(&plugin_id) || name_str.starts_with(&format!("{}-", plugin_id)) {
                    if path.is_dir() {
                        fs::remove_dir_all(&path)
                            .map_err(|e| format!("Failed to remove directory: {}", e))?;
                    } else {
                        fs::remove_file(&path)
                            .map_err(|e| format!("Failed to remove file: {}", e))?;
                    }
                }
            }
        }
    }

    Ok(())
}

/// Uninstall a plugin
#[tauri::command]
pub async fn uninstall_plugin(
    app: AppHandle,
    plugin_id: String,
    working_dir: Option<String>,
) -> Result<(), String> {
    // Try to find the plugin in both global and project manifests
    let mut plugin_found: Option<(Plugin, PluginScope)> = None;

    // Check project manifest first
    let project_manifest_path = get_claude_directory(working_dir.clone())?
        .join("plugins")
        .join("manifest.json");

    if project_manifest_path.exists() {
        let content = fs::read_to_string(&project_manifest_path)
            .map_err(|e| format!("Failed to read project manifest: {}", e))?;

        if let Ok(plugins) = serde_json::from_str::<Vec<Plugin>>(&content) {
            if let Some(plugin) = plugins.iter().find(|p| p.id == plugin_id) {
                let scope = plugin.scope.clone().unwrap_or(PluginScope::Project);
                plugin_found = Some((plugin.clone(), scope));
            }
        }
    }

    // Check global manifest if not found in project
    if plugin_found.is_none() {
        let global_manifest_path = get_global_claude_directory()?
            .join("plugins")
            .join("manifest.json");

        if global_manifest_path.exists() {
            let content = fs::read_to_string(&global_manifest_path)
                .map_err(|e| format!("Failed to read global manifest: {}", e))?;

            if let Ok(plugins) = serde_json::from_str::<Vec<Plugin>>(&content) {
                if let Some(plugin) = plugins.iter().find(|p| p.id == plugin_id) {
                    let scope = plugin.scope.clone().unwrap_or(PluginScope::Global);
                    plugin_found = Some((plugin.clone(), scope));
                }
            }
        }
    }

    let (_, scope) = plugin_found.ok_or_else(|| "Plugin not found in any manifest".to_string())?;

    // Remove plugin files from filesystem
    remove_plugin_files(&plugin_id, &scope, working_dir.clone())?;

    // Update the appropriate manifest
    let claude_dir = get_claude_directory_for_scope(&scope, working_dir)?;
    let plugins_dir = claude_dir.join("plugins");
    let manifest_path = plugins_dir.join("manifest.json");

    if manifest_path.exists() {
        let content = fs::read_to_string(&manifest_path)
            .map_err(|e| format!("Failed to read manifest: {}", e))?;

        let mut installed: Vec<Plugin> = serde_json::from_str(&content)
            .unwrap_or_else(|_| Vec::new());

        installed.retain(|p| p.id != plugin_id);

        let updated_content = serde_json::to_string_pretty(&installed)
            .map_err(|e| format!("Failed to serialize manifest: {}", e))?;

        fs::write(&manifest_path, updated_content)
            .map_err(|e| format!("Failed to write manifest: {}", e))?;
    }

    // Emit event to notify frontend that a plugin was uninstalled
    app.emit("plugin-uninstalled", ())
        .map_err(|e| format!("Failed to emit event: {}", e))?;

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
