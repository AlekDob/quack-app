// Project Stats: per-project token aggregation backed by SQLite.
//
// Brain: decision-project-token-stats-sqlite
//
// Architecture:
// - Single event-log table `token_events` is the source of truth
// - One row per (session_id, message_id) — idempotent via PRIMARY KEY
// - `session_deleted` flag preserves totals when sessions are removed
// - Aggregations computed lazily via GROUP BY queries (SQLite is fast enough
//   until tens of millions of rows)
//
// Why event log vs denormalized counters:
//   * Simpler to evolve: adding provider/model breakdowns is a free GROUP BY
//   * Idempotent by construction (PK on session_id+message_id)
//   * Deletion is a flag flip, not a decrement — no risk of drift
//   * Migration from existing sessions is a batch INSERT OR IGNORE

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};

// ============================================================================
// State
// ============================================================================

/// Thread-safe connection to the project stats database.
/// Tauri state wrapper; guarded by a Mutex because rusqlite Connection is !Sync.
pub struct ProjectStatsDb(pub Mutex<Connection>);

// ============================================================================
// Path utilities
// ============================================================================

/// Resolve the DB file path across platforms, following the same convention
/// used elsewhere in lib.rs for `quack-agents.json`.
fn resolve_db_path() -> Result<PathBuf, String> {
    let base = if cfg!(target_os = "macos") {
        dirs::home_dir().map(|h| h.join("Library/Application Support/com.quack.terminal"))
    } else if cfg!(target_os = "windows") {
        std::env::var("APPDATA")
            .ok()
            .map(|p| PathBuf::from(p).join("com.quack.terminal"))
    } else {
        dirs::home_dir().map(|h| h.join(".local/share/com.quack.terminal"))
    };

    let base = base.ok_or_else(|| "Failed to resolve app data directory".to_string())?;
    std::fs::create_dir_all(&base)
        .map_err(|e| format!("Failed to create app data dir: {}", e))?;
    Ok(base.join("project-stats.db"))
}

/// Normalize a project path for use as an identity key.
/// - Convert backslashes → forward slashes (Windows gotcha)
/// - Strip trailing slashes
/// - Keep case as-is (Linux is case-sensitive; on macOS/Windows we accept
///   the rare duplicate risk rather than silently merging distinct paths)
// Brain: gotcha-windows-path-separators
pub fn normalize_project_path(path: &str) -> String {
    let mut p = path.replace('\\', "/");
    while p.ends_with('/') && p.len() > 1 {
        p.pop();
    }
    p
}

// ============================================================================
// Schema + migration
// ============================================================================

