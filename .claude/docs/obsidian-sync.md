# Obsidian Real-time Sync with Vector DB

## Overview

The Obsidian Sync feature provides bidirectional synchronization between Quack Brain (SQLite database with vector embeddings) and an Obsidian vault (markdown files). This enables users to work seamlessly between Quack's structured knowledge graph and Obsidian's flexible markdown environment.

**Key Benefits:**
- Real-time file watching with debounced events (500ms)
- Bidirectional sync (Brain → Vault and Vault → Brain)
- Conflict detection and resolution UI
- Semantic search via vector embeddings
- YAML frontmatter for metadata preservation
- Automatic embedding generation queue

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Obsidian Vault                              │
│                    (Markdown Files with YAML)                       │
└───────────────────────────────────┬─────────────────────────────────┘
                                    │
                      ┌─────────────┴─────────────┐
                      │   File Watcher (Rust)     │
                      │  notify + debouncer_full  │
                      │    (500ms debounce)       │
                      └─────────────┬─────────────┘
                                    │
                      ┌─────────────┴─────────────┐
                      │    Tauri Events           │
                      │  brain:file-created       │
                      │  brain:file-changed       │
                      │  brain:file-deleted       │
                      └─────────────┬─────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
   ┌────▼────┐              ┌───────▼────────┐         ┌───────▼──────┐
   │  Rust   │              │   TypeScript   │         │   React UI   │
   │Commands │◄────────────►│    Services    │◄───────►│   Hooks      │
   └────┬────┘              └───────┬────────┘         └──────────────┘
        │                           │
   ┌────▼────────────────────────────▼──────┐
   │         Brain SQLite Database          │
   │  ┌─────────────┐  ┌──────────────┐   │
   │  │  Entities   │  │  Embeddings  │   │
   │  │  +sync_hash │  │  +vector(f32)│   │
   │  │  +last_sync │  │  +model      │   │
   │  │  +vault_path│  │              │   │
   │  └─────────────┘  └──────────────┘   │
   │  ┌─────────────┐                     │
   │  │  Settings   │  (brain_settings)   │
   │  └─────────────┘                     │
   └────────────────────────────────────────┘
```

## Components

### Rust Backend

#### VaultWatcherManager (`watcher.rs`)
File system watcher using `notify-debouncer-full` crate.

**Key Features:**
- Recursive directory watching
- 500ms debounce to prevent event flooding
- Filters for `.md` files only
- Emits Tauri events: `brain:file-created`, `brain:file-changed`, `brain:file-deleted`

**Commands:**
```rust
brain_start_vault_watcher(vault_path: String) -> Result<(), String>
brain_stop_vault_watcher() -> Result<(), String>
brain_is_vault_watching() -> Result<bool, String>
brain_get_vault_path() -> Result<Option<String>, String>
```

#### Sync Commands (`commands.rs`)

**Obsidian Sync Advanced Commands** (lines 1522-2042):

1. **brain_resolve_conflict(entity_id, resolution)**
   - Resolves sync conflicts between Brain and Obsidian
   - `resolution`: "brain" (Brain overwrites) or "obsidian" (Obsidian overwrites)
   - Updates `last_synced_at` to mark conflict as resolved
   - Re-syncs entity to markdown or re-imports from vault

2. **brain_get_global_sync_status() -> GlobalSyncStatus**
   - Returns overall sync statistics for UI
   - Fields:
     - `last_sync_time`: Most recent sync timestamp
     - `entity_count`: Total entities in Brain
     - `conflict_count`: Entities with unresolved conflicts
     - `is_generating_embeddings`: Embedding generation in progress
     - `embedding_progress`: Percentage (0-100)

3. **brain_sync_to_vault() -> usize**
   - Exports all entities needing sync to vault
   - Validates vault path from settings
   - Returns count of synced entities
   - Calls `brain_sync_entity_to_md` for each entity

4. **brain_import_from_vault() -> ImportResult**
   - Scans vault for all `.md` files recursively
   - Imports each file via `import_markdown_file`
   - Skips hidden directories (starting with `.`)
   - Returns statistics: imported_entities, skipped, errors

5. **brain_open_vault(editor: String)**
   - Opens vault in configured editor
   - Supports: "obsidian" (via URI), "vscode", "cursor", or system default
   - Platform-specific commands (macOS/Windows/Linux)

6. **brain_generate_embeddings_batch(entity_ids: Vec<String>) -> EmbeddingBatchResult**
   - Generates embeddings for specific entities
   - Currently uses placeholder 384-dimensional zero vectors
   - Production: integrate Transformers.js or external API
   - Stores in `embeddings` table with model name

7. **brain_generate_all_embeddings() -> AllEmbeddingsResult**
   - Wrapper for batch embedding generation
   - Gets entities without embeddings via `brain_get_entities_without_embeddings`
   - Processes in batches

**Helper Functions:**
- `scan_markdown_files(dir)`: Recursively finds `.md` files
- `import_markdown_file(file_path)`: Parses and imports single file
- `parse_markdown_frontmatter(content)`: Extracts YAML metadata
- `extract_entity_name(body, file_path)`: Gets name from H1 or filename
- `extract_observations(body)`: Parses `## Observations` section

