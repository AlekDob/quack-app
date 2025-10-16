import { useState, useCallback, useRef } from 'react';
import type { ChatAttachment, ChatMessage, ClaudeEvent } from '../types';
import { streamClaudeMessage } from '../services/claudeSDK';
import { invoke } from '@tauri-apps/api/core';

export type ThinkingMode = 'auto' | 'think' | 'hard' | 'harder' | 'ultra';
export type PermissionMode = 'plan' | 'bypass';

export interface ChatSendOptions {
  attachments?: ChatAttachment[];
  model?: 'opus' | 'sonnet' | 'haiku' | 'haiku-3.5';
  thinkingMode?: ThinkingMode;
  permissionMode?: PermissionMode;
  workingDirectory?: string;
  onComplete?: () => void; // Callback when chat completes successfully
}

export function useClaudeChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConfigured, setIsConfigured] = useState(true); // SDK always available
  const [error, setError] = useState<string | null>(null);

  // Store the Claude SDK session ID for resume
  const claudeSessionId = useRef<string | undefined>(undefined);

  // Initialize (SDK doesn't need initialization)
  const initialize = useCallback(async () => {
    setIsConfigured(true);
    setError(null);
    return true;
  }, []);

  // Send message to Claude using the SDK with streaming
  const sendMessage = useCallback(async (content: string, options?: ChatSendOptions) => {
    if (!content.trim() || isLoading) return;

    // Create user message
    const attachments = options?.attachments ?? [];
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content,
      timestamp: Date.now(),
      status: 'sending',
      attachments,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    // Create assistant message placeholder
    const assistantMessageId = `msg-${Date.now()}-assistant`;
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      status: 'streaming',
      events: [], // Store all Claude events for visualization
    };

    setMessages((prev) => [...prev, assistantMessage]);

    try {
      // Stream message using Claude Agent SDK
      const stream = streamClaudeMessage(content, {
        model: options?.model || 'sonnet',
        thinkingMode: options?.thinkingMode,
        permissionMode: options?.permissionMode || 'bypass',
        sessionId: claudeSessionId.current, // Resume previous session if exists
        workingDirectory: options?.workingDirectory,
      });

      const events: ClaudeEvent[] = [];
      let assistantContent = '';

      // Process streaming events
      for await (const chunk of stream) {
        if (chunk.type === 'event' && chunk.event) {
          const event = chunk.event;
          events.push(event);

          // Capture session ID from system init event
          if (event.type === 'system' && event.subtype === 'init' && event.session_id) {
            console.log('[useClaudeChat] Captured session ID:', event.session_id);
            claudeSessionId.current = event.session_id;
          }

          // Accumulate assistant text from assistant events
          if (event.type === 'assistant' && event.message?.content) {
            for (const block of event.message.content) {
              if (block.type === 'text' && block.text) {
                assistantContent += block.text;
              }
            }
          }

          // Update message with streaming content
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? {
                    ...msg,
                    content: assistantContent,
                    status: 'streaming' as const,
                    events: [...events],
                  }
                : msg
            )
          );
        } else if (chunk.type === 'complete') {
          // Stream completed successfully
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? {
                    ...msg,
                    content: assistantContent || chunk.result?.text || '',
                    status: 'complete' as const,
                    events: [...events],
                  }
                : msg
            )
          );

          // 🆕 Trigger mobile notification
          try {
            await invoke('send_ai_completion_notification', {
              content: assistantContent.substring(0, 100) || 'Chat completed!'
            });
          } catch (err) {
            console.warn('[Mobile Notification] Failed:', err);
          }

          // Trigger onComplete callback if provided
          if (options?.onComplete) {
            options.onComplete();
          }
        } else if (chunk.type === 'error') {
          // Stream error
          throw new Error(chunk.error || 'Unknown streaming error');
        }
      }
    } catch (err) {
      console.error('[useClaudeChat] Error streaming message:', err);

      const errorMessage =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
            ? err
            : 'Unknown error';

      // Update message with error
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: `Quack! 🦆 I encountered an error: ${errorMessage}`,
                status: 'error' as const,
                error: errorMessage,
              }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  // Clear conversation and reset session
  const clearConversation = useCallback(() => {
    setMessages([]);
    claudeSessionId.current = undefined; // Clear session ID to start fresh
  }, []);

  // Get current session ID (useful for debugging)
  const getCurrentSessionId = useCallback(() => {
    return claudeSessionId.current;
  }, []);

  return {
    messages,
    isLoading,
    isConfigured,
    error,
    sendMessage,
    clearConversation,
    initialize,
    getCurrentSessionId,
  };
}
