// embeddings.js - Local embedding generation using Transformers.js
// Generates semantic embeddings for code chunks using all-MiniLM-L6-v2

import { pipeline, env } from '@xenova/transformers';
import { join } from 'path';
import { homedir, platform } from 'os';
import { mkdirSync, existsSync } from 'fs';

// ============================================================================
// MODEL CONFIGURATION
// ============================================================================

export const MODEL_INFO = {
  name: 'Xenova/all-MiniLM-L6-v2',
  dimensions: 384,
  maxTokens: 256,
  size: '~80MB',
  description: 'Fast and efficient sentence embeddings model'
};

// ============================================================================
// MODEL CACHING
// ============================================================================

/**
 * Get the correct path for model storage based on OS
 */
function getModelStoragePath() {
  const os = platform();
  const home = homedir();

  if (os === 'darwin') {
    return join(home, 'Library', 'Application Support', 'com.quack.terminal', 'models');
  } else if (os === 'win32') {
    return join(process.env.APPDATA || join(home, 'AppData', 'Roaming'), 'com.quack.terminal', 'models');
  } else {
    return join(home, '.local', 'share', 'com.quack.terminal', 'models');
  }
}

/**
 * Ensure model storage directory exists
 */
function ensureModelDir() {
  const modelDir = getModelStoragePath();
  if (!existsSync(modelDir)) {
    mkdirSync(modelDir, { recursive: true });
  }
  return modelDir;
}

// Set Transformers.js cache directory
env.cacheDir = ensureModelDir();

// Singleton pipeline instance (lazy loaded)
let embeddingPipeline = null;
let isInitializing = false;
let initializationPromise = null;

// ============================================================================
// PREPROCESSING FOR CODE
// ============================================================================

/**
 * Preprocess code text for embedding generation
 * - Remove excessive comments
 * - Normalize whitespace
 * - Truncate to max tokens if needed
 *
 * @param {string} text - Raw code text
 * @returns {string} - Preprocessed text
 */
