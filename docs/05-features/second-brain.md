# Second Brain - Knowledge Graph Integration

**Status**: Migrated to Obsidian
**Date**: January 2026
**Version**: 2.0

> **Note**: As of January 2026, the in-app Second Brain UI has been deprecated. The Knowledge Graph and Second Brain icons have been removed from the ActionIcons toolbar. **Obsidian is now the primary interface** for managing your Second Brain, with bidirectional sync via Quack Brain MCP.

## Overview

Second Brain is now powered by **Obsidian vault sync** with the Quack Brain MCP server. This provides a superior editing experience with Obsidian's rich markdown editor, graph view, and plugin ecosystem, while maintaining full integration with AI agents via MCP tools.

## Current Architecture (v2.0 - Obsidian Integration)

```
+------------------------------------------------------------------+
|                    Quack Brain System                             |
+------------------------------------------------------------------+
|  Storage                                                          |
|  +-- SQLite Database (~/.quack/brain.db) - Primary storage       |
|  +-- Obsidian Vault (QuackBrain/) - Human-readable markdown      |
+------------------------------------------------------------------+
|  MCP Server                                                       |
|  +-- brain-mcp-server.js - Exposes brain to Claude Code          |
|  +-- Tools: search, create_entity, add_observation, etc.         |
|  +-- Canvas support: read_canvas, create_canvas, update_canvas   |
+------------------------------------------------------------------+
|  Sync                                                             |
|  +-- Bidirectional: SQLite <-> Obsidian markdown files           |
|  +-- WikiLinks: [[NoteName]] tracked and visible in Graph View   |
|  +-- Daily Diary: Temporal notes linked to daily entries         |
+------------------------------------------------------------------+
```

## Key Features (Obsidian-Based)

| Feature | Description |
|---------|-------------|
| **Obsidian Graph View** | Visual knowledge graph with connections |
| **WikiLinks** | `[[NoteName]]` syntax for relations |
| **Daily Diary** | Temporal notes (bugs, tasks, decisions) linked to daily entries |
| **Tag-Based Folders** | Automatic organization by entity type |
| **Canvas Support** | Visual diagrams with text, file, and link nodes |
| **MCP Integration** | AI agents can read/write brain via tools |
| **Bidirectional Sync** | Edit in Obsidian or via MCP, changes sync both ways |

## Deprecated Features (v1.0 - In-App UI)

The following in-app features have been removed in favor of Obsidian:

| Feature | Replacement |
|---------|-------------|
| **Inline Editing** | Edit markdown files in Obsidian |
| **Zoom/Focus Mode** | Open notes directly in Obsidian |
| **Breadcrumb Navigation** | Use Obsidian's backlinks panel |
| **@mentions** | Use `[[WikiLinks]]` in Obsidian |
| **#supertags** | Entity types determined by folder location |
| **ActionIcons buttons** | Open Obsidian vault directly |

## Architecture

```
+------------------------------------------------------------------+
|                      Second Brain Tab                              |
+------------------------------------------------------------------+
|  Components                                                        |
|  +-- SecondBrainTabView.tsx (container)                           |
|  +-- OutlinerEditor.tsx (toolbar, search, main layout)            |
|  +-- InlineOutliner.tsx (bullet list with inline editing)         |
|  +-- SecondBrainSidebar.tsx (supertag filters, recent items)      |
+------------------------------------------------------------------+
|  Services                                                          |
|  +-- outlineTreeBuilder.ts (MCP graph -> tree structure)          |
|  +-- mcpMemoryService.ts (CRUD operations)                        |
+------------------------------------------------------------------+
|  Hooks                                                             |
|  +-- useOutlineTree.ts (tree state, expand/collapse, search)      |
|  +-- useSecondBrainTab.ts (tab management)                        |
+------------------------------------------------------------------+
|  Storage                                                           |
|  +-- memory.jsonl (MCP Memory file)                               |
+------------------------------------------------------------------+
```

## How It Works

### Creating Entities

**At Root Level** (Home):
```
Type a new thought... #tag @mention
```
- Plain text + Enter = creates new entity (type: `fact` by default)
- `#pattern My pattern` = creates entity with type `pattern`
- `@Alek` = creates relation to existing "Alek" entity

**Inside a Node** (Zoomed):
```
Add detail... (or #tag for new entity, @link for relation)
```
- Plain text + Enter = adds **observation** to current entity (not new entity)
- `#project New project` = creates NEW entity (escape hatch)
- `@Alek husband` = creates relation to "Alek"

