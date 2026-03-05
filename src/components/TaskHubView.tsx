import { useMemo } from 'react';
import type { TerminalInfo, ChatMessage } from '../types';
import { useSessionStore } from '../stores/sessionStore';
import { useChatStore } from '../stores/chatStore';
import TaskHubItem, { type SessionPriority } from './TaskHubItem';
import './TaskHubView.css';

interface TaskHubViewProps {
  terminals: TerminalInfo[];
  onSessionClick?: (sessionId: string) => void;
  activeSessionId?: string;
  chatSessions?: Map<string, ChatMessage[]>;
  lastReadTimestamps?: Map<string, number>;
  searchQuery?: string;
}

const SECTION_LABELS: Record<SessionPriority, string> = {
  1: 'Needs attention',
  2: 'Working',
  3: 'Agent done',
  4: 'Other',
};

function getItemOpacity(priority: SessionPriority, indexInGroup: number, groupSize: number): number {
  if (priority <= 3) return 1.0;
  // P4: fade from 0.75 to 0.4 based on position
  if (groupSize <= 1) return 0.7;
  return Math.max(0.4, 0.75 - (indexInGroup / groupSize) * 0.35);
}

/**
 * Check if the agent has finished responding in a session
 * (last message is a complete assistant message)
 */
function isAgentDone(messages: ChatMessage[]): boolean {
  if (messages.length === 0) return false;
  const last = messages[messages.length - 1];
  if (last.role !== 'assistant') return false;
  return last.status === 'complete' || last.status === undefined;
}

export default function TaskHubView({
  terminals,
  onSessionClick,
  activeSessionId,
  chatSessions,
  searchQuery = '',
}: TaskHubViewProps) {
  const sessions = useSessionStore((s) => s.sessions);
  const chatLoadingMap = useChatStore((s) => s.chatLoadingMap);
  const pendingQuestionsMap = useChatStore((s) => s.pendingQuestionsMap);

  // Build terminal lookup map
  const terminalMap = useMemo(() => {
    const map = new Map<string, TerminalInfo>();
    for (const t of terminals) {
      map.set(t.id, t);
    }
    return map;
  }, [terminals]);

  // Check if multiple projects exist (to show project tags)
  const hasMultipleProjects = useMemo(() => {
    const projects = new Set(sessions.map((s) => s.projectName));
    return projects.size > 1;
  }, [sessions]);

  // Compute priority for each session and sort
  const sortedSessions = useMemo(() => {
    // Exclude completed sessions — they belong in the Kanban/Projects view
    let activeSessions = sessions.filter((s) => s.status !== 'done');

    // Filter by search query (matches title, agent name, or project name)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      activeSessions = activeSessions.filter((s) => {
        const terminal = terminalMap.get(s.agentId);
        return (
          s.title.toLowerCase().includes(q) ||
          s.projectName.toLowerCase().includes(q) ||
          (terminal?.label || '').toLowerCase().includes(q)
        );
      });
    }

    const withPriority = activeSessions.map((session) => {
      const pendingSet = pendingQuestionsMap.get(session.id);
      const hasPending = pendingSet ? pendingSet.size > 0 : false;
      const messages = chatSessions?.get(session.id) || [];
      // Check both chatLoadingMap AND last message streaming status
      const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
      const isLoading = (chatLoadingMap.get(session.id) ?? false)
        || (lastMsg?.role === 'assistant' && lastMsg.status === 'streaming');

      let priority: SessionPriority;
      if (hasPending) {
        priority = 1;
      } else if (isLoading) {
        priority = 2;
      } else if (isAgentDone(messages)) {
        priority = 3;
      } else {
        priority = 4;
      }

      return { session, priority, hasPending, isLoading };
    });

    withPriority.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return (b.session.updatedAt || 0) - (a.session.updatedAt || 0);
    });

    return withPriority;
  }, [sessions, chatLoadingMap, pendingQuestionsMap, chatSessions, searchQuery, terminalMap]);

  // Group by priority for section headers
  const groups = useMemo(() => {
    const result: { priority: SessionPriority; items: typeof sortedSessions }[] = [];
    let currentPriority: SessionPriority | null = null;
    let currentGroup: typeof sortedSessions = [];

    for (const item of sortedSessions) {
      if (item.priority !== currentPriority) {
        if (currentGroup.length > 0 && currentPriority !== null) {
          result.push({ priority: currentPriority, items: currentGroup });
        }
        currentPriority = item.priority;
        currentGroup = [item];
      } else {
        currentGroup.push(item);
      }
    }
    if (currentGroup.length > 0 && currentPriority !== null) {
      result.push({ priority: currentPriority, items: currentGroup });
    }

    return result;
  }, [sortedSessions]);

  if (sortedSessions.length === 0) {
    return (
      <div className="task-hub-empty">
        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
          No active tasks
        </span>
      </div>
    );
  }

  return (
    <div className="task-hub-list">
      {groups.map((group) => (
        <div key={group.priority} className="task-hub-group">
          <div className="task-hub-section-header">
            {SECTION_LABELS[group.priority]}
            <span className="task-hub-section-count">{group.items.length}</span>
          </div>
          {group.items.map((item, idx) => {
            const terminal = terminalMap.get(item.session.agentId);
            const messages = chatSessions?.get(item.session.id) || [];

            return (
              <TaskHubItem
                key={item.session.id}
                session={item.session}
                priority={item.priority}
                opacity={getItemOpacity(item.priority, idx, group.items.length)}
                onClick={(id) => onSessionClick?.(id)}
                isActive={item.session.id === activeSessionId}
                agentLabel={terminal?.label || 'Unknown'}
                agentAvatar={terminal?.avatar}
                agentColor={terminal?.color || '#8b5cf6'}
                projectName={item.session.projectName}
                showProject={hasMultipleProjects}
                chatMessages={messages}
                isLoading={item.isLoading}
                hasPendingQuestion={item.hasPending}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
