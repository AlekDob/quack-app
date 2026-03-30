import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ClaudeEvent } from '../types';

const {
  mockInvoke,
  mockChatStoreGet,
  mockChatStoreSet,
  mockChatStoreSave,
  mockChatStoreDelete,
  mockKanbanStoreGet,
  mockListeners,
} = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  mockChatStoreGet: vi.fn(),
  mockChatStoreSet: vi.fn(),
  mockChatStoreSave: vi.fn(),
  mockChatStoreDelete: vi.fn(),
  mockKanbanStoreGet: vi.fn(),
  mockListeners: new Map<string, (event: { payload: unknown }) => void>(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke,
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockImplementation((eventName: string, callback: (event: { payload: unknown }) => void) => {
    mockListeners.set(eventName, callback);
    return Promise.resolve(() => {
      mockListeners.delete(eventName);
    });
  }),
}));

vi.mock('@tauri-apps/plugin-store', () => ({
  Store: {
    load: vi.fn().mockImplementation(async (name: string) => {
      if (name === 'quack-kanban-tasks.json') {
        return {
          get: mockKanbanStoreGet,
          set: vi.fn(),
          save: vi.fn(),
          delete: vi.fn(),
        };
      }

      return {
        get: mockChatStoreGet,
        set: mockChatStoreSet,
        save: mockChatStoreSave,
        delete: mockChatStoreDelete,
      };
    }),
  },
}));

vi.mock('../services/claudeSDK', () => ({
  getProviderRequestFields: () => ({
    resolveModel: (model: string) => `resolved-${model}`,
    provider: 'anthropic',
    providerBaseUrl: undefined,
    providerApiKey: undefined,
  }),
}));

import { usePopoutKanbanChat } from './usePopoutKanbanChat';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

function emitTaskEvent(taskId: string, payload: { sessionKey?: string; turnId?: string; event: ClaudeEvent }) {
  const listener = mockListeners.get(`claude-event:${taskId}`);
  expect(listener).toBeDefined();
  listener?.({ payload });
}

function assistantEvent(text: string): ClaudeEvent {
  return {
    type: 'assistant',
    message: {
      id: `assistant-${text}`,
      content: [{ type: 'text', text }],
    },
    session_id: 'session-1',
  };
}

describe('usePopoutKanbanChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListeners.clear();
    mockChatStoreGet.mockResolvedValue(null);
    mockKanbanStoreGet.mockResolvedValue([]);
  });

  it('passes turnId to the backend and rejects stale events after abort', async () => {
    const firstInvoke = deferred<void>();
    const secondInvoke = deferred<void>();
    const requests: Array<{ agentId: string; request: Record<string, unknown> }> = [];

    mockInvoke.mockImplementation((command: string, args?: { agentId: string; request: Record<string, unknown> }) => {
      if (command !== 'send_message_via_sdk_streaming') {
        return Promise.resolve(undefined);
      }

      requests.push(args!);
      return requests.length === 1 ? firstInvoke.promise : secondInvoke.promise;
    });

    const { result } = renderHook(() => usePopoutKanbanChat());

    let firstSendPromise!: Promise<void>;
    await act(async () => {
      firstSendPromise = result.current.sendMessage('task-1', 'first');
      await Promise.resolve();
    });

    expect(requests[0]?.request.sessionKey).toBe('task-1');
    expect(requests[0]?.request.turnId).toEqual(expect.any(String));

    await act(async () => {
      emitTaskEvent('task-1', {
        sessionKey: 'task-1',
        turnId: requests[0].request.turnId as string,
        event: assistantEvent('first-response'),
      });
    });

    act(() => {
      result.current.abortStream('task-1');
    });

    firstInvoke.resolve(undefined);
    await act(async () => {
      await firstSendPromise;
    });

    let secondSendPromise!: Promise<void>;
    await act(async () => {
      secondSendPromise = result.current.sendMessage('task-1', 'second');
      await Promise.resolve();
    });

    expect(requests[1]?.request.sessionKey).toBe('task-1');
    expect(requests[1]?.request.turnId).toEqual(expect.any(String));
    expect(requests[1]?.request.turnId).not.toBe(requests[0]?.request.turnId);

    await act(async () => {
      emitTaskEvent('task-1', {
        sessionKey: 'task-1',
        turnId: requests[0].request.turnId as string,
        event: assistantEvent('stale-old-turn'),
      });
      emitTaskEvent('task-1', {
        sessionKey: 'task-1',
        turnId: requests[1].request.turnId as string,
        event: assistantEvent('fresh-second-turn'),
      });
      emitTaskEvent('task-1', {
        sessionKey: 'task-1',
        turnId: requests[1].request.turnId as string,
        event: { type: 'result', session_id: 'session-2' },
      });
    });

    secondInvoke.resolve(undefined);
    await act(async () => {
      await secondSendPromise;
    });

    await waitFor(() => {
      const messages = result.current.chatSessions.get('task-1') ?? [];
      expect(messages).toHaveLength(4);
      expect(messages[1].content).toBe('first-response');
      expect(messages[3].content).toBe('fresh-second-turn');
      expect(messages[3].content).not.toContain('stale-old-turn');
    });
  });

  it('keeps same-turn late assistant events on the completed message', async () => {
    const invokeDeferred = deferred<void>();
    const requests: Array<{ request: Record<string, unknown> }> = [];

    mockInvoke.mockImplementation((command: string, args?: { request: Record<string, unknown> }) => {
      if (command !== 'send_message_via_sdk_streaming') {
        return Promise.resolve(undefined);
      }

      requests.push(args!);
      return invokeDeferred.promise;
    });

    const { result } = renderHook(() => usePopoutKanbanChat());

    let sendPromise!: Promise<void>;
    await act(async () => {
      sendPromise = result.current.sendMessage('task-2', 'hello');
      await Promise.resolve();
    });

    const turnId = requests[0].request.turnId as string;

    await act(async () => {
      emitTaskEvent('task-2', {
        sessionKey: 'task-2',
        turnId,
        event: assistantEvent('initial'),
      });
      emitTaskEvent('task-2', {
        sessionKey: 'task-2',
        turnId,
        event: { type: 'result', session_id: 'session-3' },
      });
      emitTaskEvent('task-2', {
        sessionKey: 'task-2',
        turnId,
        event: assistantEvent('late-but-same-turn'),
      });
    });

    invokeDeferred.resolve(undefined);
    await act(async () => {
      await sendPromise;
    });

    await waitFor(() => {
      const messages = result.current.chatSessions.get('task-2') ?? [];
      expect(messages).toHaveLength(2);
      expect(messages[1].status).toBe('complete');
      expect(messages[1].content).toBe('late-but-same-turn');
    });
  });
});
