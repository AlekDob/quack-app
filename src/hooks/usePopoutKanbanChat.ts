/**
 * usePopoutKanbanChat Hook
 *
 * Standalone chat hook for Kanban popout windows.
 * Manages chat sessions independently from App.tsx by:
 * - Loading messages from quack-chats.json storage
 * - Sending messages via Tauri backend directly
 * - Managing streaming state locally
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { Store } from '@tauri-apps/plugin-store';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { ChatMessage, KanbanTask } from '../types';
import type { ChatSendOptions } from './useClaudeChat';

interface ChatTokens {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalCost: number;
}

interface UsePopoutKanbanChatReturn {
  // Chat state
  chatSessions: Map<string, ChatMessage[]>;
  chatLoadingMap: Map<string, boolean>;
  sessionTokensMap: Map<string, ChatTokens>;

  // Actions
  loadChatSession: (taskId: string, sessionId?: string) => Promise<void>;
  sendMessage: (taskId: string, content: string, options?: ChatSendOptions) => Promise<void>;
  abortStream: (taskId: string) => void;
  clearConversation: (taskId: string) => void;
  compactConversation: (taskId: string) => void;
  getLastPrompt: (taskId: string) => string | null;
}

// Streaming event type from Rust backend
interface StreamingEvent {
  session_id?: string;
  content?: string;
  event_type: 'text' | 'tool_use' | 'tool_result' | 'error' | 'complete' | 'start';
  tool_name?: string;
  tool_input?: string;
  error?: string;
}

export function usePopoutKanbanChat(): UsePopoutKanbanChatReturn {
  const [chatSessions, setChatSessions] = useState<Map<string, ChatMessage[]>>(new Map());
  const [chatLoadingMap, setChatLoadingMap] = useState<Map<string, boolean>>(new Map());
  const [sessionTokensMap, setSessionTokensMap] = useState<Map<string, ChatTokens>>(new Map());

  // Track active streams for abort functionality
  const activeStreamsRef = useRef<Map<string, boolean>>(new Map());
  // Track last prompts for retry functionality
  const lastPromptsRef = useRef<Map<string, string>>(new Map());
  // Listeners cleanup
  const listenersRef = useRef<Map<string, UnlistenFn>>(new Map());

  // Load chat session from storage
  const loadChatSession = useCallback(async (taskId: string, sessionId?: string) => {
    try {
      const store = await Store.load('quack-chats.json');
      const savedChat = await store.get<{
        messages: ChatMessage[];
        tokens?: ChatTokens;
        sessionId?: string;
        timestamp?: number;
      }>(`chat-${taskId}`);

      if (savedChat?.messages && savedChat.messages.length > 0) {
        setChatSessions(prev => {
          const newSessions = new Map(prev);
          newSessions.set(taskId, savedChat.messages);
          return newSessions;
        });

        if (savedChat.tokens) {
          setSessionTokensMap(prev => {
            const newMap = new Map(prev);
            newMap.set(taskId, savedChat.tokens!);
            return newMap;
          });
        }

        console.log(`[usePopoutKanbanChat] Loaded ${savedChat.messages.length} messages for task ${taskId}`);
        return;
      }

      // Fallback: Load from Rust backend if we have a sessionId
      if (sessionId) {
        const details = await invoke<{
          id: string;
          messages: Array<{ role: string; content: string; timestamp?: number }>;
        }>('get_session_details', { sessionId });

        if (details?.messages && details.messages.length > 0) {
          const chatMessages: ChatMessage[] = details.messages.map((msg, index) => ({
            id: `popout-${taskId}-${index}`,
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
            timestamp: msg.timestamp || Date.now(),
            status: 'complete' as const,
          }));

          setChatSessions(prev => {
            const newSessions = new Map(prev);
            newSessions.set(taskId, chatMessages);
            return newSessions;
          });

          console.log(`[usePopoutKanbanChat] Loaded ${chatMessages.length} messages from backend for task ${taskId}`);
        }
      }
    } catch (error) {
      console.error(`[usePopoutKanbanChat] Failed to load chat session for ${taskId}:`, error);
    }
  }, []);

  // Save chat session to storage
  const saveChatSession = useCallback(async (taskId: string, messages: ChatMessage[], sessionId?: string) => {
    try {
      const store = await Store.load('quack-chats.json');
      const tokens = sessionTokensMap.get(taskId);

      await store.set(`chat-${taskId}`, {
        messages,
        tokens,
        sessionId,
        timestamp: Date.now(),
      });
      await store.save();

      console.log(`[usePopoutKanbanChat] Saved ${messages.length} messages for task ${taskId}`);
    } catch (error) {
      console.error(`[usePopoutKanbanChat] Failed to save chat session:`, error);
    }
  }, [sessionTokensMap]);

  // Send message with streaming
  const sendMessage = useCallback(async (taskId: string, content: string, options?: ChatSendOptions) => {
    if (!content.trim()) return;

    // Store last prompt for retry
    lastPromptsRef.current.set(taskId, content);

    // Mark as loading
    setChatLoadingMap(prev => {
      const newMap = new Map(prev);
      newMap.set(taskId, true);
      return newMap;
    });

    // Add user message
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
      status: 'complete',
    };

    const currentMessages = chatSessions.get(taskId) || [];
    const messagesWithUser = [...currentMessages, userMessage];

    setChatSessions(prev => {
      const newSessions = new Map(prev);
      newSessions.set(taskId, messagesWithUser);
      return newSessions;
    });

    // Create assistant message placeholder
    const assistantMessageId = `assistant-${Date.now()}`;
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      status: 'streaming',
    };

    const messagesWithAssistant = [...messagesWithUser, assistantMessage];
    setChatSessions(prev => {
      const newSessions = new Map(prev);
      newSessions.set(taskId, messagesWithAssistant);
      return newSessions;
    });

    // Mark stream as active
    activeStreamsRef.current.set(taskId, true);

    try {
      // Get existing session ID from kanban task if resuming
      const kanbanStore = await Store.load('quack-kanban-tasks.json');
      const tasks = await kanbanStore.get<KanbanTask[]>('tasks') || [];
      const task = tasks.find(t => t.id === taskId);
      const existingSessionId = task?.sessionId;

      // Setup stream listener
      const streamKey = `stream-${taskId}-${Date.now()}`;
      let accumulatedContent = '';
      let sessionIdFromStream: string | undefined;

      const unlisten = await listen<StreamingEvent>(streamKey, (event) => {
        if (!activeStreamsRef.current.get(taskId)) {
          // Stream was aborted
          return;
        }

        const { event_type, content: eventContent, session_id, error } = event.payload;

        if (session_id) {
          sessionIdFromStream = session_id;
        }

        switch (event_type) {
          case 'text':
            if (eventContent) {
              accumulatedContent += eventContent;
              setChatSessions(prev => {
                const newSessions = new Map(prev);
                const msgs = [...(newSessions.get(taskId) || [])];
                const lastIndex = msgs.findIndex(m => m.id === assistantMessageId);
                if (lastIndex >= 0) {
                  msgs[lastIndex] = { ...msgs[lastIndex], content: accumulatedContent };
                }
                newSessions.set(taskId, msgs);
                return newSessions;
              });
            }
            break;

          case 'complete':
            setChatSessions(prev => {
              const newSessions = new Map(prev);
              const msgs = [...(newSessions.get(taskId) || [])];
              const lastIndex = msgs.findIndex(m => m.id === assistantMessageId);
              if (lastIndex >= 0) {
                msgs[lastIndex] = { ...msgs[lastIndex], status: 'complete' };
              }
              newSessions.set(taskId, msgs);

              // Save to storage
              saveChatSession(taskId, msgs, sessionIdFromStream);

              return newSessions;
            });

            setChatLoadingMap(prev => {
              const newMap = new Map(prev);
              newMap.set(taskId, false);
              return newMap;
            });

            activeStreamsRef.current.delete(taskId);
            break;

          case 'error':
            console.error(`[usePopoutKanbanChat] Stream error:`, error);
            setChatSessions(prev => {
              const newSessions = new Map(prev);
              const msgs = [...(newSessions.get(taskId) || [])];
              const lastIndex = msgs.findIndex(m => m.id === assistantMessageId);
              if (lastIndex >= 0) {
                msgs[lastIndex] = {
                  ...msgs[lastIndex],
                  content: error || 'An error occurred',
                  status: 'error',
                };
              }
              newSessions.set(taskId, msgs);
              return newSessions;
            });

            setChatLoadingMap(prev => {
              const newMap = new Map(prev);
              newMap.set(taskId, false);
              return newMap;
            });

            activeStreamsRef.current.delete(taskId);
            break;
        }
      });

      listenersRef.current.set(taskId, unlisten);

      // Call Tauri backend to start streaming
      await invoke('send_message_via_sdk_streaming', {
        request: {
          content,
          workingDirectory: options?.workingDirectory || task?.projectPath || '/',
          streamKey,
          sessionId: existingSessionId,
          model: options?.model || 'sonnet',
          thinkingMode: options?.thinkingMode || 'auto',
          permissionMode: options?.permissionMode || 'bypass',
          effort: options?.effort || 'medium',
          allowedTools: [],
          attachments: [],
        },
      });

    } catch (error) {
      console.error(`[usePopoutKanbanChat] Failed to send message:`, error);

      setChatSessions(prev => {
        const newSessions = new Map(prev);
        const msgs = [...(newSessions.get(taskId) || [])];
        const lastIndex = msgs.findIndex(m => m.id === assistantMessageId);
        if (lastIndex >= 0) {
          msgs[lastIndex] = {
            ...msgs[lastIndex],
            content: `Error: ${error}`,
            status: 'error',
          };
        }
        newSessions.set(taskId, msgs);
        return newSessions;
      });

      setChatLoadingMap(prev => {
        const newMap = new Map(prev);
        newMap.set(taskId, false);
        return newMap;
      });

      activeStreamsRef.current.delete(taskId);
    }
  }, [chatSessions, saveChatSession]);

  // Abort active stream
  const abortStream = useCallback((taskId: string) => {
    activeStreamsRef.current.set(taskId, false);

    // Cleanup listener
    const unlisten = listenersRef.current.get(taskId);
    if (unlisten) {
      unlisten();
      listenersRef.current.delete(taskId);
    }

    setChatLoadingMap(prev => {
      const newMap = new Map(prev);
      newMap.set(taskId, false);
      return newMap;
    });

    // Mark last message as complete
    setChatSessions(prev => {
      const newSessions = new Map(prev);
      const msgs = [...(newSessions.get(taskId) || [])];
      const lastMsg = msgs[msgs.length - 1];
      if (lastMsg && lastMsg.status === 'streaming') {
        msgs[msgs.length - 1] = { ...lastMsg, status: 'complete' };
      }
      newSessions.set(taskId, msgs);
      return newSessions;
    });

    console.log(`[usePopoutKanbanChat] Aborted stream for ${taskId}`);
  }, []);

  // Clear conversation
  const clearConversation = useCallback(async (taskId: string) => {
    setChatSessions(prev => {
      const newSessions = new Map(prev);
      newSessions.delete(taskId);
      return newSessions;
    });

    setSessionTokensMap(prev => {
      const newMap = new Map(prev);
      newMap.delete(taskId);
      return newMap;
    });

    // Also clear from storage
    try {
      const store = await Store.load('quack-chats.json');
      await store.delete(`chat-${taskId}`);
      await store.save();
    } catch (error) {
      console.error(`[usePopoutKanbanChat] Failed to clear chat from storage:`, error);
    }

    console.log(`[usePopoutKanbanChat] Cleared conversation for ${taskId}`);
  }, []);

  // Compact conversation (placeholder - would need backend support)
  const compactConversation = useCallback((taskId: string) => {
    console.log(`[usePopoutKanbanChat] Compact not supported in popout mode`);
  }, []);

  // Get last prompt for retry
  const getLastPrompt = useCallback((taskId: string): string | null => {
    return lastPromptsRef.current.get(taskId) || null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      listenersRef.current.forEach(unlisten => unlisten());
      listenersRef.current.clear();
    };
  }, []);

  return {
    chatSessions,
    chatLoadingMap,
    sessionTokensMap,
    loadChatSession,
    sendMessage,
    abortStream,
    clearConversation,
    compactConversation,
    getLastPrompt,
  };
}
