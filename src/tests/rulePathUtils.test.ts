/**
 * Tests for rulePathUtils
 *
 * Tests the normalization and resolution of rule paths for portable agent sharing.
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeRulePath,
  normalizeRulePaths,
  resolveRulePath,
  resolveRulePaths,
  migrateRulePaths,
  getDisplayPath,
  isGlobalRulePath,
  isProjectRulePath,
  areRulePathsEqual,
  findRuleByPath,
} from '../utils/rulePathUtils';

describe('rulePathUtils', () => {
  describe('normalizeRulePath', () => {
    it('should normalize project rules to relative paths', () => {
      const absolutePath = '/Users/alekdob/Desktop/Dev/flow-bi/.claude/rules/translate-3-languages.md';
      const result = normalizeRulePath(absolutePath);
      expect(result).toBe('.claude/rules/translate-3-languages.md');
    });

    it('should normalize global rules to tilde notation', () => {
      const absolutePath = '/Users/alekdob/.claude/rules/global-rule.md';
      const result = normalizeRulePath(absolutePath);
      expect(result).toBe('~/.claude/rules/global-rule.md');
    });

    it('should handle Linux home directory paths', () => {
      const absolutePath = '/home/user/.claude/rules/global-rule.md';
      const result = normalizeRulePath(absolutePath);
      expect(result).toBe('~/.claude/rules/global-rule.md');
    });

    it('should keep already normalized paths unchanged', () => {
      expect(normalizeRulePath('.claude/rules/test.md')).toBe('.claude/rules/test.md');
      expect(normalizeRulePath('~/.claude/rules/test.md')).toBe('~/.claude/rules/test.md');
    });

    it('should handle nested project paths', () => {
      const absolutePath = '/Users/alekdob/Desktop/Dev/Personal/quack-app/.claude/rules/my-rule.md';
      const result = normalizeRulePath(absolutePath);
      expect(result).toBe('.claude/rules/my-rule.md');
    });

    it('should handle rule names with special characters', () => {
      const absolutePath = '/Users/alekdob/project/.claude/rules/Analyze-Plan-act-test-review-document.md';
      const result = normalizeRulePath(absolutePath);
      expect(result).toBe('.claude/rules/Analyze-Plan-act-test-review-document.md');
    });
  });

  describe('normalizeRulePaths', () => {
    it('should normalize an array of paths', () => {
      const paths = [
        '/Users/alekdob/project/.claude/rules/rule1.md',
        '/Users/alekdob/.claude/rules/global.md',
        '.claude/rules/already-normalized.md',
      ];
      const result = normalizeRulePaths(paths);
      expect(result).toEqual([
        '.claude/rules/rule1.md',
        '~/.claude/rules/global.md',
        '.claude/rules/already-normalized.md',
      ]);
    });

    it('should return empty array for empty input', () => {
      expect(normalizeRulePaths([])).toEqual([]);
    });
  });

  describe('resolveRulePath', () => {
    const projectPath = '/Users/alekdob/Desktop/Dev/my-project';
    const homeDir = '/Users/alekdob';

    it('should resolve project rules to absolute paths', () => {
      const normalized = '.claude/rules/my-rule.md';
      const result = resolveRulePath(normalized, projectPath, homeDir);
      expect(result).toBe('/Users/alekdob/Desktop/Dev/my-project/.claude/rules/my-rule.md');
    });

    it('should resolve global rules (tilde) to absolute paths', () => {
      const normalized = '~/.claude/rules/global-rule.md';
      const result = resolveRulePath(normalized, projectPath, homeDir);
      expect(result).toBe('/Users/alekdob/.claude/rules/global-rule.md');
    });

    it('should return absolute paths unchanged', () => {
      const absolutePath = '/some/other/path/rule.md';
      const result = resolveRulePath(absolutePath, projectPath, homeDir);
      expect(result).toBe(absolutePath);
    });
  });

  describe('resolveRulePaths', () => {
    it('should resolve an array of normalized paths', () => {
      const projectPath = '/Users/alekdob/project';
      const homeDir = '/Users/alekdob';
      const paths = [
        '.claude/rules/project-rule.md',
        '~/.claude/rules/global-rule.md',
      ];
      const result = resolveRulePaths(paths, projectPath, homeDir);
      expect(result).toEqual([
        '/Users/alekdob/project/.claude/rules/project-rule.md',
        '/Users/alekdob/.claude/rules/global-rule.md',
      ]);
    });
  });

  describe('migrateRulePaths', () => {
    it('should migrate legacy absolute paths to normalized format', () => {
      const legacyPaths = [
        '/Users/alekdob/Desktop/Dev/flow-bi/.claude/rules/translate-3-languages.md',
        '/Users/alekdob/.claude/rules/global-rule.md',
      ];
      const result = migrateRulePaths(legacyPaths);
      expect(result).toEqual([
        '.claude/rules/translate-3-languages.md',
        '~/.claude/rules/global-rule.md',
      ]);
    });

    it('should keep already normalized paths unchanged', () => {
      const normalizedPaths = [
        '.claude/rules/project-rule.md',
        '~/.claude/rules/global-rule.md',
      ];
      const result = migrateRulePaths(normalizedPaths);
      expect(result).toEqual(normalizedPaths);
    });

    it('should handle mixed legacy and normalized paths', () => {
      const mixedPaths = [
        '/Users/alekdob/project/.claude/rules/legacy.md',
        '.claude/rules/already-normalized.md',
      ];
      const result = migrateRulePaths(mixedPaths);
      expect(result).toEqual([
        '.claude/rules/legacy.md',
        '.claude/rules/already-normalized.md',
      ]);
    });
  });

  describe('getDisplayPath', () => {
    it('should return normalized format for absolute paths', () => {
      const absolutePath = '/Users/alekdob/project/.claude/rules/my-rule.md';
      const result = getDisplayPath(absolutePath);
      expect(result).toBe('.claude/rules/my-rule.md');
    });

    it('should return tilde notation for global paths', () => {
      const absolutePath = '/Users/alekdob/.claude/rules/global.md';
      const result = getDisplayPath(absolutePath);
      expect(result).toBe('~/.claude/rules/global.md');
    });

    it('should return already normalized paths as-is', () => {
      expect(getDisplayPath('.claude/rules/test.md')).toBe('.claude/rules/test.md');
      expect(getDisplayPath('~/.claude/rules/test.md')).toBe('~/.claude/rules/test.md');
    });
  });

  describe('isGlobalRulePath', () => {
    it('should return true for global paths with tilde', () => {
      expect(isGlobalRulePath('~/.claude/rules/rule.md')).toBe(true);
    });

    it('should return true for absolute global paths (macOS)', () => {
      expect(isGlobalRulePath('/Users/alekdob/.claude/rules/rule.md')).toBe(true);
    });

    it('should return true for absolute global paths (Linux)', () => {
      expect(isGlobalRulePath('/home/user/.claude/rules/rule.md')).toBe(true);
    });

    it('should return false for project paths', () => {
      expect(isGlobalRulePath('.claude/rules/rule.md')).toBe(false);
      expect(isGlobalRulePath('/Users/alekdob/project/.claude/rules/rule.md')).toBe(false);
    });
  });

  describe('isProjectRulePath', () => {
    it('should return true for relative project paths', () => {
      expect(isProjectRulePath('.claude/rules/rule.md')).toBe(true);
    });

    it('should return true for absolute project paths', () => {
      expect(isProjectRulePath('/Users/alekdob/project/.claude/rules/rule.md')).toBe(true);
    });

    it('should return false for global paths', () => {
      expect(isProjectRulePath('~/.claude/rules/rule.md')).toBe(false);
      expect(isProjectRulePath('/Users/alekdob/.claude/rules/rule.md')).toBe(false);
    });
  });

  describe('areRulePathsEqual', () => {
    it('should return true for same normalized paths', () => {
      expect(areRulePathsEqual(
        '/Users/alekdob/project/.claude/rules/rule.md',
        '.claude/rules/rule.md'
      )).toBe(true);
    });

    it('should return true for same global paths', () => {
      expect(areRulePathsEqual(
        '/Users/alekdob/.claude/rules/global.md',
        '~/.claude/rules/global.md'
      )).toBe(true);
    });

    it('should return false for different rules', () => {
      expect(areRulePathsEqual(
        '.claude/rules/rule1.md',
        '.claude/rules/rule2.md'
      )).toBe(false);
    });
  });

  describe('findRuleByPath', () => {
    it('should find rule by normalized path', () => {
      const paths = [
        '.claude/rules/rule1.md',
        '.claude/rules/rule2.md',
        '~/.claude/rules/global.md',
      ];
      const result = findRuleByPath(paths, '/Users/alekdob/project/.claude/rules/rule2.md');
      expect(result).toBe('.claude/rules/rule2.md');
    });

    it('should find global rule', () => {
      const paths = [
        '.claude/rules/project.md',
        '~/.claude/rules/global.md',
      ];
      const result = findRuleByPath(paths, '/Users/alekdob/.claude/rules/global.md');
      expect(result).toBe('~/.claude/rules/global.md');
    });

    it('should return undefined for non-existent rule', () => {
      const paths = ['.claude/rules/rule1.md'];
      const result = findRuleByPath(paths, '.claude/rules/non-existent.md');
      expect(result).toBeUndefined();
    });
  });
});
