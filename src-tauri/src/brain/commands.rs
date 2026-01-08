use regex::Regex;
use rusqlite::params;
use serde::Serialize;
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

use super::db::get_connection;
use super::types::*;

/// Get current Unix timestamp in seconds
fn now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64
}

/// Check if auto-sync to vault is enabled
fn should_auto_sync_to_vault() -> bool {
    let conn = match get_connection() {
        Ok(c) => c,
        Err(e) => {
            log::warn!("[AutoSync] Failed to get DB connection: {}", e);
            return false;
        }
    };

    // Check both sync_enabled AND auto_sync_to_vault
    let sync_enabled: bool = conn
        .query_row(
            "SELECT value FROM brain_settings WHERE key = 'sync_enabled'",
            [],
            |row| row.get::<_, String>(0),
        )
        .map(|v| v == "true")
        .unwrap_or(false);

    log::info!("[AutoSync] sync_enabled = {}", sync_enabled);

    if !sync_enabled {
        log::info!("[AutoSync] Sync is disabled, skipping auto-sync");
        return false;
    }

    let auto_sync: bool = conn
        .query_row(
            "SELECT value FROM brain_settings WHERE key = 'auto_sync_to_vault'",
            [],
            |row| row.get::<_, String>(0),
        )
        .map(|v| v == "true")
        .unwrap_or(false);

    log::info!("[AutoSync] auto_sync_to_vault = {}", auto_sync);

    let vault_path: String = conn
        .query_row(
            "SELECT value FROM brain_settings WHERE key = 'vault_path'",
            [],
            |row| row.get(0),
        )
        .unwrap_or_default();

    log::info!("[AutoSync] vault_path = '{}'", vault_path);

    let result = auto_sync && !vault_path.is_empty();
    log::info!("[AutoSync] Final decision: should_auto_sync = {}", result);

    result
}

/// Initialize the database (called on app startup)
#[tauri::command]
pub fn brain_init() -> Result<String, String> {
    super::db::init_database()?;
    Ok("Database initialized successfully".to_string())
}

/// Create a new entity with observations
#[tauri::command]
pub fn brain_create_entity(input: CreateEntityInput) -> Result<BrainEntity, String> {
    let conn = get_connection()?;
    let entity_id = Uuid::new_v4().to_string();
    let timestamp = now();

    // Insert entity
    conn.execute(
        "INSERT INTO entities (id, name, entity_type, created_at, updated_at, project_id, md_file_path)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            &entity_id,
            &input.name,
            &input.entity_type,
            timestamp,
            timestamp,
            &input.project_id,
            None::<String>,
        ],
    )
    .map_err(|e| format!("Failed to insert entity: {}", e))?;

    // Insert observations
    let mut observations = Vec::new();
    for content in input.observations {
        let obs_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO observations (id, entity_id, content, created_at)
             VALUES (?1, ?2, ?3, ?4)",
            params![&obs_id, &entity_id, &content, timestamp],
        )
        .map_err(|e| format!("Failed to insert observation: {}", e))?;

        observations.push(BrainObservation {
            id: obs_id,
            content,
            created_at: timestamp,
        });
    }

    let entity = BrainEntity {
        id: entity_id.clone(),
        name: input.name,
        entity_type: input.entity_type,
        observations,
        project_id: input.project_id,
        created_at: timestamp,
        updated_at: timestamp,
        md_file_path: None,
        source_file: None,
        date: None,
        daily_link: None,
        author: None,
        status: Some("active".to_string()),
        confidence: Some("high".to_string()),
        aliases: None,
    };

    // Auto-sync to vault if enabled
    log::info!("[AutoSync] Checking if auto-sync should run after entity creation...");
    if should_auto_sync_to_vault() {
        log::info!("[AutoSync] Auto-sync enabled, syncing entity '{}' to vault", entity.name);
        if let Err(e) = brain_sync_entity_to_md(entity.id.clone()) {
            log::warn!("[AutoSync] Auto-sync to vault failed for new entity: {}", e);
        } else {
            log::info!("[AutoSync] Successfully synced entity '{}' to vault", entity.name);
        }
    } else {
        log::info!("[AutoSync] Auto-sync not enabled, skipping");
    }

    Ok(entity)
}

/// Update an entity's metadata
#[tauri::command]
pub fn brain_update_entity(id: String, updates: UpdateEntityInput) -> Result<BrainEntity, String> {
    let conn = get_connection()?;
    let timestamp = now();

    // Build dynamic SQL update
    let mut set_clauses = vec!["updated_at = ?1".to_string()];
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(timestamp)];

    if let Some(name) = &updates.name {
        set_clauses.push(format!("name = ?{}", params.len() + 1));
        params.push(Box::new(name.clone()));
    }

    if let Some(entity_type) = &updates.entity_type {
        set_clauses.push(format!("entity_type = ?{}", params.len() + 1));
        params.push(Box::new(entity_type.clone()));
    }

    params.push(Box::new(id.clone()));

    let sql = format!(
        "UPDATE entities SET {} WHERE id = ?{}",
        set_clauses.join(", "),
        params.len()
    );

    conn.execute(&sql, rusqlite::params_from_iter(params.iter().map(|p| p.as_ref())))
        .map_err(|e| format!("Failed to update entity: {}", e))?;

    // Fetch and return updated entity
    brain_get_entity(id)
}

/// Delete an entity and all its observations
#[tauri::command]
pub fn brain_delete_entity(id: String) -> Result<(), String> {
    let conn = get_connection()?;

    conn.execute("DELETE FROM entities WHERE id = ?1", params![&id])
        .map_err(|e| format!("Failed to delete entity: {}", e))?;

    Ok(())
}

/// Get a single entity by ID with all its observations
#[tauri::command]
pub fn brain_get_entity(id: String) -> Result<BrainEntity, String> {
    let conn = get_connection()?;

    // Fetch entity
    let mut stmt = conn
        .prepare(
            "SELECT id, name, entity_type, created_at, updated_at, project_id, md_file_path,
                    source_file, date, daily_link, author, status, confidence, aliases
             FROM entities WHERE id = ?1",
        )
        .map_err(|e| format!("Failed to prepare entity query: {}", e))?;

    let entity = stmt
        .query_row(params![&id], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, i64>(3)?,
                row.get::<_, i64>(4)?,
                row.get::<_, Option<String>>(5)?,
                row.get::<_, Option<String>>(6)?,
                row.get::<_, Option<String>>(7)?,
                row.get::<_, Option<String>>(8)?,
                row.get::<_, Option<String>>(9)?,
                row.get::<_, Option<String>>(10)?,
                row.get::<_, Option<String>>(11)?,
                row.get::<_, Option<String>>(12)?,
                row.get::<_, Option<String>>(13)?,
            ))
        })
        .map_err(|e| format!("Entity not found: {}", e))?;

    // Fetch observations
    let mut stmt = conn
        .prepare("SELECT id, content, created_at FROM observations WHERE entity_id = ?1 ORDER BY created_at ASC")
        .map_err(|e| format!("Failed to prepare observations query: {}", e))?;

    let observations = stmt
        .query_map(params![&id], |row| {
            Ok(BrainObservation {
                id: row.get(0)?,
                content: row.get(1)?,
                created_at: row.get(2)?,
            })
        })
        .map_err(|e| format!("Failed to query observations: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect observations: {}", e))?;

    // Parse aliases JSON if present
    let aliases: Option<Vec<String>> = entity.13.as_ref().and_then(|json| {
        serde_json::from_str(json).ok()
    });

    Ok(BrainEntity {
        id: entity.0,
        name: entity.1,
        entity_type: entity.2,
        created_at: entity.3,
        updated_at: entity.4,
        project_id: entity.5,
        md_file_path: entity.6,
        source_file: entity.7,
        date: entity.8,
        daily_link: entity.9,
        author: entity.10,
        status: entity.11,
        confidence: entity.12,
        aliases,
        observations,
    })
}

/// List entities with optional filters
#[tauri::command]
pub fn brain_list_entities(filters: EntityFilters) -> Result<Vec<BrainEntity>, String> {
    let conn = get_connection()?;

    // Build WHERE clause
    let mut where_clauses = Vec::new();
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(project_id) = &filters.project_id {
        where_clauses.push(format!("project_id = ?{}", params.len() + 1));
        params.push(Box::new(project_id.clone()));
    }

    if let Some(entity_type) = &filters.entity_type {
        where_clauses.push(format!("entity_type = ?{}", params.len() + 1));
        params.push(Box::new(entity_type.clone()));
    }

    let where_sql = if where_clauses.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", where_clauses.join(" AND "))
    };

    let sql = format!(
        "SELECT id FROM entities {} ORDER BY updated_at DESC",
        where_sql
    );

    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| format!("Failed to prepare list query: {}", e))?;

    let entity_ids: Vec<String> = stmt
        .query_map(rusqlite::params_from_iter(params.iter().map(|p| p.as_ref())), |row| {
            row.get(0)
        })
        .map_err(|e| format!("Failed to query entities: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect entity IDs: {}", e))?;

    // Fetch full entities
    let mut entities = Vec::new();
    for id in entity_ids {
        entities.push(brain_get_entity(id)?);
    }

    Ok(entities)
}

/// Full-text search across entities
#[tauri::command]
pub fn brain_search(query: String) -> Result<Vec<SearchResult>, String> {
    let conn = get_connection()?;

    let mut stmt = conn
        .prepare(
            "SELECT e.id, rank
             FROM entities e
             JOIN entities_fts fts ON e.rowid = fts.rowid
             WHERE entities_fts MATCH ?1
             ORDER BY rank",
        )
        .map_err(|e| format!("Failed to prepare search query: {}", e))?;

    let results: Vec<(String, f64)> = stmt
        .query_map(params![&query], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| format!("Failed to execute search: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect search results: {}", e))?;

    let mut search_results = Vec::new();
    for (id, rank) in results {
        let entity = brain_get_entity(id)?;
        search_results.push(SearchResult {
            entity,
            score: rank,
        });
    }

    Ok(search_results)
}

