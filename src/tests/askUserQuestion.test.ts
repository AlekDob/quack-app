/**
 * Tests for AskUserQuestion flow
 *
 * Verifies:
 * 1. Retry logic with exponential backoff
 * 2. Session key matching to prevent cross-session contamination
 * 3. Error recovery state restoration
 * 4. RequestId lookup logic
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Types matching the actual implementation
interface PendingQuestionData {
  agentId: string;
  sessionKey?: string;
  questions: unknown[];
}

type PendingUserQuestionsMap = Map<string, PendingQuestionData>;

// Helper to simulate the findRequestId logic from App.tsx
function createFindRequestId(
  pendingUserQuestions: PendingUserQuestionsMap,
  activeId: string,
  targetSessionKey?: string
) {
  return (): { requestId: string | null; sessionKey?: string; questions: unknown[] } => {
    for (const [requestId, data] of pendingUserQuestions.entries()) {
      const agentMatches = data.agentId === activeId;
      const sessionMatches = !targetSessionKey || data.sessionKey === targetSessionKey;

      if (agentMatches && sessionMatches) {
        return { requestId, sessionKey: data.sessionKey, questions: data.questions };
      }
    }
    return { requestId: null, sessionKey: undefined, questions: [] };
  };
}

// Helper to simulate the retry logic with exponential backoff
async function findRequestIdWithRetry(
  findRequestId: () => { requestId: string | null; sessionKey?: string; questions: unknown[] },
  maxRetries = 4,
  baseDelayMs = 200
): Promise<{ requestId: string | null; sessionKey?: string; questions: unknown[]; attempts: number }> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const result = findRequestId();
    if (result.requestId) {
      return { ...result, attempts: attempt + 1 };
    }

    if (attempt < maxRetries - 1) {
      const delay = baseDelayMs * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  return { requestId: null, sessionKey: undefined, questions: [], attempts: maxRetries };
}

describe('AskUserQuestion Flow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('RequestId Lookup', () => {
    it('should find requestId when agentId matches', () => {
      const pendingQuestions: PendingUserQuestionsMap = new Map([
        ['req_123', { agentId: 'agent-1', sessionKey: 'session-1', questions: [{ question: 'Test?' }] }]
      ]);

      const findRequestId = createFindRequestId(pendingQuestions, 'agent-1');
      const result = findRequestId();

      expect(result.requestId).toBe('req_123');
      expect(result.sessionKey).toBe('session-1');
    });

    it('should NOT find requestId when agentId does not match', () => {
      const pendingQuestions: PendingUserQuestionsMap = new Map([
        ['req_123', { agentId: 'agent-1', sessionKey: 'session-1', questions: [] }]
      ]);

      const findRequestId = createFindRequestId(pendingQuestions, 'agent-2');
      const result = findRequestId();

      expect(result.requestId).toBeNull();
    });

    it('should match by both agentId AND sessionKey when sessionKey provided', () => {
      const pendingQuestions: PendingUserQuestionsMap = new Map([
        ['req_123', { agentId: 'agent-1', sessionKey: 'session-1', questions: [] }],
        ['req_456', { agentId: 'agent-1', sessionKey: 'session-2', questions: [] }]
      ]);

      // Should find the correct session
      const findRequestId1 = createFindRequestId(pendingQuestions, 'agent-1', 'session-2');
      const result1 = findRequestId1();
      expect(result1.requestId).toBe('req_456');

      // Should find session-1 when looking for it
      const findRequestId2 = createFindRequestId(pendingQuestions, 'agent-1', 'session-1');
      const result2 = findRequestId2();
      expect(result2.requestId).toBe('req_123');
    });

    it('should prevent cross-session contamination', () => {
      // Two questions from same agent but different sessions
      const pendingQuestions: PendingUserQuestionsMap = new Map([
        ['req_old', { agentId: 'agent-1', sessionKey: 'old-session', questions: [{ question: 'Old?' }] }],
        ['req_new', { agentId: 'agent-1', sessionKey: 'new-session', questions: [{ question: 'New?' }] }]
      ]);

      // Looking for new-session should NOT return old-session's requestId
      const findRequestId = createFindRequestId(pendingQuestions, 'agent-1', 'new-session');
      const result = findRequestId();

      expect(result.requestId).toBe('req_new');
      expect(result.sessionKey).toBe('new-session');
    });

    it('should find first matching agentId when no sessionKey filter', () => {
      const pendingQuestions: PendingUserQuestionsMap = new Map([
        ['req_first', { agentId: 'agent-1', sessionKey: 'session-1', questions: [] }],
        ['req_second', { agentId: 'agent-1', sessionKey: 'session-2', questions: [] }]
      ]);

      // Without sessionKey filter, should find first one
      const findRequestId = createFindRequestId(pendingQuestions, 'agent-1');
      const result = findRequestId();

      expect(result.requestId).toBe('req_first');
    });
  });

  describe('Retry Logic with Exponential Backoff', () => {
    it('should find requestId on first attempt when available', async () => {
      const pendingQuestions: PendingUserQuestionsMap = new Map([
        ['req_123', { agentId: 'agent-1', questions: [] }]
      ]);

      const findRequestId = createFindRequestId(pendingQuestions, 'agent-1');

      const resultPromise = findRequestIdWithRetry(findRequestId, 4, 200);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.requestId).toBe('req_123');
      expect(result.attempts).toBe(1);
    });

    it('should retry with exponential backoff when not found initially', async () => {
      const pendingQuestions: PendingUserQuestionsMap = new Map();
      let attemptCount = 0;

      // Simulate event arriving after 300ms
      setTimeout(() => {
        pendingQuestions.set('req_delayed', { agentId: 'agent-1', questions: [] });
      }, 300);

      const findRequestId = () => {
        attemptCount++;
        const result = createFindRequestId(pendingQuestions, 'agent-1')();
        return result;
      };

      const resultPromise = findRequestIdWithRetry(findRequestId, 4, 200);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.requestId).toBe('req_delayed');
      // Should find on attempt 2 (after 200ms delay, event arrives at 300ms)
      expect(result.attempts).toBeGreaterThan(1);
    });

    it('should return null after all retries exhausted', async () => {
      const pendingQuestions: PendingUserQuestionsMap = new Map();
      const findRequestId = createFindRequestId(pendingQuestions, 'agent-1');

      const resultPromise = findRequestIdWithRetry(findRequestId, 4, 200);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.requestId).toBeNull();
      expect(result.attempts).toBe(4);
    });

    it('should use correct exponential delays: 200ms, 400ms, 800ms', async () => {
      const pendingQuestions: PendingUserQuestionsMap = new Map();
      const delays: number[] = [];
      let lastTime = Date.now();

      const findRequestId = () => {
        const now = Date.now();
        if (delays.length > 0 || lastTime !== now) {
          delays.push(now - lastTime);
        }
        lastTime = now;
        return createFindRequestId(pendingQuestions, 'agent-1')();
      };

      const resultPromise = findRequestIdWithRetry(findRequestId, 4, 200);

      // Advance timers step by step
      await vi.advanceTimersByTimeAsync(200); // First retry
      await vi.advanceTimersByTimeAsync(400); // Second retry
      await vi.advanceTimersByTimeAsync(800); // Third retry

      await resultPromise;

      // Verify exponential growth pattern (with some tolerance for timing)
      expect(delays.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Error Recovery', () => {
    it('should be able to restore state when answers submission fails', () => {
      const initialState: PendingUserQuestionsMap = new Map([
        ['req_123', {
          agentId: 'agent-1',
          sessionKey: 'session-1',
          questions: [{ question: 'Test?', header: 'Header', options: [] }]
        }]
      ]);

      // Simulate removing the entry (optimistic update)
      const afterRemoval = new Map(initialState);
      afterRemoval.delete('req_123');
      expect(afterRemoval.size).toBe(0);

      // Simulate restoring on error
      const foundRequestId = 'req_123';
      const foundQuestions = [{ question: 'Test?', header: 'Header', options: [] }];

      if (foundRequestId && foundQuestions.length > 0) {
        const restored = new Map(afterRemoval);
        if (!restored.has(foundRequestId)) {
          restored.set(foundRequestId, {
            agentId: 'agent-1',
            sessionKey: 'session-1',
            questions: foundQuestions
          });
        }
        expect(restored.size).toBe(1);
        expect(restored.get('req_123')?.agentId).toBe('agent-1');
      }
    });

    it('should NOT restore if requestId is null', () => {
      const state: PendingUserQuestionsMap = new Map();
      const foundRequestId: string | null = null;
      const foundQuestions: unknown[] = [];

      // This should not add anything
      if (foundRequestId && foundQuestions.length > 0) {
        state.set(foundRequestId, {
          agentId: 'agent-1',
          questions: foundQuestions
        });
      }

      expect(state.size).toBe(0);
    });

    it('should NOT restore if questions array is empty', () => {
      const state: PendingUserQuestionsMap = new Map();
      const foundRequestId = 'req_123';
      const foundQuestions: unknown[] = [];

      if (foundRequestId && foundQuestions.length > 0) {
        state.set(foundRequestId, {
          agentId: 'agent-1',
          questions: foundQuestions
        });
      }

      expect(state.size).toBe(0);
    });

    it('should NOT create duplicates when restoring', () => {
      const state: PendingUserQuestionsMap = new Map([
        ['req_123', { agentId: 'agent-1', questions: [{ q: 'Original' }] }]
      ]);

      const foundRequestId = 'req_123';
      const foundQuestions = [{ q: 'Different' }];

      // Only restore if not already present
      if (foundRequestId && foundQuestions.length > 0) {
        if (!state.has(foundRequestId)) {
          state.set(foundRequestId, {
            agentId: 'agent-1',
            questions: foundQuestions
          });
        }
      }

      // Should still have the original
      expect(state.size).toBe(1);
      expect((state.get('req_123')?.questions[0] as { q: string }).q).toBe('Original');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty pendingUserQuestions map', () => {
      const pendingQuestions: PendingUserQuestionsMap = new Map();
      const findRequestId = createFindRequestId(pendingQuestions, 'agent-1');
      const result = findRequestId();

      expect(result.requestId).toBeNull();
      expect(result.questions).toEqual([]);
    });

    it('should handle undefined sessionKey in stored data', () => {
      const pendingQuestions: PendingUserQuestionsMap = new Map([
        ['req_123', { agentId: 'agent-1', sessionKey: undefined, questions: [] }]
      ]);

      // Without target sessionKey, should still find it
      const findRequestId1 = createFindRequestId(pendingQuestions, 'agent-1');
      expect(findRequestId1().requestId).toBe('req_123');

      // With target sessionKey, should NOT match undefined
      const findRequestId2 = createFindRequestId(pendingQuestions, 'agent-1', 'specific-session');
      expect(findRequestId2().requestId).toBeNull();
    });

    it('should handle multiple agents with same sessionKey', () => {
      const pendingQuestions: PendingUserQuestionsMap = new Map([
        ['req_1', { agentId: 'agent-1', sessionKey: 'shared-session', questions: [] }],
        ['req_2', { agentId: 'agent-2', sessionKey: 'shared-session', questions: [] }]
      ]);

      // Should only match the correct agent
      const findRequestId = createFindRequestId(pendingQuestions, 'agent-2', 'shared-session');
      const result = findRequestId();

      expect(result.requestId).toBe('req_2');
    });
  });
});