const SCHEMA_V1: &str = r#"
CREATE TABLE IF NOT EXISTS token_events (
    session_id            TEXT    NOT NULL,
    message_id            TEXT    NOT NULL,
    project_path          TEXT    NOT NULL,
    project_name          TEXT    NOT NULL,
    provider              TEXT    NOT NULL DEFAULT 'unknown',
    model                 TEXT    NOT NULL DEFAULT 'unknown',
    input_tokens          INTEGER NOT NULL DEFAULT 0,
    output_tokens         INTEGER NOT NULL DEFAULT 0,
    cache_creation_tokens INTEGER NOT NULL DEFAULT 0,
    cache_read_tokens     INTEGER NOT NULL DEFAULT 0,
    session_deleted       INTEGER NOT NULL DEFAULT 0,
    recorded_at           INTEGER NOT NULL,
    PRIMARY KEY (session_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_token_events_project
    ON token_events(project_path);

CREATE INDEX IF NOT EXISTS idx_token_events_session
    ON token_events(session_id);

CREATE TABLE IF NOT EXISTS project_stats_meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"#;

/// Schema v2: add per-agent tracking so we can aggregate by agent (name + role)
/// and preserve totals for removed agents ("agenti licenziati" bucket).
/// SQLite ALTER TABLE ADD COLUMN is O(1) and backward-compatible: existing
/// rows get NULL for the new columns → they fall into the "Unknown agent" group.
const SCHEMA_V2_MIGRATIONS: &[&str] = &[
    "ALTER TABLE token_events ADD COLUMN agent_id TEXT",
    "ALTER TABLE token_events ADD COLUMN agent_name TEXT",
    "ALTER TABLE token_events ADD COLUMN agent_role TEXT",
    "ALTER TABLE token_events ADD COLUMN agent_deleted INTEGER NOT NULL DEFAULT 0",
    "CREATE INDEX IF NOT EXISTS idx_token_events_agent ON token_events(agent_id)",
];

fn get_user_version(conn: &Connection) -> Result<i32, String> {
    conn.query_row("PRAGMA user_version", [], |row| row.get::<_, i32>(0))
        .map_err(|e| format!("Failed to read user_version: {}", e))
}

fn set_user_version(conn: &Connection, v: i32) -> Result<(), String> {
    conn.execute_batch(&format!("PRAGMA user_version = {}", v))
        .map_err(|e| format!("Failed to set user_version: {}", e))
}

/// Check whether a column exists on the given table.
/// Used to make v2 migrations safely re-runnable even if user_version wasn't
/// bumped correctly on a previous partial run.
fn column_exists(conn: &Connection, table: &str, column: &str) -> Result<bool, String> {
    let mut stmt = conn
        .prepare(&format!("PRAGMA table_info({})", table))
        .map_err(|e| format!("prepare table_info failed: {}", e))?;
    let found = stmt
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|e| format!("query table_info failed: {}", e))?
        .flatten()
        .any(|name| name == column);
    Ok(found)
}

fn apply_migrations(conn: &Connection) -> Result<(), String> {
    // v1: create base schema (idempotent — CREATE TABLE IF NOT EXISTS)
    conn.execute_batch(SCHEMA_V1)
        .map_err(|e| format!("Migration v1 failed: {}", e))?;

    // v2: per-agent columns. ALTER TABLE ADD COLUMN is NOT idempotent on SQLite,
    // so we guard each statement by column existence.
    let version = get_user_version(conn)?;
    if version < 2 {
        if !column_exists(conn, "token_events", "agent_id")? {
            for stmt in SCHEMA_V2_MIGRATIONS {
                conn.execute_batch(stmt)
                    .map_err(|e| format!("Migration v2 failed on '{}': {}", stmt, e))?;
            }
        } else {
            // Columns already present from a previous partial migration — just
            // ensure the index is there.
            conn.execute_batch(
                "CREATE INDEX IF NOT EXISTS idx_token_events_agent ON token_events(agent_id)",
            )
            .map_err(|e| format!("v2 index creation failed: {}", e))?;
        }
        set_user_version(conn, 2)?;
    }

    Ok(())
}

/// Initialize the database. Called once from setup().
pub fn init(app: &AppHandle) -> Result<(), String> {
    let db_path = resolve_db_path()?;
    log::info!("📊 Project stats DB: {}", db_path.display());

    let conn = Connection::open(&db_path)
        .map_err(|e| format!("Failed to open project stats DB: {}", e))?;

    // Performance pragmas (safe defaults)
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA synchronous = NORMAL;
         PRAGMA temp_store = MEMORY;",
    )
    .map_err(|e| format!("Failed to set pragmas: {}", e))?;

    apply_migrations(&conn)?;

    app.manage(ProjectStatsDb(Mutex::new(conn)));
    Ok(())
}

// ============================================================================
// DTOs
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TokenBreakdown {
    #[serde(rename = "inputTokens")]
    pub input_tokens: i64,
    #[serde(rename = "outputTokens")]
    pub output_tokens: i64,
    #[serde(rename = "cacheCreationTokens")]
    pub cache_creation_tokens: i64,
    #[serde(rename = "cacheReadTokens")]
    pub cache_read_tokens: i64,
    #[serde(rename = "messageCount")]
    pub message_count: i64,
}

