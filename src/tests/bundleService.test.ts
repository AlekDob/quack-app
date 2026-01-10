import { describe, it, expect } from 'vitest';
import {
  validateBundleManifest,
  calculateBundlePowerRating,
  exportAgentBundle,
} from '../services/bundleService';
import type { AgentBundleManifest, SavedAgent } from '../types';

/**
 * Bundle Service Tests
 *
 * Tests for the Quack Agent Bundle export/import system.
 */

describe('Bundle Service - validateBundleManifest()', () => {
  it('should validate a complete valid manifest', () => {
    const validManifest: AgentBundleManifest = {
      $schema: 'https://quack.dev/schemas/agent-bundle-v1.json',
      id: 'agent-test',
      version: '1.0.0',
      name: 'test-agent',
      displayName: 'Test Agent',
      description: 'A test agent',
      author: {
        name: 'Test Author',
        github: 'testauthor',
        email: 'test@example.com',
      },
      license: 'MIT',
      repository: 'https://github.com/test/repo',
      personality: {
        role: 'Tester',
        class: 'test',
        communicationStyle: 'professional',
        quirks: 'Loves testing',
        avatar: 'test.png',
        color: '#FF6B35',
      },
      equipment: {
        skills: [{ id: 'skill-1', required: true }],
        droids: [{ id: 'droid-1', required: true }],
        rules: [{ id: 'rule-1', required: false }],
        commands: [{ id: 'command-1', required: true }],
      },
      compatibility: {
        quackVersion: '>=1.0.0',
        claudeCodeVersion: '>=0.2.0',
      },
      marketplace: {
        category: 'custom',
        tags: ['test', 'example'],
        featured: false,
        verified: false,
        downloads: 0,
      },
    };

    expect(validateBundleManifest(validManifest)).toBe(true);
  });

  it('should validate a minimal valid manifest', () => {
    const minimalManifest: Partial<AgentBundleManifest> = {
      id: 'minimal-agent',
      version: '1.0.0',
      name: 'minimal',
      personality: {
        role: 'Agent',
        class: 'custom',
        communicationStyle: 'professional',
        avatar: 'avatar.png',
        color: '#FF0000',
      },
      equipment: {
        skills: [],
        droids: [],
        rules: [],
        commands: [],
      },
      compatibility: {
        quackVersion: '>=1.0.0',
        claudeCodeVersion: '>=0.2.0',
      },
    };

    expect(validateBundleManifest(minimalManifest)).toBe(true);
  });

  it('should reject manifest missing id', () => {
    const manifest = {
      version: '1.0.0',
      name: 'test',
      personality: { role: 'Agent', class: 'custom', communicationStyle: 'professional', avatar: 'test.png', color: '#000' },
      equipment: { skills: [], droids: [], rules: [], commands: [] },
      compatibility: { quackVersion: '>=1.0.0', claudeCodeVersion: '>=0.2.0' },
    };

    expect(validateBundleManifest(manifest)).toBe(false);
  });

  it('should reject manifest missing version', () => {
    const manifest = {
      id: 'test',
      name: 'test',
      personality: { role: 'Agent', class: 'custom', communicationStyle: 'professional', avatar: 'test.png', color: '#000' },
      equipment: { skills: [], droids: [], rules: [], commands: [] },
      compatibility: { quackVersion: '>=1.0.0', claudeCodeVersion: '>=0.2.0' },
    };

    expect(validateBundleManifest(manifest)).toBe(false);
  });

  it('should reject manifest missing name', () => {
    const manifest = {
      id: 'test',
      version: '1.0.0',
      personality: { role: 'Agent', class: 'custom', communicationStyle: 'professional', avatar: 'test.png', color: '#000' },
      equipment: { skills: [], droids: [], rules: [], commands: [] },
      compatibility: { quackVersion: '>=1.0.0', claudeCodeVersion: '>=0.2.0' },
    };

    expect(validateBundleManifest(manifest)).toBe(false);
  });

  it('should reject manifest missing personality', () => {
    const manifest = {
      id: 'test',
      version: '1.0.0',
      name: 'test',
      equipment: { skills: [], droids: [], rules: [], commands: [] },
      compatibility: { quackVersion: '>=1.0.0', claudeCodeVersion: '>=0.2.0' },
    };

    expect(validateBundleManifest(manifest)).toBe(false);
  });

  it('should reject manifest missing equipment', () => {
    const manifest = {
      id: 'test',
      version: '1.0.0',
      name: 'test',
      personality: { role: 'Agent', class: 'custom', communicationStyle: 'professional', avatar: 'test.png', color: '#000' },
      compatibility: { quackVersion: '>=1.0.0', claudeCodeVersion: '>=0.2.0' },
    };

    expect(validateBundleManifest(manifest)).toBe(false);
  });

  it('should reject manifest missing compatibility', () => {
    const manifest = {
      id: 'test',
      version: '1.0.0',
      name: 'test',
      personality: { role: 'Agent', class: 'custom', communicationStyle: 'professional', avatar: 'test.png', color: '#000' },
      equipment: { skills: [], droids: [], rules: [], commands: [] },
    };

    expect(validateBundleManifest(manifest)).toBe(false);
  });

  it('should reject null', () => {
    expect(validateBundleManifest(null)).toBe(false);
  });

  it('should reject undefined', () => {
    expect(validateBundleManifest(undefined)).toBe(false);
  });

  it('should reject non-object types', () => {
    expect(validateBundleManifest('string')).toBe(false);
    expect(validateBundleManifest(123)).toBe(false);
    expect(validateBundleManifest(true)).toBe(false);
    expect(validateBundleManifest([])).toBe(false);
  });

  it('should reject empty object', () => {
    expect(validateBundleManifest({})).toBe(false);
  });

  it('should allow extra fields (forward compatibility)', () => {
    const manifestWithExtra = {
      id: 'test',
      version: '1.0.0',
      name: 'test',
      personality: { role: 'Agent', class: 'custom', communicationStyle: 'professional', avatar: 'test.png', color: '#000' },
      equipment: { skills: [], droids: [], rules: [], commands: [] },
      compatibility: { quackVersion: '>=1.0.0', claudeCodeVersion: '>=0.2.0' },
      futureField: 'some new data', // Extra field
    };

    expect(validateBundleManifest(manifestWithExtra)).toBe(true);
  });
});

