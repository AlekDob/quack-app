/**
 * Memory Prompt Hook - Auto Memory Search for SDK 0.2.1
 *
 * Automatically searches the Brain (Second Brain SQLite) before each query
 * and injects relevant context into the system prompt.
 *
 * Flow:
 * User message → Extract keywords → Brain FTS search → Format results → Inject in systemPrompt.append
 */

import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import Database from 'better-sqlite3';

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  maxMemories: 5,           // Maximum number of memories to inject
  minKeywordLength: 3,      // Minimum keyword length
  maxKeywordsToSearch: 8,   // Maximum keywords to use in search
  dbPath: join(homedir(), '.quack', 'brain', 'brain.db'),
};

// Stop words to filter out (common words that don't add search value)
const STOP_WORDS = new Set([
  // English
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of',
  'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have',
  'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may',
  'might', 'must', 'can', 'this', 'that', 'these', 'those', 'it', 'its', 'i',
  'me', 'my', 'we', 'our', 'you', 'your', 'he', 'she', 'they', 'them', 'their',
  'what', 'which', 'who', 'whom', 'when', 'where', 'why', 'how', 'all', 'each',
  'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'not',
  'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'also', 'now',
  'here', 'there', 'then', 'about', 'after', 'before', 'during', 'if', 'into',
  'through', 'under', 'over', 'above', 'below', 'up', 'down', 'out', 'off',
  'again', 'further', 'once', 'any', 'because', 'being', 'between', 'doing',
  'having', 'make', 'made', 'get', 'got', 'getting', 'let', 'want', 'need',
  // Italian (since user is Italian)
  'il', 'la', 'lo', 'le', 'gli', 'un', 'una', 'uno', 'dei', 'delle', 'degli',
  'e', 'ed', 'o', 'ma', 'se', 'per', 'con', 'su', 'da', 'di', 'che', 'chi',
  'come', 'cosa', 'dove', 'quando', 'perche', 'quale', 'quali', 'quanto',
  'non', 'sono', 'essere', 'avere', 'fare', 'questo', 'quello', 'questi',
  'quelli', 'molto', 'poco', 'tutto', 'tutti', 'sempre', 'mai', 'anche',
  // Technical common words (too generic)
  'file', 'code', 'function', 'please', 'help', 'want', 'need', 'use', 'using',
  'create', 'make', 'add', 'update', 'change', 'fix', 'implement', 'write',
]);

// =============================================================================
// DATABASE CONNECTION
// =============================================================================

let db = null;

/**
 * Get database connection (lazy singleton)
 * Returns null if DB doesn't exist (graceful fallback)
 */
function getDb() {
  if (db) return db;

  if (!existsSync(CONFIG.dbPath)) {
    console.error(`[MemoryHook] Brain database not found at ${CONFIG.dbPath}, skipping memory search`);
    return null;
  }

  try {
    db = new Database(CONFIG.dbPath, { readonly: true });
    db.pragma('journal_mode = WAL');
    console.error(`[MemoryHook] Connected to Brain database: ${CONFIG.dbPath}`);
    return db;
  } catch (error) {
    console.error(`[MemoryHook] Failed to connect to Brain DB: ${error.message}`);
    return null;
  }
}

// =============================================================================
// KEYWORD EXTRACTION
// =============================================================================

/**
 * Extract meaningful keywords from user prompt
 * Filters out stop words and short words
 *
 * @param {string} prompt - User's message
 * @returns {string[]} Array of keywords
 */
export function extractKeywords(prompt) {
  if (!prompt || typeof prompt !== 'string') {
    return [];
  }

  // Tokenize: split by non-word characters, convert to lowercase
  const words = prompt
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')  // Replace punctuation with spaces
    .split(/\s+/)               // Split by whitespace
    .filter(word => word.length >= CONFIG.minKeywordLength)  // Min length
    .filter(word => !STOP_WORDS.has(word))  // Remove stop words
    .filter(word => !/^\d+$/.test(word));   // Remove pure numbers

  // Deduplicate and limit
  const uniqueKeywords = [...new Set(words)];

  return uniqueKeywords.slice(0, CONFIG.maxKeywordsToSearch);
}

// =============================================================================
// FTS SEARCH
// =============================================================================

/**
 * Search Brain database using FTS5
 *
 * @param {string[]} keywords - Keywords to search
 * @returns {object[]} Array of matching entities with observations
 */
