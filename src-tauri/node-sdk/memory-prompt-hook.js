/**
 * Memory Prompt Hook - Auto Memory Search for SDK 0.2.1
 *
 * ============================================================================
 * IMPORTANT: Uses sql.js (WASM-based) NOT better-sqlite3 (native)
 * ============================================================================
 *
 * Why sql.js?
 * - WASM-based: No native compilation, works with ANY Node.js version
 * - Consistent: Same library as Brain MCP server (~/.quack/mcp/)
 * - Portable: No rebuild needed when switching Node versions
 *
 * Trade-off: sql.js is ~2-3x slower than better-sqlite3, but for our use case
 * (searching ~100 entities max) the difference is negligible (~5ms vs ~2ms).
 *
 * NOTE: sql.js standard build does NOT include FTS5 module!
 * We use LIKE queries instead of FTS5 MATCH. Slightly slower but works.
 * ============================================================================
 *
 * Supports TWO modes:
 * 1. **AI-Powered Semantic Extraction** (NEW, default) - Uses Claude Haiku to extract
 *    semantic concepts from the user's prompt, then searches Brain with those concepts.
 *    Works with ANY language and understands context.
 *
 * 2. **Legacy Keyword Extraction** (fallback) - Uses stopword-based extraction.
 *    Only used if AI extraction fails or is disabled.
 *
 * Flow: User message → AI extracts concepts → Brain FTS search → Format results → Inject in systemPrompt.append
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import initSqlJs from 'sql.js';
import Anthropic from '@anthropic-ai/sdk';

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  maxMemories: 5,           // Maximum number of memories to inject
  minKeywordLength: 3,      // Minimum keyword length
  maxKeywordsToSearch: 8,   // Maximum keywords to use in search
  dbPath: join(homedir(), '.quack', 'brain', 'brain.db'),
  // AI Semantic Extraction settings
  useAiExtraction: false,   // ❌ DISABLED: Anthropic client needs explicit API key when called from Node.js script
  aiModel: 'claude-3-5-haiku-latest', // Fast & cheap model for extraction
  aiMaxTokens: 150,         // Max tokens for extraction response
  aiTimeoutMs: 3000,        // Timeout for AI extraction (fallback to legacy if exceeded)
};

// =============================================================================
// SQL.JS DATABASE CONNECTION (WASM-based, no native compilation needed)
// =============================================================================

/**
 * Database singleton - sql.js requires async initialization
 * Unlike better-sqlite3, sql.js loads the entire DB into memory
 */
let db = null;
let SQL = null;

/**
 * Initialize sql.js WASM module (called once)
 * @returns {Promise<boolean>} True if initialization succeeded
 */
async function initSql() {
  if (SQL) return true;

  try {
    SQL = await initSqlJs();
    console.error('[MemoryHook] sql.js WASM module initialized');
    return true;
  } catch (error) {
    console.error(`[MemoryHook] Failed to initialize sql.js: ${error.message}`);
    return false;
  }
}

/**
 * Get database connection (lazy singleton, async)
 *
 * IMPORTANT: sql.js loads the entire database into memory as a Uint8Array.
 * This is different from better-sqlite3 which uses file handles.
 * For our small Brain DB (~1MB max), this is fine.
 *
 * @returns {Promise<object|null>} Database instance or null if unavailable
 */
async function getDb() {
  if (db) return db;

  if (!existsSync(CONFIG.dbPath)) {
    console.error(`[MemoryHook] Brain database not found at ${CONFIG.dbPath}, skipping memory search`);
    return null;
  }

  try {
    // Initialize sql.js if not done
    const initialized = await initSql();
    if (!initialized) return null;

    // Read database file into memory (sql.js requirement)
    const fileBuffer = readFileSync(CONFIG.dbPath);
    db = new SQL.Database(fileBuffer);

    console.error(`[MemoryHook] Connected to Brain database via sql.js: ${CONFIG.dbPath}`);
    return db;
  } catch (error) {
    console.error(`[MemoryHook] Failed to connect to Brain DB: ${error.message}`);
    return null;
  }
}

// =============================================================================
// ANTHROPIC CLIENT (for AI semantic extraction)
// =============================================================================

let anthropicClient = null;

