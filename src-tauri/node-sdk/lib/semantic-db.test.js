// semantic-db.test.js - Test suite for SemanticDatabase
import { SemanticDatabase, cosineSimilarity, serializeVector, deserializeVector, normalizeVector } from './semantic-db.js';
import { unlink, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Test database path
const TEST_DB_PATH = join(tmpdir(), 'semantic-test.db');

// Cleanup helper
function cleanupTestDb() {
    if (existsSync(TEST_DB_PATH)) {
        unlink(TEST_DB_PATH, () => {});
    }
}

// ============================================================================
// TEST RUNNER
// ============================================================================

class TestRunner {
    constructor() {
        this.tests = [];
        this.passed = 0;
        this.failed = 0;
    }

    test(name, fn) {
        this.tests.push({ name, fn });
    }

    async run() {
        console.log('\n🧪 Running SemanticDatabase Tests\n');

        for (const { name, fn } of this.tests) {
            try {
                await fn();
                this.passed++;
                console.log(`✅ ${name}`);
            } catch (error) {
                this.failed++;
                console.log(`❌ ${name}`);
                console.error(`   Error: ${error.message}`);
            }
        }

        console.log(`\n📊 Results: ${this.passed} passed, ${this.failed} failed\n`);
        process.exit(this.failed > 0 ? 1 : 0);
    }
}

const runner = new TestRunner();

// ============================================================================
// UTILITY TESTS
// ============================================================================

runner.test('cosineSimilarity - identical vectors', () => {
    const a = new Float32Array([1, 2, 3, 4]);
    const b = new Float32Array([1, 2, 3, 4]);
    const similarity = cosineSimilarity(a, b);
    if (Math.abs(similarity - 1.0) > 0.0001) {
        throw new Error(`Expected 1.0, got ${similarity}`);
    }
});

runner.test('cosineSimilarity - orthogonal vectors', () => {
    const a = new Float32Array([1, 0, 0]);
    const b = new Float32Array([0, 1, 0]);
    const similarity = cosineSimilarity(a, b);
    if (Math.abs(similarity) > 0.0001) {
        throw new Error(`Expected 0.0, got ${similarity}`);
    }
});

runner.test('cosineSimilarity - opposite vectors', () => {
    const a = new Float32Array([1, 2, 3]);
    const b = new Float32Array([-1, -2, -3]);
    const similarity = cosineSimilarity(a, b);
    if (Math.abs(similarity - (-1.0)) > 0.0001) {
        throw new Error(`Expected -1.0, got ${similarity}`);
    }
});

runner.test('serializeVector and deserializeVector', () => {
    const original = new Float32Array([1.5, 2.7, 3.1, 4.9]);
    const serialized = serializeVector(original);
    const deserialized = deserializeVector(serialized);

    for (let i = 0; i < original.length; i++) {
        if (Math.abs(original[i] - deserialized[i]) > 0.0001) {
            throw new Error(`Mismatch at index ${i}: ${original[i]} vs ${deserialized[i]}`);
        }
    }
});

runner.test('normalizeVector', () => {
    const vector = new Float32Array([3, 4]); // 3-4-5 triangle
    const normalized = normalizeVector(vector);

    // Should have unit length
    let norm = 0;
    for (let i = 0; i < normalized.length; i++) {
        norm += normalized[i] * normalized[i];
    }
    norm = Math.sqrt(norm);

    if (Math.abs(norm - 1.0) > 0.0001) {
        throw new Error(`Expected unit norm, got ${norm}`);
    }
});

// ============================================================================
// DATABASE TESTS
// ============================================================================

runner.test('Database initialization', () => {
    cleanupTestDb();
    const db = new SemanticDatabase(TEST_DB_PATH);

    // Check tables exist
    const tables = db.db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
    const tableNames = tables.map(t => t.name);

    const requiredTables = ['files', 'chunks', 'embeddings', 'chunks_fts'];
    for (const table of requiredTables) {
        if (!tableNames.includes(table)) {
            throw new Error(`Missing table: ${table}`);
        }
    }

    db.close();
});

runner.test('File upsert and retrieval', () => {
    cleanupTestDb();
    const db = new SemanticDatabase(TEST_DB_PATH);

    const fileId = db.upsertFile('/test/file.ts', 'abc123', 'typescript', 1024);

    if (!fileId || fileId < 1) {
        throw new Error('Invalid file ID');
    }

    const file = db.getFile('/test/file.ts');
    if (!file || file.path !== '/test/file.ts' || file.content_hash !== 'abc123') {
        throw new Error('File retrieval failed');
    }

    db.close();
});

runner.test('File update (upsert)', () => {
    cleanupTestDb();
    const db = new SemanticDatabase(TEST_DB_PATH);

    const fileId1 = db.upsertFile('/test/file.ts', 'hash1', 'typescript', 1024);
    const fileId2 = db.upsertFile('/test/file.ts', 'hash2', 'typescript', 2048);

    if (fileId1 !== fileId2) {
        throw new Error('File ID changed on update');
    }

    const file = db.getFile('/test/file.ts');
    if (file.content_hash !== 'hash2' || file.size !== 2048) {
        throw new Error('File not updated correctly');
    }

    db.close();
});

runner.test('File deletion cascades to chunks', () => {
    cleanupTestDb();
    const db = new SemanticDatabase(TEST_DB_PATH);

    const fileId = db.upsertFile('/test/file.ts', 'abc123', 'typescript', 1024);
    const chunkId = db.insertChunk(fileId, 'function', 'testFunc', 1, 10, 'function testFunc() {}');

    const deleted = db.deleteFile('/test/file.ts');
    if (!deleted) {
        throw new Error('File deletion failed');
    }

    const chunks = db.getChunksForFile(fileId);
    if (chunks.length !== 0) {
        throw new Error('Chunks not deleted on file deletion');
    }

    db.close();
});

runner.test('Chunk insertion and retrieval', () => {
    cleanupTestDb();
    const db = new SemanticDatabase(TEST_DB_PATH);

    const fileId = db.upsertFile('/test/file.ts', 'abc123', 'typescript', 1024);
    const chunkId = db.insertChunk(
        fileId,
        'function',
        'myFunction',
        10,
        20,
        'function myFunction() { return 42; }'
    );

    if (!chunkId || chunkId < 1) {
        throw new Error('Invalid chunk ID');
    }

    const chunk = db.getChunkById(chunkId);
    if (!chunk || chunk.name !== 'myFunction' || chunk.level !== 'function') {
        throw new Error('Chunk retrieval failed');
    }

    db.close();
});

runner.test('Multiple chunks for file', () => {
    cleanupTestDb();
    const db = new SemanticDatabase(TEST_DB_PATH);

    const fileId = db.upsertFile('/test/file.ts', 'abc123', 'typescript', 1024);

    db.insertChunk(fileId, 'function', 'func1', 1, 10, 'function func1() {}');
    db.insertChunk(fileId, 'function', 'func2', 15, 25, 'function func2() {}');
    db.insertChunk(fileId, 'class', 'MyClass', 30, 50, 'class MyClass {}');

    const chunks = db.getChunksForFile(fileId);
    if (chunks.length !== 3) {
        throw new Error(`Expected 3 chunks, got ${chunks.length}`);
    }

    db.close();
});

runner.test('Embedding insertion and retrieval', () => {
    cleanupTestDb();
    const db = new SemanticDatabase(TEST_DB_PATH);

    const fileId = db.upsertFile('/test/file.ts', 'abc123', 'typescript', 1024);
    const chunkId = db.insertChunk(fileId, 'function', 'test', 1, 10, 'function test() {}');

    const vector = new Float32Array([0.1, 0.2, 0.3, 0.4]);
    db.insertEmbedding(chunkId, vector, 'all-MiniLM-L6-v2', 4);

    const embedding = db.getEmbedding(chunkId);
    if (!embedding || embedding.chunk_id !== chunkId) {
        throw new Error('Embedding retrieval failed');
    }

    // Check vector values
    for (let i = 0; i < vector.length; i++) {
        if (Math.abs(embedding.vector[i] - vector[i]) > 0.0001) {
            throw new Error(`Vector mismatch at index ${i}`);
        }
    }

    db.close();
});

runner.test('Full-text search', () => {
    cleanupTestDb();
    const db = new SemanticDatabase(TEST_DB_PATH);

    const fileId = db.upsertFile('/test/auth.ts', 'abc123', 'typescript', 1024);
    db.insertChunk(fileId, 'function', 'authenticate', 1, 10, 'function authenticate(user, password) {}');
    db.insertChunk(fileId, 'function', 'authorize', 15, 25, 'function authorize(user, resource) {}');
    db.insertChunk(fileId, 'function', 'logout', 30, 40, 'function logout(user) {}');

    const results = db.searchFTS('authenticate');
    if (results.length === 0) {
        throw new Error('FTS search returned no results');
    }

    if (results[0].name !== 'authenticate') {
        throw new Error('FTS search returned wrong result');
    }

    db.close();
});

runner.test('Vector search', () => {
    cleanupTestDb();
    const db = new SemanticDatabase(TEST_DB_PATH);

    const fileId = db.upsertFile('/test/file.ts', 'abc123', 'typescript', 1024);

    const chunk1 = db.insertChunk(fileId, 'function', 'func1', 1, 10, 'function func1() {}');
    const chunk2 = db.insertChunk(fileId, 'function', 'func2', 15, 25, 'function func2() {}');

    // Similar vectors
    db.insertEmbedding(chunk1, new Float32Array([1, 0, 0, 0]), 'test', 4);
    db.insertEmbedding(chunk2, new Float32Array([0, 1, 0, 0]), 'test', 4);

    // Query vector close to chunk1
    const queryVector = new Float32Array([0.9, 0.1, 0, 0]);
    const results = db.searchVector(queryVector, 2);

    if (results.length === 0) {
        throw new Error('Vector search returned no results');
    }

    // First result should be chunk1 (higher similarity)
    if (results[0].chunk_id !== chunk1) {
        throw new Error('Vector search returned wrong result');
    }

    db.close();
});

runner.test('Hybrid search (RRF)', () => {
    cleanupTestDb();
    const db = new SemanticDatabase(TEST_DB_PATH);

    const fileId = db.upsertFile('/test/file.ts', 'abc123', 'typescript', 1024);

    const chunk1 = db.insertChunk(fileId, 'function', 'authenticate', 1, 10, 'function authenticate(user) {}');
    const chunk2 = db.insertChunk(fileId, 'function', 'validate', 15, 25, 'function validate(token) {}');

    db.insertEmbedding(chunk1, new Float32Array([1, 0, 0, 0]), 'test', 4);
    db.insertEmbedding(chunk2, new Float32Array([0, 1, 0, 0]), 'test', 4);

    const queryVector = new Float32Array([0.8, 0.2, 0, 0]);
    const results = db.searchHybrid('authenticate', queryVector, 2);

    if (results.length === 0) {
        throw new Error('Hybrid search returned no results');
    }

    // Should combine vector and text scores
    if (!results[0].rrf_score) {
        throw new Error('Missing RRF score');
    }

    db.close();
});

runner.test('Reindex file (batch operation)', () => {
    cleanupTestDb();
    const db = new SemanticDatabase(TEST_DB_PATH);

    const fileId = db.upsertFile('/test/file.ts', 'abc123', 'typescript', 1024);

    // Initial chunks
    db.insertChunk(fileId, 'function', 'oldFunc', 1, 10, 'function oldFunc() {}');

    // Reindex with new chunks
    const newChunks = [
        { level: 'function', name: 'newFunc1', start_line: 1, end_line: 10, content: 'function newFunc1() {}' },
        { level: 'function', name: 'newFunc2', start_line: 15, end_line: 25, content: 'function newFunc2() {}' }
    ];

    const chunkIds = db.reindexFile(fileId, newChunks);

    if (chunkIds.length !== 2) {
        throw new Error('Reindex failed');
    }

    const chunks = db.getChunksForFile(fileId);
    if (chunks.length !== 2 || chunks.some(c => c.name === 'oldFunc')) {
        throw new Error('Old chunks not deleted');
    }

    db.close();
});

runner.test('Batch insert embeddings', () => {
    cleanupTestDb();
    const db = new SemanticDatabase(TEST_DB_PATH);

    const fileId = db.upsertFile('/test/file.ts', 'abc123', 'typescript', 1024);
    const chunk1 = db.insertChunk(fileId, 'function', 'func1', 1, 10, 'function func1() {}');
    const chunk2 = db.insertChunk(fileId, 'function', 'func2', 15, 25, 'function func2() {}');

    const embeddings = [
        { chunk_id: chunk1, vector: new Float32Array([1, 0, 0, 0]), model: 'test', dimensions: 4 },
        { chunk_id: chunk2, vector: new Float32Array([0, 1, 0, 0]), model: 'test', dimensions: 4 }
    ];

    db.batchInsertEmbeddings(embeddings);

    const emb1 = db.getEmbedding(chunk1);
    const emb2 = db.getEmbedding(chunk2);

    if (!emb1 || !emb2) {
        throw new Error('Batch insert failed');
    }

    db.close();
});

runner.test('Database stats', () => {
    cleanupTestDb();
    const db = new SemanticDatabase(TEST_DB_PATH);

    db.upsertFile('/test/file1.ts', 'abc123', 'typescript', 1024);
    const fileId2 = db.upsertFile('/test/file2.ts', 'def456', 'typescript', 2048);

    const chunk1 = db.insertChunk(fileId2, 'function', 'func1', 1, 10, 'function func1() {}');
    db.insertEmbedding(chunk1, new Float32Array([1, 0, 0, 0]), 'test', 4);

    const stats = db.getStats();

    if (stats.fileCount !== 2) {
        throw new Error(`Expected 2 files, got ${stats.fileCount}`);
    }

    if (stats.chunkCount !== 1) {
        throw new Error(`Expected 1 chunk, got ${stats.chunkCount}`);
    }

    if (stats.embeddingCount !== 1) {
        throw new Error(`Expected 1 embedding, got ${stats.embeddingCount}`);
    }

    db.close();
});

runner.test('Needs reindexing check', () => {
    cleanupTestDb();
    const db = new SemanticDatabase(TEST_DB_PATH);

    db.upsertFile('/test/file.ts', 'hash1', 'typescript', 1024);

    // Same hash - no reindex needed
    if (db.needsReindexing('/test/file.ts', 'hash1')) {
        throw new Error('Should not need reindexing with same hash');
    }

    // Different hash - reindex needed
    if (!db.needsReindexing('/test/file.ts', 'hash2')) {
        throw new Error('Should need reindexing with different hash');
    }

    // New file - reindex needed
    if (!db.needsReindexing('/test/newfile.ts', 'hash3')) {
        throw new Error('Should need reindexing for new file');
    }

    db.close();
});

runner.test('FTS triggers work', () => {
    cleanupTestDb();
    const db = new SemanticDatabase(TEST_DB_PATH);

    const fileId = db.upsertFile('/test/file.ts', 'abc123', 'typescript', 1024);
    db.insertChunk(fileId, 'function', 'testFunction', 1, 10, 'function testFunction() { return 42; }');

    // Should be searchable immediately via FTS
    const results = db.searchFTS('testFunction');
    if (results.length === 0) {
        throw new Error('FTS trigger did not insert row');
    }

    db.close();
});

// ============================================================================
// RUN TESTS
// ============================================================================

runner.run().then(() => {
    cleanupTestDb();
});