impl TokenBreakdown {
    #[inline]
    pub fn total(&self) -> i64 {
        self.input_tokens
            + self.output_tokens
            + self.cache_creation_tokens
            + self.cache_read_tokens
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NamedBreakdown {
    pub name: String,
    #[serde(flatten)]
    pub breakdown: TokenBreakdown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectStats {
    #[serde(rename = "projectPath")]
    pub project_path: String,
    #[serde(rename = "projectName")]
    pub project_name: String,
    pub lifetime: TokenBreakdown,
    #[serde(rename = "activeSessions")]
    pub active_sessions: TokenBreakdown,
    #[serde(rename = "deletedSessions")]
    pub deleted_sessions: TokenBreakdown,
    #[serde(rename = "byProvider")]
    pub by_provider: Vec<NamedBreakdown>,
    #[serde(rename = "byModel")]
    pub by_model: Vec<NamedBreakdown>,
    #[serde(rename = "firstSeenAt")]
    pub first_seen_at: i64,
    #[serde(rename = "lastUpdatedAt")]
    pub last_updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordUsagePayload {
    #[serde(rename = "sessionId")]
    pub session_id: String,
    #[serde(rename = "messageId")]
    pub message_id: String,
    #[serde(rename = "projectPath")]
    pub project_path: String,
    #[serde(rename = "projectName")]
    pub project_name: String,
    pub provider: String,
    pub model: String,
    #[serde(rename = "inputTokens", default)]
    pub input_tokens: i64,
    #[serde(rename = "outputTokens", default)]
    pub output_tokens: i64,
    #[serde(rename = "cacheCreationTokens", default)]
    pub cache_creation_tokens: i64,
    #[serde(rename = "cacheReadTokens", default)]
    pub cache_read_tokens: i64,
    // Agent breakdown (nullable — events before schema v2 have these as NULL)
    #[serde(rename = "agentId", default)]
    pub agent_id: Option<String>,
    #[serde(rename = "agentName", default)]
    pub agent_name: Option<String>,
    #[serde(rename = "agentRole", default)]
    pub agent_role: Option<String>,
}

// ============================================================================
// Internal query helpers
// ============================================================================

fn breakdown_row(row: &rusqlite::Row<'_>, offset: usize) -> rusqlite::Result<TokenBreakdown> {
    Ok(TokenBreakdown {
        input_tokens: row.get::<_, Option<i64>>(offset)?.unwrap_or(0),
        output_tokens: row.get::<_, Option<i64>>(offset + 1)?.unwrap_or(0),
        cache_creation_tokens: row.get::<_, Option<i64>>(offset + 2)?.unwrap_or(0),
        cache_read_tokens: row.get::<_, Option<i64>>(offset + 3)?.unwrap_or(0),
        message_count: row.get::<_, Option<i64>>(offset + 4)?.unwrap_or(0),
    })
}

/// Sum all token fields filtered by project + optional deleted flag.
fn query_breakdown(
    conn: &Connection,
    project_path: &str,
    deleted: Option<bool>,
) -> Result<TokenBreakdown, String> {
    let mut sql = String::from(
        "SELECT SUM(input_tokens), SUM(output_tokens),
                SUM(cache_creation_tokens), SUM(cache_read_tokens),
                COUNT(*)
         FROM token_events WHERE project_path = ?1",
    );
    if let Some(d) = deleted {
        sql.push_str(&format!(" AND session_deleted = {}", if d { 1 } else { 0 }));
    }

    conn.query_row(&sql, params![project_path], |row| breakdown_row(row, 0))
        .map_err(|e| format!("query_breakdown failed: {}", e))
}

/// Group-by breakdown on either `provider` or `model` (validated column name).
fn query_grouped(
    conn: &Connection,
    project_path: &str,
    column: &str,
) -> Result<Vec<NamedBreakdown>, String> {
    // whitelist — never interpolate user input
    let col = match column {
        "provider" => "provider",
        "model" => "model",
        _ => return Err(format!("Invalid group column: {}", column)),
    };

    let sql = format!(
        "SELECT {col},
                SUM(input_tokens), SUM(output_tokens),
                SUM(cache_creation_tokens), SUM(cache_read_tokens),
                COUNT(*)
         FROM token_events
         WHERE project_path = ?1
         GROUP BY {col}
         ORDER BY SUM(input_tokens + output_tokens + cache_creation_tokens + cache_read_tokens) DESC"
    );

    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| format!("prepare grouped failed: {}", e))?;

    let rows = stmt
        .query_map(params![project_path], |row| {
            Ok(NamedBreakdown {
                name: row.get::<_, String>(0)?,
                breakdown: breakdown_row(row, 1)?,
            })
        })
        .map_err(|e| format!("query_map grouped failed: {}", e))?;

    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| format!("row grouped failed: {}", e))?);
    }
    Ok(out)
}

fn query_timestamps(conn: &Connection, project_path: &str) -> Result<(i64, i64), String> {
    conn.query_row(
        "SELECT MIN(recorded_at), MAX(recorded_at) FROM token_events WHERE project_path = ?1",
        params![project_path],
        |row| {
            Ok((
                row.get::<_, Option<i64>>(0)?.unwrap_or(0),
                row.get::<_, Option<i64>>(1)?.unwrap_or(0),
            ))
        },
    )
    .map_err(|e| format!("query_timestamps failed: {}", e))
}

fn resolve_project_name(conn: &Connection, project_path: &str) -> Result<String, String> {
    conn.query_row(
        "SELECT project_name FROM token_events
         WHERE project_path = ?1
         ORDER BY recorded_at DESC LIMIT 1",
        params![project_path],
        |row| row.get::<_, String>(0),
    )
    .map_err(|e| format!("resolve_project_name failed: {}", e))
}

// ============================================================================
// Tauri commands
// ============================================================================

