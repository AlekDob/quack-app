# Semantic Search - Testing Guide

Guida completa per testare il sistema di semantic code search implementato in Quack.

## 🎯 Overview della Feature

Il semantic search permette di:
- **Parsare codice** con tree-sitter (TS, JS, TSX, JSX)
- **Generare embeddings** con Transformers.js (locale, no API)
- **Ricerca ibrida** con FTS5 (keyword) + Vector (semantic) + RRF (ranking fusion)
- **File watcher** con debouncing per aggiornamenti incrementali

---

## 🧪 Metodo 1: Test Automatici (Vitest)

### Run completo (145 tests)

```bash
cd src-tauri/node-sdk
npm test
```

**Output atteso:**
```
✓ lib/code-chunker.vitest.test.js (34 tests)
✓ lib/semantic-db.vitest.test.js (51 tests)
✓ lib/embeddings.vitest.test.js (44 tests)
✓ lib/semantic-search.integration.vitest.test.js (16 tests)

Test Files  4 passed (4)
Tests       145 passed (145)
```

### Test specifici

```bash
# Solo code chunking
npm test -- lib/code-chunker.vitest.test.js

# Solo embeddings
npm test -- lib/embeddings.vitest.test.js

# Solo database
npm test -- lib/semantic-db.vitest.test.js

# Solo integration
npm test -- lib/semantic-search.integration.vitest.test.js
```

### Watch mode (sviluppo)

```bash
npm run test:watch
```

### UI interattiva

```bash
npm run test:ui
```

Apre browser con UI per navigare test.

---

## 🎮 Metodo 2: Test Interattivo (Script Manuale)

### Esecuzione

```bash
cd src-tauri/node-sdk
node test-semantic-manual.js
```

### Cosa testa

1. **Model initialization**: Download e caching del modello (80MB)
2. **Code parsing**: Estrazione chunk da file TypeScript
3. **Embedding generation**: Generazione vettori 384D
4. **Database indexing**: Insert file + chunk + embeddings
5. **FTS5 search**: Ricerca keyword con BM25
6. **Vector search**: Similarity search con cosine
7. **Hybrid search**: Reciprocal Rank Fusion

### Output esempio

```
📊 Database statistics
   Files indexed:     3
   Chunks extracted:  16
   Embeddings stored: 10

🔍 Full-text search: "password"
   1. verifyPassword (auth.ts) - Score: 1.2195
   2. login (auth.ts) - Score: 0.8448

🎯 Vector search: "authenticate user credentials"
   1. verifyPassword (auth.ts) - Similarity: 35.30%
   2. login (auth.ts) - Similarity: 35.20%

⚡ Hybrid search: "verify user password"
   1. verifyPassword (auth.ts) - RRF: 0.0164
```

---

## 🖥️ Metodo 3: Dall'App Quack (MCP Server)

### 1. Avvia l'app

```bash
npm run tauri:dev
```

### 2. Verifica MCP server disponibile

Nel terminale di Quack, prova:

```bash
# Lista MCP servers
mcp list

# Dovrebbe mostrare:
# - semantic-search (src-tauri/node-sdk/semantic-search-mcp-server.js)
```

### 3. Testa via MCP tools

Gli MCP tools disponibili:

```typescript
// 1. Index project
await mcp.semantic_search.index_project({
  projectPath: '/path/to/your/project',
  patterns: ['**/*.ts', '**/*.tsx']
});

// 2. Search code
await mcp.semantic_search.search_code({
  query: 'authenticate user login',
  projectPath: '/path/to/your/project',
  level: 'all', // or 'function', 'class', 'method'
  limit: 10
});

// 3. Get stats
await mcp.semantic_search.get_stats({
  projectPath: '/path/to/your/project'
});
```

### 4. Test completo end-to-end

```javascript
// In Quack console o agent chat
const projectPath = '/Users/alekdob/Desktop/Dev/Personal/quack-app';

// Step 1: Index
const indexResult = await mcp.semantic_search.index_project({
  projectPath,
  patterns: ['src/**/*.{ts,tsx}']
});

console.log('Indexed:', indexResult);
// Output: { success: true, stats: { filesIndexed: 150, chunksCreated: 800 } }

// Step 2: Search
const searchResult = await mcp.semantic_search.search_code({
  query: 'file watcher debouncing',
  projectPath,
  level: 'function',
  limit: 5
});

console.log('Results:', searchResult);
// Output: { success: true, results: [...] }
```

