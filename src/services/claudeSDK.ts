import { query } from '@anthropic-ai/claude-agent-sdk';
import { invoke } from '@tauri-apps/api/core';
import type { ClaudeEvent, MCPServer } from '../types';

export interface ClaudeSDKOptions {
  model?: 'opus' | 'sonnet' | 'haiku' | 'haiku-3.5';
  thinkingMode?: string;
  permissionMode?: 'plan' | 'act' | 'bypass';
  sessionId?: string;
  workingDirectory?: string;
  mcpServers?: Record<string, {
    command: string;
    args: string[];
    env?: Record<string, string>;
  }>;
  signal?: AbortSignal; // AbortSignal to cancel the stream
  timeout?: number; // Timeout in milliseconds (default: 5 minutes)
  streamId?: string; // Unique identifier for this stream (for logging/debugging)
}

/**
 * Map friendly model names to official API model IDs
 */
function getModelId(model: string): string {
  const modelMap: Record<string, string> = {
    'haiku': 'claude-haiku-4-5-20251001',        // Haiku 4.5 (Oct 2025)
    'haiku-3.5': 'claude-3-5-haiku-20241022',    // Haiku 3.5
    'sonnet': 'claude-sonnet-4-5-20250929',      // Sonnet 4.5 (latest)
    'opus': 'claude-opus-4-1-20250805',          // Opus 4.1 (latest)
  };

  return modelMap[model] || model; // Return as-is if not in map (allows full model IDs)
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
      mcpServers[server.id] = {
        command: server.command,
        args: server.args,
        env: server.env,
      };
    });

    return mcpServers;
  } catch (error) {
    console.warn('Failed to load MCP servers:', error);
    return undefined;
  }
}

export interface ClaudeSDKStreamEvent {
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
  const streamId = options.streamId || `stream-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const timeout = options.timeout || 5 * 60 * 1000; // Default: 5 minutes

  // Create unique session key for isolation
  const sessionKey = options.sessionId || streamId;

  console.log(`[claudeSDK:${streamId}] Starting stream for session: ${sessionKey} with timeout: ${timeout}ms`);

  // Cancel any existing stream for this session
  const existingController = activeStreams.get(sessionKey);
  if (existingController) {
    console.warn(`[claudeSDK:${streamId}] Cancelling existing stream for session: ${sessionKey}`);
    existingController.abort();
    activeStreams.delete(sessionKey);
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
      model = 'sonnet',
      thinkingMode,
      permissionMode = 'act',
      sessionId,
      workingDirectory,
    } = options;

    // Map permission mode to SDK permission mode
    // SDK accepts: undefined (auto-approve), 'plan' (planning only), 'bypassPermissions' (no confirmations)
    const sdkPermissionMode =
      permissionMode === 'bypass'
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
    const sdkOptions: any = {
      model: getModelId(model), // Map friendly name to API model ID
      permissionMode: sdkPermissionMode,
      // Enable automatic reading of CLAUDE.md, slash commands, and project settings
      settingSources: ['project', 'user', 'local'],
    };

    if (thinkingMode) {
      sdkOptions.thinkingMode = thinkingMode;
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
      console.log('MCP servers loaded:', Object.keys(mcpServers));
    }

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
        events.push(claudeEvent);

        // Log significant events
        if (claudeEvent.type === 'system') {
          console.log(`[claudeSDK:${streamId}] System event - session: ${claudeEvent.session_id}`);
        } else if (claudeEvent.type === 'assistant' && claudeEvent.message?.content) {
          const hasToolUse = claudeEvent.message.content.some(b => b.type === 'tool_use');
          console.log(`[claudeSDK:${streamId}] Assistant event - ${claudeEvent.message.content.length} blocks${hasToolUse ? ' (includes tool use)' : ''}`);
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
  } catch (error) {
    const duration = Date.now() - startTime;
    const isTimeout = error instanceof Error && error.message.includes('timeout');
    const isAborted = combinedSignal.aborted;

    console.error(`[claudeSDK:${streamId}] Error after ${duration}ms (aborted: ${isAborted}):`, error);

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
  }
}

/**
 * Convert SDK event to our ClaudeEvent format
 */
function convertSDKEventToClaudeEvent(event: any): ClaudeEvent | null {
  if (!event || !event.type) return null;

  const eventType = event.type.toLowerCase();

  // System event
  if (eventType === 'system') {
    return {
      type: 'system',
      subtype: event.subtype || 'init',
      session_id: event.session_id || event.sessionId,
      model: event.model,
      cwd: event.cwd || event.workingDirectory,
      tools: event.tools || event.availableTools,
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
          }
        : undefined,
    };
  }

  return null;
}

/**
 * Abort all active streams (useful for cleanup)
 */
export function abortAllStreams(): void {
  console.log(`[claudeSDK] Aborting all ${activeStreams.size} active streams`);
  activeStreams.forEach((controller, sessionKey) => {
    console.log(`[claudeSDK] Aborting stream for session: ${sessionKey}`);
    controller.abort();
  });
  activeStreams.clear();
}

/**
 * Get count of active streams (for debugging)
 */
export function getActiveStreamCount(): number {
  return activeStreams.size;
}