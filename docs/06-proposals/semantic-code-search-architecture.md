# Quack Semantic Code Search - Architecture Proposal

**Date:** 2026-01-05
**Status:** Draft
**Author:** Agent Jack (PM) + Code Explorer Droids

---

## Executive Summary

Implementare ricerca semantica del codice in Quack per permettere agli agenti AI di trovare codice per "significato" invece che solo per keyword. Questo risolve il problema critico di **consumo token/tempo** ogni volta che un agente deve esplorare il codebase.

**Benefici attesi (da Pommel benchmarks):**
- **422x** riduzione token (~500 vs ~211K)
- **1000x** più veloce (22ms vs 15-30s)
- **93%** accuracy su known-good queries

---

## Opzioni di Implementazione

### Opzione A: Pommel come MCP Server (Wrapper)

**Descrizione:** Wrappare Pommel (Go binary) come MCP server che Quack chiama via stdio.

```
┌─────────────────────────────────────────────────────────┐
│                    OPZIONE A                             │
├─────────────────────────────────────────────────────────┤
│  Quack App                                               │
│     │                                                    │
│     ├─► MCP: semantic-search-mcp-server.js              │
│     │         │                                          │
│     │         └─► Shell exec: `pm search "query"`       │
│     │                    │                               │
│     │                    ▼                               │
│     │              pommeld (Go daemon)                   │
│     │              .pommel/index.db                      │
│     │                                                    │
└─────────────────────────────────────────────────────────┘
```

**Pro:**
- ✅ Velocissimo da implementare (1-2 giorni)
- ✅ Pommel già testato e production-ready
- ✅ 33+ linguaggi supportati out-of-box
- ✅ Hybrid search (vector + keyword) già ottimizzato

**Contro:**
- ❌ Dipendenza esterna Go (Homebrew install)
- ❌ Richiede Ollama installato separatamente
- ❌ Non integrato nell'UI Quack (solo MCP tools)
- ❌ Manutenzione dipende da progetto esterno

**Effort:** 2-3 giorni

---

### Opzione B: Quack Code Index Nativo (Rust + Node)

**Descrizione:** Costruire sistema nativo integrato in Tauri con backend Rust e MCP server Node.js.

```
┌─────────────────────────────────────────────────────────┐
│                    OPZIONE B                             │
├─────────────────────────────────────────────────────────┤
│  Quack App                                               │
│     │                                                    │
│     ├─► Tauri Commands (Rust)                           │
│     │   ├── semantic_search()                           │
│     │   ├── index_project()                             │
│     │   └── get_index_status()                          │
│     │         │                                          │
│     │         ▼                                          │
│     │   ┌─────────────────────┐                         │
│     │   │ Rust Backend        │                         │
│     │   │ • rusqlite          │                         │
│     │   │ • sqlite-vec        │                         │
│     │   │ • tree-sitter       │                         │
│     │   │ • notify (watcher)  │                         │
│     │   └─────────────────────┘                         │
│     │         │                                          │
│     │         ▼                                          │
│     │   code-index/[project].db                         │
│     │                                                    │
│     ├─► MCP: semantic-search-mcp-server.js              │
│     │   (wraps Tauri commands)                          │
│     │                                                    │
│     └─► UI: SemanticSearchPanel.tsx                     │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Pro:**
- ✅ Controllo totale, no dipendenze esterne
- ✅ Integrato nell'UI Quack (search bar, inline results)
- ✅ Performance ottimale (Rust native)
- ✅ Embeddings locali via EmbedAnything crate

**Contro:**
- ❌ Effort significativo (2-3 settimane MVP)
- ❌ Richiede port di chunking logic a Rust
- ❌ Complessità embeddings in Rust
- ❌ Meno linguaggi supportati inizialmente

**Effort:** 15-20 giorni

---

### Opzione C: Ibrido Node.js (RACCOMANDATO)

**Descrizione:** MCP server Node.js che riusa pattern Quack esistenti + librerie JS mature.

```
┌─────────────────────────────────────────────────────────┐
│                    OPZIONE C (RACCOMANDATO)              │
├─────────────────────────────────────────────────────────┤
│  Quack App                                               │
│     │                                                    │
│     ├─► MCP: semantic-search-mcp-server.js              │
│     │   │                                                │
│     │   ├── tree-sitter (npm)      → AST chunking       │
│     │   ├── @xenova/transformers   → Local embeddings   │
│     │   ├── better-sqlite3         → Vector DB          │
│     │   └── chokidar               → File watcher       │
│     │         │                                          │
│     │         ▼                                          │
│     │   ~/Library/.../code-index/                       │
│     │   └── [project-hash].db                           │
│     │                                                    │
│     ├─► Tauri: notify watcher → triggers MCP reindex    │
│     │                                                    │
│     └─► UI: SemanticSearchPanel.tsx (Phase 2)           │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Pro:**
- ✅ Segue pattern MCP esistente (kanban, IDE servers)
- ✅ Transformers.js per embeddings locali (no Ollama)
- ✅ tree-sitter-typescript/javascript già maturi
- ✅ Medio effort con massimo valore
- ✅ Facilmente estendibile

