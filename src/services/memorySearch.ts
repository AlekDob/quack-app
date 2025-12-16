/**
 * Memory Search Service
 *
 * Hybrid search combining semantic (vector) and keyword-based search
 * with Reciprocal Rank Fusion (RRF) for optimal results.
 *
 * @module services/memorySearch
 */

import type {
  QuackMemory,
  MemorySearchResult,
  MemoryCategory,
  MemoryScope,
} from "../types/memory";
import { loadMemoriesFromStorage } from "./memoryStorage";
import { generateEmbedding, isEmbedderReady } from "./memoryEmbedder";
import { searchVectors } from "./memoryVectorStore";
import { extractKeywords } from "./memoryExtractor";

/**
 * Search options for memory retrieval
 */
export interface MemorySearchOptions {
  /** Maximum results to return */
  limit?: number;
  /** Filter by memory category */
  categories?: MemoryCategory[];
  /** Filter by scope */
  scope?: MemoryScope;
  /** Filter by project path */
  projectPath?: string;
  /** Minimum confidence level */
  minConfidence?: "high" | "medium" | "low";
  /** Include archived memories */
  includeArchived?: boolean;
  /** Weight for semantic search (0-1, default 0.7) */
  semanticWeight?: number;
}

/**
 * RRF constant for rank fusion (commonly k=60)
 */
const RRF_K = 60;

/**
 * Computes keyword match score between query and memory
 *
 * @param queryKeywords - Keywords from search query
 * @param memory - Memory to score
 * @returns Score between 0-1
 */
const computeKeywordScore = (
  queryKeywords: string[],
  memory: QuackMemory
): number => {
  if (queryKeywords.length === 0) return 0;

  const memoryKeywords = new Set(memory.keywords.map((k) => k.toLowerCase()));
  let matches = 0;

  for (const keyword of queryKeywords) {
    if (memoryKeywords.has(keyword.toLowerCase())) {
      matches++;
    }
  }

  return matches / queryKeywords.length;
};

/**
 * Applies RRF fusion to combine ranked lists
 *
 * @param semanticRanks - Map of memoryId to semantic rank (1-based)
 * @param keywordRanks - Map of memoryId to keyword rank (1-based)
 * @param semanticWeight - Weight for semantic results (0-1)
 * @returns Map of memoryId to fused score
 */
const applyRRF = (
  semanticRanks: Map<string, number>,
  keywordRanks: Map<string, number>,
  semanticWeight: number
): Map<string, number> => {
  const fusedScores = new Map<string, number>();
  const keywordWeight = 1 - semanticWeight;

  // Get all unique memory IDs
  const allIds = new Set([...semanticRanks.keys(), ...keywordRanks.keys()]);

  for (const id of allIds) {
    const semanticRank = semanticRanks.get(id) ?? Infinity;
    const keywordRank = keywordRanks.get(id) ?? Infinity;

    // RRF formula: 1/(k + rank)
    const semanticScore =
      semanticRank !== Infinity ? 1 / (RRF_K + semanticRank) : 0;
    const keywordScore =
      keywordRank !== Infinity ? 1 / (RRF_K + keywordRank) : 0;

    // Weighted combination
    const fusedScore =
      semanticWeight * semanticScore + keywordWeight * keywordScore;
    fusedScores.set(id, fusedScore);
  }

  return fusedScores;
};

/**
 * Filters memories by search options
 */
const applyFilters = (
  memories: QuackMemory[],
  options: MemorySearchOptions
): QuackMemory[] => {
  return memories.filter((m) => {
    // Category filter
    if (options.categories && !options.categories.includes(m.category)) {
      return false;
    }
    // Scope filter
    if (options.scope && m.scope !== options.scope) {
      return false;
    }
    // Project path filter
    if (options.projectPath && m.projectPath !== options.projectPath) {
      return false;
    }
    // Archived filter
    if (!options.includeArchived && m.isArchived) {
      return false;
    }
    // Confidence filter
    if (options.minConfidence) {
      const levels = { high: 3, medium: 2, low: 1 };
      if (levels[m.confidence] < levels[options.minConfidence]) {
        return false;
      }
    }
    return true;
  });
};

/**
 * Searches memories using hybrid semantic + keyword search
 *
 * Uses RRF (Reciprocal Rank Fusion) to combine vector similarity
 * with keyword matching for optimal results.
 *
 * @param query - Search query string
 * @param options - Search options
 * @returns Array of search results with scores
 *
 * @example
 * ```typescript
 * const results = await searchMemories("TypeScript preferences", {
 *   limit: 10,
 *   categories: ["preference", "pattern"],
 *   scope: "global"
 * });
 * ```
 */
