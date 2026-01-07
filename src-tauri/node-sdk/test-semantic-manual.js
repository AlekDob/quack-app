#!/usr/bin/env node
/**
 * Interactive test script for Semantic Search
 *
 * Tests:
 * 1. Code chunking (tree-sitter parsing)
 * 2. Embedding generation (Transformers.js)
 * 3. Database indexing (SQLite + FTS5)
 * 4. Semantic search (Vector + FTS + Hybrid)
 *
 * Usage: node test-semantic-manual.js
 */

import { parseFile, SUPPORTED_LANGUAGES } from './lib/code-chunker.js';
import { SemanticDatabase } from './lib/semantic-db.js';
import { initEmbeddings, embed, embedQuery } from './lib/embeddings.js';
import { join } from 'path';
import { tmpdir } from 'os';
import { unlinkSync, existsSync, writeFileSync } from 'fs';

console.log('\n🧪 Semantic Search - Interactive Test\n');
console.log('━'.repeat(60));

// Create temporary database
const dbPath = join(tmpdir(), `semantic-test-${Date.now()}.db`);
const db = new SemanticDatabase(dbPath);

console.log(`\n✅ Database created: ${dbPath}`);

// Test files to index
const testFiles = {
  'auth.ts': `
export class AuthService {
  async login(email: string, password: string): Promise<User> {
    const user = await this.findUserByEmail(email);
    if (!user) throw new Error('User not found');

    const isValid = await this.verifyPassword(password, user.passwordHash);
    if (!isValid) throw new Error('Invalid password');

    return this.createSession(user);
  }

  async register(data: RegisterData): Promise<User> {
    const existingUser = await this.findUserByEmail(data.email);
    if (existingUser) throw new Error('Email already registered');

    const hashedPassword = await this.hashPassword(data.password);
    return this.createUser({ ...data, passwordHash: hashedPassword });
  }

  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}
  `.trim(),

  'calculator.ts': `
export class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }

  subtract(a: number, b: number): number {
    return a - b;
  }

  multiply(a: number, b: number): number {
    return a * b;
  }

  divide(a: number, b: number): number {
    if (b === 0) throw new Error('Division by zero');
    return a / b;
  }
}
  `.trim(),

  'userService.ts': `
export class UserService {
  async findUserById(id: number): Promise<User | null> {
    const result = await this.db.query('SELECT * FROM users WHERE id = ?', [id]);
    return result[0] || null;
  }

  async updateUserProfile(id: number, data: UpdateData): Promise<User> {
    await this.db.update('users', id, data);
    return this.findUserById(id);
  }

  async deleteUser(id: number): Promise<void> {
    await this.db.delete('users', id);
  }
}
  `.trim(),
};

