/**
 * Quack Brain - Type Definitions
 *
 * TypeScript types for the unified memory system (Quack Brain).
 * Provides SQLite-backed knowledge graph with MCP Memory compatibility.
 *
 * @module types/brain
 */

/**
 * Brain entity - core knowledge unit
 *
 * Represents a single entity in the knowledge graph.
 * Similar to MCP Memory entities but backed by SQLite.
 */
export interface BrainEntity {
  /** Unique identifier (UUID) */
  id: string;

  /** Entity name (e.g., "user_preferences", "project_quack") */
  name: string;

  /** Entity type (e.g., "preference", "project", "decision") */
  entityType: string;

  /** Observations attached to this entity */
  observations: BrainObservation[];

  /** Project ID if this entity belongs to a project */
  projectId: string | null;

  /** Creation timestamp (Unix ms) */
  createdAt: number;

  /** Last update timestamp (Unix ms) */
  updatedAt: number;

  /** Optional path to markdown file representation */
  mdFilePath: string | null;
}

/**
 * Observation attached to an entity
 *
 * Observations are timestamped pieces of information
 * attached to entities. Multiple observations can be
 * added to a single entity over time.
 */
export interface BrainObservation {
  /** Unique identifier (UUID) */
  id: string;

  /** Observation content (natural language) */
  content: string;

  /** Creation timestamp (Unix ms) */
  createdAt: number;
}

/**
 * Relation between two entities
 *
 * Represents a typed connection between entities
 * in the knowledge graph (e.g., "belongs_to_project").
 */
export interface BrainRelation {
  /** Unique identifier (UUID) */
  id: string;

  /** Source entity ID */
  fromEntityId: string;

  /** Target entity ID */
  toEntityId: string;

  /** Relation type (e.g., "belongs_to_project", "relates_to") */
  relationType: string;

  /** Creation timestamp (Unix ms) */
  createdAt: number;
}

/**
 * Registered project
 *
 * Projects can have entities scoped to them.
 * This allows filtering memories by project context.
 */
export interface BrainProject {
  /** Unique identifier (UUID) */
  id: string;

  /** Project name */
  name: string;

  /** Absolute filesystem path to project */
  path: string;

  /** Creation timestamp (Unix ms) */
  createdAt: number;

  /** Last access timestamp (Unix ms) */
  lastAccessedAt: number;
}

/**
 * Full knowledge graph
 *
 * Complete snapshot of the knowledge graph
 * including all entities and their relations.
 */
export interface BrainGraph {
  /** All entities in the graph */
  entities: BrainEntity[];

  /** All relations in the graph */
  relations: BrainRelation[];
}

/**
 * Input for creating entity
 *
 * Used when creating a new entity via the API.
 */
export interface CreateEntityInput {
  /** Entity name (unique identifier) */
  name: string;

  /** Entity type (for filtering) */
  entityType: string;

  /** Initial observations (content strings) */
  observations: string[];

  /** Optional project ID to scope this entity */
  projectId?: string | null;
}

/**
 * Input for updating entity
 *
 * Used when updating an existing entity.
 * Only provided fields will be updated.
 */
export interface UpdateEntityInput {
  /** New name (optional) */
  name?: string;

  /** New entity type (optional) */
  entityType?: string;
}

/**
 * Filters for listing entities
 *
 * Used when querying entities from the graph.
 * All filters are optional and combined with AND logic.
 */
export interface EntityFilters {
  /** Filter by project ID (null = global entities) */
  projectId?: string | null;

  /** Filter by entity type */
  entityType?: string;

  /** Full-text search query */
  searchQuery?: string;
}

/**
 * Search result with relevance score
 *
 * Returned from full-text search operations.
 */
export interface BrainSearchResult {
  /** The matching entity */
  entity: BrainEntity;

  /** Relevance score (0-1, higher is more relevant) */
  score: number;
}

/**
 * Entity types supported by Brain
 *
 * Standard entity types for consistent categorization.
 * Custom types are also supported.
 */
export type BrainEntityType =
  | 'preference' // User preferences and working style
  | 'fact' // Project facts and technical details
  | 'decision' // Architectural decisions and rationale
  | 'pattern' // Code patterns and conventions
  | 'bug_fix' // Solutions to bugs and issues
  | 'person' // People and their roles
  | 'project' // Project metadata
  | 'diary' // Daily logs and session summaries
  | 'document' // Documentation references
  | 'gotcha' // Common pitfalls and warnings
  | 'tool' // Tools and their configurations
  | 'technology'; // Technologies and libraries

/**
 * Relation types
 *
 * Standard relation types for consistent linking.
 * Custom types are also supported.
 */
export type BrainRelationType =
  | 'belongs_to_project' // Entity is scoped to a project
  | 'relates_to' // Generic relation between entities
  | 'depends_on' // Dependency relation
  | 'created_by' // Created by person/agent
  | 'uses' // Uses technology/tool
  | 'documented_in'; // Documented in file/doc

/**
 * Semantic search result
 *
 * Result from semantic search using vector embeddings.
 * Returns entities ranked by cosine similarity to query.
 */
export interface SemanticSearchResult {
  /** Entity ID */
  entityId: string;

  /** Entity name */
  entityName: string;

  /** Entity type */
  entityType: string;

  /** Cosine similarity score (0-1, higher is more similar) */
  score: number;
}

/**
 * Hybrid search result
 *
 * Result from hybrid search combining FTS and semantic search.
 * Uses Reciprocal Rank Fusion (RRF) to merge results.
 */
export interface HybridSearchResult {
  /** Entity ID */
  entityId: string;

  /** Entity name */
  entityName: string;

  /** Entity type */
  entityType: string;

  /** Combined RRF score (higher is better match) */
  score: number;
}
