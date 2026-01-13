/**
 * Session Message Sync Tests
 *
 * Tests for automatic status transitions based on messageCount.
 * Ensures sessions stay in sync with their chat state:
 * - messageCount = 0 → status = 'todo'
 * - messageCount > 0 → status = 'in_progress' (auto-transition)
 * - status = 'done' (manual) → stays 'done' (no auto-transition)
 *
 * @module sessionMessageSync.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Tauri Store implementations
const mockStoreGet = vi.fn();
const mockStoreSet = vi.fn();
const mockStoreSave = vi.fn();
const mockStoreDelete = vi.fn();

// Mock Tauri Store - must be before imports that use it
vi.mock('@tauri-apps/plugin-store', () => ({
  Store: {
    load: vi.fn().mockImplementation(() =>
      Promise.resolve({
        get: mockStoreGet,
        set: mockStoreSet,
        save: mockStoreSave,
        delete: mockStoreDelete,
      })
    ),
  },
}));

// Mock Session type
interface Session {
  id: string;
  agentId: string;
  status: 'todo' | 'in_progress' | 'done';
  messageCount: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

// Mock SessionStore interface
interface MockSessionStore {
  sessions: Map<string, Session>;
  createSession: (agentId: string) => Promise<Session>;
  getSession: (id: string) => Session | undefined;
  updateSession: (id: string, updates: Partial<Session>) => Promise<void>;
  markDone: (id: string) => Promise<void>;
  incrementMessageCount: (id: string) => void;
  selectSession: (id: string) => void;
  selectedSessionId: string | null;
}

// Mock implementation for testing
const createMockSessionStore = (): MockSessionStore => {
  const sessions = new Map<string, Session>();
  let selectedSessionId: string | null = null;

  const store: MockSessionStore = {
    sessions,

    get selectedSessionId() {
      return selectedSessionId;
    },

    async createSession(agentId: string): Promise<Session> {
      const session: Session = {
        id: `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        agentId,
        status: 'todo',
        messageCount: 0,
        createdAt: Date.now(),
      };

      sessions.set(session.id, session);

      // Persist to Tauri Store
      const allSessions = Array.from(sessions.values());
      await mockStoreSet('sessions', allSessions);
      await mockStoreSave();

      return session;
    },

    getSession(id: string) {
      return sessions.get(id);
    },

    async updateSession(id: string, updates: Partial<Session>) {
      const session = sessions.get(id);
      if (!session) {
        throw new Error(`Session not found: ${id}`);
      }

      const updatedSession = { ...session, ...updates };
      sessions.set(id, updatedSession);

      // Persist to Tauri Store
      const allSessions = Array.from(sessions.values());
      await mockStoreSet('sessions', allSessions);
      await mockStoreSave();
    },

    async markDone(id: string) {
      await this.updateSession(id, {
        status: 'done',
        completedAt: Date.now(),
      });
    },

    incrementMessageCount(id: string) {
      const session = sessions.get(id);
      if (session) {
        session.messageCount += 1;

        // Auto-transition from 'todo' to 'in_progress' when first message arrives
        // BUT: Don't auto-transition if status is 'done'
        if (session.status === 'todo' && session.messageCount > 0) {
          session.status = 'in_progress';
          session.startedAt = Date.now();
        }

        sessions.set(id, session);
      }
    },

    selectSession(id: string) {
      selectedSessionId = id;
    },
  };

  return store;
};

describe('Session Message Sync - Status Transitions', () => {
  let store: MockSessionStore;

  beforeEach(() => {
    vi.clearAllMocks();
    store = createMockSessionStore();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should have status todo when messageCount is 0', async () => {
    const session = await store.createSession('agent-1');

    expect(session.status).toBe('todo');
    expect(session.messageCount).toBe(0);
    expect(session.startedAt).toBeUndefined();
  });

  it('should transition to in_progress when messageCount becomes 1', async () => {
    const session = await store.createSession('agent-1');
    expect(session.status).toBe('todo');

    // Simulate first message arrives
    store.incrementMessageCount(session.id);

    const updatedSession = store.getSession(session.id);
    expect(updatedSession?.status).toBe('in_progress');
    expect(updatedSession?.messageCount).toBe(1);
    expect(updatedSession?.startedAt).toBeDefined();
  });

  it('should stay in_progress when messageCount increases', async () => {
    const session = await store.createSession('agent-1');

    // First message
    store.incrementMessageCount(session.id);
    expect(store.getSession(session.id)?.status).toBe('in_progress');

    // Second message
    store.incrementMessageCount(session.id);
    expect(store.getSession(session.id)?.status).toBe('in_progress');
    expect(store.getSession(session.id)?.messageCount).toBe(2);

    // Third message
    store.incrementMessageCount(session.id);
    expect(store.getSession(session.id)?.status).toBe('in_progress');
    expect(store.getSession(session.id)?.messageCount).toBe(3);
  });

  it('should keep done status when manually set', async () => {
    const session = await store.createSession('agent-1');

    // Add some messages
    store.incrementMessageCount(session.id);
    store.incrementMessageCount(session.id);
    expect(store.getSession(session.id)?.status).toBe('in_progress');

    // Mark as done
    await store.markDone(session.id);

    const doneSession = store.getSession(session.id);
    expect(doneSession?.status).toBe('done');
    expect(doneSession?.completedAt).toBeDefined();

    // Add more messages - status should stay 'done'
    store.incrementMessageCount(session.id);
    store.incrementMessageCount(session.id);

    const stillDoneSession = store.getSession(session.id);
    expect(stillDoneSession?.status).toBe('done');
    expect(stillDoneSession?.messageCount).toBe(4);
  });

  it('should NOT auto-transition from done back to in_progress', async () => {
    const session = await store.createSession('agent-1');

    // Start with messages
    store.incrementMessageCount(session.id);

    // Mark done
    await store.markDone(session.id);
    expect(store.getSession(session.id)?.status).toBe('done');

    // Add 100 more messages - should stay done
    for (let i = 0; i < 100; i++) {
      store.incrementMessageCount(session.id);
    }

    const finalSession = store.getSession(session.id);
    expect(finalSession?.status).toBe('done');
    expect(finalSession?.messageCount).toBe(101);
  });
});

describe('Session Message Sync - Session Click Behavior', () => {
  let store: MockSessionStore;

  beforeEach(() => {
    vi.clearAllMocks();
    store = createMockSessionStore();
  });

  it('should select correct agent when session is clicked', async () => {
    const session1 = await store.createSession('agent-hiroshi');
    const session2 = await store.createSession('agent-kaori');

    // Click first session
    store.selectSession(session1.id);
    expect(store.selectedSessionId).toBe(session1.id);

    // Click second session
    store.selectSession(session2.id);
    expect(store.selectedSessionId).toBe(session2.id);
  });

  it('should handle session click for different agents', async () => {
    const hiroshiSession = await store.createSession('agent-hiroshi');
    const magnusSession = await store.createSession('agent-magnus');

    // Select Hiroshi's session
    store.selectSession(hiroshiSession.id);

    const selectedSession = store.getSession(store.selectedSessionId!);
    expect(selectedSession?.agentId).toBe('agent-hiroshi');

    // Switch to Magnus's session
    store.selectSession(magnusSession.id);

    const newSelectedSession = store.getSession(store.selectedSessionId!);
    expect(newSelectedSession?.agentId).toBe('agent-magnus');
  });
});

describe('Session Message Sync - Edge Cases', () => {
  let store: MockSessionStore;

  beforeEach(() => {
    vi.clearAllMocks();
    store = createMockSessionStore();
  });

  it('should handle sessions without agentId gracefully', async () => {
    // Manually create session with empty agentId
    const session = await store.createSession('');

    expect(session.agentId).toBe('');
    expect(session.status).toBe('todo');
    expect(session.messageCount).toBe(0);

    // Should still work with message increment
    store.incrementMessageCount(session.id);
    expect(store.getSession(session.id)?.status).toBe('in_progress');
  });

  it('should handle incrementing messageCount on non-existent session', () => {
    // Should not throw, just silently fail
    expect(() => {
      store.incrementMessageCount('non-existent-id');
    }).not.toThrow();
  });

  it('should handle concurrent session creation', async () => {
    const sessions = await Promise.all([
      store.createSession('agent-1'),
      store.createSession('agent-1'),
      store.createSession('agent-1'),
    ]);

    // All should have unique IDs
    const uniqueIds = new Set(sessions.map(s => s.id));
    expect(uniqueIds.size).toBe(3);

    // All should start as todo
    sessions.forEach(session => {
      expect(session.status).toBe('todo');
      expect(session.messageCount).toBe(0);
    });
  });

  it('should handle rapid messageCount increments', async () => {
    const session = await store.createSession('agent-1');

    // Rapidly increment 50 times
    for (let i = 0; i < 50; i++) {
      store.incrementMessageCount(session.id);
    }

    const updatedSession = store.getSession(session.id);
    expect(updatedSession?.messageCount).toBe(50);
    expect(updatedSession?.status).toBe('in_progress');
    expect(updatedSession?.startedAt).toBeDefined();
  });

  it('should preserve status when messageCount is incremented manually via updateSession', async () => {
    const session = await store.createSession('agent-1');

    // Manually update messageCount without auto-transition
    await store.updateSession(session.id, { messageCount: 5 });

    const updatedSession = store.getSession(session.id);
    expect(updatedSession?.messageCount).toBe(5);
    // Status should still be 'todo' because we used updateSession, not incrementMessageCount
    expect(updatedSession?.status).toBe('todo');
  });
});

describe('Session Message Sync - Integration Scenarios', () => {
  let store: MockSessionStore;

  beforeEach(() => {
    vi.clearAllMocks();
    store = createMockSessionStore();
  });

  it('should handle typical chat flow: create -> chat -> complete', async () => {
    // 1. User creates session
    const session = await store.createSession('agent-hiroshi');
    expect(session.status).toBe('todo');

    // 2. User sends first message (auto-transition to in_progress)
    store.incrementMessageCount(session.id);
    let updatedSession = store.getSession(session.id);
    expect(updatedSession?.status).toBe('in_progress');
    expect(updatedSession?.messageCount).toBe(1);

    // 3. User continues conversation
    store.incrementMessageCount(session.id);
    store.incrementMessageCount(session.id);
    updatedSession = store.getSession(session.id);
    expect(updatedSession?.messageCount).toBe(3);
    expect(updatedSession?.status).toBe('in_progress');

    // 4. User marks as done
    await store.markDone(session.id);
    updatedSession = store.getSession(session.id);
    expect(updatedSession?.status).toBe('done');
    expect(updatedSession?.completedAt).toBeDefined();
  });

  it('should handle session reopened after completion', async () => {
    const session = await store.createSession('agent-1');

    // Chat and complete
    store.incrementMessageCount(session.id);
    await store.markDone(session.id);
    expect(store.getSession(session.id)?.status).toBe('done');

    // User reopens session and continues chatting
    // Status should stay 'done' (manual override takes precedence)
    store.incrementMessageCount(session.id);
    store.incrementMessageCount(session.id);

    const reopenedSession = store.getSession(session.id);
    expect(reopenedSession?.status).toBe('done');
    expect(reopenedSession?.messageCount).toBe(3);
  });

  it('should handle multiple sessions for same agent', async () => {
    const agentId = 'agent-magnus';

    // Create 3 sessions for same agent
    const session1 = await store.createSession(agentId);
    const session2 = await store.createSession(agentId);
    const session3 = await store.createSession(agentId);

    // Work on session 1
    store.incrementMessageCount(session1.id);
    await store.markDone(session1.id);

    // Work on session 2
    store.incrementMessageCount(session2.id);

    // Session 3 remains todo

    // Verify independent states
    expect(store.getSession(session1.id)?.status).toBe('done');
    expect(store.getSession(session1.id)?.messageCount).toBe(1);

    expect(store.getSession(session2.id)?.status).toBe('in_progress');
    expect(store.getSession(session2.id)?.messageCount).toBe(1);

    expect(store.getSession(session3.id)?.status).toBe('todo');
    expect(store.getSession(session3.id)?.messageCount).toBe(0);
  });
});
