/**
 * Vitest tests for SemanticDatabase
 *
 * Tests cover:
 * - Database initialization and schema
 * - File operations (CRUD)
 * - Chunk operations (CRUD, hierarchical)
 * - Embedding operations (storage, retrieval)
 * - Search operations (FTS5, vector, hybrid)
 * - Batch operations and transactions
 * - Stats and maintenance
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  SemanticDatabase,
  cosineSimilarity,
  euclideanDistance,
  normalizeVector,
  serializeVector,
  deserializeVector,
} from './semantic-db.js';

describe('SemanticDatabase', () => {
  let db;
  let dbPath;

  beforeEach(() => {
    // Create temporary database
    dbPath = join(tmpdir(), `test-semantic-${Date.now()}.db`);
    db = new SemanticDatabase(dbPath);
  });

  afterEach(() => {
    // Clean up
    db?.close();
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
    // Clean up WAL files
    ['-wal', '-shm'].forEach(suffix => {
      const walPath = dbPath + suffix;
      if (existsSync(walPath)) {
        unlinkSync(walPath);
      }
    });
  });

  describe('Database Initialization', () => {
    it('should create database with correct schema', () => {
      const stats = db.getStats();
      expect(stats.fileCount).toBe(0);
      expect(stats.chunkCount).toBe(0);
      expect(stats.embeddingCount).toBe(0);
    });

    it('should enable WAL mode', () => {
      const result = db.db.pragma('journal_mode', { simple: true });
      expect(result).toBe('wal');
    });

    it('should enable foreign keys', () => {
      const result = db.db.pragma('foreign_keys', { simple: true });
      expect(result).toBe(1);
    });
  });

  describe('File Operations', () => {
    it('should insert a new file', () => {
      const fileId = db.upsertFile('test.ts', 'hash123', 'typescript', 1024, Date.now());
      expect(fileId).toBeGreaterThan(0);
    });

    it('should update existing file on upsert', () => {
      const fileId1 = db.upsertFile('test.ts', 'hash123', 'typescript', 1024);
      const fileId2 = db.upsertFile('test.ts', 'hash456', 'typescript', 2048);

      expect(fileId1).toBe(fileId2);

      const file = db.getFile('test.ts');
      expect(file.content_hash).toBe('hash456');
      expect(file.size).toBe(2048);
    });

    it('should get file by path', () => {
      db.upsertFile('test.ts', 'hash123', 'typescript', 1024);
      const file = db.getFile('test.ts');

      expect(file).toBeTruthy();
      expect(file.path).toBe('test.ts');
      expect(file.content_hash).toBe('hash123');
      expect(file.language).toBe('typescript');
    });

    it('should get file by ID', () => {
      const fileId = db.upsertFile('test.ts', 'hash123', 'typescript', 1024);
      const file = db.getFileById(fileId);

      expect(file).toBeTruthy();
      expect(file.id).toBe(fileId);
      expect(file.path).toBe('test.ts');
    });

    it('should return null for non-existent file', () => {
      const file = db.getFile('nonexistent.ts');
      expect(file).toBeNull();
    });

    it('should delete file and cascade to chunks', () => {
      const fileId = db.upsertFile('test.ts', 'hash123', 'typescript', 1024);
      db.insertChunk(fileId, 'file', 'test.ts', 1, 10, 'content');

      const deleted = db.deleteFile('test.ts');
      expect(deleted).toBe(true);

      const chunks = db.getChunksForFile(fileId);
      expect(chunks).toHaveLength(0);
    });

    it('should get all files', () => {
      db.upsertFile('test1.ts', 'hash1', 'typescript', 1024);
      db.upsertFile('test2.ts', 'hash2', 'typescript', 2048);

      const files = db.getAllFiles();
      expect(files).toHaveLength(2);
    });

    it('should detect when file needs reindexing', () => {
      db.upsertFile('test.ts', 'hash123', 'typescript', 1024);

      expect(db.needsReindexing('test.ts', 'hash123')).toBe(false);
      expect(db.needsReindexing('test.ts', 'hash456')).toBe(true);
      expect(db.needsReindexing('new.ts', 'hash789')).toBe(true);
    });
  });

  describe('Chunk Operations', () => {
    let fileId;

    beforeEach(() => {
      fileId = db.upsertFile('test.ts', 'hash123', 'typescript', 1024);
    });

    it('should insert a chunk', () => {
      const chunkId = db.insertChunk(
        fileId,
        'function',
        'myFunction',
        10,
        20,
        'function myFunction() {}'
      );

      expect(chunkId).toBeGreaterThan(0);
    });

    it('should get chunk by ID', () => {
      const chunkId = db.insertChunk(
        fileId,
        'function',
        'myFunction',
        10,
        20,
        'function myFunction() {}'
      );

      const chunk = db.getChunkById(chunkId);
      expect(chunk).toBeTruthy();
      expect(chunk.id).toBe(chunkId);
      expect(chunk.name).toBe('myFunction');
      expect(chunk.level).toBe('function');
    });

    it('should support all chunk levels', () => {
      const levels = ['file', 'class', 'function', 'method'];

      levels.forEach(level => {
        const chunkId = db.insertChunk(
          fileId,
          level,
          `test_${level}`,
          1,
          10,
          'content'
        );
        expect(chunkId).toBeGreaterThan(0);
      });
    });

    it('should support parent-child relationships', () => {
      const classId = db.insertChunk(fileId, 'class', 'MyClass', 1, 20, 'class MyClass {}');
      const methodId = db.insertChunk(
        fileId,
        'method',
        'myMethod',
        5,
        10,
        'myMethod() {}',
        classId
      );

      const method = db.getChunkById(methodId);
      expect(method.parent_id).toBe(classId);
    });

    it('should get chunks for file', () => {
      db.insertChunk(fileId, 'file', 'test.ts', 1, 50, 'content');
      db.insertChunk(fileId, 'function', 'func1', 10, 20, 'func1()');
      db.insertChunk(fileId, 'function', 'func2', 30, 40, 'func2()');

      const chunks = db.getChunksForFile(fileId);
      expect(chunks).toHaveLength(3);
      expect(chunks[0].start_line).toBeLessThanOrEqual(chunks[1].start_line);
    });

    it('should delete chunks for file', () => {
      db.insertChunk(fileId, 'function', 'func1', 10, 20, 'func1()');
      db.insertChunk(fileId, 'function', 'func2', 30, 40, 'func2()');

      const deleted = db.deleteChunksForFile(fileId);
      expect(deleted).toBe(2);

      const chunks = db.getChunksForFile(fileId);
      expect(chunks).toHaveLength(0);
    });

    it('should automatically sync FTS on insert', () => {
      const chunkId = db.insertChunk(
        fileId,
        'function',
        'searchableFunction',
        10,
        20,
        'function searchableFunction() { return "hello"; }'
      );

      const results = db.searchFTS('searchableFunction');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(chunkId);
    });
  });

  describe('Embedding Operations', () => {
    let fileId;
    let chunkId;

    beforeEach(() => {
      fileId = db.upsertFile('test.ts', 'hash123', 'typescript', 1024);
      chunkId = db.insertChunk(fileId, 'function', 'myFunc', 10, 20, 'content');
    });

    it('should insert embedding', () => {
      const vector = new Float32Array([0.1, 0.2, 0.3]);
      db.insertEmbedding(chunkId, vector, 'test-model', 3);

      const embedding = db.getEmbedding(chunkId);
      expect(embedding).toBeTruthy();
      expect(embedding.chunk_id).toBe(chunkId);
      expect(embedding.model).toBe('test-model');
      expect(embedding.dimensions).toBe(3);
      expect(embedding.vector).toBeInstanceOf(Float32Array);
      expect(embedding.vector.length).toBe(3);
    });

    it('should update embedding on upsert', () => {
      const vector1 = new Float32Array([0.1, 0.2, 0.3]);
      const vector2 = new Float32Array([0.4, 0.5, 0.6]);

      db.insertEmbedding(chunkId, vector1, 'model-v1', 3);
      db.insertEmbedding(chunkId, vector2, 'model-v2', 3);

      const embedding = db.getEmbedding(chunkId);
      expect(embedding.model).toBe('model-v2');

      // Check vector values with floating point tolerance
      expect(embedding.vector[0]).toBeCloseTo(0.4, 5);
      expect(embedding.vector[1]).toBeCloseTo(0.5, 5);
      expect(embedding.vector[2]).toBeCloseTo(0.6, 5);
    });

    it('should get all embeddings with metadata', () => {
      const chunkId2 = db.insertChunk(fileId, 'function', 'func2', 30, 40, 'content2');

      db.insertEmbedding(chunkId, new Float32Array([0.1, 0.2]), 'model', 2);
      db.insertEmbedding(chunkId2, new Float32Array([0.3, 0.4]), 'model', 2);

      const embeddings = db.getAllEmbeddings();
      expect(embeddings).toHaveLength(2);
      expect(embeddings[0]).toHaveProperty('chunk_id');
      expect(embeddings[0]).toHaveProperty('vector');
      expect(embeddings[0]).toHaveProperty('name');
      expect(embeddings[0]).toHaveProperty('path');
    });

    it('should batch insert embeddings', () => {
      const chunkId2 = db.insertChunk(fileId, 'function', 'func2', 30, 40, 'content2');

      db.batchInsertEmbeddings([
        { chunk_id: chunkId, vector: new Float32Array([0.1, 0.2]), model: 'test', dimensions: 2 },
        { chunk_id: chunkId2, vector: new Float32Array([0.3, 0.4]), model: 'test', dimensions: 2 },
      ]);

      const embeddings = db.getAllEmbeddings();
      expect(embeddings).toHaveLength(2);
    });
  });

  describe('Search Operations - FTS5', () => {
    let fileId;

    beforeEach(() => {
      fileId = db.upsertFile('test.ts', 'hash123', 'typescript', 1024);

      // Insert test chunks
      db.insertChunk(fileId, 'function', 'authenticate', 1, 10,
        'function authenticate(user, password) { return jwt.sign(user); }');
      db.insertChunk(fileId, 'function', 'login', 20, 30,
        'function login(credentials) { return authenticate(credentials); }');
      db.insertChunk(fileId, 'function', 'calculateTotal', 40, 50,
        'function calculateTotal(items) { return items.reduce((sum, item) => sum + item.price, 0); }');
    });

    it('should search by function name', () => {
      const results = db.searchFTS('authenticate');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toBe('authenticate');
    });

    it('should search by content', () => {
      const results = db.searchFTS('jwt');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].content).toContain('jwt');
    });

    it('should rank results by relevance', () => {
      const results = db.searchFTS('authenticate');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].fts_rank).toBeLessThan(0); // FTS5 rank is negative
    });

    it('should limit results', () => {
      const results = db.searchFTS('function', 2);
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should return empty array for no matches', () => {
      const results = db.searchFTS('nonexistent');
      expect(results).toHaveLength(0);
    });

    it('should support FTS5 query syntax', () => {
      const results = db.searchFTS('authenticate OR login');
      expect(results.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Search Operations - Vector', () => {
    let fileId;
    let chunkIds;

    beforeEach(() => {
      fileId = db.upsertFile('test.ts', 'hash123', 'typescript', 1024);

      chunkIds = [
        db.insertChunk(fileId, 'function', 'func1', 1, 10, 'authentication function'),
        db.insertChunk(fileId, 'function', 'func2', 20, 30, 'login handler'),
        db.insertChunk(fileId, 'function', 'func3', 40, 50, 'calculate total price'),
      ];

      // Insert embeddings (simplified vectors)
      db.insertEmbedding(chunkIds[0], new Float32Array([1.0, 0.0, 0.0]), 'test', 3);
      db.insertEmbedding(chunkIds[1], new Float32Array([0.9, 0.1, 0.0]), 'test', 3);
      db.insertEmbedding(chunkIds[2], new Float32Array([0.0, 0.0, 1.0]), 'test', 3);
    });

    it('should find similar vectors', () => {
      const queryVector = new Float32Array([1.0, 0.0, 0.0]);
      const results = db.searchVector(queryVector, 3);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].chunk_id).toBe(chunkIds[0]);
      expect(results[0].score).toBeCloseTo(1.0, 2);
    });

    it('should rank by cosine similarity', () => {
      const queryVector = new Float32Array([1.0, 0.0, 0.0]);
      const results = db.searchVector(queryVector, 3);

      expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
      expect(results[1].score).toBeGreaterThanOrEqual(results[2].score);
    });

    it('should filter by chunk level', () => {
      // Add a class-level chunk
      const classId = db.insertChunk(fileId, 'class', 'MyClass', 60, 70, 'class definition');
      db.insertEmbedding(classId, new Float32Array([1.0, 0.0, 0.0]), 'test', 3);

      const results = db.searchVector(new Float32Array([1.0, 0.0, 0.0]), 10, 'class');
      expect(results).toHaveLength(1);
      expect(results[0].level).toBe('class');
    });

    it('should limit results', () => {
      const results = db.searchVector(new Float32Array([1.0, 0.0, 0.0]), 2);
      expect(results).toHaveLength(2);
    });
  });

  describe('Search Operations - Hybrid', () => {
    let fileId;

    beforeEach(() => {
      fileId = db.upsertFile('test.ts', 'hash123', 'typescript', 1024);

      const chunk1 = db.insertChunk(fileId, 'function', 'authenticate', 1, 10,
        'function authenticate(user, password) { return jwt.sign(user); }');
      const chunk2 = db.insertChunk(fileId, 'function', 'login', 20, 30,
        'function login(credentials) { return authenticate(credentials); }');

      // Embeddings that are semantically similar
      db.insertEmbedding(chunk1, new Float32Array([1.0, 0.0]), 'test', 2);
      db.insertEmbedding(chunk2, new Float32Array([0.9, 0.1]), 'test', 2);
    });

    it('should combine vector and FTS results', () => {
      const queryVector = new Float32Array([1.0, 0.0]);
      const results = db.searchHybrid('authenticate', queryVector, 10);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('rrf_score');
    });

    it('should boost items that match both vector and FTS', () => {
      const queryVector = new Float32Array([1.0, 0.0]);
      const results = db.searchHybrid('authenticate', queryVector, 10);

      // Item that appears in both should have higher RRF score
      const authenticateResult = results.find(r => r.name === 'authenticate');
      expect(authenticateResult).toBeTruthy();
      expect(authenticateResult.rrf_score).toBeGreaterThan(0);
    });

    it('should support custom RRF k parameter', () => {
      const queryVector = new Float32Array([1.0, 0.0]);
      const results1 = db.searchHybrid('authenticate', queryVector, 10, 60);
      const results2 = db.searchHybrid('authenticate', queryVector, 10, 120);

      expect(results1.length).toBeGreaterThan(0);
      expect(results2.length).toBeGreaterThan(0);
    });
  });

  describe('Batch Operations', () => {
    let fileId;

    beforeEach(() => {
      fileId = db.upsertFile('test.ts', 'hash123', 'typescript', 1024);
    });

    it('should reindex file atomically', () => {
      // Insert initial chunks
      db.insertChunk(fileId, 'function', 'old1', 1, 10, 'old content 1');
      db.insertChunk(fileId, 'function', 'old2', 20, 30, 'old content 2');

      // Reindex with new chunks
      const newChunks = [
        { level: 'function', name: 'new1', start_line: 1, end_line: 10, content: 'new content 1', parent_id: null },
        { level: 'function', name: 'new2', start_line: 20, end_line: 30, content: 'new content 2', parent_id: null },
        { level: 'function', name: 'new3', start_line: 40, end_line: 50, content: 'new content 3', parent_id: null },
      ];

      const chunkIds = db.reindexFile(fileId, newChunks);
      expect(chunkIds).toHaveLength(3);

      const chunks = db.getChunksForFile(fileId);
      expect(chunks).toHaveLength(3);
      expect(chunks.every(c => c.name.startsWith('new'))).toBe(true);
    });
  });

  describe('Stats and Maintenance', () => {
    it('should track statistics', () => {
      const fileId = db.upsertFile('test.ts', 'hash123', 'typescript', 1024);
      const chunkId = db.insertChunk(fileId, 'function', 'test', 1, 10, 'content');
      db.insertEmbedding(chunkId, new Float32Array([0.1, 0.2]), 'test', 2);

      const stats = db.getStats();
      expect(stats.fileCount).toBe(1);
      expect(stats.chunkCount).toBe(1);
      expect(stats.embeddingCount).toBe(1);
      expect(stats.lastIndexed).toBeGreaterThan(0);
    });

    it('should vacuum database', () => {
      const fileId = db.upsertFile('test.ts', 'hash123', 'typescript', 1024);
      db.insertChunk(fileId, 'function', 'test', 1, 10, 'content');
      db.deleteFile('test.ts');

      expect(() => db.vacuum()).not.toThrow();
    });

    it('should optimize FTS index', () => {
      const fileId = db.upsertFile('test.ts', 'hash123', 'typescript', 1024);
      db.insertChunk(fileId, 'function', 'test', 1, 10, 'content');

      expect(() => db.optimizeFTS()).not.toThrow();
    });
  });
});

describe('Vector Utilities', () => {
  describe('cosineSimilarity', () => {
    it('should calculate similarity between identical vectors', () => {
      const v1 = new Float32Array([1.0, 0.0, 0.0]);
      const v2 = new Float32Array([1.0, 0.0, 0.0]);

      const similarity = cosineSimilarity(v1, v2);
      expect(similarity).toBeCloseTo(1.0, 5);
    });

    it('should calculate similarity between orthogonal vectors', () => {
      const v1 = new Float32Array([1.0, 0.0, 0.0]);
      const v2 = new Float32Array([0.0, 1.0, 0.0]);

      const similarity = cosineSimilarity(v1, v2);
      expect(similarity).toBeCloseTo(0.0, 5);
    });

    it('should calculate similarity between opposite vectors', () => {
      const v1 = new Float32Array([1.0, 0.0, 0.0]);
      const v2 = new Float32Array([-1.0, 0.0, 0.0]);

      const similarity = cosineSimilarity(v1, v2);
      expect(similarity).toBeCloseTo(-1.0, 5);
    });

    it('should handle zero vectors', () => {
      const v1 = new Float32Array([0.0, 0.0, 0.0]);
      const v2 = new Float32Array([1.0, 0.0, 0.0]);

      const similarity = cosineSimilarity(v1, v2);
      expect(similarity).toBe(0);
    });

    it('should throw on dimension mismatch', () => {
      const v1 = new Float32Array([1.0, 0.0]);
      const v2 = new Float32Array([1.0, 0.0, 0.0]);

      expect(() => cosineSimilarity(v1, v2)).toThrow('dimension mismatch');
    });
  });

  describe('euclideanDistance', () => {
    it('should calculate distance between identical vectors', () => {
      const v1 = new Float32Array([1.0, 2.0, 3.0]);
      const v2 = new Float32Array([1.0, 2.0, 3.0]);

      const distance = euclideanDistance(v1, v2);
      expect(distance).toBeCloseTo(0.0, 5);
    });

    it('should calculate L2 distance correctly', () => {
      const v1 = new Float32Array([0.0, 0.0, 0.0]);
      const v2 = new Float32Array([3.0, 4.0, 0.0]);

      const distance = euclideanDistance(v1, v2);
      expect(distance).toBeCloseTo(5.0, 5); // 3-4-5 triangle
    });

    it('should throw on dimension mismatch', () => {
      const v1 = new Float32Array([1.0, 0.0]);
      const v2 = new Float32Array([1.0, 0.0, 0.0]);

      expect(() => euclideanDistance(v1, v2)).toThrow('dimension mismatch');
    });
  });

  describe('normalizeVector', () => {
    it('should normalize vector to unit length', () => {
      const v = new Float32Array([3.0, 4.0, 0.0]);
      const normalized = normalizeVector(v);

      expect(normalized[0]).toBeCloseTo(0.6, 5);
      expect(normalized[1]).toBeCloseTo(0.8, 5);
      expect(normalized[2]).toBeCloseTo(0.0, 5);

      // Verify unit length
      const length = Math.sqrt(
        normalized[0] * normalized[0] +
        normalized[1] * normalized[1] +
        normalized[2] * normalized[2]
      );
      expect(length).toBeCloseTo(1.0, 5);
    });

    it('should handle zero vector', () => {
      const v = new Float32Array([0.0, 0.0, 0.0]);
      const normalized = normalizeVector(v);

      expect(Array.from(normalized)).toEqual([0.0, 0.0, 0.0]);
    });
  });

  describe('Vector Serialization', () => {
    it('should serialize and deserialize Float32Array', () => {
      const original = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5]);

      const serialized = serializeVector(original);
      expect(serialized).toBeInstanceOf(Buffer);

      const deserialized = deserializeVector(serialized);
      expect(deserialized).toBeInstanceOf(Float32Array);
      expect(deserialized.length).toBe(original.length);

      for (let i = 0; i < original.length; i++) {
        expect(deserialized[i]).toBeCloseTo(original[i], 5);
      }
    });

    it('should preserve precision', () => {
      const original = new Float32Array([Math.PI, Math.E, Math.SQRT2]);

      const serialized = serializeVector(original);
      const deserialized = deserializeVector(serialized);

      for (let i = 0; i < original.length; i++) {
        expect(deserialized[i]).toBeCloseTo(original[i], 5);
      }
    });
  });
});