---

## 🧩 Metodo 4: Test File Watcher (Rust)

### 1. Crea test Rust

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_semantic_watcher() {
        let manager = SemanticWatcherManager::new();

        // Start watcher
        manager.start_watcher(
            "/tmp/test-project".to_string(),
            None
        ).await.unwrap();

        // Check active
        assert!(manager.is_watcher_active("/tmp/test-project").await);

        // Stop watcher
        manager.stop_watcher("/tmp/test-project".to_string()).await.unwrap();
    }
}
```

### 2. Run test

```bash
cd src-tauri
cargo test semantic_watcher
```

---

## 📊 Verifiche di Qualità

### Performance Benchmarks

**Code Chunking:**
- 20 funzioni: < 500ms ✅
- File 1000 righe: < 200ms ✅

**Embeddings:**
- Single: < 100ms (dopo warm-up) ✅
- Batch 50: < 5s (100ms/text avg) ✅

**Search:**
- FTS5: < 100ms ✅
- Vector: < 500ms (naive scan) ✅
- Hybrid: < 600ms ✅

### Memory Usage

- Model cached: ~80MB
- SQLite DB: ~10MB per 1000 chunks
- Embeddings: 384 floats × 4 bytes = 1.5KB/chunk

### Accuracy Tests

**Similarity checks:**
```javascript
// Similar code should have > 60% similarity
const code1 = 'function add(a, b) { return a + b; }';
const code2 = 'function sum(x, y) { return x + y; }';
// Expected: > 0.6 ✅

// Different code should have < 80% similarity
const code3 = 'class UserService { async findUser() {} }';
// Expected: < 0.8 ✅
```

---

## 🐛 Troubleshooting

### Model non si scarica

```bash
# Verifica directory cache
ls ~/Library/Application\ Support/com.quack.terminal/models/

# Se vuota, controlla connessione e riprova
node test-semantic-manual.js
```

### Errore "better-sqlite3 version mismatch"

```bash
cd src-tauri/node-sdk
npm rebuild better-sqlite3
```

### Tree-sitter parsing fallisce

```javascript
// Verifica language supportati
import { SUPPORTED_LANGUAGES } from './lib/code-chunker.js';
console.log(SUPPORTED_LANGUAGES);
// ['typescript', 'javascript', 'tsx', 'jsx']
```

### Search non ritorna risultati

```javascript
// Verifica database ha chunks
const stats = db.getStats();
console.log(stats);
// Se chunkCount = 0, reindex
```

---

## 📈 Next Steps

### Dopo i test

1. ✅ **Tests pass** → Feature pronta per use
2. ⚠️ **Tests fail** → Check logs, fix bugs
3. 🎯 **Performance issues** → Profile e ottimizza

### Integration con Quack UI

```typescript
// src/views/SemanticSearchView.tsx
import { invoke } from '@tauri-apps/api/core';

export function SemanticSearchView() {
  const handleSearch = async (query: string) => {
    const results = await invoke('semantic_search_code', {
      query,
      projectPath: currentProject,
      level: 'all',
      limit: 10
    });

    setResults(results);
  };

  return <SearchUI onSearch={handleSearch} />;
}
```

### MCP Integration con Claude

```markdown
@semantic-search search for "authentication logic" in /my/project
```

---

## 📚 Resources

### Documentation
- `/docs/06-proposals/semantic-code-search-architecture.md`
- `/.claude/docs/semantic-search-complete-implementation.md`
- `/src-tauri/node-sdk/README-SEMANTIC-SEARCH.md`

### Test Files
- `/src-tauri/node-sdk/lib/*.vitest.test.js` (145 tests)
- `/src-tauri/node-sdk/test-semantic-manual.js` (interactive)

### Source Code
- `/src-tauri/node-sdk/lib/code-chunker.js` (tree-sitter)
- `/src-tauri/node-sdk/lib/embeddings.js` (Transformers.js)
- `/src-tauri/node-sdk/lib/semantic-db.js` (SQLite)
- `/src-tauri/src/semantic_search.rs` (Rust watcher)

---

**✅ Tutto pronto! Buon testing! 🚀**
