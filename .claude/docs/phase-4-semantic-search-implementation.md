# Phase 4 - Semantic Search Integration Implementation

**Date**: 2025-01-05
**Status**: ✅ Complete
**Branch**: feature/quack-brain

## Overview

Phase 4 adds semantic search capabilities to Quack Brain, leveraging the existing embeddings table in brain.db. This enables vector similarity search alongside full-text search (FTS) using a hybrid approach.

## Architecture

### Database Schema
The embeddings table already exists in brain.db:

```sql
CREATE TABLE embeddings (
    id TEXT PRIMARY KEY,
    entity_id TEXT NOT NULL UNIQUE,
    vector BLOB NOT NULL,
    model TEXT NOT NULL DEFAULT 'all-MiniLM-L6-v2',
    created_at INTEGER NOT NULL,
    FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
);
```

### Vector Storage Format
- **Vector encoding**: f32 little-endian bytes (4 bytes per float)
- **Model**: all-MiniLM-L6-v2 (384 dimensions)
- **Storage**: BLOB in SQLite

### Search Algorithms

1. **Semantic Search**: Cosine similarity between query and entity embeddings
2. **Hybrid Search**: Reciprocal Rank Fusion (RRF) combining FTS (BM25) + Semantic

## Implementation

### 1. Rust Backend (src-tauri/src/brain/)

#### Types Added (types.rs)
```rust
pub struct SemanticSearchResult {
    pub entity_id: String,
    pub entity_name: String,
    pub entity_type: String,
    pub score: f32,
}

pub struct HybridSearchResult {
    pub entity_id: String,
    pub entity_name: String,
    pub entity_type: String,
    pub score: f32,
}
```

#### Commands Added (commands.rs)
- `brain_store_embedding()` - Store vector embedding for entity
- `brain_get_embedding()` - Retrieve embedding by entity ID
- `brain_get_entities_without_embeddings()` - Find entities needing embeddings
- `brain_semantic_search()` - Semantic search using cosine similarity
- `brain_hybrid_search()` - Hybrid search (FTS + semantic with RRF)

#### Helper Function
- `cosine_similarity()` - Calculate cosine similarity between two vectors

#### Registered in lib.rs
All 5 new commands registered in Tauri invoke handler.

### 2. TypeScript Frontend (src/)

#### Types Added (types/brain.ts)
```typescript
export interface SemanticSearchResult {
  entityId: string;
  entityName: string;
  entityType: string;
  score: number; // Cosine similarity (0-1)
}

export interface HybridSearchResult {
  entityId: string;
  entityName: string;
  entityType: string;
  score: number; // RRF combined score
}
```

#### Service Functions Added (services/brainService.ts)
- `storeEmbedding()` - Store embedding for entity
- `getEmbedding()` - Get embedding for entity
- `getEntitiesWithoutEmbeddings()` - Get entities without embeddings
- `semanticSearch()` - Semantic search using query vector
- `hybridSearch()` - Hybrid search (FTS + semantic)

#### BrainService Class Updated
All 5 new methods added to singleton service instance.

## Key Features

### Vector Storage
- **Format**: f32 little-endian (4 bytes per dimension)
- **Serialization**: Flat byte array in SQLite BLOB
- **Deserialization**: Chunk bytes into f32 values

### Cosine Similarity
- **Range**: 0.0 to 1.0 (higher = more similar)
- **Formula**: `dot(a, b) / (norm(a) * norm(b))`
- **Edge cases**: Returns 0.0 for empty or mismatched vectors

### Hybrid Search (RRF)
- **Combines**: BM25 (keyword matching) + Cosine similarity (semantic)
- **Algorithm**: Reciprocal Rank Fusion with k=60
- **Score formula**: `sum(1 / (k + rank + 1))`
- **Normalization**: FTS scores normalized to 0-1 range

### Incremental Embedding
- Track entities without embeddings
- Generate embeddings on-demand or in batches
- Store model name for future re-embedding

## Usage Examples

### Store Embedding
```typescript
const vector = await generateEmbedding('entity content');
await brainService.storeEmbedding('entity-id', vector, 'all-MiniLM-L6-v2');
```

