/**
 * Memory Prompt Hook Tests
 *
 * Tests for the Auto Memory Search feature (SDK 0.2.1)
 * Tests keyword extraction and memory formatting
 */

import { describe, it, expect } from 'vitest';

// Mock the module functions since we're testing the logic
// The actual module uses Node.js-specific imports (better-sqlite3)

// Stop words list (copied from memory-prompt-hook.js)
const STOP_WORDS = new Set([
  // English
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of',
  'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have',
  'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may',
  'might', 'must', 'can', 'this', 'that', 'these', 'those', 'it', 'its', 'i',
  'me', 'my', 'we', 'our', 'you', 'your', 'he', 'she', 'they', 'them', 'their',
  'what', 'which', 'who', 'whom', 'when', 'where', 'why', 'how', 'all', 'each',
  'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'not',
  'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'also', 'now',
  'here', 'there', 'then', 'about', 'after', 'before', 'during', 'if', 'into',
  'through', 'under', 'over', 'above', 'below', 'up', 'down', 'out', 'off',
  'again', 'further', 'once', 'any', 'because', 'being', 'between', 'doing',
  'having', 'make', 'made', 'get', 'got', 'getting', 'let', 'want', 'need',
  // Italian
  'il', 'la', 'lo', 'le', 'gli', 'un', 'una', 'uno', 'dei', 'delle', 'degli',
  'e', 'ed', 'o', 'ma', 'se', 'per', 'con', 'su', 'da', 'di', 'che', 'chi',
  // Technical common words (too generic)
  'file', 'code', 'function', 'please', 'help', 'want', 'need', 'use', 'using',
  'create', 'make', 'add', 'update', 'change', 'fix', 'implement', 'write',
]);

const MIN_KEYWORD_LENGTH = 3;
const MAX_KEYWORDS_TO_SEARCH = 8;

/**
 * Extract meaningful keywords from user prompt
 * (Copied from memory-prompt-hook.js for testing)
 */
function extractKeywords(prompt: string): string[] {
  if (!prompt || typeof prompt !== 'string') {
    return [];
  }

  const words = prompt
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length >= MIN_KEYWORD_LENGTH)
    .filter(word => !STOP_WORDS.has(word))
    .filter(word => !/^\d+$/.test(word));

  const uniqueKeywords = [...new Set(words)];

  return uniqueKeywords.slice(0, MAX_KEYWORDS_TO_SEARCH);
}

/**
 * Format search results for injection into system prompt
 * (Copied from memory-prompt-hook.js for testing)
 */
interface MemoryEntity {
  name: string;
  type: string;
  projectId?: string;
  observations: string[];
}

function formatMemoryContext(memories: MemoryEntity[]): string {
  if (!memories || memories.length === 0) {
    return '';
  }

  let context = '\n\n## Relevant Knowledge from Second Brain\n\n';
  context += 'The following memories may be relevant to this conversation:\n\n';

  for (const memory of memories) {
    context += `### ${memory.name} (${memory.type})\n`;

    if (memory.observations && memory.observations.length > 0) {
      for (const obs of memory.observations) {
        context += `- ${obs}\n`;
      }
    }

    context += '\n';
  }

  context += '---\n';

  return context;
}

// =============================================================================
// TESTS
// =============================================================================

