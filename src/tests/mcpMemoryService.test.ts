import { describe, it, expect, beforeEach } from 'vitest';
import {
  MCPMemoryService,
  mcpMemoryService,
  mcpEntityToUnifiedItem,
  quackMemoryToUnifiedItem,
  mapEntityTypeToCategory,
  type MCPEntity,
  type MCPRelation,
  type MCPKnowledgeGraph,
} from '../services/mcpMemoryService';
import type { QuackMemory } from '../types/memory';

/**
 * MCP Memory Service Tests
 *
 * Tests for the MCP Memory integration service that bridges
 * the MCP Memory server with Quack's unified memory display.
 */

describe('mapEntityTypeToCategory', () => {
  it('should map known entity types to Quack categories', () => {
    expect(mapEntityTypeToCategory('preference')).toBe('preference');
    expect(mapEntityTypeToCategory('fact')).toBe('fact');
    expect(mapEntityTypeToCategory('decision')).toBe('decision');
    expect(mapEntityTypeToCategory('pattern')).toBe('pattern');
    expect(mapEntityTypeToCategory('mistake')).toBe('mistake');
    expect(mapEntityTypeToCategory('context')).toBe('context');
  });

  it('should map MCP-specific types to appropriate categories', () => {
    expect(mapEntityTypeToCategory('person')).toBe('context');
    expect(mapEntityTypeToCategory('project')).toBe('context');
    expect(mapEntityTypeToCategory('technology')).toBe('fact');
    expect(mapEntityTypeToCategory('tool')).toBe('fact');
    expect(mapEntityTypeToCategory('concept')).toBe('fact');
  });

  it('should handle case-insensitive matching', () => {
    expect(mapEntityTypeToCategory('PREFERENCE')).toBe('preference');
    expect(mapEntityTypeToCategory('Fact')).toBe('fact');
    expect(mapEntityTypeToCategory('DECISION')).toBe('decision');
  });

  it('should default to context for unknown types', () => {
    expect(mapEntityTypeToCategory('unknown')).toBe('context');
    expect(mapEntityTypeToCategory('custom_type')).toBe('context');
    expect(mapEntityTypeToCategory('')).toBe('context');
  });
});

describe('mcpEntityToUnifiedItem', () => {
  it('should convert an MCP entity to unified format', () => {
    const entity: MCPEntity = {
      name: 'Alek_preferences',
      entityType: 'preference',
      observations: ['Prefers TypeScript', 'Uses dark mode'],
    };

    const result = mcpEntityToUnifiedItem(entity);

    expect(result.id).toBe('mcp-Alek_preferences');
    expect(result.content).toBe('Prefers TypeScript | Uses dark mode');
    expect(result.category).toBe('preference');
    expect(result.source).toBe('mcp');
    expect(result.entityName).toBe('Alek_preferences');
    expect(result.entityType).toBe('preference');
  });

  it('should use entity name as content when no observations', () => {
    const entity: MCPEntity = {
      name: 'React',
      entityType: 'technology',
      observations: [],
    };

    const result = mcpEntityToUnifiedItem(entity);

    expect(result.content).toBe('React');
  });

  it('should include relations for the entity', () => {
    const entity: MCPEntity = {
      name: 'Quack',
      entityType: 'project',
      observations: ['Multi-agentic desktop app'],
    };

    const relations: MCPRelation[] = [
      { from: 'Quack', to: 'React', relationType: 'uses' },
      { from: 'Quack', to: 'Tauri', relationType: 'built_with' },
      { from: 'Alek', to: 'Quack', relationType: 'develops' },
    ];

    const result = mcpEntityToUnifiedItem(entity, relations);

    expect(result.relations).toHaveLength(3);
    expect(result.relations?.[0]).toEqual({
      from: 'Quack',
      to: 'React',
      relationType: 'uses',
    });
  });

  it('should filter relations to only include entity', () => {
    const entity: MCPEntity = {
      name: 'Quack',
      entityType: 'project',
      observations: [],
    };

    const relations: MCPRelation[] = [
      { from: 'Quack', to: 'React', relationType: 'uses' },
      { from: 'Other', to: 'Something', relationType: 'unrelated' },
    ];

    const result = mcpEntityToUnifiedItem(entity, relations);

    expect(result.relations).toHaveLength(1);
    expect(result.relations?.[0].from).toBe('Quack');
  });
});

