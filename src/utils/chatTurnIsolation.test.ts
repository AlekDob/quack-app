import { describe, expect, it } from 'vitest';

import type { ChatMessage, ClaudeEvent } from '../types';
import {
  appendMessagesToSession,
  routeClaudeEventToSession,
  shouldRejectClaudeEvent,
} from './chatTurnIsolation';

function createAssistantMessage(turnId: string, status: ChatMessage['status']): ChatMessage {
  return {
    id: `assistant-${turnId}`,
    role: 'assistant',
    content: '',
    timestamp: status === 'streaming' ? 0 : Date.now(),
    status,
    metadata: { turnId },
    events: [],
  };
}

function createAssistantEvent(text: string): ClaudeEvent {
  return {
    type: 'assistant',
    message: {
      id: `msg-${text}`,
      content: [{ type: 'text', text }],
    },
    session_id: 'session-1',
  };
}

describe('chatTurnIsolation', () => {
  it('rejects stale events from a different active turn', () => {
    expect(shouldRejectClaudeEvent('turn-2', 'turn-1')).toBe(true);
    expect(shouldRejectClaudeEvent('turn-2', 'turn-2')).toBe(false);
    expect(shouldRejectClaudeEvent('turn-2', undefined)).toBe(false);
  });

  it('rejects events for locally aborted turns', () => {
    expect(shouldRejectClaudeEvent('turn-1', 'turn-1', new Set(['turn-1']))).toBe(true);
    expect(shouldRejectClaudeEvent('turn-2', 'turn-1', new Set(['turn-3']))).toBe(true);
    expect(shouldRejectClaudeEvent('turn-1', 'turn-1', new Set(['turn-2']))).toBe(false);
  });

  it('applies same-turn trailing events to a completed assistant message', () => {
    const completedMessage = createAssistantMessage('turn-1', 'complete');
    completedMessage.events = [createAssistantEvent('initial')];

    const routed = routeClaudeEventToSession({
      sessionMessages: [completedMessage],
      bufferedEvents: [],
      claudeEvent: createAssistantEvent('late'),
      turnId: 'turn-1',
    });

    expect(routed.action).toBe('applied');
    expect(routed.sessionMessages[0].events).toHaveLength(2);
    expect((routed.sessionMessages[0].events?.[1] as any).message.content[0].text).toBe('late');
  });

  it('flushes only current-turn buffered events and discards stale ones', () => {
    const firstAttempt = routeClaudeEventToSession({
      sessionMessages: [],
      bufferedEvents: [],
      claudeEvent: createAssistantEvent('buffer-me'),
      turnId: 'turn-2',
    });

    expect(firstAttempt.action).toBe('buffered');
    expect(firstAttempt.bufferedEvents).toHaveLength(1);

    const routed = routeClaudeEventToSession({
      sessionMessages: [createAssistantMessage('turn-2', 'streaming')],
      bufferedEvents: [
        { turnId: 'turn-1', event: createAssistantEvent('stale') },
        ...firstAttempt.bufferedEvents,
      ],
      claudeEvent: createAssistantEvent('current'),
      turnId: 'turn-2',
    });

    expect(routed.action).toBe('applied');
    expect(routed.flushedBufferedCount).toBe(1);
    expect(routed.discardedBufferedCount).toBe(1);
    expect(routed.bufferedEvents).toHaveLength(0);
    expect(routed.sessionMessages[0].events).toHaveLength(2);
    expect((routed.sessionMessages[0].events?.[0] as any).message.content[0].text).toBe('buffer-me');
    expect((routed.sessionMessages[0].events?.[1] as any).message.content[0].text).toBe('current');
  });

  it('appends user/system messages from the latest session state', () => {
    const existingAssistant = createAssistantMessage('turn-1', 'complete');
    existingAssistant.content = 'already rendered';

    const prevSessions = new Map<string, ChatMessage[]>([
      ['session-1', [existingAssistant]],
    ]);

    const nextSessions = appendMessagesToSession(prevSessions, 'session-1', [
      {
        id: 'user-2',
        role: 'user',
        content: 'follow-up',
        timestamp: Date.now(),
        status: 'sending',
      },
    ]);

    expect(prevSessions.get('session-1')).toHaveLength(1);
    expect(nextSessions.get('session-1')).toHaveLength(2);
    expect(nextSessions.get('session-1')?.[0].content).toBe('already rendered');
    expect(nextSessions.get('session-1')?.[1].content).toBe('follow-up');
  });
});
