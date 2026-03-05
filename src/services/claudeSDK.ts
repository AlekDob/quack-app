// TEMPORARY: Commented out to fix build - Claude SDK should run only in backend
// import { query } from '@anthropic-ai/claude-agent-sdk';
import { invoke } from '@tauri-apps/api/core';
import type { ClaudeEvent, MCPServer, StructuredOutputFormat, EffortLevel, LLMProviderType } from '../types';
import { getModelId, type ModelConfig } from './modelService';
import { useSettingsStore } from '../stores/settingsStore';

/** Get the display-friendly model name for the active provider */
export function getActiveModelName(fallback?: string): string {
  const { provider, ollamaModel } = useSettingsStore.getState().claude;
  if (provider !== 'anthropic') return ollamaModel || provider;
  return fallback || 'opus46';
}

/** Get provider fields for SDK invoke calls */
export function getProviderRequestFields(remoteModels?: ModelConfig[], modelOverride?: string) {
  const { provider, providerBaseUrl, providerApiKey, ollamaModel } = useSettingsStore.getState().claude;
  const isAnthropic = provider === 'anthropic';

  return {
    provider: isAnthropic ? undefined : provider,
    providerBaseUrl: !isAnthropic && providerBaseUrl ? providerBaseUrl : undefined,
    providerApiKey: provider === 'custom' && providerApiKey ? providerApiKey : undefined,
    /** Resolve model: Anthropic uses Supabase mapping, others use ollamaModel */
    resolveModel: (friendlyName: string) => {
      if (!isAnthropic) return modelOverride || ollamaModel || friendlyName;
      return getModelId(friendlyName, remoteModels);
    },
  };
}

interface ClaudeSDKOptions {
  model?: string;
  thinkingMode?: string;
  permissionMode?: 'plan' | 'act' | 'bypass' | 'debug';
  sessionId?: string;
  workingDirectory?: string;
  mcpServers?: Record<string, {
    command: string;
    args: string[];
    env?: Record<string, string>;
  }>;
  signal?: AbortSignal;
  timeout?: number;
  streamId?: string;
  outputFormat?: StructuredOutputFormat;
  effort?: EffortLevel;
  remoteModels?: ModelConfig[]; // Remote model configs from Supabase for ID mapping
}

/**
 * Load enabled MCP servers from the project's .mcp.json file
 */
async function loadMCPServers(workingDir?: string): Promise<Record<string, {
  command: string;
  args: string[];
  env?: Record<string, string>;
}> | undefined> {
  try {
    const servers = await invoke<MCPServer[]>('list_mcp_servers', {
      workingDir: workingDir || null,
    });

    // Filter only enabled servers and convert to SDK format
    const enabledServers = servers.filter(server => server.enabled);

    if (enabledServers.length === 0) {
      return undefined;
    }

    const mcpServers: Record<string, {
      command: string;
      args: string[];
      env?: Record<string, string>;
    }> = {};

    enabledServers.forEach(server => {
      // Only include servers with valid command and args
      if (server.command && server.args) {
        mcpServers[server.id] = {
          command: server.command,
          args: server.args,
          env: server.env,
        };
      }
    });

    return mcpServers;
  } catch (error) {
    return undefined;
  }
}

interface ClaudeSDKStreamEvent {
  type: 'event' | 'complete' | 'error';
  event?: ClaudeEvent;
  error?: string;
  result?: {
    text: string;
    usage: {
      input_tokens: number;
      output_tokens: number;
    };
  };
}

// Session isolation: Track active streams per session to prevent conflicts
const activeStreams = new Map<string, AbortController>();

// Event deduplication: Track seen event IDs to prevent duplicates
const seenEventIds = new Map<string, Set<string>>(); // sessionKey -> Set of event IDs

/**
 * 🦆 FIX: Generate a STABLE unique event ID from an event object
 * This ID must be consistent across multiple calls for the same logical event
 */
