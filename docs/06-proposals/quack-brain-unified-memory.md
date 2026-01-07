# Quack Brain: Unified Memory System

> **Status**: Proposal
> **Author**: Jack (PM) + Claude
> **Date**: 2025-01-05
> **Priority**: High

## Executive Summary

Refactor del sistema memoria di Quack per eliminare la dipendenza da MCP Memory (cache NPX di Claude Code) e creare un sistema unificato, standalone, con supporto Obsidian e semantic search.

## Problem Statement

### Situazione Attuale

Il sistema memoria attuale ha **due implementazioni parallele**:

| Sistema | Storage | Problema |
|---------|---------|----------|
| **Quack Memory** | `quack-memories.json` (Tauri Store) | Funziona ma limitato |
| **MCP Memory** | `~/.npm/_npx/.../memory.jsonl` | Dipende da Claude Code NPX cache |

**Issue critico**: MCP Memory funziona SOLO se l'utente ha usato Claude Code con il server memory MCP. Su computer nuovi o senza Claude Code, il sistema fallisce silenziosamente.

### Root Cause

```rust
// fs.rs:981-987 - Cerca nella cache NPX
let memory_file = entry_path
    .join("node_modules")
    .join("@modelcontextprotocol")
    .join("server-memory")
    .join("dist")
    .join("memory.jsonl");
```

## Proposed Solution: Quack Brain

### Vision

Un sistema di memoria **unificato, standalone, Obsidian-compatible** con **semantic search integrata**.

### Architecture Overview

```
~/.quack/brain/
├── brain.db                    # SQLite: entities, relations, embeddings
├── projects/
│   ├── {project-slug}/
│   │   ├── _index.md          # Auto-generated overview
│   │   ├── decisions/
│   │   │   └── {date}-{title}.md
│   │   ├── patterns/
│   │   │   └── {pattern-name}.md
│   │   ├── bugs/
│   │   │   └── {date}-{title}.md
│   │   └── notes/
│   │       └── {title}.md
│   └── ...
├── global/
│   ├── preferences.md         # User preferences
│   ├── people.md              # Contacts/collaborators
│   ├── tools.md               # Tool configurations
│   └── diary/
│       └── {YYYY-MM-DD}.md    # Daily journals
└── .obsidian/                  # Optional Obsidian config
    └── ...
```

### Database Schema

```sql
-- Core entities table
CREATE TABLE entities (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    entity_type TEXT NOT NULL,  -- 'preference', 'fact', 'decision', 'pattern', 'bug_fix', 'person', 'project'
    content TEXT NOT NULL,
    project_id TEXT,            -- NULL for global entities
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    md_file_path TEXT,          -- Path to .md file if synced
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Observations (like MCP Memory)
CREATE TABLE observations (
    id TEXT PRIMARY KEY,
    entity_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
);

-- Relations between entities
CREATE TABLE relations (
    id TEXT PRIMARY KEY,
    from_entity_id TEXT NOT NULL,
    to_entity_id TEXT NOT NULL,
    relation_type TEXT NOT NULL,  -- 'belongs_to', 'relates_to', 'depends_on', 'created_by'
    created_at INTEGER NOT NULL,
    FOREIGN KEY (from_entity_id) REFERENCES entities(id) ON DELETE CASCADE,
    FOREIGN KEY (to_entity_id) REFERENCES entities(id) ON DELETE CASCADE
);

-- Projects registry
CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    path TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL,
    last_accessed_at INTEGER NOT NULL
);

-- Vector embeddings for semantic search
CREATE TABLE embeddings (
    id TEXT PRIMARY KEY,
    entity_id TEXT NOT NULL,
    vector BLOB NOT NULL,        -- Float32 array serialized
    model TEXT NOT NULL,         -- e.g., 'all-MiniLM-L6-v2'
    created_at INTEGER NOT NULL,
    FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
);

-- Full-text search index
CREATE VIRTUAL TABLE entities_fts USING fts5(
    name,
    content,
    content='entities',
    content_rowid='rowid'
);

-- Triggers for FTS sync
CREATE TRIGGER entities_ai AFTER INSERT ON entities BEGIN
    INSERT INTO entities_fts(rowid, name, content) VALUES (new.rowid, new.name, new.content);
END;

CREATE TRIGGER entities_ad AFTER DELETE ON entities BEGIN
    INSERT INTO entities_fts(entities_fts, rowid, name, content) VALUES('delete', old.rowid, old.name, old.content);
END;

CREATE TRIGGER entities_au AFTER UPDATE ON entities BEGIN
    INSERT INTO entities_fts(entities_fts, rowid, name, content) VALUES('delete', old.rowid, old.name, old.content);
    INSERT INTO entities_fts(rowid, name, content) VALUES (new.rowid, new.name, new.content);
END;
```

