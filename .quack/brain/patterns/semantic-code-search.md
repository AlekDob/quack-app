---
type: component
project: quack-app
created: 2026-01-08
migrated: true
---

# Semantic Code Search

## Ricerca Semantica del Codice

Quack include un sistema di **semantic search** che permette di cercare codice usando linguaggio naturale invece di keyword esatte.

## Come Funziona

1. **Indexing**: Il codice viene processato con Tree-sitter
2. **Chunking**: Estratti chunk gerarchici (file/class/function/method)
3. **Embedding**: Ogni chunk viene convertito in vettore 384-dim
4. **Search**: Query convertita in embedding, confronto cosine similarity
5. **Hybrid**: Combina FTS5 + vector search con Reciprocal Rank Fusion

## Stack Tecnologico

- **Parser**: Tree-sitter (TS/JS/TSX/JSX)
- **Embeddings**: Transformers.js (all-MiniLM-L6-v2)
- **Storage**: SQLite con FTS5 + BLOB per vettori
- **Search**: Hybrid search con RRF

## MCP Integration

MCP Server: `semantic-search-mcp-server.js` (28K LOC)

Tools esposti:
- `semantic_search_code` - Ricerca semantica
- `index_project` - Indicizza progetto
- `get_index_status` - Stato indice

## File Principali

| File | Ruolo |
|------|-------|
| `SemanticSearchTabView.tsx` | Vista tab dedicata |
| `semantic-search-mcp-server.js` | MCP server |
| `semantic-watcher.ts` | File watcher per re-index |
| `useSemanticSearchTab.ts` | Hook gestione tab |

## Documentazione Correlata

- `semantic-code-chunker-implementation.md`
- `semantic-db-implementation.md`
- `phase-4-semantic-search-implementation.md`
