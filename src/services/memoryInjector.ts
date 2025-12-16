/**
 * Memory Injector Service
 *
 * Formats and injects relevant memories into AI conversation context.
 * Manages token budgets and memory prioritization.
 *
 * @module services/memoryInjector
 */

import type {
  QuackMemory,
  MemoryInjection,
  MemoryCategory,
} from "../types/memory";
import { searchMemories } from "./memorySearch";
import type { MemorySearchOptions } from "./memorySearch";
import { estimateTokens } from "./memoryExtractor";
import { getMemorySettings, updateMemory } from "./memoryStorage";

/**
 * Category labels for human-readable output
 */
const CATEGORY_LABELS: Record<MemoryCategory, string> = {
  preference: "User Preferences",
  fact: "Project Facts",
  decision: "Decisions Made",
  pattern: "Code Patterns",
  mistake: "Lessons Learned",
  context: "Context",
};

/**
 * Category priority for injection ordering
 * Lower number = higher priority
 */
const CATEGORY_PRIORITY: Record<MemoryCategory, number> = {
  preference: 1, // User preferences are most important
  decision: 2, // Past decisions guide new ones
  pattern: 3, // Code patterns for consistency
  mistake: 4, // Avoid repeating mistakes
  fact: 5, // Project facts as context
  context: 6, // General context last
};

/**
 * Formats a single memory for injection
 *
 * @param memory - Memory to format
 * @returns Formatted string
 */
const formatMemory = (memory: QuackMemory): string => {
  const confidence = memory.confidence === "high" ? "" : ` [${memory.confidence}]`;
  const scope = memory.scope === "project" ? " (project)" : "";
  return `- ${memory.content}${confidence}${scope}`;
};

/**
 * Groups memories by category for organized output
 *
 * @param memories - Memories to group
 * @returns Map of category to memories
 */
const groupByCategory = (
  memories: QuackMemory[]
): Map<MemoryCategory, QuackMemory[]> => {
  const groups = new Map<MemoryCategory, QuackMemory[]>();

  for (const memory of memories) {
    const existing = groups.get(memory.category) || [];
    existing.push(memory);
    groups.set(memory.category, existing);
  }

  return groups;
};

/**
 * Sorts categories by priority for injection
 *
 * @param categories - Categories to sort
 * @returns Sorted array of categories
 */
const sortCategoriesByPriority = (
  categories: MemoryCategory[]
): MemoryCategory[] => {
  return [...categories].sort(
    (a, b) => CATEGORY_PRIORITY[a] - CATEGORY_PRIORITY[b]
  );
};

/**
 * Builds formatted context string from memories
 *
 * @param groups - Grouped memories by category
 * @param tokenBudget - Maximum tokens to use
 * @returns Formatted context and included memories
 */
const buildContext = (
  groups: Map<MemoryCategory, QuackMemory[]>,
  tokenBudget: number
): { context: string; included: QuackMemory[]; tokens: number } => {
  const lines: string[] = [];
  const included: QuackMemory[] = [];
  let currentTokens = 0;

  // Header
  const header = "## Relevant Memories\n";
  currentTokens += estimateTokens(header);
  lines.push(header);

  // Sort categories by priority
  const sortedCategories = sortCategoriesByPriority(
    Array.from(groups.keys())
  );

  for (const category of sortedCategories) {
    const memories = groups.get(category) || [];
    const categoryHeader = `### ${CATEGORY_LABELS[category]}\n`;
    const headerTokens = estimateTokens(categoryHeader);

    // Check if we can fit the category header
    if (currentTokens + headerTokens > tokenBudget) {
      break;
    }

    lines.push(categoryHeader);
    currentTokens += headerTokens;

    // Add memories until budget exhausted
    for (const memory of memories) {
      const formatted = formatMemory(memory);
      const memoryTokens = estimateTokens(formatted);

      if (currentTokens + memoryTokens > tokenBudget) {
        break;
      }

      lines.push(formatted);
      included.push(memory);
      currentTokens += memoryTokens;
    }

    lines.push(""); // Spacing between categories
  }

  return {
    context: lines.join("\n"),
    included,
    tokens: currentTokens,
  };
};

/**
 * Generates memory injection for AI context
 *
 * Searches for relevant memories and formats them for injection
 * into the AI system prompt or conversation context.
 *
 * @param query - Current conversation context or user message
 * @param options - Search and injection options
 * @returns Memory injection with formatted context
 *
 * @example
 * ```typescript
 * const injection = await generateMemoryInjection(
 *   "Help me refactor this TypeScript function",
 *   { projectPath: "/path/to/project" }
 * );
 *
 * if (injection.memories.length > 0) {
 *   systemPrompt += "\n" + injection.context;
 * }
 * ```
 */
export const generateMemoryInjection = async (
  query: string,
  options: MemorySearchOptions = {}
): Promise<MemoryInjection> => {
  const settings = await getMemorySettings();

  // Return empty if memory system is disabled
  if (!settings.enabled) {
    return {
      context: "",
      memories: [],
      tokenCount: 0,
      budgetExceeded: false,
    };
  }

  const tokenBudget = settings.injectionBudget;

  console.log(
    `[memoryInjector] Generating injection for: "${query.slice(0, 30)}..."`
  );

  // Search for relevant memories
  const searchResults = await searchMemories(query, {
    ...options,
    limit: 20, // Get more than needed for filtering
  });

  if (searchResults.length === 0) {
    console.log("[memoryInjector] No relevant memories found");
    return {
      context: "",
      memories: [],
      tokenCount: 0,
      budgetExceeded: false,
    };
  }

  // Extract memories from results
  const memories = searchResults.map((r) => r.memory);

  // Group by category
  const groups = groupByCategory(memories);

  // Build context within token budget
  const { context, included, tokens } = buildContext(groups, tokenBudget);

  // Update access count for included memories
  await updateAccessCounts(included);

  const budgetExceeded = memories.length > included.length;

  console.log(
    `[memoryInjector] Injecting ${included.length} memories (${tokens} tokens)`
  );

  return {
    context,
    memories: included,
    tokenCount: tokens,
    budgetExceeded,
  };
};

/**
 * Updates access counts for retrieved memories
 *
 * @param memories - Memories that were accessed
 */
const updateAccessCounts = async (memories: QuackMemory[]): Promise<void> => {
  for (const memory of memories) {
    try {
      await updateMemory(memory.id, {
        accessCount: memory.accessCount + 1,
        lastAccessedAt: Date.now(),
      });
    } catch (error) {
      // Non-critical, just log
      console.warn(
        `[memoryInjector] Failed to update access count for ${memory.id}`
      );
    }
  }
};

/**
 * Generates a system prompt section with memory context
 *
 * Convenience function for adding memories to system prompts.
 *
 * @param query - Current user query or conversation context
 * @param projectPath - Current project path (optional)
 * @returns Formatted system prompt addition or empty string
 */
export const getMemorySystemPrompt = async (
  query: string,
  projectPath?: string
): Promise<string> => {
  const injection = await generateMemoryInjection(query, {
    projectPath,
    includeArchived: false,
  });

  if (injection.memories.length === 0) {
    return "";
  }

  return `
<memory-context>
The following are relevant memories from previous conversations.
Use this context to maintain consistency and respect user preferences.

${injection.context}
</memory-context>
`;
};

/**
 * Checks if memory injection should be performed
 *
 * Based on settings and current state.
 *
 * @returns Whether injection is enabled
 */
export const shouldInjectMemories = async (): Promise<boolean> => {
  const settings = await getMemorySettings();
  return settings.enabled;
};
