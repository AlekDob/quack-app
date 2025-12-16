# Quack Memory - Sistema di Memoria Persistente con Vector Search

## Overview

Implementazione di **Quack Memory**, un sistema di memoria persistente originale con **ricerca semantica** per mantenere contesto tra sessioni AI. Ispirato ai concetti di memoria persistente, ma con architettura completamente nuova.

**Obiettivo**: Permettere agli utenti Quack di avere un AI che "ricorda" preferenze, decisioni e learnings tra sessioni, con ricerca semantica intelligente.

---

## Aspetto Legale

- **Claude-mem usa licenza AGPL-3.0** - copyleft molto restrittivo
- **Non copieremo codice** - implementazione 100% originale
- **Il CONCETTO non e' brevettabile** - memoria persistente e' un'idea generale
- **Architettura diversa** - LanceDB (embedded) vs Chroma (server), estrazione ibrida

---

## Opzioni Vector DB Analizzate

| DB | Pro | Contro | Scelta |
|----|-----|--------|--------|
| **LanceDB** | Embedded, Rust-native, zero config, disk-based | Nuovo, meno documentato | **Consigliato** |
| Tinyvector | Pure Rust, MIT license, in-memory | Solo in-memory, meno features | Backup option |
| Qdrant | Maturo, produzione-ready | Richiede server separato | No |
| Chroma | Usato da claude-mem | Python-based, server | No (come loro) |

**Decisione: LanceDB** - E' embedded (come SQLite), ha bindings Rust/TypeScript, zero config, persiste su disco.

---

## Architettura con Vector Search

```
+-------------------------------------------------------------------+
|                         QUACK MEMORY                               |
+-------------------------------------------------------------------+
|  UI Layer                                                          |
|  +-- MemoryPanel.tsx (sidebar tab)                                |
|  +-- MemorySearch.tsx (semantic search)                           |
|  +-- MemorySettings section                                        |
+-------------------------------------------------------------------+
|  Service Layer                                                     |
|  +-- memoryStorage.ts (metadata in Tauri Store)                   |
|  +-- memoryVectorStore.ts (LanceDB embeddings)                    |
|  +-- memoryExtractor.ts (hybrid extraction)                       |
|  +-- memoryEmbedder.ts (local embeddings)                         |
|  +-- memoryInjector.ts (context injection)                        |
+-------------------------------------------------------------------+
|  Integration Layer                                                 |
|  +-- useClaudeChat.ts (hook enhancement)                          |
|  +-- conversationRecovery.ts (token budget)                       |
|  +-- chatStore.ts (memory state)                                  |
+-------------------------------------------------------------------+
|  Storage Layer                                                     |
|  +-- quack-memories.json (Tauri Store - metadata)                 |
|  +-- ~/.quack/vectors/ (LanceDB - embeddings)                     |
+-------------------------------------------------------------------+
```

---

## Dual Storage Strategy

### 1. Metadata (Tauri Store - JSON)
```typescript
// Quick access, filtering, CRUD
interface QuackMemory {
  id: string;
  content: string;
  category: MemoryCategory;
  confidence: MemoryConfidence;
  scope: 'global' | 'project';
  keywords: string[];
  projectPath?: string;
  createdAt: number;
  lastAccessedAt: number;
  accessCount: number;
  userVerified?: boolean;
  isArchived: boolean;
  // Reference to vector
  vectorId?: string;
}
```

### 2. Embeddings (LanceDB)
```typescript
// Semantic search
interface MemoryVector {
  id: string;          // Same as QuackMemory.id
  content: string;     // Original text
  vector: number[];    // 384-dim embedding (all-MiniLM-L6-v2)
  memoryId: string;    // FK to metadata
}
```

---

## Local Embeddings (No API Calls!)

Per generare embeddings **offline** senza costi API:

**Option A: Transformers.js (Browser/Node)**
```typescript
import { pipeline } from '@xenova/transformers';

const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
const embedding = await embedder(text, { pooling: 'mean', normalize: true });
// Returns 384-dimensional vector
```

**Option B: Rust-side with Candle** (Tauri backend)
- Use Candle ML framework in Rust
- Run model inference in Tauri backend
- Faster, native integration

**Decisione: Transformers.js** per MVP (piu veloce da implementare), con possibilita di migrare a Rust later.

---

## Search Strategy: Hybrid

```typescript
async function searchMemories(query: string, options: SearchOptions): Promise<QuackMemory[]> {
  // 1. Generate query embedding
  const queryVector = await embedder.embed(query);

  // 2. Vector similarity search (semantic)
  const semanticResults = await vectorStore.search(queryVector, { limit: 20 });

  // 3. Keyword search (fallback/boost)
  const keywordResults = await keywordSearch(query);

  // 4. Hybrid ranking (RRF - Reciprocal Rank Fusion)
  const combined = reciprocalRankFusion(semanticResults, keywordResults);

  // 5. Apply filters (category, scope, date)
  return applyFilters(combined, options);
}
```

---

## Data Models

### File: `src/types/memory.ts`

