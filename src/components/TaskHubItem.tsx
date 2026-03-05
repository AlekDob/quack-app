import { memo, useMemo, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { AgentSession, ChatMessage } from '../types';
import { formatRelativeTime } from '../utils/timeFormat';
import { getActivityDotColor, getTimeColor, getDotClassName } from '../utils/sessionStatus';
import { useAgentAvatar } from '../hooks/useAgentAvatar';
import './AgentSessionItem.css'; // Reuse dot animations + context menu styles

export type SessionPriority = 1 | 2 | 3 | 4;

interface TaskHubItemProps {
  session: AgentSession;
  priority: SessionPriority;
  opacity: number;
  onClick: (sessionId: string) => void;
  isActive: boolean;
  agentLabel: string;
  agentAvatar?: string;
  agentColor: string;
  projectName: string;
  showProject: boolean;
  chatMessages: ChatMessage[];
  isLoading: boolean;
  hasPendingQuestion: boolean;
  onMarkDone?: (sessionId: string) => void;
  onDelete?: (sessionId: string) => void;
  onRename?: (sessionId: string) => void;
}

const PRIORITY_ACCENT: Record<SessionPriority, string | null> = {
  1: '#a855f7', // purple - needs input
  2: '#f59e0b', // orange - working
  3: '#22c55e', // green - agent done
  4: null,
};

function TaskHubItem({
  session,
  priority,
  opacity,
  onClick,
  isActive,
  agentLabel,
  agentAvatar,
  agentColor,
  projectName,
  showProject,
  chatMessages,
  isLoading,
  hasPendingQuestion,
  onMarkDone,
  onDelete,
  onRename,
}: TaskHubItemProps) {
  const avatarUrl = useAgentAvatar(agentLabel, agentAvatar);
  const relativeTime = formatRelativeTime(session.updatedAt);
  const timeColor = getTimeColor(session.updatedAt);
  const accent = PRIORITY_ACCENT[priority];

  // Context menu state
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  }, []);

  useEffect(() => {
    if (!showContextMenu) return;
    const close = () => setShowContextMenu(false);
    document.addEventListener('click', close);
    document.addEventListener('contextmenu', close);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('contextmenu', close);
    };
  }, [showContextMenu]);

  const isActuallyLoading = useMemo(() => {
    if (isLoading) return true;
    if (chatMessages.length === 0) return false;
    const last = chatMessages[chatMessages.length - 1];
    return last?.role === 'assistant' && last.status === 'streaming';
  }, [isLoading, chatMessages]);

  const isAgentReady = useMemo(() => {
    if (isActuallyLoading || chatMessages.length === 0) return false;
    const last = chatMessages[chatMessages.length - 1];
    if (last?.role !== 'assistant') return false;
    return last.status === 'complete' || last.status === undefined;
  }, [chatMessages, isActuallyLoading]);

  const isChatEmpty = chatMessages.length === 0;
  const dotColor = getActivityDotColor(hasPendingQuestion, isActuallyLoading, isAgentReady, isChatEmpty);
  const dotClass = getDotClassName(hasPendingQuestion, isActuallyLoading, isAgentReady && !isActive);

  return (
    <div
      onClick={() => onClick(session.id)}
      onContextMenu={handleContextMenu}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(session.id);
        }
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '5px 8px',
        cursor: 'pointer',
        fontSize: '10px',
        opacity,
        borderLeft: accent ? `2px solid ${accent}` : '2px solid transparent',
        background: isActive ? `${agentColor}40` : 'transparent',
        borderRadius: '2px',
        color: isActive ? 'rgba(255, 255, 255, 1)' : 'rgba(255, 255, 255, 0.75)',
        transition: 'background 0.15s ease',
        boxShadow: isActive ? `0 0 8px ${agentColor}40` : 'none',
      }}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.background = 'transparent';
      }}
    >
      {/* Status dot */}
      <div style={{ position: 'relative', flexShrink: 0, width: '8px', height: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div
          className={dotClass}
          style={{
            width: hasPendingQuestion ? '8px' : '6px',
            height: hasPendingQuestion ? '8px' : '6px',
            borderRadius: '50%',
            background: dotColor,
            boxShadow: `0 0 4px ${dotColor}`,
          }}
        />
      </div>

      {/* Title */}
      <span
        style={{
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontSize: '11px',
          textDecoration: session.status === 'done' ? 'line-through' : 'none',
          textDecorationColor: 'rgba(255,255,255,0.3)',
        }}
      >
        {session.title || 'Untitled'}
      </span>

      {/* Agent avatar */}
      <img
        src={avatarUrl}
        alt={agentLabel}
        title={agentLabel}
        style={{
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          flexShrink: 0,
          objectFit: 'cover',
          border: `1px solid ${agentColor}60`,
        }}
      />

      {/* Project tag */}
      {showProject && (
        <span
          style={{
            fontSize: '8px',
            fontFamily: 'monospace',
            color: 'rgba(255, 255, 255, 0.35)',
            maxWidth: '60px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {projectName}
        </span>
      )}

      {/* Relative time */}
      <span
        style={{
          fontSize: '9px',
          fontFamily: 'monospace',
          color: timeColor,
          flexShrink: 0,
          minWidth: '28px',
          textAlign: 'right',
        }}
      >
        {relativeTime}
      </span>

      {/* Context Menu */}
      {showContextMenu && createPortal(
        <div
          className="session-context-menu"
          style={{
            position: 'fixed',
            left: contextMenuPos.x,
            top: contextMenuPos.y,
            zIndex: 99999,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {onMarkDone && session.status !== 'done' && (
            <button
              className="session-context-menu-item"
              onClick={(e) => {
                e.stopPropagation();
                setShowContextMenu(false);
                onMarkDone(session.id);
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Mark as Done
            </button>
          )}
          {onRename && (
            <button
              className="session-context-menu-item"
              onClick={(e) => {
                e.stopPropagation();
                setShowContextMenu(false);
                onRename(session.id);
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              </svg>
              Rename Session
            </button>
          )}
          {onDelete && (
            <button
              className="session-context-menu-item delete"
              onClick={(e) => {
                e.stopPropagation();
                setShowContextMenu(false);
                onDelete(session.id);
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              Delete Session
            </button>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

export default memo(TaskHubItem);