function searchBrain(keywords) {
  const database = getDb();
  if (!database) return [];

  if (!keywords || keywords.length === 0) {
    return [];
  }

  try {
    // Build FTS5 query: keyword1 OR keyword2 OR keyword3
    const ftsQuery = keywords.join(' OR ');

    console.error(`[MemoryHook] FTS query: "${ftsQuery}"`);

    // Search entities via FTS5
    const results = database.prepare(`
      SELECT e.id, e.name, e.entity_type, e.project_id, rank
      FROM entities e
      JOIN entities_fts fts ON e.rowid = fts.rowid
      WHERE entities_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `).all(ftsQuery, CONFIG.maxMemories);

    if (results.length === 0) {
      console.error(`[MemoryHook] No results found for query: "${ftsQuery}"`);
      return [];
    }

    // Get observations for each entity
    const entities = results.map(r => {
      const observations = database.prepare(`
        SELECT content FROM observations
        WHERE entity_id = ?
        ORDER BY created_at DESC
        LIMIT 5
      `).all(r.id);

      return {
        name: r.name,
        type: r.entity_type,
        projectId: r.project_id,
        observations: observations.map(o => o.content),
      };
    });

    console.error(`[MemoryHook] Found ${entities.length} relevant memories`);

    return entities;
  } catch (error) {
    console.error(`[MemoryHook] Search error: ${error.message}`);
    return [];
  }
}

// =============================================================================
// CONTEXT FORMATTING
// =============================================================================

/**
 * Format search results for injection into system prompt
 *
 * @param {object[]} memories - Array of memory entities
 * @returns {string} Formatted context string
 */
function formatMemoryContext(memories) {
  if (!memories || memories.length === 0) {
    return '';
  }

  let context = '\n\n## Relevant Knowledge from Second Brain\n\n';
  context += 'The following memories may be relevant to this conversation:\n\n';

  for (const memory of memories) {
    context += `### ${memory.name} (${memory.type})\n`;

    if (memory.observations && memory.observations.length > 0) {
      for (const obs of memory.observations) {
        context += `- ${obs}\n`;
      }
    }

    context += '\n';
  }

  context += '---\n';

  return context;
}

// =============================================================================
// MAIN HOOK FUNCTION
// =============================================================================

/**
 * Auto Memory Search Result
 * @typedef {Object} MemorySearchResult
 * @property {string} context - Formatted context to inject in system prompt
 * @property {object[]} memories - Array of found memories with metadata
 * @property {string[]} keywords - Keywords extracted from prompt
 * @property {number} durationMs - Search duration in milliseconds
 */

/**
 * Auto Memory Search Hook
 *
 * Call this before sending a query to Claude.
 * Returns result object with context and metadata about found memories.
 *
 * @param {string} userPrompt - The user's message
 * @param {object} options - Optional configuration
 * @param {boolean} options.enabled - Whether auto search is enabled (default: true)
 * @param {number} options.maxMemories - Override max memories to return
 * @returns {MemorySearchResult} Result with context and memory metadata
 */
export function autoMemorySearch(userPrompt, options = {}) {
  const { enabled = true, maxMemories } = options;

  const emptyResult = {
    context: '',
    memories: [],
    keywords: [],
    durationMs: 0,
  };

  // Skip if disabled
  if (!enabled) {
    console.error(`[MemoryHook] Auto memory search disabled, skipping`);
    return emptyResult;
  }

  // Override config if provided
  if (maxMemories) {
    CONFIG.maxMemories = maxMemories;
  }

  const startTime = Date.now();

  try {
    // Step 1: Extract keywords
    const keywords = extractKeywords(userPrompt);

    if (keywords.length === 0) {
      console.error(`[MemoryHook] No meaningful keywords extracted from prompt`);
      return { ...emptyResult, durationMs: Date.now() - startTime };
    }

    console.error(`[MemoryHook] Keywords: ${keywords.join(', ')}`);

    // Step 2: Search Brain
    const memories = searchBrain(keywords);

    if (memories.length === 0) {
      console.error(`[MemoryHook] No relevant memories found`);
      return { ...emptyResult, keywords, durationMs: Date.now() - startTime };
    }

    // Step 3: Format context
    const context = formatMemoryContext(memories);

    const durationMs = Date.now() - startTime;
    console.error(`[MemoryHook] Injected ${memories.length} memories in ${durationMs}ms`);

    return {
      context,
      memories,
      keywords,
      durationMs,
    };

  } catch (error) {
    // Graceful fallback: log error and continue without memory context
    console.error(`[MemoryHook] Error in auto memory search: ${error.message}`);
    return { ...emptyResult, durationMs: Date.now() - startTime };
  }
}

/**
 * Close database connection (for cleanup)
 */
export function closeDb() {
  if (db) {
    db.close();
    db = null;
    console.error(`[MemoryHook] Database connection closed`);
  }
}

// Export for testing
export { CONFIG, STOP_WORDS, searchBrain, formatMemoryContext };
