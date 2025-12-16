import { describe, it, expect } from 'vitest';
import {
  extractKeywords,
  generateMemoryId,
  extractMemories,
  estimateTokens,
} from '../services/memoryExtractor';
import type { MemoryExtractionRequest } from '../types/memory';

/**
 * Memory Extractor Tests
 *
 * Comprehensive tests for the memory extraction service that identifies
 * and extracts memorable information from conversation text.
 */

describe('extractKeywords', () => {
  it('should extract meaningful keywords from text', () => {
    const text = 'I prefer TypeScript strict mode for better type safety';
    const keywords = extractKeywords(text);

    expect(keywords).toContain('prefer');
    expect(keywords).toContain('typescript');
    expect(keywords).toContain('strict');
    expect(keywords).toContain('mode');
    expect(keywords).toContain('better');
    expect(keywords).toContain('type');
    expect(keywords).toContain('safety');
  });

  it('should filter out stop words', () => {
    const text = 'I am the developer and you are the AI';
    const keywords = extractKeywords(text);

    // Stop words should be filtered
    expect(keywords).not.toContain('i');
    expect(keywords).not.toContain('am');
    expect(keywords).not.toContain('the');
    expect(keywords).not.toContain('and');
    expect(keywords).not.toContain('you');
    expect(keywords).not.toContain('are');

    // Meaningful words should remain
    expect(keywords).toContain('developer');
  });

  it('should filter out short words (< 3 chars)', () => {
    const text = 'We go to an IT shop';
    const keywords = extractKeywords(text);

    // Short words should be filtered
    expect(keywords).not.toContain('we');
    expect(keywords).not.toContain('go');
    expect(keywords).not.toContain('to');
    expect(keywords).not.toContain('an');
    expect(keywords).not.toContain('it'); // 2 chars

    // Longer words should remain
    expect(keywords).toContain('shop');
  });

  it('should return unique keywords', () => {
    const text = 'TypeScript TypeScript TypeScript is great great';
    const keywords = extractKeywords(text);

    // Should have only unique values
    expect(keywords.filter(k => k === 'typescript').length).toBe(1);
    expect(keywords.filter(k => k === 'great').length).toBe(1);
  });

  it('should handle empty text', () => {
    const keywords = extractKeywords('');
    expect(keywords).toEqual([]);
  });

  it('should handle text with only stop words', () => {
    const text = 'I am the one who is';
    const keywords = extractKeywords(text);

    // Should return very few words (who and one survive because "who" is not in stop words list)
    expect(keywords.length).toBe(2);
    expect(keywords).toContain('one');
    expect(keywords).toContain('who');
  });

  it('should handle special characters and tech terms', () => {
    const text = 'We use React-Native and node.js with camelCase naming';
    const keywords = extractKeywords(text);

    // Tech terms with hyphens (dots separate words in regex)
    expect(keywords).toContain('react-native');
    expect(keywords).toContain('node'); // "node.js" becomes "node" and "js" (dot separates words)
    expect(keywords).toContain('camelcase');
    expect(keywords).toContain('naming');
  });
});

describe('generateMemoryId', () => {
  it('should generate unique IDs', () => {
    const id1 = generateMemoryId();
    const id2 = generateMemoryId();
    const id3 = generateMemoryId();

    // All IDs should be different
    expect(id1).not.toBe(id2);
    expect(id2).not.toBe(id3);
    expect(id1).not.toBe(id3);
  });

  it('should prefix IDs with "mem-"', () => {
    const id = generateMemoryId();
    expect(id).toMatch(/^mem-/);
  });

  it('should generate different IDs on each call', () => {
    const ids = new Set<string>();

    // Generate 100 IDs
    for (let i = 0; i < 100; i++) {
      ids.add(generateMemoryId());
    }

    // All should be unique
    expect(ids.size).toBe(100);
  });
});

