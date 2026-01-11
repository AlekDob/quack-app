/**
 * Tests for Giphy Service
 *
 * Tests the GIF fetching service for tool reactions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getKeywordsForTool,
  TOOL_GIF_KEYWORDS,
  clearGifCache,
  getGifCacheSize,
} from '../services/giphyService';

describe('giphyService', () => {
  beforeEach(() => {
    // Clear cache before each test
    clearGifCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getKeywordsForTool', () => {
    it('should return keywords for known tools', () => {
      const keywords = getKeywordsForTool('read');
      expect(keywords).toEqual(['reading book', 'studying', 'examining']);
    });

    it('should return keywords for MCP brain tools', () => {
      const keywords = getKeywordsForTool('mcp__brain__brain_search');
      expect(keywords).toEqual(['brain thinking', 'searching database', 'detective']);
    });

    it('should return default keywords for unknown tools', () => {
      const keywords = getKeywordsForTool('some_unknown_tool_xyz');
      expect(keywords).toEqual(TOOL_GIF_KEYWORDS.default);
    });

    it('should be case-insensitive', () => {
      const keywordsLower = getKeywordsForTool('read');
      const keywordsUpper = getKeywordsForTool('READ');
      expect(keywordsLower).toEqual(keywordsUpper);
    });

    it('should return keywords for bash tool', () => {
      const keywords = getKeywordsForTool('bash');
      expect(keywords).toContain('terminal hacking');
      expect(keywords).toContain('command line');
    });

    it('should return keywords for edit tool', () => {
      const keywords = getKeywordsForTool('edit');
      expect(keywords).toContain('editing document');
    });

    it('should return keywords for write tool', () => {
      const keywords = getKeywordsForTool('write');
      expect(keywords).toContain('typing fast');
      expect(keywords).toContain('coding');
    });

    it('should return keywords for grep tool', () => {
      const keywords = getKeywordsForTool('grep');
      expect(keywords).toContain('searching text');
    });

    it('should return keywords for websearch tool', () => {
      const keywords = getKeywordsForTool('websearch');
      expect(keywords).toContain('googling');
    });

    it('should return keywords for kanban tools', () => {
      const keywords = getKeywordsForTool('mcp__kanban-tools__kanban_create_task');
      expect(keywords).toContain('creating task');
    });

  });

  describe('TOOL_GIF_KEYWORDS mapping', () => {
    it('should have default keywords', () => {
      expect(TOOL_GIF_KEYWORDS.default).toBeDefined();
      expect(TOOL_GIF_KEYWORDS.default.length).toBeGreaterThan(0);
    });

    it('should have at least one keyword for each tool', () => {
      for (const [tool, keywords] of Object.entries(TOOL_GIF_KEYWORDS)) {
        expect(keywords.length).toBeGreaterThan(0);
        expect(keywords.every((k) => typeof k === 'string')).toBe(true);
      }
    });

    it('should not have empty keywords', () => {
      for (const [tool, keywords] of Object.entries(TOOL_GIF_KEYWORDS)) {
        expect(keywords.every((k) => k.trim().length > 0)).toBe(true);
      }
    });

    it('should have keywords for common file operations', () => {
      expect(TOOL_GIF_KEYWORDS.read).toBeDefined();
      expect(TOOL_GIF_KEYWORDS.write).toBeDefined();
      expect(TOOL_GIF_KEYWORDS.edit).toBeDefined();
      expect(TOOL_GIF_KEYWORDS.glob).toBeDefined();
      expect(TOOL_GIF_KEYWORDS.grep).toBeDefined();
    });

    it('should have keywords for shell operations', () => {
      expect(TOOL_GIF_KEYWORDS.bash).toBeDefined();
      expect(TOOL_GIF_KEYWORDS.killshell).toBeDefined();
    });

    it('should have keywords for web operations', () => {
      expect(TOOL_GIF_KEYWORDS.webfetch).toBeDefined();
      expect(TOOL_GIF_KEYWORDS.websearch).toBeDefined();
    });

    it('should have keywords for brain/memory tools', () => {
      expect(TOOL_GIF_KEYWORDS['mcp__brain__brain_search']).toBeDefined();
      expect(TOOL_GIF_KEYWORDS['mcp__brain__brain_create_entity']).toBeDefined();
    });
  });

  describe('GIF cache', () => {
    it('should start with empty cache', () => {
      expect(getGifCacheSize()).toBe(0);
    });

    it('should clear cache correctly', () => {
      // Note: We can't easily populate the cache without making API calls
      // So we just verify the clear function doesn't throw
      expect(() => clearGifCache()).not.toThrow();
      expect(getGifCacheSize()).toBe(0);
    });
  });

  describe('Tool name variations', () => {
    it('should handle lowercase tool names', () => {
      const keywords = getKeywordsForTool('task');
      expect(keywords).toBeDefined();
      expect(keywords.length).toBeGreaterThan(0);
    });

    it('should handle mixed case tool names', () => {
      const keywordsLower = getKeywordsForTool('bash');
      const keywordsMixed = getKeywordsForTool('Bash');
      expect(keywordsLower).toEqual(keywordsMixed);
    });

    it('should handle MCP tool prefix variations', () => {
      // Full MCP tool name
      const fullName = getKeywordsForTool('mcp__brain__brain_search');
      expect(fullName).toBeDefined();
      expect(fullName.length).toBeGreaterThan(0);
    });
  });

  describe('Keyword variety', () => {
    it('should provide multiple keywords for variety', () => {
      // Most tools should have at least 2 keywords for variety
      const toolsWithMultipleKeywords = Object.entries(TOOL_GIF_KEYWORDS).filter(
        ([, keywords]) => keywords.length >= 2
      );

      // At least 80% of tools should have multiple keywords
      const totalTools = Object.keys(TOOL_GIF_KEYWORDS).length;
      expect(toolsWithMultipleKeywords.length / totalTools).toBeGreaterThanOrEqual(0.8);
    });

    it('should have distinct keywords per tool', () => {
      for (const [tool, keywords] of Object.entries(TOOL_GIF_KEYWORDS)) {
        const uniqueKeywords = new Set(keywords);
        expect(uniqueKeywords.size).toBe(keywords.length);
      }
    });
  });
});