describe('Bundle Service - calculateBundlePowerRating()', () => {
  it('should delegate to calculatePowerRating utility', () => {
    const result = calculateBundlePowerRating(3, 2, 4, 2);

    // Should match the power rating calculation
    expect(result.total).toBe(1050); // 100 + 300 + 300 + 200 + 150
    expect(result.base).toBe(100);
    expect(result.skills).toBe(300);
    expect(result.droids).toBe(300);
    expect(result.rules).toBe(200);
    expect(result.commands).toBe(150);
  });

  it('should return base power for empty equipment', () => {
    const result = calculateBundlePowerRating(0, 0, 0, 0);

    expect(result.total).toBe(100);
  });

  it('should return correct breakdown', () => {
    const result = calculateBundlePowerRating(2, 1, 3, 1);

    // 100 + 2*100 + 1*150 + 3*50 + 1*75 = 100 + 200 + 150 + 150 + 75 = 675
    expect(result).toEqual({
      total: 675,
      base: 100,
      skills: 200,
      droids: 150,
      rules: 150,
      commands: 75,
      skillCount: 2,
      droidCount: 1,
      ruleCount: 3,
      commandCount: 1,
    });
  });

  it('should handle large equipment counts', () => {
    const result = calculateBundlePowerRating(10, 10, 10, 10);

    expect(result.total).toBe(3850);
  });
});

