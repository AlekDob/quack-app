/**
 * Session Store
 *
 * Zustand store for managing agent sessions (chat sessions-first architecture).
 * Each agent can own multiple sessions with independent chat histories.
 * Replaces task-based approach with session-based approach.
 *
 * @module sessionStore
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { AgentSession, AgentSessionStatus } from '../types';
import { loadAgentSessions, saveAgentSessions } from '../services/sessionStorage';

/**
 * Write lock to prevent race conditions between local writes and file watcher reloads.
 * When a write operation is in progress, the polling hook should skip reloads.
 */
export const sessionWriteLock = {
  /** Timestamp of last write operation */
  lastWriteAt: 0,
  /** Debounce period in ms - ignore file watcher events for this duration after a write */
  DEBOUNCE_MS: 500,

  /** Mark that a write operation just happened */
  markWrite() {
    this.lastWriteAt = Date.now();
    console.log('[sessionWriteLock] Write marked at', this.lastWriteAt);
  },

  /** Check if we should skip a reload (within debounce period of last write) */
  shouldSkipReload(): boolean {
    const elapsed = Date.now() - this.lastWriteAt;
    const skip = elapsed < this.DEBOUNCE_MS;
    if (skip) {
      console.log(`[sessionWriteLock] Skipping reload (${elapsed}ms since last write, debounce: ${this.DEBOUNCE_MS}ms)`);
    }
    return skip;
  }
};

interface SessionState {
  // State
  sessions: AgentSession[];
  selectedSessionId: string | null;
  activeAgentFilter: string | null; // Filter sessions by agent ID
  isLoading: boolean;

  // Actions
  loadSessions: (options?: { silent?: boolean }) => Promise<void>;
  createSession: (session: Omit<AgentSession, 'id' | 'createdAt' | 'updatedAt'>) => Promise<AgentSession>;
  updateSession: (id: string, updates: Partial<AgentSession>) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  markDone: (id: string, completionNote?: string) => Promise<void>;
  selectSession: (id: string | null) => void;
  setActiveAgentFilter: (agentId: string | null) => void;

  // Selectors
  getSessionsForAgent: (agentId: string) => AgentSession[];
  getSessionsByStatus: (status: AgentSessionStatus) => AgentSession[];
  getSelectedSession: () => AgentSession | null;
}

/**
 * Generate unique ID for sessions
 */
const generateSessionId = (): string => {
  return `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

export const useSessionStore = create<SessionState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        sessions: [],
        selectedSessionId: null,
        activeAgentFilter: null,
        isLoading: false,

        // Load sessions from storage
        // Use { silent: true } for background polling to avoid showing loading indicator
        loadSessions: async (options) => {
          const silent = options?.silent ?? false;
          if (!silent) {
            set({ isLoading: true });
          }
          try {
            const sessions = await loadAgentSessions();
            set({ sessions, isLoading: false });
          } catch (error) {
            console.error('[sessionStore] Failed to load sessions:', error);
            if (!silent) {
              set({ isLoading: false });
            }
          }
        },

        // Create a new session
        createSession: async (sessionData) => {
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/3ea3e874-66c9-4ccd-807c-e75a9897e915',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sessionStore.ts:createSession',message:'📝 NEW SESSION CREATED',data:{title:sessionData.title,agentId:sessionData.agentId,projectPath:sessionData.projectPath,stack:new Error().stack?.split('\n').slice(0,10)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C-session-create'})}).catch(()=>{});
          // #endregion
          const newSession: AgentSession = {
            ...sessionData,
            id: generateSessionId(),
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };

          const sessions = [...get().sessions, newSession];
          set({ sessions });

          // Persist to storage and mark write to prevent race condition with file watcher
          await saveAgentSessions(sessions);
          sessionWriteLock.markWrite();

          console.log('[sessionStore] Created session:', newSession.id, newSession.title);
          return newSession;
        },

        // Update an existing session
        updateSession: async (id, updates) => {
          const sessions = get().sessions.map((session) =>
            session.id === id
              ? { ...session, ...updates, updatedAt: Date.now() }
              : session
          );
          set({ sessions });

          // Persist to storage and mark write to prevent race condition
          await saveAgentSessions(sessions);
          sessionWriteLock.markWrite();

          console.log('[sessionStore] Updated session:', id);
        },

        // Delete a session
        deleteSession: async (id) => {
          const { selectedSessionId } = get();

          const sessions = get().sessions.filter((s) => s.id !== id);
          set({
            sessions,
            selectedSessionId: selectedSessionId === id ? null : selectedSessionId,
          });

          // Persist to storage and mark write to prevent race condition
          await saveAgentSessions(sessions);
          sessionWriteLock.markWrite();

          console.log('[sessionStore] Deleted session:', id);
        },

        // Mark session as done
        markDone: async (id, completionNote) => {
          const sessions = get().sessions.map((session) =>
            session.id === id
              ? {
                  ...session,
                  status: 'done' as AgentSessionStatus,
                  completedAt: Date.now(),
                  updatedAt: Date.now(),
                }
              : session
          );
          set({ sessions });

          // Persist to storage and mark write to prevent race condition
          await saveAgentSessions(sessions);
          sessionWriteLock.markWrite();

          console.log('[sessionStore] Marked session as done:', id, completionNote);
        },

        // Select a session
        selectSession: (id) => {
          set({ selectedSessionId: id });
          if (id) {
            console.log('[sessionStore] Selected session:', id);
          }
        },

        // Set active agent filter
        setActiveAgentFilter: (agentId) => {
          set({ activeAgentFilter: agentId });
          console.log('[sessionStore] Active agent filter:', agentId);
        },

        // Selector: Get sessions for a specific agent
        getSessionsForAgent: (agentId) => {
          return get().sessions.filter((s) => s.agentId === agentId);
        },

        // Selector: Get sessions by status
        getSessionsByStatus: (status) => {
          return get().sessions.filter((s) => s.status === status);
        },

        // Selector: Get the currently selected session
        getSelectedSession: () => {
          const { sessions, selectedSessionId } = get();
          if (!selectedSessionId) return null;
          return sessions.find((s) => s.id === selectedSessionId) ?? null;
        },
      }),
      {
        name: 'session-storage',
        // Only persist UI state, not sessions (sessions are in Tauri Store)
        partialize: (state) => ({
          selectedSessionId: state.selectedSessionId,
          activeAgentFilter: state.activeAgentFilter,
        }),
      }
    ),
    { name: 'session-store' }
  )
);
