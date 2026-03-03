import { memo, useRef } from 'react';
import type { Tab } from '../components/TabBar';
import OfficeView from '../components/office/OfficeView';
import type { TerminalInfo } from '../types';

interface OfficeTabViewProps {
  tab: Tab;
  isActive: boolean;
  terminals: TerminalInfo[];
  onRoomClick?: (projectPath: string) => void;
  onDuckClick?: (agentId: string) => void;
  onSessionClick?: (sessionId: string) => void;
  onExitOffice?: () => void;
}

/**
 * Office Tab View
 * Brain: fix-office-pixi-cancelresize-remount
 * Delays first render until tab is active (correct dimensions).
 * Once mounted, stays mounted with off-screen positioning to preserve WebGL.
 */
function OfficeTabView({
  tab,
  isActive,
  terminals,
  onRoomClick,
  onDuckClick,
  onSessionClick,
  onExitOffice,
}: OfficeTabViewProps) {
  const hasBeenActive = useRef(false);
  if (isActive) hasBeenActive.current = true;

  if (tab.type !== 'office') return null;
  // Don't mount OfficeView until tab is first shown (needs correct dimensions)
  if (!hasBeenActive.current) return null;

  return (
    <div
      className="office-tab-view"
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        ...(isActive ? {} : {
          position: 'absolute',
          inset: 0,
          opacity: 0,
          pointerEvents: 'none' as const,
          zIndex: -1,
        }),
      }}
    >
      <OfficeView
        terminals={terminals}
        onRoomClick={onRoomClick}
        onDuckClick={onDuckClick}
        onSessionClick={onSessionClick}
        onExitOffice={onExitOffice}
      />
    </div>
  );
}

export default memo(OfficeTabView);
