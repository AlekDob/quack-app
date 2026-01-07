// semantic-db.js - SQLite database module for semantic code search
// Based on Pommel architecture, optimized for vector search

import Database from 'better-sqlite3';
import { createHash } from 'crypto';
import { join, dirname } from 'path';
import { existsSync, mkdirSync } from 'fs';

/**
 * SemanticDatabase - Manages SQLite storage for code chunks and embeddings
 *
 * Features:
 * - File and chunk tracking with hierarchical structure
 * - Embedding storage (BLOB for now, sqlite-vec ready)
 * - Full-text search via FTS5
 * - Cosine similarity search in pure JS
 */
export class SemanticDatabase {
    /**
     * @param {string} dbPath - Path to SQLite database file
     * @param {object} options - Database options
     * @param {boolean} options.verbose - Enable SQL logging
     * @param {boolean} options.readonly - Open in readonly mode
     */
    constructor(dbPath, options = {}) {
        // Ensure directory exists
        const dir = dirname(dbPath);
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
        }

        this.dbPath = dbPath;
        this.db = new Database(dbPath, {
            verbose: options.verbose ? console.log : undefined,
            readonly: options.readonly || false
        });

        // Enable WAL mode for better concurrency
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('synchronous = NORMAL');
        this.db.pragma('foreign_keys = ON');

        // Initialize schema
        this._initSchema();

