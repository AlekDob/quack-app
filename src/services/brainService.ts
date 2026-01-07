/**
 * Brain Service
 *
 * Provides access to Quack Brain - the unified memory system.
 * Uses SQLite backend via Tauri commands for persistent storage.
 *
 * @module services/brainService
 */

import { invoke } from '@tauri-apps/api/core';
import type {
  BrainEntity,
  BrainObservation,
  BrainRelation,
  BrainProject,
  BrainGraph,
  CreateEntityInput,
  UpdateEntityInput,
  EntityFilters,
  BrainSearchResult,
  SemanticSearchResult,
  HybridSearchResult,
} from '../types/brain';

/**
 * Event emitted when Brain data is updated
 *
 * Components should listen to this event to refresh their data.
 */
export const BRAIN_UPDATED_EVENT = 'quack-brain-updated';

/**
 * Dispatch update event to notify UI of changes
 *
 * @internal
 */
const dispatchBrainUpdatedEvent = () => {
  window.dispatchEvent(new CustomEvent(BRAIN_UPDATED_EVENT));
};

// =============================================================================
// Core Operations
// =============================================================================

/**
 * Initialize Brain database
 *
 * Called on app startup to ensure database is ready.
 * Safe to call multiple times (idempotent).
 *
 * @example
 * ```typescript
 * await initBrain();
 * console.log('Brain database ready');
 * ```
 */
export async function initBrain(): Promise<void> {
  await invoke('brain_init');
  console.log('[BrainService] Database initialized');
}

// =============================================================================
// Entity Operations
// =============================================================================

/**
 * Create a new entity
 *
 * @param input - Entity creation data
 * @returns The created entity with generated ID
 *
 * @example
 * ```typescript
 * const entity = await createEntity({
 *   name: 'user_preferences',
 *   entityType: 'preference',
 *   observations: ['Prefers TypeScript strict mode'],
 *   projectId: null, // Global entity
 * });
 * ```
 */
export async function createEntity(input: CreateEntityInput): Promise<BrainEntity> {
  const entity = await invoke<BrainEntity>('brain_create_entity', { input });
  console.log('[BrainService] Entity created:', entity.name);
  dispatchBrainUpdatedEvent();
  return entity;
}

/**
 * Update an existing entity
 *
 * @param id - Entity ID to update
 * @param updates - Fields to update (partial)
 * @returns The updated entity
 *
 * @example
 * ```typescript
 * const updated = await updateEntity('entity-id', {
 *   name: 'new_name',
 *   entityType: 'pattern',
 * });
 * ```
 */
export async function updateEntity(id: string, updates: UpdateEntityInput): Promise<BrainEntity> {
  const entity = await invoke<BrainEntity>('brain_update_entity', { id, updates });
  console.log('[BrainService] Entity updated:', entity.name);
  dispatchBrainUpdatedEvent();
  return entity;
}

/**
 * Delete an entity
 *
 * Permanently removes the entity and all its observations.
 * Relations involving this entity are also deleted.
 *
 * @param id - Entity ID to delete
 *
 * @example
 * ```typescript
 * await deleteEntity('entity-id');
 * ```
 */
export async function deleteEntity(id: string): Promise<void> {
  await invoke('brain_delete_entity', { id });
  console.log('[BrainService] Entity deleted:', id);
  dispatchBrainUpdatedEvent();
}

/**
 * Get a single entity by ID
 *
 * @param id - Entity ID to retrieve
 * @returns The entity or null if not found
 *
 * @example
 * ```typescript
 * const entity = await getEntity('entity-id');
 * if (entity) {
 *   console.log('Found:', entity.name);
 * }
 * ```
 */
export async function getEntity(id: string): Promise<BrainEntity | null> {
  return invoke<BrainEntity | null>('brain_get_entity', { id });
}

