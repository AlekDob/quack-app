// Brain: decision-quack-abstraction-agent-level-not-model-level
//
// Pure adapter: translates a single QuackAgentEvent (produced by the Codex backend)
// into zero-or-more ClaudeEvent shapes that the existing handleClaudeEvent reducer
// can consume without modification.
//
// This is the frontend mirror of src-tauri/src/agents/events.rs which converts
// Codex raw output -> QuackAgentEvent. This module converts QuackAgentEvent -> ClaudeEvent.
//
// ID SCHEME: handleClaudeEvent deduplicates assistant events via (message.id + contentHash).
// - tool_call_start: uses the event's own `id` field (already unique, real tool call UUID).
// - text_delta: uses `codex-text-${seq ?? 0}`. The optional `seq` parameter (default 0)
//   lets callers inject a monotonic sequence number so that repeated text deltas within
//   the same turn get distinct ids while tests remain deterministic.
//
// PURE FUNCTION CONTRACT: no I/O, no React, no Tauri, no randomness, no global state.

import type { QuackAgentEvent } from '@/types/agentBackend';
import type {
  ClaudeEvent,
  ClaudeSystemEvent,
  ClaudeAssistantEvent,
  ClaudeUserEvent,
  ClaudeResultEvent,
  ClaudeErrorEvent,
  UsageStats,
} from '@/types';

function mapSessionStarted(ev: Extract<QuackAgentEvent, { kind: 'session_started' }>): ClaudeSystemEvent {
  const event: ClaudeSystemEvent = {
    type: 'system',
    subtype: 'init',
    session_id: ev.backend_session_id,
  };
  if (ev.model != null) {
    event.model = ev.model;
  }
  return event;
}

function mapTextDelta(
  ev: Extract<QuackAgentEvent, { kind: 'text_delta' }>,
  seq: number,
): ClaudeAssistantEvent {
  return {
    type: 'assistant',
    message: {
      id: `codex-text-${seq}`,
      content: [{ type: 'text', text: ev.content }],
    },
  };
}

function safeArgs(args: unknown): Record<string, unknown> {
  if (args !== null && typeof args === 'object' && !Array.isArray(args)) {
    return args as Record<string, unknown>;
  }
  return {};
}

function mapToolCallStart(ev: Extract<QuackAgentEvent, { kind: 'tool_call_start' }>): ClaudeAssistantEvent {
  return {
    type: 'assistant',
    message: {
      id: ev.id,
      content: [{ type: 'tool_use', id: ev.id, name: ev.name, input: safeArgs(ev.args) }],
    },
  };
}

function mapToolCallEnd(ev: Extract<QuackAgentEvent, { kind: 'tool_call_end' }>): ClaudeUserEvent {
  return {
    type: 'user',
    message: {
      content: [
        {
          type: 'tool_result',
          tool_use_id: ev.id,
          content: ev.output,
          is_error: ev.error != null,
        },
      ],
    },
  };
}

function mapUsage(ev: Extract<QuackAgentEvent, { kind: 'usage' }>): ClaudeResultEvent {
  const usage: UsageStats = {
    input_tokens: ev.input_tokens,
    output_tokens: ev.output_tokens,
    cache_read_input_tokens: ev.cached_tokens,
    cache_creation_input_tokens: 0,
  };
  const event: ClaudeResultEvent = { type: 'result', usage };
  if (ev.cost_usd != null) {
    event.cost_usd = ev.cost_usd;
    event.total_cost_usd = ev.cost_usd;
  }
  return event;
}

function mapError(ev: Extract<QuackAgentEvent, { kind: 'error' }>): ClaudeErrorEvent {
  return { type: 'error', error: ev.message, code: ev.code };
}

function mapSessionEnded(): ClaudeResultEvent {
  return { type: 'result', is_error: false };
}

/**
 * Translates one QuackAgentEvent into zero-or-more ClaudeEvent objects.
 *
 * @param ev - The Quack agent event emitted by the Codex backend.
 * @param seq - Optional monotonic sequence number for text_delta events.
 *   Inject a per-turn counter from the call site to ensure distinct message.id
 *   values across multiple text_delta events in the same session. Defaults to 0.
 *   Tests can pass a fixed number for determinism.
 */
export function quackEventToClaudeEvents(ev: QuackAgentEvent, seq = 0): ClaudeEvent[] {
  switch (ev.kind) {
    case 'session_started': return [mapSessionStarted(ev)];
    case 'text_delta':      return [mapTextDelta(ev, seq)];
    case 'tool_call_start': return [mapToolCallStart(ev)];
    case 'tool_call_end':   return [mapToolCallEnd(ev)];
    case 'usage':           return [mapUsage(ev)];
    case 'error':           return [mapError(ev)];
    case 'session_ended':   return [mapSessionEnded()];
    default: {
      // Exhaustiveness guard: a new QuackAgentEvent kind without a case
      // above becomes a TS compile error here (cannot assign to `never`).
      const _exhaustive: never = ev;
      void _exhaustive;
      return [];
    }
  }
}