        // Prepare statements for performance
        this._prepareStatements();
    }

    /**
     * Initialize database schema
     * @private
     */
    _initSchema() {
        // Files table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                path TEXT NOT NULL UNIQUE,
                content_hash TEXT,
                language TEXT,
                size INTEGER,
                modified_at INTEGER,
                indexed_at INTEGER
            );
        `);

        // Chunks table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS chunks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_id INTEGER NOT NULL,
                level TEXT NOT NULL CHECK(level IN ('file', 'class', 'function', 'method')),
                name TEXT,
                start_line INTEGER,
                end_line INTEGER,
                content TEXT,
                content_hash TEXT,
                parent_id INTEGER,
                FOREIGN KEY(file_id) REFERENCES files(id) ON DELETE CASCADE,
                FOREIGN KEY(parent_id) REFERENCES chunks(id) ON DELETE SET NULL
            );
        `);

        // Embeddings table (BLOB storage for Float32Array)
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS embeddings (
                chunk_id INTEGER PRIMARY KEY,
                vector BLOB NOT NULL,
                model TEXT NOT NULL,
                dimensions INTEGER NOT NULL,
                FOREIGN KEY(chunk_id) REFERENCES chunks(id) ON DELETE CASCADE
            );
        `);

        // Full-text search virtual table
        this.db.exec(`
            CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
                content,
                name,
                content='chunks',
                content_rowid='id',
                tokenize='porter unicode61'
            );
        `);

        // Indexes for performance
        this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_files_path ON files(path);
            CREATE INDEX IF NOT EXISTS idx_files_hash ON files(content_hash);
            CREATE INDEX IF NOT EXISTS idx_chunks_file ON chunks(file_id);
            CREATE INDEX IF NOT EXISTS idx_chunks_level ON chunks(level);
            CREATE INDEX IF NOT EXISTS idx_chunks_parent ON chunks(parent_id);
            CREATE INDEX IF NOT EXISTS idx_embeddings_model ON embeddings(model);
        `);

        // Triggers to keep FTS in sync
        this.db.exec(`
            CREATE TRIGGER IF NOT EXISTS chunks_fts_insert AFTER INSERT ON chunks BEGIN
                INSERT INTO chunks_fts(rowid, content, name)
                VALUES (new.id, new.content, COALESCE(new.name, ''));
            END;

            CREATE TRIGGER IF NOT EXISTS chunks_fts_update AFTER UPDATE ON chunks BEGIN
                UPDATE chunks_fts
                SET content = new.content, name = COALESCE(new.name, '')
                WHERE rowid = new.id;
            END;

            CREATE TRIGGER IF NOT EXISTS chunks_fts_delete AFTER DELETE ON chunks BEGIN
                DELETE FROM chunks_fts WHERE rowid = old.id;
            END;
        `);
    }

    /**
     * Prepare frequently used statements
     * @private
     */
    _prepareStatements() {
        // File operations
        this.stmts = {
            upsertFile: this.db.prepare(`
                INSERT INTO files (path, content_hash, language, size, modified_at, indexed_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(path) DO UPDATE SET
                    content_hash = excluded.content_hash,
                    language = excluded.language,
                    size = excluded.size,
                    modified_at = excluded.modified_at,
                    indexed_at = excluded.indexed_at
                RETURNING id
            `),

            getFile: this.db.prepare('SELECT * FROM files WHERE path = ?'),
            getFileById: this.db.prepare('SELECT * FROM files WHERE id = ?'),
            deleteFile: this.db.prepare('DELETE FROM files WHERE path = ?'),
            getAllFiles: this.db.prepare('SELECT * FROM files ORDER BY path'),

            // Chunk operations
            insertChunk: this.db.prepare(`
                INSERT INTO chunks (file_id, level, name, start_line, end_line, content, content_hash, parent_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                RETURNING id
            `),

            getChunksForFile: this.db.prepare(`
                SELECT * FROM chunks WHERE file_id = ? ORDER BY start_line
            `),

            getChunkById: this.db.prepare('SELECT * FROM chunks WHERE id = ?'),

            deleteChunksForFile: this.db.prepare('DELETE FROM chunks WHERE file_id = ?'),

            // Embedding operations
            insertEmbedding: this.db.prepare(`
                INSERT INTO embeddings (chunk_id, vector, model, dimensions)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(chunk_id) DO UPDATE SET
                    vector = excluded.vector,
                    model = excluded.model,
                    dimensions = excluded.dimensions
            `),

            getEmbedding: this.db.prepare('SELECT * FROM embeddings WHERE chunk_id = ?'),

            getAllEmbeddings: this.db.prepare(`
                SELECT e.chunk_id, e.vector, e.model, e.dimensions,
                       c.name, c.level, c.content,
                       f.path
                FROM embeddings e
                JOIN chunks c ON e.chunk_id = c.id
                JOIN files f ON c.file_id = f.id
            `),

            // Stats
            getStats: this.db.prepare(`
                SELECT
                    (SELECT COUNT(*) FROM files) as file_count,
                    (SELECT COUNT(*) FROM chunks) as chunk_count,
                    (SELECT COUNT(*) FROM embeddings) as embedding_count,
                    (SELECT MAX(indexed_at) FROM files) as last_indexed
            `)
        };
    }

    // ============================================================================
    // FILE OPERATIONS
    // ============================================================================

    /**
     * Insert or update a file record
     * @param {string} path - File path
     * @param {string} contentHash - SHA256 hash of content
     * @param {string} language - Language identifier (e.g., 'typescript', 'javascript')
     * @param {number} size - File size in bytes
     * @param {number} modifiedAt - Last modified timestamp (ms)
     * @returns {number} File ID
     */
    upsertFile(path, contentHash, language, size, modifiedAt = Date.now()) {
        const indexedAt = Date.now();
        const result = this.stmts.upsertFile.get(path, contentHash, language, size, modifiedAt, indexedAt);
        return result.id;
    }

    /**
     * Get file record by path
     * @param {string} path - File path
     * @returns {object|null} File record or null
     */
    getFile(path) {
        return this.stmts.getFile.get(path) || null;
    }

    /**
     * Get file record by ID
     * @param {number} fileId - File ID
     * @returns {object|null} File record or null
     */
    getFileById(fileId) {
        return this.stmts.getFileById.get(fileId) || null;
    }

    /**
     * Delete file and all associated chunks/embeddings (CASCADE)
     * @param {string} path - File path
     * @returns {boolean} True if deleted
     */
    deleteFile(path) {
        const result = this.stmts.deleteFile.run(path);
        return result.changes > 0;
    }

    /**
     * Get all files
     * @returns {Array} Array of file records
     */
    getAllFiles() {
        return this.stmts.getAllFiles.all();
    }

    // ============================================================================
    // CHUNK OPERATIONS
    // ============================================================================

    /**
     * Insert a code chunk
     * @param {number} fileId - File ID
     * @param {string} level - Chunk level: 'file' | 'class' | 'function' | 'method'
     * @param {string} name - Chunk name (e.g., function name)
     * @param {number} startLine - Start line number
     * @param {number} endLine - End line number
     * @param {string} content - Chunk content
     * @param {number|null} parentId - Parent chunk ID (for nesting)
     * @returns {number} Chunk ID
     */
    insertChunk(fileId, level, name, startLine, endLine, content, parentId = null) {
        const contentHash = this._hashContent(content);
        const result = this.stmts.insertChunk.get(
            fileId, level, name, startLine, endLine, content, contentHash, parentId
        );
        return result.id;
    }

    /**
     * Get all chunks for a file
     * @param {number} fileId - File ID
     * @returns {Array} Array of chunk records
     */
    getChunksForFile(fileId) {
        return this.stmts.getChunksForFile.all(fileId);
    }

    /**
     * Get chunk by ID
     * @param {number} chunkId - Chunk ID
     * @returns {object|null} Chunk record or null
     */
    getChunkById(chunkId) {
        return this.stmts.getChunkById.get(chunkId) || null;
    }

    /**
     * Delete all chunks for a file (CASCADE)
     * @param {number} fileId - File ID
     * @returns {number} Number of chunks deleted
     */
    deleteChunksForFile(fileId) {
        const result = this.stmts.deleteChunksForFile.run(fileId);
        return result.changes;
    }

    // ============================================================================
    // EMBEDDING OPERATIONS
    // ============================================================================

    /**
     * Insert or update an embedding
     * @param {number} chunkId - Chunk ID
     * @param {Float32Array} vector - Embedding vector
     * @param {string} model - Model name (e.g., 'all-MiniLM-L6-v2')
     * @param {number} dimensions - Vector dimensions
     */
    insertEmbedding(chunkId, vector, model, dimensions) {
        const blob = serializeVector(vector);
        this.stmts.insertEmbedding.run(chunkId, blob, model, dimensions);
    }

    /**
     * Get embedding for a chunk
     * @param {number} chunkId - Chunk ID
     * @returns {object|null} {chunk_id, vector: Float32Array, model, dimensions}
     */
    getEmbedding(chunkId) {
        const row = this.stmts.getEmbedding.get(chunkId);
        if (!row) return null;

        return {
            chunk_id: row.chunk_id,
            vector: deserializeVector(row.vector),
            model: row.model,
            dimensions: row.dimensions
        };
    }

    /**
     * Get all embeddings with chunk metadata
     * @returns {Array} Array of {chunk_id, vector, model, dimensions, name, level, content, path}
     */
    getAllEmbeddings() {
        const rows = this.stmts.getAllEmbeddings.all();
        return rows.map(row => ({
            chunk_id: row.chunk_id,
            vector: deserializeVector(row.vector),
            model: row.model,
            dimensions: row.dimensions,
            name: row.name,
            level: row.level,
            content: row.content,
            path: row.path
        }));
    }

    // ============================================================================
    // SEARCH OPERATIONS
    // ============================================================================

    /**
     * Full-text search using FTS5
     * @param {string} query - Search query (FTS5 syntax supported)
     * @param {number} limit - Max results
     * @returns {Array} Array of {chunk, file, rank}
     */
    searchFTS(query, limit = 10) {
        const stmt = this.db.prepare(`
            SELECT
                c.*,
                f.path,
                f.language,
                fts.rank as fts_rank
            FROM chunks_fts fts
            JOIN chunks c ON fts.rowid = c.id
            JOIN files f ON c.file_id = f.id
            WHERE chunks_fts MATCH ?
            ORDER BY rank
            LIMIT ?
        `);

        return stmt.all(query, limit);
    }

    /**
     * Vector similarity search using cosine similarity
     * @param {Float32Array} queryVector - Query embedding
     * @param {number} limit - Max results
     * @param {string|null} levelFilter - Filter by chunk level
     * @returns {Array} Array of {chunk_id, score, chunk, file}
     */
    searchVector(queryVector, limit = 10, levelFilter = null) {
        // Get all embeddings (TODO: optimize with sqlite-vec)
        const embeddings = this.getAllEmbeddings();

        // Calculate cosine similarity for each
        const results = embeddings.map(emb => ({
            chunk_id: emb.chunk_id,
            score: cosineSimilarity(queryVector, emb.vector),
            name: emb.name,
            level: emb.level,
            content: emb.content,
            path: emb.path
        }));

        // Filter by level if specified
        const filtered = levelFilter
            ? results.filter(r => r.level === levelFilter)
            : results;

        // Sort by score descending and limit
        return filtered
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }

    /**
     * Hybrid search combining vector and FTS
     * Uses Reciprocal Rank Fusion (RRF) to merge results
     * @param {string} query - Text query
     * @param {Float32Array} queryVector - Query embedding
     * @param {number} limit - Max results
     * @param {number} k - RRF constant (default: 60)
     * @returns {Array} Array of {chunk_id, score, rrf_score, chunk, file}
     */
    searchHybrid(query, queryVector, limit = 10, k = 60) {
        // Get vector results (fetch 2x for better RRF)
        const vectorResults = this.searchVector(queryVector, limit * 2);

        // Get FTS results (fetch 2x for better RRF)
        const ftsResults = this.searchFTS(query, limit * 2);

        // Build RRF scores
        const rrf = new Map();

        // Add vector results
        vectorResults.forEach((result, rank) => {
            const score = 1.0 / (k + rank + 1);
            rrf.set(result.chunk_id, {
                chunk_id: result.chunk_id,
                vector_score: result.score,
                vector_rank: rank + 1,
                rrf_score: score,
                name: result.name,
                level: result.level,
                content: result.content,
                path: result.path
            });
        });

        // Add FTS results
        ftsResults.forEach((result, rank) => {
            const score = 1.0 / (k + rank + 1);
            const existing = rrf.get(result.id);

            if (existing) {
                // Combine scores
                existing.rrf_score += score;
                existing.fts_rank = rank + 1;
            } else {
                // New result from FTS only
                rrf.set(result.id, {
                    chunk_id: result.id,
                    fts_rank: rank + 1,
                    rrf_score: score,
                    name: result.name,
                    level: result.level,
                    content: result.content,
                    path: result.path
                });
            }
        });

        // Sort by RRF score and limit
        return Array.from(rrf.values())
            .sort((a, b) => b.rrf_score - a.rrf_score)
            .slice(0, limit);
    }

    // ============================================================================
    // BATCH OPERATIONS
    // ============================================================================

    /**
     * Reindex a file (delete old chunks + insert new)
     * @param {number} fileId - File ID
     * @param {Array} chunks - Array of chunk objects
     * @returns {Array} Array of chunk IDs
     */
    reindexFile(fileId, chunks) {
        return this.db.transaction(() => {
            // Delete old chunks
            this.deleteChunksForFile(fileId);

            // Insert new chunks
            const chunkIds = chunks.map(chunk => {
                return this.insertChunk(
                    fileId,
                    chunk.level,
                    chunk.name,
                    chunk.start_line,
                    chunk.end_line,
                    chunk.content,
                    chunk.parent_id
                );
            });

            return chunkIds;
        })();
    }

    /**
     * Batch insert embeddings (transactional)
     * @param {Array} embeddings - Array of {chunk_id, vector, model, dimensions}
     */
    batchInsertEmbeddings(embeddings) {
        this.db.transaction(() => {
            for (const emb of embeddings) {
                this.insertEmbedding(emb.chunk_id, emb.vector, emb.model, emb.dimensions);
            }
        })();
    }

    // ============================================================================
    // STATS & MAINTENANCE
    // ============================================================================

    /**
     * Get database statistics
     * @returns {object} {fileCount, chunkCount, embeddingCount, lastIndexed}
     */
    getStats() {
        const stats = this.stmts.getStats.get();
        return {
            fileCount: stats.file_count,
            chunkCount: stats.chunk_count,
            embeddingCount: stats.embedding_count,
            lastIndexed: stats.last_indexed
        };
    }

    /**
     * Check if a file needs reindexing
     * @param {string} path - File path
     * @param {string} currentHash - Current content hash
     * @returns {boolean} True if file needs reindexing
     */
    needsReindexing(path, currentHash) {
        const file = this.getFile(path);
        return !file || file.content_hash !== currentHash;
    }

    /**
     * Vacuum database to reclaim space
     */
    vacuum() {
        this.db.exec('VACUUM');
    }

    /**
     * Optimize FTS index
     */
    optimizeFTS() {
        this.db.exec("INSERT INTO chunks_fts(chunks_fts) VALUES('optimize')");
    }

    /**
     * Close database connection
     */
    close() {
        this.db.close();
    }

    // ============================================================================
    // PRIVATE HELPERS
    // ============================================================================

    /**
     * Calculate SHA256 hash of content
     * @private
     * @param {string} content - Content to hash
     * @returns {string} Hex hash
     */
    _hashContent(content) {
        return createHash('sha256').update(content).digest('hex');
    }
}

