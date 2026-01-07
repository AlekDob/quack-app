# Quack Brain API Reference

**Version:** 1.0.0 (Phase 1)
**Last Updated:** 2026-01-05

## Overview

Quack Brain provides 13 Tauri commands for managing a local SQLite-based knowledge graph. All commands are accessible from the frontend via `invoke()`.

## Quick Start

```typescript
import { invoke } from '@tauri-apps/api/tauri';

// Create an entity
const entity = await invoke('brain_create_entity', {
  input: {
    name: 'my-pattern',
    entity_type: 'pattern',
    observations: ['This pattern works well for...'],
    project_id: null // or 'project-uuid'
  }
});

// Search entities
const results = await invoke('brain_search', {
  query: 'pattern'
});
```

## Commands Reference

### Entity Management

#### `brain_init()`
Initialize the database (automatically called on app startup).

**Returns:** `string` - Success message

```typescript
const message = await invoke('brain_init');
// "Database initialized successfully"
```

---

#### `brain_create_entity(input: CreateEntityInput)`
Create a new entity with observations.

**Input:**
```typescript
{
  name: string;              // Unique entity name
  entity_type: string;       // E.g., 'pattern', 'bug_fix', 'decision'
  observations: string[];    // Array of observation contents
  project_id?: string;       // Optional project UUID
}
```

**Returns:** `BrainEntity`

**Example:**
```typescript
const entity = await invoke('brain_create_entity', {
  input: {
    name: 'auth-pattern-jwt',
    entity_type: 'pattern',
    observations: [
      'Using JWT with httpOnly cookies for security',
      'Refresh tokens stored in secure storage',
      'Access tokens expire after 15 minutes'
    ],
    project_id: 'quack-app-uuid'
  }
});
```

---

#### `brain_update_entity(id: string, updates: UpdateEntityInput)`
Update entity metadata (name or type).

**Input:**
```typescript
{
  name?: string;
  entity_type?: string;
}
```

**Returns:** `BrainEntity`

**Example:**
```typescript
const updated = await invoke('brain_update_entity', {
  id: 'entity-uuid',
  updates: {
    name: 'auth-pattern-jwt-v2',
    entity_type: 'pattern'
  }
});
```

---

#### `brain_delete_entity(id: string)`
Delete an entity and all its observations (cascading).

**Returns:** `void`

**Example:**
```typescript
await invoke('brain_delete_entity', { id: 'entity-uuid' });
```

---

#### `brain_get_entity(id: string)`
Fetch a single entity with all observations.

**Returns:** `BrainEntity`

**Example:**
```typescript
const entity = await invoke('brain_get_entity', { id: 'entity-uuid' });
console.log(entity.observations);
```

---

#### `brain_list_entities(filters: EntityFilters)`
List entities with optional filtering.

**Filters:**
```typescript
{
  project_id?: string;       // Filter by project
  entity_type?: string;      // Filter by type
  search_query?: string;     // Reserved for future use
}
```

**Returns:** `BrainEntity[]`

**Example:**
```typescript
// Get all patterns for current project
const patterns = await invoke('brain_list_entities', {
  filters: {
    project_id: 'quack-app-uuid',
    entity_type: 'pattern'
  }
});

// Get all entities (no filter)
const all = await invoke('brain_list_entities', {
  filters: {}
});
```

---

### Search

#### `brain_search(query: string)`
Full-text search across entity names using SQLite FTS5.

**Returns:** `SearchResult[]`

**Example:**
```typescript
const results = await invoke('brain_search', {
  query: 'authentication'
});

results.forEach(result => {
  console.log(`${result.entity.name} (score: ${result.score})`);
});
```

**Note:** FTS5 supports:
- Simple queries: `"authentication"`
- Phrase queries: `"jwt token"`
- Boolean: `"jwt AND security"`
- Prefix: `"auth*"`

---

### Observations

#### `brain_add_observation(entity_id: string, content: string)`
Add an observation to an existing entity.

