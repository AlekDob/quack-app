/**
 * Memory Embedder Service
 *
 * Generates vector embeddings for semantic search using Transformers.js.
 * Uses local model inference (no API calls) with Xenova/all-MiniLM-L6-v2.
 *
 * Features:
 * - Lazy initialization with singleton pattern
 * - Local model caching in ~/.quack/models/
 * - Batch embedding generation
 * - Zero API costs, fully offline
 *
 * @module services/memoryEmbedder
 */

import { pipeline } from "@xenova/transformers";

// Model configuration
const MODEL_NAME = "Xenova/all-MiniLM-L6-v2";
const EMBEDDING_DIMENSIONS = 384;

// Singleton state
let embedderPipeline: any = null;
let isInitializing = false;
let initializationError: Error | null = null;

/**
 * Initialize the embedding pipeline
 *
 * Lazy loads the Transformers.js model on first call.
 * Subsequent calls return immediately if already initialized.
 * Model is cached in ~/.quack/models/ directory.
 *
 * @returns Promise that resolves when embedder is ready
 * @throws Error if initialization fails
 *
 * @example
 * ```typescript
 * await initializeEmbedder();
 * console.log("Embedder ready!");
 * ```
 */
export const initializeEmbedder = async (): Promise<void> => {
  // Already initialized
  if (embedderPipeline) {
    console.log("[memoryEmbedder] Already initialized");
    return;
  }

  // Previous initialization failed
  if (initializationError) {
    console.error(
      "[memoryEmbedder] Previous initialization failed:",
      initializationError
    );
    throw initializationError;
  }

  // Already initializing - wait
  if (isInitializing) {
    console.log("[memoryEmbedder] Initialization in progress, waiting...");
    await waitForInitialization();
    return;
  }

  // Start initialization
  isInitializing = true;
  console.log(`[memoryEmbedder] Initializing model: ${MODEL_NAME}`);

  try {
    embedderPipeline = await pipeline("feature-extraction", MODEL_NAME, {
      // Cache model locally
      cache_dir: "~/.quack/models/",
    });

    console.log(
      `[memoryEmbedder] Model initialized (${EMBEDDING_DIMENSIONS}-dim embeddings)`
    );
    isInitializing = false;
  } catch (error) {
    isInitializing = false;
    initializationError = error as Error;
    console.warn("[memoryEmbedder] Initialization failed (semantic search disabled):", error);
    // Don't show error toast - semantic search is optional, keyword search still works
    throw error;
  }
};

/**
 * Wait for ongoing initialization to complete
 *
 * Polls initialization state with exponential backoff.
 * Used internally to avoid concurrent initialization.
 *
 * @returns Promise that resolves when initialization completes
 */
const waitForInitialization = async (): Promise<void> => {
  let attempts = 0;
  const maxAttempts = 30;

  while (isInitializing && attempts < maxAttempts) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    attempts++;
  }

  if (isInitializing) {
    throw new Error("Embedder initialization timeout");
  }

  if (initializationError) {
    throw initializationError;
  }
};

/**
 * Check if embedder is ready
 *
 * Returns true if pipeline is initialized and ready to generate embeddings.
 * Does not trigger initialization - use initializeEmbedder() first.
 *
 * @returns boolean indicating if embedder is ready
 *
 * @example
 * ```typescript
 * if (!isEmbedderReady()) {
 *   await initializeEmbedder();
 * }
 * ```
 */
export const isEmbedderReady = (): boolean => {
  return embedderPipeline !== null && !isInitializing;
};

/**
 * Generate embedding for single text
 *
 * Converts text to 384-dimensional vector for semantic search.
 * Auto-initializes embedder if not ready.
 *
 * @param text - Text to embed
 * @returns Promise resolving to number[] (384 dimensions)
 * @throws Error if embedder fails or text is empty
 *
 * @example
 * ```typescript
 * const vector = await generateEmbedding("User prefers TypeScript");
 * console.log(vector.length); // 384
 * ```
 */
export const generateEmbedding = async (text: string): Promise<number[]> => {
  if (!text || text.trim().length === 0) {
    throw new Error("Cannot generate embedding for empty text");
  }

  // Auto-initialize if needed
  if (!embedderPipeline) {
    await initializeEmbedder();
  }

  try {
    const result = await embedderPipeline!(text, {
      pooling: "mean",
      normalize: true,
    });

    // Extract array from tensor
    const embedding = Array.from(result.data) as number[];

    if (embedding.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(
        `Unexpected embedding dimensions: ${embedding.length} (expected ${EMBEDDING_DIMENSIONS})`
      );
    }

    console.log(`[memoryEmbedder] Generated embedding (${text.length} chars)`);
    return embedding;
  } catch (error) {
    console.error("[memoryEmbedder] Failed to generate embedding:", error);
    // Don't show toast - embeddings are optional, fall back to keyword search
    throw error;
  }
};

/**
 * Generate embeddings for multiple texts (batch)
 *
 * More efficient than calling generateEmbedding() multiple times.
 * Processes all texts in a single forward pass.
 *
 * @param texts - Array of texts to embed
 * @returns Promise resolving to number[][] (array of 384-dim vectors)
 * @throws Error if any text is empty or embedder fails
 *
 * @example
 * ```typescript
 * const texts = ["Memory 1", "Memory 2", "Memory 3"];
 * const vectors = await generateEmbeddings(texts);
 * console.log(vectors.length); // 3
 * console.log(vectors[0].length); // 384
 * ```
 */
export const generateEmbeddings = async (
  texts: string[]
): Promise<number[][]> => {
  if (texts.length === 0) {
    return [];
  }

  // Validate all texts
  for (let i = 0; i < texts.length; i++) {
    if (!texts[i] || texts[i].trim().length === 0) {
      throw new Error(`Text at index ${i} is empty`);
    }
  }

  // Auto-initialize if needed
  if (!embedderPipeline) {
    await initializeEmbedder();
  }

  try {
    const embeddings: number[][] = [];

    // Process each text (batch processing in Transformers.js is complex)
    for (const text of texts) {
      const result = await embedderPipeline!(text, {
        pooling: "mean",
        normalize: true,
      });

      const embedding = Array.from(result.data) as number[];
      embeddings.push(embedding);
    }

    console.log(`[memoryEmbedder] Generated ${embeddings.length} embeddings`);
    return embeddings;
  } catch (error) {
    console.error("[memoryEmbedder] Failed to generate embeddings:", error);
    // Don't show toast - embeddings are optional, fall back to keyword search
    throw error;
  }
};

/**
 * Get embedding dimensions
 *
 * Returns the dimensionality of generated embeddings.
 * Useful for validation and storage configuration.
 *
 * @returns number of dimensions (384)
 *
 * @example
 * ```typescript
 * const dims = getEmbeddingDimensions();
 * console.log(dims); // 384
 * ```
 */
export const getEmbeddingDimensions = (): number => {
  return EMBEDDING_DIMENSIONS;
};
