#!/usr/bin/env node

/**
 * embeddings-example.js - Example usage of the embeddings module
 *
 * This demonstrates how to:
 * 1. Initialize the embedding model
 * 2. Generate embeddings for code chunks
 * 3. Store embeddings in the semantic database
 * 4. Perform semantic search queries
 *
 * Run with: node lib/embeddings-example.js
 */

import {
  initEmbeddings,
  embed,
  embedBatch,
  embedQuery,
  getModelInfo,
  MODEL_INFO
} from './embeddings.js';

import { SemanticDatabase } from './semantic-db.js';

// ============================================================================
// EXAMPLE 1: Initialize and Get Model Info
// ============================================================================

console.log('='.repeat(60));
console.log('Example 1: Model Initialization');
console.log('='.repeat(60));

// Initialize the model with progress tracking
await initEmbeddings({
  onProgress: (percent, message) => {
    console.log(`[${percent}%] ${message}`);
  }
});

// Get model information
const modelInfo = getModelInfo();
console.log('\nModel Info:');
console.log(`  Name: ${modelInfo.name}`);
console.log(`  Dimensions: ${modelInfo.dimensions}`);
console.log(`  Max Tokens: ${modelInfo.maxTokens}`);
console.log(`  Cache Path: ${modelInfo.cachePath}`);
console.log(`  Initialized: ${modelInfo.initialized}`);

// ============================================================================
// EXAMPLE 2: Generate Single Embedding
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log('Example 2: Single Embedding Generation');
console.log('='.repeat(60));

const code = `
function authenticateUser(username, password) {
  const user = database.findUser(username);
  if (!user) return null;

  const isValid = bcrypt.compare(password, user.hashedPassword);
  if (!isValid) return null;

  return generateToken(user);
}
`;

console.log('\nCode snippet:');
console.log(code);

const embedding = await embed(code);

console.log(`\nGenerated embedding:`);
console.log(`  Type: ${embedding.constructor.name}`);
console.log(`  Dimensions: ${embedding.length}`);
console.log(`  First 5 values: [${Array.from(embedding.slice(0, 5)).map(v => v.toFixed(4)).join(', ')}]`);

// ============================================================================
// EXAMPLE 3: Batch Embedding Generation
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log('Example 3: Batch Embedding Generation');
console.log('='.repeat(60));

const codeSamples = [
  'function getUserById(id) { return db.users.findOne({ _id: id }); }',
  'function createUser(data) { return db.users.insertOne(data); }',
  'function updateUser(id, data) { return db.users.updateOne({ _id: id }, data); }',
  'function deleteUser(id) { return db.users.deleteOne({ _id: id }); }',
  'class UserRepository { constructor(db) { this.collection = db.collection("users"); } }'
];

console.log(`\nGenerating embeddings for ${codeSamples.length} code samples...`);

const startTime = Date.now();
const embeddings = await embedBatch(codeSamples);
const duration = Date.now() - startTime;

console.log(`\nBatch generation complete:`);
console.log(`  Total time: ${duration}ms`);
console.log(`  Average per text: ${(duration / codeSamples.length).toFixed(1)}ms`);
console.log(`  Embeddings generated: ${embeddings.length}`);

// ============================================================================
// EXAMPLE 4: Query Embedding for Search
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log('Example 4: Query Embedding for Search');
console.log('='.repeat(60));

const searchQuery = 'find user by id';
console.log(`\nSearch query: "${searchQuery}"`);

const queryEmbedding = await embedQuery(searchQuery);
console.log(`\nQuery embedding generated:`);
console.log(`  Dimensions: ${queryEmbedding.length}`);

// Calculate similarity with code samples
console.log('\nSimilarity scores:');

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

codeSamples.forEach((sample, i) => {
  const similarity = cosineSimilarity(queryEmbedding, embeddings[i]);
  console.log(`  ${similarity.toFixed(4)} - ${sample.substring(0, 50)}...`);
});

// ============================================================================
// EXAMPLE 5: Full Integration with SemanticDatabase
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log('Example 5: Full Integration with SemanticDatabase');
console.log('='.repeat(60));

// Create in-memory database
const dbPath = '/tmp/quack-embeddings-example.db';
const db = new SemanticDatabase(dbPath);

console.log(`\nCreated database at: ${dbPath}`);

// Create a file record
const filePath = '/example/user-service.ts';
const fileId = db.upsertFile(
  filePath,
  'example-hash',
  'typescript',
  2048,
  Date.now()
);

console.log(`\nCreated file record (ID: ${fileId}): ${filePath}`);

// Insert chunks and embeddings
console.log('\nIndexing code chunks...');

for (let i = 0; i < codeSamples.length; i++) {
  const sample = codeSamples[i];

  // Extract function name (simple regex)
  const nameMatch = sample.match(/(?:function|class)\s+(\w+)/);
  const name = nameMatch ? nameMatch[1] : `chunk_${i}`;

  // Insert chunk
  const chunkId = db.insertChunk(
    fileId,
    'function',
    name,
    i * 10 + 1,
    i * 10 + 10,
    sample
  );

  // Insert embedding
  db.insertEmbedding(chunkId, embeddings[i], MODEL_INFO.name, MODEL_INFO.dimensions);

  console.log(`  ✓ Indexed chunk ${chunkId}: ${name}`);
}

// Get database stats
const stats = db.getStats();
console.log('\nDatabase stats:');
console.log(`  Files: ${stats.fileCount}`);
console.log(`  Chunks: ${stats.chunkCount}`);
console.log(`  Embeddings: ${stats.embeddingCount}`);

// Perform semantic search
console.log('\n' + '-'.repeat(60));
console.log('Semantic Search Query: "find user by id"');
console.log('-'.repeat(60));

const searchResults = db.searchVector(queryEmbedding, 5);

console.log(`\nTop ${searchResults.length} results:\n`);

searchResults.forEach((result, i) => {
  console.log(`${i + 1}. [Score: ${result.score.toFixed(4)}] ${result.name}`);
  console.log(`   ${result.content.substring(0, 80)}...`);
  console.log('');
});

// Perform hybrid search (vector + FTS)
console.log('-'.repeat(60));
console.log('Hybrid Search Query: "getUserById"');
console.log('-'.repeat(60));

const hybridQuery = 'getUserById';
const hybridQueryEmbedding = await embedQuery(hybridQuery);
const hybridResults = db.searchHybrid(hybridQuery, hybridQueryEmbedding, 5);

console.log(`\nTop ${hybridResults.length} results (hybrid):\n`);

hybridResults.forEach((result, i) => {
  console.log(`${i + 1}. [RRF Score: ${result.rrf_score.toFixed(4)}] ${result.name}`);
  if (result.vector_rank) console.log(`   Vector rank: ${result.vector_rank}`);
  if (result.fts_rank) console.log(`   FTS rank: ${result.fts_rank}`);
  console.log(`   ${result.content.substring(0, 80)}...`);
  console.log('');
});

// Cleanup
db.close();
console.log('\n✅ Example completed successfully!');
console.log('='.repeat(60));