/// Add an observation to an entity
#[tauri::command]
pub fn brain_add_observation(entity_id: String, content: String) -> Result<BrainObservation, String> {
    let conn = get_connection()?;
    let obs_id = Uuid::new_v4().to_string();
    let timestamp = now();

    // Insert observation
    conn.execute(
        "INSERT INTO observations (id, entity_id, content, created_at)
         VALUES (?1, ?2, ?3, ?4)",
        params![&obs_id, &entity_id, &content, timestamp],
    )
    .map_err(|e| format!("Failed to insert observation: {}", e))?;

    // Update entity's updated_at timestamp
    conn.execute(
        "UPDATE entities SET updated_at = ?1 WHERE id = ?2",
        params![timestamp, &entity_id],
    )
    .map_err(|e| format!("Failed to update entity timestamp: {}", e))?;

    // Auto-sync entity to vault if enabled
    if should_auto_sync_to_vault() {
        if let Err(e) = brain_sync_entity_to_md(entity_id) {
            log::warn!("Auto-sync to vault failed after adding observation: {}", e);
        }
    }

    Ok(BrainObservation {
        id: obs_id,
        content,
        created_at: timestamp,
    })
}

/// Delete an observation
#[tauri::command]
pub fn brain_delete_observation(id: String) -> Result<(), String> {
    let conn = get_connection()?;

    conn.execute("DELETE FROM observations WHERE id = ?1", params![&id])
        .map_err(|e| format!("Failed to delete observation: {}", e))?;

    Ok(())
}

/// Create a relation between two entities
#[tauri::command]
pub fn brain_create_relation(
    from_entity_id: String,
    to_entity_id: String,
    relation_type: String,
) -> Result<BrainRelation, String> {
    let conn = get_connection()?;
    let relation_id = Uuid::new_v4().to_string();
    let timestamp = now();

    conn.execute(
        "INSERT INTO relations (id, from_entity_id, to_entity_id, relation_type, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            &relation_id,
            &from_entity_id,
            &to_entity_id,
            &relation_type,
            timestamp
        ],
    )
    .map_err(|e| format!("Failed to insert relation: {}", e))?;

    Ok(BrainRelation {
        id: relation_id,
        from_entity_id,
        to_entity_id,
        relation_type,
        created_at: timestamp,
    })
}

/// Delete a relation
#[tauri::command]
pub fn brain_delete_relation(id: String) -> Result<(), String> {
    let conn = get_connection()?;

    conn.execute("DELETE FROM relations WHERE id = ?1", params![&id])
        .map_err(|e| format!("Failed to delete relation: {}", e))?;

    Ok(())
}

/// Get the complete knowledge graph
#[tauri::command]
pub fn brain_get_graph() -> Result<BrainGraph, String> {
    let conn = get_connection()?;

    // Fetch all entities
    let entities = brain_list_entities(EntityFilters {
        project_id: None,
        entity_type: None,
        search_query: None,
    })?;

    // Fetch all relations
    let mut stmt = conn
        .prepare("SELECT id, from_entity_id, to_entity_id, relation_type, created_at FROM relations")
        .map_err(|e| format!("Failed to prepare relations query: {}", e))?;

    let relations = stmt
        .query_map([], |row| {
            Ok(BrainRelation {
                id: row.get(0)?,
                from_entity_id: row.get(1)?,
                to_entity_id: row.get(2)?,
                relation_type: row.get(3)?,
                created_at: row.get(4)?,
            })
        })
        .map_err(|e| format!("Failed to query relations: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect relations: {}", e))?;

    Ok(BrainGraph {
        entities,
        relations,
    })
}

/// List all registered projects
#[tauri::command]
pub fn brain_list_projects() -> Result<Vec<BrainProject>, String> {
    let conn = get_connection()?;

    let mut stmt = conn
        .prepare("SELECT id, name, path, created_at, last_accessed_at FROM projects ORDER BY last_accessed_at DESC")
        .map_err(|e| format!("Failed to prepare projects query: {}", e))?;

    let projects = stmt
        .query_map([], |row| {
            Ok(BrainProject {
                id: row.get(0)?,
                name: row.get(1)?,
                path: row.get(2)?,
                created_at: row.get(3)?,
                last_accessed_at: row.get(4)?,
            })
        })
        .map_err(|e| format!("Failed to query projects: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect projects: {}", e))?;

    Ok(projects)
}

/// Register or update a project
#[tauri::command]
pub fn brain_register_project(name: String, path: String) -> Result<BrainProject, String> {
    let conn = get_connection()?;
    let timestamp = now();

    // Check if project exists
    let existing: Option<String> = conn
        .query_row(
            "SELECT id FROM projects WHERE path = ?1",
            params![&path],
            |row| row.get(0),
        )
        .ok();

    if let Some(project_id) = existing {
        // Update last_accessed_at
        conn.execute(
            "UPDATE projects SET name = ?1, last_accessed_at = ?2 WHERE id = ?3",
            params![&name, timestamp, &project_id],
        )
        .map_err(|e| format!("Failed to update project: {}", e))?;

        Ok(BrainProject {
            id: project_id,
            name,
            path,
            created_at: 0, // Will be fetched properly
            last_accessed_at: timestamp,
        })
    } else {
        // Create new project
        let project_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO projects (id, name, path, created_at, last_accessed_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![&project_id, &name, &path, timestamp, timestamp],
        )
        .map_err(|e| format!("Failed to insert project: {}", e))?;

        Ok(BrainProject {
            id: project_id,
            name,
            path,
            created_at: timestamp,
            last_accessed_at: timestamp,
        })
    }
}

// ============================================
// Migration Commands
// ============================================

/// Import result with detailed statistics
#[derive(Debug, Clone, Serialize)]
pub struct ImportResult {
    pub imported_entities: usize,
    pub imported_relations: usize,
    pub skipped: usize,
    pub errors: Vec<String>,
}

/// Migration status showing available data sources
#[derive(Debug, Clone, Serialize)]
pub struct MigrationStatus {
    pub mcp_memory_available: bool,
    pub mcp_memory_count: usize,
    pub quack_memory_count: usize,
    pub brain_entity_count: usize,
}

/// Import from MCP Memory (memory.jsonl)
///
/// Searches for MCP Memory installation in NPX cache and imports all entities/relations.
/// Skips duplicates based on entity name. Idempotent operation.
#[tauri::command]
pub fn brain_import_mcp_memory() -> Result<ImportResult, String> {
    use std::io::{BufRead, BufReader};

    let mut result = ImportResult {
        imported_entities: 0,
        imported_relations: 0,
        skipped: 0,
        errors: Vec::new(),
    };

    // Find MCP memory file
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    let npx_cache = home.join(".npm").join("_npx");

    if !npx_cache.exists() {
        return Err("NPX cache not found - MCP Memory may not be installed".to_string());
    }

    // Search for memory.jsonl in NPX cache
    let mut memory_path: Option<std::path::PathBuf> = None;

    if let Ok(entries) = std::fs::read_dir(&npx_cache) {
        for entry in entries.flatten() {
            let candidate = entry.path()
                .join("node_modules")
                .join("@modelcontextprotocol")
                .join("server-memory")
                .join("dist")
                .join("memory.jsonl");

            if candidate.exists() {
                memory_path = Some(candidate);
                break;
            }
        }
    }

    let memory_file = memory_path.ok_or("MCP Memory file not found - run 'npx @modelcontextprotocol/server-memory' first")?;

    // Read and parse memory.jsonl
    let file = std::fs::File::open(&memory_file)
        .map_err(|e| format!("Failed to open memory file: {}", e))?;
    let reader = BufReader::new(file);

    let conn = get_connection()?;
    let timestamp = now();

    for line in reader.lines() {
        let line = match line {
            Ok(l) => l,
            Err(e) => {
                result.errors.push(format!("Read error: {}", e));
                continue;
            }
        };

        if line.trim().is_empty() {
            continue;
        }

        let json: serde_json::Value = match serde_json::from_str(&line) {
            Ok(v) => v,
            Err(e) => {
                result.errors.push(format!("Parse error: {}", e));
                continue;
            }
        };

        let record_type = json.get("type").and_then(|v| v.as_str()).unwrap_or("");

        match record_type {
            "entity" => {
                let name = json.get("name").and_then(|v| v.as_str()).unwrap_or("");
                let entity_type = json.get("entityType").and_then(|v| v.as_str()).unwrap_or("fact");
                let observations: Vec<String> = json.get("observations")
                    .and_then(|v| v.as_array())
                    .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                    .unwrap_or_default();

                if name.is_empty() {
                    result.skipped += 1;
                    continue;
                }

                // Check if entity already exists (idempotent)
                let existing: Result<String, _> = conn.query_row(
                    "SELECT id FROM entities WHERE name = ?1",
                    [name],
                    |row| row.get(0),
                );

                if existing.is_ok() {
                    result.skipped += 1;
                    continue;
                }

                // Create entity
                let entity_id = Uuid::new_v4().to_string();

                conn.execute(
                    "INSERT INTO entities (id, name, entity_type, created_at, updated_at, project_id, md_file_path)
                     VALUES (?1, ?2, ?3, ?4, ?5, NULL, NULL)",
                    params![&entity_id, name, entity_type, timestamp, timestamp],
                ).map_err(|e| format!("Insert entity error: {}", e))?;

                // Add observations
                for obs_content in observations {
                    let obs_id = Uuid::new_v4().to_string();
                    conn.execute(
                        "INSERT INTO observations (id, entity_id, content, created_at) VALUES (?1, ?2, ?3, ?4)",
                        params![&obs_id, &entity_id, obs_content, timestamp],
                    ).map_err(|e| format!("Insert observation error: {}", e))?;
                }

                result.imported_entities += 1;
            }
            "relation" => {
                let from = json.get("from").and_then(|v| v.as_str()).unwrap_or("");
                let to = json.get("to").and_then(|v| v.as_str()).unwrap_or("");
                let rel_type = json.get("relationType").and_then(|v| v.as_str()).unwrap_or("relates_to");

                if from.is_empty() || to.is_empty() {
                    result.skipped += 1;
                    continue;
                }

                // Get entity IDs by name
                let from_id: Result<String, _> = conn.query_row(
                    "SELECT id FROM entities WHERE name = ?1",
                    [from],
                    |row| row.get(0),
                );

                let to_id: Result<String, _> = conn.query_row(
                    "SELECT id FROM entities WHERE name = ?1",
                    [to],
                    |row| row.get(0),
                );

                if let (Ok(from_entity_id), Ok(to_entity_id)) = (from_id, to_id) {
                    let rel_id = Uuid::new_v4().to_string();

                    // Use INSERT OR IGNORE for idempotency
                    conn.execute(
                        "INSERT OR IGNORE INTO relations (id, from_entity_id, to_entity_id, relation_type, created_at)
                         VALUES (?1, ?2, ?3, ?4, ?5)",
                        params![&rel_id, from_entity_id, to_entity_id, rel_type, timestamp],
                    ).ok();

                    result.imported_relations += 1;
                } else {
                    result.skipped += 1;
                }
            }
            _ => {
                result.skipped += 1;
            }
        }
    }

    Ok(result)
}