function generateEventId(event: any, eventType: string): string {
  // For assistant events: prioritize message.id, fallback to content hash
  if (event.message?.id) {
    return `${eventType}-${event.message.id}`;
  }

  // For system events: use subtype only (session_id might not exist initially)
  if (eventType === 'system' && event.subtype) {
    return `${eventType}-${event.subtype}`;
  }

  // For result events: use session_id if available
  if (eventType === 'result' && event.session_id) {
    return `${eventType}-${event.session_id}`;
  }

  // For events with content: hash the actual content, not the wrapper
  // 🦆 FIX: Include tool_use.id for unique identification of Task tool invocations
  if (event.message?.content) {
    const contentHash = Array.isArray(event.message.content)
      ? event.message.content.map((block: any) => {
          let id = `${block.type}-${block.text?.substring(0, 20) || block.name || ''}`;
          // Include tool_use.id to ensure unique IDs for each tool invocation
          // This fixes the bug where multiple Task tools (droids) got the same ID
          if (block.type === 'tool_use' && block.id) {
            id += `-${block.id}`;
          }
          return id;
        }).join('|')
      : JSON.stringify(event.message.content);
    return `${eventType}-${hashString(contentHash)}`;
  }

  // Fallback: hash the entire event structure
  const contentHash = JSON.stringify({
    type: eventType,
    content: event.message?.content,
    result: event.result,
    error: event.error,
    subtype: event.subtype,
  });

  return `${eventType}-${hashString(contentHash)}`;
}

/**
 * Simple string hash function for event deduplication
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Send a message to Claude using the official Claude Agent SDK
 * with real-time streaming support and proper session isolation
 *
 * IMPORTANT: Fixed to support multiple concurrent sessions without blocking
 */