describe('Memory Prompt Hook - Keyword Extraction', () => {
  it('should extract meaningful keywords from a technical prompt', () => {
    const prompt = 'How do I implement authentication with JWT tokens in the React app?';
    const keywords = extractKeywords(prompt);

    expect(keywords).toContain('authentication');
    expect(keywords).toContain('jwt');
    expect(keywords).toContain('tokens');
    expect(keywords).toContain('react');
    expect(keywords).toContain('app');
  });

  it('should filter out stop words', () => {
    const prompt = 'The quick brown fox jumps over the lazy dog';
    const keywords = extractKeywords(prompt);

    expect(keywords).not.toContain('the');
    expect(keywords).not.toContain('over');
    expect(keywords).toContain('quick');
    expect(keywords).toContain('brown');
    expect(keywords).toContain('fox');
    expect(keywords).toContain('jumps');
    expect(keywords).toContain('lazy');
    expect(keywords).toContain('dog');
  });

  it('should filter out short words (less than 3 chars)', () => {
    const prompt = 'I am at the OK button';
    const keywords = extractKeywords(prompt);

    expect(keywords).not.toContain('am');
    expect(keywords).not.toContain('at');
    expect(keywords).not.toContain('ok');
    expect(keywords).toContain('button');
  });

  it('should filter out pure numbers', () => {
    const prompt = 'Fix bug 123 in version 456';
    const keywords = extractKeywords(prompt);

    expect(keywords).not.toContain('123');
    expect(keywords).not.toContain('456');
    expect(keywords).toContain('bug');
    expect(keywords).toContain('version');
  });

  it('should deduplicate keywords', () => {
    const prompt = 'React React React component component';
    const keywords = extractKeywords(prompt);

    const reactCount = keywords.filter(k => k === 'react').length;
    const componentCount = keywords.filter(k => k === 'component').length;

    expect(reactCount).toBe(1);
    expect(componentCount).toBe(1);
  });

  it('should limit to MAX_KEYWORDS_TO_SEARCH', () => {
    const prompt = 'authentication authorization database cache redis postgres mongodb mysql sqlite oracle graphql rest api websocket';
    const keywords = extractKeywords(prompt);

    expect(keywords.length).toBeLessThanOrEqual(MAX_KEYWORDS_TO_SEARCH);
  });

  it('should return empty array for empty prompt', () => {
    expect(extractKeywords('')).toEqual([]);
    expect(extractKeywords(null as any)).toEqual([]);
    expect(extractKeywords(undefined as any)).toEqual([]);
  });

  it('should handle prompts with only stop words', () => {
    const prompt = 'the and or but is was are';
    const keywords = extractKeywords(prompt);

    expect(keywords).toEqual([]);
  });

  it('should handle Italian stop words', () => {
    const prompt = 'il database di postgres per la autenticazione';
    const keywords = extractKeywords(prompt);

    expect(keywords).not.toContain('il');
    expect(keywords).not.toContain('di');
    expect(keywords).not.toContain('per');
    expect(keywords).not.toContain('la');
    expect(keywords).toContain('database');
    expect(keywords).toContain('postgres');
    expect(keywords).toContain('autenticazione');
  });

  it('should filter out generic technical terms', () => {
    const prompt = 'Please help me create a file with code function';
    const keywords = extractKeywords(prompt);

    expect(keywords).not.toContain('please');
    expect(keywords).not.toContain('help');
    expect(keywords).not.toContain('create');
    expect(keywords).not.toContain('file');
    expect(keywords).not.toContain('code');
    expect(keywords).not.toContain('function');
  });
});

describe('Memory Prompt Hook - Memory Context Formatting', () => {
  it('should format single memory correctly', () => {
    const memories: MemoryEntity[] = [{
      name: 'jwt_auth_pattern',
      type: 'pattern',
      observations: ['Use RS256 algorithm', 'Store refresh token in httpOnly cookie'],
    }];

    const context = formatMemoryContext(memories);

    expect(context).toContain('## Relevant Knowledge from Second Brain');
    expect(context).toContain('### jwt_auth_pattern (pattern)');
    expect(context).toContain('- Use RS256 algorithm');
    expect(context).toContain('- Store refresh token in httpOnly cookie');
    expect(context).toContain('---');
  });

  it('should format multiple memories correctly', () => {
    const memories: MemoryEntity[] = [
      {
        name: 'react_hooks',
        type: 'pattern',
        observations: ['Use custom hooks for reusable logic'],
      },
      {
        name: 'database_bug',
        type: 'bug_fix',
        observations: ['Fixed connection pool exhaustion'],
      },
    ];

    const context = formatMemoryContext(memories);

    expect(context).toContain('### react_hooks (pattern)');
    expect(context).toContain('### database_bug (bug_fix)');
  });

  it('should handle empty memories array', () => {
    const context = formatMemoryContext([]);
    expect(context).toBe('');
  });

  it('should handle null/undefined memories', () => {
    expect(formatMemoryContext(null as any)).toBe('');
    expect(formatMemoryContext(undefined as any)).toBe('');
  });

  it('should handle memory without observations', () => {
    const memories: MemoryEntity[] = [{
      name: 'empty_memory',
      type: 'fact',
      observations: [],
    }];

    const context = formatMemoryContext(memories);

    expect(context).toContain('### empty_memory (fact)');
    expect(context).not.toContain('- ');
  });
});

describe('Memory Prompt Hook - Edge Cases', () => {
  it('should handle special characters in prompt', () => {
    const prompt = 'Fix bug #123: @mention in $variable with &entity';
    const keywords = extractKeywords(prompt);

    expect(keywords).toContain('bug');
    expect(keywords).toContain('mention');
    expect(keywords).toContain('variable');
    expect(keywords).toContain('entity');
  });

  it('should handle newlines and tabs in prompt', () => {
    const prompt = 'authentication\n\twith\n\tjwt\ttokens';
    const keywords = extractKeywords(prompt);

    expect(keywords).toContain('authentication');
    expect(keywords).toContain('jwt');
    expect(keywords).toContain('tokens');
  });

  it('should handle mixed case keywords', () => {
    const prompt = 'React REACT react ReAcT';
    const keywords = extractKeywords(prompt);

    expect(keywords).toContain('react');
    expect(keywords.filter(k => k === 'react').length).toBe(1);
  });

  it('should handle hyphenated words', () => {
    const prompt = 'server-side rendering with client-side hydration';
    const keywords = extractKeywords(prompt);

    expect(keywords).toContain('server-side');
    expect(keywords).toContain('rendering');
    expect(keywords).toContain('client-side');
    expect(keywords).toContain('hydration');
  });
});
