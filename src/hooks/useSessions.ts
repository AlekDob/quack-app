import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { SessionInfo, SessionDetails, ClaudeEvent, UsageStats, SessionHistoryMessage } from '../types';

/**
 * Hook for managing Claude Agent SDK sessions from file-history
 */
export function useSessions() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load all sessions from ~/.claude/file-history/
   */
  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // List all session IDs
      const sessionIds = await invoke<string[]>('list_sessions');

      // Load sessions in batches to prevent overwhelming the system
      const BATCH_SIZE = 10;
      const sessionInfos: SessionInfo[] = [];

      for (let i = 0; i < sessionIds.length; i += BATCH_SIZE) {
        const batch = sessionIds.slice(i, i + BATCH_SIZE);
        const batchInfos = await Promise.all(
          batch.map(async (sessionId) => {
            try {
              const info = await invoke<SessionInfo>('get_session_info', { sessionId });
              return info;
            } catch (err) {
              console.error(`Failed to load session ${sessionId}:`, err);
              return null;
            }
          })
        );

        // Add successfully loaded sessions to the list
        const validBatch = batchInfos.filter((s): s is SessionInfo => s !== null);
        sessionInfos.push(...validBatch);
      }

      // Sort by updatedAt (most recent first)
      const sortedSessions = sessionInfos.sort((a, b) => b.updatedAt - a.updatedAt);

      setSessions(sortedSessions);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load sessions';
      setError(errorMessage);
      console.error('Failed to load sessions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Load full details for a specific session
   */
  const loadSessionDetails = useCallback(async (sessionId: string): Promise<SessionDetails | null> => {
    try {
      const details = await invoke<SessionDetails>('get_session_details', { sessionId });
      return details;
    } catch (err) {
      console.error(`Failed to load session details for ${sessionId}:`, err);
      return null;
    }
  }, []);

  /**
   * Delete a session from file-history
   */
  const deleteSession = useCallback(async (sessionId: string): Promise<boolean> => {
    try {
      await invoke('delete_session', { sessionId });
      // Reload sessions after deletion
      await loadSessions();
      return true;
    } catch (err) {
      console.error(`Failed to delete session ${sessionId}:`, err);
      return false;
    }
  }, [loadSessions]);

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  return {
    sessions,
    loading,
    error,
    loadSessions,
    loadSessionDetails,
    deleteSession,
  };
}

/**
 * Parse history.jsonl content into structured events and messages
 */
export function parseSessionHistory(historyContent: string): {
  events: ClaudeEvent[];
  messages: SessionHistoryMessage[];
  usage: UsageStats;
  metadata: {
    firstTimestamp: number;
    lastTimestamp: number;
    model?: string;
    cwd?: string;
  };
} {
  const lines = historyContent.trim().split('\n').filter(line => line.trim());
  const events: ClaudeEvent[] = [];
  const messages: SessionHistoryMessage[] = [];

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCacheCreation = 0;
  let totalCacheRead = 0;

  let firstTimestamp = Date.now();
  let lastTimestamp = Date.now();
  let model: string | undefined;
  let cwd: string | undefined;

  for (const line of lines) {
    try {
      const event = JSON.parse(line) as ClaudeEvent;
      events.push(event);

      // Extract metadata from system events
      if (event.type === 'system') {
        if (event.model) model = event.model;
        if (event.cwd) cwd = event.cwd;
      }

      // Extract messages from assistant events
      if (event.type === 'assistant' && event.message?.content) {
        let content = '';
        const toolCalls: Array<{ name: string; input: Record<string, unknown> }> = [];

        for (const block of event.message.content) {
          if (block.type === 'text' && block.text) {
            content += block.text;
          } else if (block.type === 'tool_use' && block.name && block.input) {
            toolCalls.push({
              name: block.name,
              input: block.input,
            });
          }
        }

        if (content) {
          messages.push({
            role: 'assistant',
            content,
            tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
          });
        }
      }

      // Extract user messages
      if (event.type === 'user' && event.message?.content) {
        for (const block of event.message.content) {
          if (block.type === 'text' && block.text) {
            messages.push({
              role: 'user',
              content: block.text,
            });
          }
        }
      }

      // Aggregate token usage from result events
      if (event.type === 'result' && event.usage) {
        totalInputTokens += event.usage.input_tokens;
        totalOutputTokens += event.usage.output_tokens;
        totalCacheCreation += event.usage.cache_creation_input_tokens || 0;
        totalCacheRead += event.usage.cache_read_input_tokens || 0;
      }
    } catch (err) {
      console.warn('Failed to parse history line:', line, err);
    }
  }

  // Determine timestamps (first and last event)
  if (events.length > 0) {
    firstTimestamp = Date.now(); // TODO: Extract from event if available
    lastTimestamp = Date.now();
  }

  return {
    events,
    messages,
    usage: {
      input_tokens: totalInputTokens,
      output_tokens: totalOutputTokens,
      cache_creation_input_tokens: totalCacheCreation,
      cache_read_input_tokens: totalCacheRead,
    },
    metadata: {
      firstTimestamp,
      lastTimestamp,
      model,
      cwd,
    },
  };
}
