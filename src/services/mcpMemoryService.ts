/**
 * MCP Memory Service
 *
 * Integrates with the MCP Memory server to read, create, and manage
 * knowledge graph entities. This provides semantic memory capabilities
 * powered by the official @modelcontextprotocol/server-memory.
 *
 * Now with direct write support via Tauri commands - no AI required!
 *
 * @module services/mcpMemoryService
 */

import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

/**
 * Raw entity from memory.jsonl file
 */
interface RawMCPEntity {
  type: string;
  name: string;
  entityType: string;
  observations: string[];
}

/**
 * Raw relation from memory.jsonl file
 */
interface RawMCPRelation {
  type: string;
  from: string;
  to: string;
  relationType: string;
}

/**
 * Raw knowledge graph from Tauri backend
 */
interface RawMCPKnowledgeGraph {
  entities: RawMCPEntity[];
  relations: RawMCPRelation[];
}

/**
 * Entity from MCP Memory knowledge graph
 */
export interface MCPEntity {
  /** Entity name (unique identifier) */
  name: string;
  /** Entity type (e.g., "preference", "fact", "decision") */
  entityType: string;
  /** Observations/facts about this entity */
  observations: string[];
}

/**
 * Relation between entities in knowledge graph
 */
export interface MCPRelation {
  /** Source entity name */
  from: string;
  /** Target entity name */
  to: string;
  /** Relation type (e.g., "uses", "prefers", "decided") */
  relationType: string;
}

/**
 * Full knowledge graph from MCP Memory
 */
export interface MCPKnowledgeGraph {
  entities: MCPEntity[];
  relations: MCPRelation[];
}

/**
 * Unified memory item for display
 * Combines Quack memories with MCP entities
 */
export interface UnifiedMemoryItem {
  /** Unique identifier */
  id: string;
  /** Display content */
  content: string;
  /** Category/type */
  category: string;
  /** Source: 'quack' for pattern-based, 'mcp' for MCP Memory */
  source: 'quack' | 'mcp';
  /** Creation timestamp (when available) */
  createdAt?: number;
  /** Confidence level (for Quack memories) */
  confidence?: 'high' | 'medium' | 'low';
  /** Scope (for Quack memories) */
  scope?: 'global' | 'project';
  /** Keywords (for Quack memories) */
  keywords?: string[];
  /** User verified (for Quack memories) */
  userVerified?: boolean;
  /** Is archived (for Quack memories) */
  isArchived?: boolean;
  /** Entity name (for MCP items) */
  entityName?: string;
  /** Entity type (for MCP items) */
  entityType?: string;
  /** Relations (for MCP items) */
  relations?: MCPRelation[];
  /** Original Quack memory data (for quack items) */
  quackMemory?: import('../types/memory').QuackMemory;
}

/**
 * Map MCP entity type to Quack category
 */
export function mapEntityTypeToCategory(entityType: string): string {
  const typeMap: Record<string, string> = {
    preference: 'preference',
    fact: 'fact',
    decision: 'decision',
    pattern: 'pattern',
    mistake: 'mistake',
    context: 'context',
    person: 'context',
    project: 'context',
    technology: 'fact',
    tool: 'fact',
    concept: 'fact',
  };

  return typeMap[entityType.toLowerCase()] || 'context';
}

/**
 * Convert MCP entity to unified memory item
 */
export function mcpEntityToUnifiedItem(
  entity: MCPEntity,
  relations: MCPRelation[] = []
): UnifiedMemoryItem {
  // Create content from observations
  const content = entity.observations.length > 0
    ? entity.observations.join(' | ')
    : entity.name;

  // Find relations for this entity
  const entityRelations = relations.filter(
    r => r.from === entity.name || r.to === entity.name
  );

  return {
    id: `mcp-${entity.name}`,
    content,
    category: mapEntityTypeToCategory(entity.entityType),
    source: 'mcp',
    entityName: entity.name,
    entityType: entity.entityType,
    relations: entityRelations,
  };
}

/**
 * Convert Quack memory to unified memory item
 */
