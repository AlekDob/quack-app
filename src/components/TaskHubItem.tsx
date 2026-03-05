import { memo, useMemo } from 'react';
import type { AgentSession, ChatMessage } from '../types';
import { formatRelativeTime } from '../utils/timeFormat';
import { getActivityDotColor, getTimeColor, getDotClassName } from '../utils/sessionStatus';
import { useAgentAvatar } from '../hooks/useAgentAvatar';
import './AgentSessionItem.css'; // Reuse dot animations

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
}: TaskHubItemProps) {
  const avatarUrl = useAgentAvatar(agentLabel, agentAvatar);
  const relativeTime = formatRelativeTime(session.updatedAt);
  const timeColor = getTimeColor(session.updatedAt);
  const accent = PRIORITY_ACCENT[priority];

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
    </div>
  );
}

export default memo(TaskHubItem);