### TypeScript Frontend

#### obsidianSyncService.ts

**Settings Management:**
```typescript
getSettings() -> BrainSettings
setSetting(key, value) -> void
setVaultPath(path: string) -> void
```

**Vault Watcher:**
```typescript
startVaultWatcher() -> void
stopVaultWatcher() -> void
isVaultWatching() -> boolean
subscribeToFileChanges(callback) -> unsubscribe
```

**Sync Operations:**
```typescript
// Brain → Vault
syncEntityToVault(entityId: string) -> string (file path)
syncAllToVault() -> SyncResult

// Vault → Brain
importFromVault(filePath: string) -> BrainEntity
importAllFromVault() -> SyncResult
```

**Conflict Resolution:**
```typescript
resolveConflict(entityId: string, resolution: 'brain' | 'obsidian') -> void
```

**Editor Integration:**
```typescript
openInEditor(filePath: string, editor: 'obsidian' | 'vscode' | 'cursor' | 'default') -> void
openVaultFolder() -> void
```

**Event System:**
- `SYNC_EVENTS.FILE_CREATED`
- `SYNC_EVENTS.FILE_CHANGED`
- `SYNC_EVENTS.FILE_DELETED`
- `SYNC_EVENTS.SYNC_STARTED`
- `SYNC_EVENTS.SYNC_COMPLETED`
- `SYNC_EVENTS.SYNC_CONFLICT`
- `SYNC_EVENTS.SYNC_ERROR`
- `SYNC_EVENTS.EMBED_PROGRESS`

**Embedding Queue:**
- Debounced queue (2 seconds) for batch embedding generation
- `queueForEmbedding(entityId)`: Adds to queue
- `processEmbeddingQueue()`: Processes batched entities

#### useObsidianSync.ts

React hook providing reactive access to sync state.

**State:**
```typescript
{
  settings: BrainSettings | null
  syncStatus: SyncStatus | null
  isWatching: boolean
  conflicts: SyncConflict[]
  isSyncing: boolean
  error: string | null
}
```

**Operations:**
```typescript
updateSetting(key, value)
startWatcher()
stopWatcher()
syncAllToVault()
importAllFromVault()
resolveConflict(entityId, resolution)
resolveAllConflicts(resolution)
openVaultFolder()
refresh()
```

**Auto-sync Handler:**
- Listens to `BRAIN_UPDATED_EVENT`
- Automatically syncs when enabled in settings

#### SecondBrainSettings.tsx

UI component for sync configuration.

**Features:**
- Vault path selection via folder picker
- Enable/disable sync toggle
- Sync structure: subfolder vs flat
- Auto-sync toggles (to/from vault)
- Conflict policy selector
- Manual sync buttons
- Embedding generation controls
- Sync status display
- Conflict resolution dialog trigger

#### SyncConflictDialog.tsx

Modal dialog for resolving sync conflicts.

**Features:**
- Lists all conflicts with entity names
- Shows Brain and Vault timestamps
- Individual resolution buttons per conflict
- Bulk resolution: "Keep Brain" or "Keep Obsidian"
- Auto-closes when all conflicts resolved

## Database Schema

### entities Table (Extended Columns)

```sql
-- Sync metadata columns
sync_hash TEXT            -- MD5 hash of markdown content
last_synced_at INTEGER    -- Unix timestamp of last sync
sync_source TEXT          -- "brain" or "obsidian" (last source)
vault_relative_path TEXT  -- Relative path within vault
```

**Conflict Detection:**
A conflict exists when:
```sql
last_synced_at IS NOT NULL
AND updated_at > last_synced_at
AND sync_hash != calculated_hash
```

