#!/usr/bin/env node

/**
 * Brain MCP Server (stdio-based)
 *
 * This is a standalone MCP server that provides Quack Brain knowledge graph tools.
 * It communicates with the Tauri backend via HTTP for Brain operations.
 *
 * Tools provided:
 * - brain_search: Search entities in the knowledge graph
 * - brain_create_entity: Create a new entity with observations
 * - brain_add_observation: Add an observation to an existing entity
 * - brain_get_graph: Get the full knowledge graph
 * - brain_create_relation: Create a relation between entities
 *
 * Storage:
 * ~/.quack/brain/brain.db (SQLite managed by Tauri backend)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import Database from 'better-sqlite3';

// =============================================================================
// DATABASE CONNECTION
// =============================================================================

/**
 * Get the Brain database path
 */
function getBrainDbPath() {
  return join(homedir(), '.quack', 'brain', 'brain.db');
}

/**
 * Get database connection (lazy singleton)
 */
let db = null;

function getDb() {
  if (!db) {
    const dbPath = getBrainDbPath();
    if (!existsSync(dbPath)) {
      throw new Error(`Brain database not found at ${dbPath}. Please open Quack app first to initialize the database.`);
    }
    console.error(`[BrainMCP] Opening database: ${dbPath}`);
    db = new Database(dbPath, { readonly: false });
    db.pragma('journal_mode = WAL');
  }
  return db;
}

// =============================================================================
// SETTINGS & AUTO-SYNC
// =============================================================================

/**
 * Get a setting from brain_settings table
 */
function getSetting(key, defaultValue = '') {
  try {
    const db = getDb();
    const row = db.prepare('SELECT value FROM brain_settings WHERE key = ?').get(key);
    return row ? row.value : defaultValue;
  } catch (error) {
    console.error(`[BrainMCP] Error getting setting ${key}:`, error.message);
    return defaultValue;
  }
}

/**
 * Check if auto-sync to vault is enabled
 * Returns true only if ALL conditions are met:
 * 1. sync_enabled = 'true'
 * 2. auto_sync_to_vault = 'true'
 * 3. vault_path is non-empty
 */
function shouldAutoSyncToVault() {
  const syncEnabledRaw = getSetting('sync_enabled', 'false');
  const autoSyncRaw = getSetting('auto_sync_to_vault', 'false');
  const vaultPath = getSetting('vault_path', '');

  const syncEnabled = syncEnabledRaw === 'true';
  const autoSyncToVault = autoSyncRaw === 'true';
  const hasVaultPath = vaultPath.length > 0;

  // Detailed logging for debugging
  console.error(`[BrainMCP] === AUTO-SYNC CHECK ===`);
  console.error(`[BrainMCP]   sync_enabled: raw="${syncEnabledRaw}" => ${syncEnabled}`);
  console.error(`[BrainMCP]   auto_sync_to_vault: raw="${autoSyncRaw}" => ${autoSyncToVault}`);
  console.error(`[BrainMCP]   vault_path: "${vaultPath}" => hasPath=${hasVaultPath}`);

  const result = syncEnabled && autoSyncToVault && hasVaultPath;
  console.error(`[BrainMCP]   RESULT: ${result ? 'WILL SYNC' : 'WILL NOT SYNC'}`);
  console.error(`[BrainMCP] === END CHECK ===`);

  return result;
}

/**
 * Get the markdown directory path based on settings
 */
function getMarkdownDir() {
  const vaultPath = getSetting('vault_path', '');
  if (!vaultPath) {
    return join(homedir(), '.quack', 'brain', 'markdown');
  }

  const syncStructure = getSetting('sync_structure', 'subfolder');
  if (syncStructure === 'subfolder') {
    return join(vaultPath, 'QuackBrain');
  }
  return vaultPath;
}

/**
 * Sync an entity to markdown file (new Obsidian schema)
 */
