/**
 * Semantic Search File Watcher Module
 *
 * Provides file system watching for semantic code search indexing.
 * Monitors project directories and emits events when files change.
 */

use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode};
use notify_debouncer_full::{new_debouncer, DebounceEventResult, Debouncer, RecommendedCache};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::Mutex;

/// File operation type for semantic search events
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FileOperation {
    Create,
    Modify,
    Delete,
}

/// Event payload emitted when a file changes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SemanticFileEvent {
    #[serde(rename = "filePath")]
    pub file_path: String,
    pub operation: FileOperation,
    #[serde(rename = "projectPath")]
    pub project_path: String,
}

/// Configuration for semantic file watcher
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WatcherConfig {
    /// Debounce delay in milliseconds (default: 500ms)
    #[serde(default = "default_debounce_ms")]
    pub debounce_ms: u64,
    /// Glob patterns to include (e.g., "**/*.ts", "**/*.rs")
    pub include_patterns: Vec<String>,
    /// Directories to exclude (default: [".git", "node_modules", "dist", "build", "target"])
    #[serde(default = "default_exclude_dirs")]
    pub exclude_dirs: Vec<String>,
}

fn default_debounce_ms() -> u64 {
    500
}

fn default_exclude_dirs() -> Vec<String> {
    vec![
        ".git".to_string(),
        "node_modules".to_string(),
        "dist".to_string(),
        "build".to_string(),
        "target".to_string(),
        ".next".to_string(),
        ".vite".to_string(),
        "coverage".to_string(),
    ]
}

impl Default for WatcherConfig {
    fn default() -> Self {
        Self {
            debounce_ms: default_debounce_ms(),
            include_patterns: vec![],
            exclude_dirs: default_exclude_dirs(),
        }
    }
}

/// Manager for multiple semantic file watchers (one per project)
pub struct SemanticWatcherManager {
    /// Map of project_path -> active debouncer
    watchers: Arc<Mutex<HashMap<String, Debouncer<RecommendedWatcher, RecommendedCache>>>>,
}

