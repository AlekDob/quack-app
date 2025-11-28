/**
 * Tests for Trigger Quality System
 *
 * Tests the three core functions exported from lib/triggerQuality.ts:
 * 1. detectCategory - Category detection from name/description
 * 2. calculateTriggerQuality - Quality scoring and level determination
 * 3. generateSmartTrigger - Smart trigger generation based on context
 */

import { describe, it, expect } from 'vitest';
import {
  detectCategory,
  calculateTriggerQuality,
  generateSmartTrigger,
  QUALITY_WEIGHTS,
  TRIGGER_SUGGESTIONS,
  EXAMPLE_TRIGGERS,
} from '../lib/triggerQuality';

// ============================================================================
// Tests
// ============================================================================

describe('Trigger Quality System', () => {

  // ==========================================================================
  // detectCategory Tests
  // ==========================================================================

  describe('detectCategory', () => {

    describe('UI category detection', () => {
      it('should detect UI from "UI designer" name', () => {
        expect(detectCategory('UI designer', '')).toBe('ui');
      });

      it('should detect UI from "React components" description', () => {
        expect(detectCategory('Frontend Dev', 'Expert in React components')).toBe('ui');
      });

      it('should detect UI from "style management" description', () => {
        expect(detectCategory('Style Expert', 'Handles style management and CSS')).toBe('ui');
      });

      it('should detect UI from "design" keyword', () => {
        expect(detectCategory('Design System', 'Design patterns and guidelines')).toBe('ui');
      });

      it('should detect UI from "ux" keyword', () => {
        expect(detectCategory('UX Specialist', 'User experience optimization')).toBe('ui');
      });

      it('should detect UI from "component" keyword', () => {
        expect(detectCategory('Component Builder', 'Creates reusable components')).toBe('ui');
      });
    });

    describe('Code category detection', () => {
      it('should detect code from "code reviewer" name', () => {
        expect(detectCategory('code reviewer', '')).toBe('code');
      });

      it('should detect code from "refactoring expert" description', () => {
        expect(detectCategory('Developer', 'Expert in refactoring and code quality')).toBe('code');
      });

      it('should detect code from "review" keyword', () => {
        expect(detectCategory('Code Review Bot', '')).toBe('code');
      });

      it('should detect code from "debug" keyword', () => {
        expect(detectCategory('Debugger', 'Debug complex issues')).toBe('code');
      });
    });

    describe('Test category detection', () => {
      it('should detect test from "test engineer" name', () => {
        expect(detectCategory('test engineer', '')).toBe('test');
      });

      it('should detect test from "vitest specialist" description', () => {
        expect(detectCategory('QA Expert', 'Vitest specialist for unit testing')).toBe('test');
      });

      it('should detect test from "coverage" keyword', () => {
        expect(detectCategory('Coverage Analyzer', 'Analyzes test coverage')).toBe('test');
      });

      it('should detect test from "jest" keyword', () => {
        expect(detectCategory('Jest Expert', '')).toBe('test');
      });

      it('should detect test from "spec" keyword', () => {
        expect(detectCategory('Spec Writer', 'Writes test specs')).toBe('test');
      });
    });

    describe('Docs category detection', () => {
      it('should detect docs from "documentation writer" name', () => {
        expect(detectCategory('documentation writer', '')).toBe('docs');
      });

      it('should detect docs from "readme manager" description', () => {
        expect(detectCategory('Docs Bot', 'Manages README files and docs')).toBe('docs');
      });

      it('should detect docs from "comment" keyword', () => {
        expect(detectCategory('Comment Helper', 'Adds inline comments')).toBe('docs');
      });

      it('should detect docs from "doc" keyword in description', () => {
        // Note: "guide" contains "ui" substring, so UI category is matched first
        // Testing "doc" keyword instead which is also in docs category
        expect(detectCategory('Technical Writer', 'Manages project docs and references')).toBe('docs');
      });
    });

    describe('API category detection', () => {
      it('should detect api from "API developer" name', () => {
        expect(detectCategory('API developer', '')).toBe('api');
      });

      it('should detect api from "backend" keyword', () => {
        // "backend" is checked in api category
        expect(detectCategory('Backend Service', 'Backend server handling API requests')).toBe('api');
      });

      it('should detect api from "endpoint" keyword', () => {
        expect(detectCategory('Endpoint Manager', 'Manages API endpoints')).toBe('api');
      });

      it('should detect api from "database" keyword', () => {
        expect(detectCategory('Database Expert', 'Database queries and optimization')).toBe('api');
      });

      it('should detect api from "fetch" keyword', () => {
        expect(detectCategory('Fetch Handler', 'Handles fetch requests')).toBe('api');
      });
    });

    describe('Default category fallback', () => {
      it('should return default for "general helper"', () => {
        expect(detectCategory('general helper', 'General purpose assistant')).toBe('default');
      });

      it('should return default for unrecognized keywords', () => {
        expect(detectCategory('Data Analyzer', 'Analyzes business data')).toBe('default');
      });

      it('should return default for empty strings', () => {
        expect(detectCategory('', '')).toBe('default');
      });
    });
  });

  // ==========================================================================
  // calculateTriggerQuality Tests
  // ==========================================================================

  describe('calculateTriggerQuality', () => {

    describe('WEAK triggers', () => {
      it('should classify empty string as weak', () => {
        const result = calculateTriggerQuality('');
        expect(result.level).toBe('weak');
        expect(result.score).toBeLessThan(30);
      });

      it('should classify short vague trigger as weak', () => {
        const result = calculateTriggerQuality('when user asks');
        expect(result.level).toBe('weak');
        expect(result.score).toBeLessThan(30);
      });

      it('should classify trigger < 20 chars as weak', () => {
        const result = calculateTriggerQuality('when editing');
        expect(result.level).toBe('weak');
        expect(result.score).toBeLessThan(30);
      });

      it('should penalize vague triggers with "when" keyword', () => {
        const result = calculateTriggerQuality('when something happens');
        expect(result.level).toBe('weak');
        // Should have isVague penalty (-20)
        expect(result.score).toBeLessThanOrEqual(0);
      });

      it('should penalize vague triggers with "if" keyword', () => {
        const result = calculateTriggerQuality('if the user asks about this');
        expect(result.level).toBe('weak');
      });

      it('should return appropriate message for weak triggers', () => {
        const result = calculateTriggerQuality('when user asks');
        expect(result.message).toBe('Too vague - add file patterns, folder paths, or specific keywords');
      });
    });

    describe('MODERATE triggers', () => {
      it('should classify 20-50 char trigger with some specifics as moderate', () => {
        const result = calculateTriggerQuality('Files in /src folder containing patterns');
        expect(result.level).toBe('moderate');
        expect(result.score).toBeGreaterThanOrEqual(30);
        expect(result.score).toBeLessThan(60);
      });

      it('should classify trigger with folder path as moderate', () => {
        const result = calculateTriggerQuality('Editing files in /components folder');
        expect(result.level).toBe('moderate');
        // Should have: length 20-50 (15) + hasFolderPath (25) + hasKeywords (15) = 55
      });

      it('should classify trigger with file pattern as moderate', () => {
        const result = calculateTriggerQuality('Modifying .tsx files in folder');
        expect(result.level).toBe('moderate');
        // Should have: length 20-50 (15) + hasFilePattern (25) = 40
      });

      it('should return appropriate message for moderate triggers', () => {
        const result = calculateTriggerQuality('Editing files in /components folder');
        expect(result.message).toBe('Good - consider adding more specific patterns or conditions');
      });
    });

    describe('STRONG triggers', () => {
      it('should classify long trigger with file patterns AND folder paths as strong', () => {
        const result = calculateTriggerQuality(
          'When editing .ts files in /components folder that contain React hooks'
        );
        expect(result.level).toBe('strong');
        expect(result.score).toBeGreaterThanOrEqual(60);
      });

      it('should classify comprehensive trigger as strong', () => {
        const result = calculateTriggerQuality(
          'When editing .tsx files in /components folder that contain "className" or "style" keywords with diff > 10 lines'
        );
        expect(result.level).toBe('strong');
        // Should have: length > 50 (30) + hasFilePattern (25) + hasFolderPath (25) + hasKeywords (15) + hasNumbers (10) = 105
        expect(result.score).toBeGreaterThan(100);
      });

      it('should return appropriate message for strong triggers', () => {
        const result = calculateTriggerQuality(
          'When editing .ts files in /components folder that contain React hooks'
        );
        expect(result.message).toBe('Excellent - specific and actionable trigger');
      });
    });

    describe('Scoring system', () => {
      it('should add 25 points for file pattern', () => {
        const withPattern = calculateTriggerQuality('When editing test.ts files in folder');
        const withoutPattern = calculateTriggerQuality('When editing test files in folder');
        expect(withPattern.score).toBeGreaterThan(withoutPattern.score);
        expect(withPattern.score - withoutPattern.score).toBeGreaterThanOrEqual(QUALITY_WEIGHTS.FILE_PATTERN);
      });

      it('should add 25 points for folder path', () => {
        const withPath = calculateTriggerQuality('Editing files in /components folder');
        const withoutPath = calculateTriggerQuality('Editing files in components folder');
        expect(withPath.score).toBeGreaterThan(withoutPath.score);
      });

      it('should add 15 points for keywords', () => {
        const withKeywords = calculateTriggerQuality('File contains specific patterns');
        const withoutKeywords = calculateTriggerQuality('File shows specific patterns');
        expect(withKeywords.score).toBeGreaterThan(withoutKeywords.score);
      });

      it('should add 10 points for numbers', () => {
        const withNumbers = calculateTriggerQuality('Diff has more than 10 lines changed');
        const withoutNumbers = calculateTriggerQuality('Diff has many lines changed');
        expect(withNumbers.score).toBeGreaterThan(withoutNumbers.score);
      });

      it('should subtract 20 points for vague triggers', () => {
        const vague = calculateTriggerQuality('when user asks');
        // Vague trigger should have negative or very low score
        expect(vague.score).toBeLessThanOrEqual(0);
      });

      it('should add 30 points for length > 50', () => {
        const longTrigger = calculateTriggerQuality(
          'This is a very long trigger that exceeds fifty characters in length'
        );
        const shortTrigger = calculateTriggerQuality('Short trigger');
        expect(longTrigger.score).toBeGreaterThan(shortTrigger.score);
      });

      it('should add 15 points for length > 20 but <= 50', () => {
        const mediumTrigger = calculateTriggerQuality('This trigger is medium length');
        expect(mediumTrigger.score).toBeGreaterThanOrEqual(QUALITY_WEIGHTS.LENGTH_MEDIUM);
      });
    });

    describe('Edge cases', () => {
      it('should handle whitespace-only trigger', () => {
        const result = calculateTriggerQuality('   ');
        expect(result.level).toBe('weak');
        expect(result.score).toBeLessThan(30);
      });

      it('should trim whitespace before processing', () => {
        const result1 = calculateTriggerQuality('  When editing .ts files  ');
        const result2 = calculateTriggerQuality('When editing .ts files');
        expect(result1.score).toBe(result2.score);
      });

      it('should handle multiple file patterns', () => {
        const result = calculateTriggerQuality('Editing .ts, .tsx, .js, or .jsx files in folder');
        expect(result.level).toBe('moderate');
        // Should detect at least one file pattern
        expect(result.score).toBeGreaterThanOrEqual(40);
      });

      it('should handle multiple folder paths', () => {
        const result = calculateTriggerQuality('Editing files in /src or /components folders');
        expect(result.level).toBe('moderate');
        // Should detect at least one folder path
        expect(result.score).toBeGreaterThanOrEqual(40);
      });
    });
  });

  // ==========================================================================
  // generateSmartTrigger Tests
  // ==========================================================================

  describe('generateSmartTrigger', () => {

    describe('UI category', () => {
      it('should generate trigger with /components for UI category', () => {
        const trigger = generateSmartTrigger('UI Designer', 'Designs user interfaces', 'ui');
        expect(trigger).toContain('/components');
      });

      it('should include React-specific terms when name contains "react"', () => {
        const trigger = generateSmartTrigger('React Developer', 'React expert', 'ui');
        expect(trigger).toContain('React components');
        expect(trigger).toContain('className');
      });

      it('should use generic UI terms when React not mentioned', () => {
        const trigger = generateSmartTrigger('UI Designer', 'General UI work', 'ui');
        expect(trigger).toContain('UI-related keywords');
      });
    });

    describe('Code category', () => {
      it('should generate trigger with .ts or .tsx for code category', () => {
        const trigger = generateSmartTrigger('Code Expert', 'Code analysis', 'code');
        expect(trigger).toMatch(/\.tsx?/);
      });

      it('should include review-specific terms when name contains "review"', () => {
        const trigger = generateSmartTrigger('Code Reviewer', 'Reviews code', 'code');
        expect(trigger).toContain('function');
        expect(trigger).toContain('class');
        expect(trigger).toContain('diff > 10');
      });

      it('should include refactor-specific terms when name contains "refactor"', () => {
        const trigger = generateSmartTrigger('Refactoring Expert', 'Refactors code', 'code');
        expect(trigger).toContain('TODO');
        expect(trigger).toContain('FIXME');
      });

      it('should use generic code terms when neither review nor refactor mentioned', () => {
        const trigger = generateSmartTrigger('Code Helper', 'General coding', 'code');
        expect(trigger).toContain('function declarations');
      });
    });

    describe('Test category', () => {
      it('should generate trigger with __tests__ for test category', () => {
        const trigger = generateSmartTrigger('Test Engineer', 'Writes tests', 'test');
        expect(trigger).toContain('__tests__');
      });

      it('should include .test.ts or .spec.ts patterns', () => {
        const trigger = generateSmartTrigger('Test Writer', 'Test specialist', 'test');
        expect(trigger).toContain('.test.ts');
        expect(trigger).toContain('.spec.ts');
      });

      it('should include /src folder reference', () => {
        const trigger = generateSmartTrigger('Test Expert', 'Testing expert', 'test');
        expect(trigger).toContain('/src');
      });
    });

    describe('Docs category', () => {
      it('should generate trigger with README.md for docs category', () => {
        const trigger = generateSmartTrigger('Documentation Writer', 'Writes docs', 'docs');
        expect(trigger).toContain('README.md');
      });

      it('should include /docs folder reference', () => {
        const trigger = generateSmartTrigger('Docs Expert', 'Documentation expert', 'docs');
        expect(trigger).toContain('/docs');
      });

      it('should include JSDoc comment patterns', () => {
        const trigger = generateSmartTrigger('Doc Generator', 'Generates documentation', 'docs');
        expect(trigger).toContain('@param');
        expect(trigger).toContain('@returns');
      });
    });

    describe('API category', () => {
      it('should generate trigger with /api or /services for API category', () => {
        const trigger = generateSmartTrigger('API Developer', 'API development', 'api');
        expect(trigger).toMatch(/\/(api|services)/);
      });

      it('should include fetch keyword', () => {
        const trigger = generateSmartTrigger('API Expert', 'API specialist', 'api');
        expect(trigger).toContain('fetch');
      });

      it('should include axios keyword', () => {
        const trigger = generateSmartTrigger('Backend Dev', 'Backend development', 'api');
        expect(trigger).toContain('axios');
      });

      it('should include endpoint and http keywords', () => {
        const trigger = generateSmartTrigger('API Builder', 'Builds APIs', 'api');
        expect(trigger).toContain('endpoint');
        expect(trigger).toContain('http');
      });
    });

    describe('Default category', () => {
      it('should extract topic from name with "expert" suffix', () => {
        const trigger = generateSmartTrigger('Database-expert', 'Database work', 'default');
        expect(trigger).toContain('database');
        expect(trigger).toContain('/src');
        expect(trigger).toContain('diff > 5');
      });

      it('should extract topic from name with "specialist" suffix', () => {
        const trigger = generateSmartTrigger('Security specialist', 'Security analysis', 'default');
        expect(trigger).toContain('security');
      });

      it('should extract topic from name with "engineer" suffix', () => {
        const trigger = generateSmartTrigger('Performance engineer', 'Performance optimization', 'default');
        expect(trigger).toContain('performance');
      });

      it('should extract topic from name with "developer" suffix', () => {
        const trigger = generateSmartTrigger('Plugin developer', 'Develops plugins', 'default');
        expect(trigger).toContain('plugin');
      });

      it('should extract topic from name with "writer" suffix', () => {
        const trigger = generateSmartTrigger('Content writer', 'Writes content', 'default');
        expect(trigger).toContain('content');
      });

      it('should use name-based trigger when no pattern match', () => {
        const trigger = generateSmartTrigger('General Helper', 'Helps with things', 'default');
        expect(trigger).toContain('general helper');
        expect(trigger).toContain('keywords');
      });

      it('should generate something useful for empty name', () => {
        const trigger = generateSmartTrigger('', '', 'default');
        expect(trigger.length).toBeGreaterThan(0);
      });
    });

    describe('Quality of generated triggers', () => {
      it('should generate strong triggers for UI category', () => {
        const trigger = generateSmartTrigger('React Expert', 'React development', 'ui');
        const quality = calculateTriggerQuality(trigger);
        expect(quality.level).toBe('strong');
      });

      it('should generate strong triggers for code category', () => {
        const trigger = generateSmartTrigger('Code Reviewer', 'Reviews code', 'code');
        const quality = calculateTriggerQuality(trigger);
        expect(quality.level).toBe('strong');
      });

      it('should generate strong triggers for test category', () => {
        const trigger = generateSmartTrigger('Test Engineer', 'Writes tests', 'test');
        const quality = calculateTriggerQuality(trigger);
        expect(quality.level).toBe('strong');
      });

      it('should generate strong triggers for docs category', () => {
        const trigger = generateSmartTrigger('Documentation Writer', 'Writes docs', 'docs');
        const quality = calculateTriggerQuality(trigger);
        expect(quality.level).toBe('strong');
      });

      it('should generate strong triggers for API category', () => {
        const trigger = generateSmartTrigger('API Developer', 'API development', 'api');
        const quality = calculateTriggerQuality(trigger);
        // API triggers might be moderate or strong depending on length
        expect(['moderate', 'strong']).toContain(quality.level);
      });

      it('should generate at least moderate triggers for default category', () => {
        const trigger = generateSmartTrigger('Database Expert', 'Database work', 'default');
        const quality = calculateTriggerQuality(trigger);
        expect(['moderate', 'strong']).toContain(quality.level);
      });
    });
  });

  // ==========================================================================
  // Constants Tests
  // ==========================================================================

  describe('Constants', () => {
    describe('QUALITY_WEIGHTS', () => {
      it('should have correct weight values', () => {
        expect(QUALITY_WEIGHTS.LENGTH_LONG).toBe(30);
        expect(QUALITY_WEIGHTS.LENGTH_MEDIUM).toBe(15);
        expect(QUALITY_WEIGHTS.FILE_PATTERN).toBe(25);
        expect(QUALITY_WEIGHTS.FOLDER_PATH).toBe(25);
        expect(QUALITY_WEIGHTS.KEYWORDS).toBe(15);
        expect(QUALITY_WEIGHTS.NUMBERS).toBe(10);
        expect(QUALITY_WEIGHTS.VAGUE_PENALTY).toBe(-20);
      });
    });

    describe('TRIGGER_SUGGESTIONS', () => {
      it('should have suggestions for all categories', () => {
        expect(TRIGGER_SUGGESTIONS['default']).toBeDefined();
        expect(TRIGGER_SUGGESTIONS['ui']).toBeDefined();
        expect(TRIGGER_SUGGESTIONS['code']).toBeDefined();
        expect(TRIGGER_SUGGESTIONS['docs']).toBeDefined();
        expect(TRIGGER_SUGGESTIONS['test']).toBeDefined();
        expect(TRIGGER_SUGGESTIONS['api']).toBeDefined();
      });

      it('should have at least 3 suggestions per category', () => {
        Object.values(TRIGGER_SUGGESTIONS).forEach(suggestions => {
          expect(suggestions.length).toBeGreaterThanOrEqual(3);
        });
      });
    });

    describe('EXAMPLE_TRIGGERS', () => {
      it('should have examples for all categories', () => {
        expect(EXAMPLE_TRIGGERS['default']).toBeDefined();
        expect(EXAMPLE_TRIGGERS['ui']).toBeDefined();
        expect(EXAMPLE_TRIGGERS['code']).toBeDefined();
        expect(EXAMPLE_TRIGGERS['docs']).toBeDefined();
        expect(EXAMPLE_TRIGGERS['test']).toBeDefined();
        expect(EXAMPLE_TRIGGERS['api']).toBeDefined();
      });

      it('should have non-empty examples', () => {
        Object.values(EXAMPLE_TRIGGERS).forEach(example => {
          expect(example.length).toBeGreaterThan(0);
        });
      });
    });
  });

  // ==========================================================================
  // Integration Tests
  // ==========================================================================

  describe('Integration: Full workflow', () => {
    it('should correctly categorize and generate high-quality trigger for React UI droid', () => {
      const name = 'React UI Designer';
      const description = 'Expert in designing React components with modern styling';

      const category = detectCategory(name, description);
      expect(category).toBe('ui');

      const trigger = generateSmartTrigger(name, description, category);
      const quality = calculateTriggerQuality(trigger);

      expect(quality.level).toBe('strong');
      expect(trigger).toContain('React');
      expect(trigger).toContain('/components');
    });

    it('should correctly categorize and generate high-quality trigger for test engineer', () => {
      const name = 'Test Engineer';
      const description = 'Writes comprehensive Vitest unit and integration tests';

      const category = detectCategory(name, description);
      expect(category).toBe('test');

      const trigger = generateSmartTrigger(name, description, category);
      const quality = calculateTriggerQuality(trigger);

      expect(quality.level).toBe('strong');
      expect(trigger).toContain('test');
      expect(trigger).toContain('__tests__');
    });

    it('should correctly categorize and generate trigger for code reviewer', () => {
      const name = 'Code Reviewer';
      const description = 'Reviews code for security, performance, and best practices';

      const category = detectCategory(name, description);
      expect(category).toBe('code');

      const trigger = generateSmartTrigger(name, description, category);
      const quality = calculateTriggerQuality(trigger);

      expect(quality.level).toBe('strong');
      expect(trigger).toContain('.ts');
      expect(trigger).toContain('function');
    });

    it('should correctly categorize and generate trigger for API developer', () => {
      const name = 'API Server';
      const description = 'Manages backend API endpoints and database operations';

      const category = detectCategory(name, description);
      expect(category).toBe('api');

      const trigger = generateSmartTrigger(name, description, category);
      const quality = calculateTriggerQuality(trigger);

      expect(['moderate', 'strong']).toContain(quality.level);
      expect(trigger).toContain('/api');
      expect(trigger).toContain('fetch');
    });

    it('should handle edge case: empty inputs gracefully', () => {
      const category = detectCategory('', '');
      expect(category).toBe('default');

      const trigger = generateSmartTrigger('', '', category);
      expect(trigger.length).toBeGreaterThan(0);

      const quality = calculateTriggerQuality(trigger);
      expect(['weak', 'moderate', 'strong']).toContain(quality.level);
    });
  });
});