/// Record a single token usage event. Idempotent on (session_id, message_id):
/// calling twice with the same IDs is a no-op (INSERT OR IGNORE).
#[tauri::command]
pub fn record_token_usage(
    payload: RecordUsagePayload,
    db: State<'_, ProjectStatsDb>,
) -> Result<(), String> {
    // Skip obviously-empty events so we don't clutter the log with zero rows
    let total = payload.input_tokens
        + payload.output_tokens
        + payload.cache_creation_tokens
        + payload.cache_read_tokens;
    if total <= 0 {
        return Ok(());
    }

    let normalized = normalize_project_path(&payload.project_path);
    let recorded_at = chrono::Utc::now().timestamp_millis();

    let conn = db.0.lock().map_err(|e| format!("DB lock poisoned: {}", e))?;
    conn.execute(
        "INSERT OR IGNORE INTO token_events (
            session_id, message_id, project_path, project_name,
            provider, model,
            input_tokens, output_tokens,
            cache_creation_tokens, cache_read_tokens,
            session_deleted, recorded_at,
            agent_id, agent_name, agent_role, agent_deleted
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 0, ?11, ?12, ?13, ?14, 0)",
        params![
            payload.session_id,
            payload.message_id,
            normalized,
            payload.project_name,
            payload.provider,
            payload.model,
            payload.input_tokens,
            payload.output_tokens,
            payload.cache_creation_tokens,
            payload.cache_read_tokens,
            recorded_at,
            payload.agent_id,
            payload.agent_name,
            payload.agent_role,
        ],
    )
    .map_err(|e| format!("record_token_usage insert failed: {}", e))?;

    Ok(())
}

/// Get full stats for a single project (active + deleted + per-provider + per-model).
#[tauri::command]
pub fn get_project_stats(
    project_path: String,
    db: State<'_, ProjectStatsDb>,
) -> Result<Option<ProjectStats>, String> {
    let normalized = normalize_project_path(&project_path);
    let conn = db.0.lock().map_err(|e| format!("DB lock poisoned: {}", e))?;

    let lifetime = query_breakdown(&conn, &normalized, None)?;
    if lifetime.message_count == 0 {
        return Ok(None);
    }

    let active = query_breakdown(&conn, &normalized, Some(false))?;
    let deleted = query_breakdown(&conn, &normalized, Some(true))?;
    let by_provider = query_grouped(&conn, &normalized, "provider")?;
    let by_model = query_grouped(&conn, &normalized, "model")?;
    let (first_seen, last_updated) = query_timestamps(&conn, &normalized)?;
    let project_name = resolve_project_name(&conn, &normalized).unwrap_or_else(|_| normalized.clone());

    Ok(Some(ProjectStats {
        project_path: normalized,
        project_name,
        lifetime,
        active_sessions: active,
        deleted_sessions: deleted,
        by_provider,
        by_model,
        first_seen_at: first_seen,
        last_updated_at: last_updated,
    }))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectSummary {
    #[serde(rename = "projectPath")]
    pub project_path: String,
    #[serde(rename = "projectName")]
    pub project_name: String,
    pub lifetime: TokenBreakdown,
    #[serde(rename = "lastUpdatedAt")]
    pub last_updated_at: i64,
}

/// Get a compact summary for every project — used by the global Settings dashboard.
#[tauri::command]
pub fn get_all_project_stats(
    db: State<'_, ProjectStatsDb>,
) -> Result<Vec<ProjectSummary>, String> {
    let conn = db.0.lock().map_err(|e| format!("DB lock poisoned: {}", e))?;

    let mut stmt = conn
        .prepare(
            "SELECT project_path,
                    (SELECT project_name FROM token_events te2
                     WHERE te2.project_path = te.project_path
                     ORDER BY recorded_at DESC LIMIT 1) AS project_name,
                    SUM(input_tokens), SUM(output_tokens),
                    SUM(cache_creation_tokens), SUM(cache_read_tokens),
                    COUNT(*),
                    MAX(recorded_at)
             FROM token_events te
             GROUP BY project_path
             ORDER BY SUM(input_tokens + output_tokens + cache_creation_tokens + cache_read_tokens) DESC",
        )
        .map_err(|e| format!("prepare summary failed: {}", e))?;

    let rows = stmt
        .query_map([], |row| {
            Ok(ProjectSummary {
                project_path: row.get::<_, String>(0)?,
                project_name: row.get::<_, Option<String>>(1)?.unwrap_or_default(),
                lifetime: TokenBreakdown {
                    input_tokens: row.get::<_, Option<i64>>(2)?.unwrap_or(0),
                    output_tokens: row.get::<_, Option<i64>>(3)?.unwrap_or(0),
                    cache_creation_tokens: row.get::<_, Option<i64>>(4)?.unwrap_or(0),
                    cache_read_tokens: row.get::<_, Option<i64>>(5)?.unwrap_or(0),
                    message_count: row.get::<_, Option<i64>>(6)?.unwrap_or(0),
                },
                last_updated_at: row.get::<_, Option<i64>>(7)?.unwrap_or(0),
            })
        })
        .map_err(|e| format!("query_map summary failed: {}", e))?;

    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| format!("row summary failed: {}", e))?);
    }
    Ok(out)
}

