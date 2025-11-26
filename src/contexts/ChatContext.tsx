import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { Store } from '@tauri-apps/plugin-store';
import type {
  ChatMessage,
  AgentChatSettings,
  SessionUsage,
  AgentInfo,
  AgentChat,
} from '../types';

interface TokenStats {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheTokens?: number;
  totalCost: number;
  stepCount: number;
}

interface FileEdit {
  filePath: string;
  editCount: number;
  lineNumbers: number[];
}

interface ChatContextValue {
  // Chat sessions state
  chatSessions: Map<string, ChatMessage[]>;
  chatLoadingMap: Map<string, boolean>;
  chatTokensMap: Map<string, TokenStats>;
  chatSessionIds: Map<string, string>; // Map agentId -> Claude session ID
  sessionFileEdits: Map<string, FileEdit[]>; // Map agentId -> FileEdit[]

  // Agent state
  activeAgent: AgentInfo | null;
  agentChats: AgentChat[];
  activeAgentChatId: string | null;
  agentChatSettings: Map<string, AgentChatSettings>;

  // Usage tracking
  usageSessions: SessionUsage[];

  // Actions
  setActiveAgent: (agent: AgentInfo | null) => void;
  setActiveAgentChatId: (id: string | null) => void;
  addAgentChat: (chat: AgentChat) => void;
  removeAgentChat: (id: string) => void;
  updateAgentChat: (id: string, updates: Partial<AgentChat>) => void;

  // Chat operations
  addMessage: (agentId: string, message: ChatMessage) => void;
  updateMessage: (agentId: string, messageId: string, updates: Partial<ChatMessage>) => void;
  clearMessages: (agentId: string) => void;
  setChatLoading: (agentId: string, loading: boolean) => void;
  updateChatTokens: (agentId: string, tokens: Partial<TokenStats>) => void;
  setSessionId: (agentId: string, sessionId: string) => void;

  // File edits tracking
  addFileEdit: (agentId: string, filePath: string, lineNumbers?: number[]) => void;
  clearFileEdits: (agentId: string) => void;
  getFileEdits: (agentId: string) => FileEdit[];

  // Settings management
  updateAgentChatSettings: (agentId: string, settings: Partial<AgentChatSettings>) => void;
  getAgentChatSettings: (agentId: string) => AgentChatSettings;

  // Usage tracking
  addUsageSession: (session: SessionUsage) => void;
  updateUsageSession: (sessionId: string, updates: Partial<SessionUsage>) => void;

  // Persistence
  saveChatHistory: (agentId: string) => Promise<void>;
  loadChatHistory: (agentId: string) => Promise<void>;
}

export type { FileEdit };

const ChatContext = createContext<ChatContextValue | null>(null);

const DEFAULT_AGENT_SETTINGS: AgentChatSettings = {
  inputDraft: '',
  model: 'sonnet',
  thinkingMode: 'standard',
  permissionMode: 'act',
  effort: 'medium', // SDK 0.1.54+ - Default balanced effort
};

