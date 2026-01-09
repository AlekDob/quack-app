# Quack Brain: Bidirectional Sync + Semantic Search

## Overview

Implementare sync bidirezionale tra Obsidian Vault e Quack Brain DB, con supporto per ricerca semantica via embeddings vettoriali.

---

## Fase 1: Sync Bidirezionale (Priorità Alta)

### 1.1 Sync all'avvio di Quack

**Obiettivo**: Quando Quack si avvia, leggere tutti i file .md dal vault Obsidian e sincronizzare le modifiche nel DB.

**File da modificare**:
- `src-tauri/node-sdk/brain-mcp-server.js` - Aggiungere funzione `syncFromObsidian()`
- `src-tauri/src/brain/commands.rs` - Aggiungere comando Tauri `brain_sync_from_vault`
- `src/App.tsx` o `src/hooks/` - Trigger sync all'avvio

**Logica sync**:
```
Per ogni file .md nel vault:
  1. Parsa frontmatter YAML (id, tag, project, date, author, etc.)
  2. Se id esiste nel DB:
     - Confronta date modifica file vs DB
     - Se file più recente → aggiorna DB
     - Se DB più recente → skip (o warning)
  3. Se id NON esiste nel DB:
     - Crea nuova entity dal markdown
  4. Per file eliminati:
     - Marca come 'archived' nel DB (soft delete)
```

**Gestione conflitti**:
- Policy configurabile: `ask`, `vault_wins`, `db_wins`
- Default: `vault_wins` (l'utente edita su Obsidian, ha priorità)

### 1.2 Tool MCP `sync_from_obsidian`

**Nuovo tool MCP**:
```javascript
{
  name: "sync_from_obsidian",
  description: "Sincronizza le modifiche fatte in Obsidian nel database Quack Brain",
  inputSchema: {
    type: "object",
    properties: {
      projectId: { type: "string", description: "Optional: sync solo un progetto" },
      force: { type: "boolean", description: "Forza sync anche se non ci sono modifiche" }
    }
  }
}
```

**Output**:
```json
{
  "synced": 15,
  "created": 3,
  "updated": 10,
  "deleted": 2,
  "conflicts": 0,
  "duration": "1.2s"
}
```

### 1.3 Polling periodico (opzionale)

**Configurazione** in settings:
- `brainSync.enabled`: true/false
- `brainSync.intervalMinutes`: 5 (default)
- `brainSync.showNotification`: true

**Implementazione**:
- `setInterval` nel frontend che chiama `sync_from_obsidian` ogni X minuti
- Solo se Quack è in foreground (risparmio risorse)

---

## Fase 2: Vector Embeddings per Ricerca Semantica

### 2.1 Schema DB aggiornato

**Nuova colonna**:
```sql
ALTER TABLE entities ADD COLUMN embedding BLOB;
-- BLOB contiene float32 array serializzato (1536 dim per OpenAI, 384 per MiniLM)
```

**Nuovo indice** (opzionale, per HNSW):
```sql
-- SQLite non supporta nativamente HNSW, ma possiamo usare sqlite-vss extension
-- O calcolare distanze in-memory per dataset piccoli (<10k note)
```

### 2.2 Generazione Embeddings

**Opzione A: Modello locale (consigliata)**
- `all-MiniLM-L6-v2` via `@xenova/transformers` (Node.js)
- 384 dimensioni, ~22MB modello
- Nessuna API key, funziona offline

**Opzione B: OpenAI API**
- `text-embedding-3-small` (1536 dim)
- Richiede API key
- Migliore qualità ma costo/latenza

**Implementazione**:
```javascript
// In brain-mcp-server.js
import { pipeline } from '@xenova/transformers';

let embedder = null;

async function getEmbedding(text) {
  if (!embedder) {
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  const output = await embedder(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}
```

### 2.3 Nuovo tool MCP `semantic_search`

```javascript
{
  name: "semantic_search",
  description: "Ricerca semantica nel knowledge graph usando embeddings vettoriali",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Query in linguaggio naturale" },
      limit: { type: "number", default: 10 },
      projectId: { type: "string", description: "Filtra per progetto" },
      threshold: { type: "number", default: 0.5, description: "Soglia similarità (0-1)" }
    },
    required: ["query"]
  }
}
```

**Algoritmo**:
1. Genera embedding della query
2. Calcola cosine similarity con tutti gli embeddings nel DB
3. Ordina per similarità decrescente
4. Filtra per threshold
5. Ritorna top-K risultati

### 2.4 Generazione embeddings in background

**Quando generare**:
- Alla creazione di nuova entity
- Quando si modifica contenuto (observations)
- Batch job per entity esistenti senza embedding

**Tool MCP `generate_embeddings`**:
```javascript
{
  name: "generate_embeddings",
  description: "Genera embeddings per tutte le entity che non ne hanno",
  inputSchema: {
    type: "object",
    properties: {
      batchSize: { type: "number", default: 50 },
      projectId: { type: "string" }
    }
  }
}
```

---

## Fase 3: Test e Documentazione

### 3.1 Test

- Unit test per parsing markdown → entity
- Unit test per cosine similarity
- Integration test per sync bidirezionale
- E2E test per ricerca semantica

### 3.2 Documentazione

- Aggiornare `.claude/rules/use-mcp-memory-second-brain.md`
- Aggiornare `docs/05-features/second-brain.md`
- Creare `docs/05-features/semantic-search.md`

---

## Timeline stimata

| Fase | Descrizione | Effort |
|------|-------------|--------|
| 1.1 | Sync all'avvio | 2h |
| 1.2 | Tool MCP sync | 1h |
| 1.3 | Polling periodico | 1h |
| 2.1 | Schema DB | 0.5h |
| 2.2 | Embedding generation | 2h |
| 2.3 | Semantic search tool | 1.5h |
| 2.4 | Background generation | 1h |
| 3 | Test + Docs | 2h |
| **Totale** | | **~11h** |

---

## Acceptance Criteria

### Sync Bidirezionale
- [ ] Modifiche in Obsidian vengono importate nel DB all'avvio
- [ ] Nuove note create in Obsidian appaiono nel DB
- [ ] Note eliminate in Obsidian vengono archiviate nel DB
- [ ] Tool `sync_from_obsidian` funziona correttamente
- [ ] Polling periodico configurabile

### Semantic Search
- [ ] Embeddings generati per tutte le entity
- [ ] Tool `semantic_search` trova risultati semanticamente correlati
- [ ] Performance accettabile (<1s per query)
- [ ] Funziona offline con modello locale

---

## Note Tecniche

### Dependency da aggiungere
```json
{
  "@xenova/transformers": "^2.17.0"  // Per embeddings locali
}
```

### Considerazioni performance
- Per <10k note: calcolo similarità in-memory è OK
- Per >10k note: considerare sqlite-vss o hnswlib-node
- Embedding generation: ~50ms per nota con MiniLM

### Fallback
- Se embedding model non disponibile → fallback a FTS
- Se sync fallisce → retry con backoff esponenziale
