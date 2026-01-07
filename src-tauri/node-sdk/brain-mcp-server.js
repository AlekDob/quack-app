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
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
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
// HELPER FUNCTIONS
// =============================================================================

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
 */
async function handleBrainSearch(args) {
  const { query, limit = 10 } = args;

  console.error(`[BrainMCP] Search: "${query}" (limit: ${limit})`);

  try {
    const db = getDb();

    // Use FTS5 search
    const results = db.prepare(`
      SELECT e.id, e.name, e.entity_type, rank
      FROM entities e
      JOIN entities_fts fts ON e.rowid = fts.rowid
      WHERE entities_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `).all(query, limit);

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
 * Handle brain_create_entity tool
 * Create a new entity with observations
 */
async function handleBrainCreateEntity(args) {
  const { name, entityType, observations = [], projectId = null } = args;

  console.error(`[BrainMCP] Creating entity: "${name}" (type: ${entityType})`);

  try {
    const db = getDb();
    const entityId = uuid();
    const timestamp = now();

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

    const entity = getEntityWithObservations(entityId);

    console.error(`[BrainMCP] Created entity: ${entityId}`);

    return JSON.stringify({
      success: true,
      message: `Entity "${name}" created successfully`,
      entity,
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

    return JSON.stringify({
      success: true,
      message: 'Observation added successfully',
      entity,
      observation: {
        id: obsId,
        content,
        createdAt: timestamp,
      },
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

// =============================================================================
// TOOL DEFINITIONS
// =============================================================================

const TOOLS = [
  {
    name: 'brain_search',
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
    name: 'brain_create_entity',
    description: 'Create a new entity in the Quack Brain knowledge graph. Use this to save new memories, patterns, decisions, or other knowledge.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Unique name for the entity (e.g., "user_preferences", "auth_pattern").',
        },
        entityType: {
          type: 'string',
          description: 'Type of entity: preference, fact, decision, pattern, bug_fix, person, project, diary, document, gotcha, tool, technology.',
        },
        observations: {
          type: 'array',
          items: { type: 'string' },
          default: [],
          description: 'Initial observations (facts/notes) to attach to this entity.',
        },
        projectId: {
          type: 'string',
          description: 'Optional project ID to scope this entity to a specific project.',
        },
      },
      required: ['name', 'entityType'],
    },
  },
  {
    name: 'brain_add_observation',
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
    name: 'brain_get_graph',
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
    name: 'brain_create_relation',
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
    name: 'brain_list_entities',
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
];

// =============================================================================
// MAIN SERVER
// =============================================================================

const server = new Server(
  {
    name: 'brain-tools',
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
      case 'brain_search':
        result = await handleBrainSearch(args);
        break;
      case 'brain_create_entity':
        result = await handleBrainCreateEntity(args);
        break;
      case 'brain_add_observation':
        result = await handleBrainAddObservation(args);
        break;
      case 'brain_get_graph':
        result = await handleBrainGetGraph(args);
        break;
      case 'brain_create_relation':
        result = await handleBrainCreateRelation(args);
        break;
      case 'brain_list_entities':
        result = await handleBrainListEntities(args);
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
