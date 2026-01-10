/**
 * Kanban Tasks File Watcher
 *
 * Watches the Kanban tasks JSON file for changes made by the MCP server
 * and emits Tauri events for immediate UI updates (event-driven architecture).
 *
 * This solves the race condition where MCP writes to the file but the frontend
 * doesn't see the changes until the next polling cycle.
 */

use notify::{Event, EventKind, RecommendedWatcher};
use notify_debouncer_full::{new_debouncer, DebounceEventResult, Debouncer, FileIdMap};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;

/// Event payload emitted when Kanban tasks file changes
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KanbanFileEvent {
    pub path: String,
    pub event_type: String, // "modified" | "created"
}

/// Manager for the Kanban tasks file watcher
pub struct KanbanWatcherManager {
    watcher: Arc<Mutex<Option<Debouncer<RecommendedWatcher, FileIdMap>>>>,
    file_path: Arc<Mutex<Option<String>>>,
}

impl KanbanWatcherManager {
    pub fn new() -> Self {
        Self {
            watcher: Arc::new(Mutex::new(None)),
            file_path: Arc::new(Mutex::new(None)),
        }
    }

    /// Start watching the Kanban tasks file
    pub async fn start(&self, app: AppHandle, file_path: String) -> Result<(), String> {
        let mut watcher_guard = self.watcher.lock().await;

        // Check if already watching
        if watcher_guard.is_some() {
            log::warn!(
                "[KanbanWatcher] Already watching a file, stopping previous watcher"
            );
            *watcher_guard = None;
        }

        // Validate path exists (create parent dir if needed)
        let file_path_buf = PathBuf::from(&file_path);
        if let Some(parent) = file_path_buf.parent() {
            if !parent.exists() {
                std::fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create parent directory: {}", e))?;
            }
        }

        // Create empty file if it doesn't exist
        if !file_path_buf.exists() {
            std::fs::write(&file_path_buf, r#"{"kanbanTasks":[]}"#)
                .map_err(|e| format!("Failed to create tasks file: {}", e))?;
        }

        log::info!(
            "[KanbanWatcher] Starting watcher for file: {} (debounce: 300ms)",
            file_path
        );

        // Clone for the event handler
        let file_path_clone = file_path.clone();
        let app_clone = app.clone();

        // Create debounced watcher (300ms delay - faster than Brain for immediate feedback)
        let mut debouncer = new_debouncer(
            Duration::from_millis(300),
            None,
            move |result: DebounceEventResult| {
                match result {
                    Ok(events) => {
                        for event in events.iter() {
                            if let Err(e) = handle_kanban_file_event(
                                &app_clone,
                                &file_path_clone,
                                &event.event,
                            ) {
                                log::error!("[KanbanWatcher] Event handler error: {}", e);
                            }
                        }
                    }
                    Err(errors) => {
                        for error in errors.iter() {
                            log::error!("[KanbanWatcher] Watch error: {}", error);
                        }
                    }
                }
            },
        )
        .map_err(|e| format!("Failed to create debouncer: {}", e))?;

        // Watch the specific file (not recursive - only the file itself)
        debouncer
            .watch(&file_path_buf, notify::RecursiveMode::NonRecursive)
            .map_err(|e| format!("Failed to watch file: {}", e))?;

        // Store the watcher and path
        *watcher_guard = Some(debouncer);
        *self.file_path.lock().await = Some(file_path.clone());

        log::info!("[KanbanWatcher] Watcher started for file: {}", file_path);
        Ok(())
    }

    /// Stop watching the Kanban tasks file
    pub async fn stop(&self) -> Result<(), String> {
        let mut watcher_guard = self.watcher.lock().await;
        let mut path_guard = self.file_path.lock().await;

        if watcher_guard.is_some() {
            *watcher_guard = None;
            let path = path_guard.take();
            log::info!(
                "[KanbanWatcher] Stopped watcher for file: {}",
                path.unwrap_or_else(|| "unknown".to_string())
            );
            Ok(())
        } else {
            Err("No Kanban watcher is currently active".to_string())
        }
    }

    /// Check if file is being watched
    pub async fn is_watching(&self) -> bool {
        self.watcher.lock().await.is_some()
    }

    /// Get the current file path being watched
    pub async fn get_file_path(&self) -> Option<String> {
        self.file_path.lock().await.clone()
    }
}

impl Default for KanbanWatcherManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Handle a file system event and emit kanban events
fn handle_kanban_file_event(
    app: &AppHandle,
    file_path: &str,
    event: &Event,
) -> Result<(), String> {
    use notify::event::{CreateKind, ModifyKind};

    let paths = &event.paths;
    if paths.is_empty() {
        return Ok(());
    }

    // Determine event type
    let event_type = match &event.kind {
        EventKind::Create(CreateKind::File) => "created",
        EventKind::Modify(ModifyKind::Data(_)) => "modified",
        EventKind::Modify(ModifyKind::Any) => "modified", // Fallback for generic modify
        _ => return Ok(()), // Ignore other events
    };

    // Process each path in the event
    for path in paths {
        // Only process JSON files
        if !is_json_file(path) {
            continue;
        }

        // Skip if this isn't the Kanban tasks file we're watching
        if !path_matches(path, file_path) {
            continue;
        }

        // Convert to string path
        let path_str = match path.to_str() {
            Some(p) => p.to_string(),
            None => continue,
        };

        // Emit the event
        let kanban_event = KanbanFileEvent {
            path: path_str.clone(),
            event_type: event_type.to_string(),
        };

        // Emit kanban:tasks-changed event (single event for simplicity)
        if let Err(e) = app.emit("kanban:tasks-changed", &kanban_event) {
            log::error!("[KanbanWatcher] Failed to emit event: {}", e);
        } else {
            log::info!(
                "[KanbanWatcher] Emitted kanban:tasks-changed event (type: {})",
                event_type
            );
        }
    }

    Ok(())
}

/// Check if a path is a JSON file
fn is_json_file(path: &Path) -> bool {
    path.extension()
        .map(|ext| ext.to_string_lossy().to_lowercase() == "json")
        .unwrap_or(false)
}

/// Check if event path matches the watched file path
fn path_matches(event_path: &Path, watched_path: &str) -> bool {
    // Normalize both paths for comparison
    event_path
        .to_str()
        .map(|p| {
            let normalized_event = PathBuf::from(p);
            let normalized_watched = PathBuf::from(watched_path);
            normalized_event == normalized_watched
        })
        .unwrap_or(false)
}

// ==========================================
// Tauri Commands
// ==========================================

/// Start Kanban tasks file watcher
#[tauri::command]
pub async fn kanban_start_watcher(
    app: AppHandle,
    state: tauri::State<'_, KanbanWatcherManager>,
    file_path: String,
) -> Result<(), String> {
    state.start(app, file_path).await
}

/// Stop Kanban tasks file watcher
#[tauri::command]
pub async fn kanban_stop_watcher(
    state: tauri::State<'_, KanbanWatcherManager>,
) -> Result<(), String> {
    state.stop().await
}

/// Check if Kanban tasks file is being watched
#[tauri::command]
pub async fn kanban_is_watching(
    state: tauri::State<'_, KanbanWatcherManager>,
) -> Result<bool, String> {
    Ok(state.is_watching().await)
}

/// Get current watched file path
#[tauri::command]
pub async fn kanban_get_watched_path(
    state: tauri::State<'_, KanbanWatcherManager>,
) -> Result<Option<String>, String> {
    Ok(state.get_file_path().await)
}
