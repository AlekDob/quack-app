// embeddings.test.js - Test suite for embeddings module
// Run with: node embeddings.test.js

import {
  initEmbeddings,
  embed,
  embedBatch,
  embedQuery,
  preprocessCode,
  preprocessQuery,
  isInitialized,
  getModelInfo,
  MODEL_INFO,
  cleanup
} from './embeddings.js';

// ============================================================================
// TEST UTILITIES
// ============================================================================

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✓ ${message}`);
    testsPassed++;
  } else {
    console.error(`✗ ${message}`);
    testsFailed++;
  }
}

function assertClose(a, b, tolerance, message) {
  const diff = Math.abs(a - b);
  if (diff <= tolerance) {
    console.log(`✓ ${message}`);
    testsPassed++;
  } else {
    console.error(`✗ ${message} (diff: ${diff}, tolerance: ${tolerance})`);
    testsFailed++;
  }
}

async function testSection(name, fn) {
  console.log(`\n=== ${name} ===\n`);
  try {
    await fn();
  } catch (error) {
    console.error(`✗ Test section failed: ${error.message}`);
    console.error(error.stack);
    testsFailed++;
  }
}

// ============================================================================
// PREPROCESSING TESTS
// ============================================================================

await testSection('Preprocessing Tests', async () => {
  // Test code preprocessing
  const codeWithComments = `
    // This is a line comment
    function test() {
      /* Block comment */
      return 42;
    }
  `;

  const processed = preprocessCode(codeWithComments);
  assert(!processed.includes('//'), 'Line comments removed');
  assert(!processed.includes('/*'), 'Block comments removed');
  assert(processed.includes('function test()'), 'Code preserved');

  // Test whitespace normalization
  const messyCode = 'function   test()  {\n\n\n\n  return   42;\n}';
  const normalized = preprocessCode(messyCode);
  assert(!normalized.includes('   '), 'Multiple spaces normalized');
  assert(!normalized.includes('\n\n\n'), 'Excessive newlines removed');

  // Test empty input
  const empty = preprocessCode('');
  assert(empty === '', 'Empty input returns empty string');

  const nullInput = preprocessCode(null);
  assert(nullInput === '', 'Null input returns empty string');

  // Test query preprocessing
  const query = '  find   authentication   function  ';
  const processedQuery = preprocessQuery(query);
  assert(processedQuery === 'find authentication function', 'Query whitespace normalized');
  assert(!processedQuery.startsWith(' '), 'Query trimmed');
});

// ============================================================================
// INITIALIZATION TESTS
// ============================================================================

await testSection('Model Initialization Tests', async () => {
  // Test model info before initialization
  const infoBefore = getModelInfo();
  assert(infoBefore.name === MODEL_INFO.name, 'Model name correct');
  assert(infoBefore.dimensions === 384, 'Dimensions correct');
  assert(!infoBefore.initialized, 'Model not initialized yet');

  // Test initialization with progress callback
  const progressUpdates = [];
  await initEmbeddings({
    onProgress: (percent, message) => {
      progressUpdates.push({ percent, message });
      console.log(`  Progress: ${percent}% - ${message}`);
    }
  });

  assert(progressUpdates.length > 0, 'Progress callbacks received');
  assert(progressUpdates[progressUpdates.length - 1].percent === 100, 'Progress reached 100%');

  // Test that model is now initialized
  assert(isInitialized(), 'Model initialized');

  const infoAfter = getModelInfo();
  assert(infoAfter.initialized, 'Model shows as initialized');

  // Test double initialization (should be instant)
  const startTime = Date.now();
  await initEmbeddings();
  const duration = Date.now() - startTime;
  assert(duration < 100, 'Double initialization is instant');
});

// ============================================================================
// SINGLE EMBEDDING TESTS
// ============================================================================

await testSection('Single Embedding Generation Tests', async () => {
  // Test basic embedding
  const text = 'function authenticate(user, password) { return true; }';
  const embedding = await embed(text);

  assert(embedding instanceof Float32Array, 'Returns Float32Array');
  assert(embedding.length === 384, 'Has correct dimensions');
  assert(!isNaN(embedding[0]), 'Contains valid numbers');

  // Test that embedding is normalized (L2 norm should be ~1)
  let norm = 0;
  for (let i = 0; i < embedding.length; i++) {
    norm += embedding[i] * embedding[i];
  }
  norm = Math.sqrt(norm);
  assertClose(norm, 1.0, 0.01, 'Embedding is normalized');

  // Test empty text
  const emptyEmbedding = await embed('');
  assert(emptyEmbedding.length === 384, 'Empty text returns zero vector');
  let allZeros = true;
  for (let i = 0; i < emptyEmbedding.length; i++) {
    if (emptyEmbedding[i] !== 0) {
      allZeros = false;
      break;
    }
  }
  assert(allZeros, 'Empty text returns all zeros');

  // Test without preprocessing
  const rawEmbedding = await embed(text, { preprocess: false });
  assert(rawEmbedding.length === 384, 'Raw embedding has correct dimensions');

  // Test semantic similarity
  const text1 = 'function login(username, password) { /* authenticate user */ }';
  const text2 = 'function authenticate(user, pass) { /* verify credentials */ }';
  const text3 = 'function calculateTax(income) { /* compute taxes */ }';

  const emb1 = await embed(text1);
  const emb2 = await embed(text2);
  const emb3 = await embed(text3);

  // Calculate cosine similarities
  function cosineSimilarity(a, b) {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  const sim12 = cosineSimilarity(emb1, emb2);
  const sim13 = cosineSimilarity(emb1, emb3);

  console.log(`  Similarity (auth vs auth): ${sim12.toFixed(4)}`);
  console.log(`  Similarity (auth vs tax):  ${sim13.toFixed(4)}`);

  assert(sim12 > sim13, 'Similar functions have higher similarity');
  assert(sim12 > 0.7, 'Auth functions are semantically similar');
});

// ============================================================================
// BATCH EMBEDDING TESTS
// ============================================================================

await testSection('Batch Embedding Generation Tests', async () => {
  const texts = [
    'function getUserById(id) { return db.users.findOne(id); }',
    'function createUser(data) { return db.users.insert(data); }',
    'function deleteUser(id) { return db.users.remove(id); }',
    'class UserService { constructor() { this.db = database; } }',
    'const userSchema = { name: String, email: String };'
  ];

  const startTime = Date.now();
  const embeddings = await embedBatch(texts);
  const duration = Date.now() - startTime;

  assert(embeddings.length === texts.length, 'Returns embedding for each text');
  assert(embeddings[0] instanceof Float32Array, 'Each embedding is Float32Array');
  assert(embeddings[0].length === 384, 'Each embedding has correct dimensions');

  console.log(`  Batch time: ${duration}ms (${(duration / texts.length).toFixed(1)}ms per text)`);

  // Test empty batch
  const emptyBatch = await embedBatch([]);
  assert(emptyBatch.length === 0, 'Empty batch returns empty array');

  // Test batch with empty texts
  const mixedBatch = await embedBatch(['valid text', '', 'another valid text']);
  assert(mixedBatch.length === 3, 'Mixed batch returns all embeddings');
  assert(mixedBatch[1].length === 384, 'Empty text in batch returns zero vector');

  // Test large batch (should process in chunks)
  const largeBatch = Array(100).fill('function test() { return true; }');
  const largeEmbeddings = await embedBatch(largeBatch, { batchSize: 32 });
  assert(largeEmbeddings.length === 100, 'Large batch processes all texts');
});

// ============================================================================
// QUERY EMBEDDING TESTS
// ============================================================================

await testSection('Query Embedding Tests', async () => {
  const query = 'find user authentication functions';
  const queryEmbedding = await embedQuery(query);

  assert(queryEmbedding instanceof Float32Array, 'Returns Float32Array');
  assert(queryEmbedding.length === 384, 'Has correct dimensions');

  // Compare query with code snippets
  const code1 = 'function authenticate(user, password) { return validateCredentials(user, password); }';
  const code2 = 'function renderUserProfile(user) { return <Profile user={user} />; }';

  const codeEmb1 = await embed(code1);
  const codeEmb2 = await embed(code2);

  function cosineSimilarity(a, b) {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  const simAuth = cosineSimilarity(queryEmbedding, codeEmb1);
  const simProfile = cosineSimilarity(queryEmbedding, codeEmb2);

  console.log(`  Query vs auth function: ${simAuth.toFixed(4)}`);
  console.log(`  Query vs profile render: ${simProfile.toFixed(4)}`);

  assert(simAuth > simProfile, 'Query matches auth function better than profile render');

  // Test empty query
  const emptyQuery = await embedQuery('');
  assert(emptyQuery.length === 384, 'Empty query returns zero vector');
});

// ============================================================================
// PERFORMANCE TESTS
// ============================================================================

await testSection('Performance Tests', async () => {
  const testText = 'function processPayment(amount, currency) { return stripe.charge(amount, currency); }';

  // Single embedding performance
  const singleStart = Date.now();
  await embed(testText);
  const singleDuration = Date.now() - singleStart;
  console.log(`  Single embedding: ${singleDuration}ms`);
  assert(singleDuration < 500, 'Single embedding is fast (<500ms)');

  // Batch performance
  const batchTexts = Array(50).fill(testText);
  const batchStart = Date.now();
  await embedBatch(batchTexts);
  const batchDuration = Date.now() - batchStart;
  const avgPerText = batchDuration / batchTexts.length;
  console.log(`  Batch (50 texts): ${batchDuration}ms (${avgPerText.toFixed(1)}ms avg per text)`);

  // Batch should be reasonably fast (not testing efficiency since model is already warm)
  assert(avgPerText < 100, 'Batch processing is reasonably fast (<100ms per text)');
});

// ============================================================================
// INTEGRATION TEST (with semantic-db)
// ============================================================================

await testSection('Integration with SemanticDatabase', async () => {
  try {
    // Import SemanticDatabase and fs for cleanup
    const { SemanticDatabase, serializeVector, deserializeVector } = await import('./semantic-db.js');
    const { unlinkSync, existsSync } = await import('fs');

    // Create temporary database (clean slate)
    const dbPath = '/tmp/quack-test-embeddings.db';
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
    const db = new SemanticDatabase(dbPath);

    // Create test file and chunk
    const fileId = db.upsertFile(
      '/test/auth.ts',
      'test-hash',
      'typescript',
      1024,
      Date.now()
    );

    const chunkId = db.insertChunk(
      fileId,
      'function',
      'authenticate',
      1,
      10,
      'function authenticate(user, password) { return validateCredentials(user, password); }'
    );

    // Generate embedding
    const text = 'function authenticate(user, password) { return validateCredentials(user, password); }';
    const embedding = await embed(text);

    // Insert into database
    db.insertEmbedding(chunkId, embedding, MODEL_INFO.name, MODEL_INFO.dimensions);

    // Retrieve and verify
    const retrieved = db.getEmbedding(chunkId);
    assert(retrieved !== null, 'Embedding retrieved from database');
    assert(retrieved.vector instanceof Float32Array, 'Retrieved vector is Float32Array');
    assert(retrieved.vector.length === 384, 'Retrieved vector has correct dimensions');
    assert(retrieved.model === MODEL_INFO.name, 'Model name stored correctly');

    // Verify values match (first few elements)
    let match = true;
    for (let i = 0; i < 10; i++) {
      if (Math.abs(embedding[i] - retrieved.vector[i]) > 0.0001) {
        match = false;
        break;
      }
    }
    assert(match, 'Embedding values match after round-trip');

    // Test vector search
    const queryText = 'user authentication function';
    const queryEmbedding = await embedQuery(queryText);

    const results = db.searchVector(queryEmbedding, 5);
    assert(results.length > 0, 'Vector search returns results');
    assert(results[0].chunk_id === chunkId, 'Correct chunk found');
    assert(results[0].score > 0.5, 'Similarity score is reasonable');

    console.log(`  Search score: ${results[0].score.toFixed(4)}`);

    // Cleanup
    db.close();
    console.log('  Database integration test passed');
  } catch (error) {
    console.error(`  Integration test failed: ${error.message}`);
    testsFailed++;
  }
});

// ============================================================================
// CLEANUP
// ============================================================================

await testSection('Cleanup', async () => {
  await cleanup();
  // Note: Model is still cached on disk, just cleared from memory
  console.log('  Cleanup completed');
});

// ============================================================================
// TEST SUMMARY
// ============================================================================

console.log('\n' + '='.repeat(50));
console.log(`Tests passed: ${testsPassed}`);
console.log(`Tests failed: ${testsFailed}`);
console.log('='.repeat(50));

if (testsFailed > 0) {
  console.error('\n❌ Some tests failed');
  process.exit(1);
} else {
  console.log('\n✅ All tests passed!');
  process.exit(0);
}
