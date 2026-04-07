import { useEffect, useRef } from 'react';
import KeyboardShortcutTooltip from '../KeyboardShortcutTooltip';
import './UnifiedActionBar.css';

interface ComposePopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPromptEngineer?: () => void;
  onVoiceClick: () => void;
  isSpeechSupported: boolean;
  onToggleSnippets: () => void;
  onInsertNewLine: () => void;
  onInsertXmlTag: () => void;
  hasIdeContext: boolean;
  ideContextEnabled: boolean;
  onToggleIdeContext: () => void;
  isFullscreen: boolean;
  onToggleFullscreen?: () => void;
}

export default function ComposePopover({
  isOpen,
  onClose,
  onOpenPromptEngineer,
  onVoiceClick,
  isSpeechSupported,
  onToggleSnippets,
  onInsertNewLine,
  onInsertXmlTag,
  hasIdeContext,
  ideContextEnabled,
  onToggleIdeContext,
  isFullscreen,
  onToggleFullscreen,
}: ComposePopoverProps) {
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
          onClick={() => handleItemClick(() => onOpenPromptEngineer?.())}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1l1.5 4.5L14 7l-4.5 1.5L8 13l-1.5-4.5L2 7l4.5-1.5L8 1Z" opacity="0.8"/>
            <path d="M12 2l0.5 1.5L14 4l-1.5 0.5L12 6l-0.5-1.5L10 4l1.5-0.5L12 2Z" opacity="0.6"/>
          </svg>
          <span>Prompt Engineer</span>
        </button>

        <button
          className="uab-popover-item"
          onClick={() => handleItemClick(onVoiceClick)}
          disabled={!isSpeechSupported}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1a2 2 0 0 0-2 2v4a2 2 0 1 0 4 0V3a2 2 0 0 0-2-2Z"/>
            <path d="M4 7v1a4 4 0 0 0 8 0V7h1v1a5 5 0 0 1-4.5 4.975V15h3v1h-7v-1h3v-2.025A5 5 0 0 1 3 8V7h1Z"/>
          </svg>
          <span>Voice Input</span>
        </button>

        <button
          className="uab-popover-item"
          onClick={() => handleItemClick(onToggleSnippets)}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 2h8a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Zm1 2v1h6V4H5Zm0 2.5v1h4v-1H5Zm0 2.5v1h5V9H5Z"/>
          </svg>
          <span>Snippets</span>
        </button>

        <div className="uab-popover-separator" />

        <button
          className="uab-popover-item"
          onClick={() => handleItemClick(onInsertNewLine)}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 13h10M3 3v7h8V7"/>
            <path d="M13 7l-2 3 2 3" transform="translate(-2, -4)"/>
          </svg>
          <span>New Line + _</span>
        </button>

        <button
          className="uab-popover-item"
          onClick={() => handleItemClick(onInsertXmlTag)}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4 4 1 8 4 12"/>
            <polyline points="12 4 15 8 12 12"/>
            <line x1="10" y1="3" x2="6" y2="13"/>
          </svg>
          <span>XML Tag</span>
        </button>

        {hasIdeContext && (
          <button
            className={`uab-popover-item ${ideContextEnabled ? 'uab-popover-item--active' : ''}`}
            onClick={() => handleItemClick(onToggleIdeContext)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6"/>
              <polyline points="8 6 2 12 8 18"/>
            </svg>
            <span>IDE Context</span>
            {ideContextEnabled && <span className="uab-popover-badge">ON</span>}
          </button>
        )}

        {onToggleFullscreen && (
          <>
            <div className="uab-popover-separator" />
            <button
              className="uab-popover-item"
              onClick={() => handleItemClick(onToggleFullscreen)}
            >
              {isFullscreen ? (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 2L2 2L2 6M10 2L14 2L14 6M6 14L2 14L2 10M10 14L14 14L14 10"/>
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 6L2 2L6 2M14 6L14 2L10 2M2 10L2 14L6 14M14 10L14 14L10 14"/>
                </svg>
              )}
              <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
