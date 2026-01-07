#!/usr/bin/env node

/**
 * Semantic Search MCP Server (stdio-based)
 *
 * This is a standalone MCP server that provides semantic code search tools.
 * It runs as a separate process and communicates via stdin/stdout.
 *
 * Tools provided:
 * - semantic_search_code: Search codebase semantically by meaning/intent
 * - index_project: Index a project for semantic search
 * - get_index_status: Get indexing status for a project
 *
 * Storage:
 * ~/Library/Application Support/com.quack.terminal/code-index/
 * └── [project-path-hash]/
 *     ├── index.db      # SQLite database
 *     └── meta.json     # {lastIndexed, fileCount, chunkCount}
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'fs';
import { join, relative, extname } from 'path';
import { homedir, platform } from 'os';
import { createHash } from 'crypto';
import { glob } from 'glob';
import { SemanticDatabase } from './lib/semantic-db.js';
import { parseFile, detectLanguage as detectChunkerLanguage } from './lib/code-chunker.js';
import { embed, embedBatch, embedQuery, initEmbeddings, MODEL_INFO } from './lib/embeddings.js';

// =============================================================================
// STORAGE PATH
// =============================================================================

/**
 * Get the correct path for Tauri Store files based on OS
 */
function getTauriStorePath() {
  const os = platform();
  const home = homedir();

  if (os === 'darwin') {
    return join(home, 'Library', 'Application Support', 'com.quack.terminal');
  } else if (os === 'win32') {
    return join(process.env.APPDATA || join(home, 'AppData', 'Roaming'), 'com.quack.terminal');
  } else {
    return join(home, '.local', 'share', 'com.quack.terminal');
  }
}

/**
 * Get the code-index directory path
 */
function getCodeIndexPath() {
  return join(getTauriStorePath(), 'code-index');
}

/**
 * Generate a deterministic hash from a project path
 * Used as folder name to store per-project indices
 * @param {string} projectPath - Absolute path to the project
 * @returns {string} - 16-character hex hash
 */
function hashProjectPath(projectPath) {
  return createHash('sha256')
    .update(projectPath)
    .digest('hex')
    .substring(0, 16);
}

/**
 * Get the storage directory for a specific project
 * @param {string} projectPath - Absolute path to the project
 * @returns {string} - Path to the project's index directory
 */
function getProjectIndexPath(projectPath) {
  const hash = hashProjectPath(projectPath);
  return join(getCodeIndexPath(), hash);
}

/**
 * Ensure the index directory exists for a project
 * @param {string} projectPath - Absolute path to the project
 * @returns {string} - Path to the created/existing directory
 */
function ensureProjectIndexDir(projectPath) {
  const indexDir = getProjectIndexPath(projectPath);
  if (!existsSync(indexDir)) {
    mkdirSync(indexDir, { recursive: true });
  }
  return indexDir;
}

/**
 * Load metadata for a project index
 * @param {string} projectPath - Absolute path to the project
 * @returns {object|null} - Metadata object or null if not found
 */
function loadProjectMeta(projectPath) {
  try {
    const metaPath = join(getProjectIndexPath(projectPath), 'meta.json');
    if (!existsSync(metaPath)) {
      return null;
    }
    return JSON.parse(readFileSync(metaPath, 'utf8'));
  } catch (error) {
    console.error(`[SemanticSearchMCP] Error loading meta: ${error.message}`);
    return null;
  }
}

/**
 * Save metadata for a project index
 * @param {string} projectPath - Absolute path to the project
 * @param {object} meta - Metadata to save
 */
function saveProjectMeta(projectPath, meta) {
  try {
    const indexDir = ensureProjectIndexDir(projectPath);
    const metaPath = join(indexDir, 'meta.json');
    writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');
    console.error(`[SemanticSearchMCP] Saved meta for project: ${projectPath}`);
  } catch (error) {
    console.error(`[SemanticSearchMCP] Error saving meta: ${error.message}`);
    throw error;
  }
}

// =============================================================================
// DATABASE MANAGEMENT
// =============================================================================

// Cache delle connessioni database aperte per project path
const dbConnections = new Map();

/**
 * Get or create a database connection for a project
 * @param {string} projectPath - Absolute path to the project
 * @returns {SemanticDatabase} - Database instance
 */
