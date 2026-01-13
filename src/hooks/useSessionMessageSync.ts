/**
 * useSessionMessageSync Hook
 *
 * Syncs message count from chatSessions to agent sessions in sessionStore.
 * When chat messages change for an agent, updates the messageCount of the active session.
 *
 * @module useSessionMessageSync
 */

import { useEffect } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import type { ChatMessage } from '../types';

interface UseSessionMessageSyncProps {
  chatSessions: Map<string, ChatMessage[]>;
  activeSessionId: string | null;
}

/**
 * Hook that syncs messageCount of sessions with chat messages.
 *
 * @param chatSessions - Map of agentId -> ChatMessage[]
 * @param activeSessionId - Currently active session ID
 */
export function useSessionMessageSync({
  chatSessions,
  activeSessionId,
}: UseSessionMessageSyncProps) {
  useEffect(() => {
    if (!activeSessionId) return;

    // Get the active session
    const session = useSessionStore.getState().sessions.find(s => s.id === activeSessionId);
    if (!session) return;

    // Get messages for this session's agent
    const agentMessages = chatSessions.get(session.agentId) || [];
    const messageCount = agentMessages.length;

    // Only update if count has changed
    if (session.messageCount !== messageCount) {
      console.log(`[useSessionMessageSync] Updating session ${activeSessionId} messageCount: ${session.messageCount} -> ${messageCount}`);

      useSessionStore.getState().updateSession(activeSessionId, {
        messageCount,
        updatedAt: Date.now(),
      });
    }
  }, [chatSessions, activeSessionId]);
}
