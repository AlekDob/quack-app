# MCP Memory Integration

**Status**: Implemented
**Date**: December 2025
**Version**: 1.0

## Overview

Quack Memory now integrates with the official MCP Memory server (`@modelcontextprotocol/server-memory`) to provide a unified memory experience. This hybrid approach combines:

1. **Quack Pattern Memory**: Manual `#` trigger for user-created memories (orange badge)
2. **MCP AI Memory**: Automatic AI-driven extraction of salient moments (cyan badge)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Unified Memory Panel                      │
│  ┌─────────────────┐           ┌─────────────────┐          │
│  │  Quack Source   │           │   MCP Source    │          │
│  │  (Pattern-based)│           │   (AI-powered)  │          │
│  │  Orange badge   │           │   Cyan badge    │          │
│  └────────┬────────┘           └────────┬────────┘          │
│           │                             │                    │
│           └─────────────┬───────────────┘                    │
│                         │                                    │
│                 UnifiedMemoryItem                            │
│                 useUnifiedMemory                             │
└─────────────────────────────────────────────────────────────┘
```

## Components

### Services

- **`mcpMemoryService.ts`**: Bridge between MCP Memory server and Quack UI
  - Caches knowledge graph data
  - Converts MCP entities to unified format
  - Provides search and filter capabilities

### Hooks

- **`useUnifiedMemory.ts`**: Main hook for Memory Panel
  - Combines Quack and MCP memories
  - Provides CRUD operations for Quack memories
  - Dispatches events for UI updates

### Components

- **`UnifiedMemoryItem.tsx`**: Displays a single memory item with source badge
- **`UnifiedMemoryList.tsx`**: Lists and groups memories by source or category
- **`MemoryPanel.tsx`**: Main container with filtering and statistics

## Types

### MCPEntity
```typescript
interface MCPEntity {
  name: string;          // Unique identifier
  entityType: string;    // e.g., "preference", "fact", "decision"
  observations: string[]; // Facts about this entity
}
```

### MCPRelation
```typescript
interface MCPRelation {
  from: string;         // Source entity name
  to: string;           // Target entity name
  relationType: string; // e.g., "uses", "prefers", "decided"
}
```

### UnifiedMemoryItem
```typescript
interface UnifiedMemoryItem {
  id: string;
  content: string;
  category: string;
  source: 'quack' | 'mcp';
  entityName?: string;    // MCP only
  entityType?: string;    // MCP only
  relations?: MCPRelation[]; // MCP only
  quackMemory?: QuackMemory; // Quack only
}
```

## Memory Sources

### Quack Pattern Memory (Orange Badge)

- **Trigger**: Type `#` in chat to save manual memories
- **Auto-extract**: Regex patterns detect preferences, decisions, etc.
- **Storage**: Tauri Store (local JSON)
- **Features**: Verify, archive, semantic search

### MCP AI Memory (Cyan Badge)

- **Trigger**: AI automatically saves important facts
- **Uses**: `mcp__memory__create_entities`, `mcp__memory__read_graph`
- **Storage**: MCP Memory server (knowledge graph)
- **Features**: Relations, entity types, semantic understanding

## UI Features

### Statistics Panel
Shows counts for:
- Total memories (combined)
- Quack memories
- MCP memories

### Source Filter Tabs
- **All**: Show all memories
- **AI (MCP)**: Only MCP entities
- **Pattern**: Only Quack memories

### Grouping Options
- **By Source**: Group by Quack/MCP
- **By Category**: Group by type (preference, fact, etc.)
- **None**: Flat list

### Actions
- **Verify** (Quack only): Confirm memory accuracy
- **Archive** (Quack only): Hide without deleting
- **Delete**: Remove memory (MCP deletion via AI)

## How MCP Memory Works

### File-based Loading via Tauri Commands

MCP Memory data is loaded from the file system using Rust Tauri commands for secure, cross-platform file access:

**File Location Discovery**:
```
~/.npm/_npx/*/node_modules/@modelcontextprotocol/server-memory/dist/memory.jsonl
```

