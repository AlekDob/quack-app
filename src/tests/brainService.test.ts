/**
 * Brain Service Tests
 *
 * Integration tests for Brain service with mocked Tauri invoke.
 * Tests all CRUD operations, search, relations, and event dispatching.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type {
  BrainEntity,
  BrainGraph,
  BrainRelation,
  BrainObservation,
  BrainProject,
  CreateEntityInput,
} from '../types/brain';

// Mock Tauri invoke
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: any[]) => mockInvoke(...args),
}));

// Import after mocking
import {
  initBrain,
  createEntity,
  updateEntity,
  deleteEntity,
  getEntity,
  listEntities,
  searchEntities,
  addObservation,
  deleteObservation,
  createRelation,
  deleteRelation,
  getGraph,
  registerProject,
  BRAIN_UPDATED_EVENT,
} from '../services/brainService';

describe('BrainService', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initBrain', () => {
    it('should call brain_init command', async () => {
      mockInvoke.mockResolvedValueOnce('Database initialized successfully');

      await initBrain();

      expect(mockInvoke).toHaveBeenCalledWith('brain_init');
      expect(mockInvoke).toHaveBeenCalledTimes(1);
    });

    it('should handle initialization errors', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Failed to initialize database'));

      await expect(initBrain()).rejects.toThrow('Failed to initialize database');
    });
  });

  describe('createEntity', () => {
    it('should create entity and return it', async () => {
      const mockEntity: BrainEntity = {
        id: 'ent_new',
        name: 'Test Pattern',
        entityType: 'pattern',
        observations: [{ id: 'obs_1', content: 'Use hooks for state', createdAt: Date.now() }],
        projectId: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        mdFilePath: null,
      };

      mockInvoke.mockResolvedValueOnce(mockEntity);

      const input: CreateEntityInput = {
        name: 'Test Pattern',
        entityType: 'pattern',
        observations: ['Use hooks for state'],
      };

      const result = await createEntity(input);

      expect(mockInvoke).toHaveBeenCalledWith('brain_create_entity', { input });
      expect(result.name).toBe('Test Pattern');
      expect(result.entityType).toBe('pattern');
      expect(result.observations).toHaveLength(1);
    });

    it('should dispatch BRAIN_UPDATED_EVENT on success', async () => {
      const mockEntity: BrainEntity = {
        id: 'ent_test',
        name: 'Test',
        entityType: 'fact',
        observations: [],
        projectId: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        mdFilePath: null,
      };

      mockInvoke.mockResolvedValueOnce(mockEntity);

      const eventSpy = vi.fn();
      window.addEventListener(BRAIN_UPDATED_EVENT, eventSpy);

      await createEntity({ name: 'Test', entityType: 'fact', observations: [] });

      expect(eventSpy).toHaveBeenCalled();

      window.removeEventListener(BRAIN_UPDATED_EVENT, eventSpy);
    });

    it('should create project-scoped entity', async () => {
      const mockEntity: BrainEntity = {
        id: 'ent_scoped',
        name: 'Project Pattern',
        entityType: 'pattern',
        observations: [],
        projectId: 'proj_quack',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        mdFilePath: null,
      };

      mockInvoke.mockResolvedValueOnce(mockEntity);

      const input: CreateEntityInput = {
        name: 'Project Pattern',
        entityType: 'pattern',
        observations: [],
        projectId: 'proj_quack',
      };

      const result = await createEntity(input);

      expect(result.projectId).toBe('proj_quack');
    });

    it('should handle creation errors', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Duplicate entity name'));

      await expect(
        createEntity({ name: 'Duplicate', entityType: 'fact', observations: [] })
      ).rejects.toThrow('Duplicate entity name');
    });
  });

  describe('updateEntity', () => {
    it('should update entity name', async () => {
      const mockEntity: BrainEntity = {
        id: 'ent_123',
        name: 'Updated Name',
        entityType: 'pattern',
        observations: [],
        projectId: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        mdFilePath: null,
      };

      mockInvoke.mockResolvedValueOnce(mockEntity);

      const result = await updateEntity('ent_123', { name: 'Updated Name' });

      expect(mockInvoke).toHaveBeenCalledWith('brain_update_entity', {
        id: 'ent_123',
        updates: { name: 'Updated Name' },
      });
      expect(result.name).toBe('Updated Name');
    });

    it('should update entity type', async () => {
      const mockEntity: BrainEntity = {
        id: 'ent_123',
        name: 'Test Entity',
        entityType: 'decision',
        observations: [],
        projectId: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        mdFilePath: null,
      };

      mockInvoke.mockResolvedValueOnce(mockEntity);

      const result = await updateEntity('ent_123', { entityType: 'decision' });

      expect(result.entityType).toBe('decision');
    });

    it('should dispatch BRAIN_UPDATED_EVENT on success', async () => {
      const mockEntity: BrainEntity = {
        id: 'ent_test',
        name: 'Test',
        entityType: 'fact',
        observations: [],
        projectId: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        mdFilePath: null,
      };

      mockInvoke.mockResolvedValueOnce(mockEntity);

      const eventSpy = vi.fn();
      window.addEventListener(BRAIN_UPDATED_EVENT, eventSpy);

      await updateEntity('ent_test', { name: 'Updated' });

      expect(eventSpy).toHaveBeenCalled();

      window.removeEventListener(BRAIN_UPDATED_EVENT, eventSpy);
    });
  });

  describe('deleteEntity', () => {
    it('should delete entity by id', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      await deleteEntity('ent_123');

      expect(mockInvoke).toHaveBeenCalledWith('brain_delete_entity', { id: 'ent_123' });
    });

    it('should dispatch BRAIN_UPDATED_EVENT on success', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      const eventSpy = vi.fn();
      window.addEventListener(BRAIN_UPDATED_EVENT, eventSpy);

      await deleteEntity('ent_test');

      expect(eventSpy).toHaveBeenCalled();

      window.removeEventListener(BRAIN_UPDATED_EVENT, eventSpy);
    });

    it('should handle deletion errors', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Entity not found'));

      await expect(deleteEntity('ent_nonexistent')).rejects.toThrow('Entity not found');
    });
  });

  describe('getEntity', () => {
    it('should fetch entity by id', async () => {
      const mockEntity: BrainEntity = {
        id: 'ent_123',
        name: 'Test Entity',
        entityType: 'fact',
        observations: [
          { id: 'obs_1', content: 'First observation', createdAt: Date.now() }
        ],
        projectId: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        mdFilePath: null,
      };

      mockInvoke.mockResolvedValueOnce(mockEntity);

      const result = await getEntity('ent_123');

      expect(mockInvoke).toHaveBeenCalledWith('brain_get_entity', { id: 'ent_123' });
      expect(result?.name).toBe('Test Entity');
      expect(result?.observations).toHaveLength(1);
    });

    it('should return null for non-existent entity', async () => {
      mockInvoke.mockResolvedValueOnce(null);

      const result = await getEntity('ent_nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('listEntities', () => {
    it('should list all entities without filters', async () => {
      const mockEntities: BrainEntity[] = [
        { id: 'ent_1', name: 'Entity 1', entityType: 'fact', observations: [], projectId: null, createdAt: 1, updatedAt: 1, mdFilePath: null },
        { id: 'ent_2', name: 'Entity 2', entityType: 'pattern', observations: [], projectId: 'proj_1', createdAt: 2, updatedAt: 2, mdFilePath: null },
      ];

      mockInvoke.mockResolvedValueOnce(mockEntities);

      const result = await listEntities();

      expect(mockInvoke).toHaveBeenCalledWith('brain_list_entities', { filters: {} });
      expect(result).toHaveLength(2);
    });

    it('should filter by projectId', async () => {
      const mockEntities: BrainEntity[] = [
        { id: 'ent_2', name: 'Entity 2', entityType: 'pattern', observations: [], projectId: 'proj_quack', createdAt: 2, updatedAt: 2, mdFilePath: null },
      ];

      mockInvoke.mockResolvedValueOnce(mockEntities);

      const result = await listEntities({ projectId: 'proj_quack' });

      expect(mockInvoke).toHaveBeenCalledWith('brain_list_entities', {
        filters: { projectId: 'proj_quack' },
      });
      expect(result).toHaveLength(1);
      expect(result[0].projectId).toBe('proj_quack');
    });

    it('should filter by entityType', async () => {
      const mockEntities: BrainEntity[] = [
        { id: 'ent_bug', name: 'Bug Fix', entityType: 'bug_fix', observations: [], projectId: null, createdAt: 1, updatedAt: 1, mdFilePath: null },
      ];

      mockInvoke.mockResolvedValueOnce(mockEntities);

      const result = await listEntities({ entityType: 'bug_fix' });

      expect(mockInvoke).toHaveBeenCalledWith('brain_list_entities', {
        filters: { entityType: 'bug_fix' },
      });
      expect(result).toHaveLength(1);
      expect(result[0].entityType).toBe('bug_fix');
    });

    it('should support combined filters', async () => {
      const mockEntities: BrainEntity[] = [];

      mockInvoke.mockResolvedValueOnce(mockEntities);

      await listEntities({
        projectId: 'proj_quack',
        entityType: 'pattern',
        searchQuery: 'auth',
      });

      expect(mockInvoke).toHaveBeenCalledWith('brain_list_entities', {
        filters: {
          projectId: 'proj_quack',
          entityType: 'pattern',
          searchQuery: 'auth',
        },
      });
    });
  });

  describe('searchEntities', () => {
    it('should search using FTS', async () => {
      const mockResults: BrainEntity[] = [
        { id: 'ent_match', name: 'Authentication Bug', entityType: 'bug_fix', observations: [], projectId: null, createdAt: 1, updatedAt: 1, mdFilePath: null },
      ];

      mockInvoke.mockResolvedValueOnce(mockResults);

      const result = await searchEntities('authentication');

      expect(mockInvoke).toHaveBeenCalledWith('brain_search', { query: 'authentication' });
      expect(result).toHaveLength(1);
      expect(result[0].name).toContain('Authentication');
    });

    it('should return empty array for no matches', async () => {
      mockInvoke.mockResolvedValueOnce([]);

      const result = await searchEntities('nonexistent');

      expect(result).toHaveLength(0);
    });
  });

  describe('addObservation', () => {
    it('should add observation to entity', async () => {
      const mockObs: BrainObservation = {
        id: 'obs_new',
        content: 'New observation',
        createdAt: Date.now(),
      };

      mockInvoke.mockResolvedValueOnce(mockObs);

      const result = await addObservation('ent_123', 'New observation');

      expect(mockInvoke).toHaveBeenCalledWith('brain_add_observation', {
        entityId: 'ent_123',
        content: 'New observation',
      });
      expect(result.content).toBe('New observation');
    });

    it('should dispatch BRAIN_UPDATED_EVENT on success', async () => {
      const mockObs: BrainObservation = {
        id: 'obs_test',
        content: 'Test obs',
        createdAt: Date.now(),
      };

      mockInvoke.mockResolvedValueOnce(mockObs);

      const eventSpy = vi.fn();
      window.addEventListener(BRAIN_UPDATED_EVENT, eventSpy);

      await addObservation('ent_test', 'Test obs');

      expect(eventSpy).toHaveBeenCalled();

      window.removeEventListener(BRAIN_UPDATED_EVENT, eventSpy);
    });

    it('should handle observation with timestamp', async () => {
      const content = '[2025-01-05] Implemented feature X';
      const mockObs: BrainObservation = {
        id: 'obs_ts',
        content,
        createdAt: Date.now(),
      };

      mockInvoke.mockResolvedValueOnce(mockObs);

      const result = await addObservation('ent_123', content);

      expect(result.content).toContain('[2025-01-05]');
    });
  });

  describe('deleteObservation', () => {
    it('should delete observation by id', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      await deleteObservation('obs_123');

      expect(mockInvoke).toHaveBeenCalledWith('brain_delete_observation', { id: 'obs_123' });
    });

    it('should dispatch BRAIN_UPDATED_EVENT on success', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      const eventSpy = vi.fn();
      window.addEventListener(BRAIN_UPDATED_EVENT, eventSpy);

      await deleteObservation('obs_test');

      expect(eventSpy).toHaveBeenCalled();

      window.removeEventListener(BRAIN_UPDATED_EVENT, eventSpy);
    });
  });

  describe('createRelation', () => {
    it('should create relation between entities', async () => {
      const mockRelation: BrainRelation = {
        id: 'rel_new',
        fromEntityId: 'ent_1',
        toEntityId: 'ent_2',
        relationType: 'relates_to',
        createdAt: Date.now(),
      };

      mockInvoke.mockResolvedValueOnce(mockRelation);

      const result = await createRelation('ent_1', 'ent_2', 'relates_to');

      expect(mockInvoke).toHaveBeenCalledWith('brain_create_relation', {
        fromEntityId: 'ent_1',
        toEntityId: 'ent_2',
        relationType: 'relates_to',
      });
      expect(result.relationType).toBe('relates_to');
    });

    it('should create belongs_to_project relation', async () => {
      const mockRelation: BrainRelation = {
        id: 'rel_project',
        fromEntityId: 'ent_pattern',
        toEntityId: 'ent_project',
        relationType: 'belongs_to_project',
        createdAt: Date.now(),
      };

      mockInvoke.mockResolvedValueOnce(mockRelation);

      const result = await createRelation('ent_pattern', 'ent_project', 'belongs_to_project');

      expect(result.relationType).toBe('belongs_to_project');
    });

    it('should dispatch BRAIN_UPDATED_EVENT on success', async () => {
      const mockRelation: BrainRelation = {
        id: 'rel_test',
        fromEntityId: 'ent_1',
        toEntityId: 'ent_2',
        relationType: 'relates_to',
        createdAt: Date.now(),
      };

      mockInvoke.mockResolvedValueOnce(mockRelation);

      const eventSpy = vi.fn();
      window.addEventListener(BRAIN_UPDATED_EVENT, eventSpy);

      await createRelation('ent_1', 'ent_2', 'relates_to');

      expect(eventSpy).toHaveBeenCalled();

      window.removeEventListener(BRAIN_UPDATED_EVENT, eventSpy);
    });
  });

  describe('deleteRelation', () => {
    it('should delete relation by id', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      await deleteRelation('rel_123');

      expect(mockInvoke).toHaveBeenCalledWith('brain_delete_relation', { id: 'rel_123' });
    });

    it('should dispatch BRAIN_UPDATED_EVENT on success', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      const eventSpy = vi.fn();
      window.addEventListener(BRAIN_UPDATED_EVENT, eventSpy);

      await deleteRelation('rel_test');

      expect(eventSpy).toHaveBeenCalled();

      window.removeEventListener(BRAIN_UPDATED_EVENT, eventSpy);
    });
  });

  describe('getGraph', () => {
    it('should return full knowledge graph', async () => {
      const mockGraph: BrainGraph = {
        entities: [
          { id: 'ent_1', name: 'Entity 1', entityType: 'fact', observations: [], projectId: null, createdAt: 1, updatedAt: 1, mdFilePath: null },
        ],
        relations: [
          { id: 'rel_1', fromEntityId: 'ent_1', toEntityId: 'ent_2', relationType: 'uses', createdAt: 1 },
        ],
      };

      mockInvoke.mockResolvedValueOnce(mockGraph);

      const result = await getGraph();

      expect(mockInvoke).toHaveBeenCalledWith('brain_get_graph');
      expect(result.entities).toHaveLength(1);
      expect(result.relations).toHaveLength(1);
    });

    it('should return empty graph', async () => {
      const mockGraph: BrainGraph = {
        entities: [],
        relations: [],
      };

      mockInvoke.mockResolvedValueOnce(mockGraph);

      const result = await getGraph();

      expect(result.entities).toHaveLength(0);
      expect(result.relations).toHaveLength(0);
    });
  });

  describe('registerProject', () => {
    it('should register new project', async () => {
      const mockProject: BrainProject = {
        id: 'proj_new',
        name: 'quack-app',
        path: '/Users/test/quack-app',
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
      };

      mockInvoke.mockResolvedValueOnce(mockProject);

      const result = await registerProject('quack-app', '/Users/test/quack-app');

      expect(mockInvoke).toHaveBeenCalledWith('brain_register_project', {
        name: 'quack-app',
        path: '/Users/test/quack-app',
      });
      expect(result.name).toBe('quack-app');
      expect(result.path).toBe('/Users/test/quack-app');
    });

    it('should update existing project', async () => {
      const mockProject: BrainProject = {
        id: 'proj_existing',
        name: 'quack-app',
        path: '/Users/test/quack-app',
        createdAt: 1000,
        lastAccessedAt: Date.now(),
      };

      mockInvoke.mockResolvedValueOnce(mockProject);

      const result = await registerProject('quack-app', '/Users/test/quack-app');

      expect(result.lastAccessedAt).toBeGreaterThan(result.createdAt);
    });
  });
});