describe('Bundle Service - exportAgentBundle()', () => {
  const mockAgent: SavedAgent = {
    id: 'agent-test-123',
    name: 'Test Agent',
    avatar: 'test-avatar.png',
    color: '#FF6B35',
    personality: {
      id: 'agent-test-123',
      name: 'Test Agent',
      role: 'Test Engineer',
      communicationStyle: 'friendly',
      customNotes: 'Loves testing',
    },
    createdAt: Date.now(),
    lastUsed: Date.now(),
    usageCount: 5,
  };

  it('should create bundle with correct manifest structure', async () => {
    const bundle = await exportAgentBundle(
      mockAgent,
      ['skill-1', 'skill-2'],
      ['droid-1'],
      ['rule-1', 'rule-2', 'rule-3'],
      ['command-1']
    );

    expect(bundle.manifest).toBeDefined();
    expect(bundle.manifest.id).toBe(mockAgent.id);
    expect(bundle.manifest.name).toBe(mockAgent.name);
    expect(bundle.manifest.version).toBe('1.0.0');
  });

  it('should include agent personality in manifest', async () => {
    const bundle = await exportAgentBundle(mockAgent, [], [], [], []);

    expect(bundle.manifest.personality.role).toBe('Test Engineer');
    expect(bundle.manifest.personality.communicationStyle).toBe('friendly');
    expect(bundle.manifest.personality.avatar).toBe('test-avatar.png');
    expect(bundle.manifest.personality.color).toBe('#FF6B35');
  });

  it('should include equipment configuration in manifest', async () => {
    const bundle = await exportAgentBundle(
      mockAgent,
      ['skill-1', 'skill-2'],
      ['droid-1'],
      ['rule-1', 'rule-2'],
      ['command-1']
    );

    expect(bundle.manifest.equipment.skills).toEqual([
      { id: 'skill-1', required: true },
      { id: 'skill-2', required: true },
    ]);

    expect(bundle.manifest.equipment.droids).toEqual([
      { id: 'droid-1', required: true },
    ]);

    expect(bundle.manifest.equipment.rules).toEqual([
      { id: 'rule-1', required: true },
      { id: 'rule-2', required: true },
    ]);

    expect(bundle.manifest.equipment.commands).toEqual([
      { id: 'command-1', required: true },
    ]);
  });

  it('should handle empty equipment lists', async () => {
    const bundle = await exportAgentBundle(mockAgent, [], [], [], []);

    expect(bundle.manifest.equipment.skills).toEqual([]);
    expect(bundle.manifest.equipment.droids).toEqual([]);
    expect(bundle.manifest.equipment.rules).toEqual([]);
    expect(bundle.manifest.equipment.commands).toEqual([]);
  });

  it('should include compatibility requirements', async () => {
    const bundle = await exportAgentBundle(mockAgent, [], [], [], []);

    expect(bundle.manifest.compatibility.quackVersion).toBe('>=1.0.0');
    expect(bundle.manifest.compatibility.claudeCodeVersion).toBe('>=0.2.0');
  });

  it('should include marketplace metadata', async () => {
    const bundle = await exportAgentBundle(mockAgent, [], [], [], []);

    expect(bundle.manifest.marketplace.category).toBe('custom');
    expect(bundle.manifest.marketplace.tags).toEqual([]);
    expect(bundle.manifest.marketplace.featured).toBe(false);
    expect(bundle.manifest.marketplace.verified).toBe(false);
    expect(bundle.manifest.marketplace.downloads).toBe(0);
  });

  it('should include author metadata with placeholder', async () => {
    const bundle = await exportAgentBundle(mockAgent, [], [], [], []);

    expect(bundle.manifest.author.name).toBe('User'); // TODO: Get from settings
    expect(bundle.manifest.author.github).toBe('');
    expect(bundle.manifest.author.email).toBe('');
  });

  it('should set license to MIT', async () => {
    const bundle = await exportAgentBundle(mockAgent, [], [], [], []);

    expect(bundle.manifest.license).toBe('MIT');
  });

  it('should include $schema reference', async () => {
    const bundle = await exportAgentBundle(mockAgent, [], [], [], []);

    expect(bundle.manifest.$schema).toBe('https://quack.dev/schemas/agent-bundle-v1.json');
  });

  it('should initialize empty file arrays (TODO: implement file loading)', async () => {
    const bundle = await exportAgentBundle(mockAgent, ['skill-1'], ['droid-1'], ['rule-1'], ['command-1']);

    // Currently returns empty arrays (file loading not yet implemented)
    expect(bundle.skillsFiles).toEqual([]);
    expect(bundle.droidsFiles).toEqual([]);
    expect(bundle.rulesFiles).toEqual([]);
    expect(bundle.commandsFiles).toEqual([]);
    expect(bundle.assetsFiles).toEqual([]);
  });

  it('should handle agent without personality gracefully', async () => {
    const agentWithoutPersonality: SavedAgent = {
      ...mockAgent,
      personality: undefined as any,
    };

    const bundle = await exportAgentBundle(agentWithoutPersonality, [], [], [], []);

    expect(bundle.manifest.description).toBe('Custom Agent'); // Fallback
    expect(bundle.manifest.personality.role).toBe('Agent'); // Fallback
  });

  it('should use agent role as description when available', async () => {
    const bundle = await exportAgentBundle(mockAgent, [], [], [], []);

    expect(bundle.manifest.description).toBe('Test Engineer');
  });

  it('should set personality class to "custom"', async () => {
    const bundle = await exportAgentBundle(mockAgent, [], [], [], []);

    expect(bundle.manifest.personality.class).toBe('custom');
  });

  it('should handle quirks field from personality', async () => {
    const agentWithQuirks: SavedAgent = {
      ...mockAgent,
      personality: {
        ...mockAgent.personality,
        quirks: 'Responds with "quack quack"',
      },
    };

    const bundle = await exportAgentBundle(agentWithQuirks, [], [], [], []);

    expect(bundle.manifest.personality.quirks).toBe('Responds with "quack quack"');
  });

  it('should create displayName from agent name', async () => {
    const bundle = await exportAgentBundle(mockAgent, [], [], [], []);

    expect(bundle.manifest.displayName).toBe(mockAgent.name);
  });
});

