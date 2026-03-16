/**
 * Conversation Recovery Service
 *
 * Handles recovery from "Prompt is too long" errors and provides
 * local conversation management when SDK compact fails.
 *
 * Features:
 * - Token budget tracking and warnings
 * - Local soft reset (keeps recent messages + summary)
 * - Hard reset (complete clear with export option)
 * - Conversation export to markdown
 */

import type { ChatMessage } from '../types';

// Token limits for different models
// Default 200k for all Claude models; Opus 4.6 and Sonnet 4.6 support up to 1M (GA March 2026)
// The actual context window is provided by SDK modelUsage.contextWindow at runtime
export const TOKEN_LIMITS: Record<string, number> = {
  opus: 200000,
  sonnet: 200000,
  haiku: 200000,
};

// Estimated overhead costs (fallback when no cache data available)
// These are used only before the first message establishes the cache
export const ESTIMATED_OVERHEAD = {
  system: 17900,   // System prompt, CLAUDE.md, instructions
  memory: 5900,    // Memory MCP context
  mcpTools: 2700,  // MCP tool definitions
  get total() { return this.system + this.memory + this.mcpTools; }
};

// Alias for backward compatibility
export const FIXED_OVERHEAD = ESTIMATED_OVERHEAD;
export const TOTAL_OVERHEAD = ESTIMATED_OVERHEAD.total;

/**
 * Calculate dynamic overhead using real cache data from SDK
 * @param cacheCreationTokens - tokens used to create cache (first message)
 * @param cacheReadTokens - tokens read from cache (subsequent messages)
 * @returns The real overhead if available, otherwise estimated
 */
export function calculateDynamicOverhead(
  cacheCreationTokens: number = 0,
  cacheReadTokens: number = 0
): { overhead: number; source: 'cache' | 'estimated' } {
  if (cacheCreationTokens > 0) {
    return { overhead: cacheCreationTokens, source: 'cache' };
  }
  if (cacheReadTokens > 0) {
    return { overhead: cacheReadTokens, source: 'cache' };
  }
  return { overhead: ESTIMATED_OVERHEAD.total, source: 'estimated' };
}

// Warning thresholds (percentage of max tokens)
export const TOKEN_THRESHOLDS = {
  INFO: 50,      // 50% - Informational
  WARNING: 70,   // 70% - Consider compact
  DANGER: 85,    // 85% - Auto-compact recommended
  CRITICAL: 95,  // 95% - Block new messages
} as const;

export type TokenWarningLevel = 'ok' | 'info' | 'warning' | 'danger' | 'critical' | 'blocked';

export interface TokenBudgetStatus {
  level: TokenWarningLevel;
  percentage: number;
  usedTokens: number;
  remainingTokens: number;
  maxTokens: number;
  message: string;
  action?: 'compact' | 'clear' | 'block';
  canSendMessage: boolean;
}

/**
 * Calculate current token budget status
 */
export function calculateTokenBudget(
  inputTokens: number,
  outputTokens: number,
  model: string = 'opus',
  contextWindow?: number // SDK-provided context window (200k or 1M)
): TokenBudgetStatus {
  const maxTokens = contextWindow ?? TOKEN_LIMITS[model] ?? 200000;
  const messageTokens = inputTokens + outputTokens;
  const totalUsed = messageTokens + TOTAL_OVERHEAD;
  const percentage = (totalUsed / maxTokens) * 100;
  const remaining = Math.max(0, maxTokens - totalUsed);

  // Determine warning level and action
  let level: TokenWarningLevel;
  let message: string;
  let action: TokenBudgetStatus['action'];
  let canSendMessage = true;

  if (percentage >= 100) {
    level = 'blocked';
    message = 'Token limit exceeded! Cannot send new messages. Please clear the conversation.';
    action = 'clear';
    canSendMessage = false;
  } else if (percentage >= TOKEN_THRESHOLDS.CRITICAL) {
    level = 'critical';
    message = 'Critical: Almost at token limit! Use /compact now or clear conversation.';
    action = 'compact';
    canSendMessage = true; // Still allow, but warn
  } else if (percentage >= TOKEN_THRESHOLDS.DANGER) {
    level = 'danger';
    message = 'High token usage. Consider using /compact to free up space.';
    action = 'compact';
  } else if (percentage >= TOKEN_THRESHOLDS.WARNING) {
    level = 'warning';
    message = 'Token usage is getting high. /compact available when needed.';
  } else if (percentage >= TOKEN_THRESHOLDS.INFO) {
    level = 'info';
    message = 'Conversation is progressing normally.';
  } else {
    level = 'ok';
    message = 'Plenty of token budget remaining.';
  }

  return {
    level,
    percentage,
    usedTokens: totalUsed,
    remainingTokens: remaining,
    maxTokens,
    message,
    action,
    canSendMessage,
  };
}