export const searchMemories = async (
  query: string,
  options: MemorySearchOptions = {}
): Promise<MemorySearchResult[]> => {
  const {
    limit = 10,
    semanticWeight = 0.7,
  } = options;

  console.log(`[memorySearch] Searching for: "${query.slice(0, 50)}..."`);

  // Load all memories
  const allMemories = await loadMemoriesFromStorage();
  const filteredMemories = applyFilters(allMemories, options);

  if (filteredMemories.length === 0) {
    console.log("[memorySearch] No memories match filters");
    return [];
  }

  // Create memory lookup map
  const memoryMap = new Map(filteredMemories.map((m) => [m.id, m]));

  // 1. Semantic search (if embedder is ready)
  const semanticRanks = new Map<string, number>();
  let semanticScores = new Map<string, number>();

  if (isEmbedderReady()) {
    try {
      const queryVector = await generateEmbedding(query);
      const vectorResults = await searchVectors(queryVector, limit * 2);

      vectorResults.forEach((result, index) => {
        if (memoryMap.has(result.id)) {
          semanticRanks.set(result.id, index + 1);
          semanticScores.set(result.id, result.score);
        }
      });
    } catch (error) {
      console.warn("[memorySearch] Semantic search failed:", error);
    }
  }

  // 2. Keyword search
  const queryKeywords = extractKeywords(query);
  const keywordResults: Array<{ id: string; score: number }> = [];

  for (const memory of filteredMemories) {
    const score = computeKeywordScore(queryKeywords, memory);
    if (score > 0) {
      keywordResults.push({ id: memory.id, score });
    }
  }

  // Sort by score descending and assign ranks
  keywordResults.sort((a, b) => b.score - a.score);
  const keywordRanks = new Map<string, number>();
  const keywordScoresMap = new Map<string, number>();

  keywordResults.forEach((result, index) => {
    keywordRanks.set(result.id, index + 1);
    keywordScoresMap.set(result.id, result.score);
  });

  // 3. Apply RRF fusion
  const fusedScores = applyRRF(semanticRanks, keywordRanks, semanticWeight);

  // 4. Build results
  const results: MemorySearchResult[] = [];

  for (const [id, score] of fusedScores) {
    const memory = memoryMap.get(id);
    if (memory) {
      results.push({
        memory,
        score,
        semanticScore: semanticScores.get(id),
        keywordScore: keywordScoresMap.get(id),
      });
    }
  }

  // Sort by fused score and limit
  results.sort((a, b) => b.score - a.score);
  const finalResults = results.slice(0, limit);

  console.log(
    `[memorySearch] Found ${finalResults.length} results (from ${filteredMemories.length} filtered)`
  );

  return finalResults;
};

/**
 * Finds memories similar to a given memory
 *
 * Useful for deduplication and related memory suggestions.
 *
 * @param memoryId - ID of the reference memory
 * @param limit - Maximum results
 * @returns Similar memories (excluding the reference)
 */
export const findSimilarMemories = async (
  memoryId: string,
  limit: number = 5
): Promise<MemorySearchResult[]> => {
  const memories = await loadMemoriesFromStorage();
  const reference = memories.find((m) => m.id === memoryId);

  if (!reference) {
    console.warn(`[memorySearch] Memory not found: ${memoryId}`);
    return [];
  }

  // Use the memory content as query
  const results = await searchMemories(reference.content, { limit: limit + 1 });

  // Filter out the reference memory itself
  return results.filter((r) => r.memory.id !== memoryId).slice(0, limit);
};

/**
 * Gets most accessed memories for quick access
 *
 * @param limit - Maximum results
 * @param options - Filter options
 * @returns Most frequently accessed memories
 */
export const getMostAccessedMemories = async (
  limit: number = 10,
  options: Omit<MemorySearchOptions, "limit"> = {}
): Promise<QuackMemory[]> => {
  const memories = await loadMemoriesFromStorage();
  const filtered = applyFilters(memories, { ...options, limit });

  return filtered
    .sort((a, b) => b.accessCount - a.accessCount)
    .slice(0, limit);
};

/**
 * Gets recently created memories
 *
 * @param limit - Maximum results
 * @param options - Filter options
 * @returns Most recently created memories
 */
export const getRecentMemories = async (
  limit: number = 10,
  options: Omit<MemorySearchOptions, "limit"> = {}
): Promise<QuackMemory[]> => {
  const memories = await loadMemoriesFromStorage();
  const filtered = applyFilters(memories, { ...options, limit });

  return filtered
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);
};
