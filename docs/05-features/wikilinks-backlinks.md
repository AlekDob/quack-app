# WikiLinks and Backlinks

## Overview

Quack Brain supports automatic parsing and storage of `[[WikiLinks]]` from markdown content, enabling Obsidian-style knowledge graph navigation with backlinks support.

## WikiLink Formats

Two formats are supported:

1. **Simple WikiLink**: `[[NoteName]]`
   - Links directly to another note by name

2. **WikiLink with Display Text**: `[[NoteName|Display Text]]`
   - Links to a note but displays custom text

## Automatic Extraction

WikiLinks are automatically extracted and stored:

1. **On Entity Creation** - When observations contain `[[links]]`
2. **On Observation Addition** - When adding new observations to existing entities
3. **On Vault Import** - When importing markdown files from Obsidian

## Database Schema

WikiLinks are stored in the `wikilinks` table:

```sql
CREATE TABLE wikilinks (
    id TEXT PRIMARY KEY,
    from_entity_id TEXT NOT NULL,
    to_entity_name TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (from_entity_id) REFERENCES entities(id) ON DELETE CASCADE
);
```

**Note**: `to_entity_name` stores the name (not ID) because the target entity may not exist yet. This enables forward references.

## MCP Tools

### brain_get_backlinks

Get all entities that link TO a given entity name.

```typescript
mcp__brain__brain_get_backlinks({ entityName: "React Hooks" })
```

**Response:**
```json
{
  "success": true,
  "targetName": "React Hooks",
  "count": 3,
  "backlinks": [
    {
      "fromEntityId": "uuid-1",
      "fromEntityName": "pattern_custom_hooks",
      "fromEntityType": "pattern",
      "createdAt": 1704720000
    },
    {
      "fromEntityId": "uuid-2",
      "fromEntityName": "bug_useeffect_cleanup",
      "fromEntityType": "bug",
      "createdAt": 1704710000
    }
  ]
}
```

### brain_get_wikilinks

Get all WikiLinks FROM a given entity.

```typescript
mcp__brain__brain_get_wikilinks({ entityName: "pattern_error_handling" })
```

**Response:**
```json
{
  "success": true,
  "entityId": "uuid-source",
  "count": 2,
  "wikilinks": [
    {
      "id": "wl-uuid-1",
      "fromEntityId": "uuid-source",
      "toEntityName": "React Error Boundaries",
      "createdAt": 1704720000
    },
    {
      "id": "wl-uuid-2",
      "fromEntityId": "uuid-source",
      "toEntityName": "Sentry Integration",
      "createdAt": 1704720000
    }
  ]
}
```

## Tauri Commands

### brain_get_backlinks

```typescript
await invoke('brain_get_backlinks', { entityName: 'React Hooks' });
```

### brain_get_wikilinks

```typescript
await invoke('brain_get_wikilinks', { entityId: 'uuid-here' });
```

### brain_reprocess_all_wikilinks

Utility to backfill WikiLinks for all existing entities:

```typescript
await invoke('brain_reprocess_all_wikilinks');
```

**Response:**
```json
{
  "totalEntities": 150,
  "processed": 150,
  "totalLinks": 423,
  "errors": []
}
```

## Implementation Details

### Rust (commands.rs)

```rust
/// Parse [[WikiLinks]] from markdown content
pub fn parse_wikilinks(content: &str) -> Vec<ParsedWikiLink> {
    let re = Regex::new(r"\[\[([^\]|]+)(?:\|([^\]]+))?\]\]").unwrap();
    // ... extracts target_name and optional display_text
}

/// Store WikiLinks for an entity
pub fn store_wikilinks(entity_id: &str, wikilinks: &[ParsedWikiLink]) -> Result<usize, String> {
    // Clears existing and inserts new
}
```

### Node.js (brain-mcp-server.js)

```javascript
function parseWikiLinks(content) {
  const regex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  // ... returns array of { targetName, displayText }
}

function storeWikiLinks(entityId, wikilinks) {
  // Clears existing and inserts new
}
```

## Integration with Obsidian

WikiLinks in Quack Brain are fully compatible with Obsidian:

1. **Graph View** - Backlinks create edges in Obsidian's graph
2. **Hover Preview** - Links show preview on hover
3. **Quick Navigation** - Click to navigate between notes
4. **Unresolved Links** - Target entities don't need to exist

## Self-Link Filtering

WikiLinks to the same entity are automatically filtered out to prevent circular references.

## Case-Insensitive Matching

Backlink queries are case-insensitive:
- `[[React]]`, `[[react]]`, and `[[REACT]]` all match

## Related Files

- `/src-tauri/src/brain/commands.rs` - Rust implementation
- `/src-tauri/src/brain/db.rs` - Database schema and migrations
- `/src-tauri/node-sdk/brain-mcp-server.js` - MCP server implementation
- `/src/tests/wikilinks.test.ts` - Unit tests
