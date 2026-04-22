import { useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { TerminalInfo, ChatMessage } from '../../../types';
import { useSessionStore } from '../../../stores/sessionStore';
import { useChatStore } from '../../../stores/chatStore';

export interface ActionMenuData {
  agentId: string;
  screenX: number;
  screenY: number;
}

interface OfficeActionMenuProps {
  data: ActionMenuData;
  terminals: TerminalInfo[];
  onGoToChat: (agentId: string) => void;
  onSessionClick: (sessionId: string) => void;
  onClose: () => void;
}

function getSessionDotColor(
  sessionId: string,
  chatLoadingMap: Map<string, boolean>,
  pendingQuestionsMap: Map<string, Set<string>>,
  chatSessions: Map<string, ChatMessage[]>,
): string {
  const hasPending = (pendingQuestionsMap.get(sessionId)?.size ?? 0) > 0;
  if (hasPending) return '#a855f7';

  const isLoading = chatLoadingMap.get(sessionId) ?? false;
  const messages = chatSessions.get(sessionId) ?? [];
  const lastMessage = messages[messages.length - 1];
  const isStreaming = lastMessage?.role === 'assistant' && lastMessage.status === 'streaming';
  if (isLoading || isStreaming) return '#f59e0b';

  const isDormant = messages.length === 0 || !messages.some(m => m.role === 'user');
  if (!isDormant && lastMessage?.role === 'assistant'
    && (lastMessage.status === 'complete' || lastMessage.status === undefined)) {
    return '#22c55e';
  }

  return '#6b7280';
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
  const chatSessions = useChatStore(state => state.chatSessions);

  const agentSessions = useMemo(() => {
    if (!agent) return [];
    return sessions
      .filter(s => s.agentId === agent.id && s.status === 'in_progress')
      .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  }, [agent, sessions]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.stopPropagation();
  }, []);

  if (!agent) return null;

  const handleSessionNav = (sessionId: string) => {
    onClose();
    onSessionClick(sessionId);
  };

  const menu = (
    <div
      ref={menuRef}
      className="office-action-menu"
      onWheel={handleWheel}
      style={{
        position: 'fixed',
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
                style={{ backgroundColor: getSessionDotColor(s.id, chatLoadingMap, pendingQuestionsMap, chatSessions) }}
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

  return createPortal(menu, document.body);
}