export function quackMemoryToUnifiedItem(
  memory: import('../types/memory').QuackMemory
): UnifiedMemoryItem {
  return {
    id: memory.id,
    content: memory.content,
    category: memory.category,
    source: 'quack',
    createdAt: memory.createdAt,
    quackMemory: memory,
  };
}

/**
 * Load MCP Memory from file system
 * Reads the memory.jsonl file directly from NPX cache
 */
export async function loadMCPMemoryFromFile(): Promise<MCPKnowledgeGraph | null> {
  try {
    const rawGraph = await invoke<RawMCPKnowledgeGraph>("read_mcp_memory_file");

    // Convert raw entities to MCPEntity format
    const entities: MCPEntity[] = rawGraph.entities.map((e) => ({
      name: e.name,
      entityType: e.entityType,
      observations: e.observations,
    }));

    // Convert raw relations to MCPRelation format
    const relations: MCPRelation[] = rawGraph.relations.map((r) => ({
      from: r.from,
      to: r.to,
      relationType: r.relationType,
    }));

    console.log("[MCPMemoryService] Loaded from file:", {
      entities: entities.length,
      relations: relations.length,
    });

    return { entities, relations };
  } catch (error) {
    console.warn("[MCPMemoryService] Failed to load from file:", error);
    return null;
  }
}

/**
 * Find MCP Memory file path
 * Returns the path to memory.jsonl if found
 */
export async function findMCPMemoryPath(): Promise<string | null> {
  try {
    return await invoke<string | null>("find_mcp_memory_path");
  } catch (error) {
    console.warn("[MCPMemoryService] Failed to find memory path:", error);
    return null;
  }
}

/**
 * MCP Memory Service Class
 *
 * Note: This service is designed to work with the MCP Memory tools
 * that are available in the Claude Agent context. The actual MCP calls
 * are made by the AI agent, not directly from the frontend.
 *
 * This service provides:
 * 1. Type definitions for MCP entities
 * 2. Conversion utilities for unified display
 * 3. Helper functions for the Memory Panel
 * 4. Direct file reading for initial load
 */
export class MCPMemoryService {
  private static instance: MCPMemoryService;
  private cachedGraph: MCPKnowledgeGraph | null = null;
  private lastFetch: number = 0;
  private readonly CACHE_TTL = 30000; // 30 seconds
  private initialized: boolean = false;

  private constructor() {}

  static getInstance(): MCPMemoryService {
    if (!MCPMemoryService.instance) {
      MCPMemoryService.instance = new MCPMemoryService();
    }
    return MCPMemoryService.instance;
  }

  /**
   * Initialize by loading from file system
   * Called on app startup
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const graph = await loadMCPMemoryFromFile();
    if (graph) {
      this.setKnowledgeGraph(graph);
    }
    this.initialized = true;
  }

  /**
   * Force refresh from file system
   */
  async refreshFromFile(): Promise<void> {
    const graph = await loadMCPMemoryFromFile();
    if (graph) {
      this.setKnowledgeGraph(graph);
    }
  }

  /**
   * Store knowledge graph data fetched by AI
   * Called when AI uses mcp__memory__read_graph
   */
  setKnowledgeGraph(graph: MCPKnowledgeGraph): void {
    this.cachedGraph = graph;
    this.lastFetch = Date.now();
    console.log('[MCPMemoryService] Knowledge graph updated:', {
      entities: graph.entities.length,
      relations: graph.relations.length,
    });
  }

  /**
   * Get cached knowledge graph
   */
  getKnowledgeGraph(): MCPKnowledgeGraph | null {
    return this.cachedGraph;
  }

  /**
   * Check if cache is still valid
   */
  isCacheValid(): boolean {
    return (
      this.cachedGraph !== null &&
      Date.now() - this.lastFetch < this.CACHE_TTL
    );
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cachedGraph = null;
    this.lastFetch = 0;
  }

  /**
   * Get unified memory items from cached MCP data
   */
  getUnifiedItems(): UnifiedMemoryItem[] {
    if (!this.cachedGraph) {
      return [];
    }

    return this.cachedGraph.entities.map(entity =>
      mcpEntityToUnifiedItem(entity, this.cachedGraph?.relations || [])
    );
  }