function getDatabase(projectPath) {
  if (!dbConnections.has(projectPath)) {
    const indexDir = ensureProjectIndexDir(projectPath);
    const dbPath = join(indexDir, 'index.db');
    console.error(`[SemanticSearchMCP] Opening database: ${dbPath}`);
    dbConnections.set(projectPath, new SemanticDatabase(dbPath));
  }
  return dbConnections.get(projectPath);
}

/**
 * Close database connection for a project
 * @param {string} projectPath - Absolute path to the project
 */
function closeDatabase(projectPath) {
  if (dbConnections.has(projectPath)) {
    console.error(`[SemanticSearchMCP] Closing database for: ${projectPath}`);
    dbConnections.get(projectPath).close();
    dbConnections.delete(projectPath);
  }
}

// =============================================================================
// FILE UTILITIES
// =============================================================================

/**
 * Detect language from file extension
 * @param {string} filePath - File path
 * @returns {string} - Language identifier
 */
function detectLanguage(filePath) {
  const ext = extname(filePath);
  const langMap = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.py': 'python',
    '.rs': 'rust',
    '.go': 'go',
    '.java': 'java',
    '.c': 'c',
    '.cpp': 'cpp',
    '.h': 'c',
    '.hpp': 'cpp',
  };
  return langMap[ext] || 'unknown';
}

/**
 * Calculate file content hash
 * @param {string} content - File content
 * @returns {string} - SHA256 hash
 */
function hashContent(content) {
  return createHash('sha256').update(content).digest('hex');
}

// =============================================================================
// TOOL HANDLERS
// =============================================================================

/**
 * Handle semantic_search_code tool
 * Searches the codebase semantically by meaning/intent
 */
async function handleSemanticSearchCode(args) {
  const { query, projectPath, level = 'all', limit = 10 } = args;

  console.error(`[SemanticSearchMCP] Search: "${query}" in ${projectPath} (level: ${level}, limit: ${limit})`);

  const startTime = Date.now();

  // Check if project is indexed
  const meta = loadProjectMeta(projectPath);

  if (!meta) {
    return JSON.stringify({
      success: false,
      error: 'Project not indexed',
      message: `Project at "${projectPath}" has not been indexed yet. Run index_project first.`,
      suggestion: 'Use the index_project tool to create the search index.',
    }, null, 2);
  }

  try {
    // Get database connection
    const db = getDatabase(projectPath);
    const stats = db.getStats();

    let rawResults;
    let searchMode;

    // Use hybrid search if embeddings are available, otherwise FTS only
    if (stats.embeddingCount > 0) {
      console.error('[SemanticSearchMCP] Using hybrid search (vector + FTS)');
      searchMode = 'hybrid';

      // Generate query embedding
      try {
        await initEmbeddings();
        const queryVector = await embedQuery(query);

        // Use hybrid search with RRF
        rawResults = db.searchHybrid(query, queryVector, level === 'all' ? limit * 2 : limit);
      } catch (embeddingError) {
        console.error(`[SemanticSearchMCP] Embedding error, falling back to FTS: ${embeddingError.message}`);
        searchMode = 'fts';
        rawResults = db.searchFTS(query, level === 'all' ? limit * 2 : limit);
      }
    } else {
      console.error('[SemanticSearchMCP] Using FTS search (no embeddings available)');
      searchMode = 'fts';
      rawResults = db.searchFTS(query, level === 'all' ? limit * 2 : limit);
    }

    // Filter by level if specified
    let filteredResults = rawResults;
    if (level !== 'all') {
      filteredResults = rawResults.filter(r => r.level === level);
    }

    // Limit results
    const limitedResults = filteredResults.slice(0, limit);

    // Format results for output
    const results = limitedResults.map(r => ({
      type: r.level,
      name: r.name || r.path,
      file: r.path,
      startLine: r.start_line,
      endLine: r.end_line,
      content: r.content.substring(0, 500) + (r.content.length > 500 ? '...' : ''), // Truncate long content
      score: searchMode === 'hybrid' ? r.rrf_score : Math.abs(r.fts_rank || 0),
      matchType: searchMode,
      vectorRank: r.vector_rank || null,
      ftsRank: r.fts_rank || null,
      language: r.language,
    }));

    const searchTimeMs = Date.now() - startTime;

    console.error(`[SemanticSearchMCP] Search complete: ${results.length} results in ${searchTimeMs}ms (${searchMode})`);

    return JSON.stringify({
      success: true,
      query,
      projectPath,
      level,
      limit,
      searchMode,
      results,
      stats: {
        totalResults: filteredResults.length,
        returnedResults: results.length,
        searchTimeMs,
        indexStatus: {
          fileCount: stats.fileCount,
          chunkCount: stats.chunkCount,
          embeddingCount: stats.embeddingCount,
          lastIndexed: meta.lastIndexed,
        },
      },
      notes: searchMode === 'hybrid'
        ? [
            'Using hybrid search (vector + FTS) with RRF ranking',
            'Results combine semantic similarity with keyword matching',
          ]
        : [
            'Using FTS5 keyword search only',
            'Run generate_embeddings to enable semantic search',
            'Use FTS5 syntax for advanced queries: "exact phrase" OR keyword AND another',
          ],
    }, null, 2);

  } catch (error) {
    console.error(`[SemanticSearchMCP] Search error: ${error.message}`);
    return JSON.stringify({
      success: false,
      error: 'Search failed',
      message: error.message,
      stack: error.stack,
    }, null, 2);
  }
}