### Components

#### 1. Rust Backend (Tauri Commands)

```rust
// src-tauri/src/brain/mod.rs

/// Initialize brain database
#[tauri::command]
pub async fn brain_init() -> Result<(), String>

/// Create entity
#[tauri::command]
pub async fn brain_create_entity(entity: CreateEntityInput) -> Result<Entity, String>

/// Search entities (hybrid: FTS + semantic)
#[tauri::command]
pub async fn brain_search(query: String, options: SearchOptions) -> Result<Vec<SearchResult>, String>

/// Sync entity to .md file
#[tauri::command]
pub async fn brain_sync_to_md(entity_id: String) -> Result<String, String>

/// Import from MCP Memory (migration)
#[tauri::command]
pub async fn brain_import_mcp() -> Result<ImportResult, String>

/// Export to Obsidian vault
#[tauri::command]
pub async fn brain_export_obsidian(vault_path: String) -> Result<ExportResult, String>
```

#### 2. TypeScript Service Layer

```typescript
// src/services/brainService.ts

export interface BrainService {
  // CRUD
  createEntity(input: CreateEntityInput): Promise<Entity>;
  updateEntity(id: string, updates: Partial<Entity>): Promise<Entity>;
  deleteEntity(id: string): Promise<void>;

  // Search
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  semanticSearch(query: string, limit?: number): Promise<SearchResult[]>;

  // Project-scoped
  getProjectEntities(projectPath: string): Promise<Entity[]>;
  getCurrentProjectEntities(): Promise<Entity[]>;

  // Sync
  syncToMarkdown(entityId: string): Promise<void>;
  syncAllToMarkdown(): Promise<void>;

  // Migration
  importFromMCPMemory(): Promise<ImportResult>;
  importFromQuackMemory(): Promise<ImportResult>;

  // Export
  exportToObsidian(vaultPath: string): Promise<ExportResult>;
}
```

#### 3. React Hooks

```typescript
// src/hooks/useBrain.ts
export function useBrain() {
  // Access brain service with React Query caching
}

// src/hooks/useBrainSearch.ts
export function useBrainSearch(query: string, options?: SearchOptions) {
  // Debounced search with semantic fallback
}

// src/hooks/useProjectMemories.ts
export function useProjectMemories(projectPath?: string) {
  // Get memories for current/specified project
}
```

### Markdown File Format

```markdown
---
id: "ent_abc123"
type: decision
project: quack-app
created: 2025-01-05T10:30:00Z
updated: 2025-01-05T10:30:00Z
tags: [architecture, memory, refactor]
relations:
  - type: relates_to
    target: "ent_xyz789"
---

# Use SQLite for Quack Brain Storage

## Context

We needed a unified memory system that works offline and doesn't depend on external services.

## Decision

Use SQLite with FTS5 for full-text search and store vector embeddings in the same database.

## Consequences

- **Positive**: Fully offline, portable, fast
- **Negative**: Need to manage migrations

## Observations

- [2025-01-05] Initial implementation started
- [2025-01-06] Added semantic search support
```

