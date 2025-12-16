/**
 * Quack Memory - Type Definitions
 *
 * Persistent memory system with semantic search capabilities.
 * Allows AI to remember user preferences, decisions, and learnings across sessions.
 *
 * @module types/memory
 */

/**
 * Category of memory entry
 *
 * - preference: User preferences and working style
 * - fact: Project facts and technical details
 * - decision: Architectural decisions and rationale
 * - pattern: Code patterns and conventions
 * - mistake: Lessons learned from errors
 * - context: General context and background information
 */
export type MemoryCategory =
  | 'preference'
  | 'fact'
  | 'decision'
  | 'pattern'
  | 'mistake'
  | 'context';

/**
 * Confidence level for memory accuracy
 *
 * - high: User-verified or from explicit statements
 * - medium: Inferred from conversation with good confidence
 * - low: Tentative inference, needs verification
 */
export type MemoryConfidence = 'high' | 'medium' | 'low';

/**
 * Scope of memory applicability
 *
 * - global: Applies to all projects (user preferences, general patterns)
 * - project: Specific to current project (project facts, decisions)
 */
export type MemoryScope = 'global' | 'project';

/**
 * Core memory entry
 *
 * Represents a single piece of remembered information with metadata
 * for retrieval, validation, and lifecycle management.
 */
export interface QuackMemory {
  /** Unique identifier */
  id: string;

  /** Memory content (natural language) */
  content: string;

  /** Category for filtering and organization */
  category: MemoryCategory;

  /** Confidence level for this memory */
  confidence: MemoryConfidence;

  /** Applicability scope */
  scope: MemoryScope;

  /** Keywords for text-based search */
  keywords: string[];

  /** Project path (required if scope is 'project') */
  projectPath?: string;

  /** Source session ID where memory was created */
  sourceSessionId?: string;

  /** Creation timestamp (Unix ms) */
  createdAt: number;

  /** Last access timestamp (Unix ms) */
  lastAccessedAt: number;

  /** Number of times this memory was accessed */
  accessCount: number;

  /** Whether user has verified this memory */
  userVerified?: boolean;

  /** Whether memory is archived (hidden but not deleted) */
  isArchived: boolean;

  /** Reference to vector embedding ID (for semantic search) */
  vectorId?: string;
}

/**
 * Search result with relevance scoring
 *
 * Combines memory entry with computed relevance scores
 * from different search strategies (semantic, keyword, hybrid).
 */
export interface MemorySearchResult {
  /** The memory entry */
  memory: QuackMemory;

  /** Combined relevance score (0-1, higher is more relevant) */
  score: number;

  /** Vector similarity score if semantic search was used */
  semanticScore?: number;

  /** Keyword match score if keyword search was used */
  keywordScore?: number;
}

/**
 * Extraction mode for memories
 *
 * - pattern: Fast regex-based extraction (free, English-focused)
 * - llm: AI-powered semantic extraction (paid, any language)
 * - hybrid: Pattern for realtime + LLM on-demand
 */
export type ExtractionMode = 'pattern' | 'llm' | 'hybrid';

/**
 * When to trigger LLM extraction
 *
 * - realtime: After every AI response (expensive)
 * - on-demand: When user clicks "Analyze"
 * - session-end: When session closes/pauses
 * - tool-based: After significant tool executions
 */
export type LLMExtractionTrigger = 'realtime' | 'on-demand' | 'session-end' | 'tool-based';

/**
 * Memory system configuration
 *
 * Controls behavior of memory extraction, search, and injection.
 */
export interface MemorySettings {
  /** Whether memory system is enabled */
  enabled: boolean;

  /** Automatically extract memories from AI responses */
  autoExtract: boolean;

  /** Use semantic search (vector embeddings) */
  useSemanticSearch: boolean;

  /** Maximum number of memories to keep (LRU eviction) */
  maxMemories: number;

  /** Maximum tokens to use for memory injection per request */
  injectionBudget: number;

  /** Number of days to retain memories (0 = forever) */
  retentionDays: number;

  /** Extraction mode: pattern (fast/free), llm (smart/paid), hybrid */
  extractionMode: ExtractionMode;

  /** When to trigger LLM extraction */
  llmExtractionTrigger: LLMExtractionTrigger;

  /** Tools that trigger extraction in tool-based mode */
  toolsToTrack: string[];
}

/**
 * Request to extract memories from text
 *
 * Input for memory extraction service to analyze
 * conversation content and extract memorable information.
 */
export interface MemoryExtractionRequest {
  /** Text content to analyze (user or assistant message) */
  text: string;

  /** Source session ID for tracking */
  sessionId?: string;

  /** Current project path */
  projectPath?: string;

  /** Whether to extract project-scoped memories */
  extractProjectMemories?: boolean;

  /** Minimum confidence level to extract */
  minConfidence?: MemoryConfidence;
}

/**
 * Context to inject into AI prompt
 *
 * Contains relevant memories formatted for injection
 * into system prompts or conversation context.
 */
export interface MemoryInjection {
  /** Formatted memory context string */
  context: string;

  /** Memories included in injection */
  memories: QuackMemory[];

  /** Estimated token count */
  tokenCount: number;

  /** Whether token budget was exceeded */
  budgetExceeded: boolean;
}

/**
 * Default memory settings
 */
export const DEFAULT_MEMORY_SETTINGS: MemorySettings = {
  enabled: true,
  autoExtract: true,
  useSemanticSearch: true,
  maxMemories: 1000,
  injectionBudget: 2000, // tokens
  retentionDays: 90, // 3 months
  extractionMode: 'hybrid', // Pattern + LLM on-demand
  llmExtractionTrigger: 'tool-based', // Extract after tool executions
  toolsToTrack: ['Write', 'Edit', 'Bash', 'TodoWrite'], // Significant tools
};

// =============================================================================
// MCP Memory Types
// =============================================================================

/**
 * Source of memory entry
 * - quack: Pattern-based extraction (# trigger, regex patterns)
 * - mcp: MCP Memory server (AI-powered semantic extraction)
 */
export type MemorySource = 'quack' | 'mcp';

/**
 * Unified memory item for display
 * Combines Quack memories with MCP entities in a single interface
 */
export interface UnifiedMemoryItem {
  /** Unique identifier */
  id: string;
  /** Display content */
  content: string;
  /** Category/type */
  category: MemoryCategory | string;
  /** Source: 'quack' for pattern-based, 'mcp' for MCP Memory */
  source: MemorySource;
  /** Creation timestamp (when available) */
  createdAt?: number;
  /** Confidence level (for Quack memories) */
  confidence?: MemoryConfidence;
  /** Scope (for Quack memories) */
  scope?: MemoryScope;
  /** Keywords (for Quack memories) */
  keywords?: string[];
  /** User verified (for Quack memories) */
  userVerified?: boolean;
  /** Is archived (for Quack memories) */
  isArchived?: boolean;
  /** Entity name (for MCP items) */
  entityName?: string;
  /** Entity type (for MCP items) */
  entityType?: string;
  /** Relations (for MCP items) */
  relations?: Array<{
    from: string;
    to: string;
    relationType: string;
  }>;
  /** Original Quack memory data (for quack items) */
  quackMemory?: QuackMemory;
}
