import React, { useState, useEffect, useCallback } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { PipAgentState } from '../types';

function resolveAvatarUrl(avatar?: string): string {
  const fallback = 'duck15.jpeg';
  const name = avatar || fallback;
  // Skip custom UUIDs — use fallback for those in PiP (no async store access)
  const isCustom = /^[0-9a-f]{8}-/.test(name);
  const filename = isCustom ? fallback : name;
  if (window.__TAURI__) {
    return convertFileSrc(`/images/ducks/new-avatars/${filename}`, 'asset');
  }
  return `/images/ducks/new-avatars/${filename}`;
}

// Status dot color
function getStatusColor(status: PipAgentState['status']): string {
  switch (status) {
    case 'idle': return '#22c55e';
    case 'thinking': return '#f59e0b';
    case 'streaming': return '#f28c52';
    case 'executing': return '#f28c52';
    case 'completed': return '#22c55e';
    case 'error': return '#ef4444';
    default: return 'rgba(255,255,255,0.3)';
  }
}

function formatTime(timestamp?: number): string {
  if (!timestamp) return '';
  const diff = Date.now() - timestamp;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h`;
}

// Module-level style constants — defined once, never recreated on render
const cardStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '8px 10px',
  borderRadius: '10px',
  cursor: 'pointer',
  background: 'rgba(255, 255, 255, 0.03)',
  border: '1px solid rgba(255, 255, 255, 0.06)',
  transition: 'background 150ms ease, border-color 150ms ease',
};

const avatarContainerStyle: React.CSSProperties = {
  position: 'relative',
  flexShrink: 0,
};

const imgStyle: React.CSSProperties = {
  width: '32px',
  height: '32px',
  borderRadius: '8px',
  objectFit: 'cover',
};

const textBlockStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
};

const nameRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: '6px',
};

const nameStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 600,
  color: '#e7ebf3',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const projectStyle: React.CSSProperties = {
  fontSize: '10px',
  color: 'rgba(255, 255, 255, 0.35)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const lastMessageStyle: React.CSSProperties = {
  fontSize: '11px',
  color: 'rgba(255, 255, 255, 0.45)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  marginTop: '1px',
};

const timeStyle: React.CSSProperties = {
  fontSize: '10px',
  color: 'rgba(255, 255, 255, 0.3)',
  flexShrink: 0,
  whiteSpace: 'nowrap',
};

const dotBaseStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: '-2px',
  right: '-2px',
  width: '10px',
  height: '10px',
  borderRadius: '50%',
  border: '2px solid #0f1115',
};

interface PipAgentCardProps {
  agent: PipAgentState;
  onClickAgent: (agent: PipAgentState) => void;
}

const PipAgentCard: React.FC<PipAgentCardProps> = ({ agent, onClickAgent }) => {
  const [avatarUrl] = useState(() => resolveAvatarUrl(agent.avatar));
  const [timeStr, setTimeStr] = useState(() => formatTime(agent.lastActivity));

  // Refresh relative time every 30s
  useEffect(() => {
    const id = setInterval(() => setTimeStr(formatTime(agent.lastActivity)), 30000);
    return () => clearInterval(id);
  }, [agent.lastActivity]);

  const handleClick = useCallback(() => onClickAgent(agent), [agent, onClickAgent]);

  const dotColor = getStatusColor(agent.status);
  const isActive = agent.status === 'streaming' || agent.status === 'executing' || agent.status === 'thinking';

  const dotStyle: React.CSSProperties = {
    ...dotBaseStyle,
    backgroundColor: dotColor,
    ...(isActive ? { animation: 'pipPulse 1.5s ease-in-out infinite' } : {}),
  };

  return (
    <div
      onClick={handleClick}
      style={cardStyle}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.07)';
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
      }}
    >
      {/* Avatar with status dot */}
      <div style={avatarContainerStyle}>
        <img
          src={avatarUrl}
          alt={agent.agentName}
          draggable={false}
          style={imgStyle}
        />
        <span style={dotStyle} />
      </div>

      {/* Agent + project + session title */}
      <div style={textBlockStyle}>
        <div style={nameRowStyle}>
          <span style={nameStyle}>
            {agent.agentName}
          </span>
          {agent.projectName && (
            <span style={projectStyle}>
              {agent.projectName}
            </span>
          )}
        </div>
        {agent.lastMessage && (
          <div style={lastMessageStyle}>
            {agent.lastMessage}
          </div>
        )}
      </div>

      {/* Time */}
      {timeStr && (
        <span style={timeStyle}>
          {timeStr}
        </span>
      )}
    </div>
  );
};

// Brain: 005-performance-critical-refactor
export default React.memo(PipAgentCard, (prev, next) => {
  // Only re-render if visible data changed
  return (
    prev.agent.status === next.agent.status &&
    prev.agent.lastMessage === next.agent.lastMessage &&
    prev.agent.lastActivity === next.agent.lastActivity &&
    prev.agent.agentName === next.agent.agentName
  );
});
