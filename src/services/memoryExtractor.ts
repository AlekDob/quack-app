/**
 * Memory Extractor Service
 *
 * Rule-based extraction of memorable information from conversation text.
 * Uses regex patterns to identify preferences, facts, decisions, patterns,
 * mistakes, and general context from AI and user messages.
 *
 * @module services/memoryExtractor
 */

import type {
  QuackMemory,
  MemoryCategory,
  MemoryConfidence,
  MemoryExtractionRequest,
} from "../types/memory";

/**
 * Pattern definition for memory extraction
 *
 * Each pattern targets a specific memory category with regex
 * matching and confidence scoring.
 */
interface ExtractionPattern {
  /** Memory category this pattern extracts */
  category: MemoryCategory;

  /** Regex pattern to match in text */
  pattern: RegExp;

  /** Confidence level for matches */
  confidence: MemoryConfidence;

  /** Human-readable description */
  description: string;

  /** Whether this extracts project-scoped memories */
  projectScoped: boolean;
}

/**
 * Manual trigger pattern for memories
 *
 * When user types '#' followed by text, it's saved as a memory.
 * Format: #category: content OR just #content (defaults to 'context')
 *
 * Examples:
 * - "#preference: I like dark mode" → preference category
 * - "#decision: We'll use React Query" → decision category
 * - "#Remember this for later" → context category (default)
 */
export const MANUAL_MEMORY_PATTERN = /^#(\w+)?:?\s*(.+)$/;

/**
 * Extraction patterns for different memory categories
 *
 * Patterns are ordered by specificity - more specific patterns first
 * to avoid conflicts and ensure accurate categorization.
 */
