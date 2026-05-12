import { memo, useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useOfficeLayout } from './useOfficeLayout';
import { buildViewModels } from './officeViewModels';
import { OfficeCanvas } from './OfficeCanvas';
import { OfficeTagFilter } from './OfficeTagFilter';
import { OfficeToolbar, type OfficeMode } from './OfficeToolbar';
import { OfficeRoomContextMenu, type RoomContextTarget } from './OfficeRoomContextMenu';
import { ConfirmModal } from '../../ConfirmModal';
import { useSessionStore } from '../../../stores/sessionStore';
import { useChatStore } from '../../../stores/chatStore';
import type { TerminalInfo } from '../../../types';
import './OfficeView.css';

interface Props {
  terminals: TerminalInfo[];
  isActive: boolean;
  onGoToChat?: (agentId: string) => void;
  onOpenWhiteboard?: (projectPath: string) => void;
}

function OfficeViewImpl({ terminals, isActive, onGoToChat, onOpenWhiteboard }: Props) {
  const {
    layout,
    setRoomPosition,
    toggleTag,
    resetLayout,
    ready,
    addPostIt, updatePostIt, deletePostIt,
    addCustomGroup, updateCustomGroup, deleteCustomGroup,
    addSticker, updateSticker, deleteSticker,
    addText, updateText, deleteText,
    duplicateItems,
    addTag, deleteTag, toggleRoomTag,
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

  const [confirmReset, setConfirmReset] = useState(false);
  const [mode, setMode] = useState<OfficeMode>('select');
  const [activeSticker, setActiveSticker] = useState<string | null>(null);
  const [roomContext, setRoomContext] = useState<RoomContextTarget | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleModeReset = useCallback(() => {
    setMode('select');
    setActiveSticker(null);
  }, []);

  // Cmd+C / Cmd+V clipboard (office-internal). Holds selection keys ("postit:abc", "text:xyz", …).
  const clipboardKeysRef = useRef<string[]>([]);
  const pasteOffsetRef = useRef<number>(0);

  useEffect(() => {
    if (!isActive) return;
    const handler = (e: KeyboardEvent) => {
      const t = e.target;
      if (t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
        return;
      }
      if (e.key === 'Escape') {
        if (selectedIds.size > 0) setSelectedIds(new Set());
        return;
      }

      // Copy / Paste / Duplicate — operate on annotations only (rooms excluded by duplicateItems)
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();

      if (key === 'c') {
        const keys = Array.from(selectedIds).filter(k => !k.startsWith('room:'));
        if (keys.length === 0) return;
        e.preventDefault();
        clipboardKeysRef.current = keys;
        pasteOffsetRef.current = 0;
        return;
      }

      if (key === 'v') {
        const keys = clipboardKeysRef.current;
        if (keys.length === 0) return;
        e.preventDefault();
        pasteOffsetRef.current += 24;
        const off = pasteOffsetRef.current;
        const newKeys = duplicateItems(keys, off, off);
        if (newKeys.length > 0) {
          setSelectedIds(new Set(newKeys));
          clipboardKeysRef.current = newKeys;
        }
        return;
      }

      if (key === 'd') {
        const keys = Array.from(selectedIds).filter(k => !k.startsWith('room:'));
        if (keys.length === 0) return;
        e.preventDefault();
        const newKeys = duplicateItems(keys, 24, 24);
        if (newKeys.length > 0) setSelectedIds(new Set(newKeys));
        return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isActive, undo, redo, selectedIds, duplicateItems]);

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
        onAddTag={addTag}
        onDeleteTag={deleteTag}
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
          onPopulate={resetLayout}
          onRoomMoved={(projectPath, x, y) => setRoomPosition(projectPath, x, y)}
          onDuckClick={(agentId) => onGoToChat?.(agentId)}
          onCardClick={(projectPath) => onOpenWhiteboard?.(projectPath)}
          onCardDoubleClick={(projectPath) => onOpenWhiteboard?.(projectPath)}
          onRoomContextMenu={(projectPath, e) => setRoomContext({ projectPath, screenX: e.clientX, screenY: e.clientY })}
          onAddPostIt={addPostIt}
          onUpdatePostIt={updatePostIt}
          onDeletePostIt={deletePostIt}
          onAddGroup={addCustomGroup}
          onUpdateGroup={updateCustomGroup}
          onDeleteGroup={deleteCustomGroup}
          onAddSticker={addSticker}
          onUpdateSticker={updateSticker}
          onDeleteSticker={deleteSticker}
          onAddText={addText}
          onUpdateText={updateText}
          onDeleteText={deleteText}
          onDuplicateItems={duplicateItems}
          onBeginDrag={beginDrag}
          onEndDrag={endDrag}
          selectedIds={selectedIds}
          onSelectedIds={setSelectedIds}
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
          selectionCount={selectedIds.size}
        />
      </div>

      {roomContext && (() => {
        const room = layout.rooms.find(r => r.projectPath === roomContext.projectPath);
        return (
          <OfficeRoomContextMenu
            target={roomContext}
            tags={layout.tags}
            assignedTagIds={room?.tagIds ?? []}
            onToggleTag={(tagId) => toggleRoomTag(roomContext.projectPath, tagId)}
            onCreateTag={addTag}
            onClose={() => setRoomContext(null)}
          />
        );
      })()}

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
