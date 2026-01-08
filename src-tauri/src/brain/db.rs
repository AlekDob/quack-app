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

    // Enable WAL mode for better concurrent access (MCP server + Quack app)
    conn.execute_batch("PRAGMA journal_mode = WAL;")
        .map_err(|e| format!("Failed to set WAL mode: {}", e))?;

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

    // Helper to check if table exists
    let table_exists = |table: &str| -> bool {
        conn.prepare(&format!("SELECT 1 FROM {} LIMIT 0", table))
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

    // Migration 2: Add metadata columns to entities table (enhanced Obsidian sync)
    if !column_exists("entities", "source_file") {
        conn.execute("ALTER TABLE entities ADD COLUMN source_file TEXT", [])
            .map_err(|e| format!("Failed to add source_file column: {}", e))?;
        log::info!("Migration: Added source_file column to entities");
    }

    if !column_exists("entities", "date") {
        conn.execute("ALTER TABLE entities ADD COLUMN date TEXT", [])
            .map_err(|e| format!("Failed to add date column: {}", e))?;
        log::info!("Migration: Added date column to entities");
    }

    if !column_exists("entities", "daily_link") {
        conn.execute("ALTER TABLE entities ADD COLUMN daily_link TEXT", [])
            .map_err(|e| format!("Failed to add daily_link column: {}", e))?;
        log::info!("Migration: Added daily_link column to entities");
    }

    if !column_exists("entities", "author") {
        conn.execute("ALTER TABLE entities ADD COLUMN author TEXT", [])
            .map_err(|e| format!("Failed to add author column: {}", e))?;
        log::info!("Migration: Added author column to entities");
    }

    if !column_exists("entities", "status") {
        conn.execute("ALTER TABLE entities ADD COLUMN status TEXT DEFAULT 'active'", [])
            .map_err(|e| format!("Failed to add status column: {}", e))?;
        log::info!("Migration: Added status column to entities");
    }

    if !column_exists("entities", "confidence") {
        conn.execute("ALTER TABLE entities ADD COLUMN confidence TEXT DEFAULT 'high'", [])
            .map_err(|e| format!("Failed to add confidence column: {}", e))?;
        log::info!("Migration: Added confidence column to entities");
    }

    if !column_exists("entities", "aliases") {
        conn.execute("ALTER TABLE entities ADD COLUMN aliases TEXT", [])
            .map_err(|e| format!("Failed to add aliases column: {}", e))?;
        log::info!("Migration: Added aliases column to entities");
    }

    // Migration 3: Create wikilinks table for tracking [[wikilinks]] between entities
    if !table_exists("wikilinks") {
        conn.execute(
            "CREATE TABLE wikilinks (
                id TEXT PRIMARY KEY,
                from_entity_id TEXT NOT NULL,
                to_entity_name TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                FOREIGN KEY (from_entity_id) REFERENCES entities(id) ON DELETE CASCADE
            )",
            [],
        ).map_err(|e| format!("Failed to create wikilinks table: {}", e))?;

        // Create indexes for wikilinks
        conn.execute(
            "CREATE INDEX idx_wikilinks_from ON wikilinks(from_entity_id)",
            [],
        ).map_err(|e| format!("Failed to create wikilinks from index: {}", e))?;

        conn.execute(
            "CREATE INDEX idx_wikilinks_to ON wikilinks(to_entity_name)",
            [],
        ).map_err(|e| format!("Failed to create wikilinks to index: {}", e))?;

        log::info!("Migration: Created wikilinks table with indexes");
    }

    // Migration 4: Create brain_settings table
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

    // Migration 5: Create indexes for new columns
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_entities_vault_path ON entities(vault_relative_path)",
        [],
    ).map_err(|e| format!("Failed to create vault_relative_path index: {}", e))?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_entities_sync_source ON entities(sync_source)",
        [],
    ).map_err(|e| format!("Failed to create sync_source index: {}", e))?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_entities_date ON entities(date)",
        [],
    ).map_err(|e| format!("Failed to create date index: {}", e))?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_entities_author ON entities(author)",
        [],
    ).map_err(|e| format!("Failed to create author index: {}", e))?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_entities_status ON entities(status)",
        [],
    ).map_err(|e| format!("Failed to create status index: {}", e))?;

    log::info!("✅ Database migrations completed");

    Ok(())
}

/// Get a new database connection
pub fn get_connection() -> Result<Connection, String> {
    let db_path = get_db_path()?;
    let conn = Connection::open(&db_path)
        .map_err(|e| format!("Failed to open database connection: {}", e))?;

    // Enable WAL mode for better concurrent access with MCP server
    conn.execute_batch("PRAGMA journal_mode = WAL;")
        .map_err(|e| format!("Failed to set WAL mode: {}", e))?;

    Ok(conn)
}