**Contro:**
- ❌ Performance inferiore a Rust (ma accettabile per query)
- ❌ Embeddings più lenti di Ollama (ma zero setup)
- ❌ Memoria Node.js durante indexing (~200-500MB)

**Effort:** 7-10 giorni

---

## Architettura Proposta (Opzione C)

### Stack Tecnologico

| Component | Library | Version | Notes |
|-----------|---------|---------|-------|
| AST Parsing | tree-sitter | 0.21.x | + language grammars |
| Embeddings | @xenova/transformers | 2.10.x | Local, no API |
| Model | all-MiniLM-L6-v2 | - | 384-dim, 23MB |
| Vector DB | better-sqlite3 | 9.x | + sqlite-vec |
| File Watch | chokidar | 3.x | Cross-platform |
| MCP Server | @modelcontextprotocol/sdk | 1.25.x | stdio transport |

### Database Schema

```sql
-- Files table
CREATE TABLE files (
    id INTEGER PRIMARY KEY,
    path TEXT NOT NULL UNIQUE,
    project_path TEXT NOT NULL,
    content_hash TEXT,
    language TEXT,
    modified_at INTEGER,
    indexed_at INTEGER
);

-- Chunks table
CREATE TABLE chunks (
    id INTEGER PRIMARY KEY,
    file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    level TEXT NOT NULL,  -- 'file' | 'class' | 'function' | 'method'
    name TEXT,
    start_line INTEGER,
    end_line INTEGER,
    content TEXT,
    content_hash TEXT,
    parent_id INTEGER REFERENCES chunks(id)
);

-- Embeddings (sqlite-vec virtual table)
CREATE VIRTUAL TABLE chunk_embeddings USING vec0(
    chunk_id INTEGER PRIMARY KEY,
    embedding FLOAT[384]  -- all-MiniLM-L6-v2
);

-- Full-text search
CREATE VIRTUAL TABLE chunks_fts USING fts5(
    content,
    name,
    content='chunks',
    content_rowid='id'
);

-- Indexes
CREATE INDEX idx_files_project ON files(project_path);
CREATE INDEX idx_files_hash ON files(content_hash);
CREATE INDEX idx_chunks_file ON chunks(file_id);
CREATE INDEX idx_chunks_level ON chunks(level);
```

### MCP Tools

```javascript
const TOOLS = [
  {
    name: 'semantic_search_code',
    description: 'Search codebase by semantic meaning. Returns relevant code chunks with scores.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural language search query' },
        projectPath: { type: 'string', description: 'Project to search in' },
        level: {
          type: 'string',
          enum: ['file', 'class', 'function', 'all'],
          default: 'all'
        },
        limit: { type: 'number', default: 10 },
        pathFilter: { type: 'string', description: 'Glob pattern to filter paths' }
      },
      required: ['query', 'projectPath']
    }
  },
  {
    name: 'index_project',
    description: 'Index a project for semantic search. Runs in background.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: { type: 'string' },
        patterns: {
          type: 'array',
          items: { type: 'string' },
          default: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx']
        },
        ignorePatterns: {
          type: 'array',
          default: ['**/node_modules/**', '**/dist/**', '**/.git/**']
        }
      },
      required: ['projectPath']
    }
  },
  {
    name: 'get_index_status',
    description: 'Get indexing status for a project.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: { type: 'string' }
      },
      required: ['projectPath']
    }
  },
  {
    name: 'reindex_file',
    description: 'Reindex a single file (triggered by file watcher).',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { type: 'string' },
        projectPath: { type: 'string' }
      },
      required: ['filePath', 'projectPath']
    }
  }
];
```