export function preprocessCode(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  let processed = text;

  // Remove block comments (/* ... */)
  processed = processed.replace(/\/\*[\s\S]*?\*\//g, ' ');

  // Remove line comments (// ...)
  processed = processed.replace(/\/\/.*$/gm, '');

  // Normalize whitespace
  processed = processed
    .replace(/\r\n/g, '\n')      // Normalize line endings
    .replace(/\t/g, '  ')        // Tabs to spaces
    .replace(/\n{3,}/g, '\n\n')  // Max 2 consecutive newlines
    .replace(/ {2,}/g, ' ')      // Multiple spaces to single
    .trim();

  // Rough token estimation (4 chars per token)
  const estimatedTokens = processed.length / 4;

  // Truncate if too long (preserve first part, more important)
  if (estimatedTokens > MODEL_INFO.maxTokens) {
    const maxChars = MODEL_INFO.maxTokens * 4;
    processed = processed.substring(0, maxChars) + '...';
  }

  return processed;
}

/**
 * Preprocess search query
 * Queries can have different preprocessing than code
 *
 * @param {string} query - Search query
 * @returns {string} - Preprocessed query
 */
export function preprocessQuery(query) {
  if (!query || typeof query !== 'string') {
    return '';
  }

  // For queries, keep it simple - just normalize whitespace
  return query
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================================================
// MODEL INITIALIZATION
// ============================================================================

/**
 * Initialize the embedding model (lazy loading)
 * Downloads ~80MB on first run, then uses cached version
 *
 * @param {object} options - Initialization options
 * @param {function} options.onProgress - Progress callback (percent: number, message: string)
 * @returns {Promise<void>}
 */
export async function initEmbeddings(options = {}) {
  // If already initialized, return immediately
  if (embeddingPipeline !== null) {
    return;
  }

  // If currently initializing, wait for that to finish
  if (isInitializing && initializationPromise) {
    return initializationPromise;
  }

  // Start initialization
  isInitializing = true;

  initializationPromise = (async () => {
    try {
      const { onProgress } = options;

      // Ensure model directory exists
      const modelDir = ensureModelDir();

      if (onProgress) {
        onProgress(0, `Initializing model (cache: ${modelDir})`);
      }

      // Check if model is already cached
      const modelPath = join(modelDir, 'models--Xenova--all-MiniLM-L6-v2');
      const isCached = existsSync(modelPath);

      if (isCached) {
        if (onProgress) {
          onProgress(50, 'Loading model from cache...');
        }
      } else {
        if (onProgress) {
          onProgress(10, `Downloading model (${MODEL_INFO.size})...`);
        }
      }

      // Create pipeline (will download if not cached)
      embeddingPipeline = await pipeline(
        'feature-extraction',
        MODEL_INFO.name,
        {
          // Use quantized model for smaller size and faster inference
          quantized: true,
        }
      );

      if (onProgress) {
        onProgress(100, 'Model ready');
      }

      console.error(`[Embeddings] Model initialized: ${MODEL_INFO.name} (${MODEL_INFO.dimensions}D)`);
    } catch (error) {
      embeddingPipeline = null;
      console.error(`[Embeddings] Initialization error: ${error.message}`);
      throw error;
    } finally {
      isInitializing = false;
      initializationPromise = null;
    }
  })();

  return initializationPromise;
}

// ============================================================================
// EMBEDDING GENERATION
// ============================================================================

/**
 * Generate embedding for a single text
 * Auto-initializes model on first call
 *
 * @param {string} text - Text to embed
 * @param {object} options - Options
 * @param {boolean} options.preprocess - Apply preprocessing (default: true)
 * @param {boolean} options.normalize - Normalize vector (default: true)
 * @returns {Promise<Float32Array>} - Embedding vector (384 dimensions)
 */
export async function embed(text, options = {}) {
  const { preprocess = true, normalize = true } = options;

  // Auto-initialize if needed
  if (!embeddingPipeline) {
    await initEmbeddings();
  }

  // Preprocess text
  const processedText = preprocess ? preprocessCode(text) : text;

  if (!processedText) {
    // Return zero vector for empty text
    return new Float32Array(MODEL_INFO.dimensions);
  }

  try {
    // Generate embedding
    const output = await embeddingPipeline(processedText, {
      pooling: 'mean',
      normalize: normalize
    });

    // Extract Float32Array from tensor
    const embedding = output.data;

    // Verify dimensions
    if (embedding.length !== MODEL_INFO.dimensions) {
      throw new Error(
        `Unexpected embedding dimensions: ${embedding.length} (expected ${MODEL_INFO.dimensions})`
      );
    }

    return embedding;
  } catch (error) {
    console.error(`[Embeddings] Error generating embedding: ${error.message}`);
    throw error;
  }
}

/**
 * Generate embeddings for multiple texts (batch processing)
 * More efficient than calling embed() multiple times
 *
 * @param {string[]} texts - Array of texts to embed
 * @param {object} options - Options
 * @param {boolean} options.preprocess - Apply preprocessing (default: true)
 * @param {boolean} options.normalize - Normalize vectors (default: true)
 * @param {number} options.batchSize - Process in batches of this size (default: 32)
 * @returns {Promise<Float32Array[]>} - Array of embedding vectors
 */
export async function embedBatch(texts, options = {}) {
  const { preprocess = true, normalize = true, batchSize = 32 } = options;

  // Auto-initialize if needed
  if (!embeddingPipeline) {
    await initEmbeddings();
  }

  if (!Array.isArray(texts) || texts.length === 0) {
    return [];
  }

  // Preprocess all texts
  const processedTexts = texts.map(text =>
    preprocess ? preprocessCode(text) : text
  );

  const embeddings = [];

  // Process in batches to avoid memory issues
  for (let i = 0; i < processedTexts.length; i += batchSize) {
    const batch = processedTexts.slice(i, i + batchSize);

    try {
      // Generate embeddings for batch
      const outputs = await Promise.all(
        batch.map(text => {
          if (!text) {
            // Return zero vector for empty text
            return Promise.resolve({ data: new Float32Array(MODEL_INFO.dimensions) });
          }

          return embeddingPipeline(text, {
            pooling: 'mean',
            normalize: normalize
          });
        })
      );

      // Extract Float32Arrays
      const batchEmbeddings = outputs.map(output => output.data);

      embeddings.push(...batchEmbeddings);

      // Log progress for large batches
      if (processedTexts.length > batchSize) {
        const progress = Math.min(100, Math.round(((i + batchSize) / processedTexts.length) * 100));
        console.error(`[Embeddings] Batch progress: ${progress}% (${Math.min(i + batchSize, processedTexts.length)}/${processedTexts.length})`);
      }
    } catch (error) {
      console.error(`[Embeddings] Error in batch ${i / batchSize + 1}: ${error.message}`);
      throw error;
    }
  }

  return embeddings;
}

/**
 * Generate embedding for a search query
 * Uses different preprocessing optimized for queries
 *
 * @param {string} query - Search query
 * @param {object} options - Options
 * @param {boolean} options.normalize - Normalize vector (default: true)
 * @returns {Promise<Float32Array>} - Query embedding vector
 */
export async function embedQuery(query, options = {}) {
  const { normalize = true } = options;

  // Auto-initialize if needed
  if (!embeddingPipeline) {
    await initEmbeddings();
  }

  // Use query-specific preprocessing
  const processedQuery = preprocessQuery(query);

  if (!processedQuery) {
    // Return zero vector for empty query
    return new Float32Array(MODEL_INFO.dimensions);
  }

  try {
    // Generate embedding
    const output = await embeddingPipeline(processedQuery, {
      pooling: 'mean',
      normalize: normalize
    });

    return output.data;
  } catch (error) {
    console.error(`[Embeddings] Error generating query embedding: ${error.message}`);
    throw error;
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Check if the model is initialized
 * @returns {boolean}
 */
export function isInitialized() {
  return embeddingPipeline !== null;
}

/**
 * Get model information
 * @returns {object} - Model metadata
 */
export function getModelInfo() {
  return {
    ...MODEL_INFO,
    initialized: isInitialized(),
    cachePath: env.cacheDir
  };
}

/**
 * Cleanup resources (optional)
 * Transformers.js doesn't require explicit cleanup, but this is here for consistency
 */
export async function cleanup() {
  if (embeddingPipeline) {
    // Transformers.js doesn't have a cleanup method
    // Just clear the reference
    embeddingPipeline = null;
    console.error('[Embeddings] Pipeline cleared');
  }
}
