import { useState, useCallback, useRef, useEffect } from 'react';
import type { ChatAttachment, ChatMessage, ClaudeEvent, StructuredOutputFormat, EffortLevel, AskUserQuestionAnswers, PendingUserQuestion } from '../types';
import { streamClaudeMessage, abortSessionStream, sendToolResult } from '../services/claudeSDK';
import { invoke } from '@tauri-apps/api/core';
import debugLogger from '../services/debugLogger';
import posthog from 'posthog-js';
import {
  calculateTokenBudget,
  performSoftReset,
  downloadConversationExport,
  shouldBlockMessage,
  getRecommendedAction,
  type TokenBudgetStatus,
} from '../services/conversationRecovery';
import { extractAndSaveMemories } from '../services/memoryIntegration';

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
  // Token overflow prevention callbacks
  onTokenWarning?: (status: TokenBudgetStatus) => void; // Called when token usage is high
  onTokenBlocked?: (reason: string) => void; // Called when message is blocked due to token limit
  bypassTokenCheck?: boolean; // Skip token check (use with caution)
}

export interface UseClaudeChatOptions {
  initialSessionId?: string;
  initialTokens?: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
  };
  taskId?: string; // Optional task ID for per-task event deduplication
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

  // 🦆 FIX: Per-task event deduplication to prevent cross-task contamination
  // This Set is scoped to the current taskId to ensure events from different tasks
  // are not incorrectly flagged as duplicates
  const seenEventIdsRef = useRef<Set<string>>(new Set());
  const currentTaskIdRef = useRef<string | undefined>(options?.taskId);

  // 🦆 FIX: Stable ref for messages.length to avoid re-creating sendMessage callback
  const messagesLengthRef = useRef<number>(messages.length);

  // 🗣️ AskUserQuestion: Track pending questions and answered questions
  const [pendingQuestionIds, setPendingQuestionIds] = useState<Set<string>>(new Set());
  const [answeredQuestions, setAnsweredQuestions] = useState<Map<string, AskUserQuestionAnswers>>(new Map());

  // 🦆 FIX: Update messagesLengthRef when messages.length changes
  useEffect(() => {
    messagesLengthRef.current = messages.length;
  }, [messages.length]);

  // 🦆 FIX: Clear event deduplication AND abort active stream when taskId changes
  // This prevents events from Task A being incorrectly flagged as duplicates in Task B
  // AND ensures the old stream doesn't continue updating stale state
  useEffect(() => {
    const newTaskId = options?.taskId;

    // If taskId changed, abort active stream, clear deduplication Set and reset session
    if (newTaskId !== currentTaskIdRef.current) {
      console.log('[useClaudeChat] TaskId changed, aborting active stream and clearing state:', {
        oldTaskId: currentTaskIdRef.current,
        newTaskId,
        previousEventCount: seenEventIdsRef.current.size,
        hadActiveStream: !!abortControllerRef.current
      });

      // 🦆 FIX: Abort any active stream BEFORE switching tasks
      // This prevents the race condition where old stream updates stale state
      if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
        console.log('[useClaudeChat] Aborting stream due to task switch...');
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      seenEventIdsRef.current.clear();
      currentTaskIdRef.current = newTaskId;

      // Reset session ID unless explicitly provided in options
      if (!options?.initialSessionId) {
        claudeSessionId.current = undefined;
      }

      // Reset loading state since we aborted the stream
      setIsLoading(false);
    }
  }, [options?.taskId, options?.initialSessionId]);

  // Initialize (SDK doesn't need initialization)
  const initialize = useCallback(async () => {
    setIsConfigured(true);
    setError(null);
    return true;
  }, []);

  // Get current token budget status
  const getTokenBudgetStatus = useCallback((model: 'opus' | 'sonnet' | 'haiku' = 'opus'): TokenBudgetStatus => {
    return calculateTokenBudget(
      sessionTokens.inputTokens,
      sessionTokens.outputTokens,
      model
    );
  }, [sessionTokens]);

  // Send message to Claude using the SDK with streaming
  const sendMessage = useCallback(async (content: string, options?: ChatSendOptions) => {
    if (!content.trim() || isLoading) return;

    const model = options?.model || 'sonnet';

    // 🛡️ TOKEN OVERFLOW PREVENTION
    // Check token budget BEFORE sending the message
    if (!options?.bypassTokenCheck) {
      const tokenStatus = calculateTokenBudget(
        sessionTokens.inputTokens,
        sessionTokens.outputTokens,
        model
      );

      console.log(`[useClaudeChat] Token budget check: ${tokenStatus.percentage.toFixed(1)}% used (${tokenStatus.level})`);

      // BLOCK: Token limit exceeded - cannot send
      if (!tokenStatus.canSendMessage) {
        console.error('[useClaudeChat] ❌ MESSAGE BLOCKED - Token limit exceeded!');
        setError(tokenStatus.message);

        if (options?.onTokenBlocked) {
          options.onTokenBlocked(tokenStatus.message);
        }

        return; // Don't send the message
      }

      // WARNING: High token usage - notify but allow
      if (tokenStatus.level === 'critical' || tokenStatus.level === 'danger') {
        console.warn(`[useClaudeChat] ⚠️ High token usage: ${tokenStatus.percentage.toFixed(1)}%`);

        if (options?.onTokenWarning) {
          options.onTokenWarning(tokenStatus);
        }
      }
    }

    // Legacy check (kept for backwards compatibility)
    // 🦆 FIX: Use messagesLengthRef.current instead of messages.length to avoid dependency
    if (messagesLengthRef.current > 20) {
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

    // Track chat message sent
    const messageStartTime = performance.now();
    posthog.capture('ai_message_sent', {
      has_attachments: attachments.length > 0,
      attachments_count: attachments.length,
      model: options?.model || 'sonnet',
      thinking_mode: options?.thinkingMode || 'auto',
      message_length: content.length,
    });

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

        // For assistant events: ALWAYS include content types in the key
        // 🦆 FIX: Two events with same message.id but different content (tool_use vs text)
        // must be treated as DIFFERENT events, not duplicates!
        if (event.type === 'assistant' && 'message' in event) {
          // Generate content hash that includes tool_use IDs for uniqueness
          const contentHash = event.message?.content
            ?.map((b: any) => {
              let id = `${b.type}`;
              // Include tool_use.id and name for unique identification
              if (b.type === 'tool_use') {
                id += `-${b.id || ''}-${b.name || ''}`;
              } else if (b.type === 'text') {
                // Include first 30 chars of text to differentiate
                id += `-${(b.text || '').substring(0, 30)}`;
              }
              return id;
            })
            .join('|') || '';

          // Use message.id + content hash for complete uniqueness
          const messageId = event.message?.id || 'no-id';
          return `assistant-${messageId}-${contentHash.substring(0, 100)}`;
        }

        // For user events: hash the tool results content + timestamp for uniqueness
        // User events don't have message.id, so we use tool_use_ids which should be unique
        if (event.type === 'user' && 'message' in event) {
          // tool_use_ids are UUIDs and should be globally unique
          const toolUseIds = event.message?.content
            ?.filter((b: any) => b.tool_use_id)
            ?.map((b: any) => b.tool_use_id)
            .join('-') || '';

          // If we have tool_use_ids, use them (they're UUIDs and unique)
          // Otherwise fallback to content hash with timestamp
          if (toolUseIds) {
            return `user-${toolUseIds}`;
          }

          // Fallback for user events without tool results
          const contentHash = event.message?.content
            ?.map((b: any) => `${b.type}-${b.text?.substring(0, 50) || ''}`)
            .join('|') || '';
          return `user-${contentHash}-${Date.now()}`;
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

          // Track successful AI response
          const responseTime = Math.round(performance.now() - messageStartTime);
          posthog.capture('ai_response_received', {
            response_time_ms: responseTime,
            response_length: assistantContent.length,
            events_count: events.length,
            model: options?.model || 'sonnet',
          });

          // 🆕 Trigger mobile notification
          try {
            await invoke('send_ai_completion_notification', {
              content: assistantContent.substring(0, 100) || 'Chat completed!'
            });
          } catch (err) {
            console.warn('[Mobile Notification] Failed:', err);
          }

          // 🧠 Quack Memory: Auto-extract memories from AI response
          try {
            const memoriesExtracted = await extractAndSaveMemories(
              assistantContent,
              claudeSessionId.current,
              options?.workingDirectory
            );
            if (memoriesExtracted > 0) {
              console.log(`[useClaudeChat] 🧠 Extracted ${memoriesExtracted} memories`);
            }
          } catch (memErr) {
            // Non-critical, don't block chat
            console.warn('[useClaudeChat] Memory extraction failed:', memErr);
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

      // Track error
      const errorMessage = err instanceof Error ? err.message : String(err);
      const wasAborted = abortControllerRef.current?.signal.aborted;

      posthog.capture('ai_error', {
        error_type: wasAborted ? 'user_aborted' : 'stream_error',
        error_message: errorMessage.substring(0, 200),
        model: options?.model || 'sonnet',
      });

      // Check if this was an abort
      if (wasAborted) {
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
    // 🦆 FIX: Removed messages.length from dependencies - using messagesLengthRef.current instead
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

  // 🛡️ RECOVERY: Perform local soft reset (when SDK /compact fails)
  const localSoftReset = useCallback((keepCount: number = 10) => {
    console.log('[useClaudeChat] Performing local soft reset, keeping last', keepCount, 'messages');

    const newMessages = performSoftReset(messages, keepCount);
    setMessages(newMessages);

    // Reset token count (will be recalculated on next message)
    // Note: This is an approximation - actual tokens will be re-counted by SDK
    setSessionTokens({
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
    });

    console.log('[useClaudeChat] Local soft reset complete. Messages:', newMessages.length);
  }, [messages]);

  // 🛡️ RECOVERY: Export conversation before clearing
  const exportConversation = useCallback((filename?: string) => {
    console.log('[useClaudeChat] Exporting conversation...');

    downloadConversationExport(messages, filename, {
      sessionId: claudeSessionId.current,
      model: 'opus', // TODO: Get from context
    });

    console.log('[useClaudeChat] Conversation exported');
  }, [messages]);

  // 🛡️ RECOVERY: Get recommended action based on current token usage
  const getRecoveryRecommendation = useCallback((model: 'opus' | 'sonnet' | 'haiku' = 'opus') => {
    return getRecommendedAction(
      sessionTokens.inputTokens,
      sessionTokens.outputTokens,
      model
    );
  }, [sessionTokens]);

  // 🗣️ AskUserQuestion: Handle user answering a question from the agent
  const answerUserQuestion = useCallback(async (
    toolUseId: string,
    answers: AskUserQuestionAnswers,
    workingDirectory?: string
  ) => {
    if (!claudeSessionId.current) {
      console.error('[useClaudeChat] Cannot answer question: no active session');
      return;
    }

    console.log('[useClaudeChat] 🗣️ Answering user question:', { toolUseId, answers });

    // Mark question as answered
    setAnsweredQuestions(prev => new Map(prev).set(toolUseId, answers));
    setPendingQuestionIds(prev => {
      const next = new Set(prev);
      next.delete(toolUseId);
      return next;
    });

    try {
      // Format the answer as a tool result
      const formattedAnswer = Object.entries(answers)
        .map(([header, value]) => {
          const valueStr = Array.isArray(value) ? value.join(', ') : value;
          return `${header}: ${valueStr}`;
        })
        .join('\n');

      // Send the tool result to continue the conversation
      await sendToolResult(
        claudeSessionId.current,
        toolUseId,
        formattedAnswer,
        workingDirectory
      );

      console.log('[useClaudeChat] 🗣️ Question answered successfully');

      // Track analytics
      posthog.capture('user_question_answered', {
        question_count: Object.keys(answers).length,
        tool_use_id: toolUseId,
      });
    } catch (err) {
      console.error('[useClaudeChat] Failed to send question answer:', err);
      setError(`Failed to submit answer: ${err}`);

      // Revert the answered state
      setAnsweredQuestions(prev => {
        const next = new Map(prev);
        next.delete(toolUseId);
        return next;
      });
      setPendingQuestionIds(prev => new Set(prev).add(toolUseId));
    }
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
    // 🛡️ Token overflow prevention
    getTokenBudgetStatus,
    localSoftReset,
    exportConversation,
    getRecoveryRecommendation,
    // 🗣️ AskUserQuestion support
    answerUserQuestion,
    pendingQuestionIds,
    answeredQuestions,
  };
}