  /**
   * Search entities by query
   */
  searchEntities(query: string): UnifiedMemoryItem[] {
    if (!this.cachedGraph) {
      return [];
    }

    const lowerQuery = query.toLowerCase();

    return this.cachedGraph.entities
      .filter(entity => {
        // Search in name
        if (entity.name.toLowerCase().includes(lowerQuery)) {
          return true;
        }
        // Search in type
        if (entity.entityType.toLowerCase().includes(lowerQuery)) {
          return true;
        }
        // Search in observations
        return entity.observations.some(obs =>
          obs.toLowerCase().includes(lowerQuery)
        );
      })
      .map(entity =>
        mcpEntityToUnifiedItem(entity, this.cachedGraph?.relations || [])
      );
  }

  /**
   * Filter entities by type
   */
  filterByType(entityType: string): UnifiedMemoryItem[] {
    if (!this.cachedGraph) {
      return [];
    }

    return this.cachedGraph.entities
      .filter(entity => entity.entityType.toLowerCase() === entityType.toLowerCase())
      .map(entity =>
        mcpEntityToUnifiedItem(entity, this.cachedGraph?.relations || [])
      );
  }

  /**
   * Get entity by name
   */
  getEntity(name: string): MCPEntity | undefined {
    return this.cachedGraph?.entities.find(e => e.name === name);
  }

  /**
   * Get relations for an entity
   */
  getRelationsForEntity(name: string): MCPRelation[] {
    if (!this.cachedGraph) {
      return [];
    }

    return this.cachedGraph.relations.filter(
      r => r.from === name || r.to === name
    );
  }
}

// Export singleton instance
export const mcpMemoryService = MCPMemoryService.getInstance();

// ============================================
// Direct Write Operations (via Tauri)
// ============================================

/**
 * Input for creating a new MCP memory entity
 */
export interface CreateMCPEntityInput {
  name: string;
  entityType: string;
  observations: string[];
}

/**
 * Create a new entity in MCP memory
 * Writes directly to memory.jsonl via Tauri command
 *
 * @param input - Entity data to create
 * @returns The created entity
 */
export async function createMCPEntity(
  input: CreateMCPEntityInput
): Promise<MCPEntity | null> {
  try {
    const entity = await invoke<MCPEntity>("write_mcp_memory_entity", {
      entity: input,
    });

    console.log("[MCPMemoryService] Entity created:", entity.name);

    // Refresh cache after write
    await mcpMemoryService.refreshFromFile();

    return entity;
  } catch (error) {
    console.error("[MCPMemoryService] Failed to create entity:", error);
    toast.error("Failed to create memory");
    return null;
  }
}

/**
 * Delete an entity from MCP memory by name
 *
 * @param name - Entity name to delete
 * @returns true if deleted, false if not found
 */
export async function deleteMCPEntity(name: string): Promise<boolean> {
  try {
    const deleted = await invoke<boolean>("delete_mcp_memory_entity", { name });

    if (deleted) {
      console.log("[MCPMemoryService] Entity deleted:", name);
      // Refresh cache after delete
      await mcpMemoryService.refreshFromFile();
    } else {
      console.warn("[MCPMemoryService] Entity not found:", name);
    }

    return deleted;
  } catch (error) {
    console.error("[MCPMemoryService] Failed to delete entity:", error);
    toast.error("Failed to delete memory");
    return false;
  }
}

/**
 * Add observations to an existing MCP entity
 *
 * @param name - Entity name
 * @param observations - New observations to add
 * @returns true if updated, false if entity not found
 */
export async function addMCPObservations(
  name: string,
  observations: string[]
): Promise<boolean> {
  try {
    const updated = await invoke<boolean>("add_mcp_memory_observations", {
      name,
      observations,
    });

    if (updated) {
      console.log("[MCPMemoryService] Observations added to:", name);
      // Refresh cache after update
      await mcpMemoryService.refreshFromFile();
    } else {
      console.warn("[MCPMemoryService] Entity not found:", name);
    }

    return updated;
  } catch (error) {
    console.error("[MCPMemoryService] Failed to add observations:", error);
    toast.error("Failed to update memory");
    return false;
  }
}

