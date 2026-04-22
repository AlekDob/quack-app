import { memo, useMemo, useState } from 'react';
import { useOfficeLayout } from './useOfficeLayout';
import { buildViewModels } from './officeViewModels';
import { OfficeCanvas } from './OfficeCanvas';
import { OfficeTagFilter } from './OfficeTagFilter';
import OfficeActionMenu from './OfficeActionMenu';
import { useSessionStore } from '../../../stores/sessionStore';
import { useChatStore } from '../../../stores/chatStore';
import type { TerminalInfo } from '../../../types';
import './OfficeView.css';

interface Props {
  terminals: TerminalInfo[];
  isActive: boolean;
  onSessionClick?: (sessionId: string) => void;
  onGoToChat?: (agentId: string) => void;
}

function OfficeViewImpl({ terminals, isActive, onSessionClick, onGoToChat }: Props) {
  const { layout, setRoomPosition, setZonePosition, setBreakRoomPosition, toggleTag, ready } = useOfficeLayout(terminals);
  const sessions = useSessionStore(s => s.sessions);
  const chatLoadingMap = useChatStore(s => s.chatLoadingMap);
  const pendingQuestionsMap = useChatStore(s => s.pendingQuestionsMap);
  const chatSessions = useChatStore(s => s.chatSessions);

  const viewModels = useMemo(
    () => buildViewModels({ terminals, sessions, chatLoadingMap, pendingQuestionsMap, chatSessions }),
    [terminals, sessions, chatLoadingMap, pendingQuestionsMap, chatSessions]
  );

  const [actionMenu, setActionMenu] = useState<{ agentId: string; x: number; y: number } | null>(null);

  if (!ready || !layout) {
    return <div className="office-view office-view--loading">Loading…</div>;
  }

  return (
    <div className="office-view" data-active={isActive}>
      <OfficeTagFilter tags={layout.tags} activeTagIds={layout.activeTagIds} onToggle={toggleTag} />

      <OfficeCanvas
        layout={layout}
        terminals={terminals}
        ducksByProject={viewModels.ducksByProject}
        doorPlateColorByProject={viewModels.doorPlateByProject}
        busyRatioByProject={viewModels.busyRatioByProject}
        countsByProject={viewModels.countsByProject}
        onRoomMoved={setRoomPosition}
        onZoneMoved={setZonePosition}
        onBreakRoomMoved={setBreakRoomPosition}
        onDuckClick={(agentId, e) => setActionMenu({ agentId, x: e.clientX, y: e.clientY })}
        onCardDoubleClick={() => {
          console.info('[office-v2] Floor plan overlay coming in v0.9.5');
        }}
      />

      {actionMenu && (
        <OfficeActionMenu
          data={{ agentId: actionMenu.agentId, screenX: actionMenu.x, screenY: actionMenu.y }}
          terminals={terminals}
          onGoToChat={(agentId) => {
            setActionMenu(null);
            onGoToChat?.(agentId);
          }}
          onSessionClick={(sid) => {
            setActionMenu(null);
            onSessionClick?.(sid);
          }}
          onClose={() => setActionMenu(null)}
        />
      )}
    </div>
  );
}

export default memo(OfficeViewImpl);
