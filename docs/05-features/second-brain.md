# Second Brain - Tana/Logseq-style Outliner

**Status**: Implemented
**Date**: December 2025
**Version**: 1.0

## Overview

Second Brain is a **Tana/Logseq-inspired outliner** that provides a hierarchical view of your knowledge graph. Every bullet point is an MCP Memory entity, enabling seamless integration between manual note-taking and AI-powered memory.

## Key Features

| Feature | Description |
|---------|-------------|
| **Inline Editing** | Click any bullet to edit directly, no separate forms |
| **Zoom/Focus Mode** | Click bullet point to "zoom in" - node becomes page title |
| **Breadcrumb Navigation** | Path shows `Home > Parent > Current` for easy navigation |
| **@mentions** | Create relations by typing `@EntityName` |
| **#supertags** | Define entity type with `#fact`, `#pattern`, `#project`, etc. |
| **Observations as Details** | When zoomed, new text adds observations, not new entities |
| **Custom Tags** | Create new entity types with `#custom-tag` |
| **Autocomplete** | Dropdown suggestions for @ and # while typing |
| **Bidirectional Sync** | AI-created entities appear automatically |

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

## Related Documentation

- [MCP Memory Integration](./mcp-memory-integration.md) - Memory system architecture
- [Memory UI](./memory-ui.md) - Memory panel components

## Changelog

### December 2025
- Initial implementation of Second Brain tab
- Tana/Logseq-style inline editing
- Zoom/focus mode with breadcrumbs
- Observations as details when zoomed
- @mentions for relations, #tags for types
- Autocomplete for tags and mentions
- Integration with Knowledge Graph (click to open)
- Dynamic colors based on entity type
- Side panel collapse for full-width view
