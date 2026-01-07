// semantic-db-example.js - Example usage of SemanticDatabase
import { SemanticDatabase } from './semantic-db.js';
import { join } from 'path';
import { tmpdir } from 'os';

// ============================================================================
// BASIC USAGE EXAMPLE
// ============================================================================

console.log('🗄️  SemanticDatabase Example\n');

// Create database
const dbPath = join(tmpdir(), 'example-semantic.db');
const db = new SemanticDatabase(dbPath);

console.log('✅ Database created at:', dbPath);

// ============================================================================
// 1. INDEX A FILE
// ============================================================================

console.log('\n📁 Step 1: Index a TypeScript file');

const filePath = '/src/services/AuthService.ts';
const fileContent = `
export class AuthService {
    private tokenCache: Map<string, string>;

    constructor() {
        this.tokenCache = new Map();
    }

    async authenticate(username: string, password: string): Promise<Token> {
        // Validate credentials
        const isValid = await this.validateCredentials(username, password);
        if (!isValid) {
            throw new Error('Invalid credentials');
        }

        // Generate token
        const token = await this.generateToken(username);
        this.tokenCache.set(username, token);

        return token;
    }

    private async validateCredentials(username: string, password: string): Promise<boolean> {
        // Check against database
        return true; // Simplified
    }

    private async generateToken(username: string): Promise<string> {
        return 'jwt-token-' + Date.now();
    }
}
`;

// Calculate content hash
import { createHash } from 'crypto';
const contentHash = createHash('sha256').update(fileContent).digest('hex');

// Insert file
const fileId = db.upsertFile(filePath, contentHash, 'typescript', fileContent.length);
console.log(`   File ID: ${fileId}`);

// ============================================================================
// 2. CREATE CHUNKS (simulating tree-sitter parsing)
// ============================================================================

console.log('\n🪓 Step 2: Create code chunks');

const chunks = [
    {
        level: 'class',
        name: 'AuthService',
        start_line: 2,
        end_line: 28,
        content: fileContent.trim()
    },
    {
        level: 'method',
        name: 'authenticate',
        start_line: 7,
        end_line: 19,
        content: `async authenticate(username: string, password: string): Promise<Token> {
        const isValid = await this.validateCredentials(username, password);
        if (!isValid) {
            throw new Error('Invalid credentials');
        }
        const token = await this.generateToken(username);
        this.tokenCache.set(username, token);
        return token;
    }`
    },
    {
        level: 'method',
        name: 'validateCredentials',
        start_line: 21,
        end_line: 24,
        content: `private async validateCredentials(username: string, password: string): Promise<boolean> {
        return true;
    }`
    },
    {
        level: 'method',
        name: 'generateToken',
        start_line: 26,
        end_line: 28,
        content: `private async generateToken(username: string): Promise<string> {
        return 'jwt-token-' + Date.now();
    }`
    }
];

const chunkIds = chunks.map(chunk => {
    const id = db.insertChunk(
        fileId,
        chunk.level,
        chunk.name,
        chunk.start_line,
        chunk.end_line,
        chunk.content
    );
    console.log(`   ✅ ${chunk.level}: ${chunk.name} (chunk ${id})`);
    return id;
});

// ============================================================================
// 3. ADD EMBEDDINGS (simulating @xenova/transformers)
// ============================================================================

console.log('\n🔢 Step 3: Add embeddings (simulated)');

// In real usage, these would come from Transformers.js
// For demo, we create random-ish vectors based on content
function simulateEmbedding(text, dimensions = 384) {
    const vector = new Float32Array(dimensions);
    const hash = createHash('sha256').update(text).digest();

    for (let i = 0; i < dimensions; i++) {
        vector[i] = (hash[i % hash.length] / 255.0) - 0.5;
    }

    return vector;
}

chunkIds.forEach((chunkId, idx) => {
    const vector = simulateEmbedding(chunks[idx].content, 384);
    db.insertEmbedding(chunkId, vector, 'all-MiniLM-L6-v2', 384);
    console.log(`   ✅ Embedding for chunk ${chunkId} (384 dimensions)`);
});

// ============================================================================
// 4. SEARCH - FULL-TEXT SEARCH
// ============================================================================

console.log('\n🔍 Step 4: Full-text search');

const ftsQuery = 'authenticate';
const ftsResults = db.searchFTS(ftsQuery, 3);

console.log(`   Query: "${ftsQuery}"`);
console.log(`   Results: ${ftsResults.length}`);

