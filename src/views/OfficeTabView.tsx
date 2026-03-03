import { memo } from 'react';
import type { Tab } from '../components/TabBar';
import OfficeView from '../components/office/OfficeView';
import type { TerminalInfo } from '../types';

interface OfficeTabViewProps {
  tab: Tab;
  isActive: boolean;
  terminals: TerminalInfo[];
  onRoomClick?: (projectPath: string) => void;
  onDuckClick?: (agentId: string) => void;
  onExitOffice?: () => void;
}

/**
 * Office Tab View
 * Wraps OfficeView for use as a tab (same pattern as AutomationTabView)
 */
function OfficeTabView({
  tab,
  isActive,
  terminals,
  onRoomClick,
  onDuckClick,
  onExitOffice,
}: OfficeTabViewProps) {
  if (!isActive || tab.type !== 'office') {
    return null;
  }

  return (
    <div className="office-tab-view" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <OfficeView
        terminals={terminals}
        onRoomClick={onRoomClick}
        onDuckClick={onDuckClick}
        onExitOffice={onExitOffice}
      />
    </div>
  );
}

export default memo(OfficeTabView);