describe('extractMemories', () => {
  it('should extract preference memories', () => {
    const request: MemoryExtractionRequest = {
      text: 'I prefer TypeScript over JavaScript. I always use strict mode.',
      sessionId: 'session-123',
    };

    const memories = extractMemories(request);

    expect(memories.length).toBeGreaterThan(0);

    const preferenceMemory = memories.find(m => m.category === 'preference');
    expect(preferenceMemory).toBeDefined();
    expect(preferenceMemory?.scope).toBe('global');
    expect(preferenceMemory?.confidence).toBe('high');
    expect(preferenceMemory?.keywords).toContain('prefer');
  });

  it('should extract fact memories', () => {
    const request: MemoryExtractionRequest = {
      text: 'We use React 19 and TypeScript 5.8.3 in this project.',
      projectPath: '/path/to/project',
      extractProjectMemories: true,
    };

    const memories = extractMemories(request);

    expect(memories.length).toBeGreaterThan(0);

    const factMemory = memories.find(m => m.category === 'fact');
    expect(factMemory).toBeDefined();
    expect(factMemory?.scope).toBe('project');
    expect(factMemory?.projectPath).toBe('/path/to/project');
    expect(factMemory?.confidence).toBe('high');
  });

  it('should extract decision memories', () => {
    const request: MemoryExtractionRequest = {
      text: 'We decided to use Zustand for state management.',
      projectPath: '/path/to/project',
      extractProjectMemories: true,
    };

    const memories = extractMemories(request);

    const decisionMemory = memories.find(m => m.category === 'decision');
    expect(decisionMemory).toBeDefined();
    expect(decisionMemory?.scope).toBe('project');
    expect(decisionMemory?.confidence).toBe('high');
    expect(decisionMemory?.keywords).toContain('zustand');
  });

  it('should extract pattern memories', () => {
    const request: MemoryExtractionRequest = {
      text: 'Naming convention: use camelCase for variables.',
      projectPath: '/path/to/project',
      extractProjectMemories: true,
    };

    const memories = extractMemories(request);

    const patternMemory = memories.find(m => m.category === 'pattern');
    expect(patternMemory).toBeDefined();
    expect(patternMemory?.scope).toBe('project');
    expect(patternMemory?.keywords).toContain('naming');
    expect(patternMemory?.keywords).toContain('convention');
    expect(patternMemory?.keywords).toContain('camelcase');
  });

  it('should extract mistake memories', () => {
    const request: MemoryExtractionRequest = {
      text: 'The bug was caused by not awaiting the async function.',
      projectPath: '/path/to/project',
      extractProjectMemories: true,
    };

    const memories = extractMemories(request);

    const mistakeMemory = memories.find(m => m.category === 'mistake');
    expect(mistakeMemory).toBeDefined();
    expect(mistakeMemory?.scope).toBe('project');
    expect(mistakeMemory?.confidence).toBe('high');
    expect(mistakeMemory?.keywords).toContain('bug');
  });

  it('should extract context memories', () => {
    const request: MemoryExtractionRequest = {
      text: 'The goal is to build a multi-agentic desktop app.',
      projectPath: '/path/to/project',
      extractProjectMemories: true,
    };

    const memories = extractMemories(request);

    const contextMemory = memories.find(m => m.category === 'context');
    expect(contextMemory).toBeDefined();
    expect(contextMemory?.scope).toBe('project');
    expect(contextMemory?.keywords).toContain('goal');
  });

  it('should respect minConfidence filter', () => {
    const request: MemoryExtractionRequest = {
      text: 'I prefer TypeScript. The approach is to use composition.',
      projectPath: '/path/to/project',
      extractProjectMemories: true,
      minConfidence: 'high', // Only high confidence
    };

    const memories = extractMemories(request);

    // Should only extract high confidence memories
    expect(memories.every(m => m.confidence === 'high')).toBe(true);

    // Should have preference (high confidence)
    expect(memories.some(m => m.category === 'preference')).toBe(true);
  });

  it('should respect extractProjectMemories flag', () => {
    const request: MemoryExtractionRequest = {
      text: 'I prefer TypeScript. We use React in this project.',
      extractProjectMemories: false, // Don't extract project memories
    };

    const memories = extractMemories(request);

    // Should only extract global-scoped memories (preferences)
    expect(memories.every(m => m.scope === 'global')).toBe(true);
    expect(memories.some(m => m.category === 'preference')).toBe(true);

    // Should NOT extract project-scoped memories (facts)
    expect(memories.some(m => m.category === 'fact')).toBe(false);
  });

  it('should deduplicate identical sentences', () => {
    const request: MemoryExtractionRequest = {
      text: 'I prefer TypeScript. I really do prefer TypeScript. I prefer TypeScript.',
    };

    const memories = extractMemories(request);

    // Should only have one memory for the repeated sentence
    const uniqueContents = new Set(memories.map(m => m.content));
    expect(uniqueContents.size).toBe(memories.length);
  });

  it('should handle empty text', () => {
    const request: MemoryExtractionRequest = {
      text: '',
    };

    const memories = extractMemories(request);
    expect(memories).toEqual([]);
  });

  it('should handle text with no patterns', () => {
    const request: MemoryExtractionRequest = {
      text: 'Hello there. Nice weather today.',
    };

    const memories = extractMemories(request);
    expect(memories).toEqual([]);
  });

  it('should handle multiple patterns in same text', () => {
    const request: MemoryExtractionRequest = {
      text: 'I prefer TypeScript. We decided on React for the frontend. Standard is to write pure functions.',
      projectPath: '/path/to/project',
      extractProjectMemories: true,
    };

    const memories = extractMemories(request);

    // Should extract multiple different categories
    expect(memories.length).toBe(3);

    const categories = new Set(memories.map(m => m.category));
    expect(categories.has('preference')).toBe(true);
    expect(categories.has('decision')).toBe(true);
    expect(categories.has('pattern')).toBe(true);
  });

  it('should set correct metadata on extracted memories', () => {
    const request: MemoryExtractionRequest = {
      text: 'I prefer TypeScript strict mode.',
      sessionId: 'session-456',
      projectPath: '/path/to/project',
    };

    const memories = extractMemories(request);
    const memory = memories[0];

    // Check all metadata fields
    expect(memory.id).toMatch(/^mem-/);
    expect(memory.content).toBeTruthy();
    expect(memory.category).toBeTruthy();
    expect(memory.confidence).toBeTruthy();
    expect(memory.scope).toBeTruthy();
    expect(memory.keywords.length).toBeGreaterThan(0);
    expect(memory.sourceSessionId).toBe('session-456');
    expect(memory.createdAt).toBeGreaterThan(0);
    expect(memory.lastAccessedAt).toBeGreaterThan(0);
    expect(memory.accessCount).toBe(0);
    expect(memory.isArchived).toBe(false);
  });
});

