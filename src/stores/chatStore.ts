import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { ChatMessage, AgentChat, SessionUsage, AgentInfo } from '../types';

interface ChatState {
  // State
  chatSessions: Map<string, ChatMessage[]>;
  agentChats: AgentChat[];
  chatLoadingMap: Map<string, boolean>;
  chatTokensMap: Map<string, SessionUsage>;
  activeAgent: AgentInfo | null;
  streamingMessage: ChatMessage | null;

  // Actions
  addMessage: (sessionId: string, message: ChatMessage) => void;
  updateMessage: (sessionId: string, messageId: string, updates: Partial<ChatMessage>) => void;
  clearSession: (sessionId: string) => void;
  setLoading: (sessionId: string, loading: boolean) => void;
  updateTokens: (sessionId: string, tokens: SessionUsage) => void;
  setActiveAgent: (agent: AgentInfo | null) => void;
  setStreamingMessage: (message: ChatMessage | null) => void;

  // Agent chat actions
  addAgentChat: (chat: AgentChat) => void;
  updateAgentChat: (id: string, updates: Partial<AgentChat>) => void;
  removeAgentChat: (id: string) => void;

  // Selectors
  getSession: (sessionId: string) => ChatMessage[];
  getLastMessage: (sessionId: string) => ChatMessage | undefined;
  isSessionLoading: (sessionId: string) => boolean;
  getSessionTokens: (sessionId: string) => SessionUsage | undefined;
  getAgentChatById: (id: string) => AgentChat | undefined;
}

export const useChatStore = create<ChatState>()(
  devtools((set, get) => ({
    chatSessions: new Map(),
    agentChats: [],
    chatLoadingMap: new Map(),
    chatTokensMap: new Map(),
    activeAgent: null,
    streamingMessage: null,

    addMessage: (sessionId, message) => set((state) => {
      const newSessions = new Map(state.chatSessions);
      const messages = newSessions.get(sessionId) || [];
      newSessions.set(sessionId, [...messages, message]);
      return { chatSessions: newSessions };
    }),

    updateMessage: (sessionId, messageId, updates) => set((state) => {
      const newSessions = new Map(state.chatSessions);
      const messages = newSessions.get(sessionId) || [];
      newSessions.set(
        sessionId,
        messages.map((m) => (m.id === messageId ? { ...m, ...updates } : m))
      );
      return { chatSessions: newSessions };
    }),

    clearSession: (sessionId) => set((state) => {
      const newSessions = new Map(state.chatSessions);
      newSessions.delete(sessionId);
      const newLoadingMap = new Map(state.chatLoadingMap);
      newLoadingMap.delete(sessionId);
      const newTokensMap = new Map(state.chatTokensMap);
      newTokensMap.delete(sessionId);
      return {
        chatSessions: newSessions,
        chatLoadingMap: newLoadingMap,
        chatTokensMap: newTokensMap,
        streamingMessage: null
      };
    }),

    setLoading: (sessionId, loading) => set((state) => {
      const newLoadingMap = new Map(state.chatLoadingMap);
      if (loading) {
        newLoadingMap.set(sessionId, loading);
      } else {
        newLoadingMap.delete(sessionId);
      }
      return { chatLoadingMap: newLoadingMap };
    }),

    updateTokens: (sessionId, tokens) => set((state) => {
      const newTokensMap = new Map(state.chatTokensMap);
      newTokensMap.set(sessionId, tokens);
      return { chatTokensMap: newTokensMap };
    }),

    setActiveAgent: (agent) => set({ activeAgent: agent }),

    setStreamingMessage: (message) => set({ streamingMessage: message }),

    // Agent chat actions
    addAgentChat: (chat) => set((state) => ({
      agentChats: [...state.agentChats, chat],
    })),

    updateAgentChat: (id, updates) => set((state) => ({
      agentChats: state.agentChats.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    })),

    removeAgentChat: (id) => set((state) => ({
      agentChats: state.agentChats.filter((c) => c.id !== id),
    })),

    // Selectors
    getSession: (sessionId) => {
      const state = get();
      return state.chatSessions.get(sessionId) || [];
    },

    getLastMessage: (sessionId) => {
      const messages = get().getSession(sessionId);
      return messages[messages.length - 1];
    },

    isSessionLoading: (sessionId) => {
      const state = get();
      return state.chatLoadingMap.get(sessionId) ?? false;
    },

    getSessionTokens: (sessionId) => {
      const state = get();
      return state.chatTokensMap.get(sessionId);
    },

    getAgentChatById: (id) => {
      const state = get();
      return state.agentChats.find((c) => c.id === id);
    },
  }), { name: 'chat-store' })
);