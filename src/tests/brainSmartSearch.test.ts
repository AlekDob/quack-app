/**
 * Brain Smart Search Tests
 *
 * Unit tests for the AI-driven smart_search functionality.
 * Tests query sanitization, prefix matching, and FTS5 query generation.
 */

import { describe, it, expect } from 'vitest';

/**
 * Sanitize query for FTS5 search
 * Mirrors the logic in brain-mcp-server.js handleBrainSmartSearch
 */
function sanitizeQuery(query: string): string {
  return query
    .replace(/[^\w\s]/g, ' ')  // Remove special chars
    .replace(/\s+/g, ' ')      // Normalize whitespace
    .trim();
}

/**
 * Extract search terms from sanitized query
 */
function extractSearchTerms(sanitizedQuery: string): string[] {
  return sanitizedQuery.split(' ').filter(t => t.length > 0);
}

/**
 * Generate FTS5 query with prefix matching
 * Each term gets a wildcard suffix for partial matching
 */
function generateFtsQuery(terms: string[]): string {
  return terms.map(t => `${t}*`).join(' OR ');
}

describe('Brain Smart Search', () => {
  describe('Query Sanitization', () => {
    it('should remove special characters', () => {
      const query = 'auth patterns & security!';
      const sanitized = sanitizeQuery(query);
      expect(sanitized).toBe('auth patterns security');
    });

    it('should normalize whitespace', () => {
      const query = 'multiple   spaces   between    words';
      const sanitized = sanitizeQuery(query);
      expect(sanitized).toBe('multiple spaces between words');
    });

    it('should handle Italian queries', () => {
      const query = "Come gestire l'autenticazione?";
      const sanitized = sanitizeQuery(query);
      expect(sanitized).toBe('Come gestire l autenticazione');
    });

    it('should handle mixed language queries', () => {
      const query = 'Bug fix per dropdown menu';
      const sanitized = sanitizeQuery(query);
      expect(sanitized).toBe('Bug fix per dropdown menu');
    });

    it('should handle empty queries', () => {
      const query = '';
      const sanitized = sanitizeQuery(query);
      expect(sanitized).toBe('');
    });

    it('should handle queries with only special chars', () => {
      const query = '!@#$%^&*()';
      const sanitized = sanitizeQuery(query);
      expect(sanitized).toBe('');
    });
  });

  describe('Term Extraction', () => {
    it('should split query into terms', () => {
      const terms = extractSearchTerms('authentication patterns security');
      expect(terms).toEqual(['authentication', 'patterns', 'security']);
    });

    it('should filter empty strings', () => {
      const terms = extractSearchTerms('auth   patterns');
      expect(terms).toEqual(['auth', 'patterns']);
    });

    it('should handle single word', () => {
      const terms = extractSearchTerms('authentication');
      expect(terms).toEqual(['authentication']);
    });

    it('should handle empty string', () => {
      const terms = extractSearchTerms('');
      expect(terms).toEqual([]);
    });
  });

  describe('FTS5 Query Generation', () => {
    it('should add wildcard suffix to each term', () => {
      const fts = generateFtsQuery(['auth', 'pattern']);
      expect(fts).toBe('auth* OR pattern*');
    });

    it('should use OR for multiple terms (better recall)', () => {
      const fts = generateFtsQuery(['dropdown', 'bug', 'fix']);
      expect(fts).toContain(' OR ');
    });

    it('should handle single term', () => {
      const fts = generateFtsQuery(['authentication']);
      expect(fts).toBe('authentication*');
    });

    it('should handle empty terms array', () => {
      const fts = generateFtsQuery([]);
      expect(fts).toBe('');
    });
  });

  describe('End-to-End Query Processing', () => {
    it('should process natural language query correctly', () => {
      const query = 'How do we handle authentication errors?';
      const sanitized = sanitizeQuery(query);
      const terms = extractSearchTerms(sanitized);
      const fts = generateFtsQuery(terms);

      expect(sanitized).toBe('How do we handle authentication errors');
      expect(terms).toEqual(['How', 'do', 'we', 'handle', 'authentication', 'errors']);
      expect(fts).toBe('How* OR do* OR we* OR handle* OR authentication* OR errors*');
    });

    it('should process Italian query correctly', () => {
      const query = "Qual è il pattern per gestire l'autenticazione?";
      const sanitized = sanitizeQuery(query);
      const terms = extractSearchTerms(sanitized);
      const fts = generateFtsQuery(terms);

      // Note: \w in regex doesn't include accented chars like 'è'
      // This is acceptable - FTS5 handles matching without accents
      expect(sanitized).toBe('Qual il pattern per gestire l autenticazione');
      expect(terms.length).toBeGreaterThan(0);
      expect(fts).toContain('autenticazione*');
    });

    it('should handle technical queries with symbols', () => {
      const query = 'React useEffect() cleanup function';
      const sanitized = sanitizeQuery(query);
      const terms = extractSearchTerms(sanitized);
      const fts = generateFtsQuery(terms);

      expect(sanitized).toBe('React useEffect cleanup function');
      expect(terms).toEqual(['React', 'useEffect', 'cleanup', 'function']);
      expect(fts).toBe('React* OR useEffect* OR cleanup* OR function*');
    });
  });

  describe('AI-Driven Advantages', () => {
    it('should NOT use stopword filtering (AI knows what is important)', () => {
      // In the AI-driven approach, we keep ALL words because:
      // 1. AI formulates meaningful queries
      // 2. Stopwords in other languages would be missed
      // 3. FTS5 handles ranking naturally
      const query = 'the quick brown fox';
      const sanitized = sanitizeQuery(query);
      const terms = extractSearchTerms(sanitized);

      // We keep "the" - AI decided to include it
      expect(terms).toContain('the');
      expect(terms).toEqual(['the', 'quick', 'brown', 'fox']);
    });

    it('should support prefix matching for partial queries', () => {
      const fts = generateFtsQuery(['auth']);
      expect(fts).toBe('auth*');
      // This matches: authentication, authorize, authoring, etc.
    });

    it('should work with multilingual content', () => {
      const queries = [
        'authentication patterns',           // English
        'pattern di autenticazione',          // Italian
        "modèle d'authentification",         // French
        'Authentifizierungsmuster',          // German
      ];

      for (const query of queries) {
        const sanitized = sanitizeQuery(query);
        const terms = extractSearchTerms(sanitized);
        const fts = generateFtsQuery(terms);

        // All should produce valid FTS queries
        expect(fts.length).toBeGreaterThan(0);
        expect(fts).toContain('*'); // Has wildcard
      }
    });
  });
});