/**
 * List entities with optional filters
 *
 * @param filters - Optional filters (project, type, search)
 * @returns Array of matching entities
 *
 * @example
 * ```typescript
 * // Get all global entities
 * const global = await listEntities({ projectId: null });
 *
 * // Get project-specific patterns
 * const patterns = await listEntities({
 *   projectId: 'project-id',
 *   entityType: 'pattern',
 * });
 * ```
 */
export async function listEntities(filters?: EntityFilters): Promise<BrainEntity[]> {
  return invoke<BrainEntity[]>('brain_list_entities', { filters: filters || {} });
}

/**
 * Full-text search entities
 *
 * Searches entity names and observations for matching text.
 * Returns results sorted by relevance score.
 *
 * @param query - Search query string
 * @returns Array of search results with scores
 *
 * @example
 * ```typescript
 * const results = await searchEntities('authentication');
 * results.forEach(({ entity, score }) => {
 *   console.log(`${entity.name} (score: ${score})`);
 * });
 * ```
 */
export async function searchEntities(query: string): Promise<BrainEntity[]> {
  return invoke<BrainEntity[]>('brain_search', { query });
}

// =============================================================================
// Observation Operations
// =============================================================================

/**
 * Add observation to entity
 *
 * Observations are timestamped notes attached to entities.
 * Multiple observations can be added over time.
 *
 * @param entityId - Target entity ID
 * @param content - Observation content
 * @returns The created observation
 *
 * @example
 * ```typescript
 * const obs = await addObservation('entity-id', '[2025-01-05] Fixed bug in authentication');
 * ```
 */
export async function addObservation(
  entityId: string,
  content: string
): Promise<BrainObservation> {
  const obs = await invoke<BrainObservation>('brain_add_observation', { entityId, content });
  console.log('[BrainService] Observation added to:', entityId);
  dispatchBrainUpdatedEvent();
  return obs;
}

/**
 * Delete an observation
 *
 * Removes a specific observation from its entity.
 * The entity itself is not deleted.
 *
 * @param id - Observation ID to delete
 *
 * @example
 * ```typescript
 * await deleteObservation('observation-id');
 * ```
 */
export async function deleteObservation(id: string): Promise<void> {
  await invoke('brain_delete_observation', { id });
  console.log('[BrainService] Observation deleted:', id);
  dispatchBrainUpdatedEvent();
}

// =============================================================================
// Relation Operations
// =============================================================================

/**
 * Create a relation between entities
 *
 * Links two entities with a typed relation.
 * Common relation types: belongs_to_project, relates_to, depends_on.
 *
 * @param fromEntityId - Source entity ID
 * @param toEntityId - Target entity ID
 * @param relationType - Relation type
 * @returns The created relation
 *
 * @example
 * ```typescript
 * // Link pattern to project
 * await createRelation(
 *   'pattern-entity-id',
 *   'project-entity-id',
 *   'belongs_to_project'
 * );
 * ```
 */
export async function createRelation(
  fromEntityId: string,
  toEntityId: string,
  relationType: string
): Promise<BrainRelation> {
  const relation = await invoke<BrainRelation>('brain_create_relation', {
    fromEntityId,
    toEntityId,
    relationType,
  });
  console.log('[BrainService] Relation created:', `${fromEntityId} -> ${toEntityId}`);
  dispatchBrainUpdatedEvent();
  return relation;
}

/**
 * Delete a relation
 *
 * Removes a specific relation between entities.
 * The entities themselves are not deleted.
 *
 * @param id - Relation ID to delete
 *
 * @example
 * ```typescript
 * await deleteRelation('relation-id');
 * ```
 */
export async function deleteRelation(id: string): Promise<void> {
  await invoke('brain_delete_relation', { id });
  console.log('[BrainService] Relation deleted:', id);
  dispatchBrainUpdatedEvent();
}

// =============================================================================
// Graph Operations
// =============================================================================

/**
 * Get the full knowledge graph
 *
 * Returns all entities and relations in the graph.
 * For compatibility with existing MCP Memory UI.
 *
 * @returns Complete graph snapshot
 *
 * @example
 * ```typescript
 * const { entities, relations } = await getGraph();
 * console.log(`Loaded ${entities.length} entities, ${relations.length} relations`);
 * ```
 */
