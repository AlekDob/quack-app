/**
 * useKanbanChatStore Hook
 *
 * Reads chat messages directly from Tauri Store (quack-chats.json) for the KanbanChatDrawer.
 * This bypasses the truncated sync mechanism in useKanbanChatSync.ts which only sends
 * last 5 messages with content limited to 200 chars for card status updates.
 *
 * Architecture:
 * - App.tsx writes FULL messages to quack-chats.json
 * - useKanbanChatSync sends TRUNCATED data for card Working/Ready status
 * - This hook reads FULL messages directly from store for drawer display
 *
 * @module useKanbanChatStore
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Store } from '@tauri-apps/plugin-store';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { ChatMessage } from '../types';

// Event name for chat state sync (triggers reload)
const CHAT_STATE_EVENT = 'kanban:chat-state-sync';

interface ChatTokens {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalCost: number;
}

interface StoredChatData {
  messages: ChatMessage[];
  tokens?: ChatTokens;
  sessionId?: string;
  timestamp?: number;
}

interface UseKanbanChatStoreReturn {
  messages: ChatMessage[];
  tokens: ChatTokens | null;
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/**
 * Hook to read complete chat messages from Tauri Store for Kanban drawer.
 *
 * @param agentId - The agent/task ID to load messages for
 * @returns Object with messages, tokens, loading state, error, and reload function
 *
 * @example
 * ```typescript
 * const { messages, tokens, isLoading, reload } = useKanbanChatStore(taskId);
 * ```
 */
export function useKanbanChatStore(agentId: string | null): UseKanbanChatStoreReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [tokens, setTokens] = useState<ChatTokens | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track current agentId to prevent stale updates
  const currentAgentIdRef = useRef<string | null>(agentId);
  currentAgentIdRef.current = agentId;

  // Load messages from Tauri Store
  const loadMessages = useCallback(async () => {
    if (!agentId) {
      setMessages([]);
      setTokens(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const store = await Store.load('quack-chats.json');
      const key = `chat-${agentId}`;
      const data = await store.get<StoredChatData>(key);

      // Check if agentId changed during async operation
      if (currentAgentIdRef.current !== agentId) {
        console.log(`[useKanbanChatStore] AgentId changed during load, skipping update`);
        return;
      }

      if (data?.messages && Array.isArray(data.messages)) {
        setMessages(data.messages);
        setTokens(data.tokens || null);
        console.log(`[useKanbanChatStore] Loaded ${data.messages.length} messages for ${agentId}`);
      } else {
        setMessages([]);
        setTokens(null);
        console.log(`[useKanbanChatStore] No messages found for ${agentId}`);
      }
    } catch (err) {
      // Check if agentId changed during async operation
      if (currentAgentIdRef.current !== agentId) {
        return;
      }

      const errorMessage = err instanceof Error ? err.message : 'Failed to load messages';
      console.error(`[useKanbanChatStore] Error loading messages for ${agentId}:`, err);
      setError(errorMessage);
      setMessages([]);
      setTokens(null);
    } finally {
      // Only update loading state if agentId hasn't changed
      if (currentAgentIdRef.current === agentId) {
        setIsLoading(false);
      }
    }
  }, [agentId]);

  // Load messages on mount and when agentId changes
  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Listen for chat state sync events to trigger reload
  useEffect(() => {
    if (!agentId) return;

    let unlisten: UnlistenFn | null = null;

    const setupListener = async () => {
      try {
        unlisten = await listen(CHAT_STATE_EVENT, () => {
          // Reload when sync event fires (indicates new messages)
          console.log(`[useKanbanChatStore] Sync event received, reloading for ${agentId}`);
          loadMessages();
        });
        console.log(`[useKanbanChatStore] Listening for sync events for ${agentId}`);
      } catch (err) {
        console.error(`[useKanbanChatStore] Failed to setup listener:`, err);
      }
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
        console.log(`[useKanbanChatStore] Stopped listening for ${agentId}`);
      }
    };
  }, [agentId, loadMessages]);

  return {
    messages,
    tokens,
    isLoading,
    error,
    reload: loadMessages,
  };
}
