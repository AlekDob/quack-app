import { memo } from 'react';
import { sessionDotColor } from './officeLayout';

export type DuckStatus = 'busy' | 'idle' | 'waiting';

interface DuckProps {
  agentId: string;
  color: string;
  avatarUrl?: string;
  initial: string;
  status: DuckStatus;
  sessionDots: Array<{ awaiting: boolean; working: boolean; ready: boolean }>;
  onClick?: (agentId: string, e: React.MouseEvent) => void;
}

const AVATAR_RADIUS = 18;
const SESSION_DOT_RADIUS = 3;

function OfficeDuckAvatarImpl({ agentId, color, avatarUrl, initial, status, sessionDots, onClick }: DuckProps) {
  const visibleDots = sessionDots.slice(0, 5);
  return (
    <button
      type="button"
      className={`office-duck office-duck--${status}`}
      style={{ '--duck-color': color } as React.CSSProperties}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(agentId, e);
      }}
      aria-label={`Agent ${initial}`}
    >
      <span className="office-duck__avatar">
        {avatarUrl
          ? <img src={avatarUrl} alt="" />
          : <span className="office-duck__initial">{initial}</span>}
      </span>

      {status === 'busy' && (
        <span className="office-duck__particles" aria-hidden>
          <span /><span /><span />
        </span>
      )}

      {visibleDots.length > 0 && (
        <span className="office-duck__session-dots" aria-hidden>
          {visibleDots.map((dot, i) => {
            const angle = -45 + i * 18;
            return (
              <span
                key={i}
                className="office-duck__dot"
                style={{
                  background: sessionDotColor(dot),
                  transform: `rotate(${angle}deg) translate(0, -${AVATAR_RADIUS + 4}px) rotate(${-angle}deg)`,
                  width: SESSION_DOT_RADIUS * 2,
                  height: SESSION_DOT_RADIUS * 2,
                }}
              />
            );
          })}
        </span>
      )}
    </button>
  );
}

export const OfficeDuckAvatar = memo(OfficeDuckAvatarImpl);
