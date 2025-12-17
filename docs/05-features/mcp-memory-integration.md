# MCP Memory Integration (MCP-Only Architecture)

**Status**: Implemented
**Date**: December 2025
**Version**: 2.0 (MCP-Only)

## Overview

Quack Memory uses **exclusively** the MCP Memory server (`@modelcontextprotocol/server-memory`) for all memory operations. This simplified architecture provides:

- **Single source of truth**: All memories in `memory.jsonl`
- **Cross-tool sync**: Shared with Claude Code, Claude Desktop
- **Knowledge Graph**: Entities + Relations for rich connections
- **AI-native**: Claude knows how to use MCP Memory tools

> **Note**: The previous dual system (Quack + MCP) has been deprecated. All memories are now stored via MCP.

## Architecture

```
+------------------------------------------------------------------+
|                    MCP Memory System                               |
+------------------------------------------------------------------+
|  UI Layer                                                          |
|  +-- SecondBrainTabView.tsx (Tana-style outliner)                 |
|  +-- MemoryGraphTabView.tsx (Force-directed graph)                |
|  +-- MemoryPanel.tsx (sidebar stats)                              |
+------------------------------------------------------------------+
|  Service Layer                                                     |
|  +-- mcpMemoryService.ts (CRUD, cache, events)                    |
|  +-- outlineTreeBuilder.ts (graph -> tree)                        |
+------------------------------------------------------------------+
|  Tauri Commands                                                    |
|  +-- write_mcp_memory_entity (create)                             |
|  +-- delete_mcp_memory_entity (delete)                            |
|  +-- add_mcp_memory_observations (append)                         |
|  +-- update_mcp_memory_observations (replace)                     |
|  +-- update_mcp_memory_entity_type (change type)                  |
|  +-- write_mcp_memory_relation (create relation)                  |
|  +-- find_mcp_memory_path (discover file)                         |
|  +-- read_mcp_memory_file (read JSONL)                            |
+------------------------------------------------------------------+
|  Storage                                                           |
|  +-- memory.jsonl (JSONL format)                                  |
|  +-- Location: ~/.npm/_npx/*/node_modules/@modelcontextprotocol/  |
|                server-memory/dist/memory.jsonl                     |
+------------------------------------------------------------------+
```

## Data Types

### MCPEntity
```typescript
interface MCPEntity {
  name: string;           // Unique identifier (e.g., "sono_alto_190_abc123")
  entityType: string;     // Type (e.g., "fact", "pattern", "project")
  observations: string[]; // Array of facts about this entity
}
```

### MCPRelation
```typescript
interface MCPRelation {
  from: string;           // Source entity name
  to: string;             // Target entity name
  relationType: string;   // Relation type (e.g., "has_attribute", "contains")
}
```

### UnifiedMemoryItem
```typescript
interface UnifiedMemoryItem {
  id: string;              // "mcp-{entityName}"
  content: string;         // First observation (display text)
  category: string;        // Mapped from entityType
  source: 'mcp';           // Always 'mcp'
  entityName: string;      // Original entity name
  entityType: string;      // Entity type
  relations?: MCPRelation[]; // Related entities
}
```

## Memory File Format

The `memory.jsonl` file uses JSON Lines format (one JSON object per line):

```jsonl
{"type":"entity","name":"alek_preferences","entityType":"preference","observations":["Prefers TypeScript strict mode","Uses dark mode"]}
{"type":"entity","name":"quack_project","entityType":"project","observations":["Quack is a multi-agentic Tauri app"]}
{"type":"relation","from":"alek_preferences","to":"quack_project","relationType":"works_on"}
```

## Tauri Commands

### Write Operations

**write_mcp_memory_entity**
```rust
#[tauri::command]
pub async fn write_mcp_memory_entity(entity: CreateMCPEntityInput) -> Result<bool, String>
```
Creates a new entity in memory.jsonl.

**add_mcp_memory_observations**
```rust
#[tauri::command]
pub async fn add_mcp_memory_observations(
    entity_name: String,
    observations: Vec<String>
) -> Result<bool, String>
```
Appends observations to an existing entity.

**update_mcp_memory_observations**
```rust
#[tauri::command]
pub async fn update_mcp_memory_observations(
    entity_name: String,
    observations: Vec<String>
) -> Result<bool, String>
```
Replaces all observations for an entity.

**update_mcp_memory_entity_type**
```rust
#[tauri::command]
pub async fn update_mcp_memory_entity_type(
    entity_name: String,
    entity_type: String
) -> Result<bool, String>
```
Changes an entity's type (e.g., fact -> pattern).

**write_mcp_memory_relation**
```rust
#[tauri::command]
pub async fn write_mcp_memory_relation(relation: MCPRelationInput) -> Result<bool, String>
```
Creates a relation between two entities.

### Delete Operations

**delete_mcp_memory_entity**
```rust
#[tauri::command]
pub async fn delete_mcp_memory_entity(entity_name: String) -> Result<bool, String>
```
Deletes an entity and all its relations.

### Read Operations

