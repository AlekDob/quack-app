# Obsidian Vault Schema Specification

**Version:** 1.0.0
**Status:** Production
**Last Updated:** 2026-01-08

---

## Overview

The **Quack Brain → Obsidian Sync** system provides bidirectional synchronization between Quack's SQLite knowledge graph and an Obsidian vault. This specification defines the exact folder structure, frontmatter schema, and sync rules that AI agents and sync services must follow.

**Key Benefits:**
- **Structured Organization**: Human-readable folder hierarchy by tag type
- **Bidirectional Sync**: Edit in Quack or Obsidian, changes sync both ways
- **Temporal Context**: Every note links to its creation day's diary
- **Semantic Search**: Notes automatically indexed with vector embeddings
- **Conflict Resolution**: Graceful handling of concurrent edits

**Architecture:**
```
SQLite Database (Quack Brain) ←→ Markdown Files (Obsidian Vault)
        ↓                                    ↓
   Fast queries                      Human editing
   Relations                         Cross-device sync
   Embeddings                        Mobile access
```

---

## Vault Structure

The vault MUST follow this exact folder structure. All paths are relative to the vault root.

```
{vault-root}/
└── QuackBrain/                      # Root folder for all Quack Brain notes
    ├── diary/                       # Daily notes (tag: #diary)
    │   ├── 2026-01-07.md
    │   ├── 2026-01-08.md
    │   └── 2026-01-09.md
    │
    ├── global/                      # Notes without project scope
    │   ├── patterns/                # Reusable code patterns
    │   ├── humans/                  # People and contacts
    │   ├── ideas/                   # Ideas to explore
    │   ├── notes/                   # Generic notes
    │   └── glossary.md              # Global term mappings
    │
    └── projects/                    # Project-scoped notes
        └── {project-name}/          # e.g., "quack-app"
            ├── components/          # UI components
            ├── functions/           # Functions and methods
            ├── api/                 # API endpoints, MCP tools
            ├── patterns/            # Project-specific patterns
            ├── bugs/                # Bug fixes
            ├── decisions/           # Architectural Decision Records
            ├── tasks/               # Completed tasks
            ├── config/              # Configuration notes
            ├── ideas/               # Project ideas
            ├── todos/               # Work in progress
            └── glossary.md          # Project term mappings
```

**Rules:**
1. `QuackBrain/` MUST be at vault root unless sync_structure=flat
2. Project names MUST be valid folder names (lowercase, no spaces)
3. Folder names MUST match the tag mapping (see Tags section)

---

## Tags and Folder Mapping

Every note MUST have exactly **ONE** tag in the `tag:` frontmatter field. The tag determines the folder location.

| Tag | Folder | Description | Scope |
|-----|--------|-------------|-------|
| `#component` | `components/` | UI components (React, Vue, etc.) | Project or Global |
| `#function` | `functions/` | Functions and methods | Project or Global |
| `#api` | `api/` | API endpoints, MCP tools | Project or Global |
| `#pattern` | `patterns/` | Architectural patterns, best practices | Project or Global |
| `#bug` | `bugs/` | Bug fixes and solutions | Project or Global |
| `#decision` | `decisions/` | Architectural Decision Records (ADRs) | Project or Global |
| `#task` | `tasks/` | Completed tasks | Project or Global |
| `#config` | `config/` | Configuration notes | Project or Global |
| `#idea` | `ideas/` | Ideas to explore | Project or Global |
| `#todo` | `todos/` | Work in progress | Project or Global |
| `#human` | `global/humans/` | People and contacts | **ALWAYS Global** |
| `#note` | `notes/` | Generic notes | Project or Global |
| `#glossary` | root of project/global | Human→Technical term mapping | Project or Global |
| `#diary` | `diary/` | Daily logs | **ALWAYS Global** |

**Special Rules:**
- `#human` notes are ALWAYS placed in `global/humans/`, even if `project:` is set
- `#diary` notes are ALWAYS placed in `diary/`, even if `project:` is set
- `#glossary` notes are placed at the root of project or global (e.g., `global/glossary.md`)

---

## Frontmatter Schema

Every note MUST have YAML frontmatter at the start of the file. Frontmatter is delimited by `---` and contains metadata used for sync.

### Required Fields

These fields MUST be present in every note:

```yaml
---
id: "550e8400-e29b-41d4-a716-446655440000"  # UUID v4 (generated if missing)
tag: component                               # Single tag from the table above
date: 2026-01-08                             # Creation date (YYYY-MM-DD)
daily: "[[2026-01-08]]"                      # WikiLink to diary (auto-generated)
author: agent-jack                           # Who created this note
---
```

**Field Details:**

- **id**: UUID v4 identifier. Used to match note with database entity. If missing during import, a new UUID is generated and written back to the file.
- **tag**: Single tag from the table above (without `#`). This determines the folder location.
- **date**: Creation date in `YYYY-MM-DD` format. Must be a valid date.
- **daily**: WikiLink to the diary note for that day. Format: `"[[YYYY-MM-DD]]"`. Created automatically if missing.
- **author**: Creator name (e.g., `agent-jack`, `user`, `claude-code`).

### Optional Fields

These fields are optional but recommended for better organization:

```yaml
project: quack-app           # Project scope (null or omitted = global)
file: src/path/file.tsx      # Source file path (for code-related notes)
status: active               # active|deprecated|draft|archived
confidence: high             # high|medium|low|outdated
aliases:                     # Alternative names for search/linking
  - AltName
  - OtherName
```

**Field Details:**

- **project**: Project identifier (must match a project in the database). If omitted or `null`, the note is global.
- **file**: Absolute or relative path to the source code file this note documents.
- **status**: Lifecycle status of the note.
- **confidence**: Reliability indicator for the information.
- **aliases**: Array of alternative names. Used by Obsidian for search and linking.

### Tag-Specific Fields

Some tags require additional fields:

#### #bug

```yaml
severity: critical           # critical|high|medium|low
fixed: true                  # true|false
pr: "https://github.com/..." # Link to pull request
```

#### #decision

```yaml
status: accepted             # proposed|accepted|rejected|superseded
supersedes: "[[ADR-001]]"    # WikiLink to superseded decision
```

#### #task

```yaml
completed: 2026-01-08        # Completion date (YYYY-MM-DD)
duration: 4h                 # Time spent (human-readable)
```

#### #human

```yaml
role: Software Engineer      # Person's role
email: person@example.com    # Contact email
github: username             # GitHub username
```

