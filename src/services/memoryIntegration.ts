/**
 * Memory Integration Service
 *
 * Integrates Quack Memory with the chat system.
 * Handles automatic memory extraction and context injection.
 * Supports hybrid extraction: pattern + LLM + manual trigger + tool-based.
 *
 * @module services/memoryIntegration
 */

import {
  extractMemories,
  extractManualMemory,
  hasManualMemoryTrigger,
} from "./memoryExtractor";
import { addMemory, getMemorySettings } from "./memoryStorage";
import { getMemorySystemPrompt } from "./memoryInjector";
import { isEmbedderReady, initializeEmbedder } from "./memoryEmbedder";
import { addVector, initializeVectorStore } from "./memoryVectorStore";
import {
  extractMemoriesWithLLM,
  extractMemoriesFromTool,
  analyzeSession as analyzeSessionLLM,
  type ToolExecution,
} from "./memoryLLMExtractor";
import type { QuackMemory, ExtractionMode } from "../types/memory";

/** Initialization state */
let isInitialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Initializes the memory system
 *
 * Called once at app startup to prepare embedder and vector store.
 * Safe to call multiple times (idempotent).
 */
export const initializeMemorySystem = async (): Promise<void> => {
  if (isInitialized) return;

  // Prevent multiple concurrent initializations
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      const settings = await getMemorySettings();

      if (!settings.enabled) {
        console.log("[memoryIntegration] Memory system disabled in settings");
        return;
      }

      // Initialize embedder for semantic search
      if (settings.useSemanticSearch) {
        try {
          await initializeEmbedder();
          await initializeVectorStore();
          console.log("[memoryIntegration] Semantic search initialized");
        } catch (err) {
          console.warn("[memoryIntegration] Semantic search init failed:", err);
          // Continue without semantic search
        }
      }

      isInitialized = true;
      console.log("[memoryIntegration] Memory system initialized");
    } catch (error) {
      console.error("[memoryIntegration] Initialization failed:", error);
    }
  })();

  return initPromise;
};

/**
 * Extracts and saves memories from AI response text
 *
 * Called automatically after each AI response completes.
 * Supports hybrid extraction based on settings:
 * - pattern: Fast regex-based (free)
 * - llm: Claude-powered semantic (paid)
 * - hybrid: Pattern realtime + LLM on-demand
 *
 * @param text - AI response text
 * @param sessionId - Current session ID
 * @param projectPath - Current project path (optional)
 * @param apiKey - Optional API key for LLM extraction
 * @returns Number of memories extracted
 */
export const extractAndSaveMemories = async (
  text: string,
  sessionId?: string,
  projectPath?: string,
  apiKey?: string
): Promise<number> => {
  console.log(`[memoryIntegration] extractAndSaveMemories called (${text.length} chars)`);

  try {
    // Check if memory system is enabled
    const settings = await getMemorySettings();
    console.log(`[memoryIntegration] Settings: enabled=${settings.enabled}, autoExtract=${settings.autoExtract}, mode=${settings.extractionMode}`);

    if (!settings.enabled || !settings.autoExtract) {
      console.log("[memoryIntegration] Skipping: disabled or autoExtract off");
      return 0;
    }

    // Don't extract from very short responses
    if (text.length < 50) {
      console.log("[memoryIntegration] Skipping: text too short");
      return 0;
    }

    let memories: QuackMemory[] = [];
    const extractionMode = settings.extractionMode || 'pattern';

    // Pattern-based extraction (for 'pattern' and 'hybrid' modes)
    if (extractionMode === 'pattern' || extractionMode === 'hybrid') {
      const patternMemories = extractMemories({
        text,
        sessionId,
        projectPath,
        extractProjectMemories: !!projectPath,
      });
      memories.push(...patternMemories);
    }

    // LLM-based extraction (for 'llm' mode with realtime trigger)
    if (extractionMode === 'llm' && settings.llmExtractionTrigger === 'realtime' && apiKey) {
      const llmMemories = await extractMemoriesWithLLM(
        text,
        apiKey,
        sessionId,
        projectPath
      );
      memories.push(...llmMemories);
    }

    if (memories.length === 0) {
      return 0;
    }

    // Deduplicate by content
    memories = deduplicateMemories(memories);

    // Save each memory
    await saveMemories(memories, settings.useSemanticSearch);

    console.log(
      `[memoryIntegration] Extracted ${memories.length} memories from response (mode: ${extractionMode})`
    );
    return memories.length;
  } catch (error) {
    console.error("[memoryIntegration] Extract failed:", error);
    return 0;
  }
};

/**
 * Extracts and saves manual memory from user input with '#' trigger
 *
 * @param userInput - User input text (should start with '#')
 * @param sessionId - Current session ID
 * @param projectPath - Current project path
 * @returns The created memory or null if not a valid trigger
 */
