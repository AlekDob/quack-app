# MCP Memory Integration

## Overview

Quack Memory now integrates with the official MCP Memory server (`@modelcontextprotocol/server-memory`) to provide a unified memory experience. This hybrid approach combines:

1. **Quack Pattern Memory**: Fast, regex-based extraction (# trigger, patterns)
2. **MCP AI Memory**: Semantic extraction via AI (knowledge graph)

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

### File-based Loading (New in v0.3)

MCP Memory data is now automatically loaded from the file system on app startup:

1. **File location**: `~/.npm/_npx/*/node_modules/@modelcontextprotocol/server-memory/dist/memory.jsonl`
2. **Format**: JSONL (one entity/relation per line)
3. **Tauri command**: `read_mcp_memory_file` reads and parses the file
4. **Auto-load**: `mcpMemoryService.initialize()` loads data on Memory Panel open

### Data Flow

1. **AI saves memories**: During conversations, AI uses `mcp__memory__create_entities`
2. **Persisted to file**: MCP server writes to `memory.jsonl`
3. **Loaded on startup**: Quack reads the file and displays entities
4. **Live updates**: When AI uses tools, `dispatchMCPMemoryUpdate(graph)` updates UI

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

## Related Documentation

- [Quack Memory Architecture](./quack-memory-architecture.md)
- [Memory UI](./memory-ui.md)
- [Memory Foundation Implementation](./quack-memory-foundation-implementation.md)
