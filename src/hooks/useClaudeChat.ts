import { useState, useCallback, useRef } from 'react';
import type { ChatAttachment, ChatMessage, ClaudeEvent } from '../types';
import { streamClaudeMessage, abortSessionStream } from '../services/claudeSDK';
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

export interface UseClaudeChatOptions {
  initialSessionId?: string;
}

export function useClaudeChat(options?: UseClaudeChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConfigured, setIsConfigured] = useState(true); // SDK always available
  const [error, setError] = useState<string | null>(null);

  // Track cumulative session tokens
  const [sessionTokens, setSessionTokens] = useState({
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
  });

  // Store the Claude SDK session ID for resume
  // ✅ Initialize with provided session ID for resume support
  const claudeSessionId = useRef<string | undefined>(options?.initialSessionId);

  // Store abort controller for canceling streams
  const abortControllerRef = useRef<AbortController | null>(null);

  // Store last prompt for restoration on abort
  const lastPromptRef = useRef<string>('');

  // Initialize (SDK doesn't need initialization)
  const initialize = useCallback(async () => {
    setIsConfigured(true);
    setError(null);
    return true;
  }, []);

  // Send message to Claude using the SDK with streaming
  const sendMessage = useCallback(async (content: string, options?: ChatSendOptions) => {
    if (!content.trim() || isLoading) return;

    // Save the prompt for restoration on abort
    lastPromptRef.current = content;

    // Create abort controller for this stream
    abortControllerRef.current = new AbortController();

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
      // Generate unique stream ID for this chat instance
      const streamId = `chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Stream message using Claude Agent SDK with unique streamId
      const stream = streamClaudeMessage(content, {
        model: options?.model || 'sonnet',
        thinkingMode: options?.thinkingMode,
        permissionMode: options?.permissionMode || 'bypass',
        sessionId: claudeSessionId.current, // Resume previous session if exists
        workingDirectory: options?.workingDirectory,
        signal: abortControllerRef.current?.signal, // Pass abort signal
        streamId, // Pass unique stream ID for this chat
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

          // Track cumulative tokens from result events
          if (event.type === 'result' && event.usage) {
            const usage = event.usage; // Destructure to help TypeScript narrow the type
            setSessionTokens(prev => ({
              inputTokens: prev.inputTokens + usage.input_tokens,
              outputTokens: prev.outputTokens + usage.output_tokens,
              cacheCreationTokens: prev.cacheCreationTokens + (usage.cache_creation_input_tokens || 0),
              cacheReadTokens: prev.cacheReadTokens + (usage.cache_read_input_tokens || 0),
            }));
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

      // Check if this was an abort
      if (abortControllerRef.current?.signal.aborted) {
        console.log('[useClaudeChat] Stream was aborted by user');

        // Update message with aborted status
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: 'Stream stopped by user',
                  status: 'error' as const,
                  error: 'Aborted',
                }
              : msg
          )
        );
      } else {
        let errorMessage = 'Unknown error';
        let errorDetails = '';

        if (err instanceof Error) {
          errorMessage = err.message;

          // Extract specific error types for better user feedback
          if (errorMessage.includes('API key')) {
            errorDetails = 'Please check your Anthropic API key in settings.';
          } else if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
            errorDetails = 'Rate limit reached. Please wait a few minutes and try again.';
          } else if (errorMessage.includes('401') || errorMessage.includes('authentication')) {
            errorDetails = 'Authentication failed. Please verify your API key.';
          } else if (errorMessage.includes('timeout')) {
            errorDetails = 'Request took too long. Try a shorter prompt or simpler task.';
          } else if (errorMessage.includes('working directory') || errorMessage.includes('cwd')) {
            errorDetails = 'Working directory is not accessible. Check file permissions.';
          } else if (errorMessage.includes('exit status: 1')) {
            errorDetails = 'Claude SDK process crashed. Check console for more details. Common causes: invalid API key, rate limiting, or corrupted CLAUDE.md file.';
          }
        } else if (typeof err === 'string') {
          errorMessage = err;
        }

        // Update message with error
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: `Quack! 🦆 I encountered an error:\n\n**${errorMessage}**\n\n${errorDetails}`,
                  status: 'error' as const,
                  error: errorMessage,
                }
              : msg
          )
        );
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null; // Clean up
    }
  }, [isLoading]);

  // Abort current streaming
  const abortStream = useCallback(() => {
    if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
      console.log('[useClaudeChat] Aborting stream...');
      abortControllerRef.current.abort();
    }
  }, []);

  // Get last prompt (for restoration on abort)
  const getLastPrompt = useCallback(() => {
    return lastPromptRef.current;
  }, []);

  // Clear conversation and reset session
  const clearConversation = useCallback(() => {
    console.log('[useClaudeChat] Clearing conversation and resetting session...');

    // 1. Abort any active streams for this specific session
    if (claudeSessionId.current) {
      console.log('[useClaudeChat] Aborting active stream for session:', claudeSessionId.current);
      abortSessionStream(claudeSessionId.current); // This will cancel only this session's stream
    }

    // 2. Abort current stream controller if any
    if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
      console.log('[useClaudeChat] Aborting current stream controller');
      abortControllerRef.current.abort();
    }

    // 3. Clear messages
    setMessages([]);

    // 4. Clear session ID to start fresh (prevents SDK from resuming old session)
    claudeSessionId.current = undefined;

    // 5. Clear last prompt
    lastPromptRef.current = '';

    // 6. Reset session tokens
    setSessionTokens({
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
    });

    console.log('[useClaudeChat] Conversation cleared - new session will start fresh');
  }, []);

  // Get current session ID (useful for debugging)
  const getCurrentSessionId = useCallback(() => {
    return claudeSessionId.current;
  }, []);

  // Load historical messages from a resumed session
  const loadHistoricalMessages = useCallback((historicalMessages: Array<{ role: string; content: string; timestamp?: number }>, sessionId?: string) => {
    console.log('[useClaudeChat] Loading historical messages:', historicalMessages.length);

    // Convert historical messages to ChatMessage format
    const chatMessages: ChatMessage[] = historicalMessages.map((msg, index) => ({
      id: `msg-historical-${index}`,
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content,
      timestamp: msg.timestamp || Date.now() - (historicalMessages.length - index) * 1000,
      status: 'complete' as const,
    }));

    // Set messages
    setMessages(chatMessages);

    // Set session ID if provided
    if (sessionId) {
      claudeSessionId.current = sessionId;
      console.log('[useClaudeChat] Set session ID for resume:', sessionId);
    }

    // Clear session tokens (they'll be recalculated if needed)
    setSessionTokens({
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
    });

    console.log('[useClaudeChat] Historical messages loaded successfully');
  }, []);

  return {
    messages,
    isLoading,
    isConfigured,
    error,
    sendMessage,
    abortStream,
    getLastPrompt,
    clearConversation,
    initialize,
    getCurrentSessionId,
    sessionTokens,
    loadHistoricalMessages, // Add new function to return
  };
}
