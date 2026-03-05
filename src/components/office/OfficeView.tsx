import { useRef, useState, useCallback, useMemo, useEffect } from 'react';
// Brain: gotcha-pixi-csp-unsafe-eval
// MUST import before any PixiJS usage — replaces new Function() calls with
// CSP-safe polyfills. Without this, production builds enforce script-src 'self'
// which blocks shader compilation → black screen.
import 'pixi.js/unsafe-eval';
import { Application, extend } from '@pixi/react';
import { Container, Graphics, Text, Sprite, Application as PixiApplication } from 'pixi.js';
import OfficeScene from './OfficeScene';
import OfficeActionMenu from './OfficeActionMenu';
import { computeRoomPositions, computeBreakRoomPosition } from './officeLayout';
import type { TerminalInfo, ChatMessage } from '../../types';
import type { ActionMenuData } from './officeTypes';
import { useSessionStore } from '../../stores/sessionStore';
import { useChatStore } from '../../stores/chatStore';
import './OfficeView.css';

/**
 * DRY: Exact same logic as AgentSessionItem.getActivityDotColor, but returns hex int for PixiJS.
 * Priority: Awaiting (purple) > Working (yellow) > Ready (green) > Empty (gray)
 */
function getSessionDotHex(
  sessionId: string,
  chatLoadingMap: Map<string, boolean>,
  pendingQuestionsMap: Map<string, Set<string>>,
  chatSessions: Map<string, ChatMessage[]>,
): number {
  // 1. Purple: pending user question (highest priority)
  const hasPending = (pendingQuestionsMap.get(sessionId)?.size ?? 0) > 0;
  if (hasPending) return 0xa855f7;

  // 2. Yellow: isActuallyLoading (chatLoadingMap OR last message streaming)
  const isLoading = chatLoadingMap.get(sessionId) ?? false;
  const messages = chatSessions.get(sessionId) ?? [];
  const lastMessage = messages[messages.length - 1];
  const isStreaming = lastMessage?.role === 'assistant' && lastMessage.status === 'streaming';
  if (isLoading || isStreaming) return 0xf59e0b;

  // 3. Green: agent ready (last assistant message is complete)
  const isDormant = messages.length === 0 || !messages.some(m => m.role === 'user');
  if (!isDormant && lastMessage?.role === 'assistant'
    && (lastMessage.status === 'complete' || lastMessage.status === undefined)) {
    return 0x22c55e;
  }

  // 4. Gray: empty or dormant
  return 0x6b7280;
}

// Register PixiJS components once at module level
extend({ Container, Graphics, Text, Sprite });

// Brain: fix-office-pixi-cancelresize-remount
// Patch Application.prototype.destroy to catch _cancelResize TypeError.
// Root cause: @pixi/react v8 calls app.destroy() inside its internal reconciler's
// commitCallbacks phase. If ResizePlugin.init() never completed (async race),
// _cancelResize is undefined → TypeError → reconciler marks root as
// RootFatalErrored → ALL future rendering stops → blank canvas.
// Wrapping destroy in try-catch prevents the error from reaching the reconciler.
const origAppDestroy = PixiApplication.prototype.destroy;
PixiApplication.prototype.destroy = function (
  ...args: Parameters<typeof origAppDestroy>
) {
  try {
    origAppDestroy.apply(this, args);
  } catch (err) {
    if (err instanceof TypeError && String(err).includes('_cancelResize')) {
      return;
    }
    throw err;
  }
};

interface OfficeViewProps {
  terminals: TerminalInfo[];
  onRoomClick?: (projectPath: string) => void;
  onDuckClick?: (agentId: string) => void;
  onSessionClick?: (sessionId: string) => void;
  onExitOffice?: () => void;
}

export default function OfficeView({
  terminals,
  onRoomClick,
  onDuckClick,
  onSessionClick,
  onExitOffice,
}: OfficeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Center viewport on the relax room at grid (0,0).
  // gridToIso(0,0) = (0,0), so we just need half container size as offset.
  const [viewport, setViewport] = useState({ zoom: 0.8, panX: 0, panY: 0 });
  const [actionMenu, setActionMenu] = useState<ActionMenuData | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  // Filter: only agents with non-completed sessions
  const sessions = useSessionStore(state => state.sessions);
  const activeTerminals = useMemo(() => {
    return terminals.filter(t =>
      sessions.some(s => s.agentId === t.id && (s.status === 'todo' || s.status === 'in_progress'))
    );
  }, [terminals, sessions]);

  const rooms = useMemo(() => computeRoomPositions(activeTerminals), [activeTerminals]);
  const breakRoom = useMemo(() => computeBreakRoomPosition(rooms.length), [rooms.length]);

  // DRY: compute session dot colors in DOM tree (Zustand works here)
  // then pass down as props to PixiJS tree where Zustand subscriptions don't trigger re-renders
  // Brain: fix-office-status-dot-chatloadingmap-key-mismatch
  // DRY: read ALL the same stores that AgentSessionList reads
  const chatLoadingMap = useChatStore(state => state.chatLoadingMap);
  const pendingQuestionsMap = useChatStore(state => state.pendingQuestionsMap);
  const chatSessions = useChatStore(state => state.chatSessions);
  const agentDotColors = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const t of activeTerminals) {
      const agentSessions = sessions
        .filter(s => s.agentId === t.id && s.status === 'in_progress');
      map.set(t.id, agentSessions.map(s =>
        getSessionDotHex(s.id, chatLoadingMap, pendingQuestionsMap, chatSessions),
      ));
    }
    return map;
  }, [activeTerminals, sessions, chatLoadingMap, pendingQuestionsMap, chatSessions]);

  // Track container size for Application
  const hasCentered = useRef(false);
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setContainerSize({ w: width, h: height });
      // Center viewport on grid origin (0,0) on first measurement
      if (!hasCentered.current && width > 0) {
        hasCentered.current = true;
        const canvasH = height - 48; // subtract header
        setViewport(prev => ({
          ...prev,
          panX: width / 2,
          panY: canvasH / 2,
        }));
      }
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
          {rooms.length} progetti &middot; {activeTerminals.length} agenti attivi
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
            breakRoom={breakRoom}
            viewport={viewport}
            agentDotColors={agentDotColors}
            onRoomClick={onRoomClick}
            onDuckClick={(agentId, screenX, screenY) => {
              console.log('[OfficeView] onDuckClick received:', agentId, screenX, screenY);
              setActionMenu({ agentId, screenX, screenY });
            }}
          />
        </Application>
      )}

      {/* HTML overlays */}
      {actionMenu && (
        <OfficeActionMenu
          data={actionMenu}
          terminals={terminals}
          onGoToChat={handleDuckAction}
          onSessionClick={(sessionId) => {
            setActionMenu(null);
            onSessionClick?.(sessionId);
          }}
          onClose={() => setActionMenu(null)}
        />
      )}
    </div>
  );
}