/**
 * Handle index_project tool
 * Indexes a project for semantic search
 */
async function handleIndexProject(args) {
  const { projectPath, patterns = ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'] } = args;

  console.error(`[SemanticSearchMCP] Indexing project: ${projectPath}`);
  console.error(`[SemanticSearchMCP] Patterns: ${patterns.join(', ')}`);

  const startTime = Date.now();

  // Validate project path exists
  if (!existsSync(projectPath)) {
    return JSON.stringify({
      success: false,
      error: 'Project path not found',
      message: `The path "${projectPath}" does not exist.`,
    }, null, 2);
  }

  try {
    // Get database connection
    const db = getDatabase(projectPath);
    const indexDir = ensureProjectIndexDir(projectPath);

    // Find all files matching patterns
    console.error('[SemanticSearchMCP] Globbing files...');
    const files = await glob(patterns, {
      cwd: projectPath,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**'],
      absolute: false,
      nodir: true,
    });

    console.error(`[SemanticSearchMCP] Found ${files.length} files to index`);

    let filesIndexed = 0;
    let filesSkipped = 0;
    let chunksCreated = 0;

    // Index each file
    for (const relPath of files) {
      const absPath = join(projectPath, relPath);

      try {
        // Read file content
        const content = readFileSync(absPath, 'utf8');
        const contentHash = hashContent(content);
        const stats = statSync(absPath);
        const language = detectLanguage(relPath);

        // Check if file needs reindexing
        if (!db.needsReindexing(relPath, contentHash)) {
          filesSkipped++;
          continue;
        }

        // Upsert file record
        const fileId = db.upsertFile(
          relPath,
          contentHash,
          language,
          stats.size,
          stats.mtimeMs
        );

        // Delete old chunks for this file
        db.deleteChunksForFile(fileId);

        // Try to parse with tree-sitter for granular chunks
        let chunks = [];
        const isSupported = detectChunkerLanguage(relPath);

        if (isSupported) {
          try {
            chunks = parseFile(relPath, content);
          } catch (parseError) {
            console.error(`[SemanticSearchMCP] Parse error ${relPath}: ${parseError.message}`);
            // Fallback to file-level chunk
            chunks = [];
          }
        }

        // If no chunks from parser, create file-level chunk
        if (chunks.length === 0) {
          const chunkId = db.insertChunk(
            fileId,
            'file',
            relPath,
            1,
            content.split('\n').length,
            content,
            null
          );
          chunksCreated++;
        } else {
          // Insert parsed chunks with parent relationships
          const chunkIdMap = new Map(); // name -> id for parent lookups

          for (const chunk of chunks) {
            // Find parent chunk ID if this is a nested chunk (method inside class)
            let parentId = null;
            if (chunk.parent && chunkIdMap.has(chunk.parent)) {
              parentId = chunkIdMap.get(chunk.parent);
            }

            const chunkId = db.insertChunk(
              fileId,
              chunk.level, // 'file', 'class', 'function', 'method'
              chunk.name,
              chunk.startLine,
              chunk.endLine,
              chunk.content,
              parentId
            );

            // Store for parent lookups
            chunkIdMap.set(chunk.name, chunkId);
            chunksCreated++;
          }
        }

        filesIndexed++;

        if (filesIndexed % 10 === 0) {
          console.error(`[SemanticSearchMCP] Indexed ${filesIndexed}/${files.length} files...`);
        }

      } catch (fileError) {
        console.error(`[SemanticSearchMCP] Error indexing ${relPath}: ${fileError.message}`);
        // Continue with next file
      }
    }

    // Get final stats from database
    const stats = db.getStats();
    const elapsedMs = Date.now() - startTime;

    // Save metadata
    const meta = {
      projectPath,
      projectHash: hashProjectPath(projectPath),
      patterns,
      lastIndexed: new Date().toISOString(),
      fileCount: stats.fileCount,
      chunkCount: stats.chunkCount,
      embeddingCount: stats.embeddingCount,
      status: 'indexed',
      version: '1.0.0',
      indexingTimeMs: elapsedMs,
    };

    saveProjectMeta(projectPath, meta);

    console.error(`[SemanticSearchMCP] Indexing complete: ${filesIndexed} files, ${chunksCreated} chunks in ${elapsedMs}ms`);

    return JSON.stringify({
      success: true,
      message: 'Project indexing completed successfully',
      projectPath,
      indexDir,
      patterns,
      stats: {
        filesProcessed: files.length,
        filesIndexed,
        filesSkipped,
        chunksCreated,
        totalFileCount: stats.fileCount,
        totalChunkCount: stats.chunkCount,
        totalEmbeddingCount: stats.embeddingCount,
        indexingTimeMs: elapsedMs,
      },
      meta,
      notes: [
        'Indexed with tree-sitter parsing (file/class/function chunks)',
        'Run generate_embeddings to enable semantic vector search',
        'Supported languages: TypeScript, JavaScript, TSX, JSX',
      ],
    }, null, 2);

  } catch (error) {
    console.error(`[SemanticSearchMCP] Indexing error: ${error.message}`);
    return JSON.stringify({
      success: false,
      error: 'Indexing failed',
      message: error.message,
      stack: error.stack,
    }, null, 2);
  }
}

/**
 * Handle get_index_status tool
 * Returns the current indexing status for a project
 */
async function handleGetIndexStatus(args) {
  const { projectPath } = args;

  console.error(`[SemanticSearchMCP] Getting status for: ${projectPath}`);

  const meta = loadProjectMeta(projectPath);
  const indexDir = getProjectIndexPath(projectPath);
  const dbPath = join(indexDir, 'index.db');

  if (!meta) {
    return JSON.stringify({
      success: true,
      indexed: false,
      projectPath,
      projectHash: hashProjectPath(projectPath),
      indexDir,
      databaseExists: existsSync(dbPath),
      message: 'Project has not been indexed yet.',
      suggestion: 'Use the index_project tool to create the search index.',
    }, null, 2);
  }

  try {
    // Get real-time stats from database
    const db = getDatabase(projectPath);
    const stats = db.getStats();

    // Calculate if needs reindexing
    const now = Date.now();
    const lastIndexedMs = new Date(meta.lastIndexed).getTime();
    const hoursSinceIndexing = (now - lastIndexedMs) / (1000 * 60 * 60);
    const needsReindexing = hoursSinceIndexing > 24; // Suggest reindex after 24h

    return JSON.stringify({
      success: true,
      indexed: true,
      projectPath,
      projectHash: meta.projectHash,
      indexDir,
      databaseExists: existsSync(dbPath),
      status: meta.status,
      lastIndexed: meta.lastIndexed,
      hoursSinceIndexing: Math.round(hoursSinceIndexing * 10) / 10,
      needsReindexing,
      patterns: meta.patterns,
      version: meta.version,
      stats: {
        fileCount: stats.fileCount,
        chunkCount: stats.chunkCount,
        embeddingCount: stats.embeddingCount,
        lastIndexed: stats.lastIndexed,
      },
      indexingTimeMs: meta.indexingTimeMs,
      notes: needsReindexing
        ? ['Index is older than 24 hours, consider reindexing for freshness']
        : ['Index is up to date'],
    }, null, 2);

  } catch (error) {
    console.error(`[SemanticSearchMCP] Status error: ${error.message}`);
    return JSON.stringify({
      success: false,
      indexed: true,
      error: 'Failed to get index status',
      message: error.message,
      meta,
    }, null, 2);
  }
}

/**
 * Handle generate_embeddings tool
 * Generates vector embeddings for all indexed chunks
 */
async function handleGenerateEmbeddings(args) {
  const { projectPath, batchSize = 32, force = false } = args;

  console.error(`[SemanticSearchMCP] Generating embeddings for: ${projectPath}`);
  console.error(`[SemanticSearchMCP] Batch size: ${batchSize}, Force: ${force}`);

  const startTime = Date.now();

  // Check if project is indexed
  const meta = loadProjectMeta(projectPath);
  if (!meta) {
    return JSON.stringify({
      success: false,
      error: 'Project not indexed',
      message: `Project at "${projectPath}" has not been indexed yet. Run index_project first.`,
    }, null, 2);
  }

  try {
    // Initialize embeddings model
    console.error('[SemanticSearchMCP] Initializing embedding model...');
    await initEmbeddings({
      onProgress: (percent, message) => {
        console.error(`[SemanticSearchMCP] Model: ${percent}% - ${message}`);
      }
    });

    const db = getDatabase(projectPath);

    // Get all chunks that need embeddings
    let chunks;
    if (force) {
      // Get all chunks
      chunks = db.db.prepare(`
        SELECT c.id, c.name, c.content, c.level, f.path
        FROM chunks c
        JOIN files f ON c.file_id = f.id
      `).all();
    } else {
      // Get only chunks without embeddings
      chunks = db.db.prepare(`
        SELECT c.id, c.name, c.content, c.level, f.path
        FROM chunks c
        JOIN files f ON c.file_id = f.id
        LEFT JOIN embeddings e ON c.id = e.chunk_id
        WHERE e.chunk_id IS NULL
      `).all();
    }

    console.error(`[SemanticSearchMCP] Found ${chunks.length} chunks to process`);

    if (chunks.length === 0) {
      return JSON.stringify({
        success: true,
        message: 'All chunks already have embeddings',
        stats: {
          chunksProcessed: 0,
          timeMs: Date.now() - startTime,
        },
      }, null, 2);
    }

    let embeddingsGenerated = 0;
    let errors = 0;

    // Process in batches
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const contents = batch.map(c => c.content);

      try {
        // Generate embeddings for batch
        const embeddings = await embedBatch(contents, { batchSize });

        // Store embeddings in database
        for (let j = 0; j < batch.length; j++) {
          const chunk = batch[j];
          const embedding = embeddings[j];

          try {
            // Delete existing embedding if force mode
            if (force) {
              db.db.prepare('DELETE FROM embeddings WHERE chunk_id = ?').run(chunk.id);
            }

            db.insertEmbedding(chunk.id, embedding, MODEL_INFO.name, MODEL_INFO.dimensions);
            embeddingsGenerated++;
          } catch (insertError) {
            console.error(`[SemanticSearchMCP] Error storing embedding for chunk ${chunk.id}: ${insertError.message}`);
            errors++;
          }
        }

        // Log progress
        const progress = Math.round(((i + batch.length) / chunks.length) * 100);
        console.error(`[SemanticSearchMCP] Progress: ${progress}% (${i + batch.length}/${chunks.length})`);

      } catch (batchError) {
        console.error(`[SemanticSearchMCP] Batch error: ${batchError.message}`);
        errors += batch.length;
      }
    }

    const elapsedMs = Date.now() - startTime;
    const stats = db.getStats();

    // Update metadata
    meta.embeddingCount = stats.embeddingCount;
    meta.lastEmbeddingsGenerated = new Date().toISOString();
    meta.embeddingModel = MODEL_INFO.name;
    saveProjectMeta(projectPath, meta);

    console.error(`[SemanticSearchMCP] Embeddings complete: ${embeddingsGenerated} generated in ${elapsedMs}ms`);

    return JSON.stringify({
      success: true,
      message: 'Embeddings generation completed',
      stats: {
        chunksProcessed: chunks.length,
        embeddingsGenerated,
        errors,
        timeMs: elapsedMs,
        avgTimePerChunk: Math.round(elapsedMs / chunks.length),
        model: MODEL_INFO.name,
        dimensions: MODEL_INFO.dimensions,
        totalEmbeddings: stats.embeddingCount,
      },
    }, null, 2);

  } catch (error) {
    console.error(`[SemanticSearchMCP] Embeddings error: ${error.message}`);
    return JSON.stringify({
      success: false,
      error: 'Embeddings generation failed',
      message: error.message,
      stack: error.stack,
    }, null, 2);
  }
}