### Search Pipeline

```
Query: "authentication middleware"
         │
         ▼
┌────────────────────────────────┐
│ 1. Embed Query                 │
│    Transformers.js → 384-dim   │
│    ~50ms (first time: 2s load) │
└────────────────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│ 2. Hybrid Retrieval            │
│    Vector: sqlite-vec cosine   │
│    Keyword: FTS5 BM25          │
│    Fetch: limit * 2 each       │
└────────────────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│ 3. RRF Merge (k=60)            │
│    score = Σ 1/(k + rank_i)    │
└────────────────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│ 4. Re-ranking                  │
│    • Name match (+0.1)         │
│    • Exact phrase (+0.15)      │
│    • Path match (+0.075)       │
│    • Test penalty (-0.1)       │
│    • Recency boost (+0.05)     │
└────────────────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│ 5. Return Results              │
│    {chunk, file, score,        │
│     reasoning, score_details}  │
└────────────────────────────────┘
```

### File Watcher Integration

```
┌─────────────────────────────────────────────────────────┐
│  Rust (src-tauri/src/semantic_search.rs)                │
│                                                          │
│  #[tauri::command]                                       │
│  pub async fn start_semantic_watcher(                   │
│      project_path: String,                               │
│      debounce_ms: u64,  // default 500                  │
│  ) -> Result<(), String> {                              │
│      notify::RecommendedWatcher                          │
│        → on_event → Tauri event "semantic:file-changed"  │
│  }                                                       │
└─────────────────────────────────────────────────────────┘
         │
         │ Tauri Event: semantic:file-changed
         │ payload: { filePath, operation }
         ▼
┌─────────────────────────────────────────────────────────┐
│  Frontend (React)                                        │
│                                                          │
│  listen('semantic:file-changed', (event) => {           │
│      // Call MCP tool via existing infrastructure       │
│      mcpCall('reindex_file', {                          │
│          filePath: event.payload.filePath,              │
│          projectPath: activeProject                      │
│      });                                                 │
│  });                                                     │
└─────────────────────────────────────────────────────────┘
```

---

## Storage Location

```
~/Library/Application Support/com.quack.terminal/
├── code-index/
│   ├── [project-hash-1]/
│   │   ├── index.db           # SQLite + sqlite-vec
│   │   └── meta.json          # {lastIndexed, fileCount, chunkCount}
│   ├── [project-hash-2]/
│   │   └── ...
│   └── global-meta.json       # {projects: [...], totalSize}
└── ...existing files...
```

---

## Chunking Strategy

Basata su Pommel ma adattata per TypeScript/React:

### Livelli

| Level | TypeScript | React/JSX | Description |
|-------|------------|-----------|-------------|
| `file` | Intero file | Intero file | Fallback |
| `class` | `class`, `interface`, `type`, `enum` | - | Top-level declarations |
| `function` | `function`, `const fn = () =>` | `function Component()` | Functions/Components |
| `method` | Class methods | - | Class members |

### Tree-sitter Queries (TypeScript)

```javascript
// queries/typescript.js
export const queries = {
  class: `
    (class_declaration name: (type_identifier) @name) @node
    (interface_declaration name: (type_identifier) @name) @node
    (type_alias_declaration name: (type_identifier) @name) @node
    (enum_declaration name: (identifier) @name) @node
  `,
  function: `
    (function_declaration name: (identifier) @name) @node
    (lexical_declaration
      (variable_declarator
        name: (identifier) @name
        value: (arrow_function))) @node
  `,
  method: `
    (method_definition name: (property_identifier) @name) @node
  `
};
```