**find_mcp_memory_path**
```rust
#[tauri::command]
pub async fn find_mcp_memory_path() -> Result<Option<String>, String>
```
Discovers the memory.jsonl file location in NPX cache.

**read_mcp_memory_file**
```rust
#[tauri::command]
pub async fn read_mcp_memory_file(path: String) -> Result<String, String>
```
Reads and returns the raw JSONL content.

## Frontend Service

### mcpMemoryService.ts

Key functions:

```typescript
// Create new entity
export async function createMCPEntity(
  content: string,
  category: MemoryCategory
): Promise<boolean>

// Delete entity
export async function deleteMCPEntity(entityName: string): Promise<boolean>

// Add observations
export async function addMCPObservations(
  entityName: string,
  observations: string[]
): Promise<boolean>

// Update observations
export async function updateMCPObservations(
  entityName: string,
  observations: string[]
): Promise<boolean>

// Update entity type
export async function updateMCPEntityType(
  entityName: string,
  entityType: string
): Promise<boolean>

// Create relation
export async function createMCPRelation(
  from: string,
  to: string,
  relationType: string
): Promise<boolean>

// Get all items
export function getCachedUnifiedItems(): UnifiedMemoryItem[]

// Search
export function searchMCPMemory(query: string): UnifiedMemoryItem[]
```

### Events

```typescript
// Dispatched when memory changes
window.dispatchEvent(new CustomEvent('MCP_MEMORY_UPDATED'));
```

## Entity Types

| Type | Color | Description |
|------|-------|-------------|
| `fact` | #10b981 (green) | General facts |
| `preference` | #3b82f6 (blue) | User preferences |
| `pattern` | #f97316 (orange) | Code/behavior patterns |
| `decision` | #8b5cf6 (purple) | Architectural decisions |
| `project` | #E84A7F (rose) | Projects |
| `person` | #E84A7F (rose) | People |
| `technology` | #00d9ff (cyan) | Technologies/tools |
| `tool` | #00d9ff (cyan) | Tools |
| `mistake` | #ef4444 (red) | Lessons learned |
| `context` | #6b7280 (gray) | General context |

Custom types use the rose color (#E84A7F) by default.

## AI Integration

The AI can use MCP Memory tools directly:

```typescript
// AI creates entities
mcp__memory__create_entities({
  entities: [{
    name: "alek_height",
    entityType: "fact",
    observations: ["Alek is 190cm tall"]
  }]
})

// AI creates relations
mcp__memory__create_relations({
  relations: [{
    from: "alek_height",
    to: "alek",
    relationType: "describes"
  }]
})

// AI reads graph
const graph = await mcp__memory__read_graph();
```

## UI Components

### Second Brain Tab
- Tana/Logseq-style outliner
- Inline editing
- @mentions for relations
- #tags for entity types
- See [second-brain.md](./second-brain.md)

### Knowledge Graph Tab
- Force-directed graph visualization
- Zoom-dependent labels/tooltips
- Click node to open in Second Brain

### Memory Panel (Sidebar)
- Entity count
- Relation count
- Quick access to Second Brain/Graph

## Data Flow

```
User adds "My fact #fact"
         │
         ▼
mcpMemoryService.createMCPEntity("My fact", "fact")
         │
         ▼
Tauri: write_mcp_memory_entity({
  name: "my_fact_abc123",
  entityType: "fact",
  observations: ["My fact"]
})
         │
         ▼
Rust appends to memory.jsonl
         │
         ▼
Event: MCP_MEMORY_UPDATED
         │
         ▼
useUnifiedMemory.refresh()
         │
         ▼
UI updates
```

## Migration from Dual System

The previous architecture had two memory sources:
- **Quack Memory** (orange badge): `quack-memories.json`
- **MCP Memory** (cyan badge): `memory.jsonl`

This has been simplified to **MCP-only**:
- All memories in `memory.jsonl`
- Single color scheme (entity type based)
- Removed: `memoryStorage.ts`, `memoryExtractor.ts`, etc.

## Implementation Files

### Frontend

| File | Purpose |
|------|---------|
| `src/services/mcpMemoryService.ts` | Core service for MCP operations |
| `src/hooks/useUnifiedMemory.ts` | React hook for memory state |
| `src/views/MemoryGraphTabView.tsx` | Knowledge Graph visualization |
| `src/views/SecondBrainTabView.tsx` | Outliner view |
| `src/components/memory/MemoryPanel.tsx` | Sidebar panel |

### Backend

| File | Purpose |
|------|---------|
| `src-tauri/src/fs.rs` | All Tauri commands |
| `src-tauri/src/lib.rs` | Command registration |

## Testing

```bash
npm test -- --run src/tests/mcpMemoryService.test.ts
```

## Related Documentation

- [Second Brain](./second-brain.md) - Outliner interface
- [Memory UI](./memory-ui.md) - UI components

## Changelog

### December 2025 - v2.0
- **BREAKING**: Migrated to MCP-only architecture
- Removed Quack Memory (quack-memories.json)
- Removed dual source badges
- Added Second Brain tab (Tana-style)
- Added Tauri commands for direct JSONL manipulation
- Colors now based on entity type, not source
- Knowledge Graph click opens Second Brain
