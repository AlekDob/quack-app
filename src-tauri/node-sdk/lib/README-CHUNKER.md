# Code Chunker - Tree-sitter Based Code Parser

Modulo Node.js per il parsing di file di codice e l'estrazione di chunks gerarchici usando tree-sitter.

## Caratteristiche

- **Parsing AST con tree-sitter** - Estrazione precisa basata su sintassi
- **Supporto multi-linguaggio** - TypeScript, JavaScript, TSX, JSX
- **Chunks gerarchici** - File, class, function, method
- **Parent-child linking** - Relazioni tra metodi e classi
- **Integrazione DB** - Schema compatibile con `semantic-db.js`
- **Full-text search** - Automaticamente indicizzato in FTS5

## Installazione

```bash
npm install tree-sitter tree-sitter-typescript tree-sitter-javascript
```

## Uso Base

```javascript
import { parseFile } from './lib/code-chunker.js';

// Parse un singolo file
const chunks = parseFile('src/auth.service.ts');

console.log(`Extracted ${chunks.length} chunks`);
for (const chunk of chunks) {
  console.log(`[${chunk.level}] ${chunk.name}`);
}
```

## API

### `parseFile(filePath, content?)`

Parsa un file e ritorna array di chunks.

**Parametri:**
- `filePath: string` - Path assoluto al file (per detection linguaggio)
- `content?: string` - Contenuto opzionale (altrimenti legge da disco)

**Ritorna:** `Chunk[]`

```typescript
interface Chunk {
  level: 'file' | 'class' | 'function' | 'method';
  name: string;           // Nome funzione/classe
  startLine: number;      // 1-indexed
  endLine: number;        // 1-indexed
  content: string;        // Codice sorgente
  parentId: number | null; // Per metodi dentro classi
  language: string;       // 'typescript', 'javascript', etc.
}
```

### `detectLanguage(filePath)`

Rileva il linguaggio dall'estensione del file.

**Ritorna:** `'typescript' | 'javascript' | 'tsx' | 'jsx' | null`

### `getChunkStats(chunks)`

Calcola statistiche sui chunks.

**Ritorna:**
```typescript
{
  total: number;
  byLevel: { [level: string]: number };
  byLanguage: { [language: string]: number };
  avgLinesPerChunk: number;
}
```

### `filterChunks(chunks, levels)`

Filtra chunks per livello.

**Parametri:**
- `chunks: Chunk[]`
- `levels: ChunkLevel | ChunkLevel[]`

**Esempio:**
```javascript
const functions = filterChunks(chunks, 'function');
const methodsAndFunctions = filterChunks(chunks, ['method', 'function']);
```

## Linguaggi Supportati

| Linguaggio | Estensioni | Node Types |
|------------|------------|------------|
| TypeScript | `.ts` | class, interface, type, enum, function, method |
| TSX | `.tsx` | TypeScript + JSX |
| JavaScript | `.js`, `.mjs`, `.cjs` | class, function, method |
| JSX | `.jsx` | JavaScript + JSX |

## Livelli di Chunking

### File
Intero file come singolo chunk. Sempre incluso come primo chunk.

### Class
- TypeScript: `class`, `interface`, `type`, `enum`
- JavaScript: `class`

### Function
Funzioni top-level (fuori da classi):
- `function foo() {}`
- `const bar = () => {}`
- `const baz = function() {}`

### Method
Metodi dentro classi:
- `methodName() {}` (class method)
- `constructor() {}`
- Automaticamente linkati al parent class via `parentId`

## Esempi

### Esempio 1: Parse e Statistiche

```javascript
import { parseFile, getChunkStats } from './lib/code-chunker.js';

const chunks = parseFile('src/service.ts');
const stats = getChunkStats(chunks);

console.log(`Total: ${stats.total}`);
console.log(`Classes: ${stats.byLevel.class || 0}`);
console.log(`Functions: ${stats.byLevel.function || 0}`);
console.log(`Methods: ${stats.byLevel.method || 0}`);
```

### Esempio 2: Integrazione con Database

