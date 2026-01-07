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

    Ok(BrainEntity {
        id: entity_id,
        name: input.name,
        entity_type: input.entity_type,
        observations,
        project_id: input.project_id,
        created_at: timestamp,
        updated_at: timestamp,
        md_file_path: None,
    })
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
            "SELECT id, name, entity_type, created_at, updated_at, project_id, md_file_path
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

    Ok(BrainEntity {
        id: entity.0,
        name: entity.1,
        entity_type: entity.2,
        created_at: entity.3,
        updated_at: entity.4,
        project_id: entity.5,
        md_file_path: entity.6,
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

/// Get markdown directory path
fn get_markdown_dir() -> Result<std::path::PathBuf, String> {
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    let md_dir = home.join(".quack").join("brain").join("markdown");
    std::fs::create_dir_all(&md_dir).map_err(|e| format!("Failed to create markdown dir: {}", e))?;
    Ok(md_dir)
}

/// Generate markdown content for an entity
fn entity_to_markdown(entity: &BrainEntity) -> String {
    let mut md = String::new();

    // YAML frontmatter
    md.push_str("---\n");
    md.push_str(&format!("id: \"{}\"\n", entity.id));
    md.push_str(&format!("type: {}\n", entity.entity_type));
    if let Some(ref project_id) = entity.project_id {
        md.push_str(&format!("project: \"{}\"\n", project_id));
    }
    md.push_str(&format!("created: {}\n", entity.created_at));
    md.push_str(&format!("updated: {}\n", entity.updated_at));
    md.push_str("---\n\n");

    // Title
    md.push_str(&format!("# {}\n\n", entity.name));

    // Type badge
    md.push_str(&format!("**Type:** `#{}`\n\n", entity.entity_type));

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

/// Sync a single entity to markdown file
#[tauri::command]
pub fn brain_sync_entity_to_md(entity_id: String) -> Result<String, String> {
    let conn = get_connection()?;
    let md_dir = get_markdown_dir()?;

    // Get entity with observations
    let entity: BrainEntity = conn.query_row(
        "SELECT id, name, entity_type, project_id, created_at, updated_at, md_file_path FROM entities WHERE id = ?1",
        [&entity_id],
        |row| {
            Ok(BrainEntity {
                id: row.get(0)?,
                name: row.get(1)?,
                entity_type: row.get(2)?,
                project_id: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
                md_file_path: row.get(6)?,
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

    // Determine file path
    let file_path = if let Some(ref project_id) = entity.project_id {
        let project_dir = md_dir.join("projects").join(slugify(project_id));
        std::fs::create_dir_all(&project_dir).map_err(|e| format!("Dir error: {}", e))?;
        project_dir.join(format!("{}.md", slugify(&entity.name)))
    } else {
        let type_dir = md_dir.join("global").join(slugify(&entity.entity_type));
        std::fs::create_dir_all(&type_dir).map_err(|e| format!("Dir error: {}", e))?;
        type_dir.join(format!("{}.md", slugify(&entity.name)))
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

    // Get all entity IDs with their data
    let mut stmt = conn.prepare(
        "SELECT id, name, entity_type, project_id, created_at, updated_at, md_file_path FROM entities"
    ).map_err(|e| format!("Query error: {}", e))?;

    let entities: Vec<(String, String, String, Option<String>, i64, i64, Option<String>)> = stmt.query_map([], |row| {
        Ok((
            row.get(0)?,
            row.get(1)?,
            row.get(2)?,
            row.get(3)?,
            row.get(4)?,
            row.get(5)?,
            row.get(6)?,
        ))
    })
    .map_err(|e| format!("Query error: {}", e))?
    .filter_map(|r| r.ok())
    .collect();

    drop(stmt);

    for (entity_id, name, entity_type, project_id, created_at, updated_at, existing_path) in entities {
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

        let entity = BrainEntity {
            id: entity_id.clone(),
            name: name.clone(),
            entity_type: entity_type.clone(),
            project_id: project_id.clone(),
            created_at,
            updated_at,
            md_file_path: existing_path.clone(),
            observations,
        };

        // Determine file path
        let file_path = if let Some(ref proj_id) = project_id {
            let project_dir = md_dir.join("projects").join(slugify(proj_id));
            if let Err(e) = std::fs::create_dir_all(&project_dir) {
                result.errors.push(format!("{}: Dir error: {}", entity_id, e));
                continue;
            }
            project_dir.join(format!("{}.md", slugify(&name)))
        } else {
            let type_dir = md_dir.join("global").join(slugify(&entity_type));
            if let Err(e) = std::fs::create_dir_all(&type_dir) {
                result.errors.push(format!("{}: Dir error: {}", entity_id, e));
                continue;
            }
            type_dir.join(format!("{}.md", slugify(&name)))
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
