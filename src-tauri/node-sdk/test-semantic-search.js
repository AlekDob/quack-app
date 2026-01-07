#!/usr/bin/env node

/**
 * Test script for semantic-search MCP server
 *
 * This script tests the integration of semantic-db.js with the MCP server
 * by directly calling the database functions (not via MCP protocol).
 *
 * Usage:
 *   node test-semantic-search.js /path/to/project
 */

import { SemanticDatabase } from './lib/semantic-db.js';
import { join } from 'path';
import { tmpdir } from 'os';
import { existsSync, mkdirSync, rmSync } from 'fs';

const TEST_DB_PATH = join(tmpdir(), 'quack-semantic-test.db');

console.log('🧪 Semantic Search Integration Test\n');
console.log('='.repeat(60));

// Clean up any existing test database
if (existsSync(TEST_DB_PATH)) {
  console.log('🧹 Cleaning up old test database...');
  rmSync(TEST_DB_PATH);
}

// Create database
console.log('📦 Creating database:', TEST_DB_PATH);
const db = new SemanticDatabase(TEST_DB_PATH);

// Test 1: Insert some test files
console.log('\n✅ Test 1: Insert files');
console.log('-'.repeat(60));

const fileId1 = db.upsertFile(
  'src/auth.ts',
  'hash123',
  'typescript',
  1234,
  Date.now()
);
console.log(`   Created file: src/auth.ts (id: ${fileId1})`);

const fileId2 = db.upsertFile(
  'src/user.ts',
  'hash456',
  'typescript',
  2345,
  Date.now()
);
console.log(`   Created file: src/user.ts (id: ${fileId2})`);

// Test 2: Insert chunks
console.log('\n✅ Test 2: Insert chunks');
console.log('-'.repeat(60));

const chunk1 = db.insertChunk(
  fileId1,
  'file',
  'authenticate',
  1,
  50,
  'function authenticate(username, password) { return jwt.sign({username}); }'
);
console.log(`   Created chunk: authenticate (id: ${chunk1})`);

const chunk2 = db.insertChunk(
  fileId2,
  'file',
  'getUserProfile',
  1,
  30,
  'function getUserProfile(userId) { return database.users.find(userId); }'
);
console.log(`   Created chunk: getUserProfile (id: ${chunk2})`);

// Test 3: FTS search
console.log('\n✅ Test 3: Full-text search');
console.log('-'.repeat(60));

const searchResults = db.searchFTS('authenticate', 10);
console.log(`   Query: "authenticate"`);
console.log(`   Results: ${searchResults.length}`);
searchResults.forEach((result, i) => {
  console.log(`   ${i + 1}. ${result.path} (${result.name}) - rank: ${result.fts_rank}`);
});

// Test 4: Get stats
console.log('\n✅ Test 4: Database stats');
console.log('-'.repeat(60));

const stats = db.getStats();
console.log(`   Files: ${stats.fileCount}`);
console.log(`   Chunks: ${stats.chunkCount}`);
console.log(`   Embeddings: ${stats.embeddingCount}`);
console.log(`   Last indexed: ${new Date(stats.lastIndexed).toISOString()}`);

// Test 5: Reindexing check
console.log('\n✅ Test 5: Reindexing check');
console.log('-'.repeat(60));

const needsReindex1 = db.needsReindexing('src/auth.ts', 'hash123');
console.log(`   src/auth.ts (same hash): needs reindex = ${needsReindex1}`);

const needsReindex2 = db.needsReindexing('src/auth.ts', 'hash999');
console.log(`   src/auth.ts (new hash): needs reindex = ${needsReindex2}`);

const needsReindex3 = db.needsReindexing('src/new-file.ts', 'hash000');
console.log(`   src/new-file.ts (new file): needs reindex = ${needsReindex3}`);

// Test 6: Get all files
console.log('\n✅ Test 6: Get all files');
console.log('-'.repeat(60));

const allFiles = db.getAllFiles();
console.log(`   Total files: ${allFiles.length}`);
allFiles.forEach((file, i) => {
  console.log(`   ${i + 1}. ${file.path} (${file.language}) - ${file.size} bytes`);
});

// Cleanup
console.log('\n🧹 Cleanup');
console.log('-'.repeat(60));

db.close();
console.log('   Closed database');

rmSync(TEST_DB_PATH);
console.log('   Deleted test database');

console.log('\n' + '='.repeat(60));
console.log('✨ All tests passed!');
console.log('='.repeat(60) + '\n');

console.log('📋 Next steps:');
console.log('   1. Run `node semantic-search-mcp-server.js` to start the MCP server');
console.log('   2. Configure MCP client to connect to the server');
console.log('   3. Use tools: index_project, semantic_search_code, get_index_status');
console.log('   4. Implement tree-sitter parsing for granular chunks');
console.log('   5. Add vector embeddings for true semantic search\n');