export async function* streamClaudeMessage(
  prompt: string,
  options: ClaudeSDKOptions = {}
): AsyncGenerator<ClaudeSDKStreamEvent> {
  const startTime = Date.now();
  // Generate stream ID with better entropy if not provided
  const streamId = options.streamId || `stream-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${performance.now().toString(36).substr(2, 6)}`;
  const timeout = options.timeout || 5 * 60 * 1000; // Default: 5 minutes

  // 🦆 FIX: Use streamId as STABLE session key for event deduplication
  // This ensures seenEventIds tracking remains consistent even if sessionId changes during stream
  const sessionKey = streamId;

  console.log(`[claudeSDK:${streamId}] Starting stream for session: ${sessionKey} (resuming: ${options.sessionId || 'new'}) with timeout: ${timeout}ms`);

  // Cancel any existing stream for this session
  const existingController = activeStreams.get(sessionKey);
  if (existingController) {
    console.warn(`[claudeSDK:${streamId}] Cancelling existing stream for session: ${sessionKey}`);
    existingController.abort();
    activeStreams.delete(sessionKey);
  }

  // Initialize event tracking for this session
  if (!seenEventIds.has(sessionKey)) {
    seenEventIds.set(sessionKey, new Set());
    console.log(`[claudeSDK:${streamId}] Initialized event tracking for session: ${sessionKey}`);
  }

  // Create new abort controller for this session
  const sessionAbortController = new AbortController();
  activeStreams.set(sessionKey, sessionAbortController);

  // Combine user abort signal with session abort signal
  const combinedSignal = options.signal
    ? AbortSignal.any([options.signal, sessionAbortController.signal])
    : sessionAbortController.signal;

  // Create timeout promise
  const timeoutPromise = new Promise<never>((_, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Stream timeout after ${timeout}ms`));
    }, timeout);

    // Clear timeout if signal is aborted
    combinedSignal.addEventListener('abort', () => {
      clearTimeout(timer);
    });
  });

  try {
    const {
      model = 'opus',
      thinkingMode,
      permissionMode = 'act',
      sessionId,
      workingDirectory,
    } = options;

    // Map permission mode to SDK permission mode
    // SDK accepts: undefined (auto-approve), 'plan' (planning only), 'bypassPermissions' (no confirmations)
    // Brain: pattern-permission-modes
    const sdkPermissionMode =
      permissionMode === 'bypass' || permissionMode === 'debug'
        ? 'bypassPermissions'
        : permissionMode === 'plan'
          ? 'plan'
          : undefined; // 'act' mode = undefined = auto-approve in SDK

    // Load MCP servers from .mcp.json (if not explicitly provided)
    let mcpServers = options.mcpServers;
    if (!mcpServers) {
      mcpServers = await loadMCPServers(workingDirectory);
    }

    // Build options object - SDK expects { prompt, options }
    // getModelId resolves friendly name to full API model ID via modelService
    // Pass remoteModels from options to enable Supabase-configured models
    const modelId = getModelId(model, options.remoteModels);
    console.log(`[claudeSDK:${streamId}] 🔍 MODEL DEBUG - Input: "${model}" → Mapped to: "${modelId}"`);
    console.log(`[claudeSDK:${streamId}] 🔍 MODEL DEBUG - remoteModels available:`, options.remoteModels?.length ?? 'none');
    console.log(`[claudeSDK:${streamId}] 🔍 MODEL DEBUG - typeof modelId:`, typeof modelId);

    const sdkOptions: any = {
      model: modelId, // Map friendly name to API model ID
      permissionMode: sdkPermissionMode,
      // Enable automatic reading of CLAUDE.md, slash commands, and project settings
      settingSources: ['project', 'user', 'local'],
      // 🎯 Enable Skills + all standard tools for full SDK capabilities
      // Skills require explicit "Skill" in allowedTools to be loaded and invoked
      // See: https://platform.claude.com/docs/en/agent-sdk/skills
      allowedTools: [
        'Skill',        // 🔑 Required to enable Skills from .claude/skills/
        'Task',         // Subagents
        'Read',
        'Write',
        'Edit',
        'Bash',
        'Glob',
        'Grep',
        'WebFetch',
        'WebSearch',
        'TodoWrite',
        'NotebookEdit',
        'SlashCommand',
        'AskUserQuestion', // 🗣️ Interactive questions to user (SDK v0.1.71+)
      ],
    };

    console.log(`[claudeSDK:${streamId}] 🔍 MODEL DEBUG - sdkOptions.model AFTER assignment:`, sdkOptions.model);
    console.log(`[claudeSDK:${streamId}] 🔍 MODEL DEBUG - Full sdkOptions object:`, JSON.stringify(sdkOptions, null, 2));

    // Map thinkingMode to new SDK thinking config (SDK 0.2.48+)
    // Brain: sdk-thinking-mode-migration
    if (thinkingMode === 'disabled') {
      sdkOptions.thinking = { type: 'disabled' };
    } else if (thinkingMode && thinkingMode !== 'auto') {
      sdkOptions.thinking = { type: 'adaptive' };
    }

    if (sessionId) {
      sdkOptions.resume = sessionId;
    }

    if (workingDirectory) {
      sdkOptions.cwd = workingDirectory;
    }

    // Add MCP servers if available
    if (mcpServers && Object.keys(mcpServers).length > 0) {
      sdkOptions.mcpServers = mcpServers;
    }

    // TEMPORARY: Throw error instead of calling SDK directly
    // TODO: Refactor to use Tauri backend (stream-claude.js) instead
    throw new Error('Claude SDK should be called via Tauri backend, not directly from frontend');

    /*
    // Call Claude SDK with streaming - correct API: query({ prompt, options })
    const stream = query({
      prompt,
      options: sdkOptions,
    });

    // Track all events for final result
    const events: ClaudeEvent[] = [];
    let finalResult: string | null = null;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    // Stream events with timeout protection
    const streamIterator = stream[Symbol.asyncIterator]();
    let lastEventTime = Date.now();
    let eventCount = 0;

    while (true) {
      // Check if aborted before processing
      if (combinedSignal.aborted) {
        console.log(`[claudeSDK:${streamId}] Stream aborted before event ${eventCount + 1}`);
        break;
      }

      // Race between next event and timeout
      let result;
      try {
        const nextEventPromise = streamIterator.next();
        result = await Promise.race([
          nextEventPromise,
          timeoutPromise,
        ]);
      } catch (error) {
        if (error instanceof Error && error.message?.includes('timeout')) {
          console.error(`[claudeSDK:${streamId}] Stream timeout after ${eventCount} events, last event ${Date.now() - lastEventTime}ms ago`);
        }
        throw error;
      }

      // Check if stream is done
      if (result.done) {
        console.log(`[claudeSDK:${streamId}] Stream completed after ${eventCount} events in ${Date.now() - startTime}ms`);
        break;
      }

      const event = result.value;
      lastEventTime = Date.now();
      eventCount++;

      // Convert SDK event to our ClaudeEvent format
      const claudeEvent = convertSDKEventToClaudeEvent(event);

      if (claudeEvent) {
        // 🦆 DEDUPLICATION: Generate unique event ID and check if we've seen it before
        const eventId = generateEventId(event, claudeEvent.type);
        const sessionEvents = seenEventIds.get(sessionKey);

        if (sessionEvents && sessionEvents.has(eventId)) {
          console.warn(`[claudeSDK:${streamId}] 🦆 DUPLICATE EVENT DETECTED AND SKIPPED - Event ID: ${eventId.substring(0, 20)}... Type: ${claudeEvent.type}`);
          continue; // Skip this duplicate event
        }

        // Mark this event as seen
        if (sessionEvents) {
          sessionEvents.add(eventId);
        }

        events.push(claudeEvent);

        // Log significant events with event ID
        if (claudeEvent.type === 'system') {
          console.log(`[claudeSDK:${streamId}] System event - session: ${claudeEvent.session_id} [${eventId.substring(0, 12)}...]`);
        } else if (claudeEvent.type === 'assistant' && claudeEvent.message?.content) {
          const hasToolUse = claudeEvent.message.content.some(b => b.type === 'tool_use');
          console.log(`[claudeSDK:${streamId}] Assistant event - ${claudeEvent.message.content.length} blocks${hasToolUse ? ' (includes tool use)' : ''} [${eventId.substring(0, 12)}...]`);
        }

        // Emit the event
        yield {
          type: 'event',
          event: claudeEvent,
        };

        // Track usage from result event
        if (claudeEvent.type === 'result') {
          finalResult = claudeEvent.result || '';
          if (claudeEvent.usage) {
            totalInputTokens = claudeEvent.usage.input_tokens;
            totalOutputTokens = claudeEvent.usage.output_tokens;
          }
          console.log(`[claudeSDK:${streamId}] Result event - tokens: ${totalInputTokens}/${totalOutputTokens}, cost: $${claudeEvent.total_cost_usd || 0}`);
        }
      }
    }

    // Emit completion event
    yield {
      type: 'complete',
      result: {
        text: finalResult || '',
        usage: {
          input_tokens: totalInputTokens,
          output_tokens: totalOutputTokens,
        },
      },
    };
    */
  } catch (error) {
    const duration = Date.now() - startTime;
    const isTimeout = error instanceof Error && error.message.includes('timeout');
    const isAborted = combinedSignal.aborted;

    // Enhanced error logging with more details
    console.error(`[claudeSDK:${streamId}] ❌ Error after ${duration}ms (aborted: ${isAborted}):`, error);

    // Log additional error details if available
    if (error instanceof Error) {
      console.error(`[claudeSDK:${streamId}] Error name: ${error.name}`);
      console.error(`[claudeSDK:${streamId}] Error message: ${error.message}`);
      if (error.stack) {
        console.error(`[claudeSDK:${streamId}] Error stack:`, error.stack);
      }

      // Log specific error causes
      if (error.message.includes('exit status: 1')) {
        console.error(`[claudeSDK:${streamId}] 🦆 SDK process crashed - possible causes:`);
        console.error(`  - Invalid or expired Anthropic API key`);
        console.error(`  - Rate limit exceeded (429)`);
        console.error(`  - Authentication failure (401)`);
        console.error(`  - Corrupted CLAUDE.md or .mcp.json file`);
        console.error(`  - Working directory permissions issue`);
        console.error(`  - Insufficient memory or CPU resources`);
        console.error(`  - MCP server initialization failure`);
      }
    }

    yield {
      type: 'error',
      error: error instanceof Error
        ? (isTimeout ? `Stream timeout after ${Math.floor(duration / 1000)}s - the request took too long to complete`
          : isAborted ? 'Stream cancelled by user'
          : error.message)
        : 'Unknown error',
    };
  } finally {
    const duration = Date.now() - startTime;
    console.log(`[claudeSDK:${streamId}] Stream ended after ${duration}ms for session: ${sessionKey}`);

    // Clean up active stream for this session
    activeStreams.delete(sessionKey);

    // Clean up event tracking immediately when stream ends
    seenEventIds.delete(sessionKey);
    console.log(`[claudeSDK:${streamId}] Cleaned up event tracking for session: ${sessionKey}`);
  }
}

/**
 * Convert SDK event to our ClaudeEvent format
 */
function convertSDKEventToClaudeEvent(event: any): ClaudeEvent | null {
  if (!event || !event.type) return null;

  const eventType = event.type.toLowerCase();

  // Debug: Log all incoming events
  if (eventType === 'assistant' && event.message?.content) {
    const toolUses = event.message.content.filter((c: any) => c.type === 'tool_use');
    if (toolUses.length > 0) {
      console.log('🔧 [claudeSDK] Assistant event with tool_use:', toolUses.map((t: any) => ({
        name: t.name,
        hasInput: !!t.input,
        subagent_type: t.input?.subagent_type,
      })));
    }
  }

  // System event
  if (eventType === 'system') {
    const tools = event.tools || event.availableTools || [];

    return {
      type: 'system',
      subtype: event.subtype || 'init',
      session_id: event.session_id || event.sessionId,
      model: event.model,
      cwd: event.cwd || event.workingDirectory,
      tools: tools,
    };
  }

  // Assistant event
  if (eventType === 'assistant') {
    return {
      type: 'assistant',
      message: {
        id: event.message?.id || `msg-${Date.now()}`,
        content: Array.isArray(event.message?.content)
          ? event.message.content.map((block: any) => {
              if (block.type === 'text') {
                return { type: 'text', text: block.text };
              }
              if (block.type === 'tool_use') {
                return {
                  type: 'tool_use',
                  id: block.id,
                  name: block.name,
                  input: block.input,
                };
              }
              // Handle thinking blocks (SDK 0.1.54+ extended thinking)
              if (block.type === 'thinking') {
                return {
                  type: 'thinking',
                  thinking: block.thinking || block.text || '',
                };
              }
              return block;
            })
          : [],
      },
      session_id: event.session_id || event.sessionId,
    };
  }

  // User event (tool results)
  if (eventType === 'user') {
    return {
      type: 'user',
      message: {
        content: Array.isArray(event.message?.content)
          ? event.message.content.map((block: any) => ({
              type: block.type || 'tool_result',
              tool_use_id: block.tool_use_id || block.toolUseId,
              content: block.content || block.result,
              is_error: block.is_error || block.isError || false,
            }))
          : [],
      },
      session_id: event.session_id || event.sessionId,
    };
  }

  // Result event
  if (eventType === 'result') {
    return {
      type: 'result',
      result: event.result || event.text,
      error: event.error,
      is_error: event.is_error || event.isError || false,
      session_id: event.session_id || event.sessionId,
      total_cost_usd: event.total_cost_usd || event.totalCostUsd || event.cost,
      cost_usd: event.cost_usd || event.costUsd,
      duration_ms: event.duration_ms || event.durationMs,
      usage: event.usage
        ? {
            input_tokens: event.usage.input_tokens || event.usage.inputTokens || 0,
            output_tokens: event.usage.output_tokens || event.usage.outputTokens || 0,
            cache_creation_input_tokens: event.usage.cache_creation_input_tokens || event.usage.cacheCreationInputTokens || 0,
            cache_read_input_tokens: event.usage.cache_read_input_tokens || event.usage.cacheReadInputTokens || 0,
          }
        : undefined,
      model_usage: event.model_usage || event.modelUsage || undefined,
    };
  }

  // Agent event (subagent start/stop) - SDK 0.1.54+
  if (eventType === 'agent') {
    console.log('🤖 [Subagent Event] Received agent event:', event);
    return {
      type: 'agent',
      action: event.action || (event.subtype === 'start' ? 'start' : 'stop'),
      agent_name: event.agent_name || event.agentName || event.name,
      agent_type: event.agent_type || event.agentType || event.subagent_type,
      session_id: event.session_id || event.sessionId,
    };
  }

  // Log unhandled event types for debugging
  console.log('⚠️ [SDK Event] Unhandled event type:', eventType, event);

  return null;
}

/**
 * Abort stream for a specific session
 */
export function abortSessionStream(sessionId: string): void {
  const controller = activeStreams.get(sessionId);
  if (controller) {
    console.log(`[claudeSDK] Aborting stream for session: ${sessionId}`);
    controller.abort();
    activeStreams.delete(sessionId);

    // Also clean up event tracking
    seenEventIds.delete(sessionId);
  } else {
    console.log(`[claudeSDK] No active stream found for session: ${sessionId}`);
  }
}

/**
 * Abort all active streams (useful for cleanup)
 */
function abortAllStreams(): void {
  console.log(`[claudeSDK] Aborting all ${activeStreams.size} active streams`);
  activeStreams.forEach((controller, sessionKey) => {
    console.log(`[claudeSDK] Aborting stream for session: ${sessionKey}`);
    controller.abort();
  });
  activeStreams.clear();

  // Also clear all event tracking
  seenEventIds.clear();
  console.log(`[claudeSDK] Cleared all event tracking data`);
}

/**
 * Get count of active streams (for debugging)
 */
function getActiveStreamCount(): number {
  return activeStreams.size;
}

/**
 * Send a tool result back to the Claude SDK for an active session
 * Used for interactive tools like AskUserQuestion (legacy approach)
 */
export async function sendToolResult(
  sessionId: string,
  toolUseId: string,
  result: string,
  workingDirectory?: string
): Promise<void> {
  console.log('[claudeSDK] 🗣️ Sending tool result:', { sessionId, toolUseId, resultLength: result.length });

  try {
    await invoke('send_tool_result_to_sdk', {
      sessionId,
      toolUseId,
      result,
      workingDirectory: workingDirectory || process.cwd?.() || '.',
    });
    console.log('[claudeSDK] 🗣️ Tool result sent successfully');
  } catch (err) {
    console.error('[claudeSDK] Failed to send tool result:', err);
    throw err;
  }
}

/**
 * Answer an AskUserQuestion request via stdin to the active SDK process
 * This is the new approach that uses bidirectional communication
 * Includes timeout (5s) and retry logic (3 attempts) to handle race conditions
 */
export async function answerUserQuestionViaStdin(
  agentId: string,
  requestId: string,
  answers: Record<string, string>,
  maxRetries = 3,
  timeoutMs = 5000
): Promise<void> {
  console.log('[claudeSDK] 🗣️ Answering user question via stdin:', { agentId, requestId, answers });

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Race between the invoke and a timeout
      await Promise.race([
        invoke('answer_user_question', {
          agentId,
          requestId,
          answers,
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
        )
      ]);
      console.log('[claudeSDK] 🗣️ Answer sent successfully via stdin');
      return; // Success - exit function
    } catch (err) {
      console.warn(`[claudeSDK] ⚠️ Attempt ${attempt}/${maxRetries} failed:`, err);

      if (attempt === maxRetries) {
        console.error('[claudeSDK] ❌ All retry attempts failed');
        throw err;
      }

      // Wait 500ms before next retry
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log(`[claudeSDK] 🔄 Retrying... (attempt ${attempt + 1}/${maxRetries})`);
    }
  }
}

// =============================================================================
// FILE CHECKPOINTING & REWIND (SDK 0.2.7+)
// =============================================================================

interface RewindFilesResult {
  success: boolean;
  type: 'completed' | 'preview';
  sessionId: string;
  userMessageId: string;
  canRewind?: boolean;
  message?: string;
  error?: string;
}

/**
 * Rewind files to their state at a specific user message
 * Requires file checkpointing to be enabled in the session
 *
 * @param sessionId - The Claude session ID
 * @param userMessageId - UUID of the user message to rewind to
 * @param dryRun - If true, only check if rewind is possible without executing
 * @returns Result of the rewind operation
 */
export async function rewindFiles(
  sessionId: string,
  userMessageId: string,
  dryRun = false
): Promise<RewindFilesResult> {
  console.log('[claudeSDK] ⏪ Rewind files request:', { sessionId, userMessageId, dryRun });

  try {
    const result = await invoke<RewindFilesResult>('rewind_files', {
      sessionId,
      userMessageId,
      dryRun,
    });
    console.log('[claudeSDK] ⏪ Rewind files result:', result);
    return result;
  } catch (err) {
    console.error('[claudeSDK] ⏪ Rewind files failed:', err);
    throw err;
  }
}