describe('quackMemoryToUnifiedItem', () => {
  it('should convert a Quack memory to unified format', () => {
    const memory: QuackMemory = {
      id: 'mem-123',
      content: 'User prefers TypeScript strict mode',
      category: 'preference',
      confidence: 'high',
      scope: 'global',
      keywords: ['typescript', 'strict', 'mode'],
      createdAt: 1700000000000,
      lastAccessedAt: 1700000000000,
      accessCount: 5,
      userVerified: true,
      isArchived: false,
    };

    const result = quackMemoryToUnifiedItem(memory);

    expect(result.id).toBe('mem-123');
    expect(result.content).toBe('User prefers TypeScript strict mode');
    expect(result.category).toBe('preference');
    expect(result.source).toBe('quack');
    expect(result.createdAt).toBe(1700000000000);
    expect(result.quackMemory).toBe(memory);
  });

  it('should preserve all Quack-specific fields', () => {
    const memory: QuackMemory = {
      id: 'mem-456',
      content: 'Test memory',
      category: 'fact',
      confidence: 'medium',
      scope: 'project',
      keywords: ['test'],
      projectPath: '/path/to/project',
      sourceSessionId: 'session-789',
      createdAt: 1700000000000,
      lastAccessedAt: 1700000000000,
      accessCount: 0,
      userVerified: false,
      isArchived: false,
    };

    const result = quackMemoryToUnifiedItem(memory);

    expect(result.quackMemory?.confidence).toBe('medium');
    expect(result.quackMemory?.scope).toBe('project');
    expect(result.quackMemory?.projectPath).toBe('/path/to/project');
  });
});

