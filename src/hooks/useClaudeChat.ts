import { useState, useCallback, useRef } from 'react';
import type { ChatAttachment, ChatMessage, ClaudeEvent, StructuredOutputFormat, EffortLevel } from '../types';
import { streamClaudeMessage, abortSessionStream } from '../services/claudeSDK';
import { invoke } from '@tauri-apps/api/core';
import debugLogger from '../services/debugLogger';

export type ThinkingMode = 'auto' | 'think' | 'hard' | 'harder' | 'ultra';
export type PermissionMode = 'plan' | 'bypass';

export interface ChatSendOptions {
  attachments?: ChatAttachment[];
  model?: 'opus' | 'sonnet' | 'haiku';
  thinkingMode?: ThinkingMode;
  permissionMode?: PermissionMode;
  workingDirectory?: string;
  onComplete?: () => void; // Callback when chat completes successfully
  // New SDK 0.1.54+ features
  outputFormat?: StructuredOutputFormat; // Structured outputs (beta) - guarantees JSON schema compliance
  effort?: EffortLevel; // Effort parameter - controls quality vs speed/cost tradeoff
}

export interface UseClaudeChatOptions {
  initialSessionId?: string;
  initialTokens?: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
  };
}

export function useClaudeChat(options?: UseClaudeChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConfigured, setIsConfigured] = useState(true); // SDK always available
  const [error, setError] = useState<string | null>(null);

  // Track cumulative session tokens
  // ✅ Initialize with provided tokens for stamina preservation
  const [sessionTokens, setSessionTokens] = useState({
    inputTokens: options?.initialTokens?.inputTokens ?? 0,
    outputTokens: options?.initialTokens?.outputTokens ?? 0,
    cacheCreationTokens: options?.initialTokens?.cacheCreationTokens ?? 0,
    cacheReadTokens: options?.initialTokens?.cacheReadTokens ?? 0,
  });

  // Store the Claude SDK session ID for resume
  // ✅ Initialize with provided session ID for resume support
  const claudeSessionId = useRef<string | undefined>(options?.initialSessionId);

  // Store abort controller for canceling streams
  const abortControllerRef = useRef<AbortController | null>(null);

  // Store last prompt for restoration on abort
  const lastPromptRef = useRef<string>('');

  // 🦆 FIX: Persistent event deduplication across ALL message streams
  // This Set persists for the entire hook lifecycle to prevent duplicates
  // even if React re-renders or state updates trigger multiple renders
  // IMPORTANT: Never clear this Set - it's the source of truth for deduplication
  const seenEventIdsRef = useRef<Set<string>>(new Set());

  // Initialize (SDK doesn't need initialization)
  const initialize = useCallback(async () => {
    setIsConfigured(true);
    setError(null);
    return true;
  }, []);

  // Send message to Claude using the SDK with streaming
  const sendMessage = useCallback(async (content: string, options?: ChatSendOptions) => {
    if (!content.trim() || isLoading) return;

    // CRITICAL: Check if conversation is getting too long (warn at ~20 messages)
    if (messages.length > 20) {
      console.warn('[useClaudeChat] ⚠️ Conversation is getting long. Consider using /compact or clearing conversation.');
    }

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
      // Generate unique stream ID for this chat instance with better entropy
      // Using Date.now(), Math.random(), and performance.now() for maximum uniqueness
      const streamId = `chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${performance.now().toString(36).substr(2, 6)}`;

      // Stream message using Claude Agent SDK with unique streamId
      const stream = streamClaudeMessage(content, {
        model: options?.model || 'sonnet',
        thinkingMode: options?.thinkingMode,
        permissionMode: options?.permissionMode || 'bypass',
        sessionId: claudeSessionId.current, // Resume previous session if exists
        workingDirectory: options?.workingDirectory,
        signal: abortControllerRef.current?.signal, // Pass abort signal
        streamId, // Pass unique stream ID for this chat
        // New SDK 0.1.54+ features
        outputFormat: options?.outputFormat, // Structured outputs (beta)
        effort: options?.effort, // Effort parameter for quality vs speed/cost tradeoff
      });

      const events: ClaudeEvent[] = [];
      // 🦆 FIX: Use persistent ref instead of local Set to survive re-renders
      const seenEventIds = seenEventIdsRef.current;
      let assistantContent = '';

      // 🦆 FIX: Enhanced helper function to generate STABLE unique event IDs for deduplication
      const getEventId = (event: ClaudeEvent): string => {
        // For system events: use subtype only (session_id might not be set yet)
        if (event.type === 'system' && 'subtype' in event) {
          return `system-${event.subtype}`;
        }

        // For assistant events: use message.id if available, otherwise hash content
        if (event.type === 'assistant' && 'message' in event) {
          if (event.message?.id) {
            return `assistant-${event.message.id}`;
          }
          // Fallback: hash the content blocks to detect duplicates
          const contentHash = event.message?.content
            ?.map((b: any) => `${b.type}-${b.text?.substring(0, 20) || b.name || ''}`)
            .join('|') || '';
          return `assistant-${contentHash.substring(0, 50)}`;
        }

        // For user events: hash the tool results content
        if (event.type === 'user' && 'message' in event) {
          const contentHash = event.message?.content
            ?.map((b: any) => `${b.type}-${b.tool_use_id || ''}`)
            .join('|') || '';
          return `user-${contentHash.substring(0, 50)}`;
        }

        // For result events: use session_id if available, otherwise timestamp
        if (event.type === 'result') {
          return `result-${event.session_id || Date.now()}`;
        }

        // Fallback: hash the entire event object
        const eventHash = JSON.stringify(event)
          .split('')
          .reduce((hash, char) => ((hash << 5) - hash) + char.charCodeAt(0), 0)
          .toString(36);
        return `${event.type}-${eventHash}`;
      };

      // Process streaming events
      for await (const chunk of stream) {
        if (chunk.type === 'event' && chunk.event) {
          const event = chunk.event;

          // 🦆 FIX: Deduplicate events using STABLE unique ID
          const eventId = getEventId(event);
          if (seenEventIds.has(eventId)) {
            console.warn('[useClaudeChat] 🦆 DUPLICATE DETECTED IN APP LAYER - Event ID:', eventId, 'Type:', event.type);
            console.warn('[useClaudeChat] Total unique events so far:', seenEventIds.size, 'Total duplicates prevented:', events.length);

            // 🦆 DEBUG: Log duplicate to debug logger
            debugLogger.warn('deduplication', 'Duplicate event detected in APP layer', {
              eventId: eventId.substring(0, 50),
              eventType: event.type,
              totalUniqueEvents: seenEventIds.size,
              totalDuplicatesPrevented: events.length,
              sessionId: claudeSessionId.current,
              streamId,
            });

            continue; // Skip duplicate event
          }

          seenEventIds.add(eventId);
          events.push(event);
          console.log('[useClaudeChat] ✅ New unique event added - ID:', eventId.substring(0, 30), 'Type:', event.type, 'Total:', events.length);

          // 🦆 DEBUG: Log unique event
          debugLogger.info('events', 'New unique event added', {
            eventId: eventId.substring(0, 50),
            eventType: event.type,
            totalEvents: events.length,
          });

          // Capture session ID from system init event
          if (event.type === 'system' && event.subtype === 'init' && event.session_id) {
            console.log('[useClaudeChat] Captured session ID:', event.session_id);
            const isResumingSession = claudeSessionId.current === event.session_id;
            claudeSessionId.current = event.session_id;

            // If resuming an existing session, add a system message to inform the user
            if (isResumingSession && messages.length === 2) { // Only user + assistant placeholder
              setMessages((prev) => [
                {
                  id: `msg-system-resume-${Date.now()}`,
                  role: 'system' as const,
                  content: '📜 Continuing previous conversation...',
                  timestamp: Date.now(),
                  status: 'complete' as const,
                },
                ...prev,
              ]);
            }
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

          // Update message with streaming content (events array is already deduplicated)
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? {
                    ...msg,
                    content: assistantContent,
                    status: 'streaming' as const,
                    events: [...events], // Already deduplicated array
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
            errorDetails = 'Claude SDK process crashed. Common causes:\n\n' +
              '• **Prompt too long**: Use `/compact` to compress the conversation\n' +
              '• **CLAUDE.md too large**: Reduce the size of your project context file\n' +
              '• **Rate limiting**: Wait a few minutes and try again\n' +
              '• **Invalid API key**: Check your Anthropic API key in settings\n\n' +
              'Try using `/compact` or "Clear Conversation" to start fresh.';
          } else if (errorMessage.toLowerCase().includes('prompt') && errorMessage.toLowerCase().includes('too long')) {
            errorDetails = '**Prompt is too long!**\n\n' +
              'Your conversation history + context is too large. Try:\n\n' +
              '• Use `/compact` to compress the conversation while keeping context\n' +
              '• Use "Clear Conversation" to start fresh\n' +
              '• Reduce the size of your CLAUDE.md file\n' +
              '• Send shorter messages';
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
  }, [isLoading, messages.length]);

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
      try {
        abortSessionStream(claudeSessionId.current); // This will cancel only this session's stream
      } catch (err) {
        console.warn('[useClaudeChat] Failed to abort session stream (session might be corrupted):', err);
      }
    }

    // 2. Abort current stream controller if any
    if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
      console.log('[useClaudeChat] Aborting current stream controller');
      try {
        abortControllerRef.current.abort();
      } catch (err) {
        console.warn('[useClaudeChat] Failed to abort stream controller:', err);
      }
    }

    // 3. Clear messages
    setMessages([]);

    // 4. Clear session ID to start fresh (prevents SDK from resuming old session)
    const oldSessionId = claudeSessionId.current;
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

    // 6.5. 🦆 FIX: Clear event deduplication Set to start fresh
    seenEventIdsRef.current.clear();
    console.log('[useClaudeChat] Event deduplication Set cleared');

    // 7. Try to notify backend to delete session files
    if (oldSessionId) {
      invoke('delete_claude_session', { sessionId: oldSessionId })
        .then(() => console.log('[useClaudeChat] Backend session deleted:', oldSessionId))
        .catch(err => console.warn('[useClaudeChat] Failed to delete backend session (might not exist):', err));
    }

    console.log('[useClaudeChat] Conversation cleared - new session will start fresh');
  }, []);

  // Get current session ID (useful for debugging)
  const getCurrentSessionId = useCallback(() => {
    return claudeSessionId.current;
  }, []);

  // Save messages to persistent storage (called after each message)
  const saveMessagesToStorage = useCallback(async (agentId: string, messagesToSave: ChatMessage[]) => {
    try {
      await invoke('save_agent_chat_messages', {
        agentId,
        messages: messagesToSave.map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
        })),
        sessionId: claudeSessionId.current,
      });
      console.log('[useClaudeChat] Messages saved to storage:', messagesToSave.length);
    } catch (err) {
      console.error('[useClaudeChat] Failed to save messages:', err);
    }
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
    loadHistoricalMessages,
    saveMessagesToStorage,
    sessionId: claudeSessionId.current, // Expose current session ID for persistence
  };
}
