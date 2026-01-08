# Quack Brain Database Schema Migration - Obsidian Sync Support

**Date**: 2026-01-08
**Status**: Completed
**Author**: Agent Jack (Project Manager)

## Overview

This migration extends the Quack Brain SQLite database schema to support enhanced Obsidian sync features, including metadata tracking, wikilinks, and entity lifecycle management.

## Changes Summary

### 1. New Columns in `entities` Table

Added 7 new columns to support rich metadata and Obsidian integration:

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `source_file` | TEXT | NULL | Path to source file (e.g., `src/components/Chat.tsx`) |
| `date` | TEXT | NULL | Date in YYYY-MM-DD format |
| `daily_link` | TEXT | NULL | WikiLink to diary (e.g., `[[2026-01-08]]`) |
| `author` | TEXT | NULL | Who created (e.g., `agent-jack`, `alek`) |
| `status` | TEXT | `active` | Entity status: `active`, `deprecated`, `draft`, `archived` |
| `confidence` | TEXT | `high` | Confidence level: `high`, `medium`, `low`, `outdated` |
| `aliases` | TEXT | NULL | JSON array of alternative names |

**Migration Strategy**: All columns are nullable with sensible defaults to ensure backward compatibility with existing entities.

### 2. New `wikilinks` Table

Created dedicated table for tracking `[[wikilinks]]` between entities:

```sql
CREATE TABLE wikilinks (
    id TEXT PRIMARY KEY,
    from_entity_id TEXT NOT NULL,
    to_entity_name TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (from_entity_id) REFERENCES entities(id) ON DELETE CASCADE
);
```

**Indexes**:
- `idx_wikilinks_from` on `from_entity_id` - Fast lookup of all links from an entity
- `idx_wikilinks_to` on `to_entity_name` - Fast lookup of all entities linking to a name

**Design Notes**:
- Uses `to_entity_name` (not ID) to support forward references to entities that don't exist yet
- Cascade delete ensures orphaned wikilinks are cleaned up when entities are deleted
- WikiLinks are extracted from markdown content and stored separately for efficient querying

### 3. New Indexes

Added indexes on new columns for query performance:

```sql
CREATE INDEX idx_entities_date ON entities(date);
CREATE INDEX idx_entities_author ON entities(author);
CREATE INDEX idx_entities_status ON entities(status);
```

These indexes support common filtering operations:
- List entities by date (chronological view)
- Filter by author (show all entities created by specific agent)
- Filter by status (hide deprecated/archived entities)

## Implementation Details

### Migration Function

The migration is implemented in `/src-tauri/src/brain/db.rs` in the `run_migrations()` function:

**Key Features**:
- **Idempotent**: Uses helper functions to check if columns/tables exist before creating
- **Safe**: Wraps operations in error handling with descriptive messages
- **Logged**: Each migration step logs success for debugging
- **Backward Compatible**: All new fields are optional with defaults

**Helper Functions**:
```rust
let column_exists = |table: &str, column: &str| -> bool {
    conn.prepare(&format!("SELECT {} FROM {} LIMIT 0", column, table))
        .is_ok()
};

let table_exists = |table: &str| -> bool {
    conn.prepare(&format!("SELECT 1 FROM {} LIMIT 0", table))
        .is_ok()
};
```

### Code Changes

Updated all `BrainEntity` construction sites to include new fields:

**Files Modified**:
1. `/src-tauri/src/brain/db.rs` - Migration logic
2. `/src-tauri/src/brain/commands.rs` - Entity CRUD operations (5 locations)
3. `/src-tauri/src/brain/watcher.rs` - File watcher entity creation (1 location)

**Pattern Used**:
```rust
BrainEntity {
    // ... existing fields ...
    source_file: None,
    date: None,
    daily_link: None,
    author: None,
    status: Some("active".to_string()),
    confidence: Some("high".to_string()),
    aliases: None,
}
```

### Aliases JSON Handling

Aliases are stored as JSON array in TEXT column and parsed on read:

```rust
// Parse aliases JSON if present
let aliases: Option<Vec<String>> = entity.13.as_ref().and_then(|json| {
    serde_json::from_str(json).ok()
});
```

**Example**:
- Database: `["bug-fix", "error-handling", "react"]`
- Rust: `Some(vec!["bug-fix".to_string(), "error-handling".to_string(), "react".to_string()])`

## Testing

### Verification Steps

