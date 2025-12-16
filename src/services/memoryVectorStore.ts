/**
 * Memory Vector Store Service
 *
 * In-memory vector storage for semantic search capabilities.
 * This is a simplified implementation for Phase 1 that stores
 * vectors in memory. For production, LanceDB will be integrated
 * via Tauri backend (Rust side) for persistent storage.
 *
 * @module services/memoryVectorStore
 */

import { toast } from "sonner";
import type { QuackMemory } from "../types/memory";
import { generateEmbedding, isEmbedderReady } from "./memoryEmbedder";

/**
 * Vector record structure
 */
interface MemoryVector {
  id: string;
  content: string;
  vector: number[];
  memoryId: string;
  createdAt: number;
}

// In-memory storage (Phase 1 - will be replaced with LanceDB via Rust)
let vectorStore: Map<string, MemoryVector> = new Map();
let isInitialized = false;

/**
 * Computes cosine similarity between two vectors
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Similarity score (0-1)
 */
const cosineSimilarity = (a: number[], b: number[]): number => {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
};

/**
 * Initializes the vector store
 *
 * For Phase 1, this just marks the store as ready.
 * In production, this will connect to LanceDB via Tauri.
 */
export const initializeVectorStore = async (): Promise<void> => {
  if (isInitialized) return;

  try {
    // Phase 1: In-memory store is always ready
    isInitialized = true;
    console.log("[memoryVectorStore] In-memory vector store initialized");
  } catch (error) {
    console.error("[memoryVectorStore] Failed to initialize:", error);
    toast.error("Vector store initialization failed");
  }
};

/**
 * Checks if vector store is ready
 */
export const isVectorStoreReady = (): boolean => {
  return isInitialized;
};

/**
 * Adds a vector for a memory
 *
 * Generates embedding and stores in memory.
 *
 * @param memory - Memory to create vector for
 */
export const addVector = async (memory: QuackMemory): Promise<void> => {
  try {
    if (!isEmbedderReady()) {
      console.warn("[memoryVectorStore] Embedder not ready, skipping vector");
      return;
    }

    const vector = await generateEmbedding(memory.content);

    const memoryVector: MemoryVector = {
      id: memory.id,
      content: memory.content,
      vector,
      memoryId: memory.id,
      createdAt: Date.now(),
    };

    vectorStore.set(memory.id, memoryVector);
    console.log(`[memoryVectorStore] Added vector for: ${memory.id}`);
  } catch (error) {
    console.error("[memoryVectorStore] Failed to add vector:", error);
  }
};

/**
 * Updates a vector for an existing memory
 *
 * @param memoryId - Memory ID to update
 * @param content - New content
 */
export const updateVector = async (
  memoryId: string,
  content: string
): Promise<void> => {
  try {
    if (!isEmbedderReady()) return;

    const vector = await generateEmbedding(content);

    const existing = vectorStore.get(memoryId);
    if (existing) {
      vectorStore.set(memoryId, {
        ...existing,
        content,
        vector,
      });
      console.log(`[memoryVectorStore] Updated vector: ${memoryId}`);
    }
  } catch (error) {
    console.error("[memoryVectorStore] Failed to update vector:", error);
  }
};

/**
 * Deletes a vector
 *
 * @param memoryId - Memory ID to delete
 */
export const deleteVector = async (memoryId: string): Promise<void> => {
  const deleted = vectorStore.delete(memoryId);
  if (deleted) {
    console.log(`[memoryVectorStore] Deleted vector: ${memoryId}`);
  }
};

/**
 * Searches for similar vectors using KNN
 *
 * @param queryVector - Vector to search for
 * @param limit - Maximum results
 * @returns Array of {id, score} sorted by similarity
 */
export const searchVectors = async (
  queryVector: number[],
  limit: number = 10
): Promise<Array<{ id: string; score: number }>> => {
  try {
    const results: Array<{ id: string; score: number }> = [];

    for (const [id, memoryVector] of vectorStore) {
      const score = cosineSimilarity(queryVector, memoryVector.vector);
      results.push({ id, score });
    }

    // Sort by score descending and limit
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  } catch (error) {
    console.error("[memoryVectorStore] Search failed:", error);
    return [];
  }
};

/**
 * Gets vector store statistics
 */
export const getVectorStoreStats = async (): Promise<{
  count: number;
  sizeBytes: number;
}> => {
  const count = vectorStore.size;
  // Estimate size: 384 floats * 4 bytes each * count
  const sizeBytes = count * 384 * 4;

  return { count, sizeBytes };
};

/**
 * Clears all vectors (for testing)
 */
export const clearVectorStore = (): void => {
  vectorStore.clear();
  console.log("[memoryVectorStore] Cleared all vectors");
};
