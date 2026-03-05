import { useMemo, useState, useCallback } from 'react';
import type { TerminalInfo, ChatMessage } from '../types';
import { useSessionStore } from '../stores/sessionStore';
import { useChatStore } from '../stores/chatStore';
import TaskHubItem, { type SessionPriority } from './TaskHubItem';
import './TaskHubView.css';

interface TaskHubViewProps {
  terminals: TerminalInfo[];
  onSessionClick?: (sessionId: string) => void;
  activeSessionId?: string;
  onActiveSessionDone?: () => void;
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
  onActiveSessionDone,
  chatSessions,
  searchQuery = '',
}: TaskHubViewProps) {
  const sessions = useSessionStore((s) => s.sessions);
  const updateSession = useSessionStore((s) => s.updateSession);
  const deleteSession = useSessionStore((s) => s.deleteSession);
  const chatLoadingMap = useChatStore((s) => s.chatLoadingMap);
  const pendingQuestionsMap = useChatStore((s) => s.pendingQuestionsMap);

  // Confirmation dialog state
  const [deleteDialog, setDeleteDialog] = useState<{ id: string; title: string } | null>(null);
  const [renameDialog, setRenameDialog] = useState<{ id: string; title: string } | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Session actions
  const handleMarkDone = useCallback((sessionId: string) => {
    updateSession(sessionId, { status: 'done', completedAt: Date.now() });
    if (sessionId === activeSessionId && onActiveSessionDone) {
      onActiveSessionDone();
    }
  }, [updateSession, activeSessionId, onActiveSessionDone]);

  const handleDeleteRequest = useCallback((sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setDeleteDialog({ id: session.id, title: session.title });
    }
  }, [sessions]);

  const handleConfirmDelete = useCallback(() => {
    if (deleteDialog) {
      deleteSession(deleteDialog.id);
      if (deleteDialog.id === activeSessionId && onActiveSessionDone) {
        onActiveSessionDone();
      }
      setDeleteDialog(null);
    }
  }, [deleteDialog, deleteSession, activeSessionId, onActiveSessionDone]);

  const handleRenameRequest = useCallback((sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setRenameDialog({ id: session.id, title: session.title });
      setRenameValue(session.title);
    }
  }, [sessions]);

  const handleConfirmRename = useCallback(() => {
    if (renameDialog && renameValue.trim()) {
      updateSession(renameDialog.id, { title: renameValue.trim() });
      setRenameDialog(null);
      setRenameValue('');
    }
  }, [renameDialog, renameValue, updateSession]);

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
                onMarkDone={handleMarkDone}
                onDelete={handleDeleteRequest}
                onRename={handleRenameRequest}
              />
            );
          })}
        </div>
      ))}

      {/* Delete confirmation dialog */}
      {deleteDialog && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            background: 'rgba(0,0,0,0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => setDeleteDialog(null)}
        >
          <div
            style={{
              background: 'rgba(30, 30, 35, 0.98)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '10px', padding: '20px', maxWidth: '320px', width: '90%',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '13px', margin: '0 0 16px' }}>
              Delete "{deleteDialog.title}"? This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeleteDialog(null)}
                style={{
                  padding: '6px 14px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)',
                  background: 'transparent', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '12px',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                style={{
                  padding: '6px 14px', borderRadius: '6px', border: 'none',
                  background: '#ef4444', color: '#fff', cursor: 'pointer', fontSize: '12px',
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename dialog */}
      {renameDialog && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            background: 'rgba(0,0,0,0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => { setRenameDialog(null); setRenameValue(''); }}
        >
          <div
            style={{
              background: 'rgba(30, 30, 35, 0.98)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '10px', padding: '20px', maxWidth: '320px', width: '90%',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '13px', margin: '0 0 12px' }}>
              Rename session
            </p>
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmRename();
                if (e.key === 'Escape') { setRenameDialog(null); setRenameValue(''); }
              }}
              style={{
                width: '100%', padding: '8px 10px', borderRadius: '6px',
                border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)',
                color: 'rgba(255,255,255,0.9)', fontSize: '12px', outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button
                onClick={() => { setRenameDialog(null); setRenameValue(''); }}
                style={{
                  padding: '6px 14px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)',
                  background: 'transparent', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '12px',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRename}
                style={{
                  padding: '6px 14px', borderRadius: '6px', border: 'none',
                  background: '#3b82f6', color: '#fff', cursor: 'pointer', fontSize: '12px',
                }}
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
