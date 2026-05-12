import { describe, it, expect } from 'vitest';
import { computeTaskHubBadge } from '../TaskHubView';
import type { AgentSession, ChatMessage } from '../../types';

function makeSession(id: string, overrides: Partial<AgentSession> = {}): AgentSession {
  return {
    id,
    title: `Session ${id}`,
    agentId: 'agent-1',
    projectPath: '/p',
    projectName: 'p',
    status: 'active',
    createdAt: 0,
    updatedAt: 0,
    messageCount: 0,
    ...overrides,
  };
}

function makeMessage(role: 'user' | 'assistant', status?: ChatMessage['status']): ChatMessage {
  return {
    id: 'm-' + Math.random(),
    role,
    content: 'x',
    timestamp: 0,
    status,
  };
}

describe('computeTaskHubBadge', () => {
  it('returns 0 for empty sessions', () => {
    expect(computeTaskHubBadge([], new Map(), new Map())).toBe(0);
  });

  it('excludes sessions with status "done"', () => {
    const sessions = [makeSession('s1', { status: 'done' })];
    const pending = new Map([['s1', new Set(['q1'])]]);
    expect(computeTaskHubBadge(sessions, new Map(), pending)).toBe(0);
  });

  it('counts a session with a pending question (Needs attention)', () => {
    const sessions = [makeSession('s1')];
    const pending = new Map([['s1', new Set(['q1'])]]);
    expect(computeTaskHubBadge(sessions, new Map(), pending)).toBe(1);
  });

  it('counts a session whose last message is a complete assistant message (Agent done)', () => {
    const sessions = [makeSession('s1')];
    const chat = new Map([['s1', [makeMessage('user'), makeMessage('assistant', 'complete')]]]);
    expect(computeTaskHubBadge(sessions, chat, new Map())).toBe(1);
  });

  it('counts both Needs attention and Agent done', () => {
    const sessions = [makeSession('s1'), makeSession('s2')];
    const pending = new Map([['s1', new Set(['q1'])]]);
    const chat = new Map([['s2', [makeMessage('assistant', 'complete')]]]);
    expect(computeTaskHubBadge(sessions, chat, pending)).toBe(2);
  });

  it('does NOT count a streaming assistant message (Working)', () => {
    const sessions = [makeSession('s1')];
    const chat = new Map([['s1', [makeMessage('assistant', 'streaming')]]]);
    expect(computeTaskHubBadge(sessions, chat, new Map())).toBe(0);
  });

  it('does NOT count an idle session with no messages (Other)', () => {
    const sessions = [makeSession('s1')];
    expect(computeTaskHubBadge(sessions, new Map(), new Map())).toBe(0);
  });

  it('does NOT double-count a session that has BOTH pending and agent done (pending wins)', () => {
    const sessions = [makeSession('s1')];
    const pending = new Map([['s1', new Set(['q1'])]]);
    const chat = new Map([['s1', [makeMessage('assistant', 'complete')]]]);
    expect(computeTaskHubBadge(sessions, chat, pending)).toBe(1);
  });

  it('treats undefined message status as complete (legacy)', () => {
    const sessions = [makeSession('s1')];
    const chat = new Map([['s1', [makeMessage('assistant', undefined)]]]);
    expect(computeTaskHubBadge(sessions, chat, new Map())).toBe(1);
  });

  it('handles missing chatSessions map gracefully', () => {
    const sessions = [makeSession('s1')];
    expect(computeTaskHubBadge(sessions, undefined, new Map())).toBe(0);
  });
});
