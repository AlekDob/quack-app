/**
 * LLM-based Memory Extractor Service
 *
 * Uses Claude to semantically extract memories from conversations.
 * Works with any language and captures nuanced information that
 * pattern-based extraction might miss.
 *
 * Inspired by Claude-Mem's observation system.
 *
 * @module services/memoryLLMExtractor
 */

import Anthropic from "@anthropic-ai/sdk";
import { toast } from "sonner";
import type {
  QuackMemory,
  MemoryCategory,
  MemoryConfidence,
} from "../types/memory";
import { generateMemoryId, extractKeywords } from "./memoryExtractor";

/**
 * LLM extraction result
 */
interface LLMExtractionResult {
  content: string;
  category: MemoryCategory;
  confidence: MemoryConfidence;
  isProjectSpecific: boolean;
}

/**
 * Tool execution info for tool-based extraction
 */
export interface ToolExecution {
  toolName: string;
  toolInput: Record<string, unknown>;
  toolOutput: string;
  timestamp: number;
  workingDirectory?: string;
}

/**
 * Prompt for extracting memories from AI responses
 */
const RESPONSE_EXTRACTION_PROMPT = `You are a memory extraction assistant. Analyze the following AI response and extract any memorable information worth saving for future sessions.

Categories:
- preference: User preferences and working style
- fact: Project technical facts and details
- decision: Architectural/design decisions made
- pattern: Code patterns and conventions to follow
- mistake: Lessons learned, things to avoid
- context: Background information and goals

Return a JSON array of memories found. Each memory should have:
- content: Clear, concise description of what to remember (in the same language as the input)
- category: One of the categories above
- confidence: "high", "medium", or "low"
- isProjectSpecific: true if specific to current project, false if general

If no memorable information found, return: { "memories": [] }

IMPORTANT:
- Extract ACTIONABLE information, not generic statements
- Keep content concise but complete
- Preserve the original language of the content
- Skip greetings, acknowledgments, and routine responses

AI Response to analyze:
`;

/**
 * Prompt for extracting memories from tool executions
 */
const TOOL_EXTRACTION_PROMPT = `You are observing a development session. Analyze this tool execution and extract any learnings worth remembering.

Focus on:
- What was built, fixed, or configured
- Technical decisions made
- Patterns established
- Gotchas or issues encountered

Categories:
- preference: User preferences and working style
- fact: Project technical facts and details
- decision: Architectural/design decisions made
- pattern: Code patterns and conventions to follow
- mistake: Lessons learned, things to avoid
- context: Background information and goals

Return a JSON object:
{
  "memories": [
    {
      "content": "what was learned/built/fixed",
      "category": "category",
      "confidence": "high|medium|low",
      "isProjectSpecific": true|false
    }
  ]
}

If nothing worth remembering, return: { "memories": [] }

Tool Execution:
`;

/**
 * Extracts memories from AI response using Claude
 *
 * @param response - AI response text to analyze
 * @param apiKey - Anthropic API key
 * @param sessionId - Current session ID
 * @param projectPath - Current project path
 * @returns Array of extracted QuackMemory objects
 */
export const extractMemoriesWithLLM = async (
  response: string,
  apiKey: string,
  sessionId?: string,
  projectPath?: string
): Promise<QuackMemory[]> => {
  if (!apiKey) {
    console.warn("[memoryLLMExtractor] No API key provided, skipping LLM extraction");
    return [];
  }

  // Skip very short or empty responses
  if (!response || response.trim().length < 50) {
    return [];
  }

  try {
    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `${RESPONSE_EXTRACTION_PROMPT}

"${response.substring(0, 4000)}"`, // Limit input size
        },
      ],
    });

    // Extract text from response
    const textContent = message.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      return [];
    }

    // Parse JSON response
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("[memoryLLMExtractor] No JSON found in response");
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]) as { memories: LLMExtractionResult[] };

    if (!parsed.memories || !Array.isArray(parsed.memories)) {
      return [];
    }

    // Convert to QuackMemory objects
    const now = Date.now();
    const memories: QuackMemory[] = parsed.memories
      .filter((m) => m.content && m.category)
      .map((m) => ({
        id: generateMemoryId(),
        content: m.content,
        category: m.category,
        confidence: m.confidence || "medium",
        scope: m.isProjectSpecific ? "project" : "global",
        keywords: extractKeywords(m.content),
        projectPath: m.isProjectSpecific ? projectPath : undefined,
        sourceSessionId: sessionId,
        createdAt: now,
        lastAccessedAt: now,
        accessCount: 0,
        isArchived: false,
      } as QuackMemory));

    console.log(`[memoryLLMExtractor] Extracted ${memories.length} memories via LLM`);
    return memories;
  } catch (error) {
    console.error("[memoryLLMExtractor] Extraction failed:", error);
    // Don't show toast for extraction failures - it's not critical
    return [];
  }
};

/**
 * Extracts memories from a tool execution using Claude
 *
 * @param tool - Tool execution details
 * @param apiKey - Anthropic API key
 * @param sessionId - Current session ID
 * @param projectPath - Current project path
 * @returns Array of extracted QuackMemory objects
 */
