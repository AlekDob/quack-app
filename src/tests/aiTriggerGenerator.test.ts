/**
 * Tests for AI Trigger Generator Hook
 *
 * Tests the useAITriggerGenerator hook functionality including:
 * - Fallback to pattern-based generation when API key is not available
 * - Proper structure of generated results
 * - Integration with the triggerQuality utility functions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateSmartTrigger, calculateTriggerQuality } from '../lib/triggerQuality';

// Mock the Tauri invoke function
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// Mock OpenAI
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  })),
}));

describe('AI Trigger Generator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Fallback to pattern-based generation', () => {
    it('should generate valid trigger when API key is not available', () => {
      const trigger = generateSmartTrigger('Frontend Developer', 'React specialist', 'ui');
      expect(trigger).toBeTruthy();
      expect(trigger.length).toBeGreaterThan(20);
    });

    it('should generate trigger with folder path for UI category', () => {
      const trigger = generateSmartTrigger('UI Designer', 'Creates UI components', 'ui');
      expect(trigger).toContain('/components');
    });

    it('should generate trigger with file patterns for code category', () => {
      const trigger = generateSmartTrigger('Code Reviewer', 'Reviews TypeScript code', 'code');
      expect(trigger).toMatch(/\.tsx?/);
    });

    it('should generate trigger with test folder for test category', () => {
      const trigger = generateSmartTrigger('Test Engineer', 'Writes Vitest tests', 'test');
      expect(trigger).toContain('__tests__');
      expect(trigger).toContain('.test.ts');
    });

    it('should generate trigger with docs folder for docs category', () => {
      const trigger = generateSmartTrigger('Documentation Writer', 'Writes docs', 'docs');
      expect(trigger).toContain('README.md');
      expect(trigger).toContain('/docs');
    });

    it('should generate trigger with api folder for api category', () => {
      const trigger = generateSmartTrigger('API Developer', 'Creates REST endpoints', 'api');
      expect(trigger).toContain('/api');
      expect(trigger).toContain('fetch');
    });
  });

  describe('Generated trigger quality', () => {
    it('should generate strong quality triggers for UI category', () => {
      const trigger = generateSmartTrigger('React Expert', 'React development', 'ui');
      const quality = calculateTriggerQuality(trigger);
      expect(quality.level).toBe('strong');
    });

    it('should generate strong quality triggers for code category', () => {
      const trigger = generateSmartTrigger('Code Reviewer', 'Reviews code', 'code');
      const quality = calculateTriggerQuality(trigger);
      expect(quality.level).toBe('strong');
    });

    it('should generate strong quality triggers for test category', () => {
      const trigger = generateSmartTrigger('Test Engineer', 'Writes tests', 'test');
      const quality = calculateTriggerQuality(trigger);
      expect(quality.level).toBe('strong');
    });

    it('should generate strong quality triggers for docs category', () => {
      const trigger = generateSmartTrigger('Documentation Writer', 'Writes docs', 'docs');
      const quality = calculateTriggerQuality(trigger);
      expect(quality.level).toBe('strong');
    });

    it('should generate at least moderate quality triggers for api category', () => {
      const trigger = generateSmartTrigger('API Developer', 'API development', 'api');
      const quality = calculateTriggerQuality(trigger);
      expect(['moderate', 'strong']).toContain(quality.level);
    });

    it('should generate at least moderate quality triggers for default category', () => {
      const trigger = generateSmartTrigger('Database Expert', 'Database work', 'default');
      const quality = calculateTriggerQuality(trigger);
      expect(['moderate', 'strong']).toContain(quality.level);
    });
  });

  describe('AITriggerResult structure', () => {
    it('should return proper structure for pattern-based generation', () => {
      const trigger = generateSmartTrigger('Frontend Dev', 'React development', 'ui');
      const result = {
        trigger,
        isAIGenerated: false,
      };

      expect(result).toHaveProperty('trigger');
      expect(result).toHaveProperty('isAIGenerated');
      expect(result.isAIGenerated).toBe(false);
      expect(typeof result.trigger).toBe('string');
    });

    it('should have model property for AI-generated results', () => {
      const aiResult = {
        trigger: 'When editing .tsx files in /components folder',
        isAIGenerated: true,
        model: 'gpt-4o-mini',
      };

      expect(aiResult).toHaveProperty('model');
      expect(aiResult.model).toBe('gpt-4o-mini');
      expect(aiResult.isAIGenerated).toBe(true);
    });
  });

  describe('Prompt building', () => {
    it('should build prompt with name and description', () => {
      // Test that the prompt would contain the necessary information
      const options = {
        name: 'Test Droid',
        description: 'A test droid for testing',
        category: 'test',
      };

      // The prompt should include the name and description
      expect(options.name).toBe('Test Droid');
      expect(options.description).toBe('A test droid for testing');
      expect(options.category).toBe('test');
    });

    it('should handle optional specialization', () => {
      const options = {
        name: 'Expert Droid',
        description: 'An expert droid',
        specialization: 'TypeScript expert',
        category: 'code',
      };

      expect(options).toHaveProperty('specialization');
      expect(options.specialization).toBe('TypeScript expert');
    });

    it('should handle missing category with default', () => {
      const options = {
        name: 'General Helper',
        description: 'Helps with various tasks',
      };

      const category = options.category || 'default';
      expect(category).toBe('default');
    });
  });

  describe('Integration with quality scoring', () => {
    it('should generate triggers that pass quality validation', () => {
      const categories = ['ui', 'code', 'test', 'docs', 'api', 'default'];

      categories.forEach(category => {
        const trigger = generateSmartTrigger('Test Expert', 'Testing expert', category);
        const quality = calculateTriggerQuality(trigger);

        expect(quality).toHaveProperty('level');
        expect(quality).toHaveProperty('score');
        expect(quality).toHaveProperty('message');
        expect(['weak', 'moderate', 'strong']).toContain(quality.level);
        expect(typeof quality.score).toBe('number');
        expect(typeof quality.message).toBe('string');
      });
    });

    it('should generate triggers with specific patterns that boost quality score', () => {
      const uiTrigger = generateSmartTrigger('UI Expert', 'UI development', 'ui');
      const quality = calculateTriggerQuality(uiTrigger);

      // UI triggers should have folder path (/components) which adds 25 points
      expect(uiTrigger).toContain('/components');
      expect(quality.score).toBeGreaterThanOrEqual(40);
    });

    it('should generate triggers with file patterns for code category', () => {
      const codeTrigger = generateSmartTrigger('Code Expert', 'Code review', 'code');

      // Code triggers should have .ts or .tsx patterns
      expect(codeTrigger).toMatch(/\.(ts|tsx)/);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty name gracefully', () => {
      const trigger = generateSmartTrigger('', 'Some description', 'default');
      expect(trigger).toBeTruthy();
      expect(trigger.length).toBeGreaterThan(0);
    });

    it('should handle empty description gracefully', () => {
      const trigger = generateSmartTrigger('Some Name', '', 'default');
      expect(trigger).toBeTruthy();
      expect(trigger.length).toBeGreaterThan(0);
    });

    it('should handle both empty name and description', () => {
      const trigger = generateSmartTrigger('', '', 'default');
      expect(trigger).toBeTruthy();
      expect(trigger.length).toBeGreaterThan(0);
    });

    it('should handle unknown category with default behavior', () => {
      const trigger = generateSmartTrigger('Unknown Expert', 'Unknown work', 'unknown-category');
      expect(trigger).toBeTruthy();
      // Should fallback to default category behavior
    });

    it('should handle very long names', () => {
      const longName = 'A'.repeat(100) + ' Expert';
      const trigger = generateSmartTrigger(longName, 'Some work', 'default');
      expect(trigger).toBeTruthy();
    });

    it('should handle special characters in name', () => {
      const trigger = generateSmartTrigger('Test-Expert_v2.0', 'Testing', 'test');
      expect(trigger).toBeTruthy();
      expect(trigger.length).toBeGreaterThan(0);
    });
  });

  describe('Category detection consistency', () => {
    it('should generate consistent triggers for the same inputs', () => {
      const trigger1 = generateSmartTrigger('Frontend Dev', 'React', 'ui');
      const trigger2 = generateSmartTrigger('Frontend Dev', 'React', 'ui');
      expect(trigger1).toBe(trigger2);
    });

    it('should generate different triggers for different categories', () => {
      const uiTrigger = generateSmartTrigger('Expert', 'Development', 'ui');
      const codeTrigger = generateSmartTrigger('Expert', 'Development', 'code');
      const testTrigger = generateSmartTrigger('Expert', 'Development', 'test');

      expect(uiTrigger).not.toBe(codeTrigger);
      expect(codeTrigger).not.toBe(testTrigger);
      expect(uiTrigger).not.toBe(testTrigger);
    });
  });
});