### Migration Strategy

#### Phase 1: Database Foundation
1. Create SQLite database schema
2. Implement Rust commands for CRUD
3. Add FTS5 search

#### Phase 2: Migration Tools
1. Import existing Quack Memory (`quack-memories.json`)
2. Import MCP Memory if available (`memory.jsonl`)
3. Deduplicate and merge

#### Phase 3: Markdown Sync
1. Generate .md files from entities
2. Watch for external .md changes (Obsidian edits)
3. Bidirectional sync

#### Phase 4: Semantic Search Integration
1. Reuse existing embedding infrastructure
2. Store embeddings in SQLite
3. Hybrid search (FTS + vector similarity)

#### Phase 5: UI Updates
1. Update Second Brain view to use new backend
2. Add Obsidian export button
3. Project-scoped memory filtering

### Integration with Existing Systems

#### Second Brain Tab
- Replace MCP Memory service calls with Brain service
- Keep same UI, new backend

#### AI Memory Injection
- Update `memoryInjector.ts` to query Brain
- Same injection format, new source

#### Semantic Search
- Reuse `memoryEmbedder.ts` and `memoryVectorStore.ts`
- Store in SQLite instead of separate files

### API Compatibility

Per mantenere compatibilità con il codice esistente:

```typescript
// Adapter per backward compatibility
export class MCPMemoryAdapter {
  async readGraph(): Promise<MCPKnowledgeGraph> {
    const entities = await brainService.getAllEntities();
    const relations = await brainService.getAllRelations();
    return { entities: this.toMCPFormat(entities), relations };
  }

  async createEntity(input: CreateMCPEntityInput): Promise<MCPEntity> {
    const entity = await brainService.createEntity(this.fromMCPFormat(input));
    return this.toMCPFormat(entity);
  }
}
```

### File Locations

| Component | Path |
|-----------|------|
| Rust module | `src-tauri/src/brain/` |
| TS service | `src/services/brainService.ts` |
| React hooks | `src/hooks/useBrain.ts` |
| Types | `src/types/brain.ts` |
| Tests | `src/tests/brain.test.ts` |

### Dependencies

**Rust**:
- `rusqlite` - SQLite bindings (già in uso)
- `serde_json` - JSON serialization (già in uso)

**TypeScript**:
- Nessuna nuova dipendenza

### Success Metrics

- [ ] Funziona su computer senza Claude Code
- [ ] Migrazione automatica da MCP Memory esistente
- [ ] Ricerca semantica < 100ms
- [ ] Export Obsidian funzionante
- [ ] Zero data loss durante migrazione

### Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Data loss durante migrazione | Backup automatico pre-migrazione |
| Performance con molte entities | Indici SQLite + pagination |
| Sync conflicts con Obsidian | Last-write-wins + conflict markers |

### Timeline Estimate

| Phase | Effort |
|-------|--------|
| Phase 1: Database | 2-3 days |
| Phase 2: Migration | 1-2 days |
| Phase 3: Markdown Sync | 2-3 days |
| Phase 4: Semantic Search | 1-2 days |
| Phase 5: UI Updates | 1-2 days |
| **Total** | **7-12 days** |

### Open Questions

1. **Obsidian sync**: Real-time watch o manual sync?
2. **Embedding model**: Usare lo stesso di semantic-search o dedicato?
3. **Multi-device sync**: Cloud sync futuro o solo local?

---

## Next Steps

1. Approvazione del piano
2. Creazione branch `feature/quack-brain`
3. Implementazione Phase 1 (Database Foundation)

## References

- Existing code: `src/services/mcpMemoryService.ts`
- Existing code: `src/services/memoryStorage.ts`
- Semantic search: `src/services/memoryEmbedder.ts`
- Second Brain UI: `src/views/SecondBrainTabView.tsx`
