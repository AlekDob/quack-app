/**
 * Integration Tests for Semantic Search System
 *
 * Tests the complete semantic search pipeline:
 * 1. Code chunking with tree-sitter
 * 2. Embedding generation with Transformers.js
 * 3. Storage in SQLite with FTS5
 * 4. Vector similarity search
 * 5. Hybrid search with RRF
 *
 * This simulates the real-world usage of the MCP server
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { unlinkSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import { SemanticDatabase } from './semantic-db.js';
import { parseFile } from './code-chunker.js';
import { initEmbeddings, embed } from './embeddings.js';

describe('Semantic Search Integration', () => {
  let db;
  let dbPath;
  let tempDir;

  beforeAll(async () => {
    // Create temp directory for test files
    tempDir = join(tmpdir(), `semantic-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });

    // Create database
    dbPath = join(tempDir, 'test.db');
    db = new SemanticDatabase(dbPath);

    // Initialize embedding model
    await initEmbeddings();
  }, 120000); // 2 min timeout for model download

  afterAll(() => {
    // Clean up
    db?.close();
    if (existsSync(dbPath)) unlinkSync(dbPath);
    ['-wal', '-shm'].forEach(suffix => {
      const walPath = dbPath + suffix;
      if (existsSync(walPath)) unlinkSync(walPath);
    });
  });

  describe('End-to-End Workflow', () => {
    it('should index a TypeScript file completely', async () => {
      // 1. Create a test file
      const testFile = join(tempDir, 'auth.ts');
      const code = `
export class AuthService {
  constructor(private db: Database) {}

  async authenticate(username: string, password: string): Promise<User | null> {
    const user = await this.findUser(username);
    if (!user) return null;

    const isValid = await this.verifyPassword(password, user.passwordHash);
    return isValid ? user : null;
  }

  private async findUser(username: string): Promise<User | null> {
    const result = await this.db.query('SELECT * FROM users WHERE username = ?', [username]);
    return result[0] || null;
  }

  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}
      `.trim();

      writeFileSync(testFile, code, 'utf8');

      // 2. Parse file with tree-sitter
      const chunks = parseFile(testFile);

      expect(chunks.length).toBeGreaterThan(0);

      const fileChunk = chunks.find(c => c.level === 'file');
      const classChunk = chunks.find(c => c.level === 'class' && c.name === 'AuthService');
      const methodChunks = chunks.filter(c => c.level === 'method');

      expect(fileChunk).toBeTruthy();
      expect(classChunk).toBeTruthy();
      // Tree-sitter may extract constructor + methods, so check for at least 3
      expect(methodChunks.length).toBeGreaterThanOrEqual(3);

      // 3. Insert file into database
      const fileId = db.upsertFile(
        'auth.ts',
        'hash123',
        'typescript',
        code.length,
        Date.now()
      );

      // 4. Insert chunks
      const chunkIds = [];
      for (const chunk of chunks) {
        const chunkId = db.insertChunk(
          fileId,
          chunk.level,
          chunk.name,
          chunk.startLine,
          chunk.endLine,
          chunk.content,
          null // simplified: not handling parent_id here
        );
        chunkIds.push(chunkId);
      }

      expect(chunkIds.length).toBe(chunks.length);

      // 5. Generate embeddings for function-level chunks
      const functionChunks = chunks.filter(c => c.level === 'method');
      for (let i = 0; i < functionChunks.length; i++) {
        const chunk = functionChunks[i];
        const chunkId = chunkIds[chunks.indexOf(chunk)];

        const embedding = await embed(chunk.content);
        db.insertEmbedding(chunkId, embedding, 'all-MiniLM-L6-v2', 384);
      }

      // 6. Verify data was stored correctly
      const stats = db.getStats();
      expect(stats.fileCount).toBe(1);
      expect(stats.chunkCount).toBe(chunks.length);
      expect(stats.embeddingCount).toBe(functionChunks.length);
    }, 120000);

    it('should perform full-text search', async () => {
      // Search for "authenticate"
      const results = db.searchFTS('authenticate', 10);

      expect(results.length).toBeGreaterThan(0);

      const authenticateMethod = results.find(r =>
        r.content.includes('authenticate') && r.name === 'authenticate'
      );

      expect(authenticateMethod).toBeTruthy();
      expect(authenticateMethod.path).toBe('auth.ts');
    });

    it('should perform vector search', async () => {
      // Generate query embedding
      const queryText = 'verify user password';
      const queryEmbedding = await embed(queryText);

      // Search
      const results = db.searchVector(queryEmbedding, 5);

      expect(results.length).toBeGreaterThan(0);

      // verifyPassword method should rank high
      const verifyPasswordResult = results.find(r =>
        r.content.includes('verifyPassword') || r.name === 'verifyPassword'
      );

      expect(verifyPasswordResult).toBeTruthy();
      expect(verifyPasswordResult.score).toBeGreaterThan(0);
    });

    it('should perform hybrid search', async () => {
      // Query that combines text and semantic meaning
      const query = 'authenticate user login';
      const queryEmbedding = await embed(query);

      // Hybrid search
      const results = db.searchHybrid(query, queryEmbedding, 5);

      expect(results.length).toBeGreaterThan(0);

      // authenticate method should rank high (matches both FTS and vector)
      const authenticateResult = results[0];
      expect(authenticateResult).toBeTruthy();
      expect(authenticateResult.rrf_score).toBeGreaterThan(0);
    });
  });

  describe('Multi-File Indexing', () => {
    it('should index multiple files', async () => {
      // File 1: User service
      const userFile = join(tempDir, 'user-service.ts');
      const userCode = `
export class UserService {
  async createUser(data: UserData): Promise<User> {
    return this.db.insert('users', data);
  }

  async deleteUser(id: number): Promise<void> {
    await this.db.delete('users', id);
  }
}
      `.trim();

      // File 2: Product service
      const productFile = join(tempDir, 'product-service.ts');
      const productCode = `
export class ProductService {
  async findProduct(id: number): Promise<Product | null> {
    const result = await this.db.query('SELECT * FROM products WHERE id = ?', [id]);
    return result[0] || null;
  }

  async updateStock(id: number, quantity: number): Promise<void> {
    await this.db.update('products', id, { stock: quantity });
  }
}
      `.trim();

      writeFileSync(userFile, userCode);
      writeFileSync(productFile, productCode);

      // Parse and index both files
      const files = [
        { path: 'user-service.ts', content: userCode },
        { path: 'product-service.ts', content: productCode },
      ];

      for (const file of files) {
        const chunks = parseFile(join(tempDir, file.path), file.content);

        const fileId = db.upsertFile(
          file.path,
          `hash-${file.path}`,
          'typescript',
          file.content.length,
          Date.now()
        );

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

          // Generate embeddings for method-level chunks
          if (chunk.level === 'method') {
            const embedding = await embed(chunk.content);
            db.insertEmbedding(chunkId, embedding, 'all-MiniLM-L6-v2', 384);
          }
        }
      }

      // Verify indexing - count should accumulate across tests
      const stats = db.getStats();
      expect(stats.fileCount).toBeGreaterThanOrEqual(3); // At least these 3 files
      expect(stats.chunkCount).toBeGreaterThan(10);
    });

    it('should search across multiple files', async () => {
      // Search for "delete" - should find deleteUser method
      const results = db.searchFTS('delete', 10);

      expect(results.length).toBeGreaterThan(0);

      const deleteUser = results.find(r => r.name === 'deleteUser');
      expect(deleteUser).toBeTruthy();
      expect(deleteUser.path).toBe('user-service.ts');
    });

    it('should filter search by file', async () => {
      const allResults = db.searchFTS('async', 100);

      // Filter to only user-service.ts
      const userServiceResults = allResults.filter(r => r.path === 'user-service.ts');

      expect(userServiceResults.length).toBeGreaterThan(0);
      userServiceResults.forEach(r => {
        expect(r.path).toBe('user-service.ts');
      });
    });
  });

  describe('Incremental Updates', () => {
    it('should reindex changed file', async () => {
      const testFile = join(tempDir, 'calculator.ts');

      // Initial version
      const initialCode = `
export class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }
}
      `.trim();

      writeFileSync(testFile, initialCode);

      // Initial indexing
      let chunks = parseFile(testFile, initialCode);
      let fileId = db.upsertFile('calculator.ts', 'hash1', 'typescript', initialCode.length, Date.now());
      let chunkIds = [];

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
        chunkIds.push(chunkId);
      }

      // Verify initial state
      let initialChunks = db.getChunksForFile(fileId);
      const initialCount = initialChunks.length;

      // Updated version (added multiply method)
      const updatedCode = `
export class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }

  multiply(a: number, b: number): number {
    return a * b;
  }
}
      `.trim();

      writeFileSync(testFile, updatedCode);

      // Reindex
      chunks = parseFile(testFile, updatedCode);
      fileId = db.upsertFile('calculator.ts', 'hash2', 'typescript', updatedCode.length, Date.now());

      // Delete old chunks and insert new ones
      db.deleteChunksForFile(fileId);

      for (const chunk of chunks) {
        db.insertChunk(
          fileId,
          chunk.level,
          chunk.name,
          chunk.startLine,
          chunk.endLine,
          chunk.content,
          null
        );
      }

      // Verify update
      const updatedChunks = db.getChunksForFile(fileId);
      expect(updatedChunks.length).toBeGreaterThan(initialCount);

      const multiplyMethod = updatedChunks.find(c => c.name === 'multiply');
      expect(multiplyMethod).toBeTruthy();
    });

    it('should detect when file needs reindexing', async () => {
      const testFile = 'calculator.ts';

      // File with hash2 is already indexed
      expect(db.needsReindexing(testFile, 'hash2')).toBe(false);

      // Changed content (new hash)
      expect(db.needsReindexing(testFile, 'hash3')).toBe(true);

      // New file
      expect(db.needsReindexing('new-file.ts', 'hash999')).toBe(true);
    });
  });

  describe('Search Quality', () => {
    it('should rank semantic matches higher than keyword matches', async () => {
      // Create two files with different approaches
      const file1 = join(tempDir, 'login-handler.ts');
      const code1 = `
export async function handleLogin(credentials: Credentials): Promise<Session> {
  const user = await authenticateUser(credentials);
  return createSession(user);
}
      `.trim();

      const file2 = join(tempDir, 'comment.ts');
      const code2 = `
// This function does NOT handle login
export function processData(data: any): void {
  console.log('Processing:', data);
}
      `.trim();

      writeFileSync(file1, code1);
      writeFileSync(file2, code2);

      // Index both files
      for (const [path, content] of [[file1, code1], [file2, code2]]) {
        const chunks = parseFile(path, content);
        const fileId = db.upsertFile(
          path.split('/').pop(),
          `hash-${path}`,
          'typescript',
          content.length,
          Date.now()
        );

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

          if (chunk.level === 'function') {
            const embedding = await embed(chunk.content);
            db.insertEmbedding(chunkId, embedding, 'all-MiniLM-L6-v2', 384);
          }
        }
      }

      // Search for "login authentication"
      const query = 'login authentication';
      const queryEmbedding = await embed(query);

      const results = db.searchHybrid(query, queryEmbedding, 5);

      // handleLogin should rank higher than processData (even though comment mentions login)
      const handleLoginResult = results.find(r => r.name === 'handleLogin');
      const processDataResult = results.find(r => r.name === 'processData');

      expect(handleLoginResult).toBeTruthy();

      if (processDataResult) {
        expect(handleLoginResult.rrf_score).toBeGreaterThan(processDataResult.rrf_score);
      }
    });

    it('should handle multi-word queries', async () => {
      const query = 'update product stock quantity';
      const queryEmbedding = await embed(query);

      const results = db.searchHybrid(query, queryEmbedding, 5);

      expect(results.length).toBeGreaterThan(0);

      // Should find updateStock method
      const updateStockResult = results.find(r => r.name === 'updateStock');
      expect(updateStockResult).toBeTruthy();
    });

    it('should handle natural language queries', async () => {
      const query = 'how to authenticate a user with password';
      const queryEmbedding = await embed(query);

      const results = db.searchHybrid(query, queryEmbedding, 5);

      expect(results.length).toBeGreaterThan(0);

      // Should find authentication-related methods
      const authRelated = results.filter(r =>
        r.content.toLowerCase().includes('auth') ||
        r.content.toLowerCase().includes('password')
      );

      expect(authRelated.length).toBeGreaterThan(0);
    });
  });

  describe('Performance', () => {
    it('should index files quickly', async () => {
      const testFile = join(tempDir, 'perf-test.ts');
      const code = Array.from({ length: 20 }, (_, i) =>
        `function func${i}(param: any) { return param * ${i}; }`
      ).join('\n\n');

      writeFileSync(testFile, code);

      const start = Date.now();

      const chunks = parseFile(testFile, code);
      const fileId = db.upsertFile('perf-test.ts', 'hashperf', 'typescript', code.length, Date.now());

      for (const chunk of chunks) {
        db.insertChunk(
          fileId,
          chunk.level,
          chunk.name,
          chunk.startLine,
          chunk.endLine,
          chunk.content,
          null
        );
      }

      const duration = Date.now() - start;

      // Should be fast (< 500ms for 20 functions)
      expect(duration).toBeLessThan(500);
    });

    it('should search quickly', async () => {
      const start = Date.now();
      const results = db.searchFTS('function', 10);
      const duration = Date.now() - start;

      expect(results.length).toBeGreaterThan(0);
      // FTS should be very fast (< 100ms)
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed code gracefully', async () => {
      const testFile = join(tempDir, 'malformed.ts');
      const malformedCode = `
function incomplete( {
  // Missing closing brace
      `.trim();

      writeFileSync(testFile, malformedCode);

      // Parser should still extract what it can
      const chunks = parseFile(testFile, malformedCode);

      // Should at least have file-level chunk
      const fileChunk = chunks.find(c => c.level === 'file');
      expect(fileChunk).toBeTruthy();
    });

    it('should handle empty embeddings gracefully', async () => {
      const emptyEmbedding = new Float32Array(384).fill(0);

      const fileId = db.upsertFile('empty-test.ts', 'hash', 'typescript', 0, Date.now());
      const chunkId = db.insertChunk(fileId, 'function', 'emptyFunc', 1, 1, '', null);

      expect(() => {
        db.insertEmbedding(chunkId, emptyEmbedding, 'test', 384);
      }).not.toThrow();
    });
  });
});