/**
 * Create a local summary of messages (when SDK compact fails)
 * This is a simple summarization - just extracts key info
 */
export function createLocalSummary(messages: ChatMessage[]): string {
  if (messages.length === 0) return '';

  const summaryParts: string[] = [];

  // Extract key information from messages
  const userMessages = messages.filter(m => m.role === 'user');
  const assistantMessages = messages.filter(m => m.role === 'assistant');

  // Get topics discussed (first 50 chars of each user message)
  const topics = userMessages
    .map(m => m.content.substring(0, 100).trim())
    .filter(t => t.length > 0)
    .slice(0, 5); // Keep only first 5 topics

  if (topics.length > 0) {
    summaryParts.push('**Topics discussed:**');
    topics.forEach((topic, i) => {
      summaryParts.push(`${i + 1}. ${topic}${topic.length >= 100 ? '...' : ''}`);
    });
  }

  // Extract any code blocks from assistant messages
  const codeBlocks: string[] = [];
  assistantMessages.forEach(msg => {
    const codeMatches = msg.content.match(/```[\s\S]*?```/g);
    if (codeMatches) {
      codeBlocks.push(...codeMatches.slice(0, 2)); // Keep max 2 code blocks per message
    }
  });

  if (codeBlocks.length > 0) {
    summaryParts.push('\n**Key code snippets preserved:**');
    summaryParts.push(...codeBlocks.slice(0, 3)); // Keep max 3 code blocks total
  }

  // Add message count info
  summaryParts.push(`\n*[Summary of ${messages.length} messages - ${userMessages.length} from user, ${assistantMessages.length} from assistant]*`);

  return summaryParts.join('\n');
}

/**
 * Perform a soft reset - keeps recent messages and adds a summary of older ones
 * This is a LOCAL operation when SDK /compact fails
 */
export function performSoftReset(
  messages: ChatMessage[],
  keepCount: number = 10
): ChatMessage[] {
  if (messages.length <= keepCount) {
    return messages; // Nothing to summarize
  }

  // Split messages: older ones to summarize, recent ones to keep
  const oldMessages = messages.slice(0, -keepCount);
  const recentMessages = messages.slice(-keepCount);

  // Create summary of old messages
  const summary = createLocalSummary(oldMessages);

  // Create summary message
  const summaryMessage: ChatMessage = {
    id: `msg-summary-${Date.now()}`,
    role: 'system',
    content: `**[Previous Conversation Summary]**\n\n${summary}\n\n---\n*This summary was created locally because the conversation was too long. Recent messages are preserved below.*`,
    timestamp: Date.now(),
    status: 'complete',
  };

  return [summaryMessage, ...recentMessages];
}

/**
 * Export conversation to markdown format
 */
export function exportConversationToMarkdown(
  messages: ChatMessage[],
  metadata?: {
    sessionId?: string;
    model?: string;
    projectPath?: string;
  }
): string {
  const lines: string[] = [];

  // Header
  lines.push('# Quack Conversation Export');
  lines.push('');
  lines.push(`**Exported:** ${new Date().toISOString()}`);
  if (metadata?.sessionId) lines.push(`**Session ID:** ${metadata.sessionId}`);
  if (metadata?.model) lines.push(`**Model:** ${metadata.model}`);
  if (metadata?.projectPath) lines.push(`**Project:** ${metadata.projectPath}`);
  lines.push(`**Total Messages:** ${messages.length}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Messages
  messages.forEach((msg, index) => {
    const roleEmoji = msg.role === 'user' ? '👤' : msg.role === 'assistant' ? '🤖' : '⚙️';
    const roleName = msg.role.charAt(0).toUpperCase() + msg.role.slice(1);
    const timestamp = new Date(msg.timestamp).toLocaleString();

    lines.push(`## ${roleEmoji} ${roleName} (${timestamp})`);
    lines.push('');
    lines.push(msg.content);
    lines.push('');

    if (index < messages.length - 1) {
      lines.push('---');
      lines.push('');
    }
  });

  return lines.join('\n');
}