/// Import from Quack Memory (quack-memories.json via Tauri Store)
///
/// Imports legacy Quack memories into Brain. Generates entity names from content.
/// Skips duplicates. Idempotent operation.
#[tauri::command]
pub fn brain_import_quack_memory(app: tauri::AppHandle) -> Result<ImportResult, String> {
    use tauri_plugin_store::StoreExt;

    let mut result = ImportResult {
        imported_entities: 0,
        imported_relations: 0,
        skipped: 0,
        errors: Vec::new(),
    };

    // Load from Tauri Store
    let store = app.store("quack-memories.json")
        .map_err(|e| format!("Failed to open store: {}", e))?;

    let memories: Vec<serde_json::Value> = store.get("memories")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();

    if memories.is_empty() {
        return Ok(result);
    }

    let conn = get_connection()?;
    let timestamp = now();

    for memory in memories {
        let id = memory.get("id").and_then(|v| v.as_str()).unwrap_or("");
        let content = memory.get("content").and_then(|v| v.as_str()).unwrap_or("");
        let category = memory.get("category").and_then(|v| v.as_str()).unwrap_or("fact");
        let created_at = memory.get("createdAt").and_then(|v| v.as_i64()).unwrap_or(timestamp);

        if id.is_empty() || content.is_empty() {
            result.skipped += 1;
            continue;
        }

        // Generate a name from content (first 50 chars, slugified)
        let name = content.chars()
            .take(50)
            .collect::<String>()
            .to_lowercase()
            .chars()
            .map(|c| if c.is_alphanumeric() { c } else { '_' })
            .collect::<String>();
        let name = format!("{}_{}", name.trim_matches('_'), &id[..8.min(id.len())]);

        // Check if already exists (idempotent)
        let existing: Result<String, _> = conn.query_row(
            "SELECT id FROM entities WHERE name = ?1",
            [&name],
            |row| row.get(0),
        );

        if existing.is_ok() {
            result.skipped += 1;
            continue;
        }

        // Create entity
        let entity_id = Uuid::new_v4().to_string();

        conn.execute(
            "INSERT INTO entities (id, name, entity_type, created_at, updated_at, project_id, md_file_path)
             VALUES (?1, ?2, ?3, ?4, ?5, NULL, NULL)",
            params![&entity_id, name, category, created_at, timestamp],
        ).map_err(|e| format!("Insert error: {}", e))?;

        // Add content as observation
        let obs_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO observations (id, entity_id, content, created_at) VALUES (?1, ?2, ?3, ?4)",
            params![&obs_id, &entity_id, content, created_at],
        ).map_err(|e| format!("Observation error: {}", e))?;

        result.imported_entities += 1;
    }

    Ok(result)
}

/// Get migration status (what can be imported)
///
/// Returns counts of available entities in each data source and current Brain state.
#[tauri::command]
pub fn brain_get_migration_status(app: tauri::AppHandle) -> Result<MigrationStatus, String> {
    use tauri_plugin_store::StoreExt;

    // Check MCP Memory
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    let npx_cache = home.join(".npm").join("_npx");

    let mut mcp_available = false;
    let mut mcp_entity_count = 0;

    if npx_cache.exists() {
        if let Ok(entries) = std::fs::read_dir(&npx_cache) {
            for entry in entries.flatten() {
                let candidate = entry.path()
                    .join("node_modules")
                    .join("@modelcontextprotocol")
                    .join("server-memory")
                    .join("dist")
                    .join("memory.jsonl");

                if candidate.exists() {
                    mcp_available = true;
                    // Count entities
                    if let Ok(content) = std::fs::read_to_string(&candidate) {
                        mcp_entity_count = content.lines()
                            .filter(|l| l.contains("\"type\":\"entity\""))
                            .count();
                    }
                    break;
                }
            }
        }
    }

    // Check Quack Memory
    let store = app.store("quack-memories.json")
        .map_err(|e| format!("Failed to open store: {}", e))?;

    let quack_memories: Vec<serde_json::Value> = store.get("memories")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();

    // Get current Brain count
    let conn = get_connection()?;
    let brain_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM entities",
        [],
        |row| row.get(0),
    ).unwrap_or(0);

    Ok(MigrationStatus {
        mcp_memory_available: mcp_available,
        mcp_memory_count: mcp_entity_count,
        quack_memory_count: quack_memories.len(),
        brain_entity_count: brain_count as usize,
    })
}

// ============================================
// Markdown Sync Commands
// ============================================

use std::io::Write;

/// Sync result
#[derive(Debug, Clone, Serialize)]
pub struct SyncResult {
    pub files_created: usize,
    pub files_updated: usize,
    pub errors: Vec<String>,
}

/// Get markdown directory path from settings
fn get_markdown_dir() -> Result<std::path::PathBuf, String> {
    // Read vault_path from settings
    let conn = get_connection()?;
    let vault_path: String = conn
        .query_row(
            "SELECT value FROM brain_settings WHERE key = 'vault_path'",
            [],
            |row| row.get(0),
        )
        .unwrap_or_default();

    // If vault_path is configured, use it
    if !vault_path.is_empty() {
        let vault_dir = std::path::PathBuf::from(&vault_path);

        // Read sync_structure setting (subfolder or flat)
        let sync_structure: String = conn
            .query_row(
                "SELECT value FROM brain_settings WHERE key = 'sync_structure'",
                [],
                |row| row.get(0),
            )
            .unwrap_or_else(|_| "subfolder".to_string());

        let md_dir = if sync_structure == "subfolder" {
            vault_dir.join("QuackBrain")
        } else {
            vault_dir
        };

        std::fs::create_dir_all(&md_dir).map_err(|e| format!("Failed to create markdown dir at {:?}: {}", md_dir, e))?;
        log::info!("📁 Using vault path from settings: {:?}", md_dir);
        return Ok(md_dir);
    }

    // Fallback to default location if no vault_path configured
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    let md_dir = home.join(".quack").join("brain").join("markdown");
    std::fs::create_dir_all(&md_dir).map_err(|e| format!("Failed to create markdown dir: {}", e))?;
    log::info!("📁 Using default markdown dir (no vault configured): {:?}", md_dir);
    Ok(md_dir)
}

/// Generate markdown content for an entity with new Obsidian schema
fn entity_to_markdown(entity: &BrainEntity) -> String {
    let mut md = String::new();

    // Get current date for new entities
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let date = entity.date.as_ref().unwrap_or(&today);

    // YAML frontmatter
    md.push_str("---\n");
    md.push_str(&format!("id: \"{}\"\n", entity.id));
    md.push_str(&format!("tag: {}\n", entity.entity_type));  // Changed from "type:" to "tag:"

    if let Some(ref project_id) = entity.project_id {
        md.push_str(&format!("project: {}\n", project_id));
    }
    if let Some(ref source_file) = entity.source_file {
        md.push_str(&format!("file: {}\n", source_file));
    }

    md.push_str(&format!("date: {}\n", date));
    md.push_str(&format!("daily: \"[[{}]]\"\n", date));

    if let Some(ref author) = entity.author {
        md.push_str(&format!("author: {}\n", author));
    } else {
        md.push_str("author: claude\n");  // Default author
    }

    if let Some(ref status) = entity.status {
        md.push_str(&format!("status: {}\n", status));
    } else {
        md.push_str("status: active\n");
    }

    if let Some(ref confidence) = entity.confidence {
        md.push_str(&format!("confidence: {}\n", confidence));
    } else {
        md.push_str("confidence: high\n");
    }

    if let Some(ref aliases) = entity.aliases {
        if !aliases.is_empty() {
            md.push_str("aliases:\n");
            for alias in aliases {
                md.push_str(&format!("  - {}\n", alias));
            }
        }
    }

    md.push_str("---\n\n");

    // Title
    md.push_str(&format!("# {}\n\n", entity.name));

    // Observations
    if !entity.observations.is_empty() {
        md.push_str("## Observations\n\n");
        for obs in &entity.observations {
            md.push_str(&format!("- {}\n", obs.content));
        }
        md.push_str("\n");
    }

    md
}

/// Slugify a string for file names
fn slugify(s: &str) -> String {
    s.chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' {
                c.to_ascii_lowercase()
            } else if c.is_whitespace() {
                '-'
            } else {
                '_'
            }
        })
        .collect::<String>()
        .trim_matches(|c| c == '-' || c == '_')
        .to_string()
}

/// Get today's date in YYYY-MM-DD format
fn get_today_date() -> String {
    chrono::Local::now().format("%Y-%m-%d").to_string()
}

/// Ensure diary note exists for a given date, create if missing
fn ensure_diary_exists(md_dir: &std::path::Path, date: &str) -> Result<std::path::PathBuf, String> {
    let diary_dir = md_dir.join("diary");
    std::fs::create_dir_all(&diary_dir).map_err(|e| format!("Failed to create diary dir: {}", e))?;

    let diary_path = diary_dir.join(format!("{}.md", date));

    if !diary_path.exists() {
        // Create diary note with template
        let diary_content = format!(
r#"---
id: "diary-{}"
tag: diary
date: {}
daily: "[[{}]]"
author: system
---

# {}

## Notes Created Today

"#,
            date, date, date, date
        );

        let mut file = std::fs::File::create(&diary_path)
            .map_err(|e| format!("Failed to create diary file: {}", e))?;
        file.write_all(diary_content.as_bytes())
            .map_err(|e| format!("Failed to write diary content: {}", e))?;

        log::info!("📅 Created diary note for {}", date);
    }

    Ok(diary_path)
}