### brain_settings Table

Key-value store for persistent settings.

**Keys:**
- `vault_path`: Absolute path to Obsidian vault
- `sync_enabled`: "true" | "false"
- `sync_structure`: "subfolder" | "flat"
- `auto_sync_to_vault`: "true" | "false"
- `auto_sync_from_vault`: "true" | "false"
- `conflict_policy`: "ask" | "brain_wins" | "obsidian_wins"
- `auto_embed`: "true" | "false"
- `markdown_editor`: "obsidian" | "vscode" | "cursor" | "default"

### embeddings Table

```sql
CREATE TABLE embeddings (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  vector BLOB NOT NULL,        -- f32 array serialized to bytes
  model TEXT NOT NULL,          -- e.g., "all-MiniLM-L6-v2"
  created_at INTEGER NOT NULL
);
```

**Vector Format:**
- Stored as binary blob (f32 little-endian bytes)
- Typical dimension: 384 (MiniLM) or 768 (BERT)
- Cosine similarity for search

## Sync Flows

### 1. Brain → Obsidian (Export)

**Trigger:** Entity created/updated in Brain, auto-sync enabled

```
1. Brain entity updated
   ↓
2. Check sync settings
   ↓
3. Generate markdown with YAML frontmatter
   ↓
4. Calculate sync_hash (MD5 of content)
   ↓
5. Determine file path based on sync_structure
   - subfolder: /vault/quack-brain/entity_name.md
   - flat: /vault/entity_name.md
   ↓
6. Write markdown file
   ↓
7. Update entity metadata:
   - sync_hash
   - last_synced_at
   - vault_relative_path
   - sync_source = "brain"
```

**Markdown Format:**
```markdown
---
id: "uuid-here"
type: fact
project: "project-id"
created: 1704067200
updated: 1704153600
---

# Entity Name

**Type:** `#fact`

## Observations

- First observation
- Second observation
```

### 2. Obsidian → Brain (Import)

**Trigger:** Markdown file created/modified in vault, auto-sync enabled

```
1. File watcher detects change (500ms debounce)
   ↓
2. Emit brain:file-changed event
   ↓
3. Parse markdown file
   - Extract YAML frontmatter
   - Extract H1 title
   - Extract observations from list
   - Calculate sync_hash
   ↓
4. Check if entity exists (by ID in frontmatter)
   ↓
5a. Entity exists:
    - Update name, type, project_id
    - Replace observations
    - Update updated_at
    ↓
5b. Entity does NOT exist:
    - Generate new UUID if no ID in frontmatter
    - Create new entity
    - Write ID back to frontmatter
    ↓
6. Update sync metadata:
   - sync_hash
   - last_synced_at
   - sync_source = "obsidian"
```

### 3. Conflict Detection & Resolution

**Conflict Occurs When:**
- Entity modified in Brain (updated_at > last_synced_at)
- File modified in Obsidian (sync_hash changed)
- Both happened since last successful sync

**Detection Query:**
```sql
SELECT id FROM entities
WHERE last_synced_at IS NOT NULL
  AND updated_at > last_synced_at;
```

**Resolution Process:**
```
1. Detect conflict via brain_get_global_sync_status
   ↓
2. Display SyncConflictDialog with conflicts
   ↓
3. User chooses:
   - "Keep Brain": Re-export entity to vault (overwrites)
   - "Keep Obsidian": Re-import from vault (overwrites)
   - "Resolve All": Apply same choice to all conflicts
   ↓
4. brain_resolve_conflict(entity_id, resolution)
   ↓
5. Update last_synced_at to mark as resolved
   ↓
