import { useState, useRef, useCallback, memo } from 'react';
import { useTick } from '@pixi/react';
import type { TerminalInfo } from '../../types';
import type { TooltipData } from './officeTypes';
import { useAvatarTexture } from './useAvatarTexture';

const AVATAR_RADIUS = 18;
const BORDER_WIDTH = 2.5;
const SESSION_DOT_RADIUS = 3.5;
// Brain: gotcha-console-log-inside-state-updater

interface OfficeDuckProps {
  agent: TerminalInfo;
  localX: number;
  localY: number;
  /** Session dot colors (hex ints), computed in DOM tree via chatLoadingMap */
  dotColors: number[];
  onHover?: (data: TooltipData | null) => void;
  onClick?: (agentId: string, screenX: number, screenY: number) => void;
}

function OfficeDuck({ agent, localX, localY, dotColors, onHover, onClick }: OfficeDuckProps) {
  // frameRef: high-frequency counter, never causes React re-renders
  const frameRef = useRef(0);
  // Throttled tick: triggers React re-render only every 5 frames (~12fps)
  const [, setTick] = useState(0);
  const avatarTexture = useAvatarTexture(agent.avatar);

  useTick(() => {
    frameRef.current += 1;
    // Throttle React re-renders: 60fps → 12fps (5x reduction per duck)
    if (frameRef.current % 5 === 0) {
      setTick(frameRef.current);
    }
  });

  // Derived from frameRef.current at render time — no extra state needed
  const bobOffset = agent.status === 'busy'
    ? Math.sin(frameRef.current * 0.15) * 3
    : agent.waitingForResponse
      ? Math.sin(frameRef.current * 0.05) * 5
      : Math.sin(frameRef.current * 0.03) * 1.5;

  const duckColor = agent.color
    ? parseInt(agent.color.replace('#', ''), 16)
    : 0x6366f1;

  const initial = (agent.label || 'A').charAt(0).toUpperCase();

  // Colored border ring (always drawn)
  const drawBorder = useCallback((g: import('pixi.js').Graphics) => {
    g.clear();
    g.circle(0, 0, AVATAR_RADIUS + BORDER_WIDTH);
    g.fill({ color: duckColor });
  }, [duckColor]);

  // Fallback: solid color circle (when no avatar texture)
  const drawFallback = useCallback((g: import('pixi.js').Graphics) => {
    g.clear();
    g.circle(0, 0, AVATAR_RADIUS);
    g.fill({ color: duckColor });
    g.stroke({ color: 0xffffff, width: 1.5, alpha: 0.3 });
  }, [duckColor]);

  // Session dots: one per active session, arranged in arc at top-right
  // DRY: colors are computed in OfficeView (DOM tree) using chatLoadingMap/pendingQuestionsMap
  // Brain: fix-office-status-dot-chatloadingmap-key-mismatch
  const dotColorsKey = dotColors.join(',');
  const drawSessionDots = useCallback((g: import('pixi.js').Graphics) => {
    g.clear();
    const count = dotColors.length;
    if (count === 0) return;

    const r = AVATAR_RADIUS + BORDER_WIDTH + 1;
    const startAngle = -Math.PI / 4;
    const arcSpan = Math.min(count - 1, 4) * 0.35;
    for (let i = 0; i < Math.min(count, 5); i++) {
      const angle = count === 1
        ? -Math.PI / 4
        : startAngle + (i / (count - 1)) * arcSpan;
      const cx = Math.cos(angle) * r;
      const cy = Math.sin(angle) * r;
      g.circle(cx, cy, SESSION_DOT_RADIUS);
      g.fill({ color: dotColors[i] });
      g.stroke({ color: 0x0f0f1a, width: 1.5 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dotColorsKey]);

  // Typing particles: must redraw every tick when agent is busy
  // No useCallback — fresh function every render so @pixi/react always calls draw
  const drawTypingParticles = (g: import('pixi.js').Graphics) => {
    g.clear();
    if (agent.status !== 'busy') return;
    const t = frameRef.current * 0.1;
    for (let i = 0; i < 3; i++) {
      const px = -15 + i * 8;
      const py = -AVATAR_RADIUS - 10 - Math.sin(t + i * 1.5) * 4;
      g.circle(px, py, 2);
      g.fill({ color: 0xaaaacc, alpha: 0.6 });
    }
  };

  const handlePointerEnter = useCallback(() => {
    onHover?.({
      agentId: agent.id,
      name: agent.label || 'Agent',
      status: agent.status || 'idle',
      workingOn: agent.workingOn,
      screenX: localX,
      screenY: localY,
    });
  }, [agent, localX, localY, onHover]);

  const handleClick = useCallback(() => {
    onClick?.(agent.id, localX, localY);
  }, [agent.id, localX, localY, onClick]);

  const avatarSize = AVATAR_RADIUS * 2;

  return (
    <pixiContainer
      x={localX}
      y={localY + bobOffset}
      eventMode="static"
      cursor="pointer"
      onPointerEnter={handlePointerEnter}
      onPointerLeave={() => onHover?.(null)}
      onClick={handleClick}
    >
      {/* Border ring */}
      <pixiGraphics draw={drawBorder} />

      {/* Avatar image (pre-clipped to circle in useAvatarTexture) */}
      {avatarTexture ? (
        <pixiSprite
          texture={avatarTexture}
          anchor={0.5}
          width={avatarSize}
          height={avatarSize}
        />
      ) : (
        <>
          <pixiGraphics draw={drawFallback} />
          <pixiText
            text={initial}
            anchor={0.5}
            style={{
              fill: '#ffffff',
              fontSize: 13,
              fontFamily: 'Inter, system-ui, sans-serif',
              fontWeight: 'bold',
            }}
          />
        </>
      )}

      <pixiGraphics draw={drawSessionDots} />
      <pixiGraphics draw={drawTypingParticles} />
    </pixiContainer>
  );
}

export default memo(OfficeDuck);