/**
 * Helper: Generate a unique entity name from content
 * Converts content to a valid entity name format
 */
export function generateEntityName(content: string): string {
  // Take first 50 chars, convert to lowercase, replace spaces with underscores
  const base = content
    .slice(0, 50)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "_");

  // Add timestamp for uniqueness
  const timestamp = Date.now().toString(36);

  return `${base}_${timestamp}`;
}

/**
 * Helper: Map category to MCP entity type
 */
export function categoryToEntityType(category: string): string {
  const typeMap: Record<string, string> = {
    preference: "preference",
    fact: "fact",
    decision: "decision",
    pattern: "pattern",
    mistake: "mistake",
    context: "context",
    task: "task",
    note: "note",
    idea: "idea",
    person: "person",
    project: "project",
  };

  return typeMap[category.toLowerCase()] || "fact";
}

/**
 * Input for creating a new MCP relation
 */
export interface CreateMCPRelationInput {
  from: string;
  to: string;
  relationType: string;
}

/**
 * Create a relation between two entities in MCP memory
 *
 * @param input - Relation data (from, to, relationType)
 * @returns The created relation or null on failure
 */
export async function createMCPRelation(
  input: CreateMCPRelationInput
): Promise<MCPRelation | null> {
  try {
    const relation = await invoke<MCPRelation>("write_mcp_memory_relation", {
      relation: input,
    });

    console.log("[MCPMemoryService] Relation created:", `${input.from} -> ${input.to}`);

    // Refresh cache after write
    await mcpMemoryService.refreshFromFile();

    return relation;
  } catch (error) {
    console.error("[MCPMemoryService] Failed to create relation:", error);
    toast.error("Failed to create relation");
    return null;
  }
}

/**
 * Delete a relation from MCP memory
 *
 * @param from - Source entity name
 * @param to - Target entity name
 * @returns true if deleted, false if not found
 */
export async function deleteMCPRelation(from: string, to: string): Promise<boolean> {
  try {
    const deleted = await invoke<boolean>("delete_mcp_memory_relation", { from, to });

    if (deleted) {
      console.log("[MCPMemoryService] Relation deleted:", `${from} -> ${to}`);
      // Refresh cache after delete
      await mcpMemoryService.refreshFromFile();
    } else {
      console.warn("[MCPMemoryService] Relation not found:", `${from} -> ${to}`);
    }

    return deleted;
  } catch (error) {
    console.error("[MCPMemoryService] Failed to delete relation:", error);
    toast.error("Failed to delete relation");
    return false;
  }
}

/**
 * Map category to relation type for @mentions
 */
export function categoryToRelationType(category: string): string {
  const typeMap: Record<string, string> = {
    preference: "prefers",
    fact: "has_attribute",
    decision: "decided_on",
    pattern: "follows_pattern",
    mistake: "made_mistake_with",
    context: "relates_to",
    task: "assigned_to",
    note: "notes_about",
    idea: "has_idea_for",
  };

  return typeMap[category.toLowerCase()] || "relates_to";
}

/**
 * Update (replace) all observations for an MCP entity
 * Used for updating entity title (observations[0]) and other observations
 *
 * @param name - Entity name
 * @param observations - New observations array (replaces all existing)
 * @returns true if updated, false if entity not found
 */
export async function updateMCPObservations(
  name: string,
  observations: string[]
): Promise<boolean> {
  try {
    const updated = await invoke<boolean>("update_mcp_memory_observations", {
      name,
      observations,
    });

    if (updated) {
      console.log("[MCPMemoryService] Observations updated for:", name);
      // Refresh cache after update
      await mcpMemoryService.refreshFromFile();
      // Emit event so UI components can react
      window.dispatchEvent(new CustomEvent('MCP_MEMORY_UPDATED'));
    } else {
      console.warn("[MCPMemoryService] Entity not found:", name);
    }

    return updated;
  } catch (error) {
    console.error("[MCPMemoryService] Failed to update observations:", error);
    toast.error("Failed to update entity");
    return false;
  }
}