/**
 * Get Anthropic client (lazy singleton)
 *
 * ❌ ISSUE: Cannot use Claude Code CLI auth from external Node.js script
 *
 * The Anthropic SDK cannot automatically use the Claude Code CLI authenticated session
 * when called from a standalone Node.js script (this memory hook). It requires an explicit
 * API key via ANTHROPIC_API_KEY env var or constructor parameter.
 *
 * **Solution**: Use legacy keyword extraction instead (CONFIG.useAiExtraction = false)
 * The legacy method is fast (~2-5ms), works well, and doesn't require authentication.
 *
 * **Alternative**: If AI extraction is needed in the future, add ANTHROPIC_API_KEY to
 * environment variables, but this adds complexity and API cost.
 */
function getAnthropicClient() {
  if (anthropicClient) return anthropicClient;

  // Pre-check: Skip if AI extraction is disabled (most common case)
  if (!CONFIG.useAiExtraction) {
    // Silent return - don't log anything since this is the expected default behavior
    return null;
  }

  // Pre-check: Verify API key exists before attempting to create client
  if (!process.env.ANTHROPIC_API_KEY) {
    // Only log once, not on every call
    if (!getAnthropicClient._warnedNoKey) {
      console.error('[MemoryHook] ANTHROPIC_API_KEY not set, AI extraction disabled');
      getAnthropicClient._warnedNoKey = true;
    }
    return null;
  }

  try {
    anthropicClient = new Anthropic();
    console.error('[MemoryHook] ✅ Anthropic client initialized');
    return anthropicClient;
  } catch (error) {
    // Only log once
    if (!getAnthropicClient._warnedError) {
      console.error(`[MemoryHook] Anthropic client init failed: ${error.message}`);
      getAnthropicClient._warnedError = true;
    }
    return null;
  }
}

// =============================================================================
// STOP WORDS (for legacy keyword extraction)
// =============================================================================

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
  // Quack-specific words (too generic in this context)
  'quack', 'brain',
]);

// =============================================================================
// AI SEMANTIC EXTRACTION (NEW - Recommended)
// =============================================================================

/**
 * Extract semantic search concepts using Claude Haiku
 * This understands context, handles any language, and extracts meaningful concepts
 *
 * @param {string} prompt - User's message
 * @returns {Promise<string[]>} Array of semantic concepts for Brain search
 */
async function extractSemanticConcepts(prompt) {
  const client = getAnthropicClient();
  if (!client) {
    console.error('[MemoryHook] AI extraction unavailable, using legacy');
    return null; // Will fallback to legacy extraction
  }

  try {
    // Create a promise that rejects after timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('AI extraction timeout')), CONFIG.aiTimeoutMs);
    });

    // AI extraction prompt - optimized for speed and accuracy
    const extractionPromise = client.messages.create({
      model: CONFIG.aiModel,
      max_tokens: CONFIG.aiMaxTokens,
      messages: [{
        role: 'user',
        content: `Extract 2-5 key concepts/topics from this message that would be useful to search in a knowledge base. Return ONLY a JSON array of strings, nothing else.

Message: "${prompt.substring(0, 500)}"

Examples:
- "puoi documentare il lavoro su quack brain" → ["quack brain", "documentation", "architecture"]
- "come funziona l'autenticazione?" → ["authentication", "auth flow", "security"]
- "fix the bug in the dropdown component" → ["dropdown", "bug fix", "component"]

Return only the JSON array:`
      }]
    });

    // Race between extraction and timeout
    const response = await Promise.race([extractionPromise, timeoutPromise]);

    // Parse the response
    const text = response.content[0]?.text?.trim() || '';
    console.error(`[MemoryHook] AI extraction raw response: ${text}`);

    // Try to parse as JSON array
    try {
      // Handle various response formats
      let concepts = [];
      if (text.startsWith('[')) {
        concepts = JSON.parse(text);
      } else {
        // Try to extract array from response
        const match = text.match(/\[.*?\]/s);
        if (match) {
          concepts = JSON.parse(match[0]);
        }
      }

      if (Array.isArray(concepts) && concepts.length > 0) {
        const validConcepts = concepts
          .filter(c => typeof c === 'string' && c.length > 0)
          .slice(0, 5);
        console.error(`[MemoryHook] AI extracted concepts: ${validConcepts.join(', ')}`);
        return validConcepts;
      }
    } catch (parseError) {
      console.error(`[MemoryHook] Failed to parse AI response: ${parseError.message}`);
    }

    return null; // Fallback to legacy
  } catch (error) {
    console.error(`[MemoryHook] AI extraction error: ${error.message}`);
    return null; // Fallback to legacy
  }
}

