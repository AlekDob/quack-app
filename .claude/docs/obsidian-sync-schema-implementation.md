# Obsidian Sync Schema Implementation

**Date:** 2026-01-06
**Feature:** Database schema changes for Obsidian sync in Quack Brain

## Summary

Implemented database schema migrations and Tauri commands to support bidirectional sync between Quack Brain and Obsidian vault.

## Changes Made

### 1. Database Schema (`src-tauri/src/brain/db.rs`)

Added migration function `run_migrations()` that:

**New columns on `entities` table:**
- `sync_hash TEXT` - MD5 hash of markdown content for conflict detection
- `last_synced_at INTEGER` - Unix timestamp of last sync
- `sync_source TEXT` - Origin of last update ('brain' | 'obsidian' | null)
- `vault_relative_path TEXT` - Path relative to vault root (e.g., "quack-brain/patterns/auth.md")

**New table `brain_settings`:**
```sql
CREATE TABLE IF NOT EXISTS brain_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);
```

**Default settings inserted:**
- `vault_path`: '' (empty, user must configure)
- `sync_enabled`: 'false'
- `sync_structure`: 'subfolder' (options: subfolder, flat)
- `auto_sync_to_vault`: 'true'
- `auto_sync_from_vault`: 'true'
- `conflict_policy`: 'ask' (options: ask, brain_wins, obsidian_wins)
- `auto_embed`: 'true'
- `markdown_editor`: 'obsidian' (options: obsidian, vscode, cursor, default)

**New indexes:**
- `idx_entities_vault_path` - For fast lookups by vault path
- `idx_entities_sync_source` - For filtering by sync source

### 2. New Types (`src-tauri/src/brain/types.rs`)

```rust
// Settings configuration struct
pub struct BrainSettings {
    pub vault_path: String,
    pub sync_enabled: bool,
    pub sync_structure: String,
    pub auto_sync_to_vault: bool,
    pub auto_sync_from_vault: bool,
    pub conflict_policy: String,
    pub auto_embed: bool,
    pub markdown_editor: String,
}

// Sync status for an entity
pub struct SyncStatus {
    pub entity_id: String,
    pub has_conflict: bool,
    pub brain_updated_at: i64,
    pub vault_updated_at: Option<i64>,
    pub sync_hash: Option<String>,
}

// Sync conflict details
pub struct SyncConflict {
    pub entity_id: String,
    pub entity_name: String,
    pub brain_content: String,
    pub vault_content: String,
    pub brain_updated_at: i64,
    pub vault_updated_at: i64,
}

// Extended entity with sync metadata
pub struct BrainEntityWithSync {
    // ... base entity fields ...
    pub sync_hash: Option<String>,
    pub last_synced_at: Option<i64>,
    pub sync_source: Option<String>,
    pub vault_relative_path: Option<String>,
}
```

### 3. New Tauri Commands (`src-tauri/src/brain/commands.rs`)

| Command | Description |
|---------|-------------|
| `brain_get_settings()` | Get all brain settings as `BrainSettings` struct |
| `brain_set_setting(key, value)` | Set a single setting (with key validation) |
| `brain_get_setting(key)` | Get a single setting value |
| `brain_update_settings(settings)` | Update all settings at once |
| `brain_get_sync_status(entity_id)` | Get sync status for an entity |
| `brain_update_sync_metadata(...)` | Update sync metadata after sync operation |
| `brain_get_entities_needing_sync()` | Get entities that need syncing |

### 4. Command Registration (`src-tauri/src/lib.rs`)

All new commands registered in the Tauri invoke handler under the section:
```rust
// Quack Brain - Settings & Obsidian Sync
brain::brain_get_settings,
brain::brain_set_setting,
brain::brain_get_setting,
brain::brain_update_settings,
brain::brain_get_sync_status,
brain::brain_update_sync_metadata,
brain::brain_get_entities_needing_sync
```

## Migration Strategy

The schema changes use a safe migration pattern:
1. Check if column exists before adding (using `SELECT column FROM table LIMIT 0`)
2. Use `ALTER TABLE ADD COLUMN` for new columns
3. Use `CREATE TABLE IF NOT EXISTS` for new tables
4. Use `INSERT OR IGNORE` for default settings
5. All migrations are idempotent - safe to run multiple times

## Files Modified

- `/Users/alekdob/Desktop/Dev/Personal/quack-app/src-tauri/src/brain/db.rs`
- `/Users/alekdob/Desktop/Dev/Personal/quack-app/src-tauri/src/brain/types.rs`
- `/Users/alekdob/Desktop/Dev/Personal/quack-app/src-tauri/src/brain/commands.rs`
- `/Users/alekdob/Desktop/Dev/Personal/quack-app/src-tauri/src/lib.rs`

## Next Steps

1. Implement frontend service to call these commands
2. Create Settings UI for configuring vault path
3. Implement actual sync logic using the new schema
4. Add file watcher for Obsidian vault changes