// =============================================================================
// TOOL DEFINITIONS
// =============================================================================

const TOOLS = [
  {
    name: 'semantic_search_code',
    description: 'Search codebase semantically by meaning/intent. Returns relevant code chunks ranked by semantic similarity to your query. Use natural language to describe what you are looking for.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural language search query describing what you are looking for. Example: "function that handles user authentication" or "component that renders the sidebar menu".',
        },
        projectPath: {
          type: 'string',
          description: 'Absolute path to the project root directory to search.',
        },
        level: {
          type: 'string',
          enum: ['file', 'class', 'function', 'all'],
          default: 'all',
          description: 'Granularity level for search results. "file" returns whole files, "class" returns classes/types, "function" returns functions/methods, "all" returns all types.',
        },
        limit: {
          type: 'number',
          default: 10,
          description: 'Maximum number of results to return. Default is 10.',
        },
      },
      required: ['query', 'projectPath'],
    },
  },
  {
    name: 'index_project',
    description: 'Index a project for semantic search. Creates embeddings for all code files matching the specified patterns. This must be run before semantic_search_code can be used.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: {
          type: 'string',
          description: 'Absolute path to the project root directory to index.',
        },
        patterns: {
          type: 'array',
          items: { type: 'string' },
          default: ['**/*.ts', '**/*.tsx', '**/*.js'],
          description: 'Glob patterns for files to include in the index. Default includes TypeScript and JavaScript files.',
        },
      },
      required: ['projectPath'],
    },
  },
  {
    name: 'get_index_status',
    description: 'Get the current indexing status for a project. Shows whether the project is indexed, when it was last indexed, and statistics about the index.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: {
          type: 'string',
          description: 'Absolute path to the project root directory.',
        },
      },
      required: ['projectPath'],
    },
  },
  {
    name: 'generate_embeddings',
    description: 'Generate semantic embeddings for indexed chunks. Run this after index_project to enable true semantic search with vector similarity. This uses a local ML model and may take a few minutes for large projects.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: {
          type: 'string',
          description: 'Absolute path to the project root directory.',
        },
        batchSize: {
          type: 'number',
          default: 32,
          description: 'Number of chunks to process in each batch. Default is 32.',
        },
        force: {
          type: 'boolean',
          default: false,
          description: 'Force regenerate all embeddings, even if they already exist.',
        },
      },
      required: ['projectPath'],
    },
  },
];

// =============================================================================
// MAIN SERVER
// =============================================================================

const server = new Server(
  {
    name: 'semantic-search-tools',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;

    switch (name) {
      case 'semantic_search_code':
        result = await handleSemanticSearchCode(args);
        break;
      case 'index_project':
        result = await handleIndexProject(args);
        break;
      case 'get_index_status':
        result = await handleGetIndexStatus(args);
        break;
      case 'generate_embeddings':
        result = await handleGenerateEmbeddings(args);
        break;
      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }

    return {
      content: [{ type: 'text', text: result }],
    };
  } catch (error) {
    console.error(`[SemanticSearchMCP] Error in ${name}: ${error.message}`);
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[SemanticSearchMCP] Server started');

  // Cleanup handler for graceful shutdown
  process.on('SIGINT', () => {
    console.error('[SemanticSearchMCP] Shutting down...');
    // Close all database connections
    for (const [projectPath, _] of dbConnections) {
      closeDatabase(projectPath);
    }
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.error('[SemanticSearchMCP] Shutting down...');
    // Close all database connections
    for (const [projectPath, _] of dbConnections) {
      closeDatabase(projectPath);
    }
    process.exit(0);
  });
}

main().catch(console.error);