**Returns:** `BrainObservation`

**Example:**
```typescript
const obs = await invoke('brain_add_observation', {
  entity_id: 'entity-uuid',
  content: '[2026-01-05] Updated to use RS256 instead of HS256'
});
```

**Best Practice:** Prefix observations with `[YYYY-MM-DD]` for temporal tracking.

---

#### `brain_delete_observation(id: string)`
Delete a specific observation.

**Returns:** `void`

**Example:**
```typescript
await invoke('brain_delete_observation', { id: 'observation-uuid' });
```

---

### Relations

#### `brain_create_relation(from_entity_id: string, to_entity_id: string, relation_type: string)`
Create a directed relation between two entities.

**Returns:** `BrainRelation`

**Example:**
```typescript
const relation = await invoke('brain_create_relation', {
  from_entity_id: 'pattern-uuid',
  to_entity_id: 'project-uuid',
  relation_type: 'belongs_to_project'
});
```

**Common relation types:**
- `belongs_to_project`
- `depends_on`
- `related_to`
- `implements`
- `fixes`

---

#### `brain_delete_relation(id: string)`
Delete a relation.

**Returns:** `void`

**Example:**
```typescript
await invoke('brain_delete_relation', { id: 'relation-uuid' });
```

---

### Graph

#### `brain_get_graph()`
Get the complete knowledge graph (all entities and relations).

**Returns:** `BrainGraph`

**Example:**
```typescript
const graph = await invoke('brain_get_graph');
console.log(`Entities: ${graph.entities.length}`);
console.log(`Relations: ${graph.relations.length}`);

// Visualize graph
graph.relations.forEach(rel => {
  console.log(`${rel.from_entity_id} --[${rel.relation_type}]--> ${rel.to_entity_id}`);
});
```

**Warning:** This loads all data into memory. For large graphs (10k+ entities), use filtered queries instead.

---

### Projects

#### `brain_register_project(name: string, path: string)`
Register or update a project in the registry.

**Returns:** `BrainProject`

**Example:**
```typescript
const project = await invoke('brain_register_project', {
  name: 'quack-app',
  path: '/Users/alekdob/Desktop/Dev/Personal/quack-app'
});

// Use project.id for entity scoping
```

**Note:** If project with same path exists, updates `last_accessed_at`.

---

## TypeScript Types

```typescript
export interface BrainEntity {
  id: string;
  name: string;
  entity_type: string;
  observations: BrainObservation[];
  project_id: string | null;
  created_at: number;        // Unix timestamp (seconds)
  updated_at: number;        // Unix timestamp (seconds)
  md_file_path: string | null;
}

export interface BrainObservation {
  id: string;
  content: string;
  created_at: number;
}

export interface BrainRelation {
  id: string;
  from_entity_id: string;
  to_entity_id: string;
  relation_type: string;
  created_at: number;
}

export interface BrainProject {
  id: string;
  name: string;
  path: string;
  created_at: number;
  last_accessed_at: number;
}

export interface BrainGraph {
  entities: BrainEntity[];
  relations: BrainRelation[];
}

export interface SearchResult {
  entity: BrainEntity;
  score: number;
}

// Input types
export interface CreateEntityInput {
  name: string;
  entity_type: string;
  observations: string[];
  project_id?: string;
}

export interface UpdateEntityInput {
  name?: string;
  entity_type?: string;
}

export interface EntityFilters {
  project_id?: string;
  entity_type?: string;
  search_query?: string;
}
```

## Entity Types

Recommended entity types (following MCP Memory conventions):

- `pattern` - Code patterns and best practices
- `bug_fix` - Solutions to bugs
- `decision` - Architectural or technical decisions
- `preference` - User preferences
- `gotcha` - Common pitfalls and how to avoid them
- `tool` - Tools and their configurations
- `project` - Project metadata
- `fact` - General facts
- `person` - People references
- `technology` - Technologies used

**Custom types:** You can define any type - these are just conventions.