---

## Markdown Body Structure

After the frontmatter, the markdown body follows a consistent structure:

### Common Template

```markdown
---
# (frontmatter here)
---

# Entity Name

**Tag:** `#tag-name`
**Project:** `[[project-name]]` (if applicable)
**Status:** Active

## Overview

Brief description of what this entity represents (1-3 sentences).

## Details

Detailed information, code examples, diagrams, etc.

## Observations

- [YYYY-MM-DD] First observation about this entity
- [YYYY-MM-DD] Second observation with more details
- [YYYY-MM-DD] Latest observation

## Relations

- [[Related Entity]] - relates_to
- [[Parent Entity]] - belongs_to_project
- [[Dependency]] - depends_on

## References

- [External Link](https://example.com)
- [[Internal Note]]
```

**Sections:**
- **# Entity Name**: H1 heading (required). Used as the entity name if different from filename.
- **Tag/Project/Status**: Metadata displayed in human-readable format.
- **Overview**: Brief summary.
- **Details**: Main content (optional, flexible structure).
- **Observations**: Timestamped list of observations (required for sync).
- **Relations**: Links to related entities (optional, future feature).
- **References**: External and internal links (optional).

---

## Templates by Tag Type

### #component Template

```markdown
---
id: "uuid-here"
tag: component
date: 2026-01-08
daily: "[[2026-01-08]]"
author: agent-jack
project: quack-app
file: src/components/ChatView.tsx
status: active
confidence: high
---

# ChatView Component

**Tag:** `#component`
**Project:** `[[quack-app]]`
**File:** `src/components/ChatView.tsx`

## Overview

Main chat interface component that handles message streaming, tool use visualization, and file edit tracking.

## Props

```typescript
interface ChatViewProps {
  sessionId: string;
  projectPath?: string;
  onClose?: () => void;
}
```

## Dependencies

- React 19.1.1
- @tauri-apps/api
- zustand (sessionStore)

## Observations

- [2026-01-08] Created with streaming support and tool visualization
- [2026-01-08] Added EditSummaryBar for tracking file changes
- [2026-01-08] Integrated with Brain MCP for knowledge graph updates

## References

- [[StreamMessage]] - Child component for rendering stream events
- [[EditSummaryBar]] - File edit tracking component
```

### #function Template

```markdown
---
id: "uuid-here"
tag: function
date: 2026-01-08
daily: "[[2026-01-08]]"
author: agent-jack
project: quack-app
file: src/services/brainService.ts
status: active
confidence: high
---

# createEntity Function

**Tag:** `#function`
**Project:** `[[quack-app]]`
**File:** `src/services/brainService.ts`

## Signature

```typescript
async function createEntity(input: CreateEntityInput): Promise<BrainEntity>
```

## Parameters

- `input.name` (string): Entity name (unique identifier)
- `input.entityType` (string): Entity type for categorization
- `input.observations` (string[]): Initial observations
- `input.projectId?` (string | null): Optional project scope

## Returns

`Promise<BrainEntity>` - The created entity with generated ID and timestamps.

## Implementation

Creates a new entity in the Quack Brain database and optionally syncs to Obsidian vault if auto-sync is enabled.

## Observations

- [2026-01-08] Added automatic UUID generation
- [2026-01-08] Integrated with Obsidian sync service
- [2026-01-08] Added validation for entity name uniqueness

## References

- [[BrainEntity]] - Entity type definition
- [[brain_create_entity]] - Rust command backend
```

### #api Template

```markdown
---
id: "uuid-here"
tag: api
date: 2026-01-08
daily: "[[2026-01-08]]"
author: agent-jack
project: quack-app
status: active
confidence: high
---

# brain_create_entity MCP Tool

**Tag:** `#api`
**Project:** `[[quack-app]]`

## Endpoint

**MCP Tool:** `brain_create_entity`
**Protocol:** Model Context Protocol (MCP)
**Server:** Brain MCP Server (`~/.quack/mcp/brain-mcp-server.js`)

## Parameters

```typescript
{
  name: string;          // Entity name (unique)
  entityType: string;    // Entity type (e.g., "pattern", "bug_fix")
  observations: string[];// Initial observations
  projectId?: string;    // Optional project scope
}
```

## Response

```typescript
{
  id: string;
  name: string;
  entityType: string;
  observations: Array<{ id: string; content: string; createdAt: number }>;
  projectId: string | null;
  createdAt: number;
  updatedAt: number;
  mdFilePath: string | null;  // Path if synced to Obsidian
}
```

## Observations

- [2026-01-08] Created for MCP Memory compatibility
- [2026-01-08] Added mdFilePath to response for UI tracking
- [2026-01-08] Auto-syncs to Obsidian if settings enabled

## References

- [[Brain MCP Server]] - Server implementation
- [[createEntity]] - Frontend wrapper function
```

### #pattern Template

```markdown
---
id: "uuid-here"
tag: pattern
date: 2026-01-08
daily: "[[2026-01-08]]"
author: agent-jack
project: quack-app
status: active
confidence: high
---

# React Error Boundary Pattern

**Tag:** `#pattern`
**Project:** `[[quack-app]]`

## Overview

Wrap individual providers with ErrorBoundary components for graceful degradation instead of wrapping entire provider tree.

## Problem

When a single provider throws an error, the entire app crashes because all providers are wrapped in one ErrorBoundary.

## Solution

```typescript
<ErrorBoundary fallback={<div>Settings unavailable</div>}>
  <SettingsProvider>
    {/* ... */}
  </SettingsProvider>
</ErrorBoundary>

<ErrorBoundary fallback={<div>Brain unavailable</div>}>
  <BrainProvider>
    {/* ... */}
  </BrainProvider>
</ErrorBoundary>
```

## Benefits

- Isolated failures
- Partial functionality preserved
- Better user experience

## Observations

- [2026-01-08] Implemented for all providers in App.tsx
- [2026-01-08] Reduced full-app crashes by 80%
- [2026-01-08] Added fallback UIs for each provider

## References

- [[ErrorBoundary]] - Error boundary component
- [[Provider Error Boundaries]] - Implementation doc
```

### #bug Template

```markdown
---
id: "uuid-here"
tag: bug
date: 2026-01-08
daily: "[[2026-01-08]]"
author: agent-jack
project: quack-app
severity: critical
fixed: true
pr: "https://github.com/user/repo/pull/123"
---

# Hardcoded Vault Path Bug

**Tag:** `#bug`
**Project:** `[[quack-app]]`
**Severity:** Critical
**Status:** Fixed

## Problem

`get_markdown_dir()` in `commands.rs` was hardcoded to `~/.quack/brain/markdown`, ignoring user's configured vault path from settings.

## Impact

- Auto-sync created files in wrong location
- User's Obsidian vault not updated
- Confusion about where files are stored

## Root Cause

Function did not read `brain_settings` table before determining directory.

## Solution

```rust
fn get_markdown_dir() -> Result<PathBuf, String> {
    let conn = get_connection()?;
    let vault_path: String = conn.query_row(
        "SELECT value FROM brain_settings WHERE key = 'vault_path'",
        [], |row| row.get(0),
    ).unwrap_or_default();

    if !vault_path.is_empty() {
        let vault_dir = PathBuf::from(&vault_path);
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

    // Fallback
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    Ok(home.join(".quack").join("brain").join("markdown"))
}
```

## Observations

- [2026-01-08] Bug discovered during sync testing
- [2026-01-08] Fixed in commit abc123
- [2026-01-08] Added debug command for testing settings

## References

- [[Obsidian Sync]] - Sync system documentation
- [[brain_debug_settings]] - Debug command
```

### #decision Template

```markdown
---
id: "uuid-here"
tag: decision
date: 2026-01-08
daily: "[[2026-01-08]]"
author: agent-jack
project: quack-app
status: accepted
---

# ADR-001: Use SQLite for Knowledge Graph

**Tag:** `#decision`
**Project:** `[[quack-app]]`
**Status:** Accepted
**Date:** 2026-01-08

## Context

Need a persistent storage solution for Quack Brain that supports:
- Full-text search
- Vector embeddings
- Concurrent access (MCP server + UI)
- Cross-platform compatibility
- Zero external dependencies

## Options Considered

1. **SQLite with FTS5 and WAL**
   - Pros: Local, fast, FTS5 built-in, WAL for concurrency
   - Cons: Limited vector search (requires custom implementation)

2. **PostgreSQL with pgvector**
   - Pros: Best vector search support, ACID guarantees
   - Cons: Requires external server, complex setup

3. **LanceDB**
   - Pros: Native vector search, embedded
   - Cons: Immature ecosystem, Rust bindings incomplete

## Decision

Use SQLite with FTS5 for full-text search and custom BLOB storage for embeddings.

## Rationale

- SQLite is already used in Tauri apps
- FTS5 provides excellent full-text search
- WAL mode supports concurrent access
- Zero external dependencies
- Can implement cosine similarity in Rust for semantic search

## Consequences

**Positive:**
- Fast local queries
- No network latency
- Easy backup (single file)
- Cross-platform compatibility

**Negative:**
- Vector search less optimized than dedicated solutions
- Manual implementation of similarity ranking

## Observations

- [2026-01-08] Decision made after benchmarking
- [2026-01-08] Implemented in db.rs with migrations
- [2026-01-08] FTS5 performs well for 10k+ entities

## References

- [[db.rs]] - Database implementation
- [[Embeddings Table]] - Vector storage schema
```

### #task Template

```markdown
---
id: "uuid-here"
tag: task
date: 2026-01-08
daily: "[[2026-01-08]]"
author: agent-jack
project: quack-app
completed: 2026-01-08
duration: 4h
status: completed
---

# Implement Obsidian Sync Auto-Export

**Tag:** `#task`
**Project:** `[[quack-app]]`
**Completed:** 2026-01-08
**Duration:** 4 hours

## Summary

Implemented automatic export of Brain entities to Obsidian vault when auto-sync is enabled in settings.

## Files Created

- `src/services/obsidianSyncService.ts` - Sync service functions
- `src/hooks/useObsidianSync.ts` - React hook for sync state
- `src/components/second-brain/SyncConflictDialog.tsx` - Conflict resolution UI

## Files Modified

- `src-tauri/src/brain/commands.rs` - Added `get_markdown_dir()` fix
- `src-tauri/node-sdk/brain-mcp-server.js` - Added auto-sync logic
- `src/components/settings/categories/SecondBrainSettings.tsx` - Added sync controls

## Testing

- Tested auto-sync on entity creation
- Verified folder structure matches spec
- Confirmed frontmatter parsing works bidirectionally
- Tested conflict resolution flow

## Observations

- [2026-01-08] Completed ahead of schedule
- [2026-01-08] Found and fixed hardcoded path bug
- [2026-01-08] Added comprehensive logging for debugging

## References

- [[Obsidian Sync]] - Feature documentation
- [[get_markdown_dir]] - Fixed function
```

### #diary Template

```markdown
---
id: "uuid-here"
tag: diary
date: 2026-01-08
daily: "[[2026-01-08]]"
author: agent-jack
---

# 2026-01-08

**Tag:** `#diary`
**Date:** Wednesday, January 8, 2026

## Notes Created Today

- [[Obsidian Vault Schema]] - #document - Comprehensive vault structure specification
- [[get_markdown_dir]] - #bug - Fixed hardcoded vault path
- [[Implement Obsidian Sync Auto-Export]] - #task - Auto-sync feature completed

## Sessions

### Session 1: Obsidian Sync (9:00 AM - 1:00 PM)

**Agent:** Agent Jack
**Goal:** Fix auto-sync issues and create schema documentation

**Work Done:**
- Fixed `get_markdown_dir()` hardcoded path bug
- Updated MCP server loading logic for global servers
- Created comprehensive vault schema specification
- Tested sync with new folder structure

**Learnings:**
- WAL mode critical for concurrent SQLite access
- Debouncing file watch events prevents spam
- Frontmatter parsing needs error handling

**Next Steps:**
- Implement real embedding generation (Transformers.js)
- Add manual conflict merge UI
- Test with large vault (1000+ notes)

## Code Statistics

- Files modified: 7
- Tests written: 3
- Bugs fixed: 4
- Features completed: 1

## Mood

Productive day! Sync system working reliably now.

## References

- [[Obsidian Sync]] - Main feature doc
- [[Brain MCP Server]] - Server implementation
```

### #human Template

```markdown
---
id: "uuid-here"
tag: human
date: 2026-01-08
daily: "[[2026-01-08]]"
author: agent-jack
role: Software Engineer
email: person@example.com
github: username
---

# Alek Dobrohotov

**Tag:** `#human`
**Role:** Product Manager & AI-First Developer
**Location:** Puglia, Italy

## Overview

Product Manager at C&C Apple Premium Partner. Creator of Quack app and ClaudeCodeNinja. Consultant specializing in Claude Code training and AI development.

## Projects

- [[quack-app]] - Personal productivity app
- [[Flow]] - Enterprise ERP system
- [[ClaudeCodeNinja]] - Gamified Claude Code learning
- [[alekdob.com]] - Portfolio and content hub

## Preferences

- **Language:** Italian for communication, English for code/docs
- **Tools:** Claude Code (primary), Cursor, v0.dev
- **Design:** Glassmorphism, mobile-first, micro-interactions
- **Philosophy:** AI-first development, 80%+ AI-generated code

## Contact

- **Email:** alek@example.com
- **GitHub:** @alekdob
- **Rate:** €500/h (consulting)

## Observations

- [2026-01-08] Created Quack Brain system
- [2025-12-15] Published first Medium article on AI development
- [2025-11-20] Launched ClaudeCodeNinja beta

## References

- [[CLAUDE.md]] - Personal coding preferences
- [[Quack Project]] - Main project context
```

### #glossary Template

```markdown
---
id: "uuid-here"
tag: glossary
date: 2026-01-08
daily: "[[2026-01-08]]"
author: agent-jack
project: quack-app
---

# Quack App Glossary

**Tag:** `#glossary`
**Project:** `[[quack-app]]`

## Overview

Mapping between human-friendly terms and technical implementation details for Quack app.

## Terms

### Brain / Second Brain
**Human Term:** "My notes", "Knowledge base"
**Technical:** Quack Brain - SQLite database with entities, observations, and relations
**Related:** [[BrainService]], [[MCP Memory]]

### Chat Session
**Human Term:** "Conversation", "Thread"
**Technical:** Session with UUID, messages, and tool use history
**Related:** [[SessionStore]], [[ChatView]]

### Agent
**Human Term:** "AI assistant", "Helper"
**Technical:** AI agent with personality (JSON config), custom system prompt
**Related:** [[Agent Personalities]], [[AgentStore]]

### Kanban Board
**Human Term:** "Task board", "To-do list"
**Technical:** Visual task management with TODO/In Progress/Done columns
**Related:** [[KanbanStore]], [[KanbanView]]

### Terminal
**Human Term:** "Command line", "Console"
**Technical:** PTY session with xterm.js renderer
**Related:** [[TerminalStore]], [[TerminalView]]

### Vault
**Human Term:** "My Obsidian notes"
**Technical:** Obsidian vault directory with markdown files
**Related:** [[Obsidian Sync]], [[VaultWatcher]]

## Observations

- [2026-01-08] Created glossary for onboarding
- [2026-01-08] Added 6 core terms
- [2026-01-08] Linked to technical documentation

## References

- [[Architecture]] - System architecture overview
- [[User Guide]] - End-user documentation
```

---

## Sync Rules

These rules MUST be followed by all sync implementations (Rust backend, TypeScript frontend, MCP server).

### Rule 1: Single Tag Rule

**Every note MUST have exactly ONE tag.**

- The `tag:` field in frontmatter contains a single tag (without `#`)
- Multiple tags are NOT supported
- If a note needs multiple categories, use observations or create separate notes

**Validation:**
```rust
if tags.len() != 1 {
    return Err("Note must have exactly one tag".to_string());
}
```

### Rule 2: Daily Link Rule

**Every note MUST link to its creation day's diary.**

- The `daily:` field in frontmatter contains a WikiLink: `"[[YYYY-MM-DD]]"`
- If the diary note doesn't exist, it MUST be created automatically
- Diary notes are in `diary/` folder with filename `YYYY-MM-DD.md`

**Auto-creation:**
```rust
let diary_path = vault_dir.join("QuackBrain/diary").join(format!("{}.md", date));
if !diary_path.exists() {
    create_diary_note(&diary_path, &date)?;
}
```

### Rule 3: Project Scoping Rule

**Notes WITH `project:` → projects/{project}/{tag-folder}/**
**Notes WITHOUT `project:` → global/{tag-folder}/**
**Exceptions: `#human` and `#diary` are ALWAYS global**

**Path Resolution:**
```rust
fn resolve_note_path(tag: &str, project: Option<&str>) -> PathBuf {
    let vault_dir = get_vault_dir()?;
    let base = vault_dir.join("QuackBrain");

    // Exceptions: always global
    if tag == "human" || tag == "diary" {
        return match tag {
            "human" => base.join("global/humans"),
            "diary" => base.join("diary"),
            _ => unreachable!(),
        };
    }

    // Project or global
    let scope_dir = if let Some(proj) = project {
        base.join(format!("projects/{}", proj))
    } else {
        base.join("global")
    };

    // Tag folder
    let tag_folder = match tag {
        "component" => "components",
        "function" => "functions",
        "api" => "api",
        "pattern" => "patterns",
        "bug" => "bugs",
        "decision" => "decisions",
        "task" => "tasks",
        "config" => "config",
        "idea" => "ideas",
        "todo" => "todos",
        "note" => "notes",
        "glossary" => return scope_dir.join("glossary.md"), // Root
        _ => "notes", // Fallback
    };

    scope_dir.join(tag_folder)
}
```

### Rule 4: WikiLinks Rule

**All references to other notes use `[[NoteName]]` syntax.**

- WikiLinks are case-insensitive in Obsidian
- Use base filename without extension: `[[Entity Name]]`, not `[[entity-name.md]]`
- Links are automatically tracked in the `wikilinks` table (future feature)

**Example:**
```markdown
## Relations

- [[ChatView Component]] - Parent component
- [[StreamMessage]] - Child component
- [[brain_create_entity]] - Uses this API
```

### Rule 5: Diary Auto-Update Rule

**When a note is created, append to that day's diary.**

**Format:**
```markdown
## Notes Created Today

- [[NoteName]] - #tag - Brief description
```

**Implementation:**
```rust
fn update_diary(date: &str, note_name: &str, tag: &str, description: &str) -> Result<(), String> {
    let diary_path = get_vault_dir()?.join(format!("QuackBrain/diary/{}.md", date));

    // Read existing content
    let mut content = fs::read_to_string(&diary_path)
        .unwrap_or_else(|_| create_diary_template(date));

    // Find or create "Notes Created Today" section
    if !content.contains("## Notes Created Today") {
        content.push_str("\n## Notes Created Today\n\n");
    }

    // Append new note
    let entry = format!("- [[{}]] - #{} - {}\n", note_name, tag, description);
    content.push_str(&entry);

    fs::write(&diary_path, content)?;
    Ok(())
}
```

### Rule 6: Conflict Detection Rule

**A conflict exists when both Brain and Obsidian versions changed since last sync.**

**Detection:**
```sql
SELECT id FROM entities
WHERE last_synced_at IS NOT NULL
  AND updated_at > last_synced_at
  AND sync_hash != calculate_current_hash();
```

**Resolution:**
- `brain_wins`: Export Brain version to Obsidian (overwrites file)
- `obsidian_wins`: Import Obsidian version to Brain (overwrites DB)
- `ask`: Show conflict dialog to user

### Rule 7: Filename Sanitization Rule

**Note filenames MUST be valid across all platforms.**

**Rules:**
- Replace spaces with underscores: `My Note` → `my_note.md`
- Remove special characters: `/\:*?"<>|` → ``
- Lowercase for consistency
- Maximum 255 characters
- Preserve alphanumeric and `-_`

**Implementation:**
```rust
fn sanitize_filename(name: &str) -> String {
    name.to_lowercase()
        .chars()
        .map(|c| match c {
            ' ' => '_',
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            c if c.is_alphanumeric() || c == '-' || c == '_' => c,
            _ => '_',
        })
        .collect::<String>()
        .chars()
        .take(255)
        .collect()
}
```

---

## Database Schema

### Entities Table (Extended Columns)

```sql
CREATE TABLE entities (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    entity_type TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    project_id TEXT,
    md_file_path TEXT,

    -- Obsidian sync columns
    sync_hash TEXT,              -- MD5 hash of markdown content
    last_synced_at INTEGER,      -- Unix timestamp of last sync
    sync_source TEXT,            -- "brain" or "obsidian" (last writer)
    vault_relative_path TEXT     -- Path relative to vault root
);

CREATE INDEX idx_entities_vault_path ON entities(vault_relative_path);
CREATE INDEX idx_entities_sync_source ON entities(sync_source);
```

**Sync Metadata:**
- `sync_hash`: MD5 hash of the markdown file content (used for change detection)
- `last_synced_at`: Timestamp when last synced (used for conflict detection)
- `sync_source`: Which side last wrote the data (`"brain"` or `"obsidian"`)
- `vault_relative_path`: Path within vault (e.g., `QuackBrain/global/patterns/my_pattern.md`)

### brain_settings Table

```sql
CREATE TABLE brain_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);
```

**Keys:**
- `vault_path`: Absolute path to Obsidian vault root
- `sync_enabled`: `"true"` | `"false"`
- `sync_structure`: `"subfolder"` | `"flat"`
- `auto_sync_to_vault`: `"true"` | `"false"`
- `auto_sync_from_vault`: `"true"` | `"false"`
- `conflict_policy`: `"ask"` | `"brain_wins"` | `"obsidian_wins"`
- `auto_embed`: `"true"` | `"false"`
- `markdown_editor`: `"obsidian"` | `"vscode"` | `"cursor"` | `"default"`

### wikilinks Table (Future)

```sql
CREATE TABLE wikilinks (
    id TEXT PRIMARY KEY,
    from_entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    to_entity_name TEXT NOT NULL,  -- Target note name (may not exist yet)
    created_at INTEGER NOT NULL
);

CREATE INDEX idx_wikilinks_from ON wikilinks(from_entity_id);
CREATE INDEX idx_wikilinks_to ON wikilinks(to_entity_name);
```

**Purpose:** Track all WikiLinks between notes for:
- Backlink generation
- Orphan detection
- Graph visualization
- Broken link detection

---

## Sync Flows

### Flow 1: Brain → Obsidian (Export)

**Trigger:** Entity created/updated in Brain, auto-sync enabled

```
1. Brain entity updated
   ↓
2. Check settings: sync_enabled && auto_sync_to_vault
   ↓
3. Generate markdown content:
   - YAML frontmatter with all metadata
   - H1 heading with entity name
   - Observations as bulleted list
   ↓
4. Calculate sync_hash (MD5 of content)
   ↓
5. Resolve file path:
   - Tag → folder mapping
   - Project scope → projects/{name}/ or global/
   - Sanitize filename
   ↓
6. Check if file exists:
   - If exists: Compare sync_hash (conflict check)
   - If new: Create directories if needed
   ↓
7. Write markdown file atomically:
   - Write to temp file
   - Rename to final path (atomic on Unix)
   ↓
8. Update entity metadata:
   - sync_hash = calculated hash
   - last_synced_at = now()
   - sync_source = "brain"
   - vault_relative_path = relative path
   ↓
9. Update diary note:
   - Append to "Notes Created Today" section
   ↓
10. Queue for embedding generation (if auto_embed enabled)
```

**Example Markdown Output:**
```markdown
---
id: "550e8400-e29b-41d4-a716-446655440000"
tag: pattern
date: 2026-01-08
daily: "[[2026-01-08]]"
author: agent-jack
project: quack-app
status: active
confidence: high
---

# React Error Boundary Pattern

**Tag:** `#pattern`
**Project:** `[[quack-app]]`

## Overview

Wrap individual providers with ErrorBoundary components for graceful degradation.

## Observations

- [2026-01-08] Implemented for all providers in App.tsx
- [2026-01-08] Reduced full-app crashes by 80%
```

### Flow 2: Obsidian → Brain (Import)

**Trigger:** Markdown file created/modified in vault, auto-sync enabled

```
1. File watcher detects change (500ms debounce)
   ↓
2. Check if file is in QuackBrain/ directory
   - If not: Ignore
   ↓
3. Emit Tauri event: brain:file-changed
   ↓
4. Frontend handler receives event
   ↓
5. Invoke backend command: brain_import_markdown_file(path)
   ↓
6. Parse markdown file:
   - Extract YAML frontmatter
   - Parse H1 heading as entity name
   - Extract observations from ## Observations section
   - Calculate sync_hash
   ↓
7. Check if entity exists (by ID in frontmatter):
   ↓
8a. Entity EXISTS:
    - Check for conflict:
      - If Brain updated_at > last_synced_at: CONFLICT
      - Else: Safe to update
    - Update entity:
      - name = parsed name
      - entityType = parsed tag
      - projectId = parsed project
    - Replace observations (full replace)
    - Update updated_at = now()
    ↓
8b. Entity DOES NOT EXIST:
    - Generate new UUID if no ID in frontmatter
    - Create new entity in database
    - Write ID back to frontmatter (update file)
    ↓
9. Update sync metadata:
   - sync_hash = calculated hash
   - last_synced_at = now()
   - sync_source = "obsidian"
   - vault_relative_path = relative path
   ↓
10. Queue for embedding generation (if auto_embed enabled)
```

**Frontmatter Auto-Fix:**
If a note is missing `id:` field, it will be generated and written back:
```markdown
---
id: "550e8400-e29b-41d4-a716-446655440000"  # <- ADDED
tag: pattern
date: 2026-01-08
daily: "[[2026-01-08]]"
---
```

### Flow 3: Conflict Detection & Resolution

**When Conflict Occurs:**
1. Entity modified in Brain (updated_at > last_synced_at)
2. File modified in Obsidian (sync_hash changed)
3. Both happened since last successful sync

**Detection:**
```sql
-- Find all entities with conflicts
SELECT
    e.id,
    e.name,
    e.updated_at AS brain_timestamp,
    e.last_synced_at AS last_sync_timestamp
FROM entities e
WHERE e.last_synced_at IS NOT NULL
  AND e.updated_at > e.last_synced_at;
```

**Resolution Process:**
```
1. Backend detects conflict during sync operation
   ↓
2. Add to conflicts list in sync result
   ↓
3. Frontend receives SyncResult with conflicts
   ↓
4. Display SyncConflictDialog with conflicts:
   - Entity name
   - Brain timestamp vs Obsidian timestamp
   - Preview of both versions (optional)
   ↓
5. User chooses resolution:
   Option A: "Keep Brain" → brain_resolve_conflict(id, "brain")
   Option B: "Keep Obsidian" → brain_resolve_conflict(id, "obsidian")
   Option C: "Resolve All Brain" → Bulk resolution
   Option D: "Resolve All Obsidian" → Bulk resolution
   ↓
6. Backend handles resolution:

   If "brain":
     - Re-export entity to markdown (overwrites file)
     - Update last_synced_at = now()
     - Update sync_source = "brain"

   If "obsidian":
     - Re-import from markdown (overwrites DB)
     - Update last_synced_at = now()
     - Update sync_source = "obsidian"
   ↓
7. Conflict marked as resolved
   ↓
8. UI refreshes sync status
```

**Automatic Conflict Policies:**
```typescript
// brain_settings table
conflict_policy: "ask" | "brain_wins" | "obsidian_wins"

// Auto-resolve based on policy
if (conflict_policy === "brain_wins") {
    await resolveConflict(entityId, "brain");
} else if (conflict_policy === "obsidian_wins") {
    await resolveConflict(entityId, "obsidian");
} else {
    // Show dialog
    setConflicts([...conflicts, newConflict]);
}
```

---

## Implementation Guidelines

### For AI Agents Creating Notes

When you create a Brain entity via MCP tools, follow these guidelines:

**1. Choose Appropriate Entity Type**

```typescript
// Good
await mcp__brain__brain_create_entity({
    name: "react_error_boundary_pattern",
    entityType: "pattern",  // Clear, specific type
    observations: ["Wrap providers individually for isolation"],
    projectId: "quack-app"
});

// Bad
await mcp__brain__brain_create_entity({
    name: "some_stuff",
    entityType: "thing",  // Too vague
    observations: ["Did some work"],
    projectId: null
});
```

**2. Use Descriptive Names**

```typescript
// Good
name: "chat_view_component"
name: "brain_create_entity_api"
name: "hardcoded_vault_path_bug"

// Bad
name: "component1"
name: "api"
name: "bug"
```

**3. Add Temporal Context to Observations**

```typescript
// Good
observations: [
    "[2026-01-08] Created with streaming support",
    "[2026-01-08] Added EditSummaryBar integration",
    "[2026-01-08] Fixed memory leak in cleanup"
]

// Bad
observations: [
    "Has streaming support",
    "Integrated with EditSummaryBar"
]
```

**4. Scope to Project When Relevant**

```typescript
// Global pattern (no project)
await mcp__brain__brain_create_entity({
    name: "react_hooks_best_practices",
    entityType: "pattern",
    projectId: null  // Global, applies everywhere
});

// Project-specific bug (scoped)
await mcp__brain__brain_create_entity({
    name: "quack_sync_bug_hardcoded_path",
    entityType: "bug",
    projectId: "quack-app"  // Specific to this project
});
```

**5. Track Files Created**

When you create markdown files via MCP, the response includes `mdFilePath`:

```typescript
const result = await mcp__brain__brain_create_entity({...});

// Result includes:
{
    id: "uuid",
    name: "entity_name",
    mdFilePath: "/Users/.../vault/QuackBrain/global/patterns/entity_name.md"
}

// Use mdFilePath to:
// - Display "Created file" notification
// - Open file in editor
// - Track in EditSummaryBar
```

### For Sync Service Implementations

**1. Always Use Atomic File Operations**

```rust
// Good: Atomic write
let temp_path = file_path.with_extension("tmp");
fs::write(&temp_path, content)?;
fs::rename(&temp_path, &file_path)?;  // Atomic on Unix

// Bad: Direct write (can corrupt on crash)
fs::write(&file_path, content)?;
```

**2. Handle Concurrent Access**

```rust
// Enable WAL mode for concurrent SQLite access
conn.execute_batch("PRAGMA journal_mode = WAL;")?;
```

**3. Validate Frontmatter**

```rust
fn validate_frontmatter(fm: &Frontmatter) -> Result<(), String> {
    // Required fields
    if fm.id.is_empty() {
        return Err("Missing required field: id".into());
    }
    if fm.tag.is_empty() {
        return Err("Missing required field: tag".into());
    }

    // Valid tag
    let valid_tags = ["component", "function", "api", ...];
    if !valid_tags.contains(&fm.tag.as_str()) {
        return Err(format!("Invalid tag: {}", fm.tag));
    }

    // Valid date format
    if !is_valid_date(&fm.date) {
        return Err(format!("Invalid date format: {}", fm.date));
    }

    Ok(())
}
```

**4. Debounce File Watcher Events**

```rust
use notify_debouncer_full::{new_debouncer, DebounceEventResult};

let debouncer = new_debouncer(
    Duration::from_millis(500),  // 500ms debounce
    None,
    move |result: DebounceEventResult| {
        match result {
            Ok(events) => handle_events(events),
            Err(e) => log::error!("Watcher error: {:?}", e),
        }
    }
)?;
```

**5. Log Sync Operations**

```rust
log::info!("🔄 Syncing entity to vault: {}", entity.name);
log::info!("📁 Vault path: {:?}", file_path);
log::info!("✅ Entity synced: {} -> {}", entity.id, file_path.display());
```

---

## Examples

### Example 1: Create Component Note

**Request (via MCP):**
```json
{
  "name": "chat_view",
  "entityType": "component",
  "observations": [
    "[2026-01-08] Main chat interface with streaming support",
    "[2026-01-08] Integrated EditSummaryBar for file tracking"
  ],
  "projectId": "quack-app"
}
```

**Generated Markdown (`projects/quack-app/components/chat_view.md`):**
```markdown
---
id: "550e8400-e29b-41d4-a716-446655440000"
tag: component
date: 2026-01-08
daily: "[[2026-01-08]]"
author: mcp-brain
project: quack-app
file: src/components/ChatView.tsx
status: active
confidence: high
---

# chat_view

**Tag:** `#component`
**Project:** `[[quack-app]]`

## Observations

- [2026-01-08] Main chat interface with streaming support
- [2026-01-08] Integrated EditSummaryBar for file tracking
```

**Diary Update (`diary/2026-01-08.md`):**
```markdown
---
id: "diary-2026-01-08"
tag: diary
date: 2026-01-08
daily: "[[2026-01-08]]"
author: system
---

# 2026-01-08

## Notes Created Today

- [[chat_view]] - #component - Main chat interface with streaming support
```

### Example 2: Import from Obsidian

**User Creates Note in Obsidian (`global/patterns/error_boundaries.md`):**
```markdown
---
tag: pattern
date: 2026-01-08
daily: "[[2026-01-08]]"
author: user
status: active
---

# React Error Boundaries

## Overview

Wrap each provider individually to prevent full-app crashes.

## Observations

- [2026-01-08] Applied to all providers in App.tsx
- [2026-01-08] Reduced crashes significantly
```

**File Watcher Detects Change → Import Process:**
1. Parse frontmatter (missing `id:` field)
2. Generate UUID: `"abc-123-def-456"`
3. Create entity in database
4. Write ID back to frontmatter:
```markdown
---
id: "abc-123-def-456"  # <- ADDED
tag: pattern
date: 2026-01-08
daily: "[[2026-01-08]]"
author: user
status: active
---
```

5. Entity now in Brain with proper sync metadata

### Example 3: Conflict Resolution

**Scenario:**
- User edits note in Obsidian: Changes observation text
- AI agent adds observation in Quack: Adds new observation
- Both happen at the same time

**Detection:**
```sql
SELECT * FROM entities
WHERE id = 'abc-123'
  AND updated_at > last_synced_at;
-- Returns conflict
```

**Conflict Dialog:**
```
┌──────────────────────────────────────────────────────┐
│  Sync Conflict Detected                              │
├──────────────────────────────────────────────────────┤
│  Entity: React Error Boundaries                      │
│                                                      │
│  Brain Version (updated 2 mins ago):                 │
│  - [2026-01-08] Applied to all providers             │
│  - [2026-01-08] Reduced crashes significantly        │
│  - [2026-01-08] Added global error handler           │ ← New
│                                                      │
│  Obsidian Version (updated 1 min ago):               │
│  - [2026-01-08] Applied to ALL PROVIDERS (not some)  │ ← Edited
│  - [2026-01-08] Reduced crashes significantly        │
│                                                      │
│  [ Keep Brain ]  [ Keep Obsidian ]  [ Cancel ]       │
└──────────────────────────────────────────────────────┘
```

**User Chooses "Keep Brain":**
```rust
brain_resolve_conflict("abc-123", "brain")
  ↓
Re-export to Obsidian (overwrites file)
  ↓
Update last_synced_at = now()
  ↓
Conflict resolved
```

---

## Testing

### Manual Testing Checklist

**Setup:**
- [ ] Configure vault path in settings
- [ ] Enable sync in settings
- [ ] Enable auto-sync to vault
- [ ] Enable auto-sync from vault
- [ ] Start vault watcher

**Test 1: Create Entity → Vault**
- [ ] Create entity via Brain UI
- [ ] Verify markdown file created in correct folder
- [ ] Check frontmatter fields are present
- [ ] Verify diary note updated
- [ ] Check file appears in Obsidian

**Test 2: Edit Obsidian → Brain**
- [ ] Edit markdown file in Obsidian
- [ ] Save file
- [ ] Wait 500ms (debounce)
- [ ] Verify entity updated in Brain UI
- [ ] Check observations synced correctly

**Test 3: Conflict Resolution**
- [ ] Edit entity in Brain (don't sync)
- [ ] Edit markdown file in Obsidian
- [ ] Trigger manual sync
- [ ] Verify conflict dialog appears
- [ ] Choose "Keep Brain"
- [ ] Verify file overwritten correctly

**Test 4: Folder Structure**
- [ ] Create notes with different tags
- [ ] Verify each goes to correct folder
- [ ] Create project-scoped notes
- [ ] Verify in `projects/{name}/` directory
- [ ] Create global notes
- [ ] Verify in `global/` directory

**Test 5: Daily Links**
- [ ] Create multiple notes on same day
- [ ] Verify all link to same diary
- [ ] Check diary "Notes Created Today" section
- [ ] Verify WikiLinks work in Obsidian

### Automated Testing

**Unit Tests (Rust):**
```rust
#[test]
fn test_sanitize_filename() {
    assert_eq!(sanitize_filename("My Component"), "my_component");
    assert_eq!(sanitize_filename("API/Endpoint"), "api_endpoint");
    assert_eq!(sanitize_filename("Bug: Fix #123"), "bug_fix_123");
}

#[test]
fn test_resolve_note_path() {
    let path = resolve_note_path("component", Some("quack-app"));
    assert_eq!(path, PathBuf::from("projects/quack-app/components"));

    let path = resolve_note_path("human", Some("quack-app"));
    assert_eq!(path, PathBuf::from("global/humans")); // Always global
}
```

**Integration Tests (TypeScript):**
```typescript
describe('Obsidian Sync', () => {
  it('should create markdown file on entity creation', async () => {
    const entity = await createEntity({
      name: 'test_component',
      entityType: 'component',
      observations: ['Test observation'],
      projectId: 'quack-app'
    });

    const filePath = entity.mdFilePath;
    expect(filePath).toContain('projects/quack-app/components/test_component.md');
    expect(await fs.pathExists(filePath)).toBe(true);
  });

  it('should import markdown file to Brain', async () => {
    const testFile = '/tmp/test_note.md';
    await fs.writeFile(testFile, `
---
tag: pattern
date: 2026-01-08
daily: "[[2026-01-08]]"
---

# Test Pattern

## Observations
- Test observation
    `);

    const entity = await importFromVault(testFile);
    expect(entity.name).toBe('test_pattern');
    expect(entity.entityType).toBe('pattern');
    expect(entity.observations[0].content).toBe('Test observation');
  });
});
```

---

## Troubleshooting

### Issue: Files Created in Wrong Location

**Symptom:** Markdown files appear in `~/.quack/brain/markdown` instead of vault

**Cause:** `get_markdown_dir()` not reading settings

**Solution:**
```bash
# Check settings
sqlite3 ~/.quack/brain/brain.db "SELECT * FROM brain_settings WHERE key='vault_path';"

# If empty, set vault path via UI or SQL
sqlite3 ~/.quack/brain/brain.db "
  INSERT OR REPLACE INTO brain_settings (key, value, updated_at)
  VALUES ('vault_path', '/Users/.../vault', strftime('%s', 'now'));
"

# Restart Quack app
```

### Issue: MCP Server Not Auto-Syncing

**Symptom:** Creating entity via MCP doesn't create markdown file

**Cause:** MCP server script outdated

**Solution:**
```bash
# Update MCP server
cp src-tauri/node-sdk/brain-mcp-server.js ~/.quack/mcp/brain-mcp-server.js

# Restart Claude Code or Quack app
```

### Issue: Conflicts Not Resolving

**Symptom:** Conflict dialog keeps showing same conflicts

**Cause:** `last_synced_at` not updating after resolution

**Solution:**
```sql
-- Manually mark conflicts as resolved
UPDATE entities
SET last_synced_at = strftime('%s', 'now') * 1000
WHERE updated_at > last_synced_at;
```

### Issue: Duplicate Notes Created

**Symptom:** Multiple notes with same name in different folders

**Cause:** Tag changed without moving file

**Solution:**
1. Delete duplicate files
2. Update entity with correct tag
3. Re-sync to vault (overwrites)

### Issue: Watcher Not Detecting Changes

**Symptom:** Edit markdown file in Obsidian, Brain doesn't update

**Cause:** Watcher not started or debounce too short

**Solution:**
```typescript
// Check watcher status
const isWatching = await isVaultWatching();
console.log('Watcher active:', isWatching);

// Start watcher if not running
if (!isWatching) {
  await startVaultWatcher();
}
```

---

## Future Enhancements

### 1. WikiLinks Tracking

**Goal:** Track all WikiLinks between notes for backlinks and graph visualization.

**Implementation:**
- Parse `[[...]]` syntax during import
- Store in `wikilinks` table
- Generate backlinks section automatically
- Show orphaned notes (no incoming links)

### 2. Tag Hierarchy

**Goal:** Support nested tags like `#pattern/react/hooks`.

**Implementation:**
- Extend `entity_type` to allow `/` separator
- Create nested folder structure
- Update path resolution logic

### 3. Attachments Support

**Goal:** Sync images and files referenced in markdown.

**Implementation:**
- Detect `![](image.png)` syntax
- Copy attachments to vault `_attachments/` folder
- Update links to relative paths
- Sync on file watcher events

### 4. Real-Time Collaboration

**Goal:** Multiple users editing same vault with conflict-free sync.

**Implementation:**
- CRDT-based merge (Automerge or Yjs)
- WebSocket for real-time updates
- Operational transformation for concurrent edits

### 5. Semantic Search UI

**Goal:** Search notes by meaning, not just keywords.

**Implementation:**
- Integrate Transformers.js for embeddings
- Cosine similarity ranking
- "Similar notes" sidebar in UI
- "Find related" command

---

## Appendix

### A. Entity Type Reference

| Entity Type | Description | Common Use Cases |
|-------------|-------------|------------------|
| `preference` | User preferences | Working style, tool preferences, design choices |
| `fact` | Project facts | Technical details, requirements, constraints |
| `decision` | Architectural decisions | ADRs, design choices, tradeoffs |
| `pattern` | Code patterns | Best practices, conventions, reusable solutions |
| `bug_fix` | Bug solutions | Tricky bugs, gotchas, lessons learned |
| `person` | People | Team members, contacts, stakeholders |
| `project` | Projects | Project metadata, context, goals |
| `diary` | Daily logs | Session summaries, daily progress |
| `document` | Documentation | Reference docs, external links |
| `gotcha` | Common pitfalls | Warnings, caveats, things to avoid |
| `tool` | Tools | Tool configurations, tips, workflows |
| `technology` | Technologies | Tech stack notes, library decisions |

### B. Relation Type Reference

| Relation Type | Description | Example |
|---------------|-------------|---------|
| `belongs_to_project` | Entity scoped to project | `"pattern_react_hooks" → "quack-app"` |
| `relates_to` | General relation | `"ChatView" → "StreamMessage"` |
| `depends_on` | Dependency | `"BrainService" → "SQLite"` |
| `created_by` | Authorship | `"task_123" → "agent_jack"` |
| `uses` | Uses technology | `"quack-app" → "React"` |
| `documented_in` | Documentation reference | `"ChatView" → "chat-view-doc.md"` |

### C. Markdown Syntax Reference

**WikiLinks:**
```markdown
[[Entity Name]]              # Link to note by name
[[Entity Name|Display Text]] # Link with custom text
[[#Heading]]                 # Link to heading in same note
[[Note#Heading]]             # Link to heading in other note
```

**Frontmatter:**
```yaml
---
key: value               # String
key: 123                 # Number
key: true                # Boolean
key: [item1, item2]      # Array
key: null                # Null
---
```

**Observations List:**
```markdown
## Observations

- [2026-01-08] Observation with date prefix
- [2026-01-08] Multiple observations
- [2026-01-08] Each with timestamp
```

---

**End of Specification**

This specification is the authoritative source for Quack Brain → Obsidian sync behavior. All implementations (Rust, TypeScript, MCP server) MUST conform to these rules. When in doubt, refer to this document.

For questions or clarifications, contact the Quack team or open an issue.

**Version History:**
- v1.0.0 (2026-01-08): Initial specification
