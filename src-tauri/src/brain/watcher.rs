/**
 * Quack Brain - Obsidian Vault File Watcher
 *
 * Watches Obsidian vault for .md file changes and emits Tauri events
 * for bidirectional sync between Brain database and markdown files.
 */

use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode};
use notify_debouncer_full::{new_debouncer, DebounceEventResult, Debouncer, FileIdMap};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;

/// Event payload emitted when a markdown file changes
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrainFileEvent {
    pub path: String,
    pub event_type: String, // "created" | "modified" | "deleted"
}

/// Parsed markdown file content
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedMarkdown {
    pub id: Option<String>,
    pub name: String,
    pub entity_type: String,
    pub project_id: Option<String>,
    pub observations: Vec<String>,
    pub sync_hash: String,
    pub tags: Vec<String>,
}

/// Manager for the vault file watcher
pub struct VaultWatcherManager {
    watcher: Arc<Mutex<Option<Debouncer<RecommendedWatcher, FileIdMap>>>>,
    vault_path: Arc<Mutex<Option<String>>>,
}

impl VaultWatcherManager {
    pub fn new() -> Self {
        Self {
            watcher: Arc::new(Mutex::new(None)),
            vault_path: Arc::new(Mutex::new(None)),
        }
    }

    /// Start watching a vault directory
    pub async fn start(&self, app: AppHandle, vault_path: String) -> Result<(), String> {
        let mut watcher_guard = self.watcher.lock().await;

        // Check if already watching
        if watcher_guard.is_some() {
            log::warn!(
                "[VaultWatcher] Already watching a vault, stopping previous watcher"
            );
            *watcher_guard = None;
        }

        // Validate path exists
        let vault_path_buf = PathBuf::from(&vault_path);
        if !vault_path_buf.exists() {
            return Err(format!("Vault path does not exist: {}", vault_path));
        }

        log::info!(
            "[VaultWatcher] Starting watcher for vault: {} (debounce: 500ms)",
            vault_path
        );

        // Clone for the event handler
        let vault_path_clone = vault_path.clone();
        let app_clone = app.clone();

        // Create debounced watcher (500ms delay)
        let mut debouncer = new_debouncer(
            Duration::from_millis(500),
            None,
            move |result: DebounceEventResult| {
                match result {
                    Ok(events) => {
                        for event in events.iter() {
                            if let Err(e) = handle_vault_file_event(
                                &app_clone,
                                &vault_path_clone,
                                &event.event,
                            ) {
                                log::error!("[VaultWatcher] Event handler error: {}", e);
                            }
                        }
                    }
                    Err(errors) => {
                        for error in errors.iter() {
                            log::error!("[VaultWatcher] Watch error: {}", error);
                        }
                    }
                }
            },
        )
        .map_err(|e| format!("Failed to create debouncer: {}", e))?;

        // Start watching the directory recursively
        debouncer
            .watch(&vault_path_buf, RecursiveMode::Recursive)
            .map_err(|e| format!("Failed to watch directory: {}", e))?;

        // Store the watcher and path
        *watcher_guard = Some(debouncer);
        *self.vault_path.lock().await = Some(vault_path.clone());

        log::info!("[VaultWatcher] Watcher started for vault: {}", vault_path);
        Ok(())
    }

    /// Stop watching the vault
    pub async fn stop(&self) -> Result<(), String> {
        let mut watcher_guard = self.watcher.lock().await;
        let mut path_guard = self.vault_path.lock().await;

        if watcher_guard.is_some() {
            *watcher_guard = None;
            let path = path_guard.take();
            log::info!(
                "[VaultWatcher] Stopped watcher for vault: {}",
                path.unwrap_or_else(|| "unknown".to_string())
            );
            Ok(())
        } else {
            Err("No vault watcher is currently active".to_string())
        }
    }

    /// Check if vault is being watched
    pub async fn is_watching(&self) -> bool {
        self.watcher.lock().await.is_some()
    }

    /// Get the current vault path being watched
    pub async fn get_vault_path(&self) -> Option<String> {
        self.vault_path.lock().await.clone()
    }
}