/**
 * Save conversation export to a file (via download)
 */
export function downloadConversationExport(
  messages: ChatMessage[],
  filename?: string,
  metadata?: {
    sessionId?: string;
    model?: string;
    projectPath?: string;
  }
): void {
  const markdown = exportConversationToMarkdown(messages, metadata);
  const blob = new Blob([markdown], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);

  const defaultFilename = `quack-conversation-${new Date().toISOString().split('T')[0]}.md`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename || defaultFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Check if conversation should be blocked due to token limit
 */
export function shouldBlockMessage(
  inputTokens: number,
  outputTokens: number,
  model: string = 'opus',
  contextWindow?: number
): { blocked: boolean; reason?: string } {
  const status = calculateTokenBudget(inputTokens, outputTokens, model, contextWindow);

  if (!status.canSendMessage) {
    return {
      blocked: true,
      reason: status.message,
    };
  }

  return { blocked: false };
}

/**
 * Get recommended action based on token usage
 */
export function getRecommendedAction(
  inputTokens: number,
  outputTokens: number,
  model: string = 'opus',
  contextWindow?: number
): {
  action: 'none' | 'suggest_compact' | 'recommend_compact' | 'force_clear';
  message: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
} {
  const status = calculateTokenBudget(inputTokens, outputTokens, model, contextWindow);

  if (status.level === 'blocked') {
    return {
      action: 'force_clear',
      message: 'Token limit exceeded. Please clear the conversation to continue.',
      urgency: 'critical',
    };
  }

  if (status.level === 'critical') {
    return {
      action: 'recommend_compact',
      message: 'Almost at token limit! Use /compact now to avoid losing your conversation.',
      urgency: 'critical',
    };
  }

  if (status.level === 'danger') {
    return {
      action: 'recommend_compact',
      message: 'High token usage. Consider using /compact to free up space.',
      urgency: 'high',
    };
  }

  if (status.level === 'warning') {
    return {
      action: 'suggest_compact',
      message: 'Token usage is getting high. /compact is available when needed.',
      urgency: 'medium',
    };
  }

  return {
    action: 'none',
    message: 'Token budget is healthy.',
    urgency: 'low',
  };
}

/**
 * Estimate tokens for a message (rough approximation)
 * ~4 characters per token is a common estimate
 * @param textOrLength - The text content or its character length
 */
export function estimateTokens(textOrLength: string | number): number {
  const length = typeof textOrLength === 'string' ? textOrLength.length : textOrLength;
  return Math.ceil(length / 4);
}

/**
 * Check if adding a new message would exceed the limit
 */
export function wouldExceedLimit(
  currentInputTokens: number,
  currentOutputTokens: number,
  newMessageLength: number,
  model: string = 'opus',
  contextWindow?: number
): boolean {
  const estimatedNewTokens = estimateTokens(newMessageLength);
  const futureInputTokens = currentInputTokens + estimatedNewTokens;

  // Estimate response tokens (assume 2x the input as worst case)
  const estimatedResponseTokens = estimatedNewTokens * 2;
  const futureOutputTokens = currentOutputTokens + estimatedResponseTokens;

  const status = calculateTokenBudget(futureInputTokens, futureOutputTokens, model, contextWindow);
  return !status.canSendMessage;
}

/**
 * Project-specific overhead calculation result
 */
export interface ProjectOverhead {
  /** Base system overhead (system prompt, tools) - fixed */
  baseSystem: number;
  /** Tokens from global CLAUDE.md (~/.claude/CLAUDE.md) */
  globalClaudeMd: number;
  /** Tokens from project CLAUDE.md ({cwd}/CLAUDE.md) */
  projectClaudeMd: number;
  /** Tokens from .claude/rules/*.md files */
  rules: number;
  /** Tokens from skill definitions */
  skills: number;
  /** Tokens from MCP server definitions */
  mcpServers: number;
  /** Base memory overhead */
  memoryBase: number;
  /** Total calculated overhead */
  total: number;
  /** Number of MCP servers detected */
  mcpServerCount: number;
  /** Source of the calculation */
  source: 'calculated' | 'fallback';
}

// Brain: gotcha-stamina-overhead-static-estimate
// Base overhead constants (from Claude CLI /context analysis, updated 2026-03-01)
// These are absolute token counts, independent of context window size (200k or 1M)
const BASE_OVERHEAD = {
  systemPrompt: 4000,    // System prompt and instructions
  systemTools: 16500,    // Built-in tool definitions
  memoryBase: 5000,      // Memory files baseline
  skills: 6700,          // Skill definitions loaded into context
  mcpPerServer: 3500,    // ~3.5k tokens per MCP server (tools + descriptions)
};

/**
 * Calculate project-specific overhead based on actual files
 *
 * This function reads CLAUDE.md files and .mcp.json to calculate
 * a more accurate overhead for the specific project.
 *
 * Performance: ~5-10ms (file reads are fast)
 *
 * @param cwd - Current working directory (project path)
 * @param homePath - User home directory path
 * @param readFile - Function to read file content (Tauri invoke)
 * @returns ProjectOverhead with detailed breakdown
 */
export async function calculateProjectOverhead(
  cwd: string,
  homePath: string,
  readFile: (path: string) => Promise<string>
): Promise<ProjectOverhead> {
  try {
    // Parallel file reads for better performance
    const [globalClaudeMdContent, projectClaudeMdContent, mcpConfigContent] = await Promise.all([
      readFile(`${homePath}/.claude/CLAUDE.md`).catch(() => ''),
      readFile(`${cwd}/CLAUDE.md`).catch(() => ''),
      readFile(`${cwd}/.mcp.json`).catch(() => '{}'),
    ]);

    // Calculate tokens from CLAUDE.md files (~4 chars = 1 token)
    const globalClaudeMdTokens = estimateTokens(globalClaudeMdContent);
    const projectClaudeMdTokens = estimateTokens(projectClaudeMdContent);

    // Parse MCP config and count servers
    let mcpServerCount = 0;
    try {
      const mcpConfig = JSON.parse(mcpConfigContent);
      mcpServerCount = Object.keys(mcpConfig.mcpServers || {}).length;
    } catch {
      // Invalid JSON, assume no MCP servers
      mcpServerCount = 0;
    }

    // Calculate MCP overhead
    const mcpTokens = mcpServerCount * BASE_OVERHEAD.mcpPerServer;

    // Calculate total (includes skills estimate)
    const baseSystem = BASE_OVERHEAD.systemPrompt + BASE_OVERHEAD.systemTools;
    const total = baseSystem + globalClaudeMdTokens + projectClaudeMdTokens + mcpTokens + BASE_OVERHEAD.memoryBase + BASE_OVERHEAD.skills;

    return {
      baseSystem,
      globalClaudeMd: globalClaudeMdTokens,
      projectClaudeMd: projectClaudeMdTokens,
      rules: 0, // Static estimate doesn't read rules files — countTokens API provides precision
      skills: BASE_OVERHEAD.skills,
      mcpServers: mcpTokens,
      memoryBase: BASE_OVERHEAD.memoryBase,
      total,
      mcpServerCount,
      source: 'calculated',
    };
  } catch (error) {
    // Fallback to estimated overhead if calculation fails
    console.warn('Failed to calculate project overhead, using fallback:', error);
    return {
      baseSystem: BASE_OVERHEAD.systemPrompt + BASE_OVERHEAD.systemTools,
      globalClaudeMd: 2200,  // Default estimate
      projectClaudeMd: 0,
      rules: 0,
      skills: BASE_OVERHEAD.skills,
      mcpServers: BASE_OVERHEAD.mcpPerServer * 2, // Assume 2 servers
      memoryBase: BASE_OVERHEAD.memoryBase,
      total: ESTIMATED_OVERHEAD.total,
      mcpServerCount: 2,
      source: 'fallback',
    };
  }
}

