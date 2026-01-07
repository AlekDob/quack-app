# Brain Vault Watcher Implementation

**Date:** 2026-01-06
**Feature:** Obsidian Vault File Watcher for Quack Brain

## Overview

Implemented a Rust-based file watcher for synchronizing Obsidian vault markdown files with the Quack Brain SQLite database. This enables bidirectional sync between Brain entities and markdown files.

## Files Created/Modified

### New Files

1. **`/Users/alekdob/Desktop/Dev/Personal/quack-app/src-tauri/src/brain/watcher.rs`**
   - VaultWatcherManager for watching Obsidian vault directories
   - Markdown parsing commands for extracting entity data
   - Import commands for syncing markdown to database

### Modified Files

1. **`/Users/alekdob/Desktop/Dev/Personal/quack-app/src-tauri/src/brain/mod.rs`**
   - Added `pub mod watcher;` and `pub use watcher::*;`

2. **`/Users/alekdob/Desktop/Dev/Personal/quack-app/src-tauri/src/lib.rs`**
   - Registered `brain::VaultWatcherManager::new()` in Tauri state
   - Added vault watcher commands to invoke_handler

## Implementation Details

### VaultWatcherManager

```rust
pub struct VaultWatcherManager {
    watcher: Arc<Mutex<Option<Debouncer<RecommendedWatcher, FileIdMap>>>>,
    vault_path: Arc<Mutex<Option<String>>>,
}
```

**Methods:**
- `start(app, vault_path)` - Start watching a vault directory
- `stop()` - Stop watching
- `is_watching()` - Check if active
- `get_vault_path()` - Get current watched path

### Tauri Events Emitted

| Event Name | Payload | Description |
|------------|---------|-------------|
| `brain:file-created` | `{ path: String, eventType: "created" }` | New .md file detected |
| `brain:file-changed` | `{ path: String, eventType: "modified" }` | Existing .md file modified |
| `brain:file-deleted` | `{ path: String, eventType: "deleted" }` | .md file removed |

### Tauri Commands

| Command | Parameters | Returns | Description |
|---------|------------|---------|-------------|
| `brain_start_vault_watcher` | `vault_path: String` | `Result<(), String>` | Start watching a vault |
| `brain_stop_vault_watcher` | - | `Result<(), String>` | Stop the watcher |
| `brain_is_vault_watching` | - | `Result<bool, String>` | Check if active |
| `brain_get_vault_path` | - | `Result<Option<String>, String>` | Get watched path |
| `brain_parse_markdown_file` | `file_path: String` | `Result<ParsedMarkdown, String>` | Parse a markdown file |
| `brain_import_markdown_file` | `file_path: String` | `Result<BrainEntity, String>` | Import markdown to database |
| `brain_scan_vault` | `vault_path: String` | `Result<Vec<String>, String>` | List all .md files |
| `brain_import_vault` | `vault_path: String` | `Result<ImportResult, String>` | Bulk import all files |

### ParsedMarkdown Structure

```rust
pub struct ParsedMarkdown {
    pub id: Option<String>,
    pub name: String,
    pub entity_type: String,
    pub project_id: Option<String>,
    pub observations: Vec<String>,
    pub sync_hash: String,
    pub tags: Vec<String>,
}
```

### Markdown Format

The watcher expects markdown files with YAML frontmatter:

```markdown
---
id: "uuid-goes-here"
type: pattern
project: "project-id"
tags: [rust, tauri]
---

# Entity Name

**Type:** `#pattern`

## Observations

- First observation
- Second observation
```

### Features

1. **Debouncing**: 500ms debounce to prevent excessive events
2. **Markdown-only**: Only watches .md files
3. **Recursive watching**: Monitors entire vault directory tree
4. **Auto ID assignment**: New files without IDs get UUIDs written back
5. **Hash tracking**: Calculates content hash for sync detection
6. **Tag extraction**: Extracts #hashtags from body content

## Usage Example (Frontend)

```typescript
import { invoke, listen } from '@tauri-apps/api';

// Start watching
await invoke('brain_start_vault_watcher', {
  vaultPath: '/Users/username/Documents/Obsidian Vault/quack-brain'
});

// Listen for file changes
const unlisten = await listen('brain:file-changed', (event) => {
  const { path, eventType } = event.payload;
  console.log(`File ${eventType}: ${path}`);

  // Import the changed file
  const entity = await invoke('brain_import_markdown_file', { filePath: path });
  console.log('Updated entity:', entity);
});

// Stop watching when done
await invoke('brain_stop_vault_watcher');
```

## Dependencies Used

- `notify` (8.2) - File system watcher
- `notify-debouncer-full` (0.6) - Debounced events
- `walkdir` (2) - Directory traversal for scanning

## Testing Notes

- Build verified with `cargo check` - passes with only warnings
- Created missing bundled rule file that was causing build failure

## Future Improvements

1. Add configurable subfolder filtering (e.g., only watch `quack-brain/` subfolder)
2. Implement conflict resolution for concurrent edits
3. Add full YAML frontmatter support (arrays, nested objects)
4. Consider using inotify-based approach for Linux performance
