import { useEffect, useRef, useMemo, useCallback } from 'react';
import type { TerminalInfo } from '../../types';
import type { ActionMenuData } from './officeTypes';
import { useSessionStore } from '../../stores/sessionStore';
import { useChatStore } from '../../stores/chatStore';

interface OfficeActionMenuProps {
  data: ActionMenuData;
  terminals: TerminalInfo[];
  onGoToChat: (agentId: string) => void;
  onSessionClick: (sessionId: string) => void;
  onClose: () => void;
}

/** Same logic as AgentSessionItem.getActivityDotColor */
function getSessionDotColor(
  sessionId: string,
  chatLoadingMap: Map<string, boolean>,
  pendingQuestionsMap: Map<string, Set<string>>,
): string {
  const hasPending = (pendingQuestionsMap.get(sessionId)?.size ?? 0) > 0;
  if (hasPending) return '#a855f7'; // Purple - awaiting user
  const isLoading = chatLoadingMap.get(sessionId) ?? false;
  if (isLoading) return '#f59e0b'; // Yellow - working
  return '#22c55e'; // Green - active (default for in_progress sessions)
}

export default function OfficeActionMenu({
  data,
  terminals,
  onGoToChat,
  onSessionClick,
  onClose,
}: OfficeActionMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const agent = terminals.find(t => t.id === data.agentId);
  const sessions = useSessionStore(state => state.sessions);
  const chatLoadingMap = useChatStore(state => state.chatLoadingMap);
  const pendingQuestionsMap = useChatStore(state => state.pendingQuestionsMap);

  // Only active sessions (in_progress)
  const agentSessions = useMemo(() => {
    if (!agent) return [];
    return sessions
      .filter(s => s.agentId === agent.id && s.status === 'in_progress')
      .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  }, [agent, sessions]);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Stop wheel events from bubbling to canvas zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.stopPropagation();
  }, []);

  if (!agent) return null;

  const handleSessionNav = (sessionId: string) => {
    onClose();
    onSessionClick(sessionId);
  };

  return (
    <div
      ref={menuRef}
      className="office-action-menu"
      onWheel={handleWheel}
      style={{
        position: 'absolute',
        left: `${data.screenX + 30}px`,
        top: `${data.screenY}px`,
      }}
    >
      <div className="office-action-menu-header">
        <span
          className="office-action-menu-color"
          style={{ backgroundColor: agent.color }}
        />
        <strong>{agent.label}</strong>
      </div>
      <div className="office-action-menu-info">
        <span>{agent.status === 'busy' ? 'Lavorando' : 'In attesa'}</span>
        {agent.workingOn && <span>{agent.workingOn}</span>}
        {agent.branch && <span className="office-action-menu-branch">{agent.branch}</span>}
      </div>

      {agentSessions.length > 0 ? (
        <div className="office-action-menu-sessions">
          {agentSessions.map(s => (
            <button
              key={s.id}
              className="office-session-item"
              onClick={() => handleSessionNav(s.id)}
            >
              <span
                className="office-session-dot"
                style={{ backgroundColor: getSessionDotColor(s.id, chatLoadingMap, pendingQuestionsMap) }}
              />
              <span className="office-session-title">
                {s.title || 'Untitled'}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="office-action-menu-actions">
          <button onClick={() => onGoToChat(agent.id)}>
            Vai alla Chat
          </button>
        </div>
      )}
    </div>
  );
}
