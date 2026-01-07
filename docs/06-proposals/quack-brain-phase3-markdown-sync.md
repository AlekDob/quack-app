# Quack Brain - Phase 3: Markdown Sync Implementation

**Status:** Implemented
**Branch:** feature/quack-brain
**Date:** 2025-01-05

## Overview

Phase 3 adds manual markdown synchronization to Quack Brain, allowing users to export Brain entities to Obsidian-compatible markdown files.

## Architecture

```
~/.quack/brain/
├── brain.db           # SQLite database
└── markdown/          # Generated .md files
    ├── projects/
    │   └── {project-slug}/
    │       └── {entity-name}.md
    └── global/
        ├── preferences/
        ├── patterns/
        ├── decisions/
        └── diary/
```

## Implementation Details

### 1. Rust Backend (Tauri Commands)

**File:** `src-tauri/src/brain/commands.rs`

#### New Types

```rust
#[derive(Debug, Clone, Serialize)]
pub struct SyncResult {
    pub files_created: usize,
    pub files_updated: usize,
    pub errors: Vec<String>,
}
```

#### Helper Functions

- **`get_markdown_dir()`** - Gets/creates `~/.quack/brain/markdown/`
- **`entity_to_markdown(entity: &BrainEntity) -> String`** - Generates Obsidian-compatible markdown with YAML frontmatter
- **`slugify(s: &str) -> String`** - Converts entity names to filesystem-safe names

#### Tauri Commands

1. **`brain_sync_entity_to_md(entity_id: String) -> Result<String, String>`**
   - Syncs a single entity to markdown file
   - Returns the file path where markdown was saved
   - Updates `md_file_path` in database

2. **`brain_sync_all_to_md() -> Result<SyncResult, String>`**
   - Bulk export of all entities
   - Returns statistics (created, updated, errors)
   - Non-async for thread safety

3. **`brain_get_markdown_path() -> Result<String, String>`**
   - Returns absolute path to markdown directory
   - Useful for UI display

4. **`brain_open_markdown_folder() -> Result<(), String>`**
   - Opens markdown directory in system file browser
   - Cross-platform (macOS, Windows, Linux)

### 2. TypeScript Frontend

**File:** `src/services/brainService.ts`

#### New Types

```typescript
export interface SyncResult {
  filesCreated: number;
  filesUpdated: number;
  errors: string[];
}
```

#### New Functions

```typescript
// Sync single entity to markdown
export async function syncEntityToMarkdown(entityId: string): Promise<string>

// Sync all entities to markdown
export async function syncAllToMarkdown(): Promise<SyncResult>

// Get markdown export directory path
export async function getMarkdownPath(): Promise<string>

// Open markdown folder in file browser
export async function openMarkdownFolder(): Promise<void>
```

#### BrainService Class Updates

Added markdown sync methods to singleton service:
```typescript
class BrainService {
  // ... existing methods

  syncEntityToMarkdown = syncEntityToMarkdown;
  syncAllToMarkdown = syncAllToMarkdown;
  getMarkdownPath = getMarkdownPath;
  openMarkdownFolder = openMarkdownFolder;
}
```

### 3. Command Registration

**File:** `src-tauri/src/lib.rs`

```rust
// 🧠 Quack Brain - Markdown Sync
brain::brain_sync_entity_to_md,
brain::brain_sync_all_to_md,
brain::brain_get_markdown_path,
brain::brain_open_markdown_folder,
```

## Markdown Format

### Example Output

```markdown
---
id: "entity-uuid-here"
type: pattern
project: "quack-app"
created: 1735996800
updated: 1735996800
---

# auth_pattern

**Type:** `#pattern`

## Observations

- [2025-01-05] Use JWT tokens for authentication
- [2025-01-05] Store refresh tokens in secure keychain
- [2025-01-05] Implement token rotation every 24 hours
```

### File Organization

- **Global entities** → `~/.quack/brain/markdown/global/{type}/{name}.md`
- **Project entities** → `~/.quack/brain/markdown/projects/{project}/{name}.md`

### Naming Convention

- Entity names are slugified (lowercase, alphanumeric, hyphens, underscores)
- Special characters replaced with underscores
- Whitespace replaced with hyphens

## Key Features

1. **Manual Sync Only** - No automatic file watcher (Phase 4)
2. **Obsidian Compatible** - YAML frontmatter for metadata
3. **Organized by Type/Project** - Clear directory structure
4. **Idempotent** - Safe to run multiple times
5. **Error Handling** - Collects errors without failing entire sync
6. **Path Tracking** - Stores `md_file_path` in database for future updates

## Usage Examples

### Sync All Entities

```typescript
import { brainService } from '@/services/brainService';

const result = await brainService.syncAllToMarkdown();
console.log(`Created: ${result.filesCreated}`);
console.log(`Updated: ${result.filesUpdated}`);

if (result.errors.length > 0) {
  console.warn('Errors:', result.errors);
}
```

### Sync Single Entity

```typescript
const path = await brainService.syncEntityToMarkdown('entity-id');
console.log('Synced to:', path);
```

### Open Markdown Folder

```typescript
await brainService.openMarkdownFolder();
```

## Testing

### Manual Testing Steps

1. Create test entities with observations
2. Run `syncAllToMarkdown()`
3. Verify markdown files created in `~/.quack/brain/markdown/`
4. Check YAML frontmatter is valid
5. Verify file organization (global vs project)
6. Test `openMarkdownFolder()` opens in Finder/Explorer
7. Verify idempotency (run sync twice, check no duplicates)

### Test Scenarios

- [x] Sync entity with no observations
- [x] Sync entity with multiple observations
- [x] Sync global entity (no project)
- [x] Sync project-scoped entity
- [x] Sync entity with special characters in name
- [x] Verify path tracking in database
- [x] Test cross-platform folder opening

## Future Enhancements (Phase 4)

1. **Bidirectional Sync** - Import changes from markdown files
2. **File Watcher** - Auto-sync on entity changes
3. **Conflict Resolution** - Handle concurrent edits
4. **Markdown Preview** - In-app markdown viewer
5. **Export Options** - Custom templates, multiple formats

## Notes

- **Thread Safety:** `brain_sync_all_to_md` is synchronous (not async) to avoid `Send` issues
- **Database Updates:** `md_file_path` field updated on every sync
- **Error Handling:** Individual entity errors don't stop bulk sync
- **Cross-Platform:** File browser commands work on macOS, Windows, Linux

## Compilation Status

All markdown sync functions compile successfully with `cargo check`.

Existing compilation errors are in unrelated semantic search functions added by other developers.
