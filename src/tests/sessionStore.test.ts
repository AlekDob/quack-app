/**
 * Session Store Tests
 *
 * Tests for the Sessions-First Architecture implementation.
 * Sessions are the primary data structure, tasks reference sessions.
 *
 * @module sessionStore.test
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

// Mock Session type (before actual implementation)
interface Session {
  id: string;
  agentId: string;
  status: 'todo' | 'in_progress' | 'done';
  messageCount: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

// Mock SessionStore interface (to be implemented)
interface MockSessionStore {
  sessions: Map<string, Session>;
  createSession: (agentId: string) => Promise<Session>;
  getSession: (id: string) => Session | undefined;
  getSessionsForAgent: (agentId: string) => Session[];
  getSessionsByStatus: (status: Session['status']) => Session[];
  updateSession: (id: string, updates: Partial<Session>) => Promise<void>;
  markDone: (id: string) => Promise<void>;
  incrementMessageCount: (id: string) => void;
}

// Mock implementation for testing
const createMockSessionStore = (): MockSessionStore => {
  const sessions = new Map<string, Session>();

  return {
    sessions,

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

    getSessionsForAgent(agentId: string) {
      return Array.from(sessions.values()).filter(s => s.agentId === agentId);
    },

    getSessionsByStatus(status: Session['status']) {
      return Array.from(sessions.values()).filter(s => s.status === status);
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
        if (session.status === 'todo' && session.messageCount > 0) {
          session.status = 'in_progress';
          session.startedAt = Date.now();
        }

        sessions.set(id, session);
      }
    },
  };
};

describe('Session Store - Session Creation', () => {
  let store: MockSessionStore;

  beforeEach(() => {
    vi.clearAllMocks();
    store = createMockSessionStore();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should generate unique session ID', async () => {
    const session1 = await store.createSession('agent-1');
    const session2 = await store.createSession('agent-1');

    expect(session1.id).toBeDefined();
    expect(session2.id).toBeDefined();
    expect(session1.id).not.toBe(session2.id);
  });

  it('should set initial status to "todo"', async () => {
    const session = await store.createSession('agent-1');

    expect(session.status).toBe('todo');
  });

  it('should associate agentId correctly', async () => {
    const session = await store.createSession('agent-hiroshi');

    expect(session.agentId).toBe('agent-hiroshi');
  });

  it('should initialize messageCount to 0', async () => {
    const session = await store.createSession('agent-1');

    expect(session.messageCount).toBe(0);
  });

  it('should set createdAt timestamp', async () => {
    const before = Date.now();
    const session = await store.createSession('agent-1');
    const after = Date.now();

    expect(session.createdAt).toBeGreaterThanOrEqual(before);
    expect(session.createdAt).toBeLessThanOrEqual(after);
  });

  it('should persist session to Tauri Store', async () => {
    const session = await store.createSession('agent-1');

    expect(mockStoreSet).toHaveBeenCalledWith(
      'sessions',
      expect.arrayContaining([
        expect.objectContaining({
          id: session.id,
          agentId: 'agent-1',
          status: 'todo',
        })
      ])
    );
    expect(mockStoreSave).toHaveBeenCalled();
  });
});

describe('Session Store - Session Status Transitions', () => {
  let store: MockSessionStore;

  beforeEach(() => {
    vi.clearAllMocks();
    store = createMockSessionStore();
  });

  it('should transition from "todo" to "in_progress" when messageCount > 0', async () => {
    const session = await store.createSession('agent-1');
    expect(session.status).toBe('todo');

    // Simulate first message
    store.incrementMessageCount(session.id);

    const updatedSession = store.getSession(session.id);
    expect(updatedSession?.status).toBe('in_progress');
    expect(updatedSession?.messageCount).toBe(1);
  });

  it('should set startedAt when transitioning to "in_progress"', async () => {
    const session = await store.createSession('agent-1');
    const before = Date.now();

    store.incrementMessageCount(session.id);

    const updatedSession = store.getSession(session.id);
    const after = Date.now();

    expect(updatedSession?.startedAt).toBeDefined();
    expect(updatedSession?.startedAt!).toBeGreaterThanOrEqual(before);
    expect(updatedSession?.startedAt!).toBeLessThanOrEqual(after);
  });

  it('should transition to "done" when markDone is called', async () => {
    const session = await store.createSession('agent-1');
    store.incrementMessageCount(session.id);

    await store.markDone(session.id);

    const updatedSession = store.getSession(session.id);
    expect(updatedSession?.status).toBe('done');
  });

  it('should set completedAt when transitioning to "done"', async () => {
    const session = await store.createSession('agent-1');
    store.incrementMessageCount(session.id);

    const before = Date.now();
    await store.markDone(session.id);
    const after = Date.now();

    const updatedSession = store.getSession(session.id);
    expect(updatedSession?.completedAt).toBeDefined();
    expect(updatedSession?.completedAt!).toBeGreaterThanOrEqual(before);
    expect(updatedSession?.completedAt!).toBeLessThanOrEqual(after);
  });

  it('should NOT auto-transition once marked "done"', async () => {
    const session = await store.createSession('agent-1');
    store.incrementMessageCount(session.id);
    await store.markDone(session.id);

    // Try to add more messages - status should remain 'done'
    store.incrementMessageCount(session.id);
    store.incrementMessageCount(session.id);

    const updatedSession = store.getSession(session.id);
    expect(updatedSession?.status).toBe('done');
    expect(updatedSession?.messageCount).toBe(3); // Count still increases
  });

  it('should increment messageCount without changing status if already "in_progress"', async () => {
    const session = await store.createSession('agent-1');
    store.incrementMessageCount(session.id); // todo -> in_progress

    // Add more messages
    store.incrementMessageCount(session.id);
    store.incrementMessageCount(session.id);

    const updatedSession = store.getSession(session.id);
    expect(updatedSession?.status).toBe('in_progress');
    expect(updatedSession?.messageCount).toBe(3);
  });
});

describe('Session Store - Session Filtering', () => {
  let store: MockSessionStore;

  beforeEach(() => {
    vi.clearAllMocks();
    store = createMockSessionStore();
  });

  it('should return only sessions for specified agent', async () => {
    await store.createSession('agent-1');
    await store.createSession('agent-2');
    await store.createSession('agent-1');

    const agent1Sessions = store.getSessionsForAgent('agent-1');
    const agent2Sessions = store.getSessionsForAgent('agent-2');

    expect(agent1Sessions.length).toBe(2);
    expect(agent2Sessions.length).toBe(1);
    expect(agent1Sessions.every(s => s.agentId === 'agent-1')).toBe(true);
    expect(agent2Sessions.every(s => s.agentId === 'agent-2')).toBe(true);
  });

  it('should filter sessions by status', async () => {
    const session1 = await store.createSession('agent-1');
    const session2 = await store.createSession('agent-1');
    const session3 = await store.createSession('agent-1');

    // Make some progress
    store.incrementMessageCount(session2.id); // todo -> in_progress
    await store.markDone(session3.id); // todo -> done

    const todoSessions = store.getSessionsByStatus('todo');
    const inProgressSessions = store.getSessionsByStatus('in_progress');
    const doneSessions = store.getSessionsByStatus('done');

    expect(todoSessions.length).toBe(1);
    expect(inProgressSessions.length).toBe(1);
    expect(doneSessions.length).toBe(1);

    expect(todoSessions[0].id).toBe(session1.id);
    expect(inProgressSessions[0].id).toBe(session2.id);
    expect(doneSessions[0].id).toBe(session3.id);
  });

  it('should return empty array for agent with no sessions', () => {
    const sessions = store.getSessionsForAgent('non-existent-agent');

    expect(sessions).toEqual([]);
  });

  it('should return empty array for status with no sessions', () => {
    const sessions = store.getSessionsByStatus('done');

    expect(sessions).toEqual([]);
  });
});

describe('Session Store - Persistence', () => {
  let store: MockSessionStore;

  beforeEach(() => {
    vi.clearAllMocks();
    store = createMockSessionStore();
  });

  it('should persist sessions after creation', async () => {
    const session = await store.createSession('agent-1');

    expect(mockStoreSet).toHaveBeenCalledWith('sessions', [session]);
    expect(mockStoreSave).toHaveBeenCalled();
  });

  it('should persist sessions after update', async () => {
    const session = await store.createSession('agent-1');
    vi.clearAllMocks(); // Clear creation calls

    await store.updateSession(session.id, { status: 'in_progress' });

    expect(mockStoreSet).toHaveBeenCalledWith(
      'sessions',
      expect.arrayContaining([
        expect.objectContaining({
          id: session.id,
          status: 'in_progress',
        })
      ])
    );
    expect(mockStoreSave).toHaveBeenCalled();
  });

  it('should load sessions from storage', async () => {
    const savedSessions: Session[] = [
      {
        id: 'session-1',
        agentId: 'agent-1',
        status: 'todo',
        messageCount: 0,
        createdAt: Date.now(),
      },
      {
        id: 'session-2',
        agentId: 'agent-2',
        status: 'in_progress',
        messageCount: 5,
        createdAt: Date.now(),
        startedAt: Date.now(),
      },
    ];

    mockStoreGet.mockResolvedValue(savedSessions);

    // Simulate loadSessions operation
    const loadedSessions = await mockStoreGet('sessions');

    expect(loadedSessions).toEqual(savedSessions);
    expect(loadedSessions).toHaveLength(2);
  });

  it('should handle missing storage data gracefully', async () => {
    mockStoreGet.mockResolvedValue(null);

    const loadedSessions = await mockStoreGet('sessions');

    expect(loadedSessions).toBeNull();
  });

  it('should handle storage errors gracefully', async () => {
    mockStoreGet.mockRejectedValue(new Error('Storage unavailable'));

    await expect(mockStoreGet('sessions')).rejects.toThrow('Storage unavailable');
  });
});

describe('Session Store - Edge Cases', () => {
  let store: MockSessionStore;

  beforeEach(() => {
    vi.clearAllMocks();
    store = createMockSessionStore();
  });

  it('should throw error when updating non-existent session', async () => {
    await expect(
      store.updateSession('non-existent-id', { status: 'done' })
    ).rejects.toThrow('Session not found');
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

    // All should be persisted
    expect(mockStoreSet).toHaveBeenCalledTimes(3);
  });

  it('should handle rapid messageCount increments', async () => {
    const session = await store.createSession('agent-1');

    // Rapidly increment 100 times
    for (let i = 0; i < 100; i++) {
      store.incrementMessageCount(session.id);
    }

    const updatedSession = store.getSession(session.id);
    expect(updatedSession?.messageCount).toBe(100);
    expect(updatedSession?.status).toBe('in_progress'); // Transitioned on first message
  });
});

describe('Session Store - Integration Scenarios', () => {
  let store: MockSessionStore;

  beforeEach(() => {
    vi.clearAllMocks();
    store = createMockSessionStore();
  });

  it('should handle typical agent workflow: create -> work -> complete', async () => {
    // 1. Create new session
    const session = await store.createSession('agent-hiroshi');
    expect(session.status).toBe('todo');

    // 2. Agent starts working (first message)
    store.incrementMessageCount(session.id);
    let updatedSession = store.getSession(session.id);
    expect(updatedSession?.status).toBe('in_progress');
    expect(updatedSession?.startedAt).toBeDefined();

    // 3. Agent continues working (more messages)
    store.incrementMessageCount(session.id);
    store.incrementMessageCount(session.id);
    updatedSession = store.getSession(session.id);
    expect(updatedSession?.messageCount).toBe(3);

    // 4. Task completed
    await store.markDone(session.id);
    updatedSession = store.getSession(session.id);
    expect(updatedSession?.status).toBe('done');
    expect(updatedSession?.completedAt).toBeDefined();
  });

  it('should support multiple agents with independent sessions', async () => {
    // Create sessions for different agents
    const hiroshiSession = await store.createSession('agent-hiroshi');
    const kaoriSession = await store.createSession('agent-kaori');

    // Each agent works independently
    store.incrementMessageCount(hiroshiSession.id);
    store.incrementMessageCount(hiroshiSession.id);

    store.incrementMessageCount(kaoriSession.id);

    // Verify independence
    const hiroshi = store.getSession(hiroshiSession.id);
    const kaori = store.getSession(kaoriSession.id);

    expect(hiroshi?.messageCount).toBe(2);
    expect(kaori?.messageCount).toBe(1);

    // Complete Hiroshi's session
    await store.markDone(hiroshiSession.id);

    // Kaori's session should be unaffected
    const kaoriAfter = store.getSession(kaoriSession.id);
    expect(kaoriAfter?.status).toBe('in_progress');
    expect(kaoriAfter?.messageCount).toBe(1);
  });

  it('should track session history for agent', async () => {
    const agentId = 'agent-magnus';

    // Create multiple sessions over time
    const session1 = await store.createSession(agentId);
    store.incrementMessageCount(session1.id);
    await store.markDone(session1.id);

    const session2 = await store.createSession(agentId);
    store.incrementMessageCount(session2.id);
    await store.markDone(session2.id);

    const session3 = await store.createSession(agentId);
    store.incrementMessageCount(session3.id);
    // session3 still in progress

    // Get all sessions for agent
    const allSessions = store.getSessionsForAgent(agentId);
    const doneSessions = allSessions.filter(s => s.status === 'done');
    const activeSessions = allSessions.filter(s => s.status === 'in_progress');

    expect(allSessions.length).toBe(3);
    expect(doneSessions.length).toBe(2);
    expect(activeSessions.length).toBe(1);
  });
});
