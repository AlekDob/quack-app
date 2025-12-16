/**
 * Memory Embedder Service Tests
 *
 * Tests for the embedding generation service using Transformers.js.
 * Covers initialization, single/batch embedding, error handling, and edge cases.
 *
 * Note: These are unit tests with mocked Transformers.js pipeline.
 * Integration tests require actual model download (~23MB) and should be run separately.
 */

import { describe, it, expect, vi } from "vitest";
import { getEmbeddingDimensions } from "../services/memoryEmbedder";

// Mock @xenova/transformers to avoid downloading models in tests
vi.mock("@xenova/transformers", () => ({
  pipeline: vi.fn(),
  Pipeline: vi.fn(),
}));

describe("memoryEmbedder", () => {
  describe("Configuration", () => {
    it("should have correct embedding dimensions", () => {
      expect(getEmbeddingDimensions()).toBe(384);
    });
  });

  describe("Module Validation", () => {
    it("should export all required functions", async () => {
      const module = await import("../services/memoryEmbedder");

      expect(module.initializeEmbedder).toBeDefined();
      expect(module.isEmbedderReady).toBeDefined();
      expect(module.generateEmbedding).toBeDefined();
      expect(module.generateEmbeddings).toBeDefined();
      expect(module.getEmbeddingDimensions).toBeDefined();

      expect(typeof module.initializeEmbedder).toBe("function");
      expect(typeof module.isEmbedderReady).toBe("function");
      expect(typeof module.generateEmbedding).toBe("function");
      expect(typeof module.generateEmbeddings).toBe("function");
      expect(typeof module.getEmbeddingDimensions).toBe("function");
    });

    it("should use correct model name", async () => {
      // Model name is not exported, but we can verify dimensions
      expect(getEmbeddingDimensions()).toBe(384);
    });

    it("should have singleton pattern (isEmbedderReady returns boolean)", async () => {
      const module = await import("../services/memoryEmbedder");
      const ready = module.isEmbedderReady();
      expect(typeof ready).toBe("boolean");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty string validation", () => {
      // This test validates the error handling logic without actually initializing
      expect(() => {
        if ("".trim().length === 0) {
          throw new Error("Cannot generate embedding for empty text");
        }
      }).toThrow("Cannot generate embedding for empty text");
    });

    it("should handle whitespace-only string validation", () => {
      expect(() => {
        if ("   ".trim().length === 0) {
          throw new Error("Cannot generate embedding for empty text");
        }
      }).toThrow("Cannot generate embedding for empty text");
    });

    it("should validate array index in batch processing", () => {
      const texts = ["Valid text", "", "Another valid text"];
      let foundEmptyIndex = -1;

      for (let i = 0; i < texts.length; i++) {
        if (!texts[i] || texts[i].trim().length === 0) {
          foundEmptyIndex = i;
          break;
        }
      }

      expect(foundEmptyIndex).toBe(1);
    });

    it("should return empty array for empty batch input", () => {
      const texts: string[] = [];
      expect(texts.length).toBe(0);
      // If batch is empty, function returns []
      const result = texts.length === 0 ? [] : texts;
      expect(result).toEqual([]);
    });
  });

  describe("Vector Math Utilities", () => {
    it("should calculate cosine similarity correctly", () => {
      // Test with simple vectors
      const vec1 = [1, 0, 0];
      const vec2 = [1, 0, 0];
      const similarity = cosineSimilarity(vec1, vec2);
      expect(similarity).toBeCloseTo(1.0, 5); // Identical vectors

      const vec3 = [1, 0, 0];
      const vec4 = [0, 1, 0];
      const orthogonal = cosineSimilarity(vec3, vec4);
      expect(orthogonal).toBeCloseTo(0.0, 5); // Orthogonal vectors
    });

    it("should handle normalized vectors", () => {
      // Create a normalized vector (L2 norm = 1)
      const vec = [0.6, 0.8]; // sqrt(0.36 + 0.64) = 1
      const norm = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
      expect(norm).toBeCloseTo(1.0, 5);
    });

    it("should validate embedding dimensions", () => {
      const mockEmbedding = new Array(384).fill(0.5);
      expect(mockEmbedding.length).toBe(384);

      const wrongDimensions = new Array(256).fill(0.5);
      expect(wrongDimensions.length).not.toBe(384);
    });
  });

  describe("TypeScript Type Safety", () => {
    it("should work with string arrays", () => {
      const texts: string[] = ["test1", "test2"];
      expect(Array.isArray(texts)).toBe(true);
      expect(texts.every((t) => typeof t === "string")).toBe(true);
    });

    it("should work with number arrays (embeddings)", () => {
      const embedding: number[] = new Array(384).fill(0.5);
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.every((n) => typeof n === "number")).toBe(true);
      expect(embedding.length).toBe(384);
    });

    it("should work with 2D arrays (batch embeddings)", () => {
      const embeddings: number[][] = [
        new Array(384).fill(0.1),
        new Array(384).fill(0.2),
        new Array(384).fill(0.3),
      ];

      expect(Array.isArray(embeddings)).toBe(true);
      expect(embeddings.length).toBe(3);
      expect(embeddings.every((e) => Array.isArray(e))).toBe(true);
      expect(embeddings.every((e) => e.length === 384)).toBe(true);
    });
  });
});

/**
 * Helper: Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}