### Entity Types (Supertags)

| Type | Color | Description |
|------|-------|-------------|
| `fact` | Green (#10b981) | General facts |
| `preference` | Blue (#3b82f6) | User preferences |
| `pattern` | Orange (#f97316) | Code/behavior patterns |
| `decision` | Purple (#8b5cf6) | Architectural decisions |
| `project` | Rose (#E84A7F) | Projects |
| `person` | Rose (#E84A7F) | People |
| `technology` | Cyan (#00d9ff) | Technologies/tools |
| `mistake` | Red (#ef4444) | Lessons learned |
| `context` | Gray (#6b7280) | General context |

**Custom Tags**: Any `#custom-tag` creates a new entity type with default color.

### Observations (Details)

When you zoom into a node, you see:
- **Title**: The entity's first observation (editable)
- **DETAILS section**: Additional observations (editable, addable)
- **+ Add new detail**: Input to add more observations

```
📍 Oliver, e il mio cane  #project

DETAILS (3)
- ha 12 anni
- Ha avuto 12 figli
- E un Flat-Coated Retriever
+ [Add new detail...]
```

### Relations

Relations are created via `@mentions`:
- `sono alto 190 @Alek` creates: `Alek -> has_attribute -> sono_alto_190`
- Relations appear in Knowledge Graph as connections

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Enter` | Create new bullet / Save edit |
| `Backspace` (empty) | Delete bullet |
| `Shift+Enter` | New line within bullet |
| `Arrow Up/Down` | Navigate bullets |
| `Tab/Enter` (autocomplete) | Select suggestion |
| `Escape` | Close autocomplete / Cancel edit |

## UI Components

### OutlinerEditor

Main container with:
- **Toolbar**: Title, node count, search, refresh, sidebar toggle
- **Content**: Either loading state, empty state, or InlineOutliner
- **Sidebar**: Supertag filters and recent items (collapsible)

### InlineOutliner

Core outliner with:
- **Breadcrumbs**: Navigation when zoomed
- **Zoomed Header**: Entity title with color + supertag badge
- **Details Section**: Observations list when zoomed
- **Bullet List**: Recursive tree of InlineBullet components
- **New Bullet Input**: Always visible at bottom (hidden when zoomed)

### InlineBullet

Single bullet with:
- **Bullet Point**: Colored circle (click to zoom)
- **Textarea**: Auto-resizing, inline editable content
- **Tag Badge**: Shows `#supertag` if present
- **Toggle**: Expand/collapse children (if any)

### SecondBrainSidebar

Right sidebar with:
- **+ New Thought**: Button to add new entity
- **SUPERTAGS**: Filter by entity type (with counts)
- **RECENT**: List of recently modified entities

## Integration with Knowledge Graph

The Second Brain and Knowledge Graph are **two views of the same data**:

| Aspect | Second Brain | Knowledge Graph |
|--------|--------------|-----------------|
| **View** | Hierarchical outliner | Force-directed graph |
| **Edit** | Full CRUD inline | View-only (click to edit in SB) |
| **Focus** | Single node at a time | All nodes visible |
| **Relations** | Via @mentions | Visual connections |

**Click node in Knowledge Graph** -> Opens Second Brain tab zoomed to that node.

## Implementation Files

### Frontend (TypeScript/React)

| File | Purpose |
|------|---------|
| `src/views/SecondBrainTabView.tsx` | Tab container |
| `src/views/SecondBrainTabView.css` | All styles (~800 lines) |
| `src/components/second-brain/OutlinerEditor.tsx` | Main editor component |
| `src/components/second-brain/InlineOutliner.tsx` | Bullet list + inline editing |
| `src/components/second-brain/SecondBrainSidebar.tsx` | Right sidebar |
| `src/components/second-brain/EntityAutocomplete.tsx` | @ and # autocomplete |
| `src/services/outlineTreeBuilder.ts` | MCP graph to tree converter |
| `src/hooks/useOutlineTree.ts` | Tree state management |
| `src/hooks/useSecondBrainTab.ts` | Tab opening/closing |

### Backend (Rust/Tauri)

| File | Purpose |
|------|---------|
| `src-tauri/src/fs.rs` | All MCP memory commands |
| `write_mcp_memory_entity` | Create new entity |
| `delete_mcp_memory_entity` | Delete entity + relations |
| `add_mcp_memory_observations` | Add observations |
| `update_mcp_memory_observations` | Replace all observations |
| `update_mcp_memory_entity_type` | Change entity type |
| `write_mcp_memory_relation` | Create relation |

## Tab Integration

### Opening Second Brain

1. **ActionIcons button**: Click brain icon in header
2. **Keyboard shortcut**: (not implemented yet)
3. **From Knowledge Graph**: Click any node

### Tab Properties

```typescript
interface Tab {
  type: 'second-brain';
  label: string; // "Second Brain" or truncated node name
  initialNodeId?: string; // Pre-zoom to this node
}
```

### Side Panel Behavior

When Second Brain tab is active:
- Side panel **collapses** automatically
- Content expands to **full width**
- Same behavior as Documentation and Knowledge Graph tabs

## Data Flow

```
User types "My fact #fact @Person"
         │
         ▼
InlineOutliner.handleCreateNew()
         │
         ├─► Parse #tag -> entityType = "fact"
         ├─► Parse @mention -> relation to "Person"
         ├─► Clean content -> "My fact"
         │
         ▼
mcpMemoryService.createMCPEntity()
         │
         ▼
Tauri: write_mcp_memory_entity
         │
         ▼
Appends to memory.jsonl
         │
         ▼
Event: MCP_MEMORY_UPDATED
         │
         ▼
useOutlineTree.refresh()
         │
         ▼
UI updates with new bullet
```

## Design Decisions

1. **MCP-only storage**: No dual Quack+MCP system, single source of truth
2. **Observations as details**: When zoomed, new text enriches existing entity
3. **Textarea for multiline**: Bullets can wrap to multiple lines
4. **Dynamic colors**: All UI colors follow entity type
5. **Minimal design**: No heavy backgrounds, clean interface
6. **Full-width when active**: Side panel collapses for more space

## Project-Scoped Memories

Second Brain supports **project-scoped memories** - memories that belong to a specific project vs global memories visible everywhere.

### Scope Types

| Scope | Icon | Description |
|-------|------|-------------|
| **Global** | Globe | Memories visible in all projects (user facts, preferences) |
| **Project** | Folder | Memories specific to current project (patterns, decisions) |

### How It Works

1. **Scope Selector**: In the sidebar, choose "Global" or current project name
2. **View Filters**: Tab buttons to show "All" / "Global" / "Project" memories
3. **Project Detection**: Quack auto-detects project via `.git`, `package.json`, `CLAUDE.md`

### MCP Relation

Project-scoped memories use the `belongs_to_project` relation:

```jsonl
// Entity scoped to quack-app project
{"type":"entity","name":"pattern_hooks","entityType":"pattern","observations":["Use custom hooks"]}
{"type":"relation","from":"pattern_hooks","to":"quack-app","relationType":"belongs_to_project"}
```

### Architecture

```
+------------------------------------------------------------------+
|  Project Scoping                                                  |
|  +-- useCurrentProject.ts (hook for project detection)           |
|  +-- detect_project_root (Rust command)                          |
|  +-- mcpMemoryService.ts (scope filtering functions)             |
|  +-- SecondBrainSidebar.tsx (scope selector + filters)           |
+------------------------------------------------------------------+
```

### Implementation Files

| File | Purpose |
|------|---------|
| `src/hooks/useCurrentProject.ts` | Project detection hook |
| `src-tauri/src/fs.rs` | `detect_project_root` command |
| `src/services/mcpMemoryService.ts` | `createProjectScopedEntity`, `filterEntitiesByScope` |
| `src/components/second-brain/SecondBrainSidebar.tsx` | Scope dropdown & filters |

## Related Documentation

- [Quack Brain MCP Rules](/.claude/rules/use-mcp-memory-second-brain.md) - MCP tools and entity types
- [MCP Memory Integration](./mcp-memory-integration.md) - Memory system architecture

## Changelog

### January 2026
- **Migrated to Obsidian**: In-app UI deprecated, Obsidian is now the primary interface
  - Removed Second Brain icon (Network) from ActionIcons
  - Removed Knowledge Graph icon (Brain) from ActionIcons
  - Added Obsidian vault bidirectional sync
  - Canvas support with text, file, and link nodes
  - Daily diary integration with selective temporal notes
  - Narrative descriptions for diary entries (unlimited length)

### December 2025
- **Project-Scoped Memories**: Memories can now be Global or Project-specific
  - `belongs_to_project` relation for project scoping
  - Auto project detection via marker files
- Initial implementation of Second Brain tab (v1.0 - now deprecated)
- Tana/Logseq-style inline editing
- Integration with Knowledge Graph