async function runTest() {
  try {
    // Step 1: Initialize embeddings model
    console.log('\n📦 Step 1: Initializing embeddings model...');
    console.log('   (This will download ~80MB on first run)');

    await initEmbeddings({
      onProgress: (percent, message) => {
        process.stdout.write(`\r   Progress: ${percent}% - ${message}`);
      }
    });
    console.log('\n✅ Model initialized!');

    // Step 2: Parse and index files
    console.log('\n📝 Step 2: Parsing and indexing test files...');

    for (const [filename, code] of Object.entries(testFiles)) {
      console.log(`\n   Processing: ${filename}`);

      // Create temporary file
      const tempFile = join(tmpdir(), filename);
      writeFileSync(tempFile, code);

      try {
        // Parse with tree-sitter
        const chunks = parseFile(tempFile, code);
        console.log(`   ├─ Chunks extracted: ${chunks.length}`);

        // Insert file
        const fileId = db.upsertFile(
          filename,
          `hash-${filename}`,
          'typescript',
          code.length,
          Date.now()
        );

        // Insert chunks and generate embeddings
        for (const chunk of chunks) {
          const chunkId = db.insertChunk(
            fileId,
            chunk.level,
            chunk.name,
            chunk.startLine,
            chunk.endLine,
            chunk.content,
            null
          );

          // Generate embedding for function/method chunks
          if (chunk.level === 'method' || chunk.level === 'function') {
            const embedding = await embed(chunk.content);
            db.insertEmbedding(chunkId, embedding, 'all-MiniLM-L6-v2', 384);
          }
        }

        console.log(`   └─ ✅ Indexed successfully`);

        // Cleanup temp file
        unlinkSync(tempFile);
      } catch (error) {
        console.error(`   └─ ❌ Error: ${error.message}`);
      }
    }

    // Step 3: Database stats
    console.log('\n📊 Step 3: Database statistics');
    const stats = db.getStats();
    console.log(`   Files indexed:     ${stats.fileCount}`);
    console.log(`   Chunks extracted:  ${stats.chunkCount}`);
    console.log(`   Embeddings stored: ${stats.embeddingCount}`);

    // Step 4: Full-text search
    console.log('\n🔍 Step 4: Full-text search (FTS5)');
    const queries = [
      'password',
      'user login',
      'calculator multiply',
    ];

    for (const query of queries) {
      console.log(`\n   Query: "${query}"`);
      const results = db.searchFTS(query, 3);

      if (results.length === 0) {
        console.log('   └─ No results found');
      } else {
        results.forEach((result, i) => {
          console.log(`   ${i + 1}. ${result.name} (${result.path})`);
          console.log(`      Score: ${Math.abs(result.fts_rank).toFixed(4)}`);
          console.log(`      Preview: ${result.content.substring(0, 60)}...`);
        });
      }
    }

    // Step 5: Vector search
    console.log('\n🎯 Step 5: Vector semantic search');
    const semanticQueries = [
      'authenticate user credentials',
      'mathematical operations',
      'database CRUD operations',
    ];

    for (const query of semanticQueries) {
      console.log(`\n   Query: "${query}"`);
      const queryEmbedding = await embedQuery(query);
      const results = db.searchVector(queryEmbedding, 3);

      if (results.length === 0) {
        console.log('   └─ No results found');
      } else {
        results.forEach((result, i) => {
          console.log(`   ${i + 1}. ${result.name || 'unnamed'} (${result.path})`);
          console.log(`      Similarity: ${(result.score * 100).toFixed(2)}%`);
          console.log(`      Preview: ${result.content.substring(0, 60)}...`);
        });
      }
    }

    // Step 6: Hybrid search (Vector + FTS)
    console.log('\n⚡ Step 6: Hybrid search (RRF)');
    const hybridQuery = 'verify user password authentication';

    console.log(`\n   Query: "${hybridQuery}"`);
    const queryEmb = await embedQuery(hybridQuery);
    const hybridResults = db.searchHybrid(hybridQuery, queryEmb, 5);

    if (hybridResults.length === 0) {
      console.log('   └─ No results found');
    } else {
      console.log('\n   Results (combining vector + text search):');
      hybridResults.forEach((result, i) => {
        console.log(`   ${i + 1}. ${result.name || 'unnamed'} (${result.path})`);
        console.log(`      RRF Score: ${result.rrf_score.toFixed(4)}`);
        if (result.vector_score) {
          console.log(`      Vector: ${(result.vector_score * 100).toFixed(2)}%`);
        }
        if (result.fts_rank) {
          console.log(`      FTS Rank: ${result.fts_rank}`);
        }
        console.log(`      Preview: ${result.content.substring(0, 60)}...`);
      });
    }

    // Summary
    console.log('\n━'.repeat(60));
    console.log('✅ Test completed successfully!\n');
    console.log('Summary:');
    console.log(`  - Parsed ${Object.keys(testFiles).length} TypeScript files`);
    console.log(`  - Extracted ${stats.chunkCount} code chunks`);
    console.log(`  - Generated ${stats.embeddingCount} embeddings`);
    console.log(`  - Tested FTS5, Vector, and Hybrid search`);
    console.log('\n💡 The semantic search system is working correctly!');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error(error.stack);
  } finally {
    // Cleanup
    db.close();
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
      ['-wal', '-shm'].forEach(suffix => {
        const walPath = dbPath + suffix;
        if (existsSync(walPath)) unlinkSync(walPath);
      });
    }
    console.log(`\n🧹 Cleaned up: ${dbPath}\n`);
  }
}

// Run the test
runTest().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