6. Refresh sync status
```

**Automatic Conflict Policies:**
- `ask`: Show dialog every time
- `brain_wins`: Always keep Brain version (auto-export)
- `obsidian_wins`: Always keep Obsidian version (auto-import)

## Settings

### UI Settings Location
**Settings → Second Brain → Obsidian Sync**

### Available Settings

**Vault Configuration:**
- **Vault Path**: Folder picker for Obsidian vault root
- **Markdown Editor**: Choose default editor (Obsidian, VSCode, Cursor, System)
- **Open Vault**: Quick access button

**Sync Settings:**
- **Enable Sync**: Master toggle for bidirectional sync
- **Sync Structure**:
  - `subfolder`: Files in `/vault/quack-brain/`
  - `flat`: Files in `/vault/` root
- **Auto-sync to Vault**: Automatic Brain → Obsidian
- **Auto-sync from Vault**: Automatic Obsidian → Brain
- **Conflict Policy**: How to handle conflicts

**Embeddings:**
- **Auto-generate Embeddings**: Queue new entities for embedding
- **Generate All Now**: Batch process all entities without embeddings

**Actions:**
- **Sync All to Vault**: Manual full export
- **Import All from Vault**: Manual full import

**Status:**
- **Last Sync**: Formatted timestamp (e.g., "5 minutes ago")
- **Entity Count**: Total synced entities
- **Conflict Count**: Unresolved conflicts (with "Resolve" button)
- **Embedding Progress**: Percentage bar when generating

## Usage Examples

### Basic Setup

1. **Configure Vault Path:**
   ```typescript
   await updateSetting('vaultPath', '/Users/user/ObsidianVault');
   ```

2. **Enable Sync:**
   ```typescript
   await updateSetting('syncEnabled', true);
   await updateSetting('autoSyncToVault', true);
   await updateSetting('autoSyncFromVault', true);
   ```

3. **Start Watching:**
   ```typescript
   await startVaultWatcher();
   ```

### Export Entity to Vault

```typescript
import { syncEntityToVault } from '../services/obsidianSyncService';

const entityId = 'entity-123';
const filePath = await syncEntityToVault(entityId);
console.log('Synced to:', filePath);
// => /Users/user/vault/quack-brain/my_entity.md
```

### Import from Vault

```typescript
import { importFromVault } from '../services/obsidianSyncService';

const filePath = '/Users/user/vault/note.md';
const entity = await importFromVault(filePath);
console.log('Imported:', entity.name);
```

### Resolve Conflict

```typescript
import { resolveConflict } from '../services/obsidianSyncService';

// Keep Brain version
await resolveConflict('entity-123', 'brain');

// Keep Obsidian version
await resolveConflict('entity-456', 'obsidian');
```

### Subscribe to File Changes

```typescript
import { subscribeToFileChanges } from '../services/obsidianSyncService';

const unsubscribe = await subscribeToFileChanges((event) => {
  console.log(`File ${event.eventType}:`, event.path);

  if (event.eventType === 'modified') {
    // Auto-import if enabled in settings
    await importFromVault(event.path);
  }
});

// Later: stop listening
unsubscribe();
```

### React Hook Usage

```typescript
import { useObsidianSync } from '../hooks/useObsidianSync';

