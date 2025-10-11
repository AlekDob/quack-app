import { useState, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { ChatMessage } from '../types';

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
  const sendMessage = useCallback(async (content: string) => {
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
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content,
      timestamp: Date.now(),
      status: 'sending',
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
      let prompt = content;
      if (conversationHistory.current.length > 0) {
        const history = conversationHistory.current
          .map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
          .join('\n\n');
        prompt = `${history}\n\nUser: ${content}`;
      }

      // Call Claude CLI
      const response = await invoke<ClaudeCliResponse>('send_message_via_cli', { prompt });

      // Add to conversation history
      conversationHistory.current.push({
        role: 'user',
        content,
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

      const errorMessage = err instanceof Error ? err.message : 'Unknown error';

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
