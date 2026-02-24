import { memo } from 'react';
import type { Tab } from '../components/TabBar';
import AutomationView from '../components/automation/AutomationView';
import type { TerminalInfo, AutomationJob } from '../types';

interface AutomationTabViewProps {
  tab: Tab;
  isActive: boolean;
  terminals: TerminalInfo[];
  onSessionClick?: (sessionId: string) => void;
  onExitAutomation?: () => void;
  onFireJob?: (job: AutomationJob) => void;
}

/**
 * Automation Tab View
 * Wraps AutomationView for use as a tab (same pattern as KanbanTabView)
 */
function AutomationTabView({
  tab,
  isActive,
  terminals,
  onSessionClick,
  onExitAutomation,
  onFireJob,
}: AutomationTabViewProps) {
  if (!isActive || tab.type !== 'automation') {
    return null;
  }

  return (
    <div className="automation-tab-view" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <AutomationView
        terminals={terminals}
        onSessionClick={onSessionClick}
        onExitAutomation={onExitAutomation}
        onFireJob={onFireJob}
      />
    </div>
  );
}

export default memo(AutomationTabView);
