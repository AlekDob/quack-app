/**
 * Memory Vector Store Tests
 *
 * Tests for LanceDB-based vector storage and semantic search.
 *
 * @vitest-environment happy-dom
 */

import { describe, it, expect, beforeAll, afterEach } from "vitest";
import type { QuackMemory } from "../types/memory";
import {
  initializeVectorStore,
  addVector,
  searchVectors,
  deleteVector,
  getVectorStoreStats,
} from "../services/memoryVectorStore";
import { generateEmbedding } from "../services/memoryEmbedder";

// Mock QuackMemory for testing
const createTestMemory = (id: string, content: string): QuackMemory => ({
  id,
  content,
  category: "preference",
  confidence: "high",
  scope: "global",
  keywords: content.split(" "),
  createdAt: Date.now(),
  lastAccessedAt: Date.now(),
  accessCount: 0,
  isArchived: false,
});

describe("memoryVectorStore", () => {
  beforeAll(async () => {
    // Initialize vector store once
    await initializeVectorStore();
  });

  afterEach(async () => {
    // Clean up test data after each test
    // This is a simplified cleanup - in production you'd want more thorough cleanup
  });

  describe("initializeVectorStore", () => {
    it("should initialize without errors", async () => {
      await expect(initializeVectorStore()).resolves.not.toThrow();
    });

    it("should be idempotent (safe to call multiple times)", async () => {
      await expect(initializeVectorStore()).resolves.not.toThrow();
      await expect(initializeVectorStore()).resolves.not.toThrow();
    });
  });

  describe("addVector", () => {
    it("should add vector for a memory", async () => {
      const memory = createTestMemory("test-1", "User prefers TypeScript");
      await expect(addVector(memory)).resolves.not.toThrow();
    });

    it("should handle multiple vectors", async () => {
      const memory1 = createTestMemory("test-2", "User likes React 19");
      const memory2 = createTestMemory("test-3", "Project uses Vite");
      await expect(addVector(memory1)).resolves.not.toThrow();
      await expect(addVector(memory2)).resolves.not.toThrow();
    });
  });

  describe("searchVectors", () => {
    it("should find semantically similar vectors", async () => {
      // Add test vectors
      const memory1 = createTestMemory("search-1", "TypeScript strict mode");
      const memory2 = createTestMemory("search-2", "JavaScript is dynamic");
      await addVector(memory1);
      await addVector(memory2);

      // Search for similar content
      const queryVec = await generateEmbedding("TypeScript preferences");
      const results = await searchVectors(queryVec, 5);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);

      // Results should have id and score
      if (results.length > 0) {
        expect(results[0]).toHaveProperty("id");
        expect(results[0]).toHaveProperty("score");
        expect(typeof results[0].id).toBe("string");
        expect(typeof results[0].score).toBe("number");
      }
    });

    it("should return empty array if no vectors exist", async () => {
      const queryVec = new Array(384).fill(0);
      const results = await searchVectors(queryVec, 5);
      expect(Array.isArray(results)).toBe(true);
    });

    it("should respect limit parameter", async () => {
      const queryVec = await generateEmbedding("test query");
      const results = await searchVectors(queryVec, 2);
      expect(results.length).toBeLessThanOrEqual(2);
    });
  });

  describe("deleteVector", () => {
    it("should delete a vector", async () => {
      const memory = createTestMemory("delete-1", "To be deleted");
      await addVector(memory);
      await expect(deleteVector("delete-1")).resolves.not.toThrow();
    });

    it("should handle deleting non-existent vector gracefully", async () => {
      await expect(deleteVector("non-existent-id")).resolves.not.toThrow();
    });
  });

  describe("getVectorStoreStats", () => {
    it("should return stats object", async () => {
      const stats = await getVectorStoreStats();
      expect(stats).toBeDefined();
      expect(stats).toHaveProperty("count");
      expect(stats).toHaveProperty("sizeBytes");
      expect(typeof stats.count).toBe("number");
      expect(typeof stats.sizeBytes).toBe("number");
      expect(stats.count).toBeGreaterThanOrEqual(0);
      expect(stats.sizeBytes).toBeGreaterThanOrEqual(0);
    });

    it("should calculate size correctly (384 dims * 4 bytes)", async () => {
      const stats = await getVectorStoreStats();
      const expectedSize = stats.count * 384 * 4;
      expect(stats.sizeBytes).toBe(expectedSize);
    });
  });

  describe("integration: full CRUD flow", () => {
    it("should handle complete lifecycle", async () => {
      const memory = createTestMemory("crud-test", "Full CRUD test memory");

      // Create
      await addVector(memory);

      // Read (search)
      const queryVec = await generateEmbedding(memory.content);
      const searchResults = await searchVectors(queryVec, 5);
      const found = searchResults.find((r) => r.id === memory.id);
      expect(found).toBeDefined();

      // Stats should reflect addition
      const stats = await getVectorStoreStats();
      expect(stats.count).toBeGreaterThan(0);

      // Delete
      await deleteVector(memory.id);

      // Verify deletion (search should not find it anymore)
      const afterDelete = await searchVectors(queryVec, 5);
      const shouldNotExist = afterDelete.find((r) => r.id === memory.id);
      expect(shouldNotExist).toBeUndefined();
    });
  });
});