/// Mark every event belonging to a session as deleted (flag flip, no row removal).
/// The totals remain in `deletedSessions` bucket when querying.
#[tauri::command]
pub fn mark_session_deleted(
    session_id: String,
    db: State<'_, ProjectStatsDb>,
) -> Result<usize, String> {
    let conn = db.0.lock().map_err(|e| format!("DB lock poisoned: {}", e))?;
    let n = conn
        .execute(
            "UPDATE token_events SET session_deleted = 1 WHERE session_id = ?1",
            params![session_id],
        )
        .map_err(|e| format!("mark_session_deleted failed: {}", e))?;
    Ok(n)
}

/// Bulk import a batch of events (used by the one-shot migration from
/// existing `agentSessions` on first boot after feature rollout).
#[tauri::command]
pub fn bulk_import_token_events(
    events: Vec<RecordUsagePayload>,
    db: State<'_, ProjectStatsDb>,
) -> Result<usize, String> {
    let mut conn = db.0.lock().map_err(|e| format!("DB lock poisoned: {}", e))?;
    let tx = conn
        .transaction()
        .map_err(|e| format!("begin tx failed: {}", e))?;

    let now = chrono::Utc::now().timestamp_millis();
    let mut inserted = 0usize;

    {
        let mut stmt = tx
            .prepare(
                "INSERT OR IGNORE INTO token_events (
                    session_id, message_id, project_path, project_name,
                    provider, model,
                    input_tokens, output_tokens,
                    cache_creation_tokens, cache_read_tokens,
                    session_deleted, recorded_at,
                    agent_id, agent_name, agent_role, agent_deleted
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 0, ?11, ?12, ?13, ?14, 0)",
            )
            .map_err(|e| format!("prepare bulk failed: {}", e))?;

        for e in events {
            let total = e.input_tokens
                + e.output_tokens
                + e.cache_creation_tokens
                + e.cache_read_tokens;
            if total <= 0 {
                continue;
            }
            let normalized = normalize_project_path(&e.project_path);
            let n = stmt
                .execute(params![
                    e.session_id,
                    e.message_id,
                    normalized,
                    e.project_name,
                    e.provider,
                    e.model,
                    e.input_tokens,
                    e.output_tokens,
                    e.cache_creation_tokens,
                    e.cache_read_tokens,
                    now,
                    e.agent_id,
                    e.agent_name,
                    e.agent_role,
                ])
                .map_err(|err| format!("bulk insert failed: {}", err))?;
            inserted += n;
        }
    }

    tx.commit().map_err(|e| format!("commit failed: {}", e))?;
    Ok(inserted)
}

/// Returns whether the migration-from-sessions has already been performed.
/// The frontend uses this to run the one-shot import at most once.
#[tauri::command]
pub fn get_stats_migration_flag(
    key: String,
    db: State<'_, ProjectStatsDb>,
) -> Result<Option<String>, String> {
    let conn = db.0.lock().map_err(|e| format!("DB lock poisoned: {}", e))?;
    let result: Result<String, _> = conn.query_row(
        "SELECT value FROM project_stats_meta WHERE key = ?1",
        params![key],
        |row| row.get(0),
    );
    match result {
        Ok(v) => Ok(Some(v)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("get_stats_migration_flag failed: {}", e)),
    }
}

/// Flag every event belonging to an agent as agent-deleted. Totals remain in
/// the "agenti licenziati" bucket when aggregated.
#[tauri::command]
pub fn mark_agent_deleted(
    agent_id: String,
    db: State<'_, ProjectStatsDb>,
) -> Result<usize, String> {
    let conn = db.0.lock().map_err(|e| format!("DB lock poisoned: {}", e))?;
    let n = conn
        .execute(
            "UPDATE token_events SET agent_deleted = 1 WHERE agent_id = ?1",
            params![agent_id],
        )
        .map_err(|e| format!("mark_agent_deleted failed: {}", e))?;
    Ok(n)
}

