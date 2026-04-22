import { memo, useMemo, useState, useCallback, useEffect } from 'react';
import { useOfficeLayout } from './useOfficeLayout';
import { buildViewModels } from './officeViewModels';
import { OfficeCanvas } from './OfficeCanvas';
import { OfficeTagFilter } from './OfficeTagFilter';
import { OfficeToolbar, type OfficeMode } from './OfficeToolbar';
import OfficeActionMenu from './OfficeActionMenu';
import { ConfirmModal } from '../../ConfirmModal';
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
  const {
    layout,
    setRoomPosition,
    toggleTag,
    resetLayout,
    ready,
    addPostIt, updatePostIt, deletePostIt,
    addCustomGroup, updateCustomGroup, deleteCustomGroup,
    addSticker, updateSticker, deleteSticker,
    beginDrag, endDrag,
    undo, redo, canUndo, canRedo,
  } = useOfficeLayout(terminals);

  const sessions = useSessionStore(s => s.sessions);
  const chatLoadingMap = useChatStore(s => s.chatLoadingMap);
  const pendingQuestionsMap = useChatStore(s => s.pendingQuestionsMap);
  const chatSessions = useChatStore(s => s.chatSessions);

  const viewModels = useMemo(
    () => buildViewModels({ terminals, sessions, chatLoadingMap, pendingQuestionsMap, chatSessions }),
    [terminals, sessions, chatLoadingMap, pendingQuestionsMap, chatSessions]
  );

  const [actionMenu, setActionMenu] = useState<{ agentId: string; x: number; y: number } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [mode, setMode] = useState<OfficeMode>('select');
  const [activeSticker, setActiveSticker] = useState<string | null>(null);

  const handleModeReset = useCallback(() => {
    setMode('select');
    setActiveSticker(null);
  }, []);

  useEffect(() => {
    if (!isActive) return;
    const handler = (e: KeyboardEvent) => {
      const t = e.target;
      if (t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isActive, undo, redo]);

  if (!ready || !layout) {
    return <div className="office-view office-view--loading">Loading…</div>;
  }

  return (
    <div className="office-view" data-active={isActive}>
      <OfficeTagFilter
        tags={layout.tags}
        activeTagIds={layout.activeTagIds}
        onToggle={toggleTag}
        onReset={() => setConfirmReset(true)}
      />

      <div className="office-view__canvas-wrap">
        <OfficeCanvas
          layout={layout}
          terminals={terminals}
          ducksByProject={viewModels.ducksByProject}
          doorPlateColorByProject={viewModels.doorPlateByProject}
          busyRatioByProject={viewModels.busyRatioByProject}
          countsByProject={viewModels.countsByProject}
          mode={mode}
          activeSticker={activeSticker}
          onModeReset={handleModeReset}
          onRoomMoved={(projectPath, x, y) => setRoomPosition(projectPath, x, y)}
          onDuckClick={(agentId, e) => setActionMenu({ agentId, x: e.clientX, y: e.clientY })}
          onCardDoubleClick={() => {
            console.info('[office-v2] Floor plan overlay coming later');
          }}
          onAddPostIt={addPostIt}
          onUpdatePostIt={updatePostIt}
          onDeletePostIt={deletePostIt}
          onAddGroup={addCustomGroup}
          onUpdateGroup={updateCustomGroup}
          onDeleteGroup={deleteCustomGroup}
          onAddSticker={addSticker}
          onUpdateSticker={updateSticker}
          onDeleteSticker={deleteSticker}
          onBeginDrag={beginDrag}
          onEndDrag={endDrag}
        />

        <OfficeToolbar
          mode={mode}
          onModeChange={setMode}
          activeSticker={activeSticker}
          onStickerChange={setActiveSticker}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={undo}
          onRedo={redo}
        />
      </div>

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

      <ConfirmModal
        isOpen={confirmReset}
        title="Reset office layout?"
        message="All cards return to the default grid and all post-its, groups and stickers are cleared."
        confirmLabel="Reset"
        onConfirm={() => {
          resetLayout();
          setConfirmReset(false);
        }}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  );
}

export default memo(OfficeViewImpl);