// ============================================================================
// VECTOR UTILITIES
// ============================================================================

/**
 * Calculate cosine similarity between two vectors
 * @param {Float32Array} a - First vector
 * @param {Float32Array} b - Second vector
 * @returns {number} Similarity score [0, 1]
 */
export function cosineSimilarity(a, b) {
    if (a.length !== b.length) {
        throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);

    if (magnitude === 0) return 0;

    return dotProduct / magnitude;
}

/**
 * Serialize Float32Array to Buffer for SQLite BLOB storage
 * @param {Float32Array} vector - Vector to serialize
 * @returns {Buffer} Serialized vector
 */
export function serializeVector(vector) {
    return Buffer.from(vector.buffer);
}

/**
 * Deserialize Buffer to Float32Array
 * @param {Buffer} blob - Serialized vector
 * @returns {Float32Array} Deserialized vector
 */
export function deserializeVector(blob) {
    return new Float32Array(blob.buffer, blob.byteOffset, blob.byteLength / 4);
}

/**
 * Calculate L2 (Euclidean) distance between two vectors
 * @param {Float32Array} a - First vector
 * @param {Float32Array} b - Second vector
 * @returns {number} L2 distance
 */
export function euclideanDistance(a, b) {
    if (a.length !== b.length) {
        throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
    }

    let sum = 0;
    for (let i = 0; i < a.length; i++) {
        const diff = a[i] - b[i];
        sum += diff * diff;
    }

    return Math.sqrt(sum);
}

/**
 * Normalize vector to unit length (for cosine similarity)
 * @param {Float32Array} vector - Vector to normalize
 * @returns {Float32Array} Normalized vector
 */
export function normalizeVector(vector) {
    let norm = 0;
    for (let i = 0; i < vector.length; i++) {
        norm += vector[i] * vector[i];
    }

    norm = Math.sqrt(norm);

    if (norm === 0) return vector;

    const normalized = new Float32Array(vector.length);
    for (let i = 0; i < vector.length; i++) {
        normalized[i] = vector[i] / norm;
    }

    return normalized;
}