### Semantic Search
```typescript
const queryVector = await generateEmbedding('authentication patterns');
const results = await brainService.semanticSearch(queryVector, 5);

results.forEach(({ entityName, score }) => {
  console.log(`${entityName}: ${(score * 100).toFixed(1)}% similar`);
});
```

### Hybrid Search
```typescript
// With both FTS and semantic
const queryVector = await generateEmbedding('bug fix authentication');
const results = await brainService.hybridSearch('authentication bug', queryVector, 5);

// FTS-only (no vector)
const ftsResults = await brainService.hybridSearch('authentication', undefined, 5);
```

### Batch Embedding Generation
```typescript
const needEmbeddings = await brainService.getEntitiesWithoutEmbeddings();

for (const entityId of needEmbeddings) {
  const entity = await brainService.getEntity(entityId);
  const text = entity.name + ' ' + entity.observations.map(o => o.content).join(' ');
  const vector = await generateEmbedding(text);
  await brainService.storeEmbedding(entityId, vector);
}
```

## Performance Considerations

### Scalability
- **Current**: In-memory similarity calculation (all embeddings loaded)
- **Suitable for**: 1k-10k entities
- **Future**: HNSW index for 100k+ entities (requires native extension)

### Optimization Opportunities
1. Cache embeddings in Rust HashMap
2. Batch similarity calculations
3. Use SIMD for dot product
4. Implement approximate nearest neighbor (ANN) index

## Testing

### Verification
```bash
cd src-tauri
cargo check  # ✅ Compiles successfully
```

### Manual Test
```typescript
// 1. Create test entity
const entity = await brainService.createEntity({
  name: 'test_pattern',
  entityType: 'pattern',
  observations: ['Use React hooks for state management'],
});

// 2. Store embedding
const vector = new Array(384).fill(0.5); // Mock vector
await brainService.storeEmbedding(entity.id, vector);

// 3. Semantic search
const results = await brainService.semanticSearch(vector, 1);
console.log(results); // Should return test_pattern with score 1.0

// 4. Hybrid search
const hybrid = await brainService.hybridSearch('hooks', vector, 5);
console.log(hybrid);
```

## Files Modified

### Rust
- `src-tauri/src/brain/types.rs` - Added SemanticSearchResult, HybridSearchResult
- `src-tauri/src/brain/commands.rs` - Added 5 new commands + cosine_similarity
- `src-tauri/src/lib.rs` - Registered 5 new commands

### TypeScript
- `src/types/brain.ts` - Added SemanticSearchResult, HybridSearchResult
- `src/services/brainService.ts` - Added 5 new functions + BrainService methods

## Next Steps

### Phase 5: Embedding Generation Integration
1. Add embedding model (Transformers.js or ONNX Runtime)
2. Auto-generate embeddings on entity creation
3. Background worker for batch embedding
4. Re-embedding when model changes

### Phase 6: Advanced Search Features
1. Faceted search (filter by entity type during search)
2. Multi-modal search (combine text, code, metadata)
3. Search history and suggestions
4. Export search results

### Phase 7: UI Integration
1. Search bar with semantic + keyword toggle
2. Search results with similarity scores
3. Entity graph visualization
4. Search analytics dashboard

## Known Limitations

1. **No embedding generation**: Phase 4 only adds storage/search, not generation
2. **No ANN index**: Uses brute-force similarity (OK for <10k entities)
3. **No incremental updates**: Re-embedding requires full entity deletion
4. **Single model**: No support for multiple embedding models yet

## Dependencies

### Rust
- rusqlite (existing)
- uuid (existing)
- serde (existing)

### TypeScript
- @tauri-apps/api (existing)

### Future
- transformers.js (for embedding generation)
- onnxruntime-node (alternative to transformers.js)

## References

- [BM25 Algorithm](https://en.wikipedia.org/wiki/Okapi_BM25)
- [Cosine Similarity](https://en.wikipedia.org/wiki/Cosine_similarity)
- [Reciprocal Rank Fusion](https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf)
- [all-MiniLM-L6-v2 Model](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2)
