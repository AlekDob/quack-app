/**
 * Regression test for race condition between createSession and loadSessions.
 *
 * Brain: fix-session-create-race-load-overwrite
 *
 * Bug repro: when an agent transitioned from dormant to active, a fresh
 * `AgentSessionList` mounted and its on-mount `loadSessions()` ran concurrently
 * with `createSession`. The load read a stale disk snapshot (the just-created
 * session was still in flight) and overwrote the in-memory Zustand state,
 * dropping the new session. As a consequence, `onSessionClick(newSession.id)`
 * could not find it, the modal closed, and "no session was created" from the
 * user's perspective.
 *
 * Fix:
 *  1. `loadSessions` now respects `sessionWriteLock.shouldSkipReload()` and
 *     bails out early when a write is in flight.
 *  2. `createSession`/`updateSession`/`deleteSession`/`markDone` mark the
 *     write BEFORE awaiting `saveAgentSessions`, so concurrent reloads during
 *     the await observe the lock.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.mock is hoisted to the top, so the mock fns must live in vi.hoisted.
const { loadAgentSessionsMock, saveAgentSessionsMock } = vi.hoisted(() => ({
  loadAgentSessionsMock: vi.fn(),
  saveAgentSessionsMock: vi.fn(),
}));

// Bypass `persist` and `devtools` middlewares — we don't want localStorage I/O
// in unit tests, and the persist storage isn't wired in happy-dom.
vi.mock('zustand/middleware', () => ({
  persist: (config: unknown) => config,
  devtools: (config: unknown) => config,
}));

vi.mock('../services/unifiedAgentStorage', () => ({
  loadAgentSessions: loadAgentSessionsMock,
  saveAgentSessions: saveAgentSessionsMock,
}));

// Stats migration is fire-and-forget; stub it.
vi.mock('../services/projectStatsMigration', () => ({
  runProjectStatsMigrationIfNeeded: vi.fn().mockResolvedValue(undefined),
}));

// Brain diary on done is async; stub it.
vi.mock('../services/brainSessionService', () => ({
  appendBrainDiaryOnDone: vi.fn().mockResolvedValue(undefined),
}));

// Project stats store accesses Tauri at import; stub markSessionDeleted.
vi.mock('../stores/projectStatsStore', () => ({
  useProjectStatsStore: {
    getState: () => ({
      markSessionDeleted: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

import { useSessionStore, sessionWriteLock } from '../stores/sessionStore';
import type { AgentSession } from '../types';

const buildSession = (id: string, overrides?: Partial<AgentSession>): AgentSession => ({
  id,
  title: `Session ${id}`,
  agentId: 'agent-1',
  projectPath: '/test',
  projectName: 'test',
  status: 'in_progress',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  messageCount: 0,
  ...overrides,
});

describe('sessionStore race condition (fix-session-create-race-load-overwrite)', () => {
  beforeEach(() => {
    // Reset write lock so the guard does not bleed across tests
    sessionWriteLock.lastWriteAt = 0;

    loadAgentSessionsMock.mockReset();
    saveAgentSessionsMock.mockReset();

    // Reset Zustand store state
    useSessionStore.setState({
      sessions: [],
      selectedSessionId: null,
      activeAgentFilter: null,
      isLoading: false,
    });
  });

  it('preserves a freshly created session when loadSessions runs concurrently with stale disk data', async () => {
    // Arrange: disk has 2 sessions (the "stale" snapshot the file watcher would read).
    const existing = [buildSession('s1'), buildSession('s2')];
    useSessionStore.setState({ sessions: existing });
    loadAgentSessionsMock.mockResolvedValue(existing);

    // Slow save so we can interleave a concurrent loadSessions during the await
    let resolveSave: (() => void) | undefined;
    saveAgentSessionsMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        })
    );

    // Act: kick off createSession (won't resolve until we resolve the save)
    const createPromise = useSessionStore.getState().createSession({
      title: 'newly-created',
      agentId: 'agent-1',
      projectPath: '/test',
      projectName: 'test',
      status: 'in_progress',
      messageCount: 0,
    });

    // Give microtasks a tick so set({ sessions }) and markWrite have run
    await Promise.resolve();

    // Concurrent loadSessions (simulates a newly mounted AgentSessionList)
    await useSessionStore.getState().loadSessions({ silent: true });

    // The guard must have prevented the disk-stale set from clobbering memory:
    // the new session is still present in memory.
    const midFlight = useSessionStore.getState().sessions;
    expect(midFlight).toHaveLength(3);
    expect(midFlight.find((s) => s.title === 'newly-created')).toBeDefined();

    // Resolve the save and finish createSession
    resolveSave?.();
    const created = await createPromise;

    expect(created.title).toBe('newly-created');
    const final = useSessionStore.getState().sessions;
    expect(final).toHaveLength(3);
    expect(final.find((s) => s.id === created.id)).toBeDefined();
  });

  it('loadSessions still proceeds when no write is in flight', async () => {
    const fromDisk = [buildSession('disk-1'), buildSession('disk-2')];
    loadAgentSessionsMock.mockResolvedValue(fromDisk);

    // Ensure no recent write
    sessionWriteLock.lastWriteAt = 0;

    await useSessionStore.getState().loadSessions({ silent: true });

    expect(loadAgentSessionsMock).toHaveBeenCalledTimes(1);
    expect(useSessionStore.getState().sessions).toHaveLength(2);
  });

  it('loadSessions is skipped while the write lock is hot', async () => {
    const fromDisk = [buildSession('disk-1')];
    loadAgentSessionsMock.mockResolvedValue(fromDisk);

    // Pre-populate memory and mark a recent write.
    const inMemory = [buildSession('mem-1'), buildSession('mem-2')];
    useSessionStore.setState({ sessions: inMemory });
    sessionWriteLock.markWrite();

    await useSessionStore.getState().loadSessions({ silent: true });

    // The disk read must have been short-circuited.
    expect(loadAgentSessionsMock).not.toHaveBeenCalled();
    expect(useSessionStore.getState().sessions).toHaveLength(2);
  });
});
