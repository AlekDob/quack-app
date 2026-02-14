---
type: pattern
created: 2026-01-08
---

# Semantic Code Search

Quack includes a **semantic search** system for searching code using natural language instead of exact keywords.

## How It Works

1. **Indexing**: Code processed with Tree-sitter
2. **Chunking**: Hierarchical chunks extracted (file/class/function/method)
3. **Embedding**: Each chunk converted to 384-dim vector
4. **Search**: Query converted to embedding, cosine similarity comparison
5. **Hybrid**: Combines FTS5 + vector search with Reciprocal Rank Fusion

## Stack

- **Parser**: Tree-sitter (TS/JS/TSX/JSX)
- **Embeddings**: Transformers.js (all-MiniLM-L6-v2)
- **Storage**: SQLite with FTS5 + BLOB for vectors
- **Search**: Hybrid search with RRF

## MCP Integration

MCP Server: `semantic-search-mcp-server.js`

Tools: `semantic_search_code`, `index_project`, `get_index_status`

## File Principali

| File | Ruolo |
|------|-------|
| `SemanticSearchTabView.tsx` | Vista tab dedicata |
| `semantic-search-mcp-server.js` | MCP server |
| `semantic-watcher.ts` | File watcher per re-index |