impl Default for VaultWatcherManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Handle a file system event and emit brain events
fn handle_vault_file_event(
    app: &AppHandle,
    vault_path: &str,
    event: &Event,
) -> Result<(), String> {
    use notify::event::{CreateKind, ModifyKind, RemoveKind, RenameMode};

    let paths = &event.paths;
    if paths.is_empty() {
        return Ok(());
    }

    // Determine event type
    let event_type = match &event.kind {
        EventKind::Create(CreateKind::File) => "created",
        EventKind::Modify(ModifyKind::Data(_)) => "modified",
        EventKind::Modify(ModifyKind::Name(RenameMode::To)) => "created",
        EventKind::Modify(ModifyKind::Name(RenameMode::From)) => "deleted",
        EventKind::Remove(RemoveKind::File) => "deleted",
        _ => return Ok(()), // Ignore other events
    };

    // Process each path in the event
    for path in paths {
        // Only process .md files
        if !is_markdown_file(path) {
            continue;
        }

        // Skip if path doesn't exist (for delete events, we still want to process)
        if event_type != "deleted" && !path.exists() {
            continue;
        }

        // Check if file is in quack-brain subfolder or root based on config
        // For now, we accept any .md file in the vault
        if !is_in_vault(path, vault_path) {
            continue;
        }

        // Convert to string path
        let file_path = match path.to_str() {
            Some(p) => p.to_string(),
            None => continue,
        };

        // Emit the event
        let brain_event = BrainFileEvent {
            path: file_path.clone(),
            event_type: event_type.to_string(),
        };

        // Emit specific events based on type
        let event_name = match event_type {
            "created" => "brain:file-created",
            "modified" => "brain:file-changed",
            "deleted" => "brain:file-deleted",
            _ => continue,
        };

        if let Err(e) = app.emit(event_name, &brain_event) {
            log::error!("[VaultWatcher] Failed to emit event: {}", e);
        } else {
            log::debug!(
                "[VaultWatcher] Emitted {} event for: {}",
                event_type,
                file_path
            );
        }
    }

    Ok(())
}

/// Check if a path is a markdown file
fn is_markdown_file(path: &Path) -> bool {
    path.extension()
        .map(|ext| ext.to_string_lossy().to_lowercase() == "md")
        .unwrap_or(false)
}

/// Check if a path is within the vault directory
fn is_in_vault(path: &Path, vault_path: &str) -> bool {
    path.starts_with(vault_path)
}

// ==========================================
// Tauri Commands
// ==========================================

/// Start vault file watcher
#[tauri::command]
pub async fn brain_start_vault_watcher(
    app: AppHandle,
    state: tauri::State<'_, VaultWatcherManager>,
    vault_path: String,
) -> Result<(), String> {
    state.start(app, vault_path).await
}

/// Stop vault file watcher
#[tauri::command]
pub async fn brain_stop_vault_watcher(
    state: tauri::State<'_, VaultWatcherManager>,
) -> Result<(), String> {
    state.stop().await
}

/// Check if vault is being watched
#[tauri::command]
pub async fn brain_is_vault_watching(
    state: tauri::State<'_, VaultWatcherManager>,
) -> Result<bool, String> {
    Ok(state.is_watching().await)
}

/// Get current vault path
#[tauri::command]
pub async fn brain_get_vault_path(
    state: tauri::State<'_, VaultWatcherManager>,
) -> Result<Option<String>, String> {
    Ok(state.get_vault_path().await)
}

// ==========================================
// Markdown Parsing Commands
// ==========================================

use std::fs;

/// Parse a markdown file and extract entity data
#[tauri::command]
pub fn brain_parse_markdown_file(file_path: String) -> Result<ParsedMarkdown, String> {
    let content = fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    parse_markdown_content(&content, &file_path)
}