export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
  const [chatSessions, setChatSessions] = useState<Map<string, ChatMessage[]>>(new Map());
  const [chatLoadingMap, setChatLoadingMap] = useState<Map<string, boolean>>(new Map());
  const [chatTokensMap, setChatTokensMap] = useState<Map<string, TokenStats>>(new Map());
  const [chatSessionIds, setChatSessionIds] = useState<Map<string, string>>(new Map());
  const [sessionFileEdits, setSessionFileEdits] = useState<Map<string, FileEdit[]>>(new Map());

  const [activeAgent, setActiveAgent] = useState<AgentInfo | null>(null);
  const [agentChats, setAgentChats] = useState<AgentChat[]>([]);
  const [activeAgentChatId, setActiveAgentChatId] = useState<string | null>(null);
  const [agentChatSettings, setAgentChatSettings] = useState<Map<string, AgentChatSettings>>(new Map());

  const [usageSessions, setUsageSessions] = useState<SessionUsage[]>([]);

  const saveDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Add message to a chat session
  const addMessage = useCallback((agentId: string, message: ChatMessage) => {
    setChatSessions(prev => {
      const newSessions = new Map(prev);
      const messages = newSessions.get(agentId) || [];
      newSessions.set(agentId, [...messages, message]);
      return newSessions;
    });
  }, []);

  // Update a specific message
  const updateMessage = useCallback((agentId: string, messageId: string, updates: Partial<ChatMessage>) => {
    setChatSessions(prev => {
      const newSessions = new Map(prev);
      const messages = newSessions.get(agentId) || [];
      const updatedMessages = messages.map(msg =>
        msg.id === messageId ? { ...msg, ...updates } : msg
      );
      newSessions.set(agentId, updatedMessages);
      return newSessions;
    });
  }, []);

  // Clear messages for an agent
  const clearMessages = useCallback((agentId: string) => {
    setChatSessions(prev => {
      const newSessions = new Map(prev);
      newSessions.delete(agentId);
      return newSessions;
    });

    setChatTokensMap(prev => {
      const newMap = new Map(prev);
      newMap.delete(agentId);
      return newMap;
    });

    setChatSessionIds(prev => {
      const newMap = new Map(prev);
      newMap.delete(agentId);
      return newMap;
    });
  }, []);

  // Set chat loading state
  const setChatLoading = useCallback((agentId: string, loading: boolean) => {
    setChatLoadingMap(prev => {
      const newMap = new Map(prev);
      newMap.set(agentId, loading);
      return newMap;
    });
  }, []);

  // Update token stats
  const updateChatTokens = useCallback((agentId: string, tokens: Partial<TokenStats>) => {
    setChatTokensMap(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(agentId) || {
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        cacheTokens: 0,
        totalCost: 0,
        stepCount: 0,
      };

      newMap.set(agentId, {
        ...current,
        ...tokens,
        totalTokens: tokens.totalTokens ?? current.totalTokens,
        inputTokens: tokens.inputTokens ?? current.inputTokens,
        outputTokens: tokens.outputTokens ?? current.outputTokens,
        cacheTokens: tokens.cacheTokens ?? current.cacheTokens,
        totalCost: tokens.totalCost ?? current.totalCost,
        stepCount: tokens.stepCount ?? current.stepCount,
      });

      return newMap;
    });
  }, []);

  // Set session ID for an agent
  const setSessionId = useCallback((agentId: string, sessionId: string) => {
    setChatSessionIds(prev => {
      const newMap = new Map(prev);
      newMap.set(agentId, sessionId);
      return newMap;
    });
  }, []);

  // File edits tracking
  const addFileEdit = useCallback((agentId: string, filePath: string, lineNumbers: number[] = []) => {
    setSessionFileEdits(prev => {
      const newMap = new Map(prev);
      const edits = newMap.get(agentId) || [];

      // Find existing edit for this file
      const existingEditIndex = edits.findIndex(edit => edit.filePath === filePath);

      if (existingEditIndex >= 0) {
        // Update existing edit
        const updatedEdits = [...edits];
        updatedEdits[existingEditIndex] = {
          ...updatedEdits[existingEditIndex],
          editCount: updatedEdits[existingEditIndex].editCount + 1,
          lineNumbers: [...new Set([...updatedEdits[existingEditIndex].lineNumbers, ...lineNumbers])],
        };
        newMap.set(agentId, updatedEdits);
      } else {
        // Add new edit
        newMap.set(agentId, [...edits, { filePath, editCount: 1, lineNumbers }]);
      }

      return newMap;
    });
  }, []);

  const clearFileEdits = useCallback((agentId: string) => {
    setSessionFileEdits(prev => {
      const newMap = new Map(prev);
      newMap.delete(agentId);
      return newMap;
    });
  }, []);

  const getFileEdits = useCallback((agentId: string): FileEdit[] => {
    return sessionFileEdits.get(agentId) || [];
  }, [sessionFileEdits]);

  // Agent chat management
  const addAgentChat = useCallback((chat: AgentChat) => {
    setAgentChats(prev => [...prev, chat]);
  }, []);

  const removeAgentChat = useCallback((id: string) => {
    setAgentChats(prev => prev.filter(chat => chat.id !== id));
    clearMessages(id);

    // Clear settings
    setAgentChatSettings(prev => {
      const newMap = new Map(prev);
      newMap.delete(id);
      return newMap;
    });
  }, [clearMessages]);

  const updateAgentChat = useCallback((id: string, updates: Partial<AgentChat>) => {
    setAgentChats(prev => prev.map(chat =>
      chat.id === id ? { ...chat, ...updates } : chat
    ));
  }, []);

  // Settings management
  const updateAgentChatSettings = useCallback((agentId: string, settings: Partial<AgentChatSettings>) => {
    setAgentChatSettings(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(agentId) || DEFAULT_AGENT_SETTINGS;
      newMap.set(agentId, { ...current, ...settings });
      return newMap;
    });
  }, []);

  const getAgentChatSettings = useCallback((agentId: string): AgentChatSettings => {
    return agentChatSettings.get(agentId) || DEFAULT_AGENT_SETTINGS;
  }, [agentChatSettings]);

  // Usage tracking
  const addUsageSession = useCallback((session: SessionUsage) => {
    setUsageSessions(prev => [...prev, session]);
  }, []);

  const updateUsageSession = useCallback((sessionId: string, updates: Partial<SessionUsage>) => {
    setUsageSessions(prev => prev.map(session =>
      session.session_id === sessionId ? { ...session, ...updates } : session
    ));
  }, []);

  // Save chat history to storage
  const saveChatHistory = useCallback(async (agentId: string) => {
    if (saveDebounceRef.current) {
      clearTimeout(saveDebounceRef.current);
    }

    saveDebounceRef.current = setTimeout(async () => {
      try {
        const store = await Store.load('quack-chats.json');
        const messages = chatSessions.get(agentId) || [];
        const tokens = chatTokensMap.get(agentId);
        const sessionId = chatSessionIds.get(agentId);
        const settings = agentChatSettings.get(agentId);

        await store.set(`chat-${agentId}`, {
          messages,
          tokens,
          sessionId,
          settings,
          timestamp: Date.now(),
        });

        await store.save();
        console.log(`Saved chat history for agent ${agentId}`);
      } catch (error) {
        console.error('Failed to save chat history:', error);
      }
    }, 1000);
  }, [chatSessions, chatTokensMap, chatSessionIds, agentChatSettings]);

  // Load chat history from storage
  const loadChatHistory = useCallback(async (agentId: string) => {
    try {
      const store = await Store.load('quack-chats.json');
      const data = await store.get<{
        messages: ChatMessage[];
        tokens: TokenStats;
        sessionId: string;
        settings: AgentChatSettings;
        timestamp: number;
      }>(`chat-${agentId}`);

      if (data) {
        setChatSessions(prev => {
          const newSessions = new Map(prev);
          newSessions.set(agentId, data.messages);
          return newSessions;
        });

        if (data.tokens) {
          setChatTokensMap(prev => {
            const newMap = new Map(prev);
            newMap.set(agentId, data.tokens);
            return newMap;
          });
        }

        if (data.sessionId) {
          setChatSessionIds(prev => {
            const newMap = new Map(prev);
            newMap.set(agentId, data.sessionId);
            return newMap;
          });
        }

        if (data.settings) {
          setAgentChatSettings(prev => {
            const newMap = new Map(prev);
            newMap.set(agentId, data.settings);
            return newMap;
          });
        }

        console.log(`Loaded chat history for agent ${agentId}`);
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  }, []);

  // Load chat settings from storage on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const store = await Store.load('quack-chats.json');
        const settings = await store.get<Record<string, AgentChatSettings>>('agent-settings');

        if (settings) {
          setAgentChatSettings(new Map(Object.entries(settings)));
        }
      } catch (error) {
        console.error('Failed to load chat settings:', error);
      }
    };

    loadSettings();
  }, []);

  // Save settings when they change
  useEffect(() => {
    const saveSettings = async () => {
      try {
        const store = await Store.load('quack-chats.json');
        const settings = Object.fromEntries(agentChatSettings);
        await store.set('agent-settings', settings);
        await store.save();
      } catch (error) {
        console.error('Failed to save chat settings:', error);
      }
    };

    if (agentChatSettings.size > 0) {
      saveSettings();
    }
  }, [agentChatSettings]);

  const value: ChatContextValue = {
    chatSessions,
    chatLoadingMap,
    chatTokensMap,
    chatSessionIds,
    sessionFileEdits,
    activeAgent,
    agentChats,
    activeAgentChatId,
    agentChatSettings,
    usageSessions,
    setActiveAgent,
    setActiveAgentChatId,
    addAgentChat,
    removeAgentChat,
    updateAgentChat,
    addMessage,
    updateMessage,
    clearMessages,
    setChatLoading,
    updateChatTokens,
    setSessionId,
    addFileEdit,
    clearFileEdits,
    getFileEdits,
    updateAgentChatSettings,
    getAgentChatSettings,
    addUsageSession,
    updateUsageSession,
    saveChatHistory,
    loadChatHistory,
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within ChatProvider');
  }
  return context;
};