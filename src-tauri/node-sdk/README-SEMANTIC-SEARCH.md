# Semantic Search MCP Server

MCP server for semantic code search with full-text indexing and future vector embeddings support.

## Features

- **Full-text search** with SQLite FTS5 (Porter stemming)
- **File-level indexing** with hash-based change detection
- **Incremental reindexing** (skip unchanged files)
- **Language detection** from file extensions
- **Project isolation** (each project has separate index)
- **Ready for embeddings** (schema includes embeddings table)

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

Required packages:
- `better-sqlite3` - SQLite3 database
- `glob` - File pattern matching
- `@modelcontextprotocol/sdk` - MCP protocol

### 2. Test the Integration

Run the test script to verify everything works:

```bash
node test-semantic-search.js
```

Expected output:
```
✅ Test 1: Insert files
✅ Test 2: Insert chunks
✅ Test 3: Full-text search
✅ Test 4: Database stats
✅ Test 5: Reindexing check
✅ Test 6: Get all files
✨ All tests passed!
```

### 3. Start the MCP Server

The server runs as a stdio-based process:

```bash
node semantic-search-mcp-server.js
```

Or make it executable:

```bash
chmod +x semantic-search-mcp-server.js
./semantic-search-mcp-server.js
```

## MCP Tools

### `index_project`

Index a project for semantic search.

**Parameters:**
- `projectPath` (string, required) - Absolute path to project root
- `patterns` (array, optional) - Glob patterns for files to index
  - Default: `['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx']`

**Example:**
```json
{
  "name": "index_project",
  "arguments": {
    "projectPath": "/Users/alek/projects/my-app",
    "patterns": ["**/*.ts", "**/*.tsx", "**/*.js"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "filesProcessed": 150,
    "filesIndexed": 150,
    "filesSkipped": 0,
    "chunksCreated": 150,
    "indexingTimeMs": 1234
  }
}
```

### `semantic_search_code`

Search codebase using natural language queries.

**Parameters:**
- `query` (string, required) - Natural language search query
- `projectPath` (string, required) - Absolute path to project root
- `level` (string, optional) - Granularity level: `'file'` | `'class'` | `'function'` | `'all'`
  - Default: `'all'`
- `limit` (number, optional) - Maximum results to return
  - Default: `10`

**Example:**
```json
{
  "name": "semantic_search_code",
  "arguments": {
    "query": "authentication login jwt",
    "projectPath": "/Users/alek/projects/my-app",
    "level": "all",
    "limit": 10
  }
}
```

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "type": "file",
      "name": "src/auth.ts",
      "file": "src/auth.ts",
      "startLine": 1,
      "endLine": 45,
      "content": "function authenticate(user, pass) { ... }",
      "score": 0.95,
      "matchType": "fts",
      "language": "typescript"
    }
  ],
  "stats": {
    "totalResults": 5,
    "searchTimeMs": 22
  }
}
```

### `get_index_status`

Get indexing status for a project.

**Parameters:**
- `projectPath` (string, required) - Absolute path to project root

**Example:**
```json
{
  "name": "get_index_status",
  "arguments": {
    "projectPath": "/Users/alek/projects/my-app"
  }
}
```

**Response:**
```json
{
  "success": true,
  "indexed": true,
  "stats": {
    "fileCount": 150,
    "chunkCount": 150,
    "embeddingCount": 0
  },
  "hoursSinceIndexing": 2.5,
  "needsReindexing": false,
  "lastIndexed": "2026-01-05T10:30:00.000Z"
}
```

## Storage

Index data is stored in:

```
~/Library/Application Support/com.quack.terminal/code-index/
└── [project-hash]/
    ├── index.db      # SQLite database (FTS5 + embeddings)
    └── meta.json     # Indexing metadata