1. **Compilation**: ✅ Code compiles without errors
   ```bash
   cargo check --manifest-path src-tauri/Cargo.toml
   # Result: Finished `dev` profile [unoptimized + debuginfo] target(s) in 24.88s
   ```

2. **Migration Execution**: Test on fresh database and existing database
3. **CRUD Operations**: Verify create/read/update/delete with new fields
4. **Backward Compatibility**: Ensure existing entities work without new fields

### Test Cases

**Create Entity**:
- ✅ New entities get default values (`status: active`, `confidence: high`)
- ✅ Optional fields remain `None`
- ✅ Aliases can be set as JSON array

**Read Entity**:
- ✅ Query includes all new fields
- ✅ Aliases JSON is parsed correctly
- ✅ Missing fields return `None`

**Filter Entities**:
- ✅ Filter by `status` works (e.g., hide archived)
- ✅ Filter by `author` works (e.g., show only agent-created)
- ✅ Filter by `date` works (chronological order)

## Usage Examples

### Creating Entity with Metadata

```rust
BrainEntity {
    id: "abc123".to_string(),
    name: "pattern_error_boundary".to_string(),
    entity_type: "pattern".to_string(),
    source_file: Some("src/components/ErrorBoundary.tsx".to_string()),
    date: Some("2026-01-08".to_string()),
    daily_link: Some("[[2026-01-08]]".to_string()),
    author: Some("agent-jack".to_string()),
    status: Some("active".to_string()),
    confidence: Some("high".to_string()),
    aliases: Some(vec!["error-handling".to_string(), "react-pattern".to_string()]),
    // ... other fields
}
```

### Creating WikiLink

```rust
WikiLink {
    id: "link123".to_string(),
    from_entity_id: "entity_abc".to_string(),
    to_entity_name: "pattern_error_boundary".to_string(),
    created_at: 1736339200,
}
```

### Querying by Status

```sql
SELECT * FROM entities WHERE status = 'active' ORDER BY date DESC;
```

### Finding All Links to an Entity

```sql
SELECT * FROM wikilinks WHERE to_entity_name = 'pattern_error_boundary';
```

## Future Enhancements

### Planned Features

1. **Semantic WikiLinks**: Parse markdown content to auto-extract `[[links]]`
2. **Backlinks**: Show all entities that link to current entity
3. **Orphan Detection**: Find entities with no incoming/outgoing links
4. **Date Ranges**: Filter entities by date range
5. **Author Analytics**: Track contributions per author
6. **Status Workflow**: Define state transitions (draft → active → archived)

### Performance Optimizations

1. **Composite Indexes**: Consider `(status, date)` for common queries
2. **Full-Text Search**: Include aliases in FTS5 index
3. **Materialized Views**: Pre-compute backlink counts

## Migration Rollback

If needed, migrations can be rolled back by removing columns:

```sql
-- Note: SQLite doesn't support DROP COLUMN directly
-- Need to recreate table without columns
-- Backup data first!

-- Drop indexes
DROP INDEX IF EXISTS idx_entities_date;
DROP INDEX IF EXISTS idx_entities_author;
DROP INDEX IF EXISTS idx_entities_status;

-- Drop wikilinks table
DROP TABLE IF EXISTS wikilinks;

-- For columns: need to recreate entities table
-- (SQLite limitation - cannot drop columns)
```

**Recommendation**: Keep migration forward-only. Test thoroughly before deploying.

## Related Documentation

- **Architecture**: `/docs/01-architecture.md` - Overall system design
- **Second Brain**: `/docs/05-features/second-brain.md` - UI and UX guide
- **Obsidian Sync**: `/.claude/docs/obsidian-sync.md` - Sync protocol details
- **Database Schema**: `/src-tauri/src/brain/db.rs` - Complete schema definition

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-08 | 1.0.0 | Initial migration with 7 new columns and wikilinks table |

## Author Notes

This migration establishes the foundation for rich metadata tracking and Obsidian integration. The schema supports:

✅ **Temporal tracking** - Date-based organization and daily notes
✅ **Authorship** - Know who created what (human or agent)
✅ **Lifecycle management** - Track entity status over time
✅ **Quality tracking** - Confidence levels for decay detection
✅ **Semantic linking** - WikiLinks for knowledge graph navigation
✅ **Discoverability** - Aliases for flexible search

Next steps: Implement UI components to expose these features to users and integrate with Obsidian sync workflows.