```javascript
import { SemanticDatabase } from './lib/semantic-db.js';
import { parseFile } from './lib/code-chunker.js';

const db = new SemanticDatabase('code-index.db');
const chunks = parseFile('src/auth.ts');

// Store file
const fileId = db.upsertFile(
  'src/auth.ts',
  'hash123',
  'typescript',
  content.length,
  Date.now()
);

// Store chunks (two-pass for parent links)
const chunkIdMap = new Map();

// Pass 1: Insert non-method chunks
for (const chunk of chunks) {
  if (chunk.level !== 'method') {
    const id = db.insertChunk(
      fileId,
      chunk.level,
      chunk.name,
      chunk.startLine,
      chunk.endLine,
      chunk.content,
      null
    );
    chunkIdMap.set(`${chunk.level}:${chunk.name}:${chunk.startLine}`, id);
  }
}

// Pass 2: Insert methods with parent links
for (const chunk of chunks) {
  if (chunk.level === 'method') {
    const parentClass = chunks.find(c =>
      c.level === 'class' &&
      c.startLine < chunk.startLine &&
      c.endLine > chunk.endLine
    );

    const parentId = parentClass
      ? chunkIdMap.get(`${parentClass.level}:${parentClass.name}:${parentClass.startLine}`)
      : null;

    db.insertChunk(
      fileId,
      chunk.level,
      chunk.name,
      chunk.startLine,
      chunk.endLine,
      chunk.content,
      parentId
    );
  }
}
```

### Esempio 3: Analisi Codebase

```bash
# Esegui l'esempio interattivo
node lib/code-chunker.example.js src/utils/helpers.ts
```

Output:
```
======================================================================
Parsing: src/utils/helpers.ts
======================================================================

Language detected: typescript
✓ Successfully parsed file
✓ Extracted 12 chunks

Statistics:
----------------------------------------------------------------------
Total chunks: 12
Average lines per chunk: 15

By level:
  file          1 (8.3%)
  function      8 (66.7%)
  class         2 (16.7%)
  method        1 (8.3%)

[FUNCTIONS] (8)
  formatDate (lines 5-8, 4 lines)
  parseJSON (lines 10-15, 6 lines)
  debounce (lines 17-24, 8 lines)
  ...

Analysis:
----------------------------------------------------------------------
Largest chunks:
   45 lines - [function] debounce
   30 lines - [class] Logger
   12 lines - [function] throttle
```

## Testing

```bash
# Unit tests
npm run test:chunker

# Integration test (con database)
npm run test:chunker:integration

# Esempio interattivo
node lib/code-chunker.example.js [file-path]
```

## Schema Database

I chunks estratti sono compatibili con lo schema di `semantic-db.js`:

```sql
CREATE TABLE chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER NOT NULL,
  level TEXT CHECK(level IN ('file', 'class', 'function', 'method')),
  name TEXT,
  start_line INTEGER,
  end_line INTEGER,
  content TEXT,
  content_hash TEXT,
  parent_id INTEGER,
  FOREIGN KEY(file_id) REFERENCES files(id),
  FOREIGN KEY(parent_id) REFERENCES chunks(id)
);
```

## Note Tecniche

### Name Extraction
Il chunker usa diverse strategie per estrarre nomi:
1. Campo `name` del node tree-sitter
2. Child di tipo `identifier`
3. Parent `variable_declarator` (per arrow functions)
4. Parent `pair` (per object methods)
5. Fallback: `anonymous_<level>`

### Parent-Child Linking
I metodi dentro classi sono linkati tramite `parentId`:
```javascript
class UserService {
  login() {}  // parentId = UserService chunk ID
  logout() {} // parentId = UserService chunk ID
}
```

Lo storage richiede **two-pass insertion**:
1. **Pass 1**: Insert classi e funzioni (nessun parent)
2. **Pass 2**: Insert metodi con parent links

### Limitazioni
1. **File molto grandi**: Tree-sitter può fallire su file >10k linee
2. **Anonymous functions**: Ricevono nomi generici
3. **Linguaggi non supportati**: Solo TS/JS al momento

## Roadmap

- [ ] Supporto Rust (`tree-sitter-rust`)
- [ ] Supporto Python (`tree-sitter-python`)
- [ ] Supporto Go (`tree-sitter-go`)
- [ ] Handling file grandi (chunking incrementale)
- [ ] Miglior name extraction per edge cases
- [ ] Cache parsing results

## File

- `lib/code-chunker.js` - Modulo principale (388 linee)
- `lib/code-chunker.test.js` - Unit tests (344 linee)
- `lib/code-chunker-integration.test.js` - Integration test (210 linee)
- `lib/code-chunker.example.js` - Esempio interattivo (210 linee)

## License

MIT - Part of Quack project
