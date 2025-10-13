import { useState, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { ChatAttachment, ChatMessage } from '../types';

interface ClaudeCliResponse {
  result: string;
  session_id: string;
  total_cost_usd: number;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens: number;
    cache_creation_input_tokens: number;
  };
}

export type ThinkingMode = 'auto' | 'think' | 'hard' | 'harder' | 'ultra';
export type PermissionMode = 'plan' | 'act' | 'bypass';

export interface ChatSendOptions {
  attachments?: ChatAttachment[];
  model?: string;
  thinkingMode?: ThinkingMode;
  permissionMode?: PermissionMode;
}

export function useClaudeChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const conversationHistory = useRef<Array<{ role: 'user' | 'assistant'; content: string }>>([]);

  // Check if Claude CLI is available
  const initialize = useCallback(async () => {
    try {
      const available = await invoke<boolean>('check_claude_cli_available');

      if (available) {
        setIsConfigured(true);
        setError(null);
        return true;
      } else {
        setIsConfigured(false);
        setError('Claude CLI is not available. Please make sure Claude Code CLI is installed and you are logged in.');
        return false;
      }
    } catch (err) {
      console.error('Failed to check Claude CLI:', err);
      setIsConfigured(false);
      setError(err instanceof Error ? err.message : 'Failed to check Claude CLI');
      return false;
    }
  }, []);

  // Send message to Claude
  const sendMessage = useCallback(async (content: string, options?: ChatSendOptions) => {
    if (!content.trim() || isLoading) return;

    // Ensure we're initialized
    if (!isConfigured) {
      const initialized = await initialize();
      if (!initialized) {
        // Show error message in chat
        const errorMessage: ChatMessage = {
          id: `msg-${Date.now()}-error`,
          role: 'assistant',
          content: 'Quack quack! 🦆 Claude CLI is not available. Please make sure Claude Code CLI is installed and you are logged in.',
          timestamp: Date.now(),
          status: 'error',
          error: error || 'Not configured',
        };
        setMessages((prev) => [...prev, errorMessage]);
        return;
      }
    }

    // Create user message
    const attachments = options?.attachments ?? [];
    const attachmentLines = attachments.map((item, index) => `Attachment ${index + 1}: ${item.path}`);
    const contentWithAttachments =
      attachmentLines.length > 0
        ? `${content}\n\nAttachments:\n${attachmentLines.join('\n')}`
        : content;

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
    };

    setMessages((prev) => [...prev, assistantMessage]);

    try {
      // Build context from conversation history
      let prompt = contentWithAttachments;
      if (conversationHistory.current.length > 0) {
        const history = conversationHistory.current
          .map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
          .join('\n\n');
        prompt = `${history}\n\nUser: ${contentWithAttachments}`;
      }

      // Call Claude CLI
      const sanitizedAttachments = attachments
        .map((item) => item.path)
        .filter((path) => !!path);

      const requestPayload = {
        prompt,
        model: options?.model,
        thinkingMode: options?.thinkingMode,
        permissionMode: options?.permissionMode,
        attachments: sanitizedAttachments.length > 0 ? sanitizedAttachments : undefined,
      };

      const response = await invoke<ClaudeCliResponse>('send_message_via_cli', {
        request: requestPayload,
      });

      // Add to conversation history
      conversationHistory.current.push({
        role: 'user',
        content: contentWithAttachments,
      });

      conversationHistory.current.push({
        role: 'assistant',
        content: response.result,
      });

      // Update message with response
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: response.result,
                status: 'complete' as const,
              }
            : msg
        )
      );
    } catch (err) {
      console.error('Error calling Claude CLI:', err);

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
  }, [isLoading, error, initialize, isConfigured]);

  // Clear conversation
  const clearConversation = useCallback(() => {
    setMessages([]);
    conversationHistory.current = [];
  }, []);

  return {
    messages,
    isLoading,
    isConfigured,
    error,
    sendMessage,
    clearConversation,
    initialize,
  };
}
