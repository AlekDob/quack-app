/**
 * Tests for document path extraction from MCP Memory observations
 *
 * Document entities store:
 * - First observation: description (e.g., "[2025-12-18] Documentation for...")
 * - Other observations: may include file path (e.g., "/Users/.../docs/file.md")
 *
 * The extractDocumentFilePath function needs to find the actual file path.
 */

import { describe, it, expect } from 'vitest';

/**
 * Extract file path from document entity observations
 * This mirrors the logic in InlineOutliner.tsx
 */
function extractDocumentFilePath(observations: string[]): string | null {
  for (const obs of observations) {
    const trimmed = obs.trim();
    // Check for absolute paths or relative paths with file extensions
    if (trimmed.startsWith('/') || trimmed.match(/^[.~]?[\w/-]+\.\w+$/)) {
      return trimmed;
    }
  }
  return null;
}

describe('Document Path Extraction', () => {
  describe('extractDocumentFilePath', () => {
    it('should extract absolute path from observations', () => {
      const observations = [
        '[2025-12-18] Documentation for the rule path normalization feature - explains portable path format for agent rules',
        '/Users/alekdob/Desktop/Dev/Personal/quack-app/docs/rule-path-normalization.md',
      ];

      const result = extractDocumentFilePath(observations);
      expect(result).toBe('/Users/alekdob/Desktop/Dev/Personal/quack-app/docs/rule-path-normalization.md');
    });

    it('should extract path even when it is the first observation', () => {
      const observations = [
        '/Users/alekdob/docs/notes.md',
        'Some description here',
      ];

      const result = extractDocumentFilePath(observations);
      expect(result).toBe('/Users/alekdob/docs/notes.md');
    });

    it('should extract relative path with extension', () => {
      const observations = [
        '[2025-12-18] A guide document',
        'docs/guide/README.md',
      ];

      const result = extractDocumentFilePath(observations);
      expect(result).toBe('docs/guide/README.md');
    });

    it('should extract tilde-prefixed path', () => {
      const observations = [
        'My personal notes',
        '~/Documents/notes.md',
      ];

      const result = extractDocumentFilePath(observations);
      expect(result).toBe('~/Documents/notes.md');
    });

    it('should extract dot-prefixed relative path', () => {
      const observations = [
        'Local config file',
        './config/settings.json',
      ];

      const result = extractDocumentFilePath(observations);
      expect(result).toBe('./config/settings.json');
    });

    it('should NOT match date-prefixed descriptions', () => {
      const observations = [
        '[2025-12-18] This is just a description, not a path',
      ];

      const result = extractDocumentFilePath(observations);
      expect(result).toBeNull();
    });

    it('should NOT match plain text observations', () => {
      const observations = [
        'Some random observation text',
        'Another observation without any path',
      ];

      const result = extractDocumentFilePath(observations);
      expect(result).toBeNull();
    });

    it('should return null for empty observations', () => {
      const observations: string[] = [];
      const result = extractDocumentFilePath(observations);
      expect(result).toBeNull();
    });

    it('should prefer first matching path in observations', () => {
      const observations = [
        '/first/path/file.md',
        '/second/path/other.md',
      ];

      const result = extractDocumentFilePath(observations);
      expect(result).toBe('/first/path/file.md');
    });

    it('should handle paths with special characters', () => {
      const observations = [
        'Project docs',
        '/Users/user/My-Project_v2/docs/README.md',
      ];

      const result = extractDocumentFilePath(observations);
      expect(result).toBe('/Users/user/My-Project_v2/docs/README.md');
    });

    it('should handle various file extensions', () => {
      const testCases = [
        { obs: ['docs/file.ts'], expected: 'docs/file.ts' },
        { obs: ['docs/file.tsx'], expected: 'docs/file.tsx' },
        { obs: ['docs/file.json'], expected: 'docs/file.json' },
        { obs: ['docs/file.yaml'], expected: 'docs/file.yaml' },
        { obs: ['docs/file.css'], expected: 'docs/file.css' },
      ];

      for (const { obs, expected } of testCases) {
        expect(extractDocumentFilePath(obs)).toBe(expected);
      }
    });
  });
});
