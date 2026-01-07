# Embeddings Module

Local embedding generation using Transformers.js for semantic code search.

## Overview

The embeddings module provides efficient, local text embedding generation using the `all-MiniLM-L6-v2` model from Transformers.js. It's optimized for code chunks and integrates seamlessly with the `SemanticDatabase`.

### Key Features

- **Local Inference**: No API calls, runs entirely on-device
- **Fast**: ~2-3ms per embedding after model initialization
- **Efficient**: Batch processing support for multiple texts
- **Optimized for Code**: Preprocessing removes comments and normalizes whitespace
- **Persistent Cache**: Model downloaded once (~80MB), then cached locally

## Quick Start

```javascript
import { initEmbeddings, embed, embedQuery } from './embeddings.js';

// Initialize model (auto-downloads on first run)
await initEmbeddings();

// Generate embedding for code
const code = 'function authenticate(user, password) { /* ... */ }';
const embedding = await embed(code);
// => Float32Array(384) [0.123, -0.456, ...]

// Generate embedding for search query
const queryEmbedding = await embedQuery('user authentication');
// => Float32Array(384)
```

## API Reference

### Model Configuration

```javascript
export const MODEL_INFO = {
  name: 'Xenova/all-MiniLM-L6-v2',
  dimensions: 384,
  maxTokens: 256,
  size: '~80MB'
}
```

### Initialization

#### `initEmbeddings(options)`

Initialize the embedding model (lazy loading). Downloads ~80MB on first run, then uses cached version.

**Parameters:**
- `options.onProgress(percent, message)` - Progress callback for download tracking

**Returns:** `Promise<void>`

**Example:**
```javascript
await initEmbeddings({
  onProgress: (percent, message) => {
    console.log(`[${percent}%] ${message}`);
  }
});
```

### Embedding Generation

#### `embed(text, options)`

Generate embedding for a single text. Auto-initializes model on first call.

**Parameters:**
- `text` (string) - Text to embed
- `options.preprocess` (boolean) - Apply code preprocessing (default: true)
- `options.normalize` (boolean) - Normalize vector (default: true)

**Returns:** `Promise<Float32Array>` - 384-dimensional embedding vector

**Example:**
```javascript
const embedding = await embed('function test() { return 42; }');
console.log(embedding.length); // 384
```

#### `embedBatch(texts, options)`

Generate embeddings for multiple texts efficiently.

**Parameters:**
- `texts` (string[]) - Array of texts to embed
- `options.preprocess` (boolean) - Apply preprocessing (default: true)
- `options.normalize` (boolean) - Normalize vectors (default: true)
- `options.batchSize` (number) - Batch size for processing (default: 32)

**Returns:** `Promise<Float32Array[]>` - Array of embedding vectors

**Example:**
```javascript
const texts = [
  'function foo() { }',
  'function bar() { }',
  'class Baz { }'
];

const embeddings = await embedBatch(texts);
console.log(embeddings.length); // 3
```

#### `embedQuery(query, options)`

Generate embedding for a search query (optimized preprocessing).

**Parameters:**
- `query` (string) - Search query
- `options.normalize` (boolean) - Normalize vector (default: true)

**Returns:** `Promise<Float32Array>` - Query embedding

**Example:**
```javascript
const queryEmbedding = await embedQuery('find authentication function');
```

### Preprocessing

#### `preprocessCode(text)`

Preprocess code text for embedding generation:
- Removes block comments (`/* ... */`)
- Removes line comments (`// ...`)
- Normalizes whitespace
- Truncates to maxTokens if needed

**Parameters:**
- `text` (string) - Raw code text

**Returns:** `string` - Preprocessed text

#### `preprocessQuery(query)`

Preprocess search query (simpler than code preprocessing).

**Parameters:**
- `query` (string) - Search query

**Returns:** `string` - Preprocessed query

### Utilities

#### `isInitialized()`

Check if the model is initialized.

**Returns:** `boolean`

#### `getModelInfo()`

Get model metadata.

**Returns:** `object` - Model information including initialization status

**Example:**
```javascript
const info = getModelInfo();
console.log(info);
// {
//   name: 'Xenova/all-MiniLM-L6-v2',
//   dimensions: 384,
//   maxTokens: 256,
//   initialized: true,
//   cachePath: '/path/to/models'
// }
```

#### `cleanup()`

Cleanup resources (clears model reference).

**Returns:** `Promise<void>`

## Integration with SemanticDatabase