export const extractMemoriesFromTool = async (
  tool: ToolExecution,
  apiKey: string,
  sessionId?: string,
  projectPath?: string
): Promise<QuackMemory[]> => {
  if (!apiKey) {
    console.warn("[memoryLLMExtractor] No API key provided, skipping tool extraction");
    return [];
  }

  // Skip simple tools that rarely have memorable info
  const skipTools = ["Read", "Glob", "Grep", "ListMcpResourcesTool"];
  if (skipTools.includes(tool.toolName)) {
    return [];
  }

  try {
    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

    const toolContext = `
Tool: ${tool.toolName}
Working Directory: ${tool.workingDirectory || "unknown"}
Input: ${JSON.stringify(tool.toolInput, null, 2).substring(0, 1000)}
Output: ${tool.toolOutput.substring(0, 2000)}
`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `${TOOL_EXTRACTION_PROMPT}

${toolContext}`,
        },
      ],
    });

    // Extract text from response
    const textContent = message.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      return [];
    }

    // Parse JSON response
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]) as { memories: LLMExtractionResult[] };

    if (!parsed.memories || !Array.isArray(parsed.memories)) {
      return [];
    }

    // Convert to QuackMemory objects
    const now = Date.now();
    const memories: QuackMemory[] = parsed.memories
      .filter((m) => m.content && m.category)
      .map((m) => ({
        id: generateMemoryId(),
        content: m.content,
        category: m.category,
        confidence: m.confidence || "medium",
        scope: m.isProjectSpecific ? "project" : "global",
        keywords: extractKeywords(m.content),
        projectPath: m.isProjectSpecific ? projectPath : undefined,
        sourceSessionId: sessionId,
        createdAt: now,
        lastAccessedAt: now,
        accessCount: 0,
        isArchived: false,
      } as QuackMemory));

    console.log(`[memoryLLMExtractor] Extracted ${memories.length} memories from tool: ${tool.toolName}`);
    return memories;
  } catch (error) {
    console.error("[memoryLLMExtractor] Tool extraction failed:", error);
    return [];
  }
};

/**
 * Analyzes a full session and extracts summary memories
 *
 * Called when session ends or user requests analysis
 *
 * @param messages - Array of conversation messages
 * @param apiKey - Anthropic API key
 * @param sessionId - Session ID
 * @param projectPath - Project path
 * @returns Array of extracted QuackMemory objects
 */
export const analyzeSession = async (
  messages: Array<{ role: string; content: string }>,
  apiKey: string,
  sessionId?: string,
  projectPath?: string
): Promise<QuackMemory[]> => {
  if (!apiKey) {
    toast.error("API key required for session analysis");
    return [];
  }

  if (messages.length < 2) {
    toast.error("Not enough messages to analyze");
    return [];
  }

  try {
    toast.info("Analyzing session...");

    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

    // Create conversation summary
    const conversationSummary = messages
      .slice(-20) // Last 20 messages
      .map((m) => `${m.role.toUpperCase()}: ${m.content.substring(0, 500)}`)
      .join("\n\n");

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: `Analyze this conversation and extract the most important memories to save for future sessions.

Categories:
- preference: User preferences and working style
- fact: Project technical facts and details
- decision: Architectural/design decisions made
- pattern: Code patterns and conventions to follow
- mistake: Lessons learned, things to avoid
- context: Background information and goals

Return a JSON object with up to 10 most important memories:
{
  "memories": [
    {
      "content": "clear description",
      "category": "category",
      "confidence": "high|medium|low",
      "isProjectSpecific": true|false
    }
  ],
  "sessionSummary": "Brief 1-2 sentence summary of what was accomplished"
}

Conversation:
${conversationSummary}`,
        },
      ],
    });

    // Extract text from response
    const textContent = message.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      toast.error("Failed to analyze session");
      return [];
    }

    // Parse JSON response
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      toast.error("Invalid analysis response");
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      memories: LLMExtractionResult[];
      sessionSummary?: string;
    };

    if (parsed.sessionSummary) {
      toast.success(`Analysis complete: ${parsed.sessionSummary}`);
    }

    if (!parsed.memories || !Array.isArray(parsed.memories)) {
      return [];
    }

    // Convert to QuackMemory objects
    const now = Date.now();
    const memories: QuackMemory[] = parsed.memories
      .filter((m) => m.content && m.category)
      .map((m) => ({
        id: generateMemoryId(),
        content: m.content,
        category: m.category,
        confidence: m.confidence || "medium",
        scope: m.isProjectSpecific ? "project" : "global",
        keywords: extractKeywords(m.content),
        projectPath: m.isProjectSpecific ? projectPath : undefined,
        sourceSessionId: sessionId,
        createdAt: now,
        lastAccessedAt: now,
        accessCount: 0,
        isArchived: false,
      } as QuackMemory));

    console.log(`[memoryLLMExtractor] Session analysis extracted ${memories.length} memories`);
    return memories;
  } catch (error) {
    console.error("[memoryLLMExtractor] Session analysis failed:", error);
    toast.error("Session analysis failed");
    return [];
  }
};