```

Project hash is the first 16 characters of SHA256 hash of the project path.

## Database Schema

### `files` table
- `id` - Auto-increment primary key
- `path` - Relative file path
- `content_hash` - SHA256 hash of content
- `language` - Detected language (typescript, javascript, etc.)
- `size` - File size in bytes
- `modified_at` - Last modified timestamp
- `indexed_at` - When file was indexed

### `chunks` table
- `id` - Auto-increment primary key
- `file_id` - Foreign key to files
- `level` - Chunk type: `'file'` | `'class'` | `'function'` | `'method'`
- `name` - Chunk name (e.g., function name)
- `start_line` - Starting line number
- `end_line` - Ending line number
- `content` - Chunk content
- `content_hash` - SHA256 hash
- `parent_id` - Foreign key to parent chunk (for nesting)

### `embeddings` table
- `chunk_id` - Foreign key to chunks (primary key)
- `vector` - BLOB storage for Float32Array
- `model` - Embedding model name
- `dimensions` - Vector dimensions

### `chunks_fts` virtual table
- FTS5 full-text index
- Indexes `content` and `name` fields
- Porter stemming + Unicode61 tokenizer

## FTS5 Query Syntax

The search supports FTS5 query syntax:

```
"exact phrase"               - Exact phrase match
keyword1 keyword2            - Both keywords (implicit AND)
keyword1 OR keyword2         - Either keyword
keyword1 AND keyword2        - Both keywords (explicit)
keyword1 NOT keyword2        - First but not second
keyword*                     - Prefix match
"near phrase" NEAR/5 other   - Words within 5 tokens
```

## Performance

- **Indexing**: ~150 files/second (file-level chunks)
- **Search**: 20-50ms for FTS queries
- **Storage**: ~10-20KB per file

## Configuration

Default file patterns can be customized when indexing:

```javascript
const patterns = [
  '**/*.ts',
  '**/*.tsx',
  '**/*.js',
  '**/*.jsx',
  '**/*.py',
  '**/*.rs',
  '**/*.go',
];
```

Excluded directories:
- `node_modules`
- `dist`
- `build`
- `.git`

## Language Support

Detected from file extensions:

| Extension | Language |
|-----------|----------|
| `.ts`, `.tsx` | typescript |
| `.js`, `.jsx` | javascript |
| `.py` | python |
| `.rs` | rust |
| `.go` | go |
| `.java` | java |
| `.c`, `.h` | c |
| `.cpp`, `.hpp` | cpp |

## Future Enhancements

### Phase 2: Tree-sitter Parsing
- Parse files with tree-sitter AST
- Extract function and class definitions
- Create granular chunks for better search
- Preserve hierarchical relationships

### Phase 3: Vector Embeddings
- Generate embeddings with local model (all-MiniLM-L6-v2)
- Or use API (Voyage AI, OpenAI)
- Store in embeddings table
- Implement vector similarity search

### Phase 4: Hybrid Search
- Combine FTS + vector search
- Use RRF (Reciprocal Rank Fusion) for ranking
- Weighted combination based on query type

### Phase 5: Real-time Updates
- File watcher integration
- Incremental updates on file changes
- Debounced reindexing

## Troubleshooting

### "Project not indexed" error

Run `index_project` first:

```json
{
  "name": "index_project",
  "arguments": {
    "projectPath": "/path/to/project"
  }
}
```

### No search results

Check:
1. Project is indexed (`get_index_status`)
2. Query matches content (try broader keywords)
3. File patterns include your file types
4. Files are not excluded (node_modules, dist, etc.)

### Database locked error

Close other connections to the database:
- Restart MCP server
- Check for orphaned processes

## Development

### Running Tests

```bash
node test-semantic-search.js
```

### Debugging

Enable verbose SQL logging:

```javascript
const db = new SemanticDatabase(dbPath, { verbose: true });
```

### Manual Testing

Use the MCP Inspector or direct stdio:

```bash
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node semantic-search-mcp-server.js
```

## Architecture

```
┌─────────────────────────────────────┐
│  MCP Client (Quack App)             │
├─────────────────────────────────────┤
│  MCP Protocol (stdio)               │
├─────────────────────────────────────┤
│  semantic-search-mcp-server.js      │
│  - index_project handler            │
│  - semantic_search_code handler     │
│  - get_index_status handler         │
├─────────────────────────────────────┤
│  lib/semantic-db.js                 │
│  - SemanticDatabase class           │
│  - FTS5 search                      │
│  - Vector search (planned)          │
│  - Hybrid RRF search (planned)      │
├─────────────────────────────────────┤
│  SQLite Database                    │
│  - files table                      │
│  - chunks table                     │
│  - embeddings table                 │
│  - chunks_fts (FTS5)                │
└─────────────────────────────────────┘
```

## Related Files

- `semantic-search-mcp-server.js` - MCP server implementation
- `lib/semantic-db.js` - Database module
- `test-semantic-search.js` - Integration tests
- `.claude/docs/semantic-search-mcp-integration.md` - Full documentation

## License

MIT

## Author

Alek Dobrohotov (Agent Jack - Project Manager)