/// Append an entry to the diary's "Notes Created Today" section
fn append_to_diary(md_dir: &std::path::Path, date: &str, entry: &str) -> Result<(), String> {
    let diary_path = ensure_diary_exists(md_dir, date)?;

    let content = std::fs::read_to_string(&diary_path)
        .map_err(|e| format!("Failed to read diary: {}", e))?;

    // Check if entry already exists (avoid duplicates)
    if content.contains(entry) {
        return Ok(());
    }

    // Find "## Notes Created Today" section and append
    let new_content = if content.contains("## Notes Created Today") {
        // Append after the section header
        let parts: Vec<&str> = content.splitn(2, "## Notes Created Today").collect();
        if parts.len() == 2 {
            let header = parts[0];
            let rest = parts[1];
            // Find first newline after header to insert entry
            if let Some(newline_pos) = rest.find('\n') {
                format!(
                    "{}## Notes Created Today{}\n{}\n{}",
                    header,
                    &rest[..newline_pos],
                    entry,
                    &rest[newline_pos..]
                )
            } else {
                format!("{}## Notes Created Today\n\n{}\n", header, entry)
            }
        } else {
            format!("{}\n## Notes Created Today\n\n{}\n", content, entry)
        }
    } else {
        format!("{}\n## Notes Created Today\n\n{}\n", content, entry)
    };

    std::fs::write(&diary_path, new_content)
        .map_err(|e| format!("Failed to write diary: {}", e))?;

    log::info!("📝 Added entry to diary {}: {}", date, entry);
    Ok(())
}

/// Get a brief description for an entity based on its type and first observation
fn get_entity_description(entity: &BrainEntity) -> String {
    if let Some(obs) = entity.observations.first() {
        // Take first 50 chars of first observation
        let desc = obs.content.chars().take(50).collect::<String>();
        if obs.content.len() > 50 {
            format!("{}...", desc)
        } else {
            desc
        }
    } else {
        format!("{} entity", entity.entity_type)
    }
}

/// Sync a single entity to markdown file
#[tauri::command]
pub fn brain_sync_entity_to_md(entity_id: String) -> Result<String, String> {
    let conn = get_connection()?;
    let md_dir = get_markdown_dir()?;

    // Get entity with observations
    let entity: BrainEntity = conn.query_row(
        "SELECT id, name, entity_type, project_id, created_at, updated_at, md_file_path,
                source_file, date, daily_link, author, status, confidence, aliases
         FROM entities WHERE id = ?1",
        [&entity_id],
        |row| {
            let aliases_json: Option<String> = row.get(13)?;
            let aliases: Option<Vec<String>> = aliases_json.as_ref().and_then(|json| {
                serde_json::from_str(json).ok()
            });

            Ok(BrainEntity {
                id: row.get(0)?,
                name: row.get(1)?,
                entity_type: row.get(2)?,
                project_id: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
                md_file_path: row.get(6)?,
                source_file: row.get(7)?,
                date: row.get(8)?,
                daily_link: row.get(9)?,
                author: row.get(10)?,
                status: row.get(11)?,
                confidence: row.get(12)?,
                aliases,
                observations: Vec::new(),
            })
        },
    ).map_err(|e| format!("Entity not found: {}", e))?;

    // Get observations
    let mut stmt = conn.prepare(
        "SELECT id, content, created_at FROM observations WHERE entity_id = ?1 ORDER BY created_at"
    ).map_err(|e| format!("Query error: {}", e))?;

    let observations: Vec<BrainObservation> = stmt.query_map([&entity_id], |row| {
        Ok(BrainObservation {
            id: row.get(0)?,
            content: row.get(1)?,
            created_at: row.get(2)?,
        })
    })
    .map_err(|e| format!("Query error: {}", e))?
    .filter_map(|r| r.ok())
    .collect();

    let entity = BrainEntity { observations, ..entity };

    // Determine file path using tag-based folder structure
    // Special cases: diary and human are ALWAYS global
    let tag = entity.entity_type.as_str();
    let tag_folder = crate::brain::types::get_folder_for_tag(tag);

    let file_path = match tag {
        // Diary is always in diary/ folder
        "diary" => {
            let diary_dir = md_dir.join("diary");
            std::fs::create_dir_all(&diary_dir).map_err(|e| format!("Dir error: {}", e))?;
            diary_dir.join(format!("{}.md", slugify(&entity.name)))
        },
        // Human is always in global/humans/
        "human" => {
            let humans_dir = md_dir.join("global").join("humans");
            std::fs::create_dir_all(&humans_dir).map_err(|e| format!("Dir error: {}", e))?;
            humans_dir.join(format!("{}.md", slugify(&entity.name)))
        },
        // Glossary goes at the root of project or global
        "glossary" => {
            if let Some(ref project_id) = entity.project_id {
                let project_dir = md_dir.join("projects").join(slugify(project_id));
                std::fs::create_dir_all(&project_dir).map_err(|e| format!("Dir error: {}", e))?;
                project_dir.join("glossary.md")
            } else {
                let global_dir = md_dir.join("global");
                std::fs::create_dir_all(&global_dir).map_err(|e| format!("Dir error: {}", e))?;
                global_dir.join("glossary.md")
            }
        },
        // All other tags: projects/{project}/{tag_folder}/ or global/{tag_folder}/
        _ => {
            if let Some(ref project_id) = entity.project_id {
                let tag_dir = md_dir.join("projects").join(slugify(project_id)).join(tag_folder);
                std::fs::create_dir_all(&tag_dir).map_err(|e| format!("Dir error: {}", e))?;
                tag_dir.join(format!("{}.md", slugify(&entity.name)))
            } else {
                let tag_dir = md_dir.join("global").join(tag_folder);
                std::fs::create_dir_all(&tag_dir).map_err(|e| format!("Dir error: {}", e))?;
                tag_dir.join(format!("{}.md", slugify(&entity.name)))
            }
        }
    };

    // Generate and write markdown
    let content = entity_to_markdown(&entity);
    let mut file = std::fs::File::create(&file_path).map_err(|e| format!("File error: {}", e))?;
    file.write_all(content.as_bytes()).map_err(|e| format!("Write error: {}", e))?;

    // Update entity with file path
    let path_str = file_path.to_string_lossy().to_string();
    conn.execute(
        "UPDATE entities SET md_file_path = ?1 WHERE id = ?2",
        rusqlite::params![path_str, entity_id],
    ).map_err(|e| format!("Update error: {}", e))?;

    // Update diary with new note entry (unless it's a diary note itself)
    if tag != "diary" {
        let date = entity.date.clone().unwrap_or_else(get_today_date);
        let description = get_entity_description(&entity);
        let diary_entry = format!("- [[{}]] - #{} - {}", entity.name, tag, description);
        if let Err(e) = append_to_diary(&md_dir, &date, &diary_entry) {
            log::warn!("Failed to update diary: {}", e);
        }
    }

    Ok(path_str)
}

/// Sync all entities to markdown files
#[tauri::command]
pub fn brain_sync_all_to_md() -> Result<SyncResult, String> {
    let conn = get_connection()?;
    let md_dir = get_markdown_dir()?;
    let mut result = SyncResult {
        files_created: 0,
        files_updated: 0,
        errors: Vec::new(),
    };

    // Get all entities with full data including new Obsidian sync fields
    let mut stmt = conn.prepare(
        "SELECT id, name, entity_type, project_id, created_at, updated_at, md_file_path,
                source_file, date, daily_link, author, status, confidence, aliases
         FROM entities"
    ).map_err(|e| format!("Query error: {}", e))?;

    let entities: Vec<BrainEntity> = stmt.query_map([], |row| {
        let aliases_json: Option<String> = row.get(13)?;
        let aliases: Option<Vec<String>> = aliases_json.as_ref().and_then(|json| {
            serde_json::from_str(json).ok()
        });

        Ok(BrainEntity {
            id: row.get(0)?,
            name: row.get(1)?,
            entity_type: row.get(2)?,
            project_id: row.get(3)?,
            created_at: row.get(4)?,
            updated_at: row.get(5)?,
            md_file_path: row.get(6)?,
            source_file: row.get(7)?,
            date: row.get(8)?,
            daily_link: row.get(9)?,
            author: row.get(10)?,
            status: row.get(11)?,
            confidence: row.get(12)?,
            aliases,
            observations: Vec::new(), // Will be filled in the loop
        })
    })
    .map_err(|e| format!("Query error: {}", e))?
    .filter_map(|r| r.ok())
    .collect();

    drop(stmt);

    for mut entity in entities {
        let entity_id = entity.id.clone();

        // Get observations
        let mut stmt = match conn.prepare(
            "SELECT id, content, created_at FROM observations WHERE entity_id = ?1 ORDER BY created_at"
        ) {
            Ok(s) => s,
            Err(e) => {
                result.errors.push(format!("{}: Query error: {}", entity_id, e));
                continue;
            }
        };

        let observations: Vec<BrainObservation> = match stmt.query_map([&entity_id], |row| {
            Ok(BrainObservation {
                id: row.get(0)?,
                content: row.get(1)?,
                created_at: row.get(2)?,
            })
        }) {
            Ok(rows) => rows.filter_map(|r| r.ok()).collect(),
            Err(e) => {
                result.errors.push(format!("{}: Query error: {}", entity_id, e));
                continue;
            }
        };

        drop(stmt);

        // Update entity with observations
        entity.observations = observations;
        let existing_path = entity.md_file_path.clone();

        // Determine file path using tag-based folder structure
        // Special cases: diary and human are ALWAYS global
        let tag = entity.entity_type.as_str();
        let tag_folder = crate::brain::types::get_folder_for_tag(tag);

        let file_path = match tag {
            // Diary is always in diary/ folder
            "diary" => {
                let diary_dir = md_dir.join("diary");
                if let Err(e) = std::fs::create_dir_all(&diary_dir) {
                    result.errors.push(format!("{}: Dir error: {}", entity_id, e));
                    continue;
                }
                diary_dir.join(format!("{}.md", slugify(&entity.name)))
            },
            // Human is always in global/humans/
            "human" => {
                let humans_dir = md_dir.join("global").join("humans");
                if let Err(e) = std::fs::create_dir_all(&humans_dir) {
                    result.errors.push(format!("{}: Dir error: {}", entity_id, e));
                    continue;
                }
                humans_dir.join(format!("{}.md", slugify(&entity.name)))
            },
            // Glossary goes at the root of project or global
            "glossary" => {
                if let Some(ref project_id) = entity.project_id {
                    let project_dir = md_dir.join("projects").join(slugify(project_id));
                    if let Err(e) = std::fs::create_dir_all(&project_dir) {
                        result.errors.push(format!("{}: Dir error: {}", entity_id, e));
                        continue;
                    }
                    project_dir.join("glossary.md")
                } else {
                    let global_dir = md_dir.join("global");
                    if let Err(e) = std::fs::create_dir_all(&global_dir) {
                        result.errors.push(format!("{}: Dir error: {}", entity_id, e));
                        continue;
                    }
                    global_dir.join("glossary.md")
                }
            },
            // All other tags: projects/{project}/{tag_folder}/ or global/{tag_folder}/
            _ => {
                if let Some(ref project_id) = entity.project_id {
                    let tag_dir = md_dir.join("projects").join(slugify(project_id)).join(tag_folder);
                    if let Err(e) = std::fs::create_dir_all(&tag_dir) {
                        result.errors.push(format!("{}: Dir error: {}", entity_id, e));
                        continue;
                    }
                    tag_dir.join(format!("{}.md", slugify(&entity.name)))
                } else {
                    let tag_dir = md_dir.join("global").join(tag_folder);
                    if let Err(e) = std::fs::create_dir_all(&tag_dir) {
                        result.errors.push(format!("{}: Dir error: {}", entity_id, e));
                        continue;
                    }
                    tag_dir.join(format!("{}.md", slugify(&entity.name)))
                }
            }
        };

        // Generate and write markdown
        let content = entity_to_markdown(&entity);
        if let Err(e) = std::fs::File::create(&file_path)
            .and_then(|mut file| file.write_all(content.as_bytes()))
        {
            result.errors.push(format!("{}: Write error: {}", entity_id, e));
            continue;
        }

        // Update entity with file path
        let path_str = file_path.to_string_lossy().to_string();
        if let Err(e) = conn.execute(
            "UPDATE entities SET md_file_path = ?1 WHERE id = ?2",
            rusqlite::params![path_str, entity_id],
        ) {
            result.errors.push(format!("{}: Update error: {}", entity_id, e));
            continue;
        }

        // Update diary with new note entry (unless it's a diary note itself)
        if tag != "diary" {
            let date = entity.date.clone().unwrap_or_else(get_today_date);
            let description = get_entity_description(&entity);
            let diary_entry = format!("- [[{}]] - #{} - {}", entity.name, tag, description);
            if let Err(e) = append_to_diary(&md_dir, &date, &diary_entry) {
                log::warn!("Failed to update diary for {}: {}", entity_id, e);
            }
        }

        if existing_path.is_some() {
            result.files_updated += 1;
        } else {
            result.files_created += 1;
        }
    }

    Ok(result)
}