```javascript
import { SemanticDatabase } from './semantic-db.js';
import { embed, embedQuery, MODEL_INFO } from './embeddings.js';

// Create database
const db = new SemanticDatabase('/path/to/index.db');

// Index a file
const fileId = db.upsertFile('/src/auth.ts', 'hash', 'typescript', 1024, Date.now());

// Create chunk
const chunkId = db.insertChunk(
  fileId,
  'function',
  'authenticate',
  1, 10,
  'function authenticate(user, password) { /* ... */ }'
);

// Generate and store embedding
const code = 'function authenticate(user, password) { /* ... */ }';
const embedding = await embed(code);
db.insertEmbedding(chunkId, embedding, MODEL_INFO.name, MODEL_INFO.dimensions);

// Search
const query = 'user authentication';
const queryEmbedding = await embedQuery(query);
const results = db.searchVector(queryEmbedding, 10);

results.forEach(result => {
  console.log(`${result.name} (score: ${result.score})`);
});
```

## Performance

### Initialization
- **First run**: ~3-5 seconds (downloads 80MB model)
- **Subsequent runs**: ~500ms (loads from cache)

### Embedding Generation
- **Single embedding**: ~2-3ms (after init)
- **Batch (50 texts)**: ~100ms (~2ms per text)
- **Large batch (1000 texts)**: ~2-3 seconds (~2-3ms per text)

### Memory
- **Model size**: ~80MB on disk
- **Runtime memory**: ~200-300MB (loaded model)

## Model Details

**Model**: [all-MiniLM-L6-v2](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2)

- **Type**: Sentence transformer (BERT-based)
- **Dimensions**: 384
- **Max sequence length**: 256 tokens
- **Use case**: Semantic similarity, information retrieval
- **Performance**: Fast inference, good quality for short texts

**Strengths:**
- Fast inference (~2-3ms per text)
- Small model size (~80MB)
- Good semantic understanding
- Trained on diverse text datasets

**Limitations:**
- Max 256 tokens (longer text is truncated)
- Not specifically fine-tuned for code (but works well)
- English-focused (other languages have lower quality)

## Storage

### Model Cache

Models are cached in:
- **macOS**: `~/Library/Application Support/com.quack.terminal/models/`
- **Windows**: `%APPDATA%/com.quack.terminal/models/`
- **Linux**: `~/.local/share/com.quack.terminal/models/`

### Cache Structure

```
models/
└── models--Xenova--all-MiniLM-L6-v2/
    ├── onnx/
    │   ├── model.onnx
    │   └── model_quantized.onnx
    ├── tokenizer.json
    └── config.json
```

## Testing

Run the test suite:

```bash
npm run test:embeddings
```

Run the example demo:

```bash
node lib/embeddings-example.js
```

## Troubleshooting

### Model download fails

**Problem**: Network issues prevent model download

**Solution**:
- Check internet connection
- Try again (downloads are resumable)
- Manually download from HuggingFace and place in cache directory

### Out of memory errors

**Problem**: Running out of memory when processing large batches

**Solution**:
- Reduce `batchSize` parameter in `embedBatch()`
- Process files in smaller chunks
- Increase Node.js heap size: `node --max-old-space-size=4096`

### Slow performance

**Problem**: Embeddings take longer than expected

**Solution**:
- Ensure model is fully cached (first run is slower)
- Use batch processing instead of individual calls
- Check CPU usage (model runs on CPU)
- Close other resource-intensive applications

### Different results between runs

**Problem**: Embeddings differ slightly between runs

**Solution**:
- This is expected due to floating-point precision
- Use cosine similarity (robust to small variations)
- Differences are typically <0.1% magnitude

## Advanced Usage

### Custom Preprocessing

```javascript
import { embed } from './embeddings.js';

// Disable default preprocessing
const embedding = await embed(code, { preprocess: false });

// Apply your own preprocessing
function customPreprocess(code) {
  // Remove imports
  code = code.replace(/^import .+$/gm, '');

  // Keep only function bodies
  // ...

  return code;
}

const processedCode = customPreprocess(rawCode);
const embedding = await embed(processedCode, { preprocess: false });
```

### Similarity Calculation

```javascript
function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

const sim = cosineSimilarity(embedding1, embedding2);
console.log(`Similarity: ${(sim * 100).toFixed(1)}%`);
```

### Progress Tracking for Large Batches

```javascript
const texts = Array(1000).fill('some code');

await embedBatch(texts, {
  batchSize: 32,
  onProgress: (current, total) => {
    console.log(`Progress: ${current}/${total}`);
  }
});
```

## Related

- **SemanticDatabase** (`semantic-db.js`) - SQLite storage for embeddings
- **CodeChunker** (`code-chunker.js`) - Parse and chunk code files
- **MCP Server** (`semantic-search-mcp-server.js`) - MCP server for AI integration

## License

Part of Quack - MIT License
