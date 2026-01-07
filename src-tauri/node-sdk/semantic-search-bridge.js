#!/usr/bin/env node
/**
 * Bridge script for semantic search Tauri commands
 * This script can be called directly from Rust to execute semantic search operations
 */

import { SemanticDatabase } from './lib/semantic-db.js';
import { parseFile, detectLanguage } from './lib/code-chunker.js';
import { embed, embedBatch, embedQuery, initEmbeddings, MODEL_INFO } from './lib/embeddings.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { homedir, platform } from 'os';
import { createHash } from 'crypto';
import { glob } from 'glob';

// Storage path utilities
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

function getCodeIndexPath() {
  return join(getTauriStorePath(), 'code-index');
}

function hashProjectPath(projectPath) {
  return createHash('sha256').update(projectPath).digest('hex').substring(0, 16);
}

function getProjectIndexPath(projectPath) {
  const hash = hashProjectPath(projectPath);
  return join(getCodeIndexPath(), hash);
}

function ensureProjectIndexDir(projectPath) {
  const indexDir = getProjectIndexPath(projectPath);
  if (!existsSync(indexDir)) {
    mkdirSync(indexDir, { recursive: true });
  }
  return indexDir;
}

function loadProjectMeta(projectPath) {
  try {
    const metaPath = join(getProjectIndexPath(projectPath), 'meta.json');
    if (!existsSync(metaPath)) return null;
    return JSON.parse(readFileSync(metaPath, 'utf8'));
  } catch (error) {
    console.error(`Error loading meta: ${error.message}`);
    return null;
  }
}

function saveProjectMeta(projectPath, meta) {
  const indexDir = ensureProjectIndexDir(projectPath);
  const metaPath = join(indexDir, 'meta.json');
  writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');
}

function hashContent(content) {
  return createHash('sha256').update(content).digest('hex');
}

function getDatabase(projectPath) {
  const indexDir = ensureProjectIndexDir(projectPath);
  const dbPath = join(indexDir, 'index.db');
  return new SemanticDatabase(dbPath);
}

// Main CLI
const command = process.argv[2];
const argsJson = process.argv[3];

if (!command || !argsJson) {
  console.error('Usage: semantic-search-bridge.js <command> <args-json>');
  process.exit(1);
}

const args = JSON.parse(argsJson);

(async () => {
  try {
    let result;

    switch (command) {
      case 'index_project':
        result = await indexProject(args);
        break;
      case 'search_code':
        result = await searchCode(args);
        break;
      case 'get_status':
        result = await getStatus(args);
        break;
      case 'generate_embeddings':
        result = await generateEmbeddings(args);
        break;
      default:
        throw new Error(`Unknown command: ${command}`);
    }

    console.log(JSON.stringify(result));
    process.exit(0);
  } catch (error) {
    console.error(JSON.stringify({ success: false, error: error.message, stack: error.stack }));
    process.exit(1);
  }
})();

