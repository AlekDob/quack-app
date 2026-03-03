import { useState, useCallback, memo } from 'react';
import { useTick } from '@pixi/react';
import type { TerminalInfo } from '../../types';
import type { TooltipData } from './officeTypes';

const DUCK_RADIUS = 16;

interface OfficeDuckProps {
  agent: TerminalInfo;
  localX: number;
  localY: number;
  onHover?: (data: TooltipData | null) => void;
  onClick?: (agentId: string, screenX: number, screenY: number) => void;
}

function OfficeDuck({ agent, localX, localY, onHover, onClick }: OfficeDuckProps) {
  const [bobOffset, setBobOffset] = useState(0);
  const [frame, setFrame] = useState(0);

  // Animation based on agent status
  useTick(() => {
    setFrame(prev => prev + 1);

    if (agent.status === 'busy') {
      // Typing: fast bobbing
      setBobOffset(Math.sin(frame * 0.15) * 3);
    } else if (agent.waitingForResponse) {
      // Thinking: slow oscillation
      setBobOffset(Math.sin(frame * 0.05) * 5);
    } else {
      // Idle: gentle breathing
      setBobOffset(Math.sin(frame * 0.03) * 1.5);
    }
  });

  const duckColor = agent.color
    ? parseInt(agent.color.replace('#', ''), 16)
    : 0x6366f1;

  const statusColor = agent.status === 'busy' ? 0x00ff88 : 0xffaa00;
  const initial = (agent.label || 'A').charAt(0).toUpperCase();

  // Duck body
  const drawBody = useCallback((g: import('pixi.js').Graphics) => {
    g.clear();
    // Body circle
    g.circle(0, 0, DUCK_RADIUS);
    g.fill({ color: duckColor });
    g.stroke({ color: 0xffffff, width: 1.5, alpha: 0.3 });
    // Beak (small triangle to the right)
    g.moveTo(DUCK_RADIUS - 2, -4);
    g.lineTo(DUCK_RADIUS + 8, 0);
    g.lineTo(DUCK_RADIUS - 2, 4);
    g.closePath();
    g.fill({ color: 0xf59e0b });
  }, [duckColor]);

  // Status indicator dot
  const drawStatus = useCallback((g: import('pixi.js').Graphics) => {
    g.clear();
    g.circle(DUCK_RADIUS - 2, -(DUCK_RADIUS - 2), 5);
    g.fill({ color: statusColor });
    g.stroke({ color: 0x0f0f1a, width: 1.5 });
  }, [statusColor]);

  // Typing particles (when busy)
  const drawTypingParticles = useCallback((g: import('pixi.js').Graphics) => {
    g.clear();
    if (agent.status !== 'busy') return;
    const t = frame * 0.1;
    for (let i = 0; i < 3; i++) {
      const px = -15 + i * 8;
      const py = -DUCK_RADIUS - 10 - Math.sin(t + i * 1.5) * 4;
      g.circle(px, py, 2);
      g.fill({ color: 0xaaaacc, alpha: 0.6 });
    }
  }, [agent.status, frame]);

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

  return (
    <pixiContainer
      x={localX}
      y={localY + bobOffset}
      eventMode="static"
      cursor="pointer"
      onpointerenter={handlePointerEnter}
      onpointerleave={() => onHover?.(null)}
      onclick={handleClick}
    >
      <pixiGraphics draw={drawBody} />
      <pixiGraphics draw={drawStatus} />
      <pixiGraphics draw={drawTypingParticles} />

      {/* Agent initial */}
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
    </pixiContainer>
  );
}

export default memo(OfficeDuck);
