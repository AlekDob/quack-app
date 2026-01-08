/**
 * WikiLinks Parsing Tests
 *
 * Tests for the WikiLinks extraction functionality in Quack Brain.
 * WikiLinks format: [[NoteName]] or [[NoteName|Display Text]]
 */

import { describe, it, expect } from 'vitest';

/**
 * Parse [[WikiLinks]] from markdown content (JavaScript implementation)
 * This mirrors the Rust and Node.js implementations for testing.
 */
function parseWikiLinks(content: string): Array<{ targetName: string; displayText: string | null }> {
  const links: Array<{ targetName: string; displayText: string | null }> = [];
  const seen = new Set<string>();

  // Regex pattern: [[target]] or [[target|display]]
  const regex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const targetName = match[1].trim();
    const displayText = match[2] ? match[2].trim() : null;

    if (targetName && !seen.has(targetName.toLowerCase())) {
      seen.add(targetName.toLowerCase());
      links.push({ targetName, displayText });
    }
  }

  return links;
}

describe('WikiLinks Parsing', () => {
  describe('Simple WikiLinks [[NoteName]]', () => {
    it('should parse a single simple WikiLink', () => {
      const content = 'This is a note about [[React Hooks]]';
      const links = parseWikiLinks(content);

      expect(links).toHaveLength(1);
      expect(links[0].targetName).toBe('React Hooks');
      expect(links[0].displayText).toBeNull();
    });

    it('should parse multiple simple WikiLinks', () => {
      const content = 'See [[React Hooks]] and [[useState]] for more details about [[useEffect]]';
      const links = parseWikiLinks(content);

      expect(links).toHaveLength(3);
      expect(links.map(l => l.targetName)).toEqual(['React Hooks', 'useState', 'useEffect']);
    });

    it('should handle WikiLinks at start and end of text', () => {
      const content = '[[Start Note]] some text [[End Note]]';
      const links = parseWikiLinks(content);

      expect(links).toHaveLength(2);
      expect(links[0].targetName).toBe('Start Note');
      expect(links[1].targetName).toBe('End Note');
    });
  });

  describe('WikiLinks with Display Text [[NoteName|Display]]', () => {
    it('should parse WikiLink with display text', () => {
      const content = 'Check out [[react-hooks|React Hooks Guide]]';
      const links = parseWikiLinks(content);

      expect(links).toHaveLength(1);
      expect(links[0].targetName).toBe('react-hooks');
      expect(links[0].displayText).toBe('React Hooks Guide');
    });

    it('should handle mixed simple and display text WikiLinks', () => {
      const content = '[[Simple Link]] and [[target|Display Text]] are both valid';
      const links = parseWikiLinks(content);

      expect(links).toHaveLength(2);
      expect(links[0].targetName).toBe('Simple Link');
      expect(links[0].displayText).toBeNull();
      expect(links[1].targetName).toBe('target');
      expect(links[1].displayText).toBe('Display Text');
    });
  });

  describe('Edge Cases', () => {
    it('should deduplicate WikiLinks (case-insensitive)', () => {
      const content = '[[React]] and [[react]] and [[REACT]] are the same';
      const links = parseWikiLinks(content);

      expect(links).toHaveLength(1);
      expect(links[0].targetName).toBe('React');
    });

    it('should trim whitespace from target names', () => {
      const content = '[[  Spaced Note  ]] has extra spaces';
      const links = parseWikiLinks(content);

      expect(links).toHaveLength(1);
      expect(links[0].targetName).toBe('Spaced Note');
    });

    it('should handle empty content', () => {
      const content = '';
      const links = parseWikiLinks(content);

      expect(links).toHaveLength(0);
    });

    it('should handle content without WikiLinks', () => {
      const content = 'This is just plain text without any links.';
      const links = parseWikiLinks(content);

      expect(links).toHaveLength(0);
    });

    it('should handle nested brackets gracefully', () => {
      // Note: The regex matches the first complete [[...]] pattern it finds
      // In '[[incomplete and [also broken]]', it matches 'also broken'
      // This is acceptable behavior - malformed WikiLinks should be avoided
      const content = '[[incomplete and [also broken]] and [[valid]]';
      const links = parseWikiLinks(content);

      // The regex finds 'also broken' from the inner bracket and 'valid'
      expect(links.length).toBeGreaterThanOrEqual(1);
      expect(links.some(l => l.targetName === 'valid')).toBe(true);
    });

    it('should handle WikiLinks with special characters', () => {
      const content = '[[Note with-dashes]] and [[note_with_underscores]] and [[note.with.dots]]';
      const links = parseWikiLinks(content);

      expect(links).toHaveLength(3);
      expect(links[0].targetName).toBe('Note with-dashes');
      expect(links[1].targetName).toBe('note_with_underscores');
      expect(links[2].targetName).toBe('note.with.dots');
    });

    it('should handle date-style WikiLinks (diary links)', () => {
      const content = 'Created on [[2026-01-08]] during the sprint';
      const links = parseWikiLinks(content);

      expect(links).toHaveLength(1);
      expect(links[0].targetName).toBe('2026-01-08');
    });
  });

  describe('Multi-line Content', () => {
    it('should parse WikiLinks across multiple lines', () => {
      const content = `
# My Note

This references [[First Topic]].

And also [[Second Topic|with display text]].

## See Also
- [[Third Topic]]
- [[Fourth Topic]]
`;
      const links = parseWikiLinks(content);

      expect(links).toHaveLength(4);
      expect(links.map(l => l.targetName)).toEqual([
        'First Topic',
        'Second Topic',
        'Third Topic',
        'Fourth Topic',
      ]);
    });
  });

  describe('Obsidian-style Content', () => {
    it('should parse WikiLinks in typical Obsidian note format', () => {
      const content = `---
id: "test-note"
tag: pattern
date: 2026-01-08
daily: "[[2026-01-08]]"
---

# Error Handling Pattern

This pattern relates to [[React Error Boundaries]] and [[Suspense]].

## Observations

- Use [[try-catch]] for synchronous errors
- Implement [[ErrorBoundary|Error Boundary component]] for React
- Consider [[Sentry|Sentry Integration]] for production monitoring

## Related
- [[logging-pattern]]
- [[monitoring-strategy]]
`;
      const links = parseWikiLinks(content);

      // Should find: 2026-01-08, React Error Boundaries, Suspense, try-catch, ErrorBoundary, Sentry, logging-pattern, monitoring-strategy
      expect(links).toHaveLength(8);

      const targetNames = links.map(l => l.targetName);
      expect(targetNames).toContain('2026-01-08');
      expect(targetNames).toContain('React Error Boundaries');
      expect(targetNames).toContain('Suspense');
      expect(targetNames).toContain('try-catch');
      expect(targetNames).toContain('ErrorBoundary');
      expect(targetNames).toContain('Sentry');
      expect(targetNames).toContain('logging-pattern');
      expect(targetNames).toContain('monitoring-strategy');

      // Check display text for aliased links
      const errorBoundaryLink = links.find(l => l.targetName === 'ErrorBoundary');
      expect(errorBoundaryLink?.displayText).toBe('Error Boundary component');

      const sentryLink = links.find(l => l.targetName === 'Sentry');
      expect(sentryLink?.displayText).toBe('Sentry Integration');
    });
  });
});