/// Get the MCP server directory path
pub fn get_mcp_dir() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Could not determine home directory")?;
    Ok(home.join(".quack").join("mcp"))
}

/// Setup MCP Brain server for all users
/// This installs the brain-mcp-server.js and its dependencies to ~/.quack/mcp/
/// and runs npm rebuild to ensure native modules (like better-sqlite3) are compiled
/// for the user's Node.js version and architecture.
pub fn setup_mcp_server() -> Result<(), String> {
    let mcp_dir = get_mcp_dir()?;

    // Create MCP directory if it doesn't exist
    fs::create_dir_all(&mcp_dir)
        .map_err(|e| format!("Failed to create MCP directory: {}", e))?;

    let server_path = mcp_dir.join("brain-mcp-server.js");
    let package_json_path = mcp_dir.join("package.json");
    let mcp_config_path = mcp_dir.join(".mcp.json");

    // Check if already set up (skip if server exists and node_modules exists)
    let node_modules = mcp_dir.join("node_modules");
    if server_path.exists() && node_modules.exists() {
        log::info!("🧠 MCP Brain server already installed at {:?}", mcp_dir);
        return Ok(());
    }

    log::info!("🧠 Setting up MCP Brain server at {:?}", mcp_dir);

    // Embedded brain-mcp-server.js content
    // This is included at compile time from the node-sdk directory
    let server_script = include_str!("../../node-sdk/brain-mcp-server.js");

    // Write the server script
    fs::write(&server_path, server_script)
        .map_err(|e| format!("Failed to write brain-mcp-server.js: {}", e))?;

    // Make it executable on Unix
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(&server_path)
            .map_err(|e| format!("Failed to get file metadata: {}", e))?
            .permissions();
        perms.set_mode(0o755);
        fs::set_permissions(&server_path, perms)
            .map_err(|e| format!("Failed to set permissions: {}", e))?;
    }

    // Create package.json with dependencies
    let package_json = r#"{
  "name": "quack-brain-mcp",
  "version": "1.0.0",
  "type": "module",
  "description": "Quack Brain MCP Server - Global knowledge graph for Claude Code",
  "main": "brain-mcp-server.js",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "better-sqlite3": "^11.0.0"
  },
  "scripts": {
    "postinstall": "npm rebuild better-sqlite3"
  }
}
"#;

    fs::write(&package_json_path, package_json)
        .map_err(|e| format!("Failed to write package.json: {}", e))?;

    // Create .mcp.json configuration
    let mcp_config = format!(r#"{{
  "mcpServers": {{
    "brain": {{
      "type": "stdio",
      "command": "node",
      "args": [
        "{}"
      ],
      "description": "Quack Brain - Unified knowledge graph for memories, patterns, and decisions"
    }}
  }}
}}
"#, server_path.display().to_string().replace('\\', "/"));

    fs::write(&mcp_config_path, mcp_config)
        .map_err(|e| format!("Failed to write .mcp.json: {}", e))?;

    // Run npm install in the MCP directory
    log::info!("📦 Running npm install in {:?}", mcp_dir);

    let npm_install = std::process::Command::new("npm")
        .arg("install")
        .current_dir(&mcp_dir)
        .output();

    match npm_install {
        Ok(output) => {
            if output.status.success() {
                log::info!("✅ npm install completed successfully");
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                log::warn!("⚠️ npm install had issues: {}", stderr);
            }
        }
        Err(e) => {
            log::warn!("⚠️ Could not run npm install: {}. User may need to run it manually.", e);
        }
    }

    // Run npm rebuild better-sqlite3 to ensure native module is compiled correctly
    log::info!("🔧 Running npm rebuild better-sqlite3 in {:?}", mcp_dir);

    let npm_rebuild = std::process::Command::new("npm")
        .args(["rebuild", "better-sqlite3"])
        .current_dir(&mcp_dir)
        .output();

    match npm_rebuild {
        Ok(output) => {
            if output.status.success() {
                log::info!("✅ npm rebuild better-sqlite3 completed successfully");
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                log::warn!("⚠️ npm rebuild better-sqlite3 had issues: {}", stderr);
            }
        }
        Err(e) => {
            log::warn!("⚠️ Could not run npm rebuild: {}. User may need to run it manually.", e);
        }
    }

    log::info!("🧠 MCP Brain server setup completed at {:?}", mcp_dir);

    Ok(())
}
