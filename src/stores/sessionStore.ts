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
import { loadAgentSessions, saveAgentSessions } from '../services/unifiedAgentStorage';
import { sessionWriteLock } from './sessionWriteLock';
import { appendBrainDiaryOnDone } from '../services/brainSessionService';

/**
 * Maximum messages allowed per session before archiving is recommended
 */
const MAX_MESSAGES_PER_SESSION = 1000;

/**
 * Check if a session should be archived due to size
 * @param session The session to check
 * @returns true if session has exceeded the message limit
 */
export function shouldArchiveSession(session: AgentSession): boolean {
  return session.messageCount > MAX_MESSAGES_PER_SESSION;
}

// Brain: fix-automation-session-title-missing
// Re-export from extracted module to avoid circular dependency with unifiedAgentStorage
export { sessionWriteLock } from './sessionWriteLock';

interface SessionState {
  // State
  sessions: AgentSession[];
  selectedSessionId: string | null;
  activeAgentFilter: string | null; // Filter sessions by agent ID
  isLoading: boolean;

  // Actions
  loadSessions: (options?: { silent?: boolean }) => Promise<void>;
  createSession: (session: Omit<AgentSession, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<AgentSession>;
  updateSession: (id: string, updates: Partial<AgentSession>) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  markDone: (id: string, completionNote?: string) => Promise<void>;
  selectSession: (id: string | null) => void;
  setActiveAgentFilter: (agentId: string | null) => void;

  // Selectors
  getSessionsForAgent: (agentId: string) => AgentSession[];
  getSessionsByStatus: (status: AgentSessionStatus) => AgentSession[];
  getSelectedSession: () => AgentSession | null;
  getLargeSessions: () => AgentSession[];
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
            const previousCount = get().sessions.length;
            const sessions = await loadAgentSessions();
            console.log(`[sessionStore] loadSessions: previous=${previousCount}, loaded=${sessions.length}`);
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
          // Dedup: if an ID was provided and already exists, return existing session
          if (sessionData.id) {
            const existing = get().sessions.find(s => s.id === sessionData.id);
            if (existing) {
              console.log('[sessionStore] Session already exists, skipping duplicate:', sessionData.id);
              return existing;
            }
          }

          const newSession: AgentSession = {
            ...sessionData,
            id: sessionData.id || generateSessionId(),
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
          const sessions = get().sessions.map((session) => {
            if (session.id === id) {
              const updatedSession = { ...session, ...updates, updatedAt: Date.now() };

              // Brain: fix-automation-session-title-missing
              // Defense-in-depth: ensure required fields are never lost during updates.
              // Race conditions between store.reload() and store.save() can cause
              // the base session object to lose title/status, resulting in "Untitled" sessions.
              if (!updatedSession.title) {
                console.warn(`[sessionStore] ⚠️ Session ${id} lost title during update — restoring from original`);
                updatedSession.title = session.title || `Session ${id.slice(-6)}`;
              }
              if (!updatedSession.status) {
                console.warn(`[sessionStore] ⚠️ Session ${id} lost status during update — restoring from original`);
                updatedSession.status = session.status || 'in_progress';
              }

              // Check if session has exceeded message limit (soft warning)
              if (shouldArchiveSession(updatedSession)) {
                console.warn(
                  `[sessionStore] Session ${id} has exceeded message limit (${updatedSession.messageCount}/${MAX_MESSAGES_PER_SESSION})`
                );
              }

              return updatedSession;
            }
            return session;
          });
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

          // Brain: pattern-brain-hooks — auto-diary on session done
          const doneSession = sessions.find((s) => s.id === id);
          if (doneSession?.projectPath) {
            appendBrainDiaryOnDone(doneSession).catch((err) =>
              console.warn('[sessionStore] Brain diary append failed:', err)
            );
          }
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

        // Selector: Get sessions that have exceeded the message limit
        getLargeSessions: () => {
          return get().sessions.filter(shouldArchiveSession);
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
