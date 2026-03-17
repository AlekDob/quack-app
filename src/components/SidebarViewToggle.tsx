import { memo } from 'react';

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
        background: 'rgba(255, 255, 255, 0.06)',
        borderRadius: '4px',
        padding: '1px',
        marginLeft: '4px',
      }}
    >
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
          background: activeView === 'projects' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
          border: 'none',
          borderRadius: '3px',
          color: activeView === 'projects' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.4)',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
      >
        {/* Folder icon */}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
        <span className="action-icon-tooltip">Projects</span>
      </button>
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
          background: activeView === 'taskhub' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
          border: 'none',
          borderRadius: '3px',
          color: activeView === 'taskhub' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.4)',
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
        <span className="action-icon-tooltip">Task Hub</span>
      </button>
    </div>
  );
}

export default memo(SidebarViewToggle);
