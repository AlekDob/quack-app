# Semantic Code Chunker - Implementation Documentation

**Date:** 2026-01-05
**Component:** Tree-sitter based code chunker for semantic search
**Status:** Implemented and tested

---

## 1. ANALYZE

### Context
We are building a semantic code search system for Quack. The system has:
- SQLite database with schema for files/chunks/embeddings (`semantic-db.js`)
- MCP server scaffold for search tools (`semantic-search-mcp-server.js`)
- Missing: code parsing and chunk extraction

### Requirements
1. Parse source files with tree-sitter
2. Extract hierarchical code chunks (file, class, function, method)
3. Support TypeScript, JavaScript, TSX, JSX
4. Output format compatible with database schema
5. Maintain parent-child relationships (methods inside classes)

---

## 2. PLAN

### Architecture
```
Source File
    ↓
Tree-sitter Parser
    ↓
Syntax Tree Traversal
    ↓
Chunk Extraction
    ↓
Database Storage
```

### Files Created
1. `lib/code-chunker.js` - Main parsing module
2. `lib/code-chunker.test.js` - Unit tests
3. `lib/code-chunker-integration.test.js` - Integration with database

### Dependencies Added
- `tree-sitter@0.21.1` - Core parser
- `tree-sitter-typescript@0.21.2` - TypeScript/TSX support
- `tree-sitter-javascript@0.21.4` - JavaScript/JSX support

---

## 3. ACT - Implementation

### 3.1. Language Support

**Supported Languages:**
- TypeScript (`.ts`)
- TSX (`.tsx`) - TypeScript + JSX
- JavaScript (`.js`, `.mjs`, `.cjs`)
- JSX (`.jsx`) - JavaScript + JSX

**Detection:**
```javascript
detectLanguage(filePath) // Returns 'typescript' | 'javascript' | 'tsx' | 'jsx' | null
```

### 3.2. Node Type Mapping

**TypeScript/TSX:**
- Classes: `class_declaration`, `interface_declaration`, `type_alias_declaration`, `enum_declaration`
- Functions: `function_declaration`, `arrow_function`, `function_expression`, `generator_function_declaration`
- Methods: `method_definition`, `method_signature`

**JavaScript/JSX:**
- Classes: `class_declaration`
- Functions: `function_declaration`, `arrow_function`, `function_expression`, `generator_function_declaration`
- Methods: `method_definition`

### 3.3. Chunk Levels

```typescript
type ChunkLevel = 'file' | 'class' | 'function' | 'method';
```

- **file**: Entire file as single chunk
- **class**: Classes, interfaces, types, enums
- **function**: Top-level functions (including arrow functions)
- **method**: Methods inside classes

### 3.4. Chunk Schema

```typescript
interface Chunk {
  level: ChunkLevel;
  name: string;           // Function/class name or 'anonymous_<level>'
  startLine: number;      // 1-indexed
  endLine: number;        // 1-indexed
  content: string;        // Source code
  parentId: number | null; // For methods inside classes
  language: string;       // 'typescript', 'javascript', etc.
}
```

### 3.5. Name Extraction

**Priority order:**
1. Node `name` field (e.g., `function foo() {}`)
2. Identifier child (e.g., `class Bar {}`)
3. Variable declarator parent (e.g., `const baz = () => {}`)
4. Object property key (e.g., `{ qux: function() {} }`)
5. Fallback: `anonymous_<level>`

### 3.6. Parent-Child Linking

Methods are linked to their parent class:
```javascript
// Parse tree:
class UserService {
  login() {} // parentId = UserService chunk ID
}

// Database storage (two-pass):
// Pass 1: Insert classes/functions (no parent)
// Pass 2: Insert methods with parent links
```

---

## 4. TEST - Results

### 4.1. Unit Tests

**Test Coverage:**
1. Language detection (8 test cases) - ✓ 8/8 passed
2. TypeScript parsing - ✓ All expected chunks found
3. JavaScript parsing - ✓ 6 chunks extracted
4. TSX parsing - ✓ React components parsed
5. Chunk statistics - ✓ Correct counts by level/language
6. Filtering by level - ✓ Filter function/class/method
7. Edge cases:
   - Empty file - ✓
   - Comment-only file - ✓
   - Anonymous arrow functions - ✓
   - Nested classes - ✓

**Example Output:**
```
TEST 2: TypeScript Parsing
Total chunks extracted: 8

[FILE] test.ts
[CLASS] User
[CLASS] UserService
[METHOD] constructor
[METHOD] getUser
[METHOD] createUser
[FUNCTION] formatUser
[FUNCTION] anonymousFunction

All expected chunks found: ✓
```

### 4.2. Integration Test

**Flow Tested:**
1. Parse code with tree-sitter - ✓
2. Store file in database - ✓
3. Store chunks with parent links - ✓
4. Verify parent-child relationships - ✓
5. Full-text search (FTS5) - ✓