ftsResults.forEach((result, idx) => {
    console.log(`   ${idx + 1}. ${result.level}: ${result.name} (${result.path})`);
    console.log(`      Lines ${result.start_line}-${result.end_line}`);
});

// ============================================================================
// 5. SEARCH - VECTOR SEARCH
// ============================================================================

console.log('\n🧮 Step 5: Vector search (semantic)');

// Simulate query embedding
const queryText = 'function that checks user credentials';
const queryVector = simulateEmbedding(queryText, 384);

const vectorResults = db.searchVector(queryVector, 3);

console.log(`   Query: "${queryText}"`);
console.log(`   Results: ${vectorResults.length}`);

vectorResults.forEach((result, idx) => {
    console.log(`   ${idx + 1}. ${result.level}: ${result.name} (score: ${result.score.toFixed(4)})`);
    console.log(`      ${result.path}`);
});

// ============================================================================
// 6. SEARCH - HYBRID SEARCH (RRF)
// ============================================================================

console.log('\n⚡ Step 6: Hybrid search (vector + FTS + RRF)');

const hybridQuery = 'token generation';
const hybridQueryVector = simulateEmbedding(hybridQuery, 384);

const hybridResults = db.searchHybrid(hybridQuery, hybridQueryVector, 3);

console.log(`   Query: "${hybridQuery}"`);
console.log(`   Results: ${hybridResults.length}`);

hybridResults.forEach((result, idx) => {
    console.log(`   ${idx + 1}. ${result.level}: ${result.name} (RRF: ${result.rrf_score.toFixed(4)})`);
    console.log(`      Vector score: ${result.vector_score?.toFixed(4) || 'N/A'}`);
    console.log(`      ${result.path}`);
});

// ============================================================================
// 7. DATABASE STATS
// ============================================================================

console.log('\n📊 Step 7: Database statistics');

const stats = db.getStats();
console.log(`   Files: ${stats.fileCount}`);
console.log(`   Chunks: ${stats.chunkCount}`);
console.log(`   Embeddings: ${stats.embeddingCount}`);
console.log(`   Last indexed: ${new Date(stats.lastIndexed).toLocaleString()}`);

// ============================================================================
// 8. REINDEXING (when file changes)
// ============================================================================

console.log('\n🔄 Step 8: Check if reindexing needed');

const currentHash = createHash('sha256').update(fileContent).digest('hex');
const needsReindex = db.needsReindexing(filePath, currentHash);
console.log(`   File: ${filePath}`);
console.log(`   Needs reindexing: ${needsReindex}`);

// Simulate file change
const modifiedContent = fileContent + '\n// Modified';
const newHash = createHash('sha256').update(modifiedContent).digest('hex');
const needsReindexAfterChange = db.needsReindexing(filePath, newHash);
console.log(`   After modification: ${needsReindexAfterChange}`);

// ============================================================================
// CLEANUP
// ============================================================================

console.log('\n🧹 Cleanup');
db.close();
console.log('   Database closed\n');

// ============================================================================
// ADVANCED EXAMPLE: BATCH REINDEXING
// ============================================================================

console.log('📚 Advanced Example: Batch Reindexing\n');

const db2 = new SemanticDatabase(dbPath);

// Simulate reindexing after file change
const newChunks = [
    { level: 'class', name: 'AuthService', start_line: 1, end_line: 30, content: 'modified class...' },
    { level: 'method', name: 'authenticate', start_line: 5, end_line: 15, content: 'modified authenticate...' },
    { level: 'method', name: 'logout', start_line: 20, end_line: 25, content: 'new logout method...' }
];

console.log('   Reindexing file with new chunks...');
const newChunkIds = db2.reindexFile(fileId, newChunks);
console.log(`   ✅ Created ${newChunkIds.length} new chunks`);

// Batch embed
console.log('   Creating embeddings in batch...');
const embeddings = newChunkIds.map((chunkId, idx) => ({
    chunk_id: chunkId,
    vector: simulateEmbedding(newChunks[idx].content, 384),
    model: 'all-MiniLM-L6-v2',
    dimensions: 384
}));

db2.batchInsertEmbeddings(embeddings);
console.log(`   ✅ Inserted ${embeddings.length} embeddings in transaction`);

// Verify
const finalStats = db2.getStats();
console.log('\n   Final stats:');
console.log(`   Chunks: ${finalStats.chunkCount}`);
console.log(`   Embeddings: ${finalStats.embeddingCount}`);

db2.close();

console.log('\n✨ Example completed!\n');