impl SemanticWatcherManager {
    pub fn new() -> Self {
        Self {
            watchers: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Start watching a project directory
    pub async fn start_watcher(
        &self,
        app: AppHandle,
        project_path: String,
        config: WatcherConfig,
    ) -> Result<(), String> {
        let mut watchers = self.watchers.lock().await;

        // Check if already watching this project
        if watchers.contains_key(&project_path) {
            log::warn!(
                "[SemanticWatcher] Already watching project: {}",
                project_path
            );
            return Err(format!("Already watching project: {}", project_path));
        }

        let project_path_buf = PathBuf::from(&project_path);
        if !project_path_buf.exists() {
            return Err(format!("Project path does not exist: {}", project_path));
        }

        log::info!(
            "[SemanticWatcher] Starting watcher for: {} (debounce: {}ms)",
            project_path,
            config.debounce_ms
        );

        // Clone for the event handler
        let project_path_clone = project_path.clone();
        let config_clone = config.clone();
        let app_clone = app.clone();

        // Create debounced watcher
        let mut debouncer = new_debouncer(
            Duration::from_millis(config.debounce_ms),
            None,
            move |result: DebounceEventResult| {
                match result {
                    Ok(events) => {
                        for event in events.iter() {
                            if let Err(e) = handle_file_event(
                                &app_clone,
                                &project_path_clone,
                                &config_clone,
                                &event.event,
                            ) {
                                log::error!("[SemanticWatcher] Event handler error: {}", e);
                            }
                        }
                    }
                    Err(errors) => {
                        for error in errors.iter() {
                            log::error!("[SemanticWatcher] Watch error: {}", error);
                        }
                    }
                }
            },
        )
        .map_err(|e| format!("Failed to create debouncer: {}", e))?;

        // Start watching the directory recursively
        debouncer
            .watch(&project_path_buf, RecursiveMode::Recursive)
            .map_err(|e| format!("Failed to watch directory: {}", e))?;

        // Store the debouncer
        watchers.insert(project_path.clone(), debouncer);

        log::info!("[SemanticWatcher] Watcher started for: {}", project_path);
        Ok(())
    }

    /// Stop watching a project directory
    pub async fn stop_watcher(&self, project_path: String) -> Result<(), String> {
        let mut watchers = self.watchers.lock().await;

        if watchers.remove(&project_path).is_some() {
            log::info!("[SemanticWatcher] Stopped watcher for: {}", project_path);
            Ok(())
        } else {
            Err(format!("No watcher found for project: {}", project_path))
        }
    }

    /// Check if a project is being watched
    pub async fn is_watching(&self, project_path: &str) -> bool {
        let watchers = self.watchers.lock().await;
        watchers.contains_key(project_path)
    }

    /// Get list of all watched projects
    pub async fn get_watched_projects(&self) -> Vec<String> {
        let watchers = self.watchers.lock().await;
        watchers.keys().cloned().collect()
    }

    /// Stop all watchers
    pub async fn stop_all(&self) {
        let mut watchers = self.watchers.lock().await;
        let count = watchers.len();
        watchers.clear();
        log::info!("[SemanticWatcher] Stopped all {} watchers", count);
    }
}

impl Default for SemanticWatcherManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Handle a file system event and emit semantic search event
fn handle_file_event(
    app: &AppHandle,
    project_path: &str,
    config: &WatcherConfig,
    event: &Event,
) -> Result<(), String> {
    use notify::event::{CreateKind, ModifyKind, RemoveKind};

    let paths = &event.paths;
    if paths.is_empty() {
        return Ok(());
    }

    // Determine operation type
    let operation = match &event.kind {
        EventKind::Create(CreateKind::File) => FileOperation::Create,
        EventKind::Modify(ModifyKind::Data(_)) | EventKind::Modify(ModifyKind::Name(_)) => {
            FileOperation::Modify
        }
        EventKind::Remove(RemoveKind::File) => FileOperation::Delete,
        _ => return Ok(()), // Ignore other events
    };

    // Process each path in the event
    for path in paths {
        // Skip if path doesn't exist (for delete events, we still want to process)
        if !matches!(operation, FileOperation::Delete) && !path.exists() {
            continue;
        }

        // Convert to string path
        let file_path = match path.to_str() {
            Some(p) => p.to_string(),
            None => continue,
        };

        // Check if path should be excluded
        if should_exclude_path(path, &config.exclude_dirs) {
            continue;
        }

        // Check if path matches include patterns (if specified)
        if !config.include_patterns.is_empty()
            && !matches_patterns(path, &config.include_patterns)
        {
            continue;
        }

        // Emit the event
        let semantic_event = SemanticFileEvent {
            file_path: file_path.clone(),
            operation: operation.clone(),
            project_path: project_path.to_string(),
        };

        if let Err(e) = app.emit("semantic:file-changed", &semantic_event) {
            log::error!("[SemanticWatcher] Failed to emit event: {}", e);
        } else {
            log::debug!(
                "[SemanticWatcher] Emitted {:?} event for: {}",
                operation,
                file_path
            );
        }
    }

    Ok(())
}

/// Check if a path should be excluded based on exclude_dirs
fn should_exclude_path(path: &Path, exclude_dirs: &[String]) -> bool {
    for component in path.components() {
        if let Some(component_str) = component.as_os_str().to_str() {
            if exclude_dirs.contains(&component_str.to_string()) {
                return true;
            }
        }
    }
    false
}

/// Check if a path matches any of the glob patterns
fn matches_patterns(path: &Path, patterns: &[String]) -> bool {
    use glob::Pattern;

    let path_str = match path.to_str() {
        Some(s) => s,
        None => return false,
    };

    for pattern_str in patterns {
        if let Ok(pattern) = Pattern::new(pattern_str) {
            if pattern.matches(path_str) {
                return true;
            }
        }
    }

    false
}

// ==========================================
// Tauri Commands
// ==========================================

/// Start a semantic file watcher for a project
#[tauri::command]
pub async fn start_semantic_watcher(
    app: AppHandle,
    project_path: String,
    config: Option<WatcherConfig>,
) -> Result<(), String> {
    let manager: tauri::State<SemanticWatcherManager> = app.state();
    let watcher_config = config.unwrap_or_default();

    manager
        .start_watcher(app.clone(), project_path, watcher_config)
        .await
}

/// Stop a semantic file watcher for a project
#[tauri::command]
pub async fn stop_semantic_watcher(
    app: AppHandle,
    project_path: String,
) -> Result<(), String> {
    let manager: tauri::State<SemanticWatcherManager> = app.state();
    manager.stop_watcher(project_path).await
}

/// Check if a project is being watched
#[tauri::command]
pub async fn is_semantic_watcher_active(app: AppHandle, project_path: String) -> Result<bool, String> {
    let manager: tauri::State<SemanticWatcherManager> = app.state();
    Ok(manager.is_watching(&project_path).await)
}

/// Get list of all watched projects
#[tauri::command]
pub async fn get_watched_semantic_projects(app: AppHandle) -> Result<Vec<String>, String> {
    let manager: tauri::State<SemanticWatcherManager> = app.state();
    Ok(manager.get_watched_projects().await)
}

/// Stop all semantic watchers
#[tauri::command]
pub async fn stop_all_semantic_watchers(app: AppHandle) -> Result<(), String> {
    let manager: tauri::State<SemanticWatcherManager> = app.state();
    manager.stop_all().await;
    Ok(())
}

// ==========================================
// Node.js Script Execution Commands
// ==========================================

use std::process::Stdio;
use tokio::process::Command;

/// Get the path to the semantic search bridge script
fn get_semantic_search_script_path(_app: &AppHandle) -> Result<String, String> {
    // In development, use compile-time path relative to Cargo.toml
    // CARGO_MANIFEST_DIR points to src-tauri directory
    let manifest_dir = env!("CARGO_MANIFEST_DIR");
    let dev_path = std::path::Path::new(manifest_dir)
        .join("node-sdk/semantic-search-bridge.js");

    if dev_path.exists() {
        log::info!("[SemanticSearch] Using dev script: {:?}", dev_path);
        return Ok(dev_path.to_string_lossy().to_string());
    }

    // TODO: In production, use app.path().resource_dir()
    // For now, return error with helpful message
    Err(format!(
        "Semantic search bridge script not found at: {:?}\nMANIFEST_DIR: {}",
        dev_path, manifest_dir
    ))
}

/// Execute a semantic search command via the bridge script
async fn execute_semantic_search_command(
    app: AppHandle,
    command: &str,
    args_json: &str,
) -> Result<String, String> {
    let script_path = get_semantic_search_script_path(&app)?;

    log::info!("[SemanticSearch] Executing command: {} with script: {}", command, script_path);

    // Execute node with the bridge script: node semantic-search-bridge.js <command> <args-json>
    let mut cmd = Command::new("node");
    cmd.arg(&script_path)
        .arg(command)
        .arg(args_json)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    // Windows: Hide console window
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = cmd.spawn()
        .map_err(|e| format!("Failed to spawn node process: {}", e))?;

    // Wait for the command to finish
    let output = child.wait_with_output().await
        .map_err(|e| format!("Failed to wait for node process: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        log::error!("[SemanticSearch] Node.js error: {}", stderr);
        return Err(format!("Node.js execution failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.trim().to_string())
}

/// Index a project for semantic search
#[tauri::command]
pub async fn semantic_search_index_project(
    app: AppHandle,
    project_path: String,
    patterns: Option<Vec<String>>,
) -> Result<String, String> {
    let patterns_json = match patterns {
        Some(p) => serde_json::to_string(&p).map_err(|e| format!("Failed to serialize patterns: {}", e))?,
        None => r#"["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"]"#.to_string(),
    };

    let args_json = format!(
        r#"{{ "projectPath": "{}", "patterns": {} }}"#,
        project_path.replace("\\", "\\\\"),
        patterns_json
    );

    execute_semantic_search_command(app, "index_project", &args_json).await
}

/// Search code semantically
#[tauri::command]
pub async fn semantic_search_code(
    app: AppHandle,
    query: String,
    project_path: String,
    level: Option<String>,
    limit: Option<u32>,
) -> Result<String, String> {
    let args_json = format!(
        r#"{{ "query": "{}", "projectPath": "{}", "level": "{}", "limit": {} }}"#,
        query.replace("\"", "\\\""),
        project_path.replace("\\", "\\\\"),
        level.unwrap_or_else(|| "all".to_string()),
        limit.unwrap_or(10)
    );

    execute_semantic_search_command(app, "search_code", &args_json).await
}

/// Get index status for a project
#[tauri::command]
pub async fn semantic_search_get_status(
    app: AppHandle,
    project_path: String,
) -> Result<String, String> {
    let args_json = format!(
        r#"{{ "projectPath": "{}" }}"#,
        project_path.replace("\\", "\\\\")
    );

    execute_semantic_search_command(app, "get_status", &args_json).await
}

/// Generate embeddings for indexed chunks
#[tauri::command]
pub async fn semantic_search_generate_embeddings(
    app: AppHandle,
    project_path: String,
    batch_size: Option<u32>,
    force: Option<bool>,
) -> Result<String, String> {
    let args_json = format!(
        r#"{{ "projectPath": "{}", "batchSize": {}, "force": {} }}"#,
        project_path.replace("\\", "\\\\"),
        batch_size.unwrap_or(32),
        force.unwrap_or(false)
    );

    execute_semantic_search_command(app, "generate_embeddings", &args_json).await
}