const EXTRACTION_PATTERNS: ExtractionPattern[] = [
  // PREFERENCES - User working style and choices
  {
    category: "preference",
    pattern: /\b(I\s+prefer|prefer|always|never|like\s+to|don't\s+like)\b/i,
    confidence: "high",
    description: "User preferences and working style",
    projectScoped: false,
  },
  {
    category: "preference",
    pattern:
      /\b(my\s+preference|I\s+usually|I\s+tend\s+to|typically\s+I|generally\s+I)\b/i,
    confidence: "medium",
    description: "User behavioral patterns",
    projectScoped: false,
  },

  // FACTS - Project technical details
  {
    category: "fact",
    pattern:
      /\b(we\s+use|using|built\s+with|powered\s+by|tech\s+stack|dependencies)\b/i,
    confidence: "high",
    description: "Project technical facts",
    projectScoped: true,
  },
  {
    category: "fact",
    pattern: /\b(this\s+project|the\s+app|the\s+system|our\s+codebase)\b/i,
    confidence: "medium",
    description: "Project context and structure",
    projectScoped: true,
  },
  {
    category: "fact",
    pattern:
      /\b(version|package|library|framework|language|database|API)\s+\w+/i,
    confidence: "medium",
    description: "Technology versions and names",
    projectScoped: true,
  },

  // DECISIONS - Architectural and design decisions
  {
    category: "decision",
    pattern:
      /\b(decided|decision|let's\s+go\s+with|chose|chosen|the\s+decision|we'll\s+use)\b/i,
    confidence: "high",
    description: "Explicit decisions made",
    projectScoped: true,
  },
  {
    category: "decision",
    pattern: /\b(after\s+discussion|we\s+agreed|consensus|settled\s+on)\b/i,
    confidence: "high",
    description: "Collaborative decisions",
    projectScoped: true,
  },
  {
    category: "decision",
    pattern: /\b(approach|strategy|plan\s+is|going\s+with)\b/i,
    confidence: "medium",
    description: "Strategic approaches",
    projectScoped: true,
  },

  // PATTERNS - Code patterns and conventions
  {
    category: "pattern",
    pattern:
      /\b(pattern:|convention:|standard\s+is|coding\s+style|naming\s+convention)\b/i,
    confidence: "high",
    description: "Explicit patterns and conventions",
    projectScoped: true,
  },
  {
    category: "pattern",
    pattern: /\b(always\s+use|never\s+use|must\s+use|should\s+use)\b/i,
    confidence: "medium",
    description: "Code rules and guidelines",
    projectScoped: true,
  },
  {
    category: "pattern",
    pattern: /\b(best\s+practice|recommended|idiomatic|follow\s+the)\b/i,
    confidence: "medium",
    description: "Best practices",
    projectScoped: true,
  },

  // MISTAKES - Lessons learned from errors
  {
    category: "mistake",
    pattern:
      /\b(don't|avoid|mistake\s+was|bug\s+was|error\s+was|lesson\s+learned)\b/i,
    confidence: "high",
    description: "Explicit mistakes and lessons",
    projectScoped: true,
  },
  {
    category: "mistake",
    pattern:
      /\b(shouldn't|won't\s+work|didn't\s+work|failed\s+because|issue\s+was)\b/i,
    confidence: "medium",
    description: "Things that didn't work",
    projectScoped: true,
  },
  {
    category: "mistake",
    pattern: /\b(warning|caution|be\s+careful|watch\s+out)\b/i,
    confidence: "low",
    description: "Warnings and cautions",
    projectScoped: true,
  },

  // CONTEXT - General background information
  {
    category: "context",
    pattern:
      /\b(background|context|goal|objective|purpose|requirements)\b/i,
    confidence: "medium",
    description: "Project background and goals",
    projectScoped: true,
  },
  {
    category: "context",
    pattern: /\b(working\s+on|building|creating|developing|maintaining)\b/i,
    confidence: "low",
    description: "Current work context",
    projectScoped: true,
  },
];

/**
 * Extracts keywords from text for search indexing
 *
 * Removes common stop words and extracts meaningful terms.
 * Returns unique keywords in lowercase.
 *
 * @param text - Text to extract keywords from
 * @returns Array of unique keywords
 *
 * @example
 * ```typescript
 * const keywords = extractKeywords("I prefer TypeScript strict mode");
 * // Returns: ["prefer", "typescript", "strict", "mode"]
 * ```
 */
export const extractKeywords = (text: string): string[] => {
  // Common stop words to ignore
  const stopWords = new Set([
    "a",
    "an",
    "the",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "i",
    "you",
    "he",
    "she",
    "it",
    "we",
    "they",
    "to",
    "of",
    "in",
    "on",
    "at",
    "for",
    "with",
    "by",
    "from",
    "as",
    "and",
    "or",
    "but",
    "not",
  ]);

  // Extract words (alphanumeric + hyphens for tech terms)
  const words = text
    .toLowerCase()
    .match(/\b[\w-]+\b/g) || [];

  // Filter stop words and short words, deduplicate
  const keywords = Array.from(
    new Set(
      words.filter((word) => word.length > 2 && !stopWords.has(word))
    )
  );

  return keywords;
};

/**
 * Generates a unique memory ID
 *
 * Uses crypto.randomUUID() for collision-resistant IDs.
 * Prefixes with "mem-" for type identification.
 *
 * @returns Unique memory ID
 *
 * @example
 * ```typescript
 * const id = generateMemoryId();
 * // Returns: "mem-f47ac10b-58cc-4372-a567-0e02b2c3d479"
 * ```
 */
export const generateMemoryId = (): string => {
  return `mem-${crypto.randomUUID()}`;
};

/**
 * Extracts memorable information from text
 *
 * Analyzes text using pattern matching to identify and extract
 * memories. Returns array of QuackMemory objects ready for storage.
 *
 * Features:
 * - Pattern-based categorization
 * - Keyword extraction for search
 * - Project vs global scoping
 * - Confidence scoring
 * - Deduplication by content similarity
 *
 * @param request - Extraction request with text and context
 * @returns Array of extracted QuackMemory objects
 *
 * @example
 * ```typescript
 * const memories = extractMemories({
 *   text: "I prefer using TypeScript strict mode",
 *   sessionId: "session-123",
 *   projectPath: "/path/to/project",
 *   extractProjectMemories: true
 * });
 * ```
 */
export const extractMemories = (
  request: MemoryExtractionRequest
): QuackMemory[] => {
  const {
    text,
    sessionId,
    projectPath,
    extractProjectMemories = true,
    minConfidence = "low",
  } = request;

  const memories: QuackMemory[] = [];
  const now = Date.now();

  // Split text into sentences for more precise extraction
  const sentences = text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10); // Ignore very short fragments

  // Confidence level ordering for filtering
  const confidenceLevels: Record<MemoryConfidence, number> = {
    high: 3,
    medium: 2,
    low: 1,
  };

  const minConfidenceLevel = confidenceLevels[minConfidence];

  for (const sentence of sentences) {
    for (const pattern of EXTRACTION_PATTERNS) {
      // Skip project-scoped patterns if not extracting project memories
      if (pattern.projectScoped && !extractProjectMemories) {
        continue;
      }

      // Skip if confidence is below minimum
      if (confidenceLevels[pattern.confidence] < minConfidenceLevel) {
        continue;
      }

      // Check if pattern matches
      if (pattern.pattern.test(sentence)) {
        const memory: QuackMemory = {
          id: generateMemoryId(),
          content: sentence,
          category: pattern.category,
          confidence: pattern.confidence,
          scope: pattern.projectScoped ? "project" : "global",
          keywords: extractKeywords(sentence),
          projectPath: pattern.projectScoped ? projectPath : undefined,
          sourceSessionId: sessionId,
          createdAt: now,
          lastAccessedAt: now,
          accessCount: 0,
          isArchived: false,
        };

        memories.push(memory);
        break; // Use first matching pattern for this sentence
      }
    }
  }

  // Deduplicate by content similarity (exact matches)
  const deduped = memories.filter(
    (memory, index, self) =>
      index === self.findIndex((m) => m.content === memory.content)
  );

  console.log(
    `[memoryExtractor] Extracted ${deduped.length} memories from ${sentences.length} sentences`
  );

  return deduped;
};

/**
 * Estimates token count for memory content
 *
 * Simple estimation: ~4 characters per token (rough average for English).
 * Used for budget calculations when injecting memories into prompts.
 *
 * @param text - Text to estimate tokens for
 * @returns Estimated token count
 *
 * @example
 * ```typescript
 * const tokens = estimateTokens("I prefer TypeScript");
 * // Returns: ~5 tokens
 * ```
 */
export const estimateTokens = (text: string): number => {
  return Math.ceil(text.length / 4);
};

/**
 * Valid categories for manual memory trigger
 */
const VALID_CATEGORIES: MemoryCategory[] = [
  'preference',
  'fact',
  'decision',
  'pattern',
  'mistake',
  'context',
];

/**
 * Extracts manual memory from text starting with '#'
 *
 * Supports two formats:
 * - "#category: content" - Explicit category
 * - "#content" - Defaults to 'context' category
 *
 * @param text - User input text
 * @param sessionId - Current session ID
 * @param projectPath - Current project path
 * @returns QuackMemory if text starts with '#', null otherwise
 *
 * @example
 * ```typescript
 * const memory = extractManualMemory("#preference: I like dark mode", "session-123", "/project");
 * // Returns: QuackMemory with category "preference"
 *
 * const memory2 = extractManualMemory("#Remember this!", "session-123", "/project");
 * // Returns: QuackMemory with category "context" (default)
 * ```
 */
export const extractManualMemory = (
  text: string,
  sessionId?: string,
  projectPath?: string
): QuackMemory | null => {
  const trimmed = text.trim();

  // Must start with '#'
  if (!trimmed.startsWith('#')) {
    return null;
  }

  const match = MANUAL_MEMORY_PATTERN.exec(trimmed);
  if (!match) {
    return null;
  }

  const [, categoryOrContent, content] = match;

  let category: MemoryCategory = 'context';
  let memoryContent: string;

  // Check if first capture group is a valid category
  if (categoryOrContent && VALID_CATEGORIES.includes(categoryOrContent.toLowerCase() as MemoryCategory)) {
    category = categoryOrContent.toLowerCase() as MemoryCategory;
    memoryContent = content || '';
  } else {
    // No valid category prefix, use the whole text after '#'
    memoryContent = categoryOrContent ? `${categoryOrContent}${content ? `: ${content}` : ''}` : content || '';
  }

  if (!memoryContent.trim()) {
    return null;
  }

  const now = Date.now();
  const isProjectScoped = category !== 'preference';

  const memory: QuackMemory = {
    id: generateMemoryId(),
    content: memoryContent.trim(),
    category,
    confidence: 'high', // User-verified by definition
    scope: isProjectScoped ? 'project' : 'global',
    keywords: extractKeywords(memoryContent),
    projectPath: isProjectScoped ? projectPath : undefined,
    sourceSessionId: sessionId,
    createdAt: now,
    lastAccessedAt: now,
    accessCount: 0,
    userVerified: true, // Manual entries are verified by user
    isArchived: false,
  };

  console.log(`[memoryExtractor] Manual memory extracted: ${category} - "${memoryContent.substring(0, 50)}..."`);

  return memory;
};

/**
 * Checks if text contains a manual memory trigger
 *
 * @param text - Text to check
 * @returns true if text starts with '#'
 */
export const hasManualMemoryTrigger = (text: string): boolean => {
  return text.trim().startsWith('#');
};