## Error Handling

All commands return `Result<T, String>`. Errors are thrown as strings.

```typescript
try {
  const entity = await invoke('brain_get_entity', { id: 'invalid-id' });
} catch (error) {
  console.error('Failed to get entity:', error);
  // "Entity not found: no rows in result set"
}
```

## Database Location

- **macOS/Linux:** `~/.quack/brain/brain.db`
- **Windows:** `C:\Users\{username}\.quack\brain\brain.db`

## Best Practices

### 1. Project Scoping
Always register projects and use `project_id` for scoping:
```typescript
const project = await invoke('brain_register_project', {
  name: 'my-app',
  path: '/path/to/my-app'
});

await invoke('brain_create_entity', {
  input: {
    name: 'feature-pattern',
    entity_type: 'pattern',
    observations: ['...'],
    project_id: project.id  // ✅ Scoped to project
  }
});
```

### 2. Temporal Observations
Prefix observations with dates:
```typescript
await invoke('brain_add_observation', {
  entity_id: id,
  content: '[2026-01-05] Discovered performance issue with large datasets'
});
```

### 3. Unique Names
Entity names must be unique across the entire database:
```typescript
// ❌ Will fail if exists
await invoke('brain_create_entity', {
  input: { name: 'pattern', ... }
});

// ✅ Use descriptive, unique names
await invoke('brain_create_entity', {
  input: { name: 'auth-jwt-pattern-v2', ... }
});
```

### 4. Relation Direction
Relations are directed (from → to). Choose meaningful types:
```typescript
// ✅ Clear direction
brain_create_relation(pattern_id, project_id, 'belongs_to_project');
brain_create_relation(bug_id, pattern_id, 'fixed_by');

// ❌ Ambiguous
brain_create_relation(pattern_id, project_id, 'related');
```

### 5. Search Optimization
Use specific queries for better results:
```typescript
// ❌ Too generic
await invoke('brain_search', { query: 'a' });

// ✅ Specific terms
await invoke('brain_search', { query: 'authentication JWT' });
```

## Performance Notes

- **Entities:** Scales to 100k+ entities
- **FTS5 Search:** Near-instant for most queries
- **Graph Operations:** `brain_get_graph()` loads all data - use filters for large graphs
- **Connections:** New connection per command (acceptable overhead for local DB)

## Future Enhancements (Phase 2+)

- ✅ **Semantic search** via embeddings table
- ✅ **Batch operations** for bulk imports
- ✅ **Transactions** for atomic multi-step operations
- ✅ **Async operations** for large graphs
- ✅ **Graph queries** with recursive CTEs
- ✅ **Markdown sync** via `md_file_path` field

## Examples

### Save a Bug Fix
```typescript
const bugFix = await invoke('brain_create_entity', {
  input: {
    name: 'bug-dropdown-z-index',
    entity_type: 'bug_fix',
    observations: [
      '[2026-01-05] Dropdown was hidden behind modal',
      'Solution: Added z-index: 1000 to dropdown container',
      'Also fixed related issue with tooltips'
    ],
    project_id: projectId
  }
});
```

### Link Pattern to Project
```typescript
const pattern = await invoke('brain_create_entity', {
  input: {
    name: 'react-custom-hooks',
    entity_type: 'pattern',
    observations: ['Always use custom hooks for reusable logic'],
    project_id: null
  }
});

await invoke('brain_create_relation', {
  from_entity_id: pattern.id,
  to_entity_id: projectId,
  relation_type: 'belongs_to_project'
});
```

### Search and Filter
```typescript
// Search for authentication patterns
const authResults = await invoke('brain_search', {
  query: 'authentication'
});

// Filter by project
const projectPatterns = await invoke('brain_list_entities', {
  filters: {
    project_id: projectId,
    entity_type: 'pattern'
  }
});
```

---

**Maintained by:** Quack Agency Product Team
**Support:** See `/docs/06-proposals/quack-brain-unified-memory.md` for architecture details
