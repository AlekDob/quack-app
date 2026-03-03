import { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { Application, extend } from '@pixi/react';
import { Container, Graphics, Text } from 'pixi.js';
import OfficeScene from './OfficeScene';
import OfficeTooltip from './OfficeTooltip';
import OfficeActionMenu from './OfficeActionMenu';
import { computeRoomPositions } from './officeLayout';
import type { TerminalInfo } from '../../types';
import type { TooltipData, ActionMenuData } from './officeTypes';
import './OfficeView.css';

// Register PixiJS components once at module level
extend({ Container, Graphics, Text });

interface OfficeViewProps {
  terminals: TerminalInfo[];
  onRoomClick?: (projectPath: string) => void;
  onDuckClick?: (agentId: string) => void;
  onExitOffice?: () => void;
}

export default function OfficeView({
  terminals,
  onRoomClick,
  onDuckClick,
  onExitOffice,
}: OfficeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ zoom: 0.8, panX: 400, panY: 80 });
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [actionMenu, setActionMenu] = useState<ActionMenuData | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  const rooms = useMemo(
    () => computeRoomPositions(terminals),
    [terminals]
  );

  // Track container size for Application
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(([entry]) => {
      setContainerSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // Zoom via scroll wheel
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setViewport(prev => ({
      ...prev,
      zoom: Math.max(0.3, Math.min(2.0, prev.zoom - e.deltaY * 0.001)),
    }));
  }, []);

  // Pan via mouse drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX, y: e.clientY,
      panX: viewport.panX, panY: viewport.panY,
    };
  }, [viewport.panX, viewport.panY]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setViewport(prev => ({
      ...prev,
      panX: dragStart.current.panX + (e.clientX - dragStart.current.x),
      panY: dragStart.current.panY + (e.clientY - dragStart.current.y),
    }));
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDuckAction = useCallback((agentId: string) => {
    setActionMenu(null);
    onDuckClick?.(agentId);
  }, [onDuckClick]);

  return (
    <div
      ref={containerRef}
      className="office-container"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Header bar */}
      <div className="office-header">
        <h2 className="office-title">Office</h2>
        <div className="office-stats">
          {rooms.length} progetti &middot; {terminals.length} agenti
        </div>
        <button className="office-exit-btn" onClick={onExitOffice}>
          Torna alla Chat
        </button>
      </div>

      {/* PixiJS Canvas */}
      {containerSize.w > 0 && (
        <Application
          width={containerSize.w}
          height={containerSize.h - 48}
          background={0x0f0f1a}
          antialias
        >
          <OfficeScene
            rooms={rooms}
            viewport={viewport}
            onRoomClick={onRoomClick}
            onDuckHover={setTooltip}
            onDuckClick={(agentId, screenX, screenY) => {
              setActionMenu({ agentId, screenX, screenY });
            }}
          />
        </Application>
      )}

      {/* HTML overlays */}
      {tooltip && <OfficeTooltip data={tooltip} />}
      {actionMenu && (
        <OfficeActionMenu
          data={actionMenu}
          terminals={terminals}
          onGoToChat={handleDuckAction}
          onClose={() => setActionMenu(null)}
        />
      )}
    </div>
  );
}