---

## MVP Roadmap

### Phase 1: Core (5 giorni)
- [ ] MCP server scaffold (`semantic-search-mcp-server.js`)
- [ ] SQLite + sqlite-vec setup
- [ ] Basic chunking (file-level only)
- [ ] Transformers.js embedding integration
- [ ] `semantic_search_code` tool working

### Phase 2: Smart Chunking (3 giorni)
- [ ] Tree-sitter integration
- [ ] Function/class level chunking
- [ ] FTS5 hybrid search
- [ ] RRF merging + re-ranking

### Phase 3: File Watcher ✅ COMPLETED (2 giorni)
- [x] Rust notify watcher implementation (`semantic_search.rs`)
- [x] Incremental reindexing (event emission)
- [x] Debounce logic (notify-debouncer-full)
- [x] TypeScript client interface (`semantic-watcher.ts`)
- [x] Multiple watcher presets (TypeScript, Rust, Python, etc.)

### Phase 4: UI Integration (Future)
- [ ] SemanticSearchPanel component
- [ ] Monaco inline results
- [ ] Keyboard shortcut (Cmd+Shift+F?)

---

## Dependencies to Add

### package.json (node-sdk)

```json
{
  "dependencies": {
    "tree-sitter": "^0.21.0",
    "tree-sitter-typescript": "^0.21.2",
    "tree-sitter-javascript": "^0.21.0",
    "@xenova/transformers": "^2.10.0",
    "better-sqlite3": "^9.2.2",
    "chokidar": "^3.5.3"
  }
}
```

### Cargo.toml ✅ ADDED

```toml
[dependencies]
notify = "7.0"  # File system watcher for semantic search
notify-debouncer-full = "0.3"  # Debounced file watcher events
glob = "0.3"  # Pattern matching for file filtering
```

---

## Embedding Model Comparison

| Model | Dims | Size | Speed | Quality |
|-------|------|------|-------|---------|
| all-MiniLM-L6-v2 | 384 | 23MB | Fast | Good |
| all-mpnet-base-v2 | 768 | 110MB | Medium | Better |
| jina-embeddings-v2-base-code | 768 | 300MB | Slow | Best for code |

**Recommendation:** Start with `all-MiniLM-L6-v2` per MVP (fast, small), upgrade a `jina-code` se necessario.

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Embedding quality insufficiente | Medium | High | Test con real queries, fallback a Ollama |
| sqlite-vec compatibility | Low | Medium | Pure JS fallback (slower) |
| Tree-sitter parsing errors | Low | Low | File-level fallback |
| Memory usage indexing | Medium | Medium | Batch processing, streaming |

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Query latency | <100ms | P95 |
| Token reduction | >100x | vs file loading |
| Accuracy | >80% | Manual testing |
| Index time | <5min | 1000 files |
| Memory (query) | <100MB | Peak |

---

## References

- [Pommel GitHub](https://github.com/dbinky/Pommel)
- [sqlite-vec](https://github.com/asg017/sqlite-vec)
- [EmbedAnything](https://github.com/StarlightSearch/EmbedAnything)
- [Transformers.js](https://github.com/xenova/transformers.js)
- [tree-sitter](https://tree-sitter.github.io/tree-sitter/)

---

## Appendix: Quack Codebase Summary

**Rilevante per integrazione:**

| Component | Location | Notes |
|-----------|----------|-------|
| MCP Pattern | `src-tauri/node-sdk/kanban-mcp-server.js` | Reference impl |
| File Watcher (stub) | `src-tauri/src/background_tasks.rs:465` | Needs `notify` |
| Storage | `~/Library/Application Support/com.quack.terminal/` | Tauri Store |
| Background Tasks | `src/services/backgroundAgentService.ts` | Queue pattern |

**Dipendenze esistenti utili:**
- `walkdir` - Directory traversal
- `fuzzy-matcher` - Fuzzy search (nome file)
- `rayon` - Parallelismo
- `tokio` - Async runtime
