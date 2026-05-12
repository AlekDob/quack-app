import { memo, useRef } from 'react';
import type { Tab } from '../components/TabBar';
import OfficeViewV1 from '../components/office/OfficeView';
import OfficeViewV2 from '../components/office/v2/OfficeView';
import { isOfficeV2Enabled } from '../components/office/v2/featureFlag';
import type { TerminalInfo } from '../types';

interface OfficeTabViewProps {
  tab: Tab;
  isActive: boolean;
  terminals: TerminalInfo[];
  onRoomClick?: (projectPath: string) => void;
  onDuckClick?: (agentId: string) => void;
  onSessionClick?: (sessionId: string) => void;
  onOpenWhiteboard?: (projectPath: string) => void;
  onExitOffice?: () => void;
}

/**
 * Office Tab View
 * Brain: fix-office-pixi-cancelresize-remount
 * Delays first render until tab is active (correct dimensions).
 * Once mounted, stays mounted with off-screen positioning to preserve WebGL.
 *
 * Brain: fix-office-view-snaps-back-to-chat
 * The spurious click fix is in OfficeRoom.tsx (pointerdown guard), not here.
 * PixiJS v8 EventBoundary.mapPointerUp doesn't clean pressTargetsByButton
 * after normal clicks, and listens for pointerup on globalThis. The guard
 * ensures onRoomClick only fires for genuine pointerdown→pointerup sequences
 * on the canvas container.
 */
function OfficeTabView({
  tab,
  isActive,
  terminals,
  onRoomClick,
  onDuckClick,
  onSessionClick,
  onOpenWhiteboard,
  onExitOffice,
}: OfficeTabViewProps) {
  const hasBeenActive = useRef(false);
  if (isActive) hasBeenActive.current = true;

  if (tab.type !== 'office') return null;
  if (!hasBeenActive.current) return null;

  const offscreen = !isActive
    ? {
        position: 'absolute' as const,
        inset: 0,
        opacity: 0,
        zIndex: -1,
        pointerEvents: 'none' as const,
      }
    : {};

  if (isOfficeV2Enabled()) {
    return (
      <div
        className="office-tab-view"
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          ...offscreen,
        }}
      >
        <OfficeViewV2
          terminals={terminals}
          isActive={isActive}
          onGoToChat={onDuckClick}
          onOpenWhiteboard={onOpenWhiteboard}
        />
      </div>
    );
  }

  return (
    <div
      className="office-tab-view"
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        ...offscreen,
      }}
    >
      <OfficeViewV1
        terminals={terminals}
        isActive={isActive}
        onRoomClick={onRoomClick}
        onDuckClick={onDuckClick}
        onSessionClick={onSessionClick}
        onExitOffice={onExitOffice}
      />
    </div>
  );
}

export default memo(OfficeTabView);