export const extractManualMemoryFromInput = async (
  userInput: string,
  sessionId?: string,
  projectPath?: string
): Promise<QuackMemory | null> => {
  if (!hasManualMemoryTrigger(userInput)) {
    return null;
  }

  try {
    const settings = await getMemorySettings();
    if (!settings.enabled) {
      return null;
    }

    const memory = extractManualMemory(userInput, sessionId, projectPath);
    if (!memory) {
      return null;
    }

    await addMemory(memory);

    // Add to vector store if available
    if (settings.useSemanticSearch && isEmbedderReady()) {
      try {
        await addVector(memory);
      } catch (vectorErr) {
        console.warn("[memoryIntegration] Vector add failed:", vectorErr);
      }
    }

    console.log(`[memoryIntegration] Manual memory saved: ${memory.category}`);
    return memory;
  } catch (error) {
    console.error("[memoryIntegration] Manual memory failed:", error);
    return null;
  }
};

/**
 * Extracts memories from a tool execution
 *
 * Called after significant tool executions (Write, Edit, Bash).
 * Only triggers in 'tool-based' extraction mode.
 *
 * @param tool - Tool execution details
 * @param apiKey - API key for LLM extraction
 * @param sessionId - Current session ID
 * @param projectPath - Current project path
 * @returns Number of memories extracted
 */
export const extractFromToolExecution = async (
  tool: ToolExecution,
  apiKey: string,
  sessionId?: string,
  projectPath?: string
): Promise<number> => {
  try {
    const settings = await getMemorySettings();

    if (!settings.enabled) {
      return 0;
    }

    // Only extract in tool-based or hybrid mode
    if (settings.llmExtractionTrigger !== 'tool-based') {
      return 0;
    }

    // Check if this tool should be tracked
    if (!settings.toolsToTrack.includes(tool.toolName)) {
      return 0;
    }

    const memories = await extractMemoriesFromTool(
      tool,
      apiKey,
      sessionId,
      projectPath
    );

    if (memories.length === 0) {
      return 0;
    }

    await saveMemories(memories, settings.useSemanticSearch);

    console.log(
      `[memoryIntegration] Extracted ${memories.length} memories from tool: ${tool.toolName}`
    );
    return memories.length;
  } catch (error) {
    console.error("[memoryIntegration] Tool extraction failed:", error);
    return 0;
  }
};

/**
 * Analyzes current session and extracts summary memories
 *
 * Called on-demand when user clicks "Analyze Session" button.
 *
 * @param messages - Conversation messages
 * @param apiKey - API key for LLM extraction
 * @param sessionId - Current session ID
 * @param projectPath - Current project path
 * @returns Number of memories extracted
 */
export const analyzeCurrentSession = async (
  messages: Array<{ role: string; content: string }>,
  apiKey: string,
  sessionId?: string,
  projectPath?: string
): Promise<number> => {
  try {
    const settings = await getMemorySettings();

    if (!settings.enabled) {
      return 0;
    }

    const memories = await analyzeSessionLLM(
      messages,
      apiKey,
      sessionId,
      projectPath
    );

    if (memories.length === 0) {
      return 0;
    }

    await saveMemories(memories, settings.useSemanticSearch);

    console.log(
      `[memoryIntegration] Session analysis extracted ${memories.length} memories`
    );
    return memories.length;
  } catch (error) {
    console.error("[memoryIntegration] Session analysis failed:", error);
    return 0;
  }
};

/**
 * Helper: Saves an array of memories
 */
const saveMemories = async (
  memories: QuackMemory[],
  useSemanticSearch: boolean
): Promise<void> => {
  const savePromises = memories.map(async (memory: QuackMemory) => {
    try {
      await addMemory(memory);

      if (useSemanticSearch && isEmbedderReady()) {
        try {
          await addVector(memory);
        } catch (vectorErr) {
          console.warn("[memoryIntegration] Vector add failed:", vectorErr);
        }
      }
    } catch (err) {
      console.error("[memoryIntegration] Save memory failed:", err);
    }
  });

  await Promise.all(savePromises);
};

/**
 * Helper: Deduplicates memories by content similarity
 */
const deduplicateMemories = (memories: QuackMemory[]): QuackMemory[] => {
  return memories.filter(
    (memory, index, self) =>
      index === self.findIndex((m) => m.content === memory.content)
  );
};

/**
 * Gets memory context for injection into system prompt
 *
 * Called before sending a message to Claude.
 * Returns formatted memory context based on current conversation.
 *
 * @param userMessage - Current user message
 * @param projectPath - Current project path (optional)
 * @returns Formatted memory context string or empty
 *
 * @example
 * ```typescript
 * const memoryContext = await getMemoryContext(
 *   "Help me with TypeScript",
 *   "/path/to/project"
 * );
 * if (memoryContext) {
 *   systemPrompt += memoryContext;
 * }
 * ```
 */
export const getMemoryContext = async (
  userMessage: string,
  projectPath?: string
): Promise<string> => {
  try {
    const settings = await getMemorySettings();
    if (!settings.enabled) {
      return "";
    }

    return getMemorySystemPrompt(userMessage, projectPath);
  } catch (error) {
    console.error("[memoryIntegration] Get context failed:", error);
    return "";
  }
};

/**
 * Checks if the memory system is ready
 */
export const isMemorySystemReady = (): boolean => {
  return isInitialized;
};

/**
 * Gets the current memory system status
 */
export const getMemorySystemStatus = async (): Promise<{
  enabled: boolean;
  initialized: boolean;
  semanticSearchReady: boolean;
}> => {
  const settings = await getMemorySettings();
  return {
    enabled: settings.enabled,
    initialized: isInitialized,
    semanticSearchReady: isEmbedderReady(),
  };
};
