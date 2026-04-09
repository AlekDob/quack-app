import React, { useState, useCallback } from 'react';

// MIME types used by sidebar drag sources
const SIDEBAR_MIME_TYPES = [
  'application/quack-file',
  'application/quack-skill',
  'application/quack-rule',
  'application/quack-command',
] as const;

export interface SidebarDropData {
  mimeType: string;
  payload: string;
}

interface SplitDropZoneProps {
  visible: boolean;
  onDropLeft: (tabId: string) => void;
  onDropRight: (tabId: string) => void;
  onSidebarDropLeft?: (data: SidebarDropData) => void;
  onSidebarDropRight?: (data: SidebarDropData) => void;
  onChatDrop?: (data: SidebarDropData) => void;
  showChatZone?: boolean;
}

function extractSidebarData(
  dt: DataTransfer,
): SidebarDropData | null {
  for (const mime of SIDEBAR_MIME_TYPES) {
    const raw = dt.getData(mime);
    if (raw) return { mimeType: mime, payload: raw };
  }
  return null;
}

function isSidebarDrag(dt: DataTransfer): boolean {
  return SIDEBAR_MIME_TYPES.some((m) => dt.types.includes(m));
}

export function SplitDropZone({
  visible,
  onDropLeft,
  onDropRight,
  onSidebarDropLeft,
  onSidebarDropRight,
  onChatDrop,
  showChatZone = false,
}: SplitDropZoneProps) {
  const [activeZone, setActiveZone] = useState<
    'left' | 'right' | 'chat' | null
  >(null);

  const handleDragOver = useCallback(
    (e: React.DragEvent, zone: 'left' | 'right' | 'chat') => {
      e.preventDefault();
      e.dataTransfer.dropEffect = isSidebarDrag(e.dataTransfer)
        ? 'copy'
        : 'move';
      setActiveZone(zone);
    },
    [],
  );

  const handleDragLeave = useCallback(() => {
    setActiveZone(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, zone: 'left' | 'right' | 'chat') => {
      e.preventDefault();

      // Check sidebar MIME types first
      const sidebarData = extractSidebarData(e.dataTransfer);
      if (sidebarData) {
        if (zone === 'chat') onChatDrop?.(sidebarData);
        else if (zone === 'left') onSidebarDropLeft?.(sidebarData);
        else onSidebarDropRight?.(sidebarData);
        setActiveZone(null);
        return;
      }

      // Fallback: tab ID from tab bar drag
      const tabId = e.dataTransfer.getData('text/plain');
      if (!tabId) { setActiveZone(null); return; }
      if (zone === 'left') onDropLeft(tabId);
      else onDropRight(tabId);
      setActiveZone(null);
    },
    [onDropLeft, onDropRight, onSidebarDropLeft, onSidebarDropRight, onChatDrop],
  );

  if (!visible) return null;

  return (
    <div className={`split-drop-overlay ${showChatZone ? 'split-drop-overlay--with-chat' : ''}`}>
      <div className="split-drop-panes">
        <div
          className={`split-drop-zone split-drop-left ${activeZone === 'left' ? 'active' : ''}`}
          onDragOver={(e) => handleDragOver(e, 'left')}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, 'left')}
        >
          <span className="split-drop-label">Left</span>
        </div>
        <div
          className={`split-drop-zone split-drop-right ${activeZone === 'right' ? 'active' : ''}`}
          onDragOver={(e) => handleDragOver(e, 'right')}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, 'right')}
        >
          <span className="split-drop-label">Right</span>
        </div>
      </div>
      {showChatZone && (
        <div
          className={`split-drop-zone split-drop-chat ${activeZone === 'chat' ? 'active' : ''}`}
          onDragOver={(e) => handleDragOver(e, 'chat')}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, 'chat')}
        >
          <span className="split-drop-label">@ Chat</span>
        </div>
      )}
    </div>
  );
}
