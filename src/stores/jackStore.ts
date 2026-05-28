import { create } from 'zustand';
import type { ClaudeEvent } from '../types';

export interface JackAgentSnapshot {
  id: string;
  name: string;
  projectPath: string;
  projectName: string;
  color: string;
  avatar?: string;
  status: 'busy' | 'idle';
  activeSessions: number;
}

export interface JackProjectSnapshot {
  path: string;
  name: string;
  color: string;
  agentCount: number;
  activeSessionCount: number;
}

export type JackTimelineItem =
  | { kind: 'user'; id: string; content: string; timestamp: number }
  | { kind: 'event'; id: string; event: ClaudeEvent; timestamp: number };

export interface JackSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  timeline: JackTimelineItem[];
  /** SDK session ID, used to resume conversations across messages */
  sdkSessionId?: string;
}

interface JackStore {
  activeTab: 'chat' | 'control-center';
  agents: JackAgentSnapshot[];
  projects: JackProjectSnapshot[];
  isRefreshing: boolean;

  sessions: JackSession[];
  activeSessionId: string | null;
  /** Brain: fix-jack-multisession-events-wrong-session — id della sessione che sta attualmente streamando, null se nessuna */
  streamingSessionId: string | null;

  setActiveTab: (tab: 'chat' | 'control-center') => void;
  setAgents: (agents: JackAgentSnapshot[]) => void;
  setProjects: (projects: JackProjectSnapshot[]) => void;
  setRefreshing: (v: boolean) => void;

  loadSessions: (sessions: JackSession[]) => void;
  createSession: () => JackSession;
  selectSession: (id: string) => void;
  deleteSession: (id: string) => void;
  renameSession: (id: string, title: string) => void;
  appendToSession: (sessionId: string, item: JackTimelineItem) => void;
  updateLastEvent: (sessionId: string, itemId: string, mutator: (item: JackTimelineItem) => JackTimelineItem) => void;
  setSdkSessionId: (sessionId: string, sdkSessionId: string) => void;
  setStreamingSessionId: (id: string | null) => void;
}

function newSession(): JackSession {
  const now = Date.now();
  return {
    id: `jack-session-${now}-${Math.random().toString(36).slice(2, 7)}`,
    title: 'Nuova chat',
    createdAt: now,
    updatedAt: now,
    timeline: [],
  };
}

export const useJackStore = create<JackStore>((set, get) => ({
  activeTab: 'chat',
  agents: [],
  projects: [],
  isRefreshing: false,
  sessions: [],
  activeSessionId: null,
  streamingSessionId: null,

  setActiveTab: (tab) => set({ activeTab: tab }),
  setAgents: (agents) => set({ agents }),
  setProjects: (projects) => set({ projects }),
  setRefreshing: (v) => set({ isRefreshing: v }),

  loadSessions: (sessions) => {
    const sorted = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);
    set({
      sessions: sorted,
      activeSessionId: sorted[0]?.id ?? null,
    });
  },

  createSession: () => {
    const session = newSession();
    set((s) => ({
      sessions: [session, ...s.sessions],
      activeSessionId: session.id,
    }));
    return session;
  },

  selectSession: (id) => set({ activeSessionId: id }),

  deleteSession: (id) => {
    const { sessions, activeSessionId } = get();
    const next = sessions.filter((s) => s.id !== id);
    set({
      sessions: next,
      activeSessionId: activeSessionId === id ? (next[0]?.id ?? null) : activeSessionId,
    });
  },

  renameSession: (id, title) => {
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === id ? { ...sess, title, updatedAt: Date.now() } : sess
      ),
    }));
  },

  appendToSession: (sessionId, item) => {
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === sessionId
          ? { ...sess, timeline: [...sess.timeline, item], updatedAt: Date.now() }
          : sess
      ),
    }));
  },

  updateLastEvent: (sessionId, itemId, mutator) => {
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === sessionId
          ? {
              ...sess,
              timeline: sess.timeline.map((it) => (it.id === itemId ? mutator(it) : it)),
              updatedAt: Date.now(),
            }
          : sess
      ),
    }));
  },

  setSdkSessionId: (sessionId, sdkSessionId) => {
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === sessionId ? { ...sess, sdkSessionId } : sess
      ),
    }));
  },

  setStreamingSessionId: (id) => set({ streamingSessionId: id }),
}));
