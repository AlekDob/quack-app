import { query } from '@anthropic-ai/claude-agent-sdk';
import type { ClaudeEvent } from '../types';

export interface ClaudeSDKOptions {
  model?: 'opus' | 'sonnet';
  thinkingMode?: string;
  permissionMode?: 'plan' | 'act' | 'bypass';
  sessionId?: string;
  workingDirectory?: string;
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

/**
 * Send a message to Claude using the official Claude Agent SDK
 * with real-time streaming support
 */
export async function* streamClaudeMessage(
  prompt: string,
  options: ClaudeSDKOptions = {}
): AsyncGenerator<ClaudeSDKStreamEvent> {
  try {
    const {
      model = 'sonnet',
      thinkingMode,
      permissionMode = 'act',
      sessionId,
      workingDirectory,
    } = options;

    // Map permission mode to SDK permission mode
    const sdkPermissionMode =
      permissionMode === 'bypass'
        ? 'bypassPermissions'
        : permissionMode === 'plan'
          ? 'plan'
          : 'default';

    // Build options object - SDK expects { prompt, options }
    const sdkOptions: any = {
      model,
      permissionMode: sdkPermissionMode,
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

    // Stream events
    for await (const event of stream) {
      // Convert SDK event to our ClaudeEvent format
      const claudeEvent = convertSDKEventToClaudeEvent(event);

      if (claudeEvent) {
        events.push(claudeEvent);

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
    console.error('Claude SDK error:', error);
    yield {
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
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