describe('estimateTokens', () => {
  it('should estimate ~4 chars per token', () => {
    const text = 'I prefer TypeScript'; // 19 chars
    const tokens = estimateTokens(text);

    // 19 / 4 = 4.75, should round up to 5
    expect(tokens).toBe(5);
  });

  it('should handle empty string', () => {
    const tokens = estimateTokens('');
    expect(tokens).toBe(0);
  });

  it('should round up', () => {
    const text = 'Test'; // 4 chars
    const tokens = estimateTokens(text);

    // 4 / 4 = 1
    expect(tokens).toBe(1);

    const text2 = 'Tests'; // 5 chars
    const tokens2 = estimateTokens(text2);

    // 5 / 4 = 1.25, should round up to 2
    expect(tokens2).toBe(2);
  });

  it('should handle long text', () => {
    const text = 'a'.repeat(1000); // 1000 chars
    const tokens = estimateTokens(text);

    // 1000 / 4 = 250
    expect(tokens).toBe(250);
  });
});

describe('extractMemories - Edge Cases', () => {
  it('should handle very short sentences', () => {
    const request: MemoryExtractionRequest = {
      text: 'Ok. Yes. No. Maybe.',
    };

    const memories = extractMemories(request);

    // Very short sentences (< 10 chars) should be ignored
    expect(memories).toEqual([]);
  });

  it('should handle text with special characters', () => {
    const request: MemoryExtractionRequest = {
      text: 'I prefer @typescript/eslint-parser!!! We use it #always.',
    };

    const memories = extractMemories(request);

    // Should still extract despite special characters
    expect(memories.length).toBeGreaterThan(0);
  });

  it('should handle mixed case patterns', () => {
    const request: MemoryExtractionRequest = {
      text: 'I PREFER typescript. We USE react.',
      projectPath: '/path/to/project',
      extractProjectMemories: true,
    };

    const memories = extractMemories(request);

    // Patterns should match case-insensitively
    expect(memories.some(m => m.category === 'preference')).toBe(true);
    expect(memories.some(m => m.category === 'fact')).toBe(true);
  });

  it('should not extract from fragments without clear patterns', () => {
    const request: MemoryExtractionRequest = {
      text: 'Looking at the code now. Checking files.',
    };

    const memories = extractMemories(request);
    expect(memories.length).toBe(0);
  });
});

