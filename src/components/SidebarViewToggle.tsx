import { memo } from 'react';
import KeyboardShortcutTooltip from './KeyboardShortcutTooltip';

interface SidebarViewToggleProps {
  activeView: 'projects' | 'taskhub';
  onChange: (view: 'projects' | 'taskhub') => void;
}

function SidebarViewToggle({ activeView, onChange }: SidebarViewToggleProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        background: 'var(--bg-elevated)',
        borderRadius: 'var(--radius-sm)',
        padding: '1px',
        marginLeft: '4px',
      }}
    >
      <KeyboardShortcutTooltip label="Projects">
        <button
          type="button"
          className="action-icon"
          onClick={() => onChange('projects')}
          aria-label="Projects view"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            height: '22px',
            background: activeView === 'projects' ? 'var(--bg-hover)' : 'transparent',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            color: activeView === 'projects' ? 'var(--text-primary)' : 'var(--text-tertiary)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          {/* Folder icon */}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      </KeyboardShortcutTooltip>
      <KeyboardShortcutTooltip label="Task Hub">
        <button
          type="button"
          className="action-icon"
          onClick={() => onChange('taskhub')}
          aria-label="Task Hub view"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            height: '22px',
            background: activeView === 'taskhub' ? 'var(--bg-hover)' : 'transparent',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            color: activeView === 'taskhub' ? 'var(--text-primary)' : 'var(--text-tertiary)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          {/* List/checklist icon */}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
        </button>
      </KeyboardShortcutTooltip>
    </div>
  );
}

export default memo(SidebarViewToggle);