describe('Bundle Service - Integration Tests', () => {
  it('should create a valid bundle that passes validation', async () => {
    const mockAgent: SavedAgent = {
      id: 'integration-test',
      name: 'Integration Agent',
      avatar: 'avatar.png',
      color: '#004E89',
      personality: {
        id: 'integration-test',
        name: 'Integration Agent',
        role: 'Integration Tester',
        communicationStyle: 'professional',
      },
      createdAt: Date.now(),
      lastUsed: Date.now(),
      usageCount: 1,
    };

    const bundle = await exportAgentBundle(
      mockAgent,
      ['skill-1'],
      ['droid-1'],
      ['rule-1'],
      ['command-1']
    );

    // Bundle manifest should pass validation
    expect(validateBundleManifest(bundle.manifest)).toBe(true);
  });

  it('should calculate correct power rating for exported bundle', async () => {
    const mockAgent: SavedAgent = {
      id: 'power-test',
      name: 'Power Agent',
      avatar: 'avatar.png',
      color: '#F7931E',
      personality: {
        id: 'power-test',
        name: 'Power Agent',
        role: 'Power Tester',
        communicationStyle: 'friendly',
      },
      createdAt: Date.now(),
      lastUsed: Date.now(),
      usageCount: 1,
    };

    const bundle = await exportAgentBundle(
      mockAgent,
      ['skill-1', 'skill-2', 'skill-3'], // 3 skills
      ['droid-1', 'droid-2'], // 2 droids
      ['rule-1', 'rule-2', 'rule-3', 'rule-4'], // 4 rules
      ['command-1', 'command-2'] // 2 commands
    );

    const powerRating = calculateBundlePowerRating(
      bundle.manifest.equipment.skills.length,
      bundle.manifest.equipment.droids.length,
      bundle.manifest.equipment.rules.length,
      bundle.manifest.equipment.commands.length
    );

    // 100 + 3*100 + 2*150 + 4*50 + 2*75 = 1050
    expect(powerRating.total).toBe(1050);
  });

  it('should create minimal bundle with only agent data', async () => {
    const minimalAgent: SavedAgent = {
      id: 'minimal',
      name: 'Minimal Agent',
      avatar: 'minimal.png',
      color: '#00D9FF',
      personality: {
        id: 'minimal',
        name: 'Minimal Agent',
        role: 'Minimal',
        communicationStyle: 'professional',
      },
      createdAt: Date.now(),
      lastUsed: Date.now(),
      usageCount: 0,
    };

    const bundle = await exportAgentBundle(minimalAgent, [], [], [], []);

    // Should still be valid
    expect(validateBundleManifest(bundle.manifest)).toBe(true);

    // Power rating should be base only
    const powerRating = calculateBundlePowerRating(0, 0, 0, 0);
    expect(powerRating.total).toBe(100);
  });

  it('should create pro-level bundle with maximum equipment', async () => {
    const proAgent: SavedAgent = {
      id: 'pro-agent',
      name: 'Pro Agent',
      avatar: 'pro.png',
      color: '#FF0000',
      personality: {
        id: 'pro-agent',
        name: 'Pro Agent',
        role: 'Pro Engineer',
        communicationStyle: 'professional',
      },
      createdAt: Date.now(),
      lastUsed: Date.now(),
      usageCount: 100,
    };

    const bundle = await exportAgentBundle(
      proAgent,
      ['s1', 's2', 's3', 's4'], // 4 skills
      ['d1', 'd2', 'd3'], // 3 droids
      ['r1', 'r2', 'r3', 'r4', 'r5'], // 5 rules
      ['c1', 'c2', 'c3'] // 3 commands
    );

    expect(validateBundleManifest(bundle.manifest)).toBe(true);

    const powerRating = calculateBundlePowerRating(4, 3, 5, 3);
    expect(powerRating.total).toBe(1425); // Pro tier
  });
});

