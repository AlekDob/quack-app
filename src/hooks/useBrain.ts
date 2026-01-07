/**
 * useBrain Hook
 *
 * React hook for accessing Quack Brain with automatic refresh on updates.
 * Provides convenient access to Brain operations and state management.
 *
 * @module hooks/useBrain
 */

import { useState, useEffect, useCallback } from 'react';
import {
  brainService,
  BRAIN_UPDATED_EVENT,
} from '../services/brainService';
import type {
  BrainEntity,
  BrainGraph,
  CreateEntityInput,
  UpdateEntityInput,
  EntityFilters,
} from '../types/brain';

/**
 * Options for useBrain hook
 */
interface UseBrainOptions {
  /** Auto-load graph on mount */
  autoLoad?: boolean;
  /** Filter by project ID */
  projectId?: string;
  /** Filter by entity type */
  entityType?: string;
}

/**
 * Hook return type
 */
interface UseBrainReturn {
  /** All entities (filtered if options provided) */
  entities: BrainEntity[];
  /** Full graph with relations */
  graph: BrainGraph | null;
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Refresh data */
  refresh: () => Promise<void>;
  /** Create entity */
  createEntity: (input: CreateEntityInput) => Promise<BrainEntity>;
  /** Update entity */
  updateEntity: (id: string, updates: UpdateEntityInput) => Promise<BrainEntity>;
  /** Delete entity */
  deleteEntity: (id: string) => Promise<void>;
  /** Search entities */
  search: (query: string) => Promise<BrainEntity[]>;
  /** Add observation */
  addObservation: (entityId: string, content: string) => Promise<void>;
}

/**
 * Hook for accessing Quack Brain
 *
 * Provides reactive access to Brain data with automatic updates.
 * Listens for BRAIN_UPDATED_EVENT and refreshes accordingly.
 *
 * @param options - Configuration options
 * @returns Brain data and operations
 *
 * @example
 * ```tsx
 * function BrainPanel() {
 *   const { entities, isLoading, createEntity } = useBrain({
 *     autoLoad: true,
 *     entityType: 'preference',
 *   });
 *
 *   if (isLoading) return <Spinner />;
 *
 *   return (
 *     <div>
 *       <h2>Preferences</h2>
 *       {entities.map(e => (
 *         <div key={e.id}>{e.name}</div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useBrain(options: UseBrainOptions = {}): UseBrainReturn {
  const { autoLoad = true, projectId, entityType } = options;

  const [entities, setEntities] = useState<BrainEntity[]>([]);
  const [graph, setGraph] = useState<BrainGraph | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Refresh data from Brain
   */
  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Build filters
      const filters: EntityFilters = {};
      if (projectId !== undefined) filters.projectId = projectId;
      if (entityType) filters.entityType = entityType;

      // Load data in parallel
      const [entitiesList, fullGraph] = await Promise.all([
        brainService.listEntities(filters),
        brainService.getGraph(),
      ]);

      setEntities(entitiesList);
      setGraph(fullGraph);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load brain data';
      setError(message);
      console.error('[useBrain] Error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, entityType]);

  /**
   * Auto-load on mount
   */
  useEffect(() => {
    if (autoLoad) {
      refresh();
    }
  }, [autoLoad, refresh]);

  /**
   * Listen for updates from other parts of the app
   */
  useEffect(() => {
    const handleUpdate = () => {
      console.log('[useBrain] Brain updated event received, refreshing...');
      refresh();
    };

    window.addEventListener(BRAIN_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(BRAIN_UPDATED_EVENT, handleUpdate);
  }, [refresh]);

  /**
   * Create entity wrapper
   */
  const createEntity = useCallback(async (input: CreateEntityInput) => {
    return brainService.createEntity(input);
  }, []);

  /**
   * Update entity wrapper
   */
  const updateEntity = useCallback(async (id: string, updates: UpdateEntityInput) => {
    return brainService.updateEntity(id, updates);
  }, []);

  /**
   * Delete entity wrapper
   */
  const deleteEntity = useCallback(async (id: string) => {
    return brainService.deleteEntity(id);
  }, []);

  /**
   * Search entities
   */
  const search = useCallback(async (query: string) => {
    return brainService.searchEntities(query);
  }, []);

  /**
   * Add observation wrapper
   */
  const addObservation = useCallback(async (entityId: string, content: string) => {
    await brainService.addObservation(entityId, content);
  }, []);

  return {
    entities,
    graph,
    isLoading,
    error,
    refresh,
    createEntity,
    updateEntity,
    deleteEntity,
    search,
    addObservation,
  };
}

/**
 * Hook for searching Brain
 *
 * Provides debounced search functionality with loading state.
 *
 * @param initialQuery - Initial search query
 * @returns Search state and operations
 *
 * @example
 * ```tsx
 * function BrainSearch() {
 *   const { query, setQuery, results, isSearching } = useBrainSearch();
 *
 *   return (
 *     <div>
 *       <input
 *         value={query}
 *         onChange={e => setQuery(e.target.value)}
 *         placeholder="Search brain..."
 *       />
 *       {isSearching && <Spinner />}
 *       {results.map(entity => (
 *         <div key={entity.id}>{entity.name}</div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useBrainSearch(initialQuery: string = '') {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<BrainEntity[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  /**
   * Execute search
   */
  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const entities = await brainService.searchEntities(q);
      setResults(entities);
    } catch (err) {
      console.error('[useBrainSearch] Error:', err);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  /**
   * Debounced search on query change
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      search(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, search]);

  return {
    query,
    setQuery,
    results,
    isSearching,
    search,
  };
}

/**
 * Hook for managing project context
 *
 * Provides reactive access to current project and its entities.
 *
 * @param projectId - Project ID to track
 * @returns Project data and operations
 *
 * @example
 * ```tsx
 * function ProjectBrain({ projectId }: { projectId: string }) {
 *   const { entities, isLoading } = useBrainProject(projectId);
 *
 *   if (isLoading) return <Spinner />;
 *
 *   return (
 *     <div>
 *       <h2>Project Brain</h2>
 *       <p>{entities.length} entities</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useBrainProject(projectId: string) {
  const { entities, isLoading, error, refresh, ...operations } = useBrain({
    autoLoad: true,
    projectId,
  });

  return {
    entities,
    isLoading,
    error,
    refresh,
    ...operations,
  };
}

/**
 * Hook for global (non-project) entities
 *
 * Provides reactive access to global Brain entities.
 *
 * @returns Global entities and operations
 *
 * @example
 * ```tsx
 * function GlobalBrain() {
 *   const { entities, isLoading } = useBrainGlobal();
 *
 *   if (isLoading) return <Spinner />;
 *
 *   return (
 *     <div>
 *       <h2>Global Brain</h2>
 *       {entities.map(e => (
 *         <div key={e.id}>{e.name}</div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useBrainGlobal() {
  const [entities, setEntities] = useState<BrainEntity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const global = await brainService.getGlobalEntities();
      setEntities(global);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load global entities';
      setError(message);
      console.error('[useBrainGlobal] Error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const handleUpdate = () => {
      refresh();
    };

    window.addEventListener(BRAIN_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(BRAIN_UPDATED_EVENT, handleUpdate);
  }, [refresh]);

  return {
    entities,
    isLoading,
    error,
    refresh,
  };
}

export default useBrain;