function SyncUI() {
  const {
    settings,
    isWatching,
    conflicts,
    isSyncing,
    updateSetting,
    syncAllToVault,
    resolveConflict,
  } = useObsidianSync();

  return (
    <div>
      <button onClick={syncAllToVault} disabled={isSyncing}>
        {isSyncing ? 'Syncing...' : 'Sync All'}
      </button>

      {conflicts.length > 0 && (
        <div>
          <h3>Conflicts ({conflicts.length})</h3>
          {conflicts.map(c => (
            <div key={c.entityId}>
              <p>{c.entityName}</p>
              <button onClick={() => resolveConflict(c.entityId, 'brain')}>
                Keep Brain
              </button>
              <button onClick={() => resolveConflict(c.entityId, 'obsidian')}>
                Keep Obsidian
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

## Future Improvements

### 1. Real Embedding Integration
**Current:** Placeholder 384-dimensional zero vectors
**Target:** Integrate Transformers.js or external API

```typescript
// Example with Transformers.js
import { pipeline } from '@xenova/transformers';

const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
const text = entity.name + ' ' + entity.observations.join(' ');
const output = await embedder(text, { pooling: 'mean', normalize: true });
const embedding = Array.from(output.data);

await invoke('brain_store_embedding', {
  entityId: entity.id,
  vector: embedding,
  model: 'all-MiniLM-L6-v2'
});
```

### 2. Manual Merge UI for Conflicts
**Current:** Binary choice (Brain or Obsidian)
**Target:** Side-by-side diff with manual merge

```
┌─────────────────┬─────────────────┐
│  Brain Version  │ Obsidian Version│
├─────────────────┼─────────────────┤
│ # Entity Name   │ # Entity Name   │
│ - Observation 1 │ - Observation 1 │
│ - Observation 2 │ - Updated obs 2 │ ← Choose
│                 │ - New obs 3     │ ← Choose
└─────────────────┴─────────────────┘
```

### 3. Batch Sync with Progress Bar
**Current:** Sequential sync with completion event
**Target:** Chunked batches with real-time progress

```typescript
window.addEventListener(SYNC_EVENTS.SYNC_PROGRESS, (e) => {
  const { current, total } = e.detail;
  setProgress((current / total) * 100);
});
```

### 4. Incremental Sync
**Current:** Full scan and import
**Target:** Only process changed files (tracked by watcher)

```typescript
const changedFiles = await invoke('brain_get_changed_files_since', {
  timestamp: lastSyncTime
});
```

### 5. Bidirectional Relations
**Current:** Entities only
**Target:** Sync relations between entities

```markdown
## Relations
- [[Related Entity]] (relates_to)
- [[Parent Entity]] (belongs_to)
```

### 6. Tag Synchronization
**Current:** Parsed from markdown, not synced back
**Target:** Bidirectional tag sync

```typescript
// Extract tags from markdown
const tags = parsed.tags; // ['#concept', '#important']

// Store in entities table or separate tags table
await invoke('brain_add_tags', { entityId, tags });
```

### 7. Background Sync Worker
**Current:** Main thread blocking during large syncs
**Target:** Web Worker or Rust async task

```typescript
const worker = new Worker('/sync-worker.js');
worker.postMessage({ action: 'sync_all' });
worker.onmessage = (e) => {
  if (e.data.type === 'progress') {
    setProgress(e.data.percent);
  }
};
```

### 8. Conflict Prevention via Lock Files
**Current:** Conflict detection after the fact
**Target:** Lock files during editing

```
vault/.quack-lock/entity-123.lock
{
  "locked_by": "quack",
  "locked_at": 1704067200,
  "expires_at": 1704070800
}
```

---

## Session Fixes (2026-01-08)

### Critical Bugs Fixed

#### 1. `get_markdown_dir()` Hardcoded Path (commands.rs:870)

**Problem:** Function was hardcoded to `~/.quack/brain/markdown`, ignoring settings.

**Before (BUG):**
```rust
fn get_markdown_dir() -> Result<std::path::PathBuf, String> {
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    let md_dir = home.join(".quack").join("brain").join("markdown");
    Ok(md_dir) // Always same path!
}
```

**After (FIXED):**
```rust
fn get_markdown_dir() -> Result<std::path::PathBuf, String> {
    let conn = get_connection()?;
    let vault_path: String = conn.query_row(
        "SELECT value FROM brain_settings WHERE key = 'vault_path'",
        [], |row| row.get(0),
    ).unwrap_or_default();

    if !vault_path.is_empty() {
        let vault_dir = std::path::PathBuf::from(&vault_path);
        let sync_structure: String = conn.query_row(
            "SELECT value FROM brain_settings WHERE key = 'sync_structure'",
            [], |row| row.get(0),
        ).unwrap_or_else(|_| "subfolder".to_string());

        return Ok(if sync_structure == "subfolder" {
            vault_dir.join("QuackBrain")
        } else {
            vault_dir
        });
    }

    // Fallback only if no vault configured
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    Ok(home.join(".quack").join("brain").join("markdown"))
}
```

#### 2. MCP Server Not Loading Global Servers (stream-claude.js:618)

**Problem:** When `cwd` was null, global MCP servers from `~/.quack/mcp/.mcp.json` were NOT loaded.

**Before (BUG):**
```javascript
if (!resolvedMcpServers && cwd) {
    resolvedMcpServers = loadMCPServersFromFile(cwd);
}
// If cwd is null, no servers loaded!
```

**After (FIXED):**
```javascript
if (!resolvedMcpServers && cwd) {
    resolvedMcpServers = loadMCPServersFromFile(cwd);
} else if (!resolvedMcpServers && !cwd) {
    resolvedMcpServers = loadGlobalMCPServers();
}
```

#### 3. Brain MCP Server Not Auto-Creating .md Files

**Problem:** The `brain-mcp-server.js` in `~/.quack/mcp/` was an old version without auto-sync logic.

**Solution:**
1. Added `shouldAutoSyncToVault()` function with detailed logging
2. Added `getMarkdownDir()` that reads settings from DB
3. Added `createEntityMarkdown()` called after entity creation
4. Must copy updated file: `cp src-tauri/node-sdk/brain-mcp-server.js ~/.quack/mcp/`

#### 4. EditSummaryBar Not Showing .md Files (ChatView.tsx:337)

**Problem:** Only `edit` and `write` tools were tracked. Brain MCP `mdFilePath` was in tool_result, not input.

**Solution:** Added parsing of `tool_result` events:
```typescript
// Track Brain MCP tool results (mdFilePath is in the result, not input)
if (event.type === 'user' && event.message?.content) {
  event.message.content.forEach((item: any) => {
    if (item.type === 'tool_result' && item.content) {
      try {
        const resultContent = typeof item.content === 'string'
          ? JSON.parse(item.content) : item.content;
        if (resultContent.mdFilePath?.endsWith('.md')) {
          fileEdits.set(resultContent.mdFilePath, {
            filePath: resultContent.mdFilePath,
            editCount: 1,
            status: 'created',
          });
        }
      } catch { /* not JSON */ }
    }
  });
}
```

#### 5. SQLite Concurrent Access (db.rs)

**Problem:** Rust and Node.js both accessing same SQLite DB without WAL mode.

**Solution:** Added `PRAGMA journal_mode = WAL;` in `init_database()`.

### Files Modified

| File | Change |
|------|--------|
| `src-tauri/src/brain/commands.rs` | Fixed `get_markdown_dir()`, added `brain_debug_settings` |
| `src-tauri/src/brain/db.rs` | Added WAL mode for concurrent access |
| `src-tauri/node-sdk/stream-claude.js` | Load global MCP servers when cwd is null |
| `src-tauri/node-sdk/brain-mcp-server.js` | Added `shouldAutoSyncToVault()`, `createEntityMarkdown()` |
| `src/components/ChatView.tsx` | Parse tool_result for mdFilePath |
| `src/components/EditSummaryBar.tsx` | Purple theme for .md files (already done) |
| `src/components/EditSummaryBar.css` | Purple/violet styles (already done) |

### Testing Commands

```bash
# 1. Check settings in database
sqlite3 ~/.quack/brain/brain.db "SELECT key, value FROM brain_settings;"

# Expected output:
# sync_enabled|true
# auto_sync_to_vault|true
# vault_path|/Users/alekdob/Desktop/Dev/brain
# sync_structure|subfolder

# 2. Test MCP server directly
cd ~/.quack/mcp && node -e "
const { spawn } = require('child_process');
const proc = spawn('node', ['brain-mcp-server.js'], { stdio: ['pipe', 'pipe', 'pipe'] });
proc.stdout.on('data', d => console.log('OUT:', d.toString()));
proc.stderr.on('data', d => console.error('ERR:', d.toString()));
proc.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'tools/list',id:1}) + '\n');
setTimeout(() => proc.kill(), 3000);
"

# 3. Verify MCP server is updated
diff ~/.quack/mcp/brain-mcp-server.js src-tauri/node-sdk/brain-mcp-server.js

# 4. Force update MCP server
cp src-tauri/node-sdk/brain-mcp-server.js ~/.quack/mcp/brain-mcp-server.js

# 5. Check for files in vault
ls -la /Users/alekdob/Desktop/Dev/brain/QuackBrain/projects/quack-app/
```

### Debugging Tips

**Check MCP server loading (look in console):**
```
[MCP] === MCP SERVER LOADING ===
[MCP] mcpServers from config: null
[MCP] cwd: /some/path or null
[MCP] resolvedMcpServers: ["brain"]
```

**Check auto-sync trigger:**
```
[BrainMCP] === AUTO-SYNC CHECK ===
[BrainMCP]   sync_enabled: raw="true" => true
[BrainMCP]   auto_sync_to_vault: raw="true" => true
[BrainMCP]   vault_path: "/Users/.../brain" => hasPath=true
[BrainMCP]   RESULT: WILL SYNC
```

**Check file tracking:**
```
[ChatView] Detected brain MCP created file: /path/to/file.md
```

### If Still Not Working

1. **Delete and reinstall MCP server:**
   ```bash
   rm -rf ~/.quack/mcp/
   # Restart Quack app - it will auto-reinstall
   ```

2. **Verify settings saved correctly:**
   ```bash
   sqlite3 ~/.quack/brain/brain.db "SELECT * FROM brain_settings;"
   ```

3. **Check file permissions:**
   ```bash
   ls -la /Users/alekdob/Desktop/Dev/brain/
   # Should be writable
   ```

4. **Rebuild app completely:**
   ```bash
   rm -rf src-tauri/target
   npm run tauri:dev
   ```

---

**Last Updated:** 2026-01-08
**Status:** Production-ready (embeddings placeholder)
**Version:** 1.1.0
