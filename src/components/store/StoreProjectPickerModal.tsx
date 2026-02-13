import { useState } from 'react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import type { ActiveProject } from '../modal-steps/types';

interface StoreProjectPickerModalProps {
  projects: ActiveProject[];
  resourceName: string;
  onSelect: (path: string, name: string) => void;
  onCancel: () => void;
}

function extractProjectName(path: string): string {
  const parts = path.split('/').filter(Boolean);
  return parts[parts.length - 1] || path;
}

function truncatePath(path: string): string {
  const parts = path.split('/').filter(Boolean);
  if (parts.length <= 2) return path;
  return `.../${parts.slice(-2).join('/')}`;
}

export default function StoreProjectPickerModal({
  projects,
  resourceName,
  onSelect,
  onCancel,
}: StoreProjectPickerModalProps) {
  const [browsing, setBrowsing] = useState(false);

  const handleBrowse = async () => {
    setBrowsing(true);
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: 'Select project directory',
      }) as string | string[] | null;

      if (typeof selected === 'string') {
        const name = extractProjectName(selected);
        onSelect(selected, name);
      }
    } catch (err) {
      console.error('Failed to open directory picker:', err);
    } finally {
      setBrowsing(false);
    }
  };

  return (
    <div className="store-detail-overlay" onClick={onCancel}>
      <div
        className="store-detail-panel"
        style={{ maxWidth: '480px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="store-detail-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px' }}>
          <div className="store-detail-title-group">
            <h3 className="store-detail-name">Select Project</h3>
            <span className="store-detail-meta">
              Where should {resourceName} be installed?
            </span>
          </div>
          <button type="button" className="store-detail-close" onClick={onCancel}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Project List */}
        <div style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '50vh', overflowY: 'auto' }}>
          {/* Browse for new */}
          <button
            type="button"
            onClick={handleBrowse}
            disabled={browsing}
            style={{
              padding: '10px 12px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px dashed rgba(255, 255, 255, 0.15)',
              borderRadius: '6px',
              cursor: 'pointer',
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.15s ease',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            {browsing ? 'Opening Finder...' : 'Browse for project...'}
          </button>

          {/* Existing projects */}
          {projects.length > 0 && (
            <>
              <div style={{
                fontSize: '10px',
                fontWeight: 600,
                color: 'rgba(255, 255, 255, 0.4)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginTop: '4px',
              }}>
                Active projects
              </div>

              {projects.map((project) => (
                <button
                  key={project.path}
                  type="button"
                  onClick={() => onSelect(project.path, project.name)}
                  style={{
                    padding: '10px 12px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: project.color,
                      flexShrink: 0,
                    }} />
                    <span style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'rgba(255, 255, 255, 0.95)',
                    }}>
                      {project.name}
                    </span>
                    <span style={{
                      fontSize: '9px',
                      color: 'rgba(255, 255, 255, 0.4)',
                      marginLeft: 'auto',
                    }}>
                      {project.agentCount} agent{project.agentCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <span style={{
                    fontSize: '10px',
                    color: 'rgba(255, 255, 255, 0.4)',
                    fontFamily: "'Fira Code', 'Monaco', monospace",
                  }}>
                    {truncatePath(project.path)}
                  </span>
                </button>
              ))}
            </>
          )}
        </div>

        {/* Cancel */}
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          paddingTop: '12px',
          display: 'flex',
          justifyContent: 'flex-end',
        }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '6px 16px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
