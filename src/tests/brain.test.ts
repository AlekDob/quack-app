/**
 * Brain Types Tests
 *
 * Unit tests for Brain type definitions and validation.
 * Tests the structure and constraints of Brain entities, relations, and filters.
 */

import { describe, it, expect } from 'vitest';
import type {
  BrainEntity,
  BrainRelation,
  BrainObservation,
  CreateEntityInput,
  EntityFilters,
  BrainEntityType,
  BrainRelationType,
} from '../types/brain';

describe('Brain Types', () => {
  describe('BrainEntity', () => {
    it('should have correct structure', () => {
      const entity: BrainEntity = {
        id: 'ent_123',
        name: 'Test Entity',
        entityType: 'fact',
        observations: [
          { id: 'obs_1', content: 'Test observation', createdAt: Date.now() }
        ],
        projectId: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        mdFilePath: null,
      };

      expect(entity.id).toMatch(/^ent_/);
      expect(entity.name).toBe('Test Entity');
      expect(entity.entityType).toBe('fact');
      expect(entity.observations).toHaveLength(1);
    });

    it('should allow project-scoped entities', () => {
      const entity: BrainEntity = {
        id: 'ent_456',
        name: 'Project Entity',
        entityType: 'pattern',
        observations: [],
        projectId: 'proj_quack',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        mdFilePath: '/path/to/file.md',
      };

      expect(entity.projectId).toBe('proj_quack');
      expect(entity.mdFilePath).toBeTruthy();
    });

    it('should allow global entities', () => {
      const entity: BrainEntity = {
        id: 'ent_789',
        name: 'Global Entity',
        entityType: 'preference',
        observations: [],
        projectId: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        mdFilePath: null,
      };

      expect(entity.projectId).toBeNull();
    });

    it('should support multiple observations', () => {
      const obs1: BrainObservation = {
        id: 'obs_1',
        content: 'First observation',
        createdAt: Date.now(),
      };

      const obs2: BrainObservation = {
        id: 'obs_2',
        content: 'Second observation',
        createdAt: Date.now() + 1000,
      };

      const entity: BrainEntity = {
        id: 'ent_multi',
        name: 'Multi Observation Entity',
        entityType: 'diary',
        observations: [obs1, obs2],
        projectId: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        mdFilePath: null,
      };

      expect(entity.observations).toHaveLength(2);
      expect(entity.observations[0].content).toBe('First observation');
      expect(entity.observations[1].content).toBe('Second observation');
    });
  });

  describe('BrainRelation', () => {
    it('should link two entities', () => {
      const relation: BrainRelation = {
        id: 'rel_789',
        fromEntityId: 'ent_123',
        toEntityId: 'ent_456',
        relationType: 'relates_to',
        createdAt: Date.now(),
      };

      expect(relation.fromEntityId).not.toBe(relation.toEntityId);
      expect(relation.relationType).toBe('relates_to');
    });

    it('should support belongs_to_project relation', () => {
      const relation: BrainRelation = {
        id: 'rel_project',
        fromEntityId: 'ent_pattern',
        toEntityId: 'ent_quack_project',
        relationType: 'belongs_to_project',
        createdAt: Date.now(),
      };

      expect(relation.relationType).toBe('belongs_to_project');
    });

    it('should support depends_on relation', () => {
      const relation: BrainRelation = {
        id: 'rel_dep',
        fromEntityId: 'ent_feature_a',
        toEntityId: 'ent_feature_b',
        relationType: 'depends_on',
        createdAt: Date.now(),
      };

      expect(relation.relationType).toBe('depends_on');
    });
  });

  describe('CreateEntityInput', () => {
    it('should validate required fields', () => {
      const validInput: CreateEntityInput = {
        name: 'New Entity',
        entityType: 'decision',
        observations: ['First observation'],
      };

      expect(validInput.name).toBeTruthy();
      expect(validInput.entityType).toBeTruthy();
      expect(validInput.observations).toBeInstanceOf(Array);
    });

    it('should allow optional projectId', () => {
      const withProject: CreateEntityInput = {
        name: 'Scoped Entity',
        entityType: 'pattern',
        observations: [],
        projectId: 'proj_123',
      };

      const withoutProject: CreateEntityInput = {
        name: 'Global Entity',
        entityType: 'preference',
        observations: [],
      };

      expect(withProject.projectId).toBe('proj_123');
      expect(withoutProject.projectId).toBeUndefined();
    });

    it('should allow empty observations array', () => {
      const input: CreateEntityInput = {
        name: 'Empty Obs Entity',
        entityType: 'fact',
        observations: [],
      };

      expect(input.observations).toHaveLength(0);
    });

    it('should allow multiple initial observations', () => {
      const input: CreateEntityInput = {
        name: 'Multi Obs Entity',
        entityType: 'pattern',
        observations: [
          '[2025-01-05] Created pattern',
          '[2025-01-06] Updated pattern',
          '[2025-01-07] Tested pattern',
        ],
      };

      expect(input.observations).toHaveLength(3);
    });
  });

  describe('Entity Type Validation', () => {
    const validTypes: BrainEntityType[] = [
      'preference',
      'fact',
      'decision',
      'pattern',
      'bug_fix',
      'person',
      'project',
      'diary',
      'document',
      'gotcha',
      'tool',
      'technology',
    ];

    it.each(validTypes)('should accept valid entity type: %s', (type) => {
      const entity: BrainEntity = {
        id: 'ent_test',
        name: 'Test',
        entityType: type,
        observations: [],
        projectId: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        mdFilePath: null,
      };

      expect(validTypes).toContain(entity.entityType);
    });

    it('should support preference type', () => {
      const entity: BrainEntity = {
        id: 'ent_pref',
        name: 'user_preferences',
        entityType: 'preference',
        observations: [],
        projectId: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        mdFilePath: null,
      };

      expect(entity.entityType).toBe('preference');
    });

    it('should support pattern type', () => {
      const entity: BrainEntity = {
        id: 'ent_pattern',
        name: 'auth_pattern',
        entityType: 'pattern',
        observations: [],
        projectId: 'proj_quack',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        mdFilePath: null,
      };

      expect(entity.entityType).toBe('pattern');
    });

    it('should support bug_fix type', () => {
      const entity: BrainEntity = {
        id: 'ent_bug',
        name: 'dropdown_fix',
        entityType: 'bug_fix',
        observations: ['Fixed dropdown rendering issue'],
        projectId: 'proj_quack',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        mdFilePath: null,
      };

      expect(entity.entityType).toBe('bug_fix');
    });
  });

  describe('Relation Type Validation', () => {
    const validRelations: BrainRelationType[] = [
      'belongs_to_project',
      'relates_to',
      'depends_on',
      'created_by',
      'uses',
      'documented_in',
    ];

    it.each(validRelations)('should accept valid relation type: %s', (type) => {
      const relation: BrainRelation = {
        id: 'rel_test',
        fromEntityId: 'ent_1',
        toEntityId: 'ent_2',
        relationType: type,
        createdAt: Date.now(),
      };

      expect(validRelations).toContain(relation.relationType);
    });

    it('should support belongs_to_project', () => {
      const relation: BrainRelation = {
        id: 'rel_1',
        fromEntityId: 'ent_pattern',
        toEntityId: 'ent_project',
        relationType: 'belongs_to_project',
        createdAt: Date.now(),
      };

      expect(relation.relationType).toBe('belongs_to_project');
    });

    it('should support uses relation', () => {
      const relation: BrainRelation = {
        id: 'rel_2',
        fromEntityId: 'ent_project',
        toEntityId: 'ent_technology',
        relationType: 'uses',
        createdAt: Date.now(),
      };

      expect(relation.relationType).toBe('uses');
    });
  });

  describe('EntityFilters', () => {
    it('should support projectId filter', () => {
      const filters: EntityFilters = { projectId: 'proj_123' };
      expect(filters.projectId).toBe('proj_123');
    });

    it('should support entityType filter', () => {
      const filters: EntityFilters = { entityType: 'pattern' };
      expect(filters.entityType).toBe('pattern');
    });

    it('should support searchQuery filter', () => {
      const filters: EntityFilters = { searchQuery: 'authentication' };
      expect(filters.searchQuery).toBe('authentication');
    });

    it('should support combined filters', () => {
      const filters: EntityFilters = {
        projectId: 'proj_quack',
        entityType: 'bug_fix',
        searchQuery: 'dropdown',
      };

      expect(Object.keys(filters)).toHaveLength(3);
      expect(filters.projectId).toBe('proj_quack');
      expect(filters.entityType).toBe('bug_fix');
      expect(filters.searchQuery).toBe('dropdown');
    });

    it('should support null projectId for global entities', () => {
      const filters: EntityFilters = {
        projectId: null,
        entityType: 'preference',
      };

      expect(filters.projectId).toBeNull();
    });

    it('should allow empty filters object', () => {
      const filters: EntityFilters = {};
      expect(Object.keys(filters)).toHaveLength(0);
    });
  });

  describe('BrainObservation', () => {
    it('should have required fields', () => {
      const obs: BrainObservation = {
        id: 'obs_123',
        content: 'Test observation content',
        createdAt: Date.now(),
      };

      expect(obs.id).toBeTruthy();
      expect(obs.content).toBeTruthy();
      expect(obs.createdAt).toBeGreaterThan(0);
    });

    it('should support timestamp format', () => {
      const timestamp = Date.now();
      const obs: BrainObservation = {
        id: 'obs_ts',
        content: '[2025-01-05] Implemented feature X',
        createdAt: timestamp,
      };

      expect(obs.createdAt).toBe(timestamp);
      expect(obs.content).toContain('[2025-01-05]');
    });
  });

  describe('BrainGraph', () => {
    it('should contain entities and relations', () => {
      const entity: BrainEntity = {
        id: 'ent_1',
        name: 'Entity 1',
        entityType: 'fact',
        observations: [],
        projectId: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        mdFilePath: null,
      };

      const relation: BrainRelation = {
        id: 'rel_1',
        fromEntityId: 'ent_1',
        toEntityId: 'ent_2',
        relationType: 'relates_to',
        createdAt: Date.now(),
      };

      const graph = {
        entities: [entity],
        relations: [relation],
      };

      expect(graph.entities).toHaveLength(1);
      expect(graph.relations).toHaveLength(1);
    });

    it('should allow empty graph', () => {
      const graph = {
        entities: [],
        relations: [],
      };

      expect(graph.entities).toHaveLength(0);
      expect(graph.relations).toHaveLength(0);
    });
  });
});