```typescript
export type MemoryCategory =
  | 'preference'    // User preferences
  | 'fact'          // Project facts
  | 'decision'      // Architectural decisions
  | 'pattern'       // Code patterns
  | 'mistake'       // Lessons learned
  | 'context';      // General context

export type MemoryConfidence = 'high' | 'medium' | 'low';
export type MemoryScope = 'global' | 'project';

export interface QuackMemory {
  id: string;
  content: string;
  category: MemoryCategory;
  confidence: MemoryConfidence;
  scope: MemoryScope;
  keywords: string[];
  projectPath?: string;
  sourceSessionId?: string;
  createdAt: number;
  lastAccessedAt: number;
  accessCount: number;
  userVerified?: boolean;
  isArchived: boolean;
  vectorId?: string;  // Reference to LanceDB entry
}

export interface MemorySearchResult {
  memory: QuackMemory;
  score: number;           // Combined relevance score
  semanticScore?: number;  // Vector similarity (0-1)
  keywordScore?: number;   // Keyword match score
}

export interface MemorySettings {
  enabled: boolean;
  autoExtract: boolean;
  useSemanticSearch: boolean;  // Toggle vector search
  maxMemories: number;
  injectionBudget: number;
  retentionDays: number;
}
```

---

## Implementation Phases

### Phase 1: Foundation (3-4 giorni)

**Files to create:**
- `src/types/memory.ts` - Type definitions
- `src/services/memoryStorage.ts` - Tauri Store for metadata
- `src/services/memoryExtractor.ts` - Hybrid extraction

**Tasks:**
1. Create memory type definitions
2. Implement metadata storage (Tauri Store pattern)
3. Implement extraction patterns
4. Write Vitest tests

### Phase 2: Vector Store ✅ COMPLETE (2025-12-15)

**Files created:**
- ✅ `src/services/memoryEmbedder.ts` - Transformers.js wrapper (261 lines)
- ✅ `src/services/memoryVectorStore.ts` - LanceDB integration (280 lines)
- ✅ `src/tests/memoryEmbedder.test.ts` - 14 tests (all passing)
- ✅ `src/tests/memoryVectorStore.test.ts` - Integration tests
- ⏳ `src/services/memorySearch.ts` - Hybrid search (Phase 3)

**Dependencies added:**
```json
{
  "@xenova/transformers": "^2.17.2",  ✅ Installed
  "@lancedb/lancedb": "^0.22.3"        ✅ Installed
}
```

**Completed:**
1. ✅ Setup Transformers.js with all-MiniLM-L6-v2 (384-dim embeddings)
2. ✅ Integrate LanceDB for vector storage (~/.quack/vectors/)
3. ✅ CRUD operations: add, update, delete, search, stats
4. ✅ Write tests (14 passing, TypeScript strict compliant)
5. ✅ Refactored to meet 20-line function limit
6. ✅ Full JSDoc documentation coverage

**Next:** Phase 3 - Integration (memorySearch, memoryInjector, React hooks)

### Phase 3: Integration (2 giorni)

**Files to create:**
- `src/services/memoryInjector.ts` - Context injection
- `src/hooks/useMemory.ts` - React hook

**Files to modify:**
- `src/hooks/useClaudeChat.ts` - Hook into message flow
- `src/services/conversationRecovery.ts` - Add memory overhead
- `src/stores/chatStore.ts` - Add memory state

### Phase 4: UI (2-3 giorni)

**Files to create:**
- `src/components/memory/MemoryPanel.tsx`
- `src/components/memory/MemoryList.tsx`
- `src/components/memory/MemoryItem.tsx`
- `src/components/memory/MemorySearch.tsx`
- `src/components/memory/MemorySettings.tsx`

**Files to modify:**
- `src/components/SidePanel.tsx` - Add Memory tab

### Phase 5: Polish (1-2 giorni)

1. Memory import/export
2. Statistics dashboard
3. Performance optimization (lazy loading embeddings)
4. Documentation

---

## Comparison: Quack Memory vs Claude-Mem

| Aspect | Claude-Mem | Quack Memory |
|--------|-----------|--------------|
| License | AGPL-3.0 | Proprietary (Quack) |
| Storage | SQLite + Chroma (server) | Tauri Store + LanceDB (embedded) |
| Embeddings | Requires Chroma server | Local (Transformers.js) |
| Extraction | LLM-based (costs $$) | Hybrid (rules + optional LLM) |
| Architecture | Claude Code plugin | Native Quack feature |
| Offline | Partial (needs Chroma) | Full offline support |

---

## Decisioni Confermate

1. **Extraction Mode**: **AUTO** - Estrazione automatica da ogni risposta AI
2. **Model**: **all-MiniLM-L6-v2** (384-dim, ~23MB) - Stesso usato da Claude-Mem via Chroma!
3. **Approccio**: **FULL STACK** - Vector search da subito

---

## Sources

- [LanceDB - Vector Database](https://lancedb.com/)
- [Transformers.js - Local ML](https://github.com/xenova/transformers.js)
- [Tinyvector - Pure Rust](https://github.com/m1guelpf/tinyvector)
- [Local AI with Tauri + pgvector](https://electric-sql.com/blog/2024/02/05/local-first-ai-with-tauri-postgres-pgvector-llama)
- [Building RAG with Rust](https://masteringbackend.com/posts/building-a-simple-rag-system-application-with-rust)
