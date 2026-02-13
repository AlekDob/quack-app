/**
 * Teammate Widget Component
 *
 * Displays teammate activity in the chat stream with avatar, name, and role.
 * Used when Agent Teams mode is active and a teammate is spawned/stopped.
 * Clickable when active to open teammate's stream in a dedicated tab.
 */

import { useAgentAvatar } from '../hooks/useAgentAvatar';

interface TeammateWidgetProps {
  name: string;
  role: string;
  agentId: string;
  action: 'start' | 'stop';
  avatar?: string;
  color?: string;
  sessionId?: string;
  onDrillDown?: (sessionId: string, name: string) => void;
}

const DEFAULT_COLOR = '#00D9FF';

export function TeammateWidget({
  name, role, action, avatar, color = DEFAULT_COLOR, sessionId, onDrillDown,
}: TeammateWidgetProps) {
  const avatarUrl = useAgentAvatar(name, avatar);
  const isStarting = action === 'start';
  const isClickable = !!sessionId && !!onDrillDown;

  const hexToRgba = (hex: string, alpha: number): string => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const handleClick = () => {
    if (isClickable) {
      onDrillDown(sessionId!, name);
    }
  };

  return (
    <div
      className="teammate-widget"
      onClick={handleClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '8px 12px',
        borderRadius: '8px',
        background: `linear-gradient(135deg, ${hexToRgba(color, 0.12)} 0%, ${hexToRgba(color, 0.04)} 100%)`,
        border: `1px solid ${hexToRgba(color, 0.25)}`,
        margin: '4px 0',
        cursor: isClickable ? 'pointer' : 'default',
        transition: 'border-color 0.2s ease',
      }}
      onMouseEnter={(e) => {
        if (isClickable) {
          (e.currentTarget as HTMLDivElement).style.borderColor = hexToRgba(color, 0.5);
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = hexToRgba(color, 0.25);
      }}
    >
      <img
        src={avatarUrl}
        alt={name}
        style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          objectFit: 'cover',
          border: `2px solid ${hexToRgba(color, 0.5)}`,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          <span style={{
            fontSize: '12px',
            fontWeight: 600,
            color: 'rgba(255, 255, 255, 0.95)',
          }}>
            {name}
          </span>
          <span style={{
            fontSize: '10px',
            color: 'rgba(255, 255, 255, 0.45)',
            fontWeight: 400,
          }}>
            {role}
          </span>
        </div>
        <div style={{
          fontSize: '10px',
          color: isStarting ? hexToRgba(color, 0.9) : 'rgba(255, 255, 255, 0.35)',
          marginTop: '1px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}>
          {isStarting ? (
            <>
              <span style={{
                width: '5px',
                height: '5px',
                borderRadius: '50%',
                background: color,
                display: 'inline-block',
                animation: 'teammate-pulse 1.5s ease-in-out infinite',
              }} />
              Working on task...
              {isClickable && (
                <span style={{
                  marginLeft: '4px',
                  opacity: 0.5,
                  fontSize: '9px',
                }}>
                  (click to view)
                </span>
              )}
            </>
          ) : (
            <>
              <span style={{
                width: '5px',
                height: '5px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.3)',
                display: 'inline-block',
              }} />
              Task completed
              {isClickable && (
                <span style={{
                  marginLeft: '4px',
                  opacity: 0.5,
                  fontSize: '9px',
                }}>
                  (click to view)
                </span>
              )}
            </>
          )}
        </div>
      </div>
      {isStarting && (
        <div style={{
          width: '14px',
          height: '14px',
          border: `2px solid ${hexToRgba(color, 0.2)}`,
          borderTopColor: hexToRgba(color, 0.8),
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          flexShrink: 0,
        }} />
      )}
    </div>
  );
}