export async function getGraph(): Promise<BrainGraph> {
  return invoke<BrainGraph>('brain_get_graph');
}

// =============================================================================
// Project Operations
// =============================================================================

/**
 * Register a project
 *
 * Registers a project in the Brain to enable project-scoped entities.
 * Projects are identified by their filesystem path.
 *
 * @param name - Project name
 * @param path - Absolute filesystem path
 * @returns The registered project
 *
 * @example
 * ```typescript
 * const project = await registerProject('quack-app', '/Users/user/quack-app');
 * console.log('Project registered:', project.id);
 * ```
 */
export async function registerProject(name: string, path: string): Promise<BrainProject> {
  const project = await invoke<BrainProject>('brain_register_project', { name, path });
  console.log('[BrainService] Project registered:', name);
  return project;
}

/**
 * Get all registered projects
 *
 * @returns Array of all projects
 *
 * @example
 * ```typescript
 * const projects = await listProjects();
 * projects.forEach(p => console.log(p.name, p.path));
 * ```
 */
export async function listProjects(): Promise<BrainProject[]> {
  return invoke<BrainProject[]>('brain_list_projects');
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create entity with project scope
 *
 * Convenience function to create a project-scoped entity.
 *
 * @param input - Entity creation data
 * @param projectId - Project ID to scope to
 * @returns The created entity
 *
 * @example
 * ```typescript
 * const entity = await createProjectScopedEntity(
 *   {
 *     name: 'auth_pattern',
 *     entityType: 'pattern',
 *     observations: ['Use JWT tokens'],
 *   },
 *   'project-id'
 * );
 * ```
 */
export async function createProjectScopedEntity(
  input: CreateEntityInput,
  projectId: string
): Promise<BrainEntity> {
  return createEntity({ ...input, projectId });
}

/**
 * Get entities for current project
 *
 * Convenience function to filter entities by project.
 *
 * @param projectId - Project ID to filter by
 * @returns Array of project entities
 *
 * @example
 * ```typescript
 * const entities = await getProjectEntities('project-id');
 * console.log(`Found ${entities.length} project entities`);
 * ```
 */
export async function getProjectEntities(projectId: string): Promise<BrainEntity[]> {
  return listEntities({ projectId });
}

/**
 * Get global entities (not scoped to any project)
 *
 * Convenience function to filter global entities.
 *
 * @returns Array of global entities
 *
 * @example
 * ```typescript
 * const global = await getGlobalEntities();
 * console.log(`Found ${global.length} global entities`);
 * ```
 */
export async function getGlobalEntities(): Promise<BrainEntity[]> {
  const all = await listEntities();
  return all.filter(e => !e.projectId);
}

// =============================================================================
// Singleton Service
// =============================================================================

/**
 * Singleton Brain service instance
 *
 * Provides a single point of access to Brain operations.
 * Handles initialization state and proxies all operations.
 *
 * @example
 * ```typescript
 * import { brainService } from '@/services/brainService';
 *
 * // Initialize on app startup
 * await brainService.initialize();
 *
 * // Use service methods
 * const entity = await brainService.createEntity({...});
 * ```
 */
class BrainService {
  private static instance: BrainService;
  private initialized = false;

  /**
   * Get singleton instance
   */
  static getInstance(): BrainService {
    if (!BrainService.instance) {
      BrainService.instance = new BrainService();
    }
    return BrainService.instance;
  }

  /**
   * Initialize Brain database
   *
   * Must be called before using Brain operations.
   * Safe to call multiple times (idempotent).
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    await initBrain();
    this.initialized = true;
  }

  /**
   * Check if Brain is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  // Proxy all operations to module functions
  createEntity = createEntity;
  updateEntity = updateEntity;
  deleteEntity = deleteEntity;
  getEntity = getEntity;
  listEntities = listEntities;
  searchEntities = searchEntities;
  addObservation = addObservation;
  deleteObservation = deleteObservation;
  createRelation = createRelation;
  deleteRelation = deleteRelation;
  getGraph = getGraph;
  registerProject = registerProject;
  listProjects = listProjects;
  createProjectScopedEntity = createProjectScopedEntity;
  getProjectEntities = getProjectEntities;
  getGlobalEntities = getGlobalEntities;

  // Migration operations (defined below)
  importFromMCPMemory = importFromMCPMemory;
  importFromQuackMemory = importFromQuackMemory;
  getMigrationStatus = getMigrationStatus;

  // Markdown sync operations (defined below)
  syncEntityToMarkdown = syncEntityToMarkdown;
  syncAllToMarkdown = syncAllToMarkdown;
  getMarkdownPath = getMarkdownPath;
  openMarkdownFolder = openMarkdownFolder;

  // Semantic search operations (defined below)
  storeEmbedding = storeEmbedding;
  getEmbedding = getEmbedding;
  getEntitiesWithoutEmbeddings = getEntitiesWithoutEmbeddings;
  semanticSearch = semanticSearch;
  hybridSearch = hybridSearch;
}

/**
 * Default export: singleton service instance
 *
 * Use this for all Brain operations in your app.
 */
export const brainService = BrainService.getInstance();

// =============================================================================
// Migration Functions
// =============================================================================

/**
 * Import result with detailed statistics
 */
export interface ImportResult {
  importedEntities: number;
  importedRelations: number;
  skipped: number;
  errors: string[];
}

/**
 * Migration status showing available data sources
 */
export interface MigrationStatus {
  mcpMemoryAvailable: boolean;
  mcpMemoryCount: number;
  quackMemoryCount: number;
  brainEntityCount: number;
}

/**
 * Import from MCP Memory (memory.jsonl)
 *
 * Searches for MCP Memory installation in NPX cache and imports all entities/relations.
 * Skips duplicates based on entity name. Idempotent operation - safe to run multiple times.
 *
 * @returns Import statistics including imported/skipped counts and errors
 *
 * @example
 * ```typescript
 * const result = await importFromMCPMemory();
 * console.log(`Imported ${result.importedEntities} entities`);
 * console.log(`Skipped ${result.skipped} duplicates`);
 * if (result.errors.length > 0) {
 *   console.warn('Errors:', result.errors);
 * }
 * ```
 */
export async function importFromMCPMemory(): Promise<ImportResult> {
  const result = await invoke<ImportResult>('brain_import_mcp_memory');
  console.log('[BrainService] MCP Memory imported:', result);
  dispatchBrainUpdatedEvent();
  return result;
}

/**
 * Import from Quack Memory (quack-memories.json)
 *
 * Imports legacy Quack memories into Brain. Generates entity names from content.
 * Skips duplicates. Idempotent operation - safe to run multiple times.
 *
 * @returns Import statistics including imported/skipped counts and errors
 *
 * @example
 * ```typescript
 * const result = await importFromQuackMemory();
 * console.log(`Imported ${result.importedEntities} entities`);
 * console.log(`Skipped ${result.skipped} duplicates`);
 * ```
 */
export async function importFromQuackMemory(): Promise<ImportResult> {
  const result = await invoke<ImportResult>('brain_import_quack_memory');
  console.log('[BrainService] Quack Memory imported:', result);
  dispatchBrainUpdatedEvent();
  return result;
}

/**
 * Get migration status
 *
 * Returns counts of available entities in each data source and current Brain state.
 * Use this to show migration UI and determine what can be imported.
 *
 * @returns Migration status with entity counts
 *
 * @example
 * ```typescript
 * const status = await getMigrationStatus();
 * console.log(`MCP Memory: ${status.mcpMemoryCount} entities`);
 * console.log(`Quack Memory: ${status.quackMemoryCount} entities`);
 * console.log(`Brain: ${status.brainEntityCount} entities`);
 *
 * if (status.mcpMemoryAvailable && status.mcpMemoryCount > 0) {
 *   console.log('MCP Memory import available');
 * }
 * ```
 */
export async function getMigrationStatus(): Promise<MigrationStatus> {
  return invoke<MigrationStatus>('brain_get_migration_status');
}

// =============================================================================
// Markdown Sync Functions
// =============================================================================

/**
 * Sync result with file statistics
 */
export interface SyncResult {
  filesCreated: number;
  filesUpdated: number;
  errors: string[];
}

/**
 * Sync a single entity to markdown file
 *
 * Generates Obsidian-compatible markdown with YAML frontmatter.
 * Updates the entity's `md_file_path` field in the database.
 *
 * @param entityId - Entity ID to sync
 * @returns The file path where the markdown was saved
 *
 * @example
 * ```typescript
 * const path = await syncEntityToMarkdown('entity-id');
 * console.log('Synced to:', path);
 * ```
 */
export async function syncEntityToMarkdown(entityId: string): Promise<string> {
  const path = await invoke<string>('brain_sync_entity_to_md', { entityId });
  console.log('[BrainService] Entity synced to:', path);
  return path;
}

/**
 * Sync all entities to markdown files
 *
 * Performs a bulk export of all entities to markdown.
 * Creates/updates files in `~/.quack/brain/markdown/`.
 * Organizes by project or type based on entity scope.
 *
 * @returns Sync result with statistics
 *
 * @example
 * ```typescript
 * const result = await syncAllToMarkdown();
 * console.log(`Created: ${result.filesCreated}`);
 * console.log(`Updated: ${result.filesUpdated}`);
 * if (result.errors.length > 0) {
 *   console.warn('Errors:', result.errors);
 * }
 * ```
 */
export async function syncAllToMarkdown(): Promise<SyncResult> {
  const result = await invoke<SyncResult>('brain_sync_all_to_md');
  console.log('[BrainService] All entities synced:', result);
  return result;
}

/**
 * Get markdown export directory path
 *
 * Returns the absolute path to the markdown export directory.
 * Useful for displaying to users or opening in external apps.
 *
 * @returns Absolute path to `~/.quack/brain/markdown/`
 *
 * @example
 * ```typescript
 * const path = await getMarkdownPath();
 * console.log('Markdown files at:', path);
 * ```
 */
export async function getMarkdownPath(): Promise<string> {
  return invoke<string>('brain_get_markdown_path');
}

/**
 * Open markdown folder in system file browser
 *
 * Opens the markdown export directory using the system's default file browser:
 * - macOS: Finder
 * - Windows: Explorer
 * - Linux: xdg-open
 *
 * @example
 * ```typescript
 * await openMarkdownFolder();
 * ```
 */
export async function openMarkdownFolder(): Promise<void> {
  await invoke('brain_open_markdown_folder');
}

// =============================================================================
// Semantic Search Functions
// =============================================================================

/**
 * Store embedding for an entity
 *
 * Stores a vector embedding for an entity to enable semantic search.
 * Embeddings should be generated using a consistent model (e.g., all-MiniLM-L6-v2).
 *
 * @param entityId - Entity ID to store embedding for
 * @param vector - Embedding vector (typically 384 dimensions for MiniLM)
 * @param model - Model name used to generate embedding
 *
 * @example
 * ```typescript
 * const vector = await generateEmbedding('entity content here');
 * await storeEmbedding('entity-id', vector, 'all-MiniLM-L6-v2');
 * ```
 */
export async function storeEmbedding(
  entityId: string,
  vector: number[],
  model: string = 'all-MiniLM-L6-v2'
): Promise<void> {
  await invoke('brain_store_embedding', { entityId, vector, model });
  console.log('[BrainService] Embedding stored for:', entityId);
}

/**
 * Get embedding for an entity
 *
 * Retrieves the stored embedding vector for an entity.
 *
 * @param entityId - Entity ID to retrieve embedding for
 * @returns Embedding vector or null if not found
 *
 * @example
 * ```typescript
 * const vector = await getEmbedding('entity-id');
 * if (vector) {
 *   console.log('Embedding dimensions:', vector.length);
 * }
 * ```
 */
export async function getEmbedding(entityId: string): Promise<number[] | null> {
  return invoke<number[] | null>('brain_get_embedding', { entityId });
}

/**
 * Get entities that need embeddings
 *
 * Returns list of entity IDs that don't have embeddings yet.
 * Use this to identify entities that need embedding generation.
 *
 * @returns Array of entity IDs without embeddings
 *
 * @example
 * ```typescript
 * const needEmbeddings = await getEntitiesWithoutEmbeddings();
 * console.log(`${needEmbeddings.length} entities need embeddings`);
 *
 * for (const entityId of needEmbeddings) {
 *   const entity = await getEntity(entityId);
 *   const vector = await generateEmbedding(entity.name + ' ' + entity.observations.join(' '));
 *   await storeEmbedding(entityId, vector);
 * }
 * ```
 */
export async function getEntitiesWithoutEmbeddings(): Promise<string[]> {
  return invoke<string[]>('brain_get_entities_without_embeddings');
}

/**
 * Semantic search using query vector
 *
 * Searches entities using vector similarity (cosine similarity).
 * Returns entities ranked by semantic similarity to the query.
 *
 * @param queryVector - Query embedding vector
 * @param limit - Maximum number of results (default: 10)
 * @returns Array of search results with similarity scores
 *
 * @example
 * ```typescript
 * const queryVector = await generateEmbedding('authentication patterns');
 * const results = await semanticSearch(queryVector, 5);
 *
 * results.forEach(({ entityName, score }) => {
 *   console.log(`${entityName}: ${(score * 100).toFixed(1)}% similar`);
 * });
 * ```
 */
export async function semanticSearch(
  queryVector: number[],
  limit: number = 10
): Promise<SemanticSearchResult[]> {
  return invoke<SemanticSearchResult[]>('brain_semantic_search', { queryVector, limit });
}

/**
 * Hybrid search (FTS + semantic)
 *
 * Combines full-text search (BM25) with semantic search using Reciprocal Rank Fusion.
 * Provides best-of-both-worlds: keyword matching + semantic understanding.
 *
 * @param query - Search query string (for FTS)
 * @param queryVector - Optional query embedding vector (for semantic search)
 * @param limit - Maximum number of results (default: 10)
 * @returns Array of search results with combined scores
 *
 * @example
 * ```typescript
 * // Hybrid search with both FTS and semantic
 * const queryVector = await generateEmbedding('bug fix authentication');
 * const results = await hybridSearch('authentication bug', queryVector, 5);
 *
 * // FTS-only search (no vector)
 * const ftsResults = await hybridSearch('authentication', undefined, 5);
 * ```
 */
export async function hybridSearch(
  query: string,
  queryVector?: number[],
  limit: number = 10
): Promise<HybridSearchResult[]> {
  return invoke<HybridSearchResult[]>('brain_hybrid_search', {
    query,
    queryVector: queryVector || null,
    limit
  });
}

// =============================================================================
// MCP Memory Compatibility Layer
// =============================================================================
// These functions provide compatibility with the old mcpMemoryService API
// so that InlineOutliner and other components can use Brain without changes.

/**
 * Generate entity name from content (slug-style)
 * @param content - Content to generate name from
 * @returns Snake-case entity name with random suffix
 */
export function generateEntityName(content: string): string {
  const slug = content
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 40);
  const suffix = Math.random().toString(36).substring(2, 10);
  return `${slug}_${suffix}`;
}

/**
 * Map category/supertag to normalized entity type
 * @param category - Category name from UI
 * @returns Normalized entity type for database
 */
export function categoryToEntityType(category: string): string {
  const typeMap: Record<string, string> = {
    preference: 'preference',
    fact: 'fact',
    decision: 'decision',
    pattern: 'pattern',
    bug_fix: 'bug_fix',
    person: 'person',
    project: 'project',
    diary: 'diary',
    document: 'document',
    gotcha: 'gotcha',
    tool: 'tool',
    technology: 'technology',
  };
  return typeMap[category.toLowerCase()] || category.toLowerCase();
}

/**
 * Map category to relation type
 * @param category - Category name
 * @returns Default relation type for this category
 */
export function categoryToRelationType(category: string): string {
  const relationMap: Record<string, string> = {
    project: 'belongs_to_project',
    person: 'created_by',
    technology: 'uses',
    document: 'documented_in',
  };
  return relationMap[category.toLowerCase()] || 'relates_to';
}

/**
 * Create entity (MCP-compatible API)
 *
 * @param data - Entity data with name, entityType, observations
 * @returns Created entity
 */
export async function createBrainEntity(data: {
  name: string;
  entityType: string;
  observations: string[];
}): Promise<BrainEntity> {
  return createEntity({
    name: data.name,
    entityType: data.entityType,
    observations: data.observations,
    projectId: undefined,
  });
}

/**
 * Create project-scoped entity (MCP-compatible API)
 *
 * @param data - Entity data
 * @param projectName - Project name to scope to
 * @returns Created entity
 */
export async function createBrainProjectScopedEntity(
  data: {
    name: string;
    entityType: string;
    observations: string[];
  },
  projectName: string
): Promise<BrainEntity> {
  // First ensure project exists
  const projects = await listProjects();
  let projectId = projects.find(p => p.name === projectName)?.id;

  if (!projectId) {
    // Register project (path is optional for legacy compatibility)
    const project = await registerProject(projectName, '');
    projectId = project.id;
  }

  // Create entity with project ID
  const entity = await createEntity({
    name: data.name,
    entityType: data.entityType,
    observations: data.observations,
    projectId,
  });

  // Also create belongs_to_project relation for compatibility
  await createRelation(entity.id, projectId, 'belongs_to_project');

  return entity;
}

/**
 * Ensure project entity exists (MCP-compatible API)
 *
 * @param projectName - Project name
 * @param projectPath - Project path (optional)
 */
export async function ensureBrainProjectEntity(
  projectName: string,
  projectPath: string = ''
): Promise<void> {
  const projects = await listProjects();
  if (!projects.find(p => p.name === projectName)) {
    await registerProject(projectName, projectPath);
  }
}

/**
 * Delete entity (MCP-compatible API)
 *
 * @param entityIdOrName - Entity ID or name
 */
export async function deleteBrainEntity(entityIdOrName: string): Promise<void> {
  // Try by ID first
  const entity = await getEntity(entityIdOrName);
  if (entity) {
    await deleteEntity(entityIdOrName);
    return;
  }

  // Try by name
  const entities = await listEntities();
  const byName = entities.find(e => e.name === entityIdOrName);
  if (byName) {
    await deleteEntity(byName.id);
  }
}

/**
 * Create relation (MCP-compatible API)
 *
 * @param data - Relation data with from, to, relationType
 */
export async function createBrainRelation(data: {
  from: string;
  to: string;
  relationType: string;
}): Promise<BrainRelation> {
  // Resolve entity names to IDs if needed
  const entities = await listEntities();

  let fromId = data.from;
  let toId = data.to;

  // Check if 'from' is a name rather than ID
  const fromEntity = entities.find(e => e.name === data.from || e.id === data.from);
  if (fromEntity) fromId = fromEntity.id;

  // Check if 'to' is a name rather than ID
  const toEntity = entities.find(e => e.name === data.to || e.id === data.to);
  if (toEntity) toId = toEntity.id;

  return createRelation(fromId, toId, data.relationType);
}

/**
 * Delete relation by from/to entity (MCP-compatible API)
 *
 * @param fromIdOrName - From entity ID or name
 * @param toIdOrName - To entity ID or name
 */
export async function deleteBrainRelation(
  fromIdOrName: string,
  toIdOrName: string
): Promise<void> {
  // Get graph to find the relation
  const graph = await getGraph();
  const entities = graph.entities;

  // Resolve IDs
  const fromEntity = entities.find(e => e.name === fromIdOrName || e.id === fromIdOrName);
  const toEntity = entities.find(e => e.name === toIdOrName || e.id === toIdOrName);

  if (!fromEntity || !toEntity) return;

  // Find and delete the relation
  const relation = graph.relations.find(
    r => r.fromEntityId === fromEntity.id && r.toEntityId === toEntity.id
  );

  if (relation) {
    await deleteRelation(relation.id);
  }
}

/**
 * Add observations to entity (MCP-compatible API)
 *
 * @param entityIdOrName - Entity ID or name
 * @param observations - Observations to add
 */
export async function addBrainObservations(
  entityIdOrName: string,
  observations: string[]
): Promise<void> {
  // Resolve to ID
  const entities = await listEntities();
  const entity = entities.find(e => e.name === entityIdOrName || e.id === entityIdOrName);

  if (!entity) {
    throw new Error(`Entity not found: ${entityIdOrName}`);
  }

  // Add each observation
  for (const obs of observations) {
    await addObservation(entity.id, obs);
  }
}

/**
 * Update observations on entity (MCP-compatible API)
 *
 * @param entityIdOrName - Entity ID or name
 * @param observations - New observations array
 * @returns Success boolean
 */
export async function updateBrainObservations(
  entityIdOrName: string,
  observations: string[]
): Promise<boolean> {
  try {
    // Resolve to ID
    const entities = await listEntities();
    const entity = entities.find(e => e.name === entityIdOrName || e.id === entityIdOrName);

    if (!entity) {
      console.warn('[BrainService] Entity not found:', entityIdOrName);
      return false;
    }

    // Delete existing observations and add new ones
    // For now, we'll just add new observations (full replacement needs a Rust command)
    // This is a simplified implementation
    for (const obs of entity.observations) {
      await deleteObservation(obs.id);
    }

    for (const obs of observations) {
      await addObservation(entity.id, obs);
    }

    return true;
  } catch (err) {
    console.error('[BrainService] Failed to update observations:', err);
    return false;
  }
}

/**
 * Update entity type (MCP-compatible API)
 *
 * @param entityIdOrName - Entity ID or name
 * @param newEntityType - New entity type
 * @returns Success boolean
 */
export async function updateBrainEntityType(
  entityIdOrName: string,
  newEntityType: string
): Promise<boolean> {
  try {
    const entities = await listEntities();
    const entity = entities.find(e => e.name === entityIdOrName || e.id === entityIdOrName);

    if (!entity) {
      console.warn('[BrainService] Entity not found:', entityIdOrName);
      return false;
    }

    await updateEntity(entity.id, { entityType: newEntityType });
    return true;
  } catch (err) {
    console.error('[BrainService] Failed to update entity type:', err);
    return false;
  }
}

// Knowledge graph cache for compatibility with mcpMemoryService API
let cachedGraph: BrainGraph | null = null;

/**
 * Get cached knowledge graph (MCP-compatible API)
 *
 * Returns the last fetched graph from cache for synchronous access.
 * Call refreshGraph() to update the cache.
 */
export function getKnowledgeGraph(): BrainGraph | null {
  return cachedGraph;
}

/**
 * Refresh knowledge graph cache
 *
 * Fetches the latest graph and updates the cache.
 */
export async function refreshKnowledgeGraph(): Promise<BrainGraph> {
  cachedGraph = await getGraph();
  return cachedGraph;
}

// Add compatibility methods to singleton
Object.assign(brainService, {
  generateEntityName,
  categoryToEntityType,
  categoryToRelationType,
  createBrainEntity,
  createBrainProjectScopedEntity,
  ensureBrainProjectEntity,
  deleteBrainEntity,
  createBrainRelation,
  deleteBrainRelation,
  addBrainObservations,
  updateBrainObservations,
  updateBrainEntityType,
  getKnowledgeGraph,
  refreshKnowledgeGraph,
});