/// Parse markdown content and extract entity data
fn parse_markdown_content(content: &str, file_path: &str) -> Result<ParsedMarkdown, String> {
    let mut id: Option<String> = None;
    let mut entity_type = "fact".to_string();
    let mut project_id: Option<String> = None;
    let mut tags: Vec<String> = Vec::new();
    let mut observations: Vec<String> = Vec::new();
    let mut name = String::new();

    let lines: Vec<&str> = content.lines().collect();
    let mut in_frontmatter = false;
    let mut in_observations = false;
    let mut frontmatter_end = 0;

    // Parse YAML frontmatter
    for (i, line) in lines.iter().enumerate() {
        let trimmed = line.trim();

        if i == 0 && trimmed == "---" {
            in_frontmatter = true;
            continue;
        }

        if in_frontmatter {
            if trimmed == "---" {
                in_frontmatter = false;
                frontmatter_end = i;
                continue;
            }

            // Parse frontmatter fields
            if let Some((key, value)) = parse_yaml_line(trimmed) {
                match key.as_str() {
                    "id" => id = Some(value.trim_matches('"').to_string()),
                    "type" => entity_type = value.to_string(),
                    "project" => project_id = Some(value.trim_matches('"').to_string()),
                    "tags" => {
                        // Handle array format: [tag1, tag2] or inline
                        let tag_str = value.trim_matches(|c| c == '[' || c == ']');
                        for tag in tag_str.split(',') {
                            let t = tag.trim().trim_matches('"').trim_matches('\'');
                            if !t.is_empty() {
                                tags.push(t.to_string());
                            }
                        }
                    }
                    _ => {}
                }
            }
        }
    }

    // Parse body (after frontmatter)
    for line in lines.iter().skip(frontmatter_end + 1) {
        let trimmed = line.trim();

        // Extract title from # heading
        if trimmed.starts_with("# ") && name.is_empty() {
            name = trimmed[2..].trim().to_string();
            continue;
        }

        // Check for observations section
        if trimmed == "## Observations" {
            in_observations = true;
            continue;
        }

        // End observations on next heading
        if in_observations && trimmed.starts_with("## ") {
            in_observations = false;
            continue;
        }

        // Collect observations (lines starting with -)
        if in_observations && trimmed.starts_with("- ") {
            let obs = trimmed[2..].trim().to_string();
            if !obs.is_empty() {
                observations.push(obs);
            }
        }

        // Extract inline tags from body (e.g., #tag)
        for word in trimmed.split_whitespace() {
            if word.starts_with('#') && word.len() > 1 {
                let tag = word[1..].trim_matches(|c: char| !c.is_alphanumeric() && c != '_' && c != '-');
                if !tag.is_empty() && !tags.contains(&tag.to_string()) {
                    tags.push(tag.to_string());
                }
            }
        }
    }

    // If no name found, use filename
    if name.is_empty() {
        name = PathBuf::from(file_path)
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| "Untitled".to_string());
    }

    // Calculate content hash for sync detection
    let sync_hash = calculate_md5(content);

    Ok(ParsedMarkdown {
        id,
        name,
        entity_type,
        project_id,
        observations,
        sync_hash,
        tags,
    })
}

/// Parse a YAML line into key-value pair
fn parse_yaml_line(line: &str) -> Option<(String, String)> {
    let parts: Vec<&str> = line.splitn(2, ':').collect();
    if parts.len() == 2 {
        let key = parts[0].trim().to_string();
        let value = parts[1].trim().to_string();
        Some((key, value))
    } else {
        None
    }
}

/// Calculate MD5 hash of content
fn calculate_md5(content: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let mut hasher = DefaultHasher::new();
    content.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

/// Import a markdown file into Brain database
#[tauri::command]
pub fn brain_import_markdown_file(file_path: String) -> Result<super::types::BrainEntity, String> {
    use super::db::get_connection;
    use super::types::{BrainEntity, BrainObservation};
    use rusqlite::params;
    use std::time::{SystemTime, UNIX_EPOCH};
    use uuid::Uuid;

    // Parse the markdown file
    let parsed = brain_parse_markdown_file(file_path.clone())?;

    let conn = get_connection()?;
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;

    // Check if entity already exists by ID
    let existing_id: Option<String> = if let Some(ref id) = parsed.id {
        conn.query_row(
            "SELECT id FROM entities WHERE id = ?1",
            [id],
            |row| row.get(0),
        )
        .ok()
    } else {
        None
    };

    // Check if ID was present in the parsed file (before we move it)
    let had_id = parsed.id.is_some();

    let entity_id = if let Some(ref id) = existing_id {
        // Update existing entity
        conn.execute(
            "UPDATE entities SET name = ?1, entity_type = ?2, project_id = ?3, updated_at = ?4, md_file_path = ?5 WHERE id = ?6",
            params![
                parsed.name,
                parsed.entity_type,
                parsed.project_id,
                timestamp,
                file_path,
                id
            ],
        )
        .map_err(|e| format!("Failed to update entity: {}", e))?;

        // Delete existing observations and re-add
        conn.execute("DELETE FROM observations WHERE entity_id = ?1", [id])
            .map_err(|e| format!("Failed to delete observations: {}", e))?;

        id.clone()
    } else {
        // Create new entity
        let new_id = parsed.id.unwrap_or_else(|| Uuid::new_v4().to_string());

        conn.execute(
            "INSERT INTO entities (id, name, entity_type, created_at, updated_at, project_id, md_file_path)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                new_id,
                parsed.name,
                parsed.entity_type,
                timestamp,
                timestamp,
                parsed.project_id,
                file_path
            ],
        )
        .map_err(|e| format!("Failed to create entity: {}", e))?;

        // Write ID back to file if it was generated
        if !had_id {
            if let Err(e) = update_frontmatter_id(&file_path, &new_id) {
                log::warn!("[VaultWatcher] Failed to write ID to file: {}", e);
            }
        }

        new_id
    };

    // Add observations
    let mut observations = Vec::new();
    for content in parsed.observations {
        let obs_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO observations (id, entity_id, content, created_at)
             VALUES (?1, ?2, ?3, ?4)",
            params![obs_id, entity_id, content, timestamp],
        )
        .map_err(|e| format!("Failed to add observation: {}", e))?;

        observations.push(BrainObservation {
            id: obs_id,
            content,
            created_at: timestamp,
        });
    }

    // Get created_at from DB for existing entities
    let (created_at, updated_at): (i64, i64) = conn
        .query_row(
            "SELECT created_at, updated_at FROM entities WHERE id = ?1",
            [&entity_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| format!("Failed to get entity timestamps: {}", e))?;

    Ok(BrainEntity {
        id: entity_id,
        name: parsed.name,
        entity_type: parsed.entity_type,
        observations,
        project_id: parsed.project_id,
        created_at,
        updated_at,
        md_file_path: Some(file_path),
        source_file: None,
        date: None,
        daily_link: None,
        author: None,
        status: Some("active".to_string()),
        confidence: Some("high".to_string()),
        aliases: None,
    })
}