describe('extractMemories - Real-World Scenarios', () => {
  it('should extract from user preference statement', () => {
    const request: MemoryExtractionRequest = {
      text: 'I prefer using absolute imports with @ alias instead of relative paths.',
    };

    const memories = extractMemories(request);

    expect(memories.length).toBe(1);
    expect(memories[0].category).toBe('preference');
    expect(memories[0].scope).toBe('global');
    expect(memories[0].keywords).toContain('prefer');
    expect(memories[0].keywords).toContain('absolute');
    expect(memories[0].keywords).toContain('imports');
  });

  it('should extract from project tech stack description', () => {
    const request: MemoryExtractionRequest = {
      text: 'This project uses Tauri 2.8.5 with React 19 and TypeScript 5.8.3.',
      projectPath: '/Users/dev/quack-app',
      extractProjectMemories: true,
    };

    const memories = extractMemories(request);

    expect(memories.length).toBeGreaterThan(0);
    expect(memories[0].category).toBe('fact');
    expect(memories[0].scope).toBe('project');
    expect(memories[0].projectPath).toBe('/Users/dev/quack-app');
  });

  it('should extract from architectural decision', () => {
    const request: MemoryExtractionRequest = {
      text: 'After discussion we decided on implementing event sourcing for the data layer.',
      projectPath: '/Users/dev/quack-app',
      extractProjectMemories: true,
    };

    const memories = extractMemories(request);

    expect(memories.length).toBeGreaterThan(0);
    // Find a decision memory (there might be multiple patterns matching)
    const decisionMemory = memories.find(m => m.category === 'decision');
    expect(decisionMemory).toBeDefined();
    expect(decisionMemory?.confidence).toBe('high');
  });

  it('should extract from bug report', () => {
    const request: MemoryExtractionRequest = {
      text: 'The bug was caused by not handling the async state update correctly.',
      projectPath: '/Users/dev/quack-app',
      extractProjectMemories: true,
    };

    const memories = extractMemories(request);

    expect(memories.length).toBe(1);
    expect(memories[0].category).toBe('mistake');
    expect(memories[0].keywords).toContain('bug');
    expect(memories[0].keywords).toContain('async');
  });

  it('should extract multiple memories from complex conversation', () => {
    const request: MemoryExtractionRequest = {
      text: `I prefer TypeScript strict mode. We use React 19 in this project.
             We decided that Zustand is the best choice for state management.`,
      projectPath: '/Users/dev/quack-app',
      extractProjectMemories: true,
    };

    const memories = extractMemories(request);

    // Should extract multiple different types (preference, fact, decision)
    expect(memories.length).toBeGreaterThanOrEqual(3);

    const categories = new Set(memories.map(m => m.category));
    expect(categories.has('preference')).toBe(true);
    expect(categories.has('fact')).toBe(true);
    expect(categories.has('decision')).toBe(true);
  });
});
