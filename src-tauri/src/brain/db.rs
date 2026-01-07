use rusqlite::Connection;
use std::path::PathBuf;
use std::fs;

/// Get the path to the Quack Brain database
fn get_db_path() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Could not determine home directory")?;
    let quack_dir = home.join(".quack").join("brain");

    // Create directory if it doesn't exist
    fs::create_dir_all(&quack_dir)
        .map_err(|e| format!("Failed to create .quack/brain directory: {}", e))?;

    Ok(quack_dir.join("brain.db"))
}

/// Initialize the database connection and create tables if needed
pub fn init_database() -> Result<Connection, String> {
    let db_path = get_db_path()?;
    let conn = Connection::open(&db_path)
        .map_err(|e| format!("Failed to open database at {:?}: {}", db_path, e))?;

    create_schema(&conn)?;

    log::info!("🧠 Quack Brain database initialized at {:?}", db_path);

    Ok(conn)
}

/// Create the database schema
fn create_schema(conn: &Connection) -> Result<(), String> {
    // Core entities table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS entities (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            entity_type TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            project_id TEXT,
            md_file_path TEXT
        )",
        [],
    ).map_err(|e| format!("Failed to create entities table: {}", e))?;

    // Run migrations for new columns (Obsidian sync support)
    run_migrations(conn)?;

    // Observations table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS observations (
            id TEXT PRIMARY KEY,
            entity_id TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
        )",
        [],
    ).map_err(|e| format!("Failed to create observations table: {}", e))?;

    // Relations table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS relations (
            id TEXT PRIMARY KEY,
            from_entity_id TEXT NOT NULL,
            to_entity_id TEXT NOT NULL,
            relation_type TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (from_entity_id) REFERENCES entities(id) ON DELETE CASCADE,
            FOREIGN KEY (to_entity_id) REFERENCES entities(id) ON DELETE CASCADE
        )",
        [],
    ).map_err(|e| format!("Failed to create relations table: {}", e))?;

    // Projects registry table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            path TEXT NOT NULL UNIQUE,
            created_at INTEGER NOT NULL,
            last_accessed_at INTEGER NOT NULL
        )",
        [],
    ).map_err(|e| format!("Failed to create projects table: {}", e))?;

    // Full-text search virtual table
    conn.execute(
        "CREATE VIRTUAL TABLE IF NOT EXISTS entities_fts USING fts5(
            name,
            content,
            content='entities',
            content_rowid='rowid'
        )",
        [],
    ).map_err(|e| format!("Failed to create FTS5 table: {}", e))?;

    // Vector embeddings table (for future semantic search)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS embeddings (
            id TEXT PRIMARY KEY,
            entity_id TEXT NOT NULL UNIQUE,
            vector BLOB NOT NULL,
            model TEXT NOT NULL DEFAULT 'all-MiniLM-L6-v2',
            created_at INTEGER NOT NULL,
            FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
        )",
        [],
    ).map_err(|e| format!("Failed to create embeddings table: {}", e))?;

    // Create indexes for better query performance
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(entity_type)",
        [],
    ).map_err(|e| format!("Failed to create entity type index: {}", e))?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_entities_project ON entities(project_id)",
        [],
    ).map_err(|e| format!("Failed to create entity project index: {}", e))?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_observations_entity ON observations(entity_id)",
        [],
    ).map_err(|e| format!("Failed to create observations entity index: {}", e))?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_relations_from ON relations(from_entity_id)",
        [],
    ).map_err(|e| format!("Failed to create relations from index: {}", e))?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_relations_to ON relations(to_entity_id)",
        [],
    ).map_err(|e| format!("Failed to create relations to index: {}", e))?;

    // Create triggers for FTS5 automatic sync
    conn.execute(
        "CREATE TRIGGER IF NOT EXISTS entities_ai AFTER INSERT ON entities BEGIN
            INSERT INTO entities_fts(rowid, name, content)
            VALUES (new.rowid, new.name, '');
        END",
        [],
    ).map_err(|e| format!("Failed to create FTS insert trigger: {}", e))?;

    conn.execute(
        "CREATE TRIGGER IF NOT EXISTS entities_ad AFTER DELETE ON entities BEGIN
            INSERT INTO entities_fts(entities_fts, rowid, name, content)
            VALUES ('delete', old.rowid, old.name, '');
        END",
        [],
    ).map_err(|e| format!("Failed to create FTS delete trigger: {}", e))?;

    conn.execute(
        "CREATE TRIGGER IF NOT EXISTS entities_au AFTER UPDATE ON entities BEGIN
            INSERT INTO entities_fts(entities_fts, rowid, name, content)
            VALUES ('delete', old.rowid, old.name, '');
            INSERT INTO entities_fts(rowid, name, content)
            VALUES (new.rowid, new.name, '');
        END",
        [],
    ).map_err(|e| format!("Failed to create FTS update trigger: {}", e))?;

    log::info!("✅ Database schema created successfully");

    Ok(())
}