/// Update frontmatter with entity ID
fn update_frontmatter_id(file_path: &str, entity_id: &str) -> Result<(), String> {
    let content = fs::read_to_string(file_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    let lines: Vec<&str> = content.lines().collect();
    let mut new_lines: Vec<String> = Vec::new();
    let mut in_frontmatter = false;
    let mut id_added = false;

    for (i, line) in lines.iter().enumerate() {
        let trimmed = line.trim();

        if i == 0 && trimmed == "---" {
            in_frontmatter = true;
            new_lines.push(line.to_string());
            continue;
        }

        if in_frontmatter && trimmed == "---" {
            // Add ID before closing frontmatter if not added
            if !id_added {
                new_lines.push(format!("id: \"{}\"", entity_id));
            }
            in_frontmatter = false;
            new_lines.push(line.to_string());
            continue;
        }

        if in_frontmatter && trimmed.starts_with("id:") {
            // Replace existing ID
            new_lines.push(format!("id: \"{}\"", entity_id));
            id_added = true;
            continue;
        }

        new_lines.push(line.to_string());
    }

    // If no frontmatter, add one
    if new_lines.is_empty() || !new_lines[0].trim().starts_with("---") {
        let mut with_frontmatter = vec![
            "---".to_string(),
            format!("id: \"{}\"", entity_id),
            "type: fact".to_string(),
            "---".to_string(),
            "".to_string(),
        ];
        with_frontmatter.extend(new_lines);
        new_lines = with_frontmatter;
    }

    fs::write(file_path, new_lines.join("\n"))
        .map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(())
}

/// Scan a vault directory and return all markdown files
#[tauri::command]
pub fn brain_scan_vault(vault_path: String) -> Result<Vec<String>, String> {
    use walkdir::WalkDir;

    let mut files = Vec::new();

    for entry in WalkDir::new(&vault_path)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if is_markdown_file(path) {
            if let Some(path_str) = path.to_str() {
                files.push(path_str.to_string());
            }
        }
    }

    Ok(files)
}

/// Bulk import all markdown files from a vault
#[tauri::command]
pub fn brain_import_vault(vault_path: String) -> Result<super::commands::ImportResult, String> {
    use super::commands::ImportResult;

    let mut result = ImportResult {
        imported_entities: 0,
        imported_relations: 0,
        skipped: 0,
        errors: Vec::new(),
    };

    let files = brain_scan_vault(vault_path)?;

    for file_path in files {
        match brain_import_markdown_file(file_path.clone()) {
            Ok(_) => result.imported_entities += 1,
            Err(e) => {
                result.errors.push(format!("{}: {}", file_path, e));
                result.skipped += 1;
            }
        }
    }

    Ok(result)
}
