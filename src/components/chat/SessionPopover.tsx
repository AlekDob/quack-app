import { useEffect, useRef } from 'react';
import { Brain } from 'lucide-react';
import './UnifiedActionBar.css';

interface SessionPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onBrainUpdate: () => void;
  onToggleBTW: () => void;
  btwIsOpen: boolean;
  onToggleLoop: () => void;
  onCompact: () => void;
  onOpenTerminal?: () => void;
  onClear?: () => void;
  isLoading: boolean;
}

export default function SessionPopover({
  isOpen,
  onClose,
  onBrainUpdate,
  onToggleBTW,
  btwIsOpen,
  onToggleLoop,
  onCompact,
  onOpenTerminal,
  onClear,
  isLoading,
}: SessionPopoverProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleItemClick = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <div className="uab-popover" ref={menuRef} onMouseDown={(e) => e.preventDefault()}>
      <div className="uab-popover-list">
        <button
          className="uab-popover-item"
          onClick={() => handleItemClick(onBrainUpdate)}
          disabled={isLoading}
        >
          <Brain size={14} />
          <span>Update Brain</span>
        </button>

        <button
          className={`uab-popover-item ${btwIsOpen ? 'uab-popover-item--active' : ''}`}
          onClick={() => handleItemClick(onToggleBTW)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <span>BTW Side-chain</span>
          <span className="uab-popover-shortcut">Ctrl+B</span>
        </button>

        <button
          className="uab-popover-item"
          onClick={() => handleItemClick(onToggleLoop)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
            <path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
          </svg>
          <span>Quick Loop</span>
        </button>

        <div className="uab-popover-separator" />

        <button
          className="uab-popover-item"
          onClick={() => handleItemClick(onCompact)}
          disabled={isLoading}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            <polyline points="7.5 4.21 12 6.81 16.5 4.21"/>
            <polyline points="7.5 19.79 7.5 14.6 3 12"/>
            <polyline points="21 12 16.5 14.6 16.5 19.79"/>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
            <line x1="12" y1="22.08" x2="12" y2="12"/>
          </svg>
          <span>Compact</span>
        </button>

        {onOpenTerminal && (
          <button
            className="uab-popover-item"
            onClick={() => handleItemClick(onOpenTerminal)}
            disabled={isLoading}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 17 10 11 4 5"/>
              <line x1="12" y1="19" x2="20" y2="19"/>
            </svg>
            <span>Open in Terminal</span>
          </button>
        )}

        {onClear && (
          <>
            <div className="uab-popover-separator" />
            <button
              className="uab-popover-item uab-popover-item--danger"
              onClick={() => handleItemClick(onClear)}
              disabled={isLoading}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
              <span>Clear Conversation</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