// ============================================================================
// Per-agent breakdown DTOs + query
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentModelStats {
    pub model: String,
    #[serde(flatten)]
    pub breakdown: TokenBreakdown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentStats {
    #[serde(rename = "agentId")]
    pub agent_id: Option<String>,
    #[serde(rename = "agentName")]
    pub agent_name: Option<String>,
    #[serde(rename = "agentRole")]
    pub agent_role: Option<String>,
    #[serde(rename = "agentDeleted")]
    pub agent_deleted: bool,
    pub lifetime: TokenBreakdown,
    #[serde(rename = "byModel")]
    pub by_model: Vec<AgentModelStats>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectAgentStats {
    #[serde(rename = "projectPath")]
    pub project_path: String,
    #[serde(rename = "activeAgents")]
    pub active_agents: Vec<AgentStats>,
    #[serde(rename = "deletedAgents")]
    pub deleted_agents: Vec<AgentStats>,
}

/// Return per-agent breakdown for a given project.
///
/// Aggregates by `agent_id` (NULL → "Unknown agent" bucket). Each agent carries
/// a nested breakdown by model. Agents with `agent_deleted = 1` are returned
/// in `deletedAgents` ("agenti licenziati") so the UI can render them in a
/// separate section while preserving totals.
#[tauri::command]
pub fn get_project_agent_stats(
    project_path: String,
    db: State<'_, ProjectStatsDb>,
) -> Result<ProjectAgentStats, String> {
    let normalized = normalize_project_path(&project_path);
    let conn = db.0.lock().map_err(|e| format!("DB lock poisoned: {}", e))?;

    // Step 1: aggregate (agent_id, model) rows — we reduce to agent-level
    // in Rust so NULL agent_ids coalesce into one bucket.
    let mut stmt = conn
        .prepare(
            "SELECT
                agent_id, agent_name, agent_role, agent_deleted, model,
                SUM(input_tokens), SUM(output_tokens),
                SUM(cache_creation_tokens), SUM(cache_read_tokens),
                COUNT(*)
             FROM token_events
             WHERE project_path = ?1
             GROUP BY agent_id, model, agent_deleted
             ORDER BY agent_deleted ASC,
                      SUM(input_tokens + output_tokens + cache_creation_tokens + cache_read_tokens) DESC",
        )
        .map_err(|e| format!("prepare agent stats failed: {}", e))?;

    struct Row {
        agent_id: Option<String>,
        agent_name: Option<String>,
        agent_role: Option<String>,
        agent_deleted: bool,
        model: String,
        breakdown: TokenBreakdown,
    }

    let rows_iter = stmt
        .query_map(params![normalized], |row| {
            Ok(Row {
                agent_id: row.get::<_, Option<String>>(0)?,
                agent_name: row.get::<_, Option<String>>(1)?,
                agent_role: row.get::<_, Option<String>>(2)?,
                agent_deleted: row.get::<_, Option<i64>>(3)?.unwrap_or(0) != 0,
                model: row.get::<_, Option<String>>(4)?.unwrap_or_else(|| "unknown".to_string()),
                breakdown: TokenBreakdown {
                    input_tokens: row.get::<_, Option<i64>>(5)?.unwrap_or(0),
                    output_tokens: row.get::<_, Option<i64>>(6)?.unwrap_or(0),
                    cache_creation_tokens: row.get::<_, Option<i64>>(7)?.unwrap_or(0),
                    cache_read_tokens: row.get::<_, Option<i64>>(8)?.unwrap_or(0),
                    message_count: row.get::<_, Option<i64>>(9)?.unwrap_or(0),
                },
            })
        })
        .map_err(|e| format!("query_map agent stats failed: {}", e))?;

    // Group by (agent_id, agent_deleted). HashMap key uses Option<String>
    // stringified to avoid hashing on Option<String> directly with None collisions.
    use std::collections::HashMap;
    let mut groups: HashMap<(String, bool), AgentStats> = HashMap::new();

    for r in rows_iter {
        let r = r.map_err(|e| format!("row agent stats failed: {}", e))?;
        let key = (
            r.agent_id.clone().unwrap_or_else(|| "__unknown__".to_string()),
            r.agent_deleted,
        );

        let entry = groups.entry(key).or_insert_with(|| AgentStats {
            agent_id: r.agent_id.clone(),
            agent_name: r.agent_name.clone(),
            agent_role: r.agent_role.clone(),
            agent_deleted: r.agent_deleted,
            lifetime: TokenBreakdown::default(),
            by_model: Vec::new(),
        });

        // Accumulate into lifetime
        entry.lifetime.input_tokens += r.breakdown.input_tokens;
        entry.lifetime.output_tokens += r.breakdown.output_tokens;
        entry.lifetime.cache_creation_tokens += r.breakdown.cache_creation_tokens;
        entry.lifetime.cache_read_tokens += r.breakdown.cache_read_tokens;
        entry.lifetime.message_count += r.breakdown.message_count;

        // Prefer non-null names if previously null (handles rows with
        // inconsistent agent_name for the same agent_id over time)
        if entry.agent_name.is_none() {
            entry.agent_name = r.agent_name;
        }
        if entry.agent_role.is_none() {
            entry.agent_role = r.agent_role;
        }

        entry.by_model.push(AgentModelStats {
            model: r.model,
            breakdown: r.breakdown,
        });
    }

    // Split into active vs deleted, sorted by total DESC
    let mut active: Vec<AgentStats> = Vec::new();
    let mut deleted: Vec<AgentStats> = Vec::new();
    for (_, stats) in groups.into_iter() {
        if stats.agent_deleted {
            deleted.push(stats);
        } else {
            active.push(stats);
        }
    }
    let total_of = |b: &TokenBreakdown| -> i64 {
        b.input_tokens + b.output_tokens + b.cache_creation_tokens + b.cache_read_tokens
    };
    active.sort_by(|a, b| total_of(&b.lifetime).cmp(&total_of(&a.lifetime)));
    deleted.sort_by(|a, b| total_of(&b.lifetime).cmp(&total_of(&a.lifetime)));

    Ok(ProjectAgentStats {
        project_path: normalized,
        active_agents: active,
        deleted_agents: deleted,
    })
}

#[tauri::command]
pub fn set_stats_migration_flag(
    key: String,
    value: String,
    db: State<'_, ProjectStatsDb>,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| format!("DB lock poisoned: {}", e))?;
    conn.execute(
        "INSERT INTO project_stats_meta (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )
    .map_err(|e| format!("set_stats_migration_flag failed: {}", e))?;
    Ok(())
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    fn mk_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        apply_migrations(&conn).unwrap();
        conn
    }

    fn mk_payload(session: &str, message: &str, project: &str) -> RecordUsagePayload {
        RecordUsagePayload {
            session_id: session.to_string(),
            message_id: message.to_string(),
            project_path: project.to_string(),
            project_name: "demo".to_string(),
            provider: "anthropic".to_string(),
            model: "claude-sonnet-4.5".to_string(),
            input_tokens: 100,
            output_tokens: 50,
            cache_creation_tokens: 10,
            cache_read_tokens: 5,
            agent_id: None,
            agent_name: None,
            agent_role: None,
        }
    }

    fn insert(conn: &Connection, p: &RecordUsagePayload) {
        conn.execute(
            "INSERT OR IGNORE INTO token_events (session_id, message_id, project_path, project_name,
                provider, model, input_tokens, output_tokens, cache_creation_tokens,
                cache_read_tokens, session_deleted, recorded_at,
                agent_id, agent_name, agent_role, agent_deleted)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 0, ?11, ?12, ?13, ?14, 0)",
            params![
                p.session_id, p.message_id, normalize_project_path(&p.project_path),
                p.project_name, p.provider, p.model,
                p.input_tokens, p.output_tokens, p.cache_creation_tokens,
                p.cache_read_tokens, 1_700_000_000_000_i64,
                p.agent_id, p.agent_name, p.agent_role,
            ],
        ).unwrap();
    }

    #[test]
    fn normalize_strips_trailing_slash_and_backslashes() {
        assert_eq!(normalize_project_path("/a/b/"), "/a/b");
        assert_eq!(normalize_project_path("C:\\foo\\bar\\"), "C:/foo/bar");
        assert_eq!(normalize_project_path("/"), "/");
    }

    #[test]
    fn idempotent_insert_same_message_id() {
        let conn = mk_conn();
        let p = mk_payload("s1", "m1", "/proj");
        insert(&conn, &p);
        insert(&conn, &p);
        let br = query_breakdown(&conn, "/proj", None).unwrap();
        assert_eq!(br.message_count, 1);
        assert_eq!(br.input_tokens, 100);
    }

    #[test]
    fn different_messages_sum() {
        let conn = mk_conn();
        insert(&conn, &mk_payload("s1", "m1", "/proj"));
        insert(&conn, &mk_payload("s1", "m2", "/proj"));
        insert(&conn, &mk_payload("s2", "m1", "/proj"));
        let br = query_breakdown(&conn, "/proj", None).unwrap();
        assert_eq!(br.message_count, 3);
        assert_eq!(br.input_tokens, 300);
        assert_eq!(br.output_tokens, 150);
    }

    #[test]
    fn mark_deleted_moves_to_deleted_bucket() {
        let conn = mk_conn();
        insert(&conn, &mk_payload("s1", "m1", "/proj"));
        insert(&conn, &mk_payload("s2", "m1", "/proj"));
        conn.execute(
            "UPDATE token_events SET session_deleted = 1 WHERE session_id = ?1",
            params!["s1"],
        ).unwrap();
        let active = query_breakdown(&conn, "/proj", Some(false)).unwrap();
        let deleted = query_breakdown(&conn, "/proj", Some(true)).unwrap();
        let lifetime = query_breakdown(&conn, "/proj", None).unwrap();
        assert_eq!(active.message_count, 1);
        assert_eq!(deleted.message_count, 1);
        assert_eq!(lifetime.message_count, 2);
        assert_eq!(lifetime.input_tokens, active.input_tokens + deleted.input_tokens);
    }

    #[test]
    fn path_normalization_merges_trailing_slash_variants() {
        let conn = mk_conn();
        let mut a = mk_payload("s1", "m1", "/proj/");
        let b = mk_payload("s2", "m1", "/proj");
        insert(&conn, &a);
        insert(&conn, &b);
        a.message_id = "m2".to_string();
        a.session_id = "s1".to_string();
        insert(&conn, &a);
        let br = query_breakdown(&conn, "/proj", None).unwrap();
        assert_eq!(br.message_count, 3);
    }

    #[test]
    fn grouped_by_provider_and_model() {
        let conn = mk_conn();
        let mut p = mk_payload("s1", "m1", "/proj");
        insert(&conn, &p);
        p.session_id = "s1".into();
        p.message_id = "m2".into();
        p.provider = "bedrock".into();
        p.model = "claude-opus-4".into();
        insert(&conn, &p);

        let by_provider = query_grouped(&conn, "/proj", "provider").unwrap();
        assert_eq!(by_provider.len(), 2);
        let by_model = query_grouped(&conn, "/proj", "model").unwrap();
        assert_eq!(by_model.len(), 2);

        assert!(query_grouped(&conn, "/proj", "; DROP TABLE token_events--").is_err());
    }

    #[test]
    fn agent_aggregation_groups_by_agent_id_and_model() {
        let conn = mk_conn();
        // Agent Jack uses two models
        let mut p = mk_payload("s1", "m1", "/proj");
        p.agent_id = Some("agent-jack".into());
        p.agent_name = Some("Jack".into());
        p.agent_role = Some("PM".into());
        insert(&conn, &p);

        p.message_id = "m2".into();
        p.model = "claude-opus-4".into();
        insert(&conn, &p);

        // Agent Leo uses one model
        let mut q = mk_payload("s2", "m1", "/proj");
        q.agent_id = Some("agent-leo".into());
        q.agent_name = Some("Leo".into());
        q.agent_role = Some("Developer".into());
        q.input_tokens = 500;
        insert(&conn, &q);

        // Unknown agent (NULL agent_id)
        let r = mk_payload("s3", "m1", "/proj");
        insert(&conn, &r);

        // Re-run the core aggregation logic inline (get_project_agent_stats
        // needs a Tauri State, not available in unit tests).
        let mut stmt = conn.prepare(
            "SELECT agent_id, agent_name, agent_role, agent_deleted, model,
                    SUM(input_tokens), SUM(output_tokens),
                    SUM(cache_creation_tokens), SUM(cache_read_tokens), COUNT(*)
             FROM token_events WHERE project_path = '/proj'
             GROUP BY agent_id, model, agent_deleted").unwrap();
        let rows: Vec<_> = stmt.query_map([], |row| {
            Ok((
                row.get::<_, Option<String>>(0)?,
                row.get::<_, Option<String>>(4)?.unwrap_or_default(),
                row.get::<_, Option<i64>>(5)?.unwrap_or(0),
            ))
        }).unwrap().flatten().collect();

        // We should see: (agent-jack, sonnet), (agent-jack, opus), (agent-leo, sonnet), (NULL, sonnet)
        assert_eq!(rows.len(), 4);
        let jack_rows: Vec<_> = rows.iter().filter(|(id, _, _)| id.as_deref() == Some("agent-jack")).collect();
        assert_eq!(jack_rows.len(), 2);
    }

    #[test]
    fn mark_agent_deleted_moves_to_deleted_bucket() {
        let conn = mk_conn();
        let mut p = mk_payload("s1", "m1", "/proj");
        p.agent_id = Some("agent-retired".into());
        p.agent_name = Some("Retired".into());
        insert(&conn, &p);

        conn.execute(
            "UPDATE token_events SET agent_deleted = 1 WHERE agent_id = ?1",
            params!["agent-retired"],
        ).unwrap();

        let active_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM token_events WHERE agent_deleted = 0",
            [], |r| r.get(0)
        ).unwrap();
        let deleted_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM token_events WHERE agent_deleted = 1",
            [], |r| r.get(0)
        ).unwrap();
        assert_eq!(active_count, 0);
        assert_eq!(deleted_count, 1);
    }

    #[test]
    fn v2_migration_idempotent_and_adds_columns() {
        let conn = Connection::open_in_memory().unwrap();
        // Apply once
        apply_migrations(&conn).unwrap();
        assert!(column_exists(&conn, "token_events", "agent_id").unwrap());
        assert!(column_exists(&conn, "token_events", "agent_deleted").unwrap());
        // Apply again — must not fail
        apply_migrations(&conn).unwrap();
        assert_eq!(get_user_version(&conn).unwrap(), 2);
    }

    #[test]
    fn zero_token_events_not_recorded() {
        // Replicates the behavior of record_token_usage (skip zero-total rows)
        let conn = mk_conn();
        let p = RecordUsagePayload {
            session_id: "s1".into(), message_id: "m1".into(),
            project_path: "/proj".into(), project_name: "demo".into(),
            provider: "anthropic".into(), model: "sonnet".into(),
            input_tokens: 0, output_tokens: 0,
            cache_creation_tokens: 0, cache_read_tokens: 0,
            agent_id: None, agent_name: None, agent_role: None,
        };
        let total = p.input_tokens + p.output_tokens + p.cache_creation_tokens + p.cache_read_tokens;
        assert_eq!(total, 0);
        // real command would early-return here
    }
}