function syncEntityToMarkdown(entity) {
  if (!shouldAutoSyncToVault()) {
    console.error('[BrainMCP] Auto-sync disabled, skipping markdown creation');
    return null;
  }

  try {
    const vaultPath = getVaultPath();
    if (!vaultPath) {
      console.error('[BrainMCP] No vault path configured, skipping markdown sync');
      return null;
    }

    const today = getTodayDate();
    const date = entity.date || today;

    // Determine folder based on tag and project
    const tagFolder = getTagFolder(entity.entityType);
    let filePath;

    if (entity.entityType === 'diary') {
      // Diary entries go directly to diary folder
      filePath = join(vaultPath, 'QuackBrain', 'diary', `${date}.md`);
    } else if (entity.entityType === 'project') {
      // Project main file goes in projects/{project-name}/{project-name}.md
      const projectName = slugify(entity.name);
      filePath = join(vaultPath, 'QuackBrain', 'projects', projectName, `${projectName}.md`);
    } else if (entity.entityType === 'human' || !entity.projectId) {
      // Global entities (human or no project)
      if (tagFolder) {
        filePath = join(vaultPath, 'QuackBrain', 'global', tagFolder, `${slugify(entity.name)}.md`);
      } else {
        filePath = join(vaultPath, 'QuackBrain', 'global', `${slugify(entity.name)}.md`);
      }
    } else {
      // Project-scoped entities
      if (tagFolder) {
        filePath = join(vaultPath, 'QuackBrain', 'projects', entity.projectId, tagFolder, `${slugify(entity.name)}.md`);
      } else {
        filePath = join(vaultPath, 'QuackBrain', 'projects', entity.projectId, `${slugify(entity.name)}.md`);
      }
    }

    // Ensure directory exists
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Build markdown content with new schema
    // - Tag moved to body as #hashtag
    // - Date as WikiLink
    // - No H1 title (Obsidian shows filename)
    let md = '---\n';
    md += `id: "${entity.id}"\n`;

    if (entity.projectId) {
      md += `project: ${entity.projectId}\n`;
    }
    if (entity.sourceFile) {
      md += `file: ${entity.sourceFile}\n`;
    }

    // Date as WikiLink for Obsidian linking
    md += `date: "[[${date}]]"\n`;

    if (entity.author) {
      md += `author: ${entity.author}\n`;
    } else {
      md += `author: claude\n`;  // Default author
    }
    md += `status: ${entity.status || 'active'}\n`;
    md += `confidence: ${entity.confidence || 'high'}\n`;

    if (entity.aliases && entity.aliases.length > 0) {
      md += 'aliases:\n';
      for (const alias of entity.aliases) {
        md += `  - ${alias}\n`;
      }
    }

    md += '---\n\n';

    // Tag as #hashtag in body (Obsidian native tags)
    md += `#${entity.entityType}\n\n`;

    // Project WikiLink - every project-scoped note links to the project
    if (entity.projectId) {
      md += `**Project:** [[${entity.projectId}]]\n\n`;
    }

    // NO H1 title - Obsidian shows filename as title, avoid duplication

    if (entity.observations && entity.observations.length > 0) {
      md += '## Observations\n\n';
      for (const obs of entity.observations) {
        md += `- ${obs.content || obs}\n`;
      }
      md += '\n';
    }

    // Write file
    writeFileSync(filePath, md, 'utf-8');
    console.error(`[BrainMCP] Synced entity to markdown: ${filePath}`);

    // Update md_file_path in database
    const db = getDb();
    db.prepare('UPDATE entities SET md_file_path = ? WHERE id = ?').run(filePath, entity.id);

    // Only add TEMPORAL entities to diary (bugs, tasks, decisions, events)
    // Structural entities (patterns, components, ideas) don't clutter the diary
    if (entity.entityType !== 'diary' && shouldAddToDiary(entity.entityType)) {
      ensureDiaryExists(vaultPath, date);
      appendToDiary(vaultPath, date, entity.name, entity.entityType, getEntityDescription(entity));
    }

    return filePath;
  } catch (error) {
    console.error(`[BrainMCP] Error syncing to markdown:`, error.message);
    return null;
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get the vault path from settings
 */
function getVaultPath() {
  return getSetting('vault_path', '');
}

/**
 * Entity types that should appear in daily diary
 * These are "temporal" notes - things that happened on a specific day
 * (bug fixes, task completions, decisions made, events, todos done)
 */
const TEMPORAL_ENTITY_TYPES = new Set([
  'bug',
  'bug_fix',
  'task',
  'decision',
  'todo',
  'gotcha',
  'event',
]);

/**
 * Check if an entity type should be added to the daily diary
 * Only temporal notes (things that happened today) go in diary
 * Structural notes (patterns, components, ideas) don't clutter the diary
 */
function shouldAddToDiary(entityType) {
  return TEMPORAL_ENTITY_TYPES.has(entityType);
}

/**
 * Map entity type (tag) to folder name
 */
function getTagFolder(tag) {
  const mapping = {
    'component': 'components',
    'function': 'functions',
    'api': 'api',
    'pattern': 'patterns',
    'bug': 'bugs',
    'bug_fix': 'bugs',
    'decision': 'decisions',
    'task': 'tasks',
    'config': 'config',
    'idea': 'ideas',
    'todo': 'todos',
    'human': 'humans',
    'note': 'notes',
    'diary': 'diary',
    'glossary': '',
    'preference': 'preferences',
    'fact': 'facts',
    'person': 'people',
    'project': 'projects',
    'document': 'documents',
    'gotcha': 'gotchas',
    'tool': 'tools',
    'technology': 'technologies',
  };
  return mapping[tag] || 'notes';
}

/**
 * Convert entity name to URL-friendly slug
 */
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Get current date in YYYY-MM-DD format
 */
function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Ensure diary file exists for a given date
 */
function ensureDiaryExists(vaultPath, date) {
  const diaryDir = join(vaultPath, 'QuackBrain', 'diary');
  if (!existsSync(diaryDir)) {
    mkdirSync(diaryDir, { recursive: true });
  }

  const diaryPath = join(diaryDir, `${date}.md`);
  if (!existsSync(diaryPath)) {
    // Create diary note with template:
    // - Tag in body as #diary
    // - Date as WikiLink
    // - No H1 (Obsidian shows filename)
    const content = `---
id: "diary-${date}"
date: "[[${date}]]"
author: system
---

#diary

## Notes Created Today

`;
    writeFileSync(diaryPath, content, 'utf-8');
    console.error(`[BrainMCP] Created diary for ${date}: ${diaryPath}`);
  }
}

/**
 * Append an entry to the daily diary
 */
function appendToDiary(vaultPath, date, noteName, tag, description) {
  const diaryPath = join(vaultPath, 'QuackBrain', 'diary', `${date}.md`);

  if (!existsSync(diaryPath)) {
    ensureDiaryExists(vaultPath, date);
  }

  let content = readFileSync(diaryPath, 'utf-8');

  const entry = `- [[${noteName}]] - #${tag} - ${description}`;

  // Check if entry already exists
  if (content.includes(`[[${noteName}]]`)) {
    console.error(`[BrainMCP] Diary entry already exists for: ${noteName}`);
    return; // Already added
  }

  // Find Notes Created Today section
  const sectionMarker = '## Notes Created Today';
  const sectionIndex = content.indexOf(sectionMarker);

  if (sectionIndex !== -1) {
    const afterSection = sectionIndex + sectionMarker.length;
    const nextSection = content.indexOf('\n## ', afterSection);
    const insertPos = nextSection !== -1 ? nextSection : content.length;

    // Find last entry in section
    const sectionContent = content.substring(afterSection, insertPos);
    const lastNewline = sectionContent.lastIndexOf('\n');
    const actualInsertPos = afterSection + lastNewline + 1;

    content = content.slice(0, actualInsertPos) + entry + '\n' + content.slice(actualInsertPos);
  } else {
    content += `\n${sectionMarker}\n\n${entry}\n`;
  }

  writeFileSync(diaryPath, content, 'utf-8');
  console.error(`[BrainMCP] Added diary entry for: ${noteName}`);
}

/**
 * Get a narrative description for diary entry
 * Creates readable, full descriptions - no truncation for Obsidian
 * These should read like mini-articles, easy to understand
 */
function getEntityDescription(entity) {
  const type = entity.entityType;

  // Collect ALL observations as a narrative
  let fullDescription = '';

  if (entity.observations && entity.observations.length > 0) {
    // Join all observations into a flowing narrative
    const cleanedObs = entity.observations.map(obs => {
      const content = obs.content || obs;
      // Remove date prefix if present
      return content.replace(/^\[[\d-]+\]\s*/, '');
    });

    fullDescription = cleanedObs.join(' ');
  }

  // Create narrative prefix based on entity type
  const narratives = {
    'bug': 'Fixed: ',
    'bug_fix': 'Resolved: ',
    'task': 'Completed: ',
    'decision': 'Decision: ',
    'todo': 'Done: ',
    'gotcha': 'Gotcha: ',
    'event': '',
  };

  const prefix = narratives[type] || '';
  return prefix + (fullDescription || entity.name);
}

// =============================================================================
// WIKILINKS PARSING
// =============================================================================

/**
 * Parse [[WikiLinks]] from markdown content
 *
 * Supports two formats:
 * - [[NoteName]] - Simple link
 * - [[NoteName|Display Text]] - Link with custom display text
 *
 * @param {string} content - Markdown content to parse
 * @returns {Array<{targetName: string, displayText: string|null}>} Parsed WikiLinks
 */
function parseWikiLinks(content) {
  const links = [];
  const seen = new Set();

  // Regex pattern: [[target]] or [[target|display]]
  const regex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const targetName = match[1].trim();
    const displayText = match[2] ? match[2].trim() : null;

    if (targetName && !seen.has(targetName.toLowerCase())) {
      seen.add(targetName.toLowerCase());
      links.push({ targetName, displayText });
    }
  }

  return links;
}

/**
 * Store WikiLinks for an entity in the database
 *
 * Clears existing WikiLinks for the entity and inserts new ones.
 *
 * @param {string} entityId - Entity ID
 * @param {Array<{targetName: string}>} wikilinks - Parsed WikiLinks
 * @returns {number} Number of WikiLinks stored
 */
function storeWikiLinks(entityId, wikilinks) {
  const db = getDb();
  const timestamp = now();

  // Delete existing WikiLinks for this entity
  db.prepare('DELETE FROM wikilinks WHERE from_entity_id = ?').run(entityId);

  // Insert new WikiLinks
  const insertStmt = db.prepare(`
    INSERT INTO wikilinks (id, from_entity_id, to_entity_name, created_at)
    VALUES (?, ?, ?, ?)
  `);

  let inserted = 0;
  for (const link of wikilinks) {
    const linkId = uuid();
    insertStmt.run(linkId, entityId, link.targetName, timestamp);
    inserted++;
  }

  console.error(`[BrainMCP] Stored ${inserted} wikilinks for entity ${entityId}`);
  return inserted;
}

/**
 * Extract and store WikiLinks from entity observations
 *
 * @param {string} entityId - Entity ID
 * @returns {number} Number of WikiLinks stored
 */
function extractAndStoreWikiLinksForEntity(entityId) {
  const db = getDb();

  // Get entity name to filter self-links
  const entity = db.prepare('SELECT name FROM entities WHERE id = ?').get(entityId);
  if (!entity) return 0;

  // Get all observations for the entity
  const observations = db.prepare(
    'SELECT content FROM observations WHERE entity_id = ?'
  ).all(entityId);

  // Parse WikiLinks from all observations
  const allLinks = [];
  for (const obs of observations) {
    const links = parseWikiLinks(obs.content);
    allLinks.push(...links);
  }

  // Filter out self-links and duplicates
  const seen = new Set();
  const filteredLinks = allLinks.filter(link => {
    const key = link.targetName.toLowerCase();
    if (key === entity.name.toLowerCase()) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Store the WikiLinks
  return storeWikiLinks(entityId, filteredLinks);
}

/**
 * Generate UUID v4
 */
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Get current Unix timestamp in seconds
 */
function now() {
  return Math.floor(Date.now() / 1000);
}

/**
 * Get entity with observations
 */
function getEntityWithObservations(entityId) {
  const db = getDb();

  const entity = db.prepare(`
    SELECT id, name, entity_type, project_id, created_at, updated_at, md_file_path
    FROM entities WHERE id = ?
  `).get(entityId);

  if (!entity) return null;

  const observations = db.prepare(`
    SELECT id, content, created_at
    FROM observations WHERE entity_id = ?
    ORDER BY created_at ASC
  `).all(entityId);

  return {
    id: entity.id,
    name: entity.name,
    entityType: entity.entity_type,
    projectId: entity.project_id,
    createdAt: entity.created_at,
    updatedAt: entity.updated_at,
    mdFilePath: entity.md_file_path,
    observations: observations.map(o => ({
      id: o.id,
      content: o.content,
      createdAt: o.created_at,
    })),
  };
}

// =============================================================================
// TOOL HANDLERS
// =============================================================================

/**
 * Handle brain_search tool
 * Search entities using FTS5 full-text search
 *
 * Supports optional projectId filter to scope results to a specific project.
 * Query is sanitized to handle special characters (e.g., hyphens in "studio-futuro").
 */
async function handleBrainSearch(args) {
  const { query, limit = 10, projectId } = args;

  console.error(`[BrainMCP] Search: "${query}" (limit: ${limit}, project: ${projectId || 'all'})`);

  try {
    const db = getDb();

    // Sanitize query for FTS5 - remove special chars that break syntax
    // e.g., "studio-futuro" becomes "studio futuro" (hyphen is NOT operator in FTS5)
    const sanitizedQuery = query
      .replace(/[^\w\s]/g, ' ')  // Remove special chars (hyphens, etc.)
      .replace(/\s+/g, ' ')      // Normalize whitespace
      .trim();

    // Use prefix matching for better recall (e.g., "auth" matches "authentication")
    const terms = sanitizedQuery.split(' ').filter(t => t.length > 0);
    const ftsQuery = terms.map(t => `${t}*`).join(' OR ');

    console.error(`[BrainMCP] FTS5 query: "${ftsQuery}"`);

    let sql;
    let params;

    if (projectId) {
      // Filter by project: include project-scoped AND global entities
      sql = `
        SELECT e.id, e.name, e.entity_type, e.project_id, rank,
          CASE
            WHEN e.project_id = ? THEN 1
            WHEN e.project_id IS NULL THEN 2
            ELSE 3
          END as scope_priority
        FROM entities e
        JOIN entities_fts fts ON e.rowid = fts.rowid
        WHERE entities_fts MATCH ?
          AND (e.project_id = ? OR e.project_id IS NULL)
        ORDER BY scope_priority ASC, rank ASC
        LIMIT ?
      `;
      params = [projectId, ftsQuery, projectId, limit];
    } else {
      // No project filter - return all results
      sql = `
        SELECT e.id, e.name, e.entity_type, e.project_id, rank
        FROM entities e
        JOIN entities_fts fts ON e.rowid = fts.rowid
        WHERE entities_fts MATCH ?
        ORDER BY rank ASC
        LIMIT ?
      `;
      params = [ftsQuery, limit];
    }

    const results = db.prepare(sql).all(...params);

    // Get full entities with observations
    const entities = results.map(r => {
      const entity = getEntityWithObservations(r.id);
      return {
        ...entity,
        score: r.rank,
      };
    });

    console.error(`[BrainMCP] Found ${entities.length} results`);

    return JSON.stringify({
      success: true,
      query,
      searchTerms: terms,
      projectId: projectId || null,
      count: entities.length,
      entities,
    }, null, 2);

  } catch (error) {
    console.error(`[BrainMCP] Search error: ${error.message}`);
    return JSON.stringify({
      success: false,
      error: 'Search failed',
      message: error.message,
    }, null, 2);
  }
}

/**
 * Handle brain_smart_search tool
 *
 * AI-DRIVEN SEARCH: Claude decides WHEN to search and WHAT to search for.
 * No automatic keyword extraction - the query is the semantic intent.
 *
 * This is the PRIMARY search tool for AI agents. Use when:
 * - Investigating bugs or issues
 * - Making architectural decisions
 * - Looking for patterns or past solutions
 * - Answering questions about project history
 *
 * The query should be natural language describing what you need.
 * FTS5 handles the matching against entity names and observations.
 *
 * WEIGHTED RANKING (when projectId is provided):
 * Results are sorted with project-scoped entities first, then global entities.
 * This ensures the most relevant context appears at the top while still
 * including potentially useful global knowledge.
 */
async function handleBrainSmartSearch(args) {
  const { query, context, limit = 5, projectId } = args;

  console.error(`[BrainMCP] === SMART SEARCH ===`);
  console.error(`[BrainMCP] Query: "${query}"`);
  console.error(`[BrainMCP] Context: "${context || 'none'}"`);
  console.error(`[BrainMCP] Project: ${projectId || 'all'}`);
  console.error(`[BrainMCP] Limit: ${limit}`);

  try {
    const db = getDb();

    // Prepare query for FTS5
    // Keep the semantic query intact - FTS5 will match against full-text
    // Remove special characters that break FTS5 syntax
    const sanitizedQuery = query
      .replace(/[^\w\s]/g, ' ')  // Remove special chars
      .replace(/\s+/g, ' ')      // Normalize whitespace
      .trim();

    // Use prefix matching for partial words (e.g., "auth" matches "authentication")
    // Split into terms and add wildcard for better recall
    const terms = sanitizedQuery.split(' ').filter(t => t.length > 0);
    const ftsQuery = terms.map(t => `${t}*`).join(' OR ');

    console.error(`[BrainMCP] FTS5 query: "${ftsQuery}"`);

    let sql;
    let params;

    if (projectId) {
      // WEIGHTED RANKING: Project-scoped search with weighted results
      // 1 = Current project (highest priority)
      // 2 = Global entities (NULL project_id)
      // 3 = Other projects (lowest priority, excluded by default)
      sql = `
        SELECT e.id, e.name, e.entity_type, e.project_id, rank,
          CASE
            WHEN e.project_id = ? THEN 1
            WHEN e.project_id IS NULL THEN 2
            ELSE 3
          END as scope_priority,
          CASE
            WHEN e.project_id = ? THEN 'project'
            WHEN e.project_id IS NULL THEN 'global'
            ELSE 'other'
          END as scope
        FROM entities e
        JOIN entities_fts fts ON e.rowid = fts.rowid
        WHERE entities_fts MATCH ?
          AND (e.project_id = ? OR e.project_id IS NULL)
        ORDER BY scope_priority ASC, rank ASC
        LIMIT ?
      `;
      params = [projectId, projectId, ftsQuery, projectId, limit];
    } else {
      // No project filter - return all results ordered by FTS rank
      sql = `
        SELECT e.id, e.name, e.entity_type, e.project_id, rank,
          CASE
            WHEN e.project_id IS NULL THEN 'global'
            ELSE 'project'
          END as scope
        FROM entities e
        JOIN entities_fts fts ON e.rowid = fts.rowid
        WHERE entities_fts MATCH ?
        ORDER BY rank ASC
        LIMIT ?
      `;
      params = [ftsQuery, limit];
    }

    const results = db.prepare(sql).all(...params);

    // Get full entities with observations and scope info
    const entities = results.map(r => {
      const entity = getEntityWithObservations(r.id);
      return {
        ...entity,
        relevance: Math.abs(r.rank), // FTS5 rank is negative, take absolute value
        scope: r.scope, // 'project' | 'global' | 'other'
      };
    });

    // Count by scope for stats
    const projectCount = entities.filter(e => e.scope === 'project').length;
    const globalCount = entities.filter(e => e.scope === 'global').length;

    console.error(`[BrainMCP] Found ${entities.length} results (project: ${projectCount}, global: ${globalCount})`);
    console.error(`[BrainMCP] === END SMART SEARCH ===`);

    return JSON.stringify({
      success: true,
      query,
      context: context || null,
      projectId: projectId || null,
      searchTerms: terms, // What was actually searched (for debugging)
      count: entities.length,
      scopeCounts: {
        project: projectCount,
        global: globalCount,
      },
      entities,
    }, null, 2);

  } catch (error) {
    console.error(`[BrainMCP] Smart search error: ${error.message}`);
    return JSON.stringify({
      success: false,
      error: 'Smart search failed',
      message: error.message,
    }, null, 2);
  }
}

/**
 * Handle brain_create_entity tool
 * Create a new entity with observations
 */
async function handleBrainCreateEntity(args) {
  const {
    name,
    entityType,
    observations = [],
    projectId = null,
    author = 'claude',
    date = null,
    status = 'active',
    confidence = 'high',
    sourceFile = null,
    aliases = [],
  } = args;

  console.error(`[BrainMCP] Creating entity: "${name}" (type: ${entityType})`);

  try {
    const db = getDb();
    const entityId = uuid();
    const timestamp = now();
    const entityDate = date || getTodayDate();

    // Insert entity
    db.prepare(`
      INSERT INTO entities (id, name, entity_type, created_at, updated_at, project_id, md_file_path)
      VALUES (?, ?, ?, ?, ?, ?, NULL)
    `).run(entityId, name, entityType, timestamp, timestamp, projectId);

    // Insert observations
    for (const content of observations) {
      const obsId = uuid();
      db.prepare(`
        INSERT INTO observations (id, entity_id, content, created_at)
        VALUES (?, ?, ?, ?)
      `).run(obsId, entityId, content, timestamp);
    }

    // Get base entity with observations
    const baseEntity = getEntityWithObservations(entityId);

    // Extend with new fields for markdown sync
    const entity = {
      ...baseEntity,
      author,
      date: entityDate,
      status,
      confidence,
      sourceFile,
      aliases,
    };

    console.error(`[BrainMCP] Created entity: ${entityId}`);

    // Extract and store WikiLinks from observations
    let wikilinksCount = 0;
    if (observations && observations.length > 0) {
      wikilinksCount = extractAndStoreWikiLinksForEntity(entityId);
    }

    // Auto-sync to markdown if enabled
    const mdFilePath = syncEntityToMarkdown(entity);

    return JSON.stringify({
      success: true,
      message: `Entity "${name}" created successfully`,
      entity,
      mdFilePath,
      wikilinksExtracted: wikilinksCount,
    }, null, 2);

  } catch (error) {
    console.error(`[BrainMCP] Create entity error: ${error.message}`);
    return JSON.stringify({
      success: false,
      error: 'Create entity failed',
      message: error.message,
    }, null, 2);
  }
}

/**
 * Handle brain_add_observation tool
 * Add an observation to an existing entity
 */
async function handleBrainAddObservation(args) {
  const { entityId, entityName, content } = args;

  console.error(`[BrainMCP] Adding observation to: ${entityId || entityName}`);

  try {
    const db = getDb();

    // Find entity by ID or name
    let targetEntityId = entityId;
    if (!targetEntityId && entityName) {
      const entity = db.prepare(`
        SELECT id FROM entities WHERE name = ?
      `).get(entityName);
      if (entity) {
        targetEntityId = entity.id;
      }
    }

    if (!targetEntityId) {
      return JSON.stringify({
        success: false,
        error: 'Entity not found',
        message: `No entity found with ID "${entityId}" or name "${entityName}"`,
      }, null, 2);
    }

    const obsId = uuid();
    const timestamp = now();

    // Insert observation
    db.prepare(`
      INSERT INTO observations (id, entity_id, content, created_at)
      VALUES (?, ?, ?, ?)
    `).run(obsId, targetEntityId, content, timestamp);

    // Update entity timestamp
    db.prepare(`
      UPDATE entities SET updated_at = ? WHERE id = ?
    `).run(timestamp, targetEntityId);

    const entity = getEntityWithObservations(targetEntityId);

    console.error(`[BrainMCP] Added observation to: ${targetEntityId}`);

    // Extract and update WikiLinks (re-process all observations)
    const wikilinksCount = extractAndStoreWikiLinksForEntity(targetEntityId);

    // Auto-sync to markdown if enabled
    const mdFilePath = syncEntityToMarkdown(entity);

    return JSON.stringify({
      success: true,
      message: 'Observation added successfully',
      entity,
      observation: {
        id: obsId,
        content,
        createdAt: timestamp,
      },
      mdFilePath,
      wikilinksExtracted: wikilinksCount,
    }, null, 2);

  } catch (error) {
    console.error(`[BrainMCP] Add observation error: ${error.message}`);
    return JSON.stringify({
      success: false,
      error: 'Add observation failed',
      message: error.message,
    }, null, 2);
  }
}

/**
 * Handle brain_get_graph tool
 * Get the full knowledge graph
 */
async function handleBrainGetGraph(args) {
  const { limit = 100 } = args;

  console.error(`[BrainMCP] Getting graph (limit: ${limit})`);

  try {
    const db = getDb();

    // Get entities
    const entities = db.prepare(`
      SELECT id FROM entities
      ORDER BY updated_at DESC
      LIMIT ?
    `).all(limit);

    const fullEntities = entities.map(e => getEntityWithObservations(e.id));

    // Get relations
    const relations = db.prepare(`
      SELECT id, from_entity_id, to_entity_id, relation_type, created_at
      FROM relations
      ORDER BY created_at DESC
      LIMIT ?
    `).all(limit);

    const formattedRelations = relations.map(r => ({
      id: r.id,
      fromEntityId: r.from_entity_id,
      toEntityId: r.to_entity_id,
      relationType: r.relation_type,
      createdAt: r.created_at,
    }));

    console.error(`[BrainMCP] Loaded ${fullEntities.length} entities, ${formattedRelations.length} relations`);

    return JSON.stringify({
      success: true,
      graph: {
        entities: fullEntities,
        relations: formattedRelations,
      },
      stats: {
        entityCount: fullEntities.length,
        relationCount: formattedRelations.length,
      },
    }, null, 2);

  } catch (error) {
    console.error(`[BrainMCP] Get graph error: ${error.message}`);
    return JSON.stringify({
      success: false,
      error: 'Get graph failed',
      message: error.message,
    }, null, 2);
  }
}

/**
 * Handle brain_create_relation tool
 * Create a relation between two entities
 */
async function handleBrainCreateRelation(args) {
  const { fromEntityId, fromEntityName, toEntityId, toEntityName, relationType } = args;

  console.error(`[BrainMCP] Creating relation: ${fromEntityId || fromEntityName} -> ${toEntityId || toEntityName} (${relationType})`);

  try {
    const db = getDb();

    // Resolve entity IDs from names if needed
    let resolvedFromId = fromEntityId;
    let resolvedToId = toEntityId;

    if (!resolvedFromId && fromEntityName) {
      const entity = db.prepare(`SELECT id FROM entities WHERE name = ?`).get(fromEntityName);
      if (entity) resolvedFromId = entity.id;
    }

    if (!resolvedToId && toEntityName) {
      const entity = db.prepare(`SELECT id FROM entities WHERE name = ?`).get(toEntityName);
      if (entity) resolvedToId = entity.id;
    }

    if (!resolvedFromId) {
      return JSON.stringify({
        success: false,
        error: 'Source entity not found',
        message: `No entity found with ID "${fromEntityId}" or name "${fromEntityName}"`,
      }, null, 2);
    }

    if (!resolvedToId) {
      return JSON.stringify({
        success: false,
        error: 'Target entity not found',
        message: `No entity found with ID "${toEntityId}" or name "${toEntityName}"`,
      }, null, 2);
    }

    const relationId = uuid();
    const timestamp = now();

    // Insert relation
    db.prepare(`
      INSERT INTO relations (id, from_entity_id, to_entity_id, relation_type, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(relationId, resolvedFromId, resolvedToId, relationType, timestamp);

    console.error(`[BrainMCP] Created relation: ${relationId}`);

    return JSON.stringify({
      success: true,
      message: 'Relation created successfully',
      relation: {
        id: relationId,
        fromEntityId: resolvedFromId,
        toEntityId: resolvedToId,
        relationType,
        createdAt: timestamp,
      },
    }, null, 2);

  } catch (error) {
    console.error(`[BrainMCP] Create relation error: ${error.message}`);
    return JSON.stringify({
      success: false,
      error: 'Create relation failed',
      message: error.message,
    }, null, 2);
  }
}

/**
 * Handle brain_list_entities tool
 * List entities with optional filters
 */
async function handleBrainListEntities(args) {
  const { entityType, projectId, limit = 50 } = args;

  console.error(`[BrainMCP] Listing entities (type: ${entityType || 'all'}, project: ${projectId || 'all'}, limit: ${limit})`);

  try {
    const db = getDb();

    let sql = 'SELECT id FROM entities WHERE 1=1';
    const params = [];

    if (entityType) {
      sql += ' AND entity_type = ?';
      params.push(entityType);
    }

    if (projectId) {
      sql += ' AND project_id = ?';
      params.push(projectId);
    }

    sql += ' ORDER BY updated_at DESC LIMIT ?';
    params.push(limit);

    const entities = db.prepare(sql).all(...params);
    const fullEntities = entities.map(e => getEntityWithObservations(e.id));

    console.error(`[BrainMCP] Found ${fullEntities.length} entities`);

    return JSON.stringify({
      success: true,
      count: fullEntities.length,
      entities: fullEntities,
    }, null, 2);

  } catch (error) {
    console.error(`[BrainMCP] List entities error: ${error.message}`);
    return JSON.stringify({
      success: false,
      error: 'List entities failed',
      message: error.message,
    }, null, 2);
  }
}

/**
 * Handle brain_get_backlinks tool
 * Get all entities that link TO a given entity name via [[WikiLinks]]
 */
async function handleBrainGetBacklinks(args) {
  const { entityName } = args;

  console.error(`[BrainMCP] Getting backlinks for: "${entityName}"`);

  try {
    const db = getDb();

    // Query WikiLinks table for all links pointing to this entity name
    // Join with entities table to get full entity info
    const backlinks = db.prepare(`
      SELECT w.from_entity_id, e.name, e.entity_type, w.created_at
      FROM wikilinks w
      JOIN entities e ON w.from_entity_id = e.id
      WHERE LOWER(w.to_entity_name) = LOWER(?)
      ORDER BY w.created_at DESC
    `).all(entityName);

    const formattedBacklinks = backlinks.map(b => ({
      fromEntityId: b.from_entity_id,
      fromEntityName: b.name,
      fromEntityType: b.entity_type,
      createdAt: b.created_at,
    }));

    console.error(`[BrainMCP] Found ${formattedBacklinks.length} backlinks for "${entityName}"`);

    return JSON.stringify({
      success: true,
      targetName: entityName,
      count: formattedBacklinks.length,
      backlinks: formattedBacklinks,
    }, null, 2);

  } catch (error) {
    console.error(`[BrainMCP] Get backlinks error: ${error.message}`);
    return JSON.stringify({
      success: false,
      error: 'Get backlinks failed',
      message: error.message,
    }, null, 2);
  }
}

// =============================================================================
// CANVAS HELPERS
// =============================================================================

/**
 * Obsidian Canvas color mapping
 * Colors 1-6 are Obsidian's preset colors
 */
const CANVAS_COLORS = {
  1: 'red',
  2: 'orange',
  3: 'yellow',
  4: 'green',
  5: 'cyan',
  6: 'purple',
};

/**
 * Reverse color mapping for creating nodes
 */
const COLOR_TO_NUMBER = {
  'red': '1',
  'orange': '2',
  'yellow': '3',
  'green': '4',
  'cyan': '5',
  'purple': '6',
};

/**
 * Generate a random hex ID for canvas nodes/edges
 */
function generateCanvasId() {
  return [...Array(16)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
}

/**
 * Read and parse an Obsidian canvas file
 */
function readCanvasFile(canvasPath) {
  if (!existsSync(canvasPath)) {
    return null;
  }
  const content = readFileSync(canvasPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Write canvas data to file
 */
function writeCanvasFile(canvasPath, canvasData) {
  const dir = dirname(canvasPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(canvasPath, JSON.stringify(canvasData, null, '\t'), 'utf-8');
}

/**
 * Handle brain_read_canvas tool
 * Read and parse an Obsidian canvas file
 */
async function handleBrainReadCanvas(args) {
  const { canvasPath, projectId } = args;

  console.error(`[BrainMCP] Reading canvas: ${canvasPath || `project ${projectId}`}`);

  try {
    let fullPath = canvasPath;

    // If projectId provided, look for canvas in project folder
    if (!fullPath && projectId) {
      const vaultPath = getVaultPath();
      if (!vaultPath) {
        return JSON.stringify({
          success: false,
          error: 'No vault path configured',
        }, null, 2);
      }
      // Look for any .canvas files in the project folder
      const projectDir = join(vaultPath, 'QuackBrain', 'projects', projectId);
      if (existsSync(projectDir)) {
        const files = readdirSync(projectDir);
        const canvasFiles = files.filter(f => f.endsWith('.canvas'));
        if (canvasFiles.length > 0) {
          fullPath = join(projectDir, canvasFiles[0]);
        }
      }
    }

    if (!fullPath) {
      return JSON.stringify({
        success: false,
        error: 'Canvas path required or no canvas found in project',
      }, null, 2);
    }

    const canvasData = readCanvasFile(fullPath);

    if (!canvasData) {
      return JSON.stringify({
        success: false,
        error: 'Canvas file not found',
        path: fullPath,
      }, null, 2);
    }

    // Enrich nodes with color names
    const enrichedNodes = (canvasData.nodes || []).map(node => ({
      ...node,
      colorName: node.color ? CANVAS_COLORS[node.color] || 'unknown' : null,
    }));

    console.error(`[BrainMCP] Read canvas with ${enrichedNodes.length} nodes, ${(canvasData.edges || []).length} edges`);

    return JSON.stringify({
      success: true,
      path: fullPath,
      canvas: {
        nodes: enrichedNodes,
        edges: canvasData.edges || [],
      },
      stats: {
        nodeCount: enrichedNodes.length,
        edgeCount: (canvasData.edges || []).length,
        textNodes: enrichedNodes.filter(n => n.type === 'text').length,
        fileNodes: enrichedNodes.filter(n => n.type === 'file').length,
      },
    }, null, 2);

  } catch (error) {
    console.error(`[BrainMCP] Read canvas error: ${error.message}`);
    return JSON.stringify({
      success: false,
      error: 'Read canvas failed',
      message: error.message,
    }, null, 2);
  }
}

/**
 * Handle brain_create_canvas tool
 * Create a new Obsidian canvas file
 */
async function handleBrainCreateCanvas(args) {
  const { name, projectId, nodes = [], edges = [] } = args;

  // projectId is required - canvas must always go in a project folder
  if (!projectId) {
    return JSON.stringify({
      success: false,
      error: 'projectId is required. Canvas files must be created in a project folder.',
    }, null, 2);
  }

  console.error(`[BrainMCP] Creating canvas: ${name} (project: ${projectId})`);

  try {
    const vaultPath = getVaultPath();
    if (!vaultPath) {
      return JSON.stringify({
        success: false,
        error: 'No vault path configured',
      }, null, 2);
    }

    // Canvas always goes in the project folder (not in a canvases/ subfolder)
    const canvasPath = join(vaultPath, 'QuackBrain', 'projects', projectId, `${slugify(name)}.canvas`);

    // Process nodes - convert color names to numbers, add IDs
    // Supports: text, file (markdown/canvas/images), link (external URLs like GIFs)
    const processedNodes = nodes.map(node => {
      const processed = {
        id: node.id || generateCanvasId(),
        x: node.x || 0,
        y: node.y || 0,
        width: node.width || 250,
        height: node.height || 60,
        type: node.type || 'text',
      };

      if (node.type === 'text') {
        processed.text = node.text || '';
      } else if (node.type === 'file') {
        // File embed: markdown notes, other canvases, local images
        processed.file = node.file || '';
      } else if (node.type === 'link') {
        // External URL: GIFs, web images, external resources
        processed.url = node.url || '';
      }

      // Handle color - accept name or number
      if (node.color) {
        if (typeof node.color === 'string' && COLOR_TO_NUMBER[node.color]) {
          processed.color = COLOR_TO_NUMBER[node.color];
        } else {
          processed.color = String(node.color);
        }
      }

      return processed;
    });

    // Process edges - add IDs
    const processedEdges = edges.map(edge => ({
      id: edge.id || generateCanvasId(),
      fromNode: edge.fromNode,
      fromSide: edge.fromSide || 'right',
      toNode: edge.toNode,
      toSide: edge.toSide || 'left',
    }));

    const canvasData = {
      nodes: processedNodes,
      edges: processedEdges,
    };

    writeCanvasFile(canvasPath, canvasData);

    console.error(`[BrainMCP] Created canvas: ${canvasPath}`);

    return JSON.stringify({
      success: true,
      message: `Canvas "${name}" created successfully`,
      path: canvasPath,
      canvas: canvasData,
    }, null, 2);

  } catch (error) {
    console.error(`[BrainMCP] Create canvas error: ${error.message}`);
    return JSON.stringify({
      success: false,
      error: 'Create canvas failed',
      message: error.message,
    }, null, 2);
  }
}

/**
 * Handle brain_update_canvas tool
 * Update an existing Obsidian canvas (add/remove/modify nodes and edges)
 */
async function handleBrainUpdateCanvas(args) {
  const { canvasPath, addNodes = [], removeNodeIds = [], updateNodes = [], addEdges = [], removeEdgeIds = [] } = args;

  console.error(`[BrainMCP] Updating canvas: ${canvasPath}`);

  try {
    // Read existing canvas
    const canvasData = readCanvasFile(canvasPath);
    if (!canvasData) {
      return JSON.stringify({
        success: false,
        error: 'Canvas file not found',
        path: canvasPath,
      }, null, 2);
    }

    let nodes = canvasData.nodes || [];
    let edges = canvasData.edges || [];

    // Remove nodes by ID
    if (removeNodeIds.length > 0) {
      const removeSet = new Set(removeNodeIds);
      nodes = nodes.filter(n => !removeSet.has(n.id));
      // Also remove edges connected to removed nodes
      edges = edges.filter(e => !removeSet.has(e.fromNode) && !removeSet.has(e.toNode));
    }

    // Update existing nodes
    for (const update of updateNodes) {
      const nodeIndex = nodes.findIndex(n => n.id === update.id);
      if (nodeIndex !== -1) {
        // Handle color conversion
        if (update.color && typeof update.color === 'string' && COLOR_TO_NUMBER[update.color]) {
          update.color = COLOR_TO_NUMBER[update.color];
        }
        nodes[nodeIndex] = { ...nodes[nodeIndex], ...update };
      }
    }

    // Add new nodes
    for (const node of addNodes) {
      const newNode = {
        id: node.id || generateCanvasId(),
        x: node.x || 0,
        y: node.y || 0,
        width: node.width || 250,
        height: node.height || 60,
        type: node.type || 'text',
      };

      if (node.type === 'text') {
        newNode.text = node.text || '';
      } else if (node.type === 'file') {
        // File embed: markdown notes, other canvases, local images
        newNode.file = node.file || '';
      } else if (node.type === 'link') {
        // External URL: GIFs, web images, external resources
        newNode.url = node.url || '';
      }

      if (node.color) {
        if (typeof node.color === 'string' && COLOR_TO_NUMBER[node.color]) {
          newNode.color = COLOR_TO_NUMBER[node.color];
        } else {
          newNode.color = String(node.color);
        }
      }

      nodes.push(newNode);
    }

    // Remove edges by ID
    if (removeEdgeIds.length > 0) {
      const removeSet = new Set(removeEdgeIds);
      edges = edges.filter(e => !removeSet.has(e.id));
    }

    // Add new edges
    for (const edge of addEdges) {
      edges.push({
        id: edge.id || generateCanvasId(),
        fromNode: edge.fromNode,
        fromSide: edge.fromSide || 'right',
        toNode: edge.toNode,
        toSide: edge.toSide || 'left',
      });
    }

    const updatedCanvas = { nodes, edges };
    writeCanvasFile(canvasPath, updatedCanvas);

    console.error(`[BrainMCP] Updated canvas: ${nodes.length} nodes, ${edges.length} edges`);

    return JSON.stringify({
      success: true,
      message: 'Canvas updated successfully',
      path: canvasPath,
      canvas: updatedCanvas,
      changes: {
        nodesAdded: addNodes.length,
        nodesRemoved: removeNodeIds.length,
        nodesUpdated: updateNodes.length,
        edgesAdded: addEdges.length,
        edgesRemoved: removeEdgeIds.length,
      },
    }, null, 2);

  } catch (error) {
    console.error(`[BrainMCP] Update canvas error: ${error.message}`);
    return JSON.stringify({
      success: false,
      error: 'Update canvas failed',
      message: error.message,
    }, null, 2);
  }
}

/**
 * Handle brain_get_wikilinks tool
 * Get all WikiLinks FROM a given entity
 */
async function handleBrainGetWikilinks(args) {
  const { entityId, entityName } = args;

  console.error(`[BrainMCP] Getting wikilinks for: ${entityId || entityName}`);

  try {
    const db = getDb();

    // Resolve entity ID from name if needed
    let targetEntityId = entityId;
    if (!targetEntityId && entityName) {
      const entity = db.prepare('SELECT id FROM entities WHERE name = ?').get(entityName);
      if (entity) targetEntityId = entity.id;
    }

    if (!targetEntityId) {
      return JSON.stringify({
        success: false,
        error: 'Entity not found',
        message: `No entity found with ID "${entityId}" or name "${entityName}"`,
      }, null, 2);
    }

    // Get all WikiLinks from this entity
    const wikilinks = db.prepare(`
      SELECT id, from_entity_id, to_entity_name, created_at
      FROM wikilinks
      WHERE from_entity_id = ?
      ORDER BY created_at ASC
    `).all(targetEntityId);

    const formattedWikilinks = wikilinks.map(w => ({
      id: w.id,
      fromEntityId: w.from_entity_id,
      toEntityName: w.to_entity_name,
      createdAt: w.created_at,
    }));

    console.error(`[BrainMCP] Found ${formattedWikilinks.length} wikilinks from entity`);

    return JSON.stringify({
      success: true,
      entityId: targetEntityId,
      count: formattedWikilinks.length,
      wikilinks: formattedWikilinks,
    }, null, 2);

  } catch (error) {
    console.error(`[BrainMCP] Get wikilinks error: ${error.message}`);
    return JSON.stringify({
      success: false,
      error: 'Get wikilinks failed',
      message: error.message,
    }, null, 2);
  }
}

// =============================================================================
// TOOL DEFINITIONS
// =============================================================================

const TOOLS = [
  {
    name: 'search',
    description: 'Search entities in the Quack Brain knowledge graph using full-text search. Use this to find memories, patterns, decisions, and other stored knowledge.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query to find matching entities. Searches entity names and observation content.',
        },
        limit: {
          type: 'number',
          default: 10,
          description: 'Maximum number of results to return.',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'smart_search',
    description: 'Search the brain with a semantic query using natural language. Use this when you need context from past conversations, patterns, decisions, or stored knowledge. Formulate your query in natural language describing what you are looking for.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural language query describing what you are looking for (e.g., "authentication patterns", "how we handle errors", "performance optimizations")',
        },
        context: {
          type: 'string',
          description: 'Brief context about why you need this information (helps improve search relevance and is logged for debugging)',
        },
        limit: {
          type: 'number',
          default: 5,
          description: 'Maximum number of results to return (default: 5)',
        },
        projectId: {
          type: 'string',
          description: 'Optional project ID to scope the search to a specific project',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'create_entity',
    description: 'Create a new entity in the Quack Brain knowledge graph. Use this to save new memories, patterns, decisions, or other knowledge. Entities are auto-synced to Obsidian vault with daily diary integration.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Unique name for the entity (e.g., "user_preferences", "auth_pattern").',
        },
        entityType: {
          type: 'string',
          description: 'Type of entity: preference, fact, decision, pattern, bug_fix, person, project, diary, document, gotcha, tool, technology, component, function, api, task, config, idea, todo, human, note, glossary.',
        },
        observations: {
          type: 'array',
          items: { type: 'string' },
          default: [],
          description: 'Initial observations (facts/notes) to attach to this entity.',
        },
        projectId: {
          type: 'string',
          description: 'Optional project ID to scope this entity to a specific project. Project entities go to projects/<projectId>/<tagFolder>/, global entities go to global/<tagFolder>/.',
        },
        author: {
          type: 'string',
          default: 'claude',
          description: 'Author of the entity (e.g., "claude", "alek", "system"). Defaults to "claude".',
        },
        date: {
          type: 'string',
          description: 'Date for the entity in YYYY-MM-DD format. Defaults to today. Used for daily diary linking.',
        },
        status: {
          type: 'string',
          enum: ['active', 'archived', 'draft', 'deprecated'],
          default: 'active',
          description: 'Status of the entity. Defaults to "active".',
        },
        confidence: {
          type: 'string',
          enum: ['high', 'medium', 'low'],
          default: 'high',
          description: 'Confidence level of the knowledge. Defaults to "high".',
        },
        sourceFile: {
          type: 'string',
          description: 'Optional source file path that this entity relates to.',
        },
        aliases: {
          type: 'array',
          items: { type: 'string' },
          default: [],
          description: 'Alternative names for this entity (for Obsidian aliases).',
        },
      },
      required: ['name', 'entityType'],
    },
  },
  {
    name: 'add_observation',
    description: 'Add a new observation (fact/note) to an existing entity. Use this to append new information to existing knowledge.',
    inputSchema: {
      type: 'object',
      properties: {
        entityId: {
          type: 'string',
          description: 'ID of the entity to add observation to.',
        },
        entityName: {
          type: 'string',
          description: 'Name of the entity (alternative to entityId).',
        },
        content: {
          type: 'string',
          description: 'The observation content to add. Prefix with [YYYY-MM-DD] for dated entries.',
        },
      },
      required: ['content'],
    },
  },
  {
    name: 'get_graph',
    description: 'Get the full knowledge graph including all entities and relations. Use this to understand the current state of stored knowledge.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          default: 100,
          description: 'Maximum number of entities and relations to return.',
        },
      },
    },
  },
  {
    name: 'create_relation',
    description: 'Create a relation between two entities in the knowledge graph. Use this to link related knowledge.',
    inputSchema: {
      type: 'object',
      properties: {
        fromEntityId: {
          type: 'string',
          description: 'ID of the source entity.',
        },
        fromEntityName: {
          type: 'string',
          description: 'Name of the source entity (alternative to fromEntityId).',
        },
        toEntityId: {
          type: 'string',
          description: 'ID of the target entity.',
        },
        toEntityName: {
          type: 'string',
          description: 'Name of the target entity (alternative to toEntityId).',
        },
        relationType: {
          type: 'string',
          description: 'Type of relation: belongs_to_project, relates_to, depends_on, created_by, uses, documented_in.',
        },
      },
      required: ['relationType'],
    },
  },
  {
    name: 'list_entities',
    description: 'List entities in the knowledge graph with optional filters. Use this to browse stored knowledge by type or project.',
    inputSchema: {
      type: 'object',
      properties: {
        entityType: {
          type: 'string',
          description: 'Filter by entity type (e.g., "pattern", "decision").',
        },
        projectId: {
          type: 'string',
          description: 'Filter by project ID.',
        },
        limit: {
          type: 'number',
          default: 50,
          description: 'Maximum number of entities to return.',
        },
      },
    },
  },
  {
    name: 'get_backlinks',
    description: 'Get all entities that link TO a given entity via [[WikiLinks]]. This is useful for Obsidian-style graph navigation and understanding how knowledge is connected. Backlinks show which entities reference the target entity.',
    inputSchema: {
      type: 'object',
      properties: {
        entityName: {
          type: 'string',
          description: 'Name of the entity to find backlinks for. Case-insensitive matching.',
        },
      },
      required: ['entityName'],
    },
  },
  {
    name: 'get_wikilinks',
    description: 'Get all [[WikiLinks]] FROM a given entity. This shows what other entities this entity references. Useful for understanding the outgoing connections from a piece of knowledge.',
    inputSchema: {
      type: 'object',
      properties: {
        entityId: {
          type: 'string',
          description: 'ID of the entity to get wikilinks from.',
        },
        entityName: {
          type: 'string',
          description: 'Name of the entity (alternative to entityId).',
        },
      },
    },
  },
  // Canvas tools
  {
    name: 'read_canvas',
    description: 'Read and parse an Obsidian canvas file (.canvas). Returns all nodes (text/file cards) and edges (connections) with their positions, sizes, colors, and content. Colors are returned as both number (1-6) and name (red, orange, yellow, green, cyan, purple).',
    inputSchema: {
      type: 'object',
      properties: {
        canvasPath: {
          type: 'string',
          description: 'Full path to the .canvas file to read.',
        },
        projectId: {
          type: 'string',
          description: 'Alternative: project ID to find canvas files in. Will return first .canvas found in project folder.',
        },
      },
    },
  },
  {
    name: 'create_canvas',
    description: 'Create a new Obsidian canvas file with nodes and edges. Use this to create visual diagrams, mind maps, or flowcharts. Canvas is always created in the project folder (projectId required). Supports: text nodes, file embeds (markdown, canvas, images), link nodes (external URLs like GIFs), colors (red, orange, yellow, green, cyan, purple), and connections between nodes.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name for the canvas file (will be slugified).',
        },
        projectId: {
          type: 'string',
          description: 'REQUIRED. Project ID to create canvas in. Canvas files are always created in the project folder.',
        },
        nodes: {
          type: 'array',
          description: 'Array of nodes to create.',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Optional node ID (auto-generated if omitted).' },
              type: { type: 'string', enum: ['text', 'file', 'link'], description: 'Node type: text for notes, file for embedding vault files (markdown, canvas, images), link for external URLs (GIFs, web images).' },
              x: { type: 'number', description: 'X position on canvas.' },
              y: { type: 'number', description: 'Y position on canvas.' },
              width: { type: 'number', description: 'Node width (default: 250).' },
              height: { type: 'number', description: 'Node height (default: 60).' },
              text: { type: 'string', description: 'Text content (for type=text).' },
              file: { type: 'string', description: 'Path to file relative to vault (for type=file). Can be .md, .canvas, .png, .jpg, etc.' },
              url: { type: 'string', description: 'External URL (for type=link). Can be GIF URLs from Giphy, web images, etc.' },
              color: { type: 'string', description: 'Node color: red, orange, yellow, green, cyan, purple (or 1-6).' },
            },
          },
        },
        edges: {
          type: 'array',
          description: 'Array of edges (connections) between nodes.',
          items: {
            type: 'object',
            properties: {
              fromNode: { type: 'string', description: 'Source node ID.' },
              toNode: { type: 'string', description: 'Target node ID.' },
              fromSide: { type: 'string', enum: ['top', 'right', 'bottom', 'left'], description: 'Side of source node (default: right).' },
              toSide: { type: 'string', enum: ['top', 'right', 'bottom', 'left'], description: 'Side of target node (default: left).' },
            },
            required: ['fromNode', 'toNode'],
          },
        },
      },
      required: ['name', 'projectId'],
    },
  },
  {
    name: 'update_canvas',
    description: 'Update an existing Obsidian canvas file. Add, remove, or modify nodes and edges. When removing nodes, connected edges are automatically removed too.',
    inputSchema: {
      type: 'object',
      properties: {
        canvasPath: {
          type: 'string',
          description: 'Full path to the .canvas file to update.',
        },
        addNodes: {
          type: 'array',
          description: 'Nodes to add to the canvas.',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              type: { type: 'string', enum: ['text', 'file', 'link'] },
              x: { type: 'number' },
              y: { type: 'number' },
              width: { type: 'number' },
              height: { type: 'number' },
              text: { type: 'string' },
              file: { type: 'string' },
              url: { type: 'string', description: 'External URL for link nodes (GIFs, web images)' },
              color: { type: 'string' },
            },
          },
        },
        removeNodeIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'IDs of nodes to remove. Connected edges are also removed.',
        },
        updateNodes: {
          type: 'array',
          description: 'Nodes to update (partial update, only specified fields are changed).',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'ID of node to update (required).' },
              x: { type: 'number' },
              y: { type: 'number' },
              width: { type: 'number' },
              height: { type: 'number' },
              text: { type: 'string' },
              color: { type: 'string' },
            },
            required: ['id'],
          },
        },
        addEdges: {
          type: 'array',
          description: 'Edges to add.',
          items: {
            type: 'object',
            properties: {
              fromNode: { type: 'string' },
              toNode: { type: 'string' },
              fromSide: { type: 'string', enum: ['top', 'right', 'bottom', 'left'] },
              toSide: { type: 'string', enum: ['top', 'right', 'bottom', 'left'] },
            },
            required: ['fromNode', 'toNode'],
          },
        },
        removeEdgeIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'IDs of edges to remove.',
        },
      },
      required: ['canvasPath'],
    },
  },
];

// =============================================================================
// MAIN SERVER
// =============================================================================

const server = new Server(
  {
    name: 'quack-brain',
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
      case 'search':
        result = await handleBrainSearch(args);
        break;
      case 'smart_search':
        result = await handleBrainSmartSearch(args);
        break;
      case 'create_entity':
        result = await handleBrainCreateEntity(args);
        break;
      case 'add_observation':
        result = await handleBrainAddObservation(args);
        break;
      case 'get_graph':
        result = await handleBrainGetGraph(args);
        break;
      case 'create_relation':
        result = await handleBrainCreateRelation(args);
        break;
      case 'list_entities':
        result = await handleBrainListEntities(args);
        break;
      case 'get_backlinks':
        result = await handleBrainGetBacklinks(args);
        break;
      case 'get_wikilinks':
        result = await handleBrainGetWikilinks(args);
        break;
      case 'read_canvas':
        result = await handleBrainReadCanvas(args);
        break;
      case 'create_canvas':
        result = await handleBrainCreateCanvas(args);
        break;
      case 'update_canvas':
        result = await handleBrainUpdateCanvas(args);
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
    console.error(`[BrainMCP] Error in ${name}: ${error.message}`);
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
  console.error('[BrainMCP] Server started');

  // Cleanup handler for graceful shutdown
  process.on('SIGINT', () => {
    console.error('[BrainMCP] Shutting down...');
    if (db) {
      db.close();
    }
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.error('[BrainMCP] Shutting down...');
    if (db) {
      db.close();
    }
    process.exit(0);
  });
}

main().catch(console.error);