**Tauri Commands** (`src-tauri/src/fs.rs`):
1. `find_mcp_memory_path()`: Searches for memory.jsonl in NPX cache directories
2. `read_mcp_memory_file()`: Reads and returns raw JSONL content

**Format**: JSONL (JSON Lines - one entity/relation per line)

### Data Flow

```
AI Conversation
      │
      ▼
AI uses mcp__memory__create_entities()
      │
      ▼
MCP Server writes to memory.jsonl
      │
      ▼
Tauri command read_mcp_memory_file()
      │
      ▼
mcpMemoryService parses JSONL
      │
      ▼
Unified Memory Panel displays entities
```

**Lifecycle**:
1. **AI saves memories**: During conversations, AI uses `mcp__memory__create_entities`
2. **Persisted to file**: MCP server writes to `memory.jsonl`
3. **Loaded on app start**: Quack reads file via Tauri commands
4. **Live updates**: When AI uses MCP tools, `dispatchMCPMemoryUpdate(graph)` updates UI

### Example MCP Entity Creation (by AI)
```typescript
// AI uses this tool to save a preference
mcp__memory__create_entities({
  entities: [{
    name: "Alek_preferences",
    entityType: "preference",
    observations: [
      "Prefers TypeScript strict mode",
      "Uses dark mode in all IDEs"
    ]
  }]
})
```

### Example MCP Graph Read
```typescript
// AI reads the knowledge graph
const graph = await mcp__memory__read_graph();
// Returns { entities: [...], relations: [...] }
```

## Testing

Run MCP Memory tests:
```bash
npm test -- --run src/tests/mcpMemoryService.test.ts
```

33 tests cover:
- Entity type mapping
- Entity to unified item conversion
- Knowledge graph caching
- Search and filter operations
- Real-world scenarios

## Tips for Users

1. **Type `#` to save manual memories** - e.g., `#preference: I like dark mode`
2. **AI saves automatically** - Important decisions and facts are captured
3. **Filter by source** - Use tabs to see only Quack or MCP memories
4. **Check relations** - MCP memories may have connections to other entities

## UI Integration

### SidePanel Tab

- **Position**: After Rules tab (order: Agent Context > File Explorer > Rules > Memory)
- **Icon**: Lucide Brain icon (official, well-recognized)
- **TabId**: `"memory"`

### Source Badges

| Source | Badge Color | Description |
|--------|-------------|-------------|
| Quack | Orange (#f28c52) | User-created via `#` trigger |
| MCP | Cyan (#00bcd4) | AI-extracted salient moments |

## Implementation Files

### Frontend (TypeScript/React)

| File | Purpose |
|------|---------|
| `src/services/mcpMemoryService.ts` | Bridge between MCP server and Quack UI |
| `src/hooks/useUnifiedMemory.ts` | Main hook combining Quack + MCP memories |
| `src/components/memory/MemoryPanel.tsx` | Main container with filtering |
| `src/components/memory/UnifiedMemoryItem.tsx` | Memory card with source badge |
| `src/components/SidePanel.tsx` | Tab integration with Brain icon |

### Backend (Rust/Tauri)

| File | Purpose |
|------|---------|
| `src-tauri/src/fs.rs` | Tauri commands for file system access |
| `find_mcp_memory_path()` | Discover memory.jsonl location |
| `read_mcp_memory_file()` | Read and return file contents |

## Related Documentation

- [Quack Memory Architecture](./quack-memory-architecture.md)
- [Memory UI](./memory-ui.md)
- [Memory Foundation Implementation](./quack-memory-foundation-implementation.md)

## Changelog

### December 2025
- Implemented hybrid memory approach (# trigger + MCP AI)
- Added Tauri commands for secure file reading
- Integrated Lucide Brain icon for Memory tab
- Changed tab order: Memory after Rules
- 33 tests passing for MCP Memory service
- Unified Memory Panel with source badges and filters
