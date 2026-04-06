import React, { useState, useCallback } from 'react';

interface SplitDropZoneProps {
  visible: boolean;
  onDropLeft: (tabId: string) => void;
  onDropRight: (tabId: string) => void;
}

export function SplitDropZone({ visible, onDropLeft, onDropRight }: SplitDropZoneProps) {
  const [activeZone, setActiveZone] = useState<'left' | 'right' | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent, zone: 'left' | 'right') => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setActiveZone(zone);
  }, []);

  const handleDragLeave = useCallback(() => {
    setActiveZone(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, zone: 'left' | 'right') => {
    e.preventDefault();
    const tabId = e.dataTransfer.getData('text/plain');
    if (!tabId) return;
    if (zone === 'left') onDropLeft(tabId);
    else onDropRight(tabId);
    setActiveZone(null);
  }, [onDropLeft, onDropRight]);

  if (!visible) return null;

  return (
    <div className="split-drop-overlay">
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
  );
}