**Example Results:**
```
Step 6: Verify parent-child relationships
Found 4 methods:
  - constructor -> parent: AuthService (ID: 3)
  - login -> parent: AuthService (ID: 3)
  - register -> parent: AuthService (ID: 3)
  - logout -> parent: AuthService (ID: 3)

Step 9: Full-text search test (FTS5)
FTS search for "login password" found 3 results:
  - [method] login in src/auth/auth.service.ts (rank: -0.84)
  - [class] AuthService in src/auth/auth.service.ts (rank: -0.40)
  - [file] auth.service.ts in src/auth/auth.service.ts (rank: -0.30)
```

---

## 5. REVIEW - Observations

### 5.1. What Went Well
- Tree-sitter parsing is fast and accurate
- Node type mapping covers all common patterns
- Parent-child linking works correctly
- FTS5 triggers automatically populate search index
- Integration with database schema is seamless

### 5.2. Known Limitations
1. **Anonymous functions**: Assigned generic names like `anonymous_function`
   - Could improve by inspecting parent context more deeply
2. **Nested classes**: Rare in JS/TS, but supported
3. **Default exports**: Arrow functions as default exports may not get good names
4. **Rust/Python/Go**: Not yet implemented (lower priority)

### 5.3. Performance Considerations
- Tree-sitter parsing is O(n) - very fast even for large files
- Two-pass insertion needed for parent links (acceptable overhead)
- Database indexes ensure fast queries

---

## 6. DOCUMENT - API Reference

### 6.1. parseFile()

```javascript
parseFile(filePath: string, content?: string): Chunk[]
```

Parse a single file and extract chunks.

**Parameters:**
- `filePath` - Absolute path to file (used for language detection)
- `content` - Optional file content (reads from disk if not provided)

**Returns:**
- Array of `Chunk` objects

**Example:**
```javascript
import { parseFile } from './lib/code-chunker.js';

const chunks = parseFile('src/auth.ts');
console.log(chunks.length); // 5
```

### 6.2. detectLanguage()

```javascript
detectLanguage(filePath: string): string | null
```

Detect programming language from file extension.

**Returns:**
- `'typescript'` | `'javascript'` | `'tsx'` | `'jsx'` | `null`

### 6.3. getChunkStats()

```javascript
getChunkStats(chunks: Chunk[]): {
  total: number;
  byLevel: Record<ChunkLevel, number>;
  byLanguage: Record<string, number>;
  avgLinesPerChunk: number;
}
```

Calculate statistics about chunks.

### 6.4. filterChunks()

```javascript
filterChunks(chunks: Chunk[], levels: ChunkLevel | ChunkLevel[]): Chunk[]
```

Filter chunks by level(s).

**Example:**
```javascript
const functions = filterChunks(chunks, 'function');
const methodsAndFunctions = filterChunks(chunks, ['method', 'function']);
```

---

## 7. Next Steps

### Immediate
- [ ] Implement embedding generation (separate module)
- [ ] Connect chunker to MCP server `index_project` tool
- [ ] Add glob support for multi-file indexing

### Future Enhancements
- [ ] Add Rust support (`tree-sitter-rust`)
- [ ] Add Python support (`tree-sitter-python`)
- [ ] Add Go support (`tree-sitter-go`)
- [ ] Improve name extraction for complex patterns
- [ ] Add incremental parsing for live updates
- [ ] Add chunk deduplication based on content hash

---

## 8. Files Created

### Main Implementation
- `/Users/alekdob/Desktop/Dev/Personal/quack-app/src-tauri/node-sdk/lib/code-chunker.js` (388 lines)

### Tests
- `/Users/alekdob/Desktop/Dev/Personal/quack-app/src-tauri/node-sdk/lib/code-chunker.test.js` (344 lines)
- `/Users/alekdob/Desktop/Dev/Personal/quack-app/src-tauri/node-sdk/lib/code-chunker-integration.test.js` (210 lines)

### Configuration
- Updated: `/Users/alekdob/Desktop/Dev/Personal/quack-app/src-tauri/node-sdk/package.json`
  - Added tree-sitter dependencies
  - Added `test:chunker` script

---

## 9. Testing Commands

```bash
# Run unit tests
npm run test:chunker

# Run integration test
node lib/code-chunker-integration.test.js

# Manual test
node -e "import('./lib/code-chunker.js').then(m => console.log(m.parseFile('test.ts')))"
```

---

## 10. Conclusion

The tree-sitter code chunker is fully implemented and tested. It successfully:
- Parses TypeScript, JavaScript, TSX, JSX files
- Extracts hierarchical chunks (file, class, function, method)
- Maintains parent-child relationships
- Integrates seamlessly with SQLite database
- Supports full-text search via FTS5

**Status:** Ready for integration with embedding module and MCP server.