/// Get markdown export path
#[tauri::command]
pub fn brain_get_markdown_path() -> Result<String, String> {
    let md_dir = get_markdown_dir()?;
    Ok(md_dir.to_string_lossy().to_string())
}

/// Open markdown folder in Finder
#[tauri::command]
pub fn brain_open_markdown_folder() -> Result<(), String> {
    let md_dir = get_markdown_dir()?;

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&md_dir)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&md_dir)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&md_dir)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    Ok(())
}

// ============================================
// Semantic Search Commands
// ============================================

/// Store embedding for an entity
#[tauri::command]
pub fn brain_store_embedding(
    entity_id: String,
    vector: Vec<f32>,
    model: String,
) -> Result<(), String> {
    let conn = get_connection()?;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64;

    let id = format!("emb_{}", Uuid::new_v4());

    // Serialize vector to bytes
    let vector_bytes: Vec<u8> = vector.iter()
        .flat_map(|f| f.to_le_bytes())
        .collect();

    // Insert or update
    conn.execute(
        "INSERT OR REPLACE INTO embeddings (id, entity_id, vector, model, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![id, entity_id, vector_bytes, model, now],
    ).map_err(|e| format!("Failed to store embedding: {}", e))?;

    Ok(())
}

/// Get embedding for an entity
#[tauri::command]
pub fn brain_get_embedding(entity_id: String) -> Result<Option<Vec<f32>>, String> {
    let conn = get_connection()?;

    let result: Result<Vec<u8>, _> = conn.query_row(
        "SELECT vector FROM embeddings WHERE entity_id = ?1",
        [&entity_id],
        |row| row.get(0),
    );

    match result {
        Ok(bytes) => {
            // Deserialize bytes to f32 vector
            let floats: Vec<f32> = bytes
                .chunks(4)
                .map(|chunk| {
                    let arr: [u8; 4] = chunk.try_into().unwrap_or([0; 4]);
                    f32::from_le_bytes(arr)
                })
                .collect();
            Ok(Some(floats))
        }
        Err(_) => Ok(None),
    }
}

/// Get entities without embeddings
#[tauri::command]
pub fn brain_get_entities_without_embeddings() -> Result<Vec<String>, String> {
    let conn = get_connection()?;

    let mut stmt = conn.prepare(
        "SELECT e.id FROM entities e LEFT JOIN embeddings emb ON e.id = emb.entity_id WHERE emb.id IS NULL"
    ).map_err(|e| format!("Query error: {}", e))?;

    let ids: Vec<String> = stmt.query_map([], |row| row.get(0))
        .map_err(|e| format!("Query error: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(ids)
}

/// Semantic search using cosine similarity
#[tauri::command]
pub fn brain_semantic_search(
    query_vector: Vec<f32>,
    limit: usize,
) -> Result<Vec<SemanticSearchResult>, String> {
    let conn = get_connection()?;

    // Get all embeddings
    let mut stmt = conn.prepare(
        "SELECT e.id, e.name, e.entity_type, emb.vector
         FROM entities e
         JOIN embeddings emb ON e.id = emb.entity_id"
    ).map_err(|e| format!("Query error: {}", e))?;

    let results: Vec<(String, String, String, Vec<u8>)> = stmt.query_map([], |row| {
        Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
    })
    .map_err(|e| format!("Query error: {}", e))?
    .filter_map(|r| r.ok())
    .collect();

    // Calculate cosine similarity for each
    let mut scored: Vec<SemanticSearchResult> = results
        .into_iter()
        .map(|(id, name, entity_type, bytes)| {
            let vector: Vec<f32> = bytes
                .chunks(4)
                .map(|chunk| {
                    let arr: [u8; 4] = chunk.try_into().unwrap_or([0; 4]);
                    f32::from_le_bytes(arr)
                })
                .collect();

            let score = cosine_similarity(&query_vector, &vector);

            SemanticSearchResult {
                entity_id: id,
                entity_name: name,
                entity_type,
                score,
            }
        })
        .collect();

    // Sort by score descending
    scored.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));

    // Take top N
    scored.truncate(limit);

    Ok(scored)
}

/// Cosine similarity between two vectors
fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() || a.is_empty() {
        return 0.0;
    }

    let dot: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
    let norm_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let norm_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();

    if norm_a == 0.0 || norm_b == 0.0 {
        return 0.0;
    }

    dot / (norm_a * norm_b)
}

// ============================================
// Settings Commands (Obsidian Sync)
// ============================================

/// Get all brain settings
#[tauri::command]
pub fn brain_get_settings() -> Result<BrainSettings, String> {
    let conn = get_connection()?;

    let mut stmt = conn
        .prepare("SELECT key, value FROM brain_settings")
        .map_err(|e| format!("Failed to prepare settings query: {}", e))?;

    let settings_rows: Vec<(String, String)> = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| format!("Failed to query settings: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    // Build settings struct from rows
    let mut settings = BrainSettings::default();

    for (key, value) in settings_rows {
        match key.as_str() {
            "vault_path" => settings.vault_path = value,
            "sync_enabled" => settings.sync_enabled = value == "true",
            "sync_structure" => settings.sync_structure = value,
            "auto_sync_to_vault" => settings.auto_sync_to_vault = value == "true",
            "auto_sync_from_vault" => settings.auto_sync_from_vault = value == "true",
            "conflict_policy" => settings.conflict_policy = value,
            "auto_embed" => settings.auto_embed = value == "true",
            "markdown_editor" => settings.markdown_editor = value,
            _ => {}
        }
    }

    Ok(settings)
}

/// Set a single brain setting
#[tauri::command]
pub fn brain_set_setting(key: String, value: String) -> Result<(), String> {
    let conn = get_connection()?;
    let timestamp = now();

    // Validate key
    let valid_keys = [
        "vault_path",
        "sync_enabled",
        "sync_structure",
        "auto_sync_to_vault",
        "auto_sync_from_vault",
        "conflict_policy",
        "auto_embed",
        "markdown_editor",
    ];

    if !valid_keys.contains(&key.as_str()) {
        return Err(format!("Invalid setting key: {}", key));
    }

    conn.execute(
        "INSERT OR REPLACE INTO brain_settings (key, value, updated_at) VALUES (?1, ?2, ?3)",
        params![key, value, timestamp],
    )
    .map_err(|e| format!("Failed to set setting {}: {}", key, e))?;

    log::info!("Setting updated: {} = {}", key, value);

    Ok(())
}

/// Debug: Dump all brain settings for troubleshooting
#[tauri::command]
pub fn brain_debug_settings() -> Result<String, String> {
    let conn = get_connection()?;

    let mut stmt = conn
        .prepare("SELECT key, value, updated_at FROM brain_settings ORDER BY key")
        .map_err(|e| format!("Failed to prepare settings query: {}", e))?;

    let settings_rows: Vec<(String, String, i64)> = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))
        .map_err(|e| format!("Failed to query settings: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    let mut debug_output = String::new();
    debug_output.push_str("=== BRAIN SETTINGS DEBUG ===\n");
    debug_output.push_str(&format!("Database: ~/.quack/brain/brain.db\n"));
    debug_output.push_str(&format!("Settings count: {}\n\n", settings_rows.len()));

    for (key, value, updated_at) in &settings_rows {
        debug_output.push_str(&format!("{}: '{}' (updated: {})\n", key, value, updated_at));
    }

    // Check auto-sync conditions
    let sync_enabled = settings_rows.iter().find(|(k, _, _)| k == "sync_enabled").map(|(_, v, _)| v == "true").unwrap_or(false);
    let auto_sync = settings_rows.iter().find(|(k, _, _)| k == "auto_sync_to_vault").map(|(_, v, _)| v == "true").unwrap_or(false);
    let vault_path = settings_rows.iter().find(|(k, _, _)| k == "vault_path").map(|(_, v, _)| v.clone()).unwrap_or_default();

    debug_output.push_str("\n=== AUTO-SYNC STATUS ===\n");
    debug_output.push_str(&format!("sync_enabled: {}\n", sync_enabled));
    debug_output.push_str(&format!("auto_sync_to_vault: {}\n", auto_sync));
    debug_output.push_str(&format!("vault_path: '{}' (has_path: {})\n", vault_path, !vault_path.is_empty()));
    debug_output.push_str(&format!("WILL AUTO-SYNC: {}\n", sync_enabled && auto_sync && !vault_path.is_empty()));

    log::info!("{}", debug_output);

    Ok(debug_output)
}

/// Get a single brain setting
#[tauri::command]
pub fn brain_get_setting(key: String) -> Result<Option<String>, String> {
    let conn = get_connection()?;

    let result: Result<String, _> = conn.query_row(
        "SELECT value FROM brain_settings WHERE key = ?1",
        params![key],
        |row| row.get(0),
    );

    match result {
        Ok(value) => Ok(Some(value)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("Failed to get setting {}: {}", key, e)),
    }
}

/// Update multiple settings at once
#[tauri::command]
pub fn brain_update_settings(settings: BrainSettings) -> Result<(), String> {
    let conn = get_connection()?;
    let timestamp = now();

    let settings_vec = [
        ("vault_path", settings.vault_path),
        ("sync_enabled", settings.sync_enabled.to_string()),
        ("sync_structure", settings.sync_structure),
        ("auto_sync_to_vault", settings.auto_sync_to_vault.to_string()),
        ("auto_sync_from_vault", settings.auto_sync_from_vault.to_string()),
        ("conflict_policy", settings.conflict_policy),
        ("auto_embed", settings.auto_embed.to_string()),
        ("markdown_editor", settings.markdown_editor),
    ];

    for (key, value) in settings_vec {
        conn.execute(
            "INSERT OR REPLACE INTO brain_settings (key, value, updated_at) VALUES (?1, ?2, ?3)",
            params![key, value, timestamp],
        )
        .map_err(|e| format!("Failed to update setting {}: {}", key, e))?;
    }

    log::info!("All settings updated");

    Ok(())
}

/// Get sync status for an entity
#[tauri::command]
pub fn brain_get_sync_status(entity_id: String) -> Result<SyncStatus, String> {
    let conn = get_connection()?;

    let result = conn.query_row(
        "SELECT id, updated_at, sync_hash, last_synced_at, vault_relative_path FROM entities WHERE id = ?1",
        params![entity_id],
        |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, Option<i64>>(3)?,
                row.get::<_, Option<String>>(4)?,
            ))
        },
    ).map_err(|e| format!("Entity not found: {}", e))?;

    // Determine if there's a conflict (updated after last sync)
    let has_conflict = match (result.3, result.2.as_ref()) {
        (Some(last_synced), Some(_)) => result.1 > last_synced,
        _ => false,
    };

    Ok(SyncStatus {
        entity_id: result.0,
        has_conflict,
        brain_updated_at: result.1,
        vault_updated_at: result.3,
        sync_hash: result.2,
    })
}