describe('MCPMemoryService', () => {
  let service: MCPMemoryService;

  beforeEach(() => {
    // Get fresh instance (singleton, but we can clear cache)
    service = MCPMemoryService.getInstance();
    service.clearCache();
  });

  describe('singleton', () => {
    it('should return the same instance', () => {
      const instance1 = MCPMemoryService.getInstance();
      const instance2 = MCPMemoryService.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('setKnowledgeGraph', () => {
    it('should store the knowledge graph', () => {
      const graph: MCPKnowledgeGraph = {
        entities: [
          { name: 'Test', entityType: 'concept', observations: ['Test obs'] },
        ],
        relations: [],
      };

      service.setKnowledgeGraph(graph);
      const result = service.getKnowledgeGraph();

      expect(result).toEqual(graph);
    });
  });

  describe('getUnifiedItems', () => {
    it('should return empty array when no graph is set', () => {
      const items = service.getUnifiedItems();
      expect(items).toEqual([]);
    });

    it('should convert all entities to unified items', () => {
      const graph: MCPKnowledgeGraph = {
        entities: [
          { name: 'Entity1', entityType: 'fact', observations: ['Obs 1'] },
          { name: 'Entity2', entityType: 'decision', observations: ['Obs 2'] },
        ],
        relations: [],
      };

      service.setKnowledgeGraph(graph);
      const items = service.getUnifiedItems();

      expect(items).toHaveLength(2);
      expect(items[0].entityName).toBe('Entity1');
      expect(items[1].entityName).toBe('Entity2');
    });

    it('should include relations in unified items', () => {
      const graph: MCPKnowledgeGraph = {
        entities: [
          { name: 'A', entityType: 'concept', observations: [] },
          { name: 'B', entityType: 'concept', observations: [] },
        ],
        relations: [{ from: 'A', to: 'B', relationType: 'relates_to' }],
      };

      service.setKnowledgeGraph(graph);
      const items = service.getUnifiedItems();

      // Entity A should have the relation
      const itemA = items.find((i) => i.entityName === 'A');
      expect(itemA?.relations).toHaveLength(1);

      // Entity B should also have the relation (it's bidirectional in display)
      const itemB = items.find((i) => i.entityName === 'B');
      expect(itemB?.relations).toHaveLength(1);
    });
  });

  describe('searchEntities', () => {
    beforeEach(() => {
      const graph: MCPKnowledgeGraph = {
        entities: [
          {
            name: 'TypeScript_prefs',
            entityType: 'preference',
            observations: ['Prefers TypeScript', 'Uses strict mode'],
          },
          {
            name: 'React',
            entityType: 'technology',
            observations: ['Frontend framework', 'Version 19'],
          },
          {
            name: 'Quack',
            entityType: 'project',
            observations: ['Desktop app', 'Built with Tauri'],
          },
        ],
        relations: [],
      };
      service.setKnowledgeGraph(graph);
    });

    it('should search by entity name', () => {
      const results = service.searchEntities('TypeScript');

      expect(results).toHaveLength(1);
      expect(results[0].entityName).toBe('TypeScript_prefs');
    });

    it('should search by entity type', () => {
      const results = service.searchEntities('technology');

      expect(results).toHaveLength(1);
      expect(results[0].entityName).toBe('React');
    });

    it('should search in observations', () => {
      const results = service.searchEntities('strict mode');

      expect(results).toHaveLength(1);
      expect(results[0].entityName).toBe('TypeScript_prefs');
    });

    it('should be case-insensitive', () => {
      const results = service.searchEntities('REACT');

      expect(results).toHaveLength(1);
      expect(results[0].entityName).toBe('React');
    });

    it('should return empty for no matches', () => {
      const results = service.searchEntities('nonexistent');

      expect(results).toEqual([]);
    });

    it('should return empty when no graph is set', () => {
      service.clearCache();
      const results = service.searchEntities('anything');

      expect(results).toEqual([]);
    });
  });

  describe('filterByType', () => {
    beforeEach(() => {
      const graph: MCPKnowledgeGraph = {
        entities: [
          { name: 'Pref1', entityType: 'preference', observations: [] },
          { name: 'Fact1', entityType: 'fact', observations: [] },
          { name: 'Fact2', entityType: 'fact', observations: [] },
        ],
        relations: [],
      };
      service.setKnowledgeGraph(graph);
    });

    it('should filter entities by type', () => {
      const results = service.filterByType('fact');

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.entityType === 'fact')).toBe(true);
    });

    it('should be case-insensitive', () => {
      const results = service.filterByType('PREFERENCE');

      expect(results).toHaveLength(1);
      expect(results[0].entityName).toBe('Pref1');
    });

    it('should return empty for unknown type', () => {
      const results = service.filterByType('unknown');

      expect(results).toEqual([]);
    });
  });

  describe('getEntity', () => {
    beforeEach(() => {
      const graph: MCPKnowledgeGraph = {
        entities: [
          { name: 'TestEntity', entityType: 'fact', observations: ['Test'] },
        ],
        relations: [],
      };
      service.setKnowledgeGraph(graph);
    });

    it('should return entity by name', () => {
      const entity = service.getEntity('TestEntity');

      expect(entity).toBeDefined();
      expect(entity?.name).toBe('TestEntity');
    });

    it('should return undefined for unknown entity', () => {
      const entity = service.getEntity('Unknown');

      expect(entity).toBeUndefined();
    });
  });

  describe('getRelationsForEntity', () => {
    beforeEach(() => {
      const graph: MCPKnowledgeGraph = {
        entities: [
          { name: 'A', entityType: 'concept', observations: [] },
          { name: 'B', entityType: 'concept', observations: [] },
          { name: 'C', entityType: 'concept', observations: [] },
        ],
        relations: [
          { from: 'A', to: 'B', relationType: 'uses' },
          { from: 'B', to: 'C', relationType: 'extends' },
          { from: 'A', to: 'C', relationType: 'knows' },
        ],
      };
      service.setKnowledgeGraph(graph);
    });

    it('should return outgoing relations', () => {
      const relations = service.getRelationsForEntity('A');

      expect(relations).toHaveLength(2);
      expect(relations.some((r) => r.to === 'B')).toBe(true);
      expect(relations.some((r) => r.to === 'C')).toBe(true);
    });

    it('should return incoming relations', () => {
      const relations = service.getRelationsForEntity('C');

      expect(relations).toHaveLength(2);
      expect(relations.some((r) => r.from === 'B')).toBe(true);
      expect(relations.some((r) => r.from === 'A')).toBe(true);
    });

    it('should return empty for entity with no relations', () => {
      service.setKnowledgeGraph({
        entities: [{ name: 'Lonely', entityType: 'concept', observations: [] }],
        relations: [],
      });

      const relations = service.getRelationsForEntity('Lonely');

      expect(relations).toEqual([]);
    });
  });

  describe('cache management', () => {
    it('should clear cache correctly', () => {
      service.setKnowledgeGraph({
        entities: [{ name: 'Test', entityType: 'fact', observations: [] }],
        relations: [],
      });

      expect(service.getKnowledgeGraph()).not.toBeNull();

      service.clearCache();

      expect(service.getKnowledgeGraph()).toBeNull();
    });

    it('should report cache validity', () => {
      // Initially invalid
      expect(service.isCacheValid()).toBe(false);

      // After setting graph, should be valid
      service.setKnowledgeGraph({ entities: [], relations: [] });
      expect(service.isCacheValid()).toBe(true);

      // After clearing, should be invalid
      service.clearCache();
      expect(service.isCacheValid()).toBe(false);
    });
  });
});

describe('Real-World Scenarios', () => {
  it('should handle typical MCP knowledge graph structure', () => {
    const service = MCPMemoryService.getInstance();
    service.clearCache();

    // Simulating what mcp__memory__read_graph returns
    const realWorldGraph: MCPKnowledgeGraph = {
      entities: [
        {
          name: 'Alek',
          entityType: 'person',
          observations: [
            'Product Manager & AI-First Developer',
            'Works at C&C Apple Premium Partner',
            'Located in Puglia, Italy',
          ],
        },
        {
          name: 'Quack',
          entityType: 'project',
          observations: [
            'Multi-agentic Tauri desktop app',
            'Uses React 19.1.1 and TypeScript 5.8.3',
            'Powered by Claude Agent SDK',
          ],
        },
        {
          name: 'TypeScript_preferences',
          entityType: 'preference',
          observations: [
            'Always use strict mode',
            'Prefer absolute imports with @ alias',
            '20-line functions max',
          ],
        },
      ],
      relations: [
        { from: 'Alek', to: 'Quack', relationType: 'develops' },
        { from: 'Quack', to: 'TypeScript_preferences', relationType: 'follows' },
      ],
    };

    service.setKnowledgeGraph(realWorldGraph);

    const items = service.getUnifiedItems();
    expect(items).toHaveLength(3);

    // Check person entity
    const alek = items.find((i) => i.entityName === 'Alek');
    expect(alek?.category).toBe('context');
    expect(alek?.source).toBe('mcp');
    expect(alek?.relations).toHaveLength(1);
    expect(alek?.content).toContain('Product Manager');

    // Check project entity
    const quack = items.find((i) => i.entityName === 'Quack');
    expect(quack?.category).toBe('context');
    expect(quack?.relations).toHaveLength(2);

    // Check preference entity
    const prefs = items.find((i) => i.entityName === 'TypeScript_preferences');
    expect(prefs?.category).toBe('preference');
    expect(prefs?.content).toContain('strict mode');
  });

  it('should work with combined Quack and MCP memories', () => {
    const service = MCPMemoryService.getInstance();
    service.clearCache();

    // MCP entities
    service.setKnowledgeGraph({
      entities: [
        {
          name: 'Tech_stack',
          entityType: 'fact',
          observations: ['Uses Tauri 2.8.5', 'React 19', 'TypeScript 5.8'],
        },
      ],
      relations: [],
    });

    // Quack memory
    const quackMemory: QuackMemory = {
      id: 'mem-quack-1',
      content: 'User prefers dark mode',
      category: 'preference',
      confidence: 'high',
      scope: 'global',
      keywords: ['dark', 'mode'],
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      accessCount: 0,
      userVerified: true,
      isArchived: false,
    };

    // Get unified items from both sources
    const mcpItems = service.getUnifiedItems();
    const quackItem = quackMemoryToUnifiedItem(quackMemory);

    // Combined list
    const combined = [...mcpItems, quackItem];

    expect(combined).toHaveLength(2);
    expect(combined.filter((i) => i.source === 'mcp')).toHaveLength(1);
    expect(combined.filter((i) => i.source === 'quack')).toHaveLength(1);
  });
});