describe('Bundle Service - Edge Cases', () => {
  it('should handle agent with empty strings', async () => {
    const emptyAgent: SavedAgent = {
      id: '',
      name: '',
      avatar: '',
      color: '',
      personality: {} as any,
      createdAt: 0,
      lastUsed: 0,
      usageCount: 0,
    };

    const bundle = await exportAgentBundle(emptyAgent, [], [], [], []);

    expect(bundle.manifest.id).toBe('');
    expect(bundle.manifest.name).toBe('');
  });

  it('should handle very long equipment lists', async () => {
    const mockAgent: SavedAgent = {
      id: 'long-list',
      name: 'Long List Agent',
      avatar: 'avatar.png',
      color: '#000',
      personality: {
        id: 'long-list',
        name: 'Long List Agent',
        role: 'Agent',
        communicationStyle: 'professional',
      },
      createdAt: Date.now(),
      lastUsed: Date.now(),
      usageCount: 1,
    };

    const manySkills = Array.from({ length: 100 }, (_, i) => `skill-${i}`);
    const bundle = await exportAgentBundle(mockAgent, manySkills, [], [], []);

    expect(bundle.manifest.equipment.skills.length).toBe(100);
    expect(bundle.manifest.equipment.skills[0]).toEqual({ id: 'skill-0', required: true });
    expect(bundle.manifest.equipment.skills[99]).toEqual({ id: 'skill-99', required: true });
  });

  it('should mark all equipment as required by default', async () => {
    const mockAgent: SavedAgent = {
      id: 'required-test',
      name: 'Required Test',
      avatar: 'avatar.png',
      color: '#000',
      personality: {
        id: 'required-test',
        name: 'Required Test',
        role: 'Agent',
        communicationStyle: 'professional',
      },
      createdAt: Date.now(),
      lastUsed: Date.now(),
      usageCount: 1,
    };

    const bundle = await exportAgentBundle(
      mockAgent,
      ['skill-1'],
      ['droid-1'],
      ['rule-1'],
      ['command-1']
    );

    expect(bundle.manifest.equipment.skills[0].required).toBe(true);
    expect(bundle.manifest.equipment.droids[0].required).toBe(true);
    expect(bundle.manifest.equipment.rules[0].required).toBe(true);
    expect(bundle.manifest.equipment.commands[0].required).toBe(true);
  });
});