async function indexProject(args) {
  const { projectPath, patterns = ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'] } = args;

  const startTime = Date.now();

  if (!existsSync(projectPath)) {
    throw new Error(`Project path does not exist: ${projectPath}`);
  }

  const db = getDatabase(projectPath);
  const files = await glob(patterns, {
    cwd: projectPath,
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**'],
    absolute: false,
    nodir: true,
  });

  let filesIndexed = 0;
  let chunksCreated = 0;

  for (const relPath of files) {
    const absPath = join(projectPath, relPath);
    const content = readFileSync(absPath, 'utf8');
    const contentHash = hashContent(content);
    const stats = statSync(absPath);

    if (!db.needsReindexing(relPath, contentHash)) {
      continue;
    }

    const fileId = db.upsertFile(relPath, contentHash, detectLanguage(relPath), stats.size, stats.mtimeMs);
    db.deleteChunksForFile(fileId);

    let chunks = [];
    try {
      chunks = parseFile(relPath, content);
    } catch (parseError) {
      console.error(`Parse error ${relPath}: ${parseError.message}`);
    }

    if (chunks.length === 0) {
      db.insertChunk(fileId, 'file', relPath, 1, content.split('\n').length, content, null);
      chunksCreated++;
    } else {
      for (const chunk of chunks) {
        db.insertChunk(fileId, chunk.level, chunk.name, chunk.startLine, chunk.endLine, chunk.content, null);
        chunksCreated++;
      }
    }

    filesIndexed++;
  }

  const stats = db.getStats();
  const elapsedMs = Date.now() - startTime;

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
  db.close();

  return {
    success: true,
    message: 'Project indexing completed successfully',
    stats: {
      filesIndexed,
      chunksCreated,
      totalFileCount: stats.fileCount,
      totalChunkCount: stats.chunkCount,
      indexingTimeMs: elapsedMs,
    },
  };
}

async function searchCode(args) {
  const { query, projectPath, level = 'all', limit = 10 } = args;

  const meta = loadProjectMeta(projectPath);
  if (!meta) {
    throw new Error('Project not indexed');
  }

  const db = getDatabase(projectPath);
  const stats = db.getStats();

  let results;
  let searchMode = 'fts';

  if (stats.embeddingCount > 0) {
    try {
      await initEmbeddings();
      const queryVector = await embedQuery(query);
      results = db.searchHybrid(query, queryVector, limit);
      searchMode = 'hybrid';
    } catch (error) {
      results = db.searchFTS(query, limit);
    }
  } else {
    results = db.searchFTS(query, limit);
  }

  const formattedResults = results.map(r => ({
    type: r.level,
    name: r.name || r.path,
    file: r.path,
    startLine: r.start_line,
    endLine: r.end_line,
    content: r.content.substring(0, 500),
    score: searchMode === 'hybrid' ? r.rrf_score : Math.abs(r.fts_rank || 0),
    matchType: searchMode,
    language: r.language,
  }));

  db.close();

  return {
    success: true,
    query,
    searchMode,
    results: formattedResults,
    stats: {
      returnedResults: formattedResults.length,
      indexStatus: {
        fileCount: stats.fileCount,
        chunkCount: stats.chunkCount,
        embeddingCount: stats.embeddingCount,
      },
    },
  };
}

async function getStatus(args) {
  const { projectPath } = args;

  const meta = loadProjectMeta(projectPath);
  if (!meta) {
    return {
      success: true,
      indexed: false,
      message: 'Project has not been indexed yet',
    };
  }

  const db = getDatabase(projectPath);
  const stats = db.getStats();
  db.close();

  return {
    success: true,
    indexed: true,
    lastIndexed: meta.lastIndexed,
    stats: {
      fileCount: stats.fileCount,
      chunkCount: stats.chunkCount,
      embeddingCount: stats.embeddingCount,
    },
  };
}

async function generateEmbeddings(args) {
  const { projectPath, batchSize = 32, force = false } = args;

  const meta = loadProjectMeta(projectPath);
  if (!meta) {
    throw new Error('Project not indexed');
  }

  await initEmbeddings();

  const db = getDatabase(projectPath);
  const chunks = db.db.prepare(`
    SELECT c.id, c.content
    FROM chunks c
    LEFT JOIN embeddings e ON c.id = e.chunk_id
    WHERE ${force ? '1=1' : 'e.chunk_id IS NULL'}
  `).all();

  if (chunks.length === 0) {
    db.close();
    return {
      success: true,
      message: 'All chunks already have embeddings',
      stats: { chunksProcessed: 0 },
    };
  }

  let embeddingsGenerated = 0;

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const embeddings = await embedBatch(batch.map(c => c.content), { batchSize });

    for (let j = 0; j < batch.length; j++) {
      if (force) {
        db.db.prepare('DELETE FROM embeddings WHERE chunk_id = ?').run(batch[j].id);
      }
      db.insertEmbedding(batch[j].id, embeddings[j], MODEL_INFO.name, MODEL_INFO.dimensions);
      embeddingsGenerated++;
    }
  }

  const stats = db.getStats();
  meta.embeddingCount = stats.embeddingCount;
  meta.lastEmbeddingsGenerated = new Date().toISOString();
  saveProjectMeta(projectPath, meta);

  db.close();

  return {
    success: true,
    message: 'Embeddings generation completed',
    stats: {
      chunksProcessed: chunks.length,
      embeddingsGenerated,
      totalEmbeddings: stats.embeddingCount,
    },
  };
}
