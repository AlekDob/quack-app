import React, { useCallback } from 'react';
import { useJackStore } from '../../stores/jackStore';
import type { JackSession } from '../../stores/jackStore';
import { AgentAvatar } from '../AgentAvatar';
import { JACK_AVATAR } from '../../services/jackPersonalityService';

const SIDEBAR_WIDTH = 220;

export default function JackSessionsSidebar() {
  const sessions = useJackStore((s) => s.sessions);
  const activeSessionId = useJackStore((s) => s.activeSessionId);
  const createSession = useJackStore((s) => s.createSession);
  const selectSession = useJackStore((s) => s.selectSession);
  const deleteSession = useJackStore((s) => s.deleteSession);

  const handleNewChat = useCallback(() => {
    createSession();
  }, [createSession]);

  return (
    <div style={{
      width: SIDEBAR_WIDTH,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      borderRight: '1px solid rgba(255,255,255,0.08)',
      background: 'rgba(0,0,0,0.18)',
      overflow: 'hidden',
    }}>
      {/* Header with Jack identity */}
      <div
        data-tauri-drag-region
        style={{
          padding: '12px 14px',
          paddingTop: 38,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
        }}
      >
        <AgentAvatar
          agentName="Jack"
          avatarFilename={JACK_AVATAR}
          style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Jack</div>
          <div style={{ fontSize: 11, opacity: 0.5 }}>Project Manager</div>
        </div>
      </div>

      {/* New chat button */}
      <div style={{
        padding: '8px 10px',
        flexShrink: 0,
      }}>
        <button
          type="button"
          onClick={handleNewChat}
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: 8,
            background: 'var(--accent, #FF6B35)',
            color: '#fff',
            border: 'none',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
          <span>Nuova chat</span>
        </button>
      </div>

      {/* Sessions list */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '4px 6px 12px',
      }}>
        {sessions.length === 0 ? (
          <div style={{
            padding: '20px 12px',
            fontSize: 12,
            opacity: 0.45,
            textAlign: 'center',
          }}>
            Nessuna chat ancora
          </div>
        ) : (
          sessions.map((s) => (
            <SessionRow
              key={s.id}
              session={s}
              isActive={s.id === activeSessionId}
              onSelect={() => selectSession(s.id)}
              onDelete={() => deleteSession(s.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function SessionRow({
  session,
  isActive,
  onSelect,
  onDelete,
}: {
  session: JackSession;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      style={{
        padding: '8px 10px',
        borderRadius: 6,
        cursor: 'pointer',
        background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
        marginBottom: 2,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        position: 'relative',
      }}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.background = 'transparent';
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12.5,
          fontWeight: isActive ? 500 : 400,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {session.title || 'Nuova chat'}
        </div>
        <div style={{ fontSize: 10.5, opacity: 0.4, marginTop: 1 }}>
          {formatRelativeTime(session.updatedAt)}
        </div>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        title="Elimina chat"
        style={{
          opacity: 0,
          border: 'none',
          background: 'transparent',
          color: 'inherit',
          fontSize: 14,
          cursor: 'pointer',
          padding: '0 4px',
          transition: 'opacity 120ms',
        }}
        onFocus={(e) => { e.currentTarget.style.opacity = '0.7'; }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.7'; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = '0'; }}
      >
        ×
      </button>
    </div>
  );
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'ora';
  if (m < 60) return `${m}m fa`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h fa`;
  const d = Math.floor(h / 24);
  return `${d}g fa`;
}