// =============================================================================
// LEGACY KEYWORD EXTRACTION (Fallback)
// =============================================================================

/**
 * Extract meaningful keywords from user prompt (LEGACY)
 * Filters out stop words and short words
 *
 * Used as fallback when AI extraction fails or is disabled.
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
// SEARCH (using sql.js with LIKE - no FTS5 support in standard sql.js)
// =============================================================================

/**
 * Search Brain database using LIKE queries
 *
 * NOTE: sql.js standard build does NOT include FTS5 module.
 * We use LIKE queries instead, which are slower but work everywhere.
 * For our small database (~100 entities max), performance is acceptable.
 *
 * Alternative: Use sql.js-fts5 fork, but it adds complexity.
 *
 * @param {string[]} keywords - Keywords to search
 * @returns {Promise<object[]>} Array of matching entities with observations
 */
async function searchBrain(keywords) {
  const database = await getDb();
  if (!database) return [];

  if (!keywords || keywords.length === 0) {
    return [];
  }

  try {
    // Build LIKE conditions for each keyword
    // We search in entity name AND in observations content
    const likeConditions = keywords.map((_, i) => `(e.name LIKE ?${i * 2 + 1} OR o.content LIKE ?${i * 2 + 2})`);
    const whereClause = likeConditions.join(' OR ');

    // Prepare parameters: each keyword becomes %keyword% for LIKE
    const params = keywords.flatMap(k => [`%${k}%`, `%${k}%`]);

    console.error(`[MemoryHook] LIKE search for: "${keywords.join(', ')}"`);

    // Search entities with matching name or observations
    // Using DISTINCT because same entity may match multiple keywords
    const query = `
      SELECT DISTINCT e.id, e.name, e.entity_type, e.project_id
      FROM entities e
      LEFT JOIN observations o ON o.entity_id = e.id
      WHERE ${whereClause}
      LIMIT ${CONFIG.maxMemories}
    `;

    const results = database.exec(query, params);

    // sql.js returns [{columns: [...], values: [[...], ...]}]
    if (!results || results.length === 0 || !results[0].values || results[0].values.length === 0) {
      console.error(`[MemoryHook] No results found for keywords: "${keywords.join(', ')}"`);
      return [];
    }

    const columns = results[0].columns;
    const rows = results[0].values;

    // Map column names to indices for easier access
    const idIdx = columns.indexOf('id');
    const nameIdx = columns.indexOf('name');
    const typeIdx = columns.indexOf('entity_type');
    const projectIdx = columns.indexOf('project_id');

    // Get observations for each entity
    const entities = rows.map(row => {
      const entityId = row[idIdx];

      // Get observations for this entity
      const obsResults = database.exec(`
        SELECT content FROM observations
        WHERE entity_id = ?
        ORDER BY created_at DESC
        LIMIT 5
      `, [entityId]);

      const observations = obsResults.length > 0 && obsResults[0].values
        ? obsResults[0].values.map(v => v[0])
        : [];

      return {
        name: row[nameIdx],
        type: row[typeIdx],
        projectId: row[projectIdx],
        observations,
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
 * @property {string[]} keywords - Auto-extracted keywords from prompt
 * @property {string[]} userKeywords - User-selected priority keywords (3x weight)
 * @property {number} durationMs - Search duration in milliseconds
 */

/**
 * Auto Memory Search Hook (v2 - AI-Powered, sql.js)
 *
 * Now uses Claude Haiku to extract semantic concepts from the user's message,
 * then searches Brain with those concepts. Falls back to legacy keyword extraction
 * if AI extraction fails or times out.
 *
 * Flow:
 * 1. Try AI semantic extraction (Claude Haiku, ~500ms)
 * 2. If AI fails/timeout → fallback to legacy keyword extraction
 * 3. Combine with user-selected keywords (3x weight)
 * 4. Search Brain FTS5 via sql.js
 * 5. Return formatted context
 *
 * @param {string} userPrompt - The user's message
 * @param {object} options - Optional configuration
 * @param {boolean} options.enabled - Whether auto search is enabled (default: true)
 * @param {number} options.maxMemories - Override max memories to return
 * @param {string[]} options.userKeywords - User-selected priority keywords (3x weight)
 * @param {string} options.projectName - Project name for contextual scoping (added as first search term)
 * @param {boolean} options.useAi - Override AI extraction setting (default: CONFIG.useAiExtraction)
 * @returns {Promise<MemorySearchResult>} Result with context and memory metadata
 */
export async function autoMemorySearch(userPrompt, options = {}) {
  const { enabled = true, maxMemories, userKeywords = [], projectName, useAi = CONFIG.useAiExtraction } = options;

  const emptyResult = {
    context: '',
    memories: [],
    keywords: [],
    aiConcepts: [],      // AI-extracted concepts
    userKeywords: [],
    durationMs: 0,
    extractionMethod: 'none', // 'ai' | 'legacy' | 'none'
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
    let searchTerms = [];
    let aiConcepts = [];
    let extractionMethod = 'legacy';

    // Step 1: Try AI semantic extraction first (ONLY if explicitly enabled AND client available)
    // NOTE: AI extraction is disabled by default because it requires ANTHROPIC_API_KEY
    // which is not available when running as external Node.js script via Claude Agent SDK
    if (useAi && CONFIG.useAiExtraction) {
      // Double-check: only attempt if explicitly enabled in config
      console.error(`[MemoryHook] Attempting AI semantic extraction...`);
      const concepts = await extractSemanticConcepts(userPrompt);

      if (concepts && concepts.length > 0) {
        aiConcepts = concepts;
        searchTerms = concepts;
        extractionMethod = 'ai';
        console.error(`[MemoryHook] ✅ AI extraction successful: ${concepts.join(', ')}`);
      } else {
        console.error(`[MemoryHook] ⚠️ AI extraction returned no concepts, using legacy`);
      }
    }

    // Step 2: Fallback to legacy keyword extraction if AI failed
    if (searchTerms.length === 0) {
      const autoKeywords = extractKeywords(userPrompt);
      searchTerms = autoKeywords;
      extractionMethod = autoKeywords.length > 0 ? 'legacy' : 'none';
      console.error(`[MemoryHook] Legacy keywords: ${autoKeywords.join(', ')}`);
    }

    // Step 2.5: Prepend projectName as FIRST search term for contextual scoping
    if (projectName && projectName.trim().length > 0) {
      // Add project name at the beginning with 2x weight for context
      searchTerms = [projectName, projectName, ...searchTerms];
      console.error(`[MemoryHook] Project context (2x weight): ${projectName}`);
    }

    // Step 3: Add user-selected keywords with 3x weight
    const uniqueUserKeywords = [...new Set(userKeywords)];
    if (uniqueUserKeywords.length > 0) {
      // User keywords get 3x weight in FTS query
      const weightedUserKeywords = uniqueUserKeywords.flatMap(k => [k, k, k]);
      searchTerms = [...weightedUserKeywords, ...searchTerms];
      console.error(`[MemoryHook] User keywords (3x weight): ${uniqueUserKeywords.join(', ')}`);
    }

    if (searchTerms.length === 0) {
      console.error(`[MemoryHook] No search terms extracted from prompt`);
      return { ...emptyResult, durationMs: Date.now() - startTime, extractionMethod: 'none' };
    }

    // Step 4: Search Brain with combined terms (async because sql.js needs async init)
    const memories = await searchBrain(searchTerms);

    if (memories.length === 0) {
      console.error(`[MemoryHook] No relevant memories found`);
      return {
        ...emptyResult,
        keywords: extractionMethod === 'legacy' ? searchTerms : [],
        aiConcepts,
        userKeywords: uniqueUserKeywords,
        durationMs: Date.now() - startTime,
        extractionMethod,
      };
    }

    // Step 5: Format context
    const context = formatMemoryContext(memories);

    const durationMs = Date.now() - startTime;
    console.error(`[MemoryHook] ✅ Injected ${memories.length} memories in ${durationMs}ms (method: ${extractionMethod})`);

    return {
      context,
      memories,
      keywords: extractionMethod === 'legacy' ? searchTerms.filter(t => !uniqueUserKeywords.includes(t)) : [],
      aiConcepts,
      userKeywords: uniqueUserKeywords,
      durationMs,
      extractionMethod,
    };

  } catch (error) {
    // Graceful fallback: log error and continue without memory context
    console.error(`[MemoryHook] Error in auto memory search: ${error.message}`);
    return { ...emptyResult, durationMs: Date.now() - startTime, extractionMethod: 'error' };
  }
}

/**
 * Close database connection (for cleanup)
 *
 * NOTE: sql.js doesn't have persistent connections like better-sqlite3,
 * but we should still clean up the in-memory database.
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
