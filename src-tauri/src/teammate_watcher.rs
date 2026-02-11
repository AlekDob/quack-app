/**
 * Teammate Session Watcher Module
 *
 * Watches Claude Agent SDK session JSONL files for changes to stream
 * teammate activity in real-time. Emits "teammate-event:{session_id}"
 * events so the frontend can render teammate streams in dedicated tabs.
 */

use notify::{RecommendedWatcher, RecursiveMode};
use notify_debouncer_full::{new_debouncer, DebounceEventResult, Debouncer, FileIdMap};
use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader, Seek, SeekFrom};
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;

/// Manager for teammate session watchers (one per session)
pub struct TeammateSessionWatcher {
    watchers: Arc<Mutex<HashMap<String, Debouncer<RecommendedWatcher, FileIdMap>>>>,
    file_positions: Arc<Mutex<HashMap<String, u64>>>,
}

impl TeammateSessionWatcher {
    pub fn new() -> Self {
        Self {
            watchers: Arc::new(Mutex::new(HashMap::new())),
            file_positions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn start_watching(
        &self,
        app: AppHandle,
        session_id: String,
        agent_name: String,
    ) -> Result<(), String> {
        let mut watchers = self.watchers.lock().await;

        if watchers.contains_key(&session_id) {
            log::info!("[TeammateWatcher] Already watching: {}", session_id);
            return Ok(());
        }

        let session_file = find_session_jsonl(&session_id)?;
        log::info!(
            "[TeammateWatcher] Watching {} ({}) at: {}",
            agent_name, session_id, session_file.display()
        );

        // Read existing content and emit as initial load
        let initial_size = emit_existing_events(&app, &session_id, &session_file)?;

        // Track byte position
        {
            let mut positions = self.file_positions.lock().await;
            positions.insert(session_id.clone(), initial_size);
        }

        // Set up file watcher
        let session_id_clone = session_id.clone();
        let session_file_clone = session_file.clone();
        let positions = Arc::clone(&self.file_positions);

        let mut debouncer = new_debouncer(
            Duration::from_millis(200),
            None,
            move |result: DebounceEventResult| {
                match result {
                    Ok(events) => {
                        let file_changed = events.iter().any(|e| {
                            e.event.paths.iter().any(|p| {
                                p.file_name()
                                    .map(|f| f.to_string_lossy().contains(&session_id_clone))
                                    .unwrap_or(false)
                            })
                        });

                        if file_changed {
                            // Read new lines from last position
                            let pos = {
                                let positions = positions.blocking_lock();
                                *positions.get(&session_id_clone).unwrap_or(&0)
                            };

                            match read_new_lines(&session_file_clone, pos) {
                                Ok((new_events, new_pos)) => {
                                    // Emit each new event
                                    let event_name =
                                        format!("teammate-event:{}", session_id_clone);
                                    for event in &new_events {
                                        if let Err(e) = app.emit(&event_name, event) {
                                            log::error!(
                                                "[TeammateWatcher] Emit failed: {}",
                                                e
                                            );
                                        }
                                    }

                                    if !new_events.is_empty() {
                                        log::info!(
                                            "[TeammateWatcher] Emitted {} events for {}",
                                            new_events.len(),
                                            session_id_clone
                                        );
                                    }

                                    // Update position
                                    let mut positions = positions.blocking_lock();
                                    positions.insert(session_id_clone.clone(), new_pos);
                                }
                                Err(e) => {
                                    log::error!(
                                        "[TeammateWatcher] Read error: {}",
                                        e
                                    );
                                }
                            }
                        }
                    }
                    Err(errors) => {
                        for error in errors.iter() {
                            log::error!("[TeammateWatcher] Watch error: {}", error);
                        }
                    }
                }
            },
        )
        .map_err(|e| format!("Failed to create teammate watcher: {}", e))?;

        // Watch the directory containing the session file
        let watch_dir = session_file
            .parent()
            .ok_or("Cannot determine parent directory")?
            .to_path_buf();

        debouncer
            .watch(&watch_dir, RecursiveMode::NonRecursive)
            .map_err(|e| format!("Failed to watch directory: {}", e))?;

        watchers.insert(session_id.clone(), debouncer);
        log::info!("[TeammateWatcher] Started for: {}", session_id);
        Ok(())
    }

    pub async fn stop_watching(&self, session_id: &str) {
        let mut watchers = self.watchers.lock().await;
        let mut positions = self.file_positions.lock().await;

        if watchers.remove(session_id).is_some() {
            positions.remove(session_id);
            log::info!("[TeammateWatcher] Stopped for: {}", session_id);
        }
    }

    pub async fn stop_all(&self) {
        let mut watchers = self.watchers.lock().await;
        let mut positions = self.file_positions.lock().await;
        let count = watchers.len();
        watchers.clear();
        positions.clear();
        log::info!("[TeammateWatcher] Stopped all {} watchers", count);
    }
}

/// Find a session JSONL file by session ID across all project directories
fn find_session_jsonl(session_id: &str) -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Failed to get home directory")?;
    let projects_dir = home.join(".claude").join("projects");

    if !projects_dir.exists() {
        return Err("No .claude/projects directory found".to_string());
    }

    for entry in fs::read_dir(&projects_dir)
        .map_err(|e| format!("Failed to read projects dir: {}", e))?
    {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();

        if path.is_dir() {
            let session_file = path.join(format!("{}.jsonl", session_id));
            if session_file.exists() {
                return Ok(session_file);
            }
        }
    }

    Err(format!(
        "Session {} not found in any project directory",
        session_id
    ))
}

/// Read existing content, emit events, return file size
fn emit_existing_events(
    app: &AppHandle,
    session_id: &str,
    path: &PathBuf,
) -> Result<u64, String> {
    let file = fs::File::open(path)
        .map_err(|e| format!("Failed to open session file: {}", e))?;

    let metadata = file.metadata()
        .map_err(|e| format!("Failed to read file metadata: {}", e))?;

    let reader = BufReader::new(&file);
    let event_name = format!("teammate-event:{}", session_id);
    let mut count = 0;

    for line in reader.lines() {
        let line = line.map_err(|e| format!("Failed to read line: {}", e))?;
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        if let Ok(event) = serde_json::from_str::<serde_json::Value>(trimmed) {
            if let Err(e) = app.emit(&event_name, &event) {
                log::error!("[TeammateWatcher] Initial emit failed: {}", e);
            }
            count += 1;
        }
    }

    log::info!(
        "[TeammateWatcher] Emitted {} initial events for {}",
        count, session_id
    );

    Ok(metadata.len())
}

/// Read new lines from a file starting at a byte offset
fn read_new_lines(
    path: &PathBuf,
    from_pos: u64,
) -> Result<(Vec<serde_json::Value>, u64), String> {
    let mut file = fs::File::open(path)
        .map_err(|e| format!("Failed to open file: {}", e))?;

    let metadata = file.metadata()
        .map_err(|e| format!("Failed to read metadata: {}", e))?;

    let current_size = metadata.len();
    if current_size <= from_pos {
        return Ok((Vec::new(), from_pos));
    }

    file.seek(SeekFrom::Start(from_pos))
        .map_err(|e| format!("Failed to seek: {}", e))?;

    let reader = BufReader::new(&file);
    let mut events = Vec::new();

    for line in reader.lines() {
        let line = line.map_err(|e| format!("Failed to read line: {}", e))?;
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        if let Ok(event) = serde_json::from_str::<serde_json::Value>(trimmed) {
            events.push(event);
        }
    }

    Ok((events, current_size))
}

// --- Tauri Commands ---

#[tauri::command]
pub async fn start_teammate_watcher(
    app: AppHandle,
    watcher: tauri::State<'_, TeammateSessionWatcher>,
    session_id: String,
    agent_name: String,
) -> Result<(), String> {
    watcher.start_watching(app, session_id, agent_name).await
}

#[tauri::command]
pub async fn stop_teammate_watcher(
    watcher: tauri::State<'_, TeammateSessionWatcher>,
    session_id: String,
) -> Result<(), String> {
    watcher.stop_watching(&session_id).await;
    Ok(())
}

#[tauri::command]
pub fn read_teammate_session(
    session_id: String,
) -> Result<Vec<serde_json::Value>, String> {
    let path = find_session_jsonl(&session_id)?;

    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read session file: {}", e))?;

    let events: Vec<serde_json::Value> = content
        .lines()
        .filter(|l| !l.trim().is_empty())
        .filter_map(|line| serde_json::from_str(line).ok())
        .collect();

    log::info!(
        "[TeammateWatcher] Read {} events for session {}",
        events.len(), session_id
    );

    Ok(events)
}
