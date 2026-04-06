import React, { useCallback, useRef } from 'react';

interface SplitPaneDividerProps {
  onRatioChange: (ratio: number) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  minPaneWidth?: number;
}

export function SplitPaneDivider({ onRatioChange, containerRef, minPaneWidth = 300 }: SplitPaneDividerProps) {
  const isDragging = useRef(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const clamped = Math.max(minPaneWidth, Math.min(x, rect.width - minPaneWidth));
      onRatioChange(clamped / rect.width);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [onRatioChange, containerRef, minPaneWidth]);

  return (
    <div
      className="split-divider"
      onMouseDown={handleMouseDown}
    />
  );
}