/// Run database migrations for schema updates
fn run_migrations(conn: &Connection) -> Result<(), String> {
    // Helper to check if column exists
    let column_exists = |table: &str, column: &str| -> bool {
        conn.prepare(&format!("SELECT {} FROM {} LIMIT 0", column, table))
            .is_ok()
    };

    // Migration 1: Add sync columns to entities table (Obsidian sync support)
    if !column_exists("entities", "sync_hash") {
        conn.execute("ALTER TABLE entities ADD COLUMN sync_hash TEXT", [])
            .map_err(|e| format!("Failed to add sync_hash column: {}", e))?;
        log::info!("Migration: Added sync_hash column to entities");
    }

    if !column_exists("entities", "last_synced_at") {
        conn.execute("ALTER TABLE entities ADD COLUMN last_synced_at INTEGER", [])
            .map_err(|e| format!("Failed to add last_synced_at column: {}", e))?;
        log::info!("Migration: Added last_synced_at column to entities");
    }

    if !column_exists("entities", "sync_source") {
        conn.execute("ALTER TABLE entities ADD COLUMN sync_source TEXT", [])
            .map_err(|e| format!("Failed to add sync_source column: {}", e))?;
        log::info!("Migration: Added sync_source column to entities");
    }

    if !column_exists("entities", "vault_relative_path") {
        conn.execute("ALTER TABLE entities ADD COLUMN vault_relative_path TEXT", [])
            .map_err(|e| format!("Failed to add vault_relative_path column: {}", e))?;
        log::info!("Migration: Added vault_relative_path column to entities");
    }

    // Migration 2: Create brain_settings table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS brain_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at INTEGER NOT NULL
        )",
        [],
    ).map_err(|e| format!("Failed to create brain_settings table: {}", e))?;

    // Insert default settings if not exist
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;

    let default_settings = [
        ("vault_path", ""),
        ("sync_enabled", "false"),
        ("sync_structure", "subfolder"),
        ("auto_sync_to_vault", "true"),
        ("auto_sync_from_vault", "true"),
        ("conflict_policy", "ask"),
        ("auto_embed", "true"),
        ("markdown_editor", "obsidian"),
    ];

    for (key, value) in default_settings {
        conn.execute(
            "INSERT OR IGNORE INTO brain_settings (key, value, updated_at) VALUES (?1, ?2, ?3)",
            rusqlite::params![key, value, now],
        ).map_err(|e| format!("Failed to insert default setting {}: {}", key, e))?;
    }

    // Create index on vault_relative_path for faster lookups
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_entities_vault_path ON entities(vault_relative_path)",
        [],
    ).map_err(|e| format!("Failed to create vault_relative_path index: {}", e))?;

    // Create index on sync_source for filtering
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_entities_sync_source ON entities(sync_source)",
        [],
    ).map_err(|e| format!("Failed to create sync_source index: {}", e))?;

    log::info!("✅ Database migrations completed");

    Ok(())
}

/// Get a new database connection
pub fn get_connection() -> Result<Connection, String> {
    let db_path = get_db_path()?;
    Connection::open(&db_path)
        .map_err(|e| format!("Failed to open database connection: {}", e))
}