/// Update sync metadata for an entity
#[tauri::command]
pub fn brain_update_sync_metadata(
    entity_id: String,
    sync_hash: Option<String>,
    vault_relative_path: Option<String>,
    sync_source: Option<String>,
) -> Result<(), String> {
    let conn = get_connection()?;
    let timestamp = now();

    conn.execute(
        "UPDATE entities SET sync_hash = ?1, last_synced_at = ?2, vault_relative_path = ?3, sync_source = ?4 WHERE id = ?5",
        params![sync_hash, timestamp, vault_relative_path, sync_source, entity_id],
    )
    .map_err(|e| format!("Failed to update sync metadata: {}", e))?;

    Ok(())
}

/// Get entities that need syncing (updated since last sync)
#[tauri::command]
pub fn brain_get_entities_needing_sync() -> Result<Vec<String>, String> {
    let conn = get_connection()?;

    let mut stmt = conn
        .prepare(
            "SELECT id FROM entities WHERE last_synced_at IS NULL OR updated_at > last_synced_at",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let ids: Vec<String> = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| format!("Failed to query entities: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(ids)
}

/// Hybrid search (FTS + semantic)
#[tauri::command]
pub fn brain_hybrid_search(
    query: String,
    query_vector: Option<Vec<f32>>,
    limit: usize,
) -> Result<Vec<HybridSearchResult>, String> {
    let conn = get_connection()?;

    // FTS search
    let mut fts_results: Vec<(String, f32)> = Vec::new();

    let mut stmt = conn.prepare(
        "SELECT e.id, bm25(entities_fts) as score
         FROM entities_fts
         JOIN entities e ON entities_fts.rowid = e.rowid
         WHERE entities_fts MATCH ?1
         ORDER BY score
         LIMIT ?2"
    ).map_err(|e| format!("FTS query error: {}", e))?;

    let fts: Vec<(String, f64)> = stmt.query_map(rusqlite::params![query, limit * 2], |row| {
        Ok((row.get(0)?, row.get(1)?))
    })
    .map_err(|e| format!("FTS error: {}", e))?
    .filter_map(|r| r.ok())
    .collect();

    // Normalize FTS scores (BM25 returns negative, lower is better)
    let max_fts = fts.iter().map(|(_, s)| s.abs()).fold(0.0f64, f64::max);
    for (id, score) in fts {
        let normalized = if max_fts > 0.0 { 1.0 - (score.abs() / max_fts) } else { 0.5 };
        fts_results.push((id, normalized as f32));
    }

    // Semantic search if vector provided
    let mut semantic_results: Vec<(String, f32)> = Vec::new();

    if let Some(ref qv) = query_vector {
        let semantic = brain_semantic_search(qv.clone(), limit * 2)?;
        for r in semantic {
            semantic_results.push((r.entity_id, r.score));
        }
    }

    // Combine results using RRF (Reciprocal Rank Fusion)
    let mut combined: std::collections::HashMap<String, f32> = std::collections::HashMap::new();
    let k = 60.0; // RRF constant

    for (rank, (id, _)) in fts_results.iter().enumerate() {
        let score = 1.0 / (k + rank as f32 + 1.0);
        *combined.entry(id.clone()).or_insert(0.0) += score;
    }

    for (rank, (id, _)) in semantic_results.iter().enumerate() {
        let score = 1.0 / (k + rank as f32 + 1.0);
        *combined.entry(id.clone()).or_insert(0.0) += score;
    }

    // Sort by combined score
    let mut results: Vec<(String, f32)> = combined.into_iter().collect();
    results.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
    results.truncate(limit);

    // Get full entity info
    let mut hybrid_results: Vec<HybridSearchResult> = Vec::new();

    for (entity_id, score) in results {
        if let Ok(row) = conn.query_row(
            "SELECT name, entity_type FROM entities WHERE id = ?1",
            [&entity_id],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
        ) {
            hybrid_results.push(HybridSearchResult {
                entity_id,
                entity_name: row.0,
                entity_type: row.1,
                score,
            });
        }
    }

    Ok(hybrid_results)
}

// ============================================
// Obsidian Sync Advanced Commands
// ============================================

/// Global sync status for UI settings page
#[derive(Debug, Clone, Serialize)]
pub struct GlobalSyncStatus {
    pub last_sync_time: Option<i64>,
    pub entity_count: usize,
    pub conflict_count: usize,
    pub is_generating_embeddings: bool,
    pub embedding_progress: u8,
}

/// Batch embedding result
#[derive(Debug, Clone, Serialize)]
pub struct EmbeddingBatchResult {
    pub processed: usize,
    pub errors: Vec<String>,
}

/// All embeddings generation result
#[derive(Debug, Clone, Serialize)]
pub struct AllEmbeddingsResult {
    pub total: usize,
    pub processed: usize,
    pub errors: Vec<String>,
}

/// Resolve conflict between Brain and Obsidian vault
///
/// Parameters:
/// - entity_id: Entity to resolve conflict for
/// - resolution: "brain" (Brain overwrites Obsidian) or "obsidian" (Obsidian overwrites Brain)
#[tauri::command]
pub fn brain_resolve_conflict(entity_id: String, resolution: String) -> Result<(), String> {
    if resolution != "brain" && resolution != "obsidian" {
        return Err(format!("Invalid resolution: {}. Must be 'brain' or 'obsidian'", resolution));
    }

    let conn = get_connection()?;
    let timestamp = now();

    if resolution == "brain" {
        // Brain overwrites Obsidian: re-sync entity to markdown
        brain_sync_entity_to_md(entity_id.clone())?;
    } else {
        // Obsidian overwrites Brain: re-import from markdown
        // Get vault path from settings
        let vault_path: String = conn.query_row(
            "SELECT value FROM brain_settings WHERE key = 'vault_path'",
            [],
            |row| row.get(0),
        ).map_err(|e| format!("Failed to get vault_path: {}", e))?;

        if vault_path.is_empty() {
            return Err("Vault path not configured".to_string());
        }

        // Get entity's vault relative path
        let vault_relative_path: Option<String> = conn.query_row(
            "SELECT vault_relative_path FROM entities WHERE id = ?1",
            [&entity_id],
            |row| row.get(0),
        ).map_err(|e| format!("Entity not found: {}", e))?;

        if let Some(rel_path) = vault_relative_path {
            let full_path = std::path::Path::new(&vault_path).join(&rel_path);

            if full_path.exists() {
                // Re-import from markdown (this would call brain_import_markdown_file)
                // For now, we'll just update the sync metadata
                let content = std::fs::read_to_string(&full_path)
                    .map_err(|e| format!("Failed to read markdown file: {}", e))?;

                // Calculate new sync hash (simple content-based hash)
                use std::collections::hash_map::DefaultHasher;
                use std::hash::{Hash, Hasher};
                let mut hasher = DefaultHasher::new();
                content.hash(&mut hasher);
                let sync_hash = format!("{:x}", hasher.finish());

                // Update sync metadata
                conn.execute(
                    "UPDATE entities SET sync_hash = ?1, last_synced_at = ?2, sync_source = 'obsidian' WHERE id = ?3",
                    params![sync_hash, timestamp, entity_id],
                ).map_err(|e| format!("Failed to update sync metadata: {}", e))?;
            } else {
                return Err(format!("Markdown file not found: {}", full_path.display()));
            }
        } else {
            return Err("Entity has no vault_relative_path".to_string());
        }
    }

    // Update last_synced_at to mark conflict as resolved
    conn.execute(
        "UPDATE entities SET last_synced_at = ?1 WHERE id = ?2",
        params![timestamp, entity_id],
    ).map_err(|e| format!("Failed to update last_synced_at: {}", e))?;

    Ok(())
}

/// Get global sync status (for UI settings page)
///
/// Returns overall sync statistics without focusing on a specific entity
#[tauri::command]
pub fn brain_get_global_sync_status() -> Result<GlobalSyncStatus, String> {
    let conn = get_connection()?;

    // Get total entity count
    let entity_count: usize = conn.query_row(
        "SELECT COUNT(*) FROM entities",
        [],
        |row| row.get(0),
    ).unwrap_or(0);

    // Count entities with conflicts (updated_at > last_synced_at AND last_synced_at IS NOT NULL)
    let conflict_count: usize = conn.query_row(
        "SELECT COUNT(*) FROM entities WHERE last_synced_at IS NOT NULL AND updated_at > last_synced_at",
        [],
        |row| row.get(0),
    ).unwrap_or(0);

    // Get last sync time (most recent last_synced_at)
    let last_sync_time: Option<i64> = conn.query_row(
        "SELECT MAX(last_synced_at) FROM entities WHERE last_synced_at IS NOT NULL",
        [],
        |row| row.get(0),
    ).ok().flatten();

    // Check if embeddings are being generated (simplified - would need state management in production)
    let is_generating_embeddings = false;

    // Calculate embedding progress (entities with embeddings / total entities)
    let entities_with_embeddings: usize = conn.query_row(
        "SELECT COUNT(DISTINCT entity_id) FROM embeddings",
        [],
        |row| row.get(0),
    ).unwrap_or(0);

    let embedding_progress = if entity_count > 0 {
        ((entities_with_embeddings as f32 / entity_count as f32) * 100.0) as u8
    } else {
        0
    };

    Ok(GlobalSyncStatus {
        last_sync_time,
        entity_count,
        conflict_count,
        is_generating_embeddings,
        embedding_progress,
    })
}

/// Sync all entities to Obsidian vault
///
/// Wrapper that syncs all entities to the configured vault path
#[tauri::command]
pub fn brain_sync_to_vault() -> Result<usize, String> {
    let conn = get_connection()?;

    // Get vault path from settings
    let vault_path: String = conn.query_row(
        "SELECT value FROM brain_settings WHERE key = 'vault_path'",
        [],
        |row| row.get(0),
    ).map_err(|e| format!("Failed to get vault_path: {}", e))?;

    if vault_path.is_empty() {
        return Err("Vault path not configured. Please set vault_path in Brain settings.".to_string());
    }

    // Verify vault path exists
    let vault_path_obj = std::path::Path::new(&vault_path);
    if !vault_path_obj.exists() {
        return Err(format!("Vault path does not exist: {}", vault_path));
    }

    // Get all entities that need syncing
    let entity_ids = brain_get_entities_needing_sync()?;
    let count = entity_ids.len();

    // Sync each entity
    for entity_id in entity_ids {
        brain_sync_entity_to_md(entity_id)?;
    }

    Ok(count)
}

/// Import all markdown files from Obsidian vault
///
/// Scans the vault for .md files and imports them into Brain
#[tauri::command]
pub fn brain_import_from_vault() -> Result<ImportResult, String> {
    let conn = get_connection()?;

    // Get vault path from settings
    let vault_path: String = conn.query_row(
        "SELECT value FROM brain_settings WHERE key = 'vault_path'",
        [],
        |row| row.get(0),
    ).map_err(|e| format!("Failed to get vault_path: {}", e))?;

    if vault_path.is_empty() {
        return Err("Vault path not configured. Please set vault_path in Brain settings.".to_string());
    }

    // Verify vault path exists
    let vault_path_obj = std::path::Path::new(&vault_path);
    if !vault_path_obj.exists() {
        return Err(format!("Vault path does not exist: {}", vault_path));
    }

    let mut result = ImportResult {
        imported_entities: 0,
        imported_relations: 0,
        skipped: 0,
        errors: Vec::new(),
    };

    // Recursively scan for .md files
    let md_files = scan_markdown_files(vault_path_obj)?;

    // Import each file
    for file_path in md_files {
        match import_markdown_file(&file_path) {
            Ok(_) => result.imported_entities += 1,
            Err(e) => {
                result.errors.push(format!("{}: {}", file_path.display(), e));
                result.skipped += 1;
            }
        }
    }

    Ok(result)
}

/// Recursively scan directory for markdown files
fn scan_markdown_files(dir: &std::path::Path) -> Result<Vec<std::path::PathBuf>, String> {
    let mut md_files = Vec::new();

    let entries = std::fs::read_dir(dir)
        .map_err(|e| format!("Failed to read directory {}: {}", dir.display(), e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();

        if path.is_dir() {
            // Skip hidden directories
            if let Some(name) = path.file_name() {
                if name.to_string_lossy().starts_with('.') {
                    continue;
                }
            }
            // Recursively scan subdirectory
            md_files.extend(scan_markdown_files(&path)?);
        } else if path.extension().and_then(|s| s.to_str()) == Some("md") {
            md_files.push(path);
        }
    }

    Ok(md_files)
}

/// Import a single markdown file into Brain
fn import_markdown_file(file_path: &std::path::Path) -> Result<String, String> {
    let conn = get_connection()?;
    let timestamp = now();

    // Read file content
    let content = std::fs::read_to_string(file_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    // Parse frontmatter (basic YAML parser)
    let (frontmatter, body) = parse_markdown_frontmatter(&content)?;

    // Extract entity data from frontmatter
    let entity_id = frontmatter.get("id")
        .map(|s| s.to_string())
        .unwrap_or_else(|| Uuid::new_v4().to_string());

    let entity_type = frontmatter.get("type")
        .or_else(|| frontmatter.get("tag"))
        .map(|s| s.to_string())
        .unwrap_or_else(|| "note".to_string());

    let project_id = frontmatter.get("project").map(|s| s.to_string());

    // Extract name from first heading or filename
    let name = extract_entity_name(&body, file_path)?;

    // Check if entity already exists
    let existing: Result<String, _> = conn.query_row(
        "SELECT id FROM entities WHERE id = ?1",
        [&entity_id],
        |row| row.get(0),
    );

    if existing.is_ok() {
        return Err("Entity already exists (duplicate ID)".to_string());
    }

    // Create entity
    conn.execute(
        "INSERT INTO entities (id, name, entity_type, created_at, updated_at, project_id, md_file_path, sync_source)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'obsidian')",
        params![
            &entity_id,
            &name,
            &entity_type,
            timestamp,
            timestamp,
            &project_id,
            file_path.to_string_lossy().to_string(),
        ],
    ).map_err(|e| format!("Failed to insert entity: {}", e))?;

    // Extract observations from markdown lists
    let observations = extract_observations(&body);
    for obs_content in observations {
        let obs_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO observations (id, entity_id, content, created_at) VALUES (?1, ?2, ?3, ?4)",
            params![&obs_id, &entity_id, obs_content, timestamp],
        ).map_err(|e| format!("Failed to insert observation: {}", e))?;
    }

    // Extract and store WikiLinks from the full markdown content
    let wikilinks = parse_wikilinks(&content);
    // Filter out self-links
    let filtered_links: Vec<ParsedWikiLink> = wikilinks
        .into_iter()
        .filter(|link| link.target_name.to_lowercase() != name.to_lowercase())
        .collect();

    if !filtered_links.is_empty() {
        store_wikilinks(&entity_id, &filtered_links)?;
        log::info!(
            "[WikiLinks] Extracted {} wikilinks from imported markdown: {}",
            filtered_links.len(),
            file_path.display()
        );
    }

    Ok(entity_id)
}

/// Parse YAML frontmatter from markdown
fn parse_markdown_frontmatter(content: &str) -> Result<(std::collections::HashMap<String, String>, String), String> {
    let mut frontmatter = std::collections::HashMap::new();
    let mut body = content.to_string();

    if content.starts_with("---\n") {
        if let Some(end_pos) = content[4..].find("\n---\n") {
            let fm_content = &content[4..end_pos + 4];
            body = content[end_pos + 8..].to_string();

            // Simple YAML parser (key: value pairs)
            for line in fm_content.lines() {
                if let Some(colon_pos) = line.find(':') {
                    let key = line[..colon_pos].trim().to_string();
                    let value = line[colon_pos + 1..].trim().trim_matches('"').to_string();
                    frontmatter.insert(key, value);
                }
            }
        }
    }

    Ok((frontmatter, body))
}

/// Extract entity name from markdown (first H1 or filename)
fn extract_entity_name(body: &str, file_path: &std::path::Path) -> Result<String, String> {
    // Try to find first H1 heading
    for line in body.lines() {
        if line.starts_with("# ") {
            return Ok(line[2..].trim().to_string());
        }
    }

    // Fall back to filename
    file_path.file_stem()
        .and_then(|s| s.to_str())
        .map(|s| s.to_string())
        .ok_or_else(|| "Could not determine entity name".to_string())
}

/// Extract observations from markdown lists
fn extract_observations(body: &str) -> Vec<String> {
    let mut observations = Vec::new();
    let mut in_observations_section = false;

    for line in body.lines() {
        if line.starts_with("## Observations") {
            in_observations_section = true;
            continue;
        }

        if in_observations_section {
            if line.starts_with("## ") {
                // New section, stop collecting
                break;
            }
            if line.starts_with("- ") {
                observations.push(line[2..].trim().to_string());
            }
        }
    }

    observations
}

/// Open Obsidian vault in configured editor
///
/// Parameters:
/// - editor: Editor to use ("obsidian", "vscode", "cursor", etc.)
#[tauri::command]
pub fn brain_open_vault(editor: String) -> Result<(), String> {
    let conn = get_connection()?;

    // Get vault path from settings
    let vault_path: String = conn.query_row(
        "SELECT value FROM brain_settings WHERE key = 'vault_path'",
        [],
        |row| row.get(0),
    ).map_err(|e| format!("Failed to get vault_path: {}", e))?;

    if vault_path.is_empty() {
        return Err("Vault path not configured. Please set vault_path in Brain settings.".to_string());
    }

    // Verify vault path exists
    let vault_path_obj = std::path::Path::new(&vault_path);
    if !vault_path_obj.exists() {
        return Err(format!("Vault path does not exist: {}", vault_path));
    }

    // Open with appropriate command based on OS and editor
    let result: Result<std::process::Child, std::io::Error> = match editor.as_str() {
        "obsidian" => {
            // Use obsidian:// URL scheme
            let url = format!("obsidian://open?vault={}", vault_path);
            #[cfg(target_os = "macos")]
            { std::process::Command::new("open").arg(&url).spawn() }
            #[cfg(target_os = "windows")]
            { std::process::Command::new("cmd").args(["/C", "start", &url]).spawn() }
            #[cfg(target_os = "linux")]
            { std::process::Command::new("xdg-open").arg(&url).spawn() }
        }
        _ => {
            // Use default file manager
            #[cfg(target_os = "macos")]
            { std::process::Command::new("open").arg(&vault_path).spawn() }
            #[cfg(target_os = "windows")]
            { std::process::Command::new("explorer").arg(&vault_path).spawn() }
            #[cfg(target_os = "linux")]
            { std::process::Command::new("xdg-open").arg(&vault_path).spawn() }
        }
    };

    result.map_err(|e| format!("Failed to open vault: {}", e))?;

    Ok(())
}

/// Generate embeddings for specific entities (batch)
///
/// Parameters:
/// - entity_ids: List of entity IDs to generate embeddings for
#[tauri::command]
pub fn brain_generate_embeddings_batch(entity_ids: Vec<String>) -> Result<EmbeddingBatchResult, String> {
    let conn = get_connection()?;
    let timestamp = now();
    let mut result = EmbeddingBatchResult {
        processed: 0,
        errors: Vec::new(),
    };

    for entity_id in entity_ids {
        // Get entity with observations
        let entity = match brain_get_entity(entity_id.clone()) {
            Ok(e) => e,
            Err(e) => {
                result.errors.push(format!("{}: {}", entity_id, e));
                continue;
            }
        };

        // Combine name + observations for embedding
        let mut text = entity.name.clone();
        for obs in entity.observations {
            text.push(' ');
            text.push_str(&obs.content);
        }

        // Generate placeholder embedding (384-dimensional zero vector)
        // In production, this would call an actual embedding model
        let embedding: Vec<f32> = vec![0.0; 384];

        // Serialize vector to bytes
        let vector_bytes: Vec<u8> = embedding.iter()
            .flat_map(|f| f.to_le_bytes())
            .collect();

        // Store embedding
        let emb_id = Uuid::new_v4().to_string();
        match conn.execute(
            "INSERT OR REPLACE INTO embeddings (id, entity_id, vector, model, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![emb_id, entity_id, vector_bytes, "placeholder", timestamp],
        ) {
            Ok(_) => result.processed += 1,
            Err(e) => result.errors.push(format!("{}: {}", entity_id, e)),
        }
    }

    Ok(result)
}

/// Generate embeddings for all entities without embeddings
#[tauri::command]
pub fn brain_generate_all_embeddings() -> Result<AllEmbeddingsResult, String> {
    // Get entities without embeddings
    let entity_ids = brain_get_entities_without_embeddings()?;
    let total = entity_ids.len();

    // Generate embeddings in batches
    let batch_result = brain_generate_embeddings_batch(entity_ids)?;

    Ok(AllEmbeddingsResult {
        total,
        processed: batch_result.processed,
        errors: batch_result.errors,
    })
}

// ============================================
// WikiLinks Parsing and Backlinks
// ============================================

/// Parsed WikiLink from markdown content
#[derive(Debug, Clone, Serialize)]
pub struct ParsedWikiLink {
    pub target_name: String,
    pub display_text: Option<String>,
}

/// Backlink result showing entities that link to a target
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BacklinkResult {
    pub target_name: String,
    pub backlinks: Vec<BacklinkEntry>,
    pub count: usize,
}

/// Single backlink entry
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BacklinkEntry {
    pub from_entity_id: String,
    pub from_entity_name: String,
    pub from_entity_type: String,
    pub created_at: i64,
}

/// Parse [[WikiLinks]] from markdown content
///
/// Supports two formats:
/// - [[NoteName]] - Simple link
/// - [[NoteName|Display Text]] - Link with custom display text
///
/// Returns a vector of parsed WikiLinks
pub fn parse_wikilinks(content: &str) -> Vec<ParsedWikiLink> {
    let mut links = Vec::new();

    // Regex pattern: [[target]] or [[target|display]]
    // Matches: [[ followed by any chars except ]] and |, optionally followed by | and display text, then ]]
    let re = Regex::new(r"\[\[([^\]|]+)(?:\|([^\]]+))?\]\]").unwrap();

    for cap in re.captures_iter(content) {
        let target_name = cap.get(1).map(|m| m.as_str().trim().to_string()).unwrap_or_default();
        let display_text = cap.get(2).map(|m| m.as_str().trim().to_string());

        if !target_name.is_empty() {
            links.push(ParsedWikiLink {
                target_name,
                display_text,
            });
        }
    }

    // Remove duplicates by target_name
    let mut seen = std::collections::HashSet::new();
    links.retain(|link| seen.insert(link.target_name.clone()));

    links
}

/// Store WikiLinks for an entity in the database
///
/// Clears existing WikiLinks for the entity and inserts new ones.
/// This is called during entity creation/update and markdown import.
pub fn store_wikilinks(entity_id: &str, wikilinks: &[ParsedWikiLink]) -> Result<usize, String> {
    let conn = get_connection()?;
    let timestamp = now();

    // Delete existing WikiLinks for this entity
    conn.execute(
        "DELETE FROM wikilinks WHERE from_entity_id = ?1",
        params![entity_id],
    )
    .map_err(|e| format!("Failed to delete existing wikilinks: {}", e))?;

    // Insert new WikiLinks
    let mut inserted = 0;
    for link in wikilinks {
        let link_id = Uuid::new_v4().to_string();

        conn.execute(
            "INSERT INTO wikilinks (id, from_entity_id, to_entity_name, created_at)
             VALUES (?1, ?2, ?3, ?4)",
            params![&link_id, entity_id, &link.target_name, timestamp],
        )
        .map_err(|e| format!("Failed to insert wikilink: {}", e))?;

        inserted += 1;
    }

    log::info!(
        "[WikiLinks] Stored {} wikilinks for entity {}",
        inserted,
        entity_id
    );

    Ok(inserted)
}

/// Extract and store WikiLinks from entity observations
///
/// Parses all observations for an entity and stores the extracted WikiLinks.
/// This should be called after creating or updating an entity.
pub fn extract_and_store_wikilinks_for_entity(entity_id: &str) -> Result<usize, String> {
    let conn = get_connection()?;

    // Get all observations for the entity
    let mut stmt = conn
        .prepare("SELECT content FROM observations WHERE entity_id = ?1")
        .map_err(|e| format!("Failed to prepare observations query: {}", e))?;

    let observations: Vec<String> = stmt
        .query_map(params![entity_id], |row| row.get(0))
        .map_err(|e| format!("Failed to query observations: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    // Parse WikiLinks from all observations
    let mut all_links = Vec::new();
    for content in observations {
        let links = parse_wikilinks(&content);
        all_links.extend(links);
    }

    // Also get entity name to check for self-links (we skip those)
    let entity_name: Option<String> = conn
        .query_row(
            "SELECT name FROM entities WHERE id = ?1",
            params![entity_id],
            |row| row.get(0),
        )
        .ok();

    // Filter out self-links
    if let Some(name) = entity_name {
        all_links.retain(|link| link.target_name.to_lowercase() != name.to_lowercase());
    }

    // Store the WikiLinks
    store_wikilinks(entity_id, &all_links)
}

/// Get backlinks for an entity name
///
/// Returns all entities that contain [[EntityName]] WikiLinks to the target.
/// This is useful for Obsidian-style graph navigation.
#[tauri::command]
pub fn brain_get_backlinks(entity_name: String) -> Result<BacklinkResult, String> {
    let conn = get_connection()?;

    // Query WikiLinks table for all links pointing to this entity name
    // Join with entities table to get full entity info
    let mut stmt = conn
        .prepare(
            "SELECT w.from_entity_id, e.name, e.entity_type, w.created_at
             FROM wikilinks w
             JOIN entities e ON w.from_entity_id = e.id
             WHERE LOWER(w.to_entity_name) = LOWER(?1)
             ORDER BY w.created_at DESC",
        )
        .map_err(|e| format!("Failed to prepare backlinks query: {}", e))?;

    let backlinks: Vec<BacklinkEntry> = stmt
        .query_map(params![&entity_name], |row| {
            Ok(BacklinkEntry {
                from_entity_id: row.get(0)?,
                from_entity_name: row.get(1)?,
                from_entity_type: row.get(2)?,
                created_at: row.get(3)?,
            })
        })
        .map_err(|e| format!("Failed to query backlinks: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    let count = backlinks.len();

    log::info!(
        "[WikiLinks] Found {} backlinks for entity '{}'",
        count,
        entity_name
    );

    Ok(BacklinkResult {
        target_name: entity_name,
        backlinks,
        count,
    })
}

/// Get all WikiLinks from an entity
///
/// Returns all entities that this entity links to via [[WikiLinks]].
#[tauri::command]
pub fn brain_get_wikilinks(entity_id: String) -> Result<Vec<WikiLink>, String> {
    let conn = get_connection()?;

    let mut stmt = conn
        .prepare(
            "SELECT id, from_entity_id, to_entity_name, created_at
             FROM wikilinks
             WHERE from_entity_id = ?1
             ORDER BY created_at ASC",
        )
        .map_err(|e| format!("Failed to prepare wikilinks query: {}", e))?;

    let wikilinks: Vec<WikiLink> = stmt
        .query_map(params![&entity_id], |row| {
            Ok(WikiLink {
                id: row.get(0)?,
                from_entity_id: row.get(1)?,
                to_entity_name: row.get(2)?,
                created_at: row.get(3)?,
            })
        })
        .map_err(|e| format!("Failed to query wikilinks: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(wikilinks)
}

/// Reprocess all entities to extract and store WikiLinks
///
/// This is a utility function to backfill WikiLinks for existing entities.
#[tauri::command]
pub fn brain_reprocess_all_wikilinks() -> Result<WikiLinkReprocessResult, String> {
    let conn = get_connection()?;

    // Get all entity IDs
    let mut stmt = conn
        .prepare("SELECT id FROM entities")
        .map_err(|e| format!("Failed to prepare entities query: {}", e))?;

    let entity_ids: Vec<String> = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| format!("Failed to query entities: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    drop(stmt);

    let total = entity_ids.len();
    let mut processed = 0;
    let mut total_links = 0;
    let mut errors = Vec::new();

    for entity_id in entity_ids {
        match extract_and_store_wikilinks_for_entity(&entity_id) {
            Ok(count) => {
                processed += 1;
                total_links += count;
            }
            Err(e) => {
                errors.push(format!("{}: {}", entity_id, e));
            }
        }
    }

    log::info!(
        "[WikiLinks] Reprocessed {} entities, found {} total links",
        processed,
        total_links
    );

    Ok(WikiLinkReprocessResult {
        total_entities: total,
        processed,
        total_links,
        errors,
    })
}

/// Result of WikiLink reprocessing
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WikiLinkReprocessResult {
    pub total_entities: usize,
    pub processed: usize,
    pub total_links: usize,
    pub errors: Vec<String>,
}
