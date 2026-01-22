import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { ChatMessage, AgentChat, SessionUsage, AgentInfo, ChatAttachment } from '../types';

interface ChatState {
  // State
  chatSessions: Map<string, ChatMessage[]>;
  agentChats: AgentChat[];
  chatLoadingMap: Map<string, boolean>;
  chatTokensMap: Map<string, SessionUsage>;
  pendingAttachments: Map<string, ChatAttachment[]>; // Pending attachments per session
  pendingQuestionsMap: Map<string, Set<string>>; // Session ID -> Set of pending question tool IDs
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
  setPendingQuestion: (sessionId: string, toolUseId: string, hasPending: boolean) => void;
  clearPendingQuestions: (sessionId: string) => void;

  // Agent chat actions
  addAgentChat: (chat: AgentChat) => void;
  updateAgentChat: (id: string, updates: Partial<AgentChat>) => void;
  removeAgentChat: (id: string) => void;

  // Attachment actions
  setAttachments: (sessionId: string, attachments: ChatAttachment[]) => void;
  clearAttachments: (sessionId: string) => void;

  // Selectors
  getSession: (sessionId: string) => ChatMessage[];
  getLastMessage: (sessionId: string) => ChatMessage | undefined;
  isSessionLoading: (sessionId: string) => boolean;
  getSessionTokens: (sessionId: string) => SessionUsage | undefined;
  getAgentChatById: (id: string) => AgentChat | undefined;
  getAttachments: (sessionId: string) => ChatAttachment[];
  hasPendingQuestion: (sessionId: string) => boolean;
}

export const useChatStore = create<ChatState>()(
  devtools((set, get) => ({
    chatSessions: new Map(),
    agentChats: [],
    chatLoadingMap: new Map(),
    chatTokensMap: new Map(),
    pendingAttachments: new Map(),
    pendingQuestionsMap: new Map(),
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
      const newAttachments = new Map(state.pendingAttachments);
      newAttachments.delete(sessionId);
      return {
        chatSessions: newSessions,
        chatLoadingMap: newLoadingMap,
        chatTokensMap: newTokensMap,
        pendingAttachments: newAttachments,
        streamingMessage: null
      };
    }),

    setLoading: (sessionId, loading) => set((state) => {
      console.log(`🦆 [chatStore.setLoading] sessionId=${sessionId}, loading=${loading}`);
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

    // Pending questions (for "awaiting response" state)
    setPendingQuestion: (sessionId, toolUseId, hasPending) => set((state) => {
      const newPendingMap = new Map(state.pendingQuestionsMap);
      const currentSet = newPendingMap.get(sessionId) || new Set();
      const newSet = new Set(currentSet);

      if (hasPending) {
        newSet.add(toolUseId);
      } else {
        newSet.delete(toolUseId);
      }

      if (newSet.size > 0) {
        newPendingMap.set(sessionId, newSet);
      } else {
        newPendingMap.delete(sessionId);
      }

      return { pendingQuestionsMap: newPendingMap };
    }),

    clearPendingQuestions: (sessionId) => set((state) => {
      const newPendingMap = new Map(state.pendingQuestionsMap);
      newPendingMap.delete(sessionId);
      return { pendingQuestionsMap: newPendingMap };
    }),

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

    // Attachment actions
    setAttachments: (sessionId, attachments) => set((state) => {
      const newAttachments = new Map(state.pendingAttachments);
      if (attachments.length > 0) {
        newAttachments.set(sessionId, attachments);
      } else {
        newAttachments.delete(sessionId);
      }
      return { pendingAttachments: newAttachments };
    }),

    clearAttachments: (sessionId) => set((state) => {
      const newAttachments = new Map(state.pendingAttachments);
      newAttachments.delete(sessionId);
      return { pendingAttachments: newAttachments };
    }),

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

    getAttachments: (sessionId) => {
      const state = get();
      return state.pendingAttachments.get(sessionId) || [];
    },

    hasPendingQuestion: (sessionId) => {
      const state = get();
      const pendingSet = state.pendingQuestionsMap.get(sessionId);
      return pendingSet ? pendingSet.size > 0 : false;
    },
  }), { name: 'chat-store' })
);