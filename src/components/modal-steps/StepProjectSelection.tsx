/**
 * Step: Project Selection (Project-First Flow)
 * - Select from active projects in sidebar
 * - OR browse for new directory
 * - Git branch selection (after project chosen)
 * - Worktree configuration
 */

import { useState } from 'react';
import type { GitBranch } from '../../types';

interface ActiveProject {
  name: string;      // e.g., "quack-app"
  path: string;      // e.g., "/Users/alekdob/Desktop/Dev/Personal/quack-app"
  color: string;     // e.g., "#FF6B35"
  agentCount: number;
}

interface StepProjectSelectionProps {
  // Projects from sidebar
  activeProjects: ActiveProject[];

  // Current selection
  selectedPath: string | undefined;
  selectedBranch: string;
  useWorktree: boolean;

  // Git state
  availableBranches: GitBranch[];
  loadingBranches: boolean;
  isGitRepository: boolean | null;
  initializingGit: boolean;
  selectingDirectory: boolean;

  // Callbacks
  onSelectProject: (path: string, color: string) => void;
  onBrowse: () => void;
  onBranchChange: (branch: string) => void;
  onUseWorktreeChange: (useWorktree: boolean) => void;
  onGitInit: () => Promise<void>;
  onNext: () => void;
  onCancel: () => void;
}

export function StepProjectSelection({
  activeProjects,
  selectedPath,
  selectedBranch,
  useWorktree,
  availableBranches,
  loadingBranches,
  isGitRepository,
  initializingGit,
  selectingDirectory,
  onSelectProject,
  onBrowse,
  onBranchChange,
  onUseWorktreeChange,
  onGitInit,
  onNext,
  onCancel,
}: StepProjectSelectionProps) {
  // Branch mode state (existing vs new)
  const [branchMode, setBranchMode] = useState<'existing' | 'new'>('existing');
  const [newBranchName, setNewBranchName] = useState('');
  const [fromCurrentBranch, setFromCurrentBranch] = useState(true);

  // Truncate path for display (show last 2 directories)
  const truncatePath = (path: string): string => {
    const parts = path.split('/').filter(Boolean);
    if (parts.length <= 2) return path;
    return `.../${parts.slice(-2).join('/')}`;
  };

  // Separator component
  const Separator = () => (
    <div style={{
      height: '1px',
      background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.08), transparent)',
      margin: '12px 0'
    }} />
  );

  // Section title component
  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <h4 style={{
      fontSize: '10px',
      fontWeight: '600',
      color: 'rgba(255, 255, 255, 0.45)',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      margin: '0 0 8px 0'
    }}>
      {children}
    </h4>
  );

  return (
    <>
      {/* Section 1: Browse for new project - always first */}
      <SectionTitle>Create a new project</SectionTitle>
      <button
        type="button"
        className="directory-chooser"
        onClick={onBrowse}
        disabled={selectingDirectory}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        </svg>
        {selectingDirectory ? 'Opening Finder...' : 'Browse for new project'}
      </button>

      {/* Show selected path if browsed (not from active projects) */}
      {selectedPath && !activeProjects.some(p => p.path === selectedPath) && (
        <div className="modal-field" style={{ marginTop: '8px' }}>
          <span className="field-label" style={{ fontSize: '10px' }}>Selected directory</span>
          <div className="modal-selected-path" style={{ fontSize: '10px', padding: '6px 10px' }}>{selectedPath}</div>
        </div>
      )}

      {/* Separator between browse and existing projects */}
      {activeProjects.length > 0 && (
        <div style={{
          height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.08), transparent)',
          margin: '16px 0'
        }} />
      )}

      {/* Section 2: Select existing project */}
      {activeProjects.length > 0 && (
        <>
          <SectionTitle>Or select an existing project</SectionTitle>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '8px'
          }}>
            {activeProjects.map((project) => {
              const isSelected = selectedPath === project.path;
              return (
                <button
                  key={project.path}
                  type="button"
                  onClick={() => onSelectProject(project.path, project.color)}
                  style={{
                    position: 'relative',
                    padding: '10px 12px',
                    background: isSelected
                      ? 'rgba(var(--accent-rgb), 0.12)'
                      : 'rgba(255, 255, 255, 0.03)',
                    border: isSelected
                      ? '1px solid var(--accent-color)'
                      : '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                    }
                  }}
                >
                  {/* Checkmark for selected */}
                  {isSelected && (
                    <div style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      width: '16px',
                      height: '16px',
                      background: 'var(--accent-color)',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    </div>
                  )}

                  {/* Project Name + Color Badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: project.color,
                      flexShrink: 0
                    }} />
                    <div style={{
                      fontSize: '12px',
                      fontWeight: '600',
                      color: 'rgba(255, 255, 255, 0.95)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {project.name}
                    </div>
                  </div>

                  {/* Path (truncated) */}
                  <div style={{
                    fontSize: '10px',
                    color: 'rgba(255, 255, 255, 0.45)',
                    fontFamily: "'Fira Code', 'Monaco', monospace",
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }} title={project.path}>
                    {truncatePath(project.path)}
                  </div>

                  {/* Agent Count Badge */}
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                    padding: '2px 6px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    fontSize: '9px',
                    fontWeight: '500',
                    color: 'rgba(255, 255, 255, 0.6)',
                    alignSelf: 'flex-start'
                  }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                      <circle cx="9" cy="7" r="4"></circle>
                    </svg>
                    {project.agentCount}</div>
                </button>
              );
            })}
          </div>
        </>
      )}


      {/* Git Warning - Not a Repository */}
      {isGitRepository === false && selectedPath && (
        <div className="git-warning-section">
          <div className="git-warning-header">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span className="git-warning-title">Git repository not found</span>
          </div>
          <p className="git-warning-text">
            This directory is not a Git repository. Initialize Git to use branch management features.
          </p>
          <button
            type="button"
            className="git-init-button"
            onClick={onGitInit}
            disabled={initializingGit}
          >
            {initializingGit ? (
              <>
                <span className="spinner"></span>
                Initializing Git...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="6" y1="3" x2="6" y2="15"></line>
                  <circle cx="18" cy="6" r="3"></circle>
                  <circle cx="6" cy="18" r="3"></circle>
                  <path d="M18 9a9 9 0 0 1-9 9"></path>
                </svg>
                Initialize Git Repository
              </>
            )}
          </button>
        </div>
      )}

      {/* Git Branch Section - Only show after project selected AND is git repo */}
      {selectedPath && availableBranches.length > 0 && (
        <div className="git-branch-section">
          <div className="git-branch-header">
            <svg className="git-branch-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="6" y1="3" x2="6" y2="15"></line>
              <circle cx="18" cy="6" r="3"></circle>
              <circle cx="6" cy="18" r="3"></circle>
              <path d="M18 9a9 9 0 0 1-9 9"></path>
            </svg>
            <div className="git-branch-header-text">
              <span className="git-branch-title">Git Branch</span>
              <span className="git-branch-subtitle">Agent workspace</span>
            </div>
            <span className="git-badge">GIT</span>
          </div>

          {/* Branch Mode Selector */}
          <div className="git-branch-mode-selector">
            <label className={`git-mode-option ${branchMode === 'existing' ? 'active' : ''}`}>
              <input
                type="radio"
                checked={branchMode === 'existing'}
                onChange={() => setBranchMode('existing')}
              />
              <svg className="git-mode-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="6" y1="3" x2="6" y2="15"></line>
                <circle cx="18" cy="6" r="3"></circle>
                <circle cx="6" cy="18" r="3"></circle>
                <path d="M18 9a9 9 0 0 1-9 9"></path>
              </svg>
              <span>Use existing</span>
            </label>
            <label className={`git-mode-option ${branchMode === 'new' ? 'active' : ''}`}>
              <input
                type="radio"
                checked={branchMode === 'new'}
                onChange={() => setBranchMode('new')}
              />
              <svg className="git-mode-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="16"></line>
                <line x1="8" y1="12" x2="16" y2="12"></line>
              </svg>
              <span>Create new</span>
            </label>
          </div>

          {/* Existing Branch Selection */}
          {branchMode === 'existing' ? (
            <div className="git-branch-input-wrapper">
              <select
                value={selectedBranch}
                onChange={(e) => onBranchChange(e.target.value)}
                disabled={loadingBranches}
                className="git-branch-select"
              >
                {loadingBranches ? (
                  <option>Loading branches...</option>
                ) : (
                  availableBranches.map((b) => (
                    <option key={b.name} value={b.name}>
                      {b.name}{b.isCurrent ? ' (current)' : ''}{b.hasRemote ? ' (remote)' : ''}
                    </option>
                  ))
                )}
              </select>
              <svg className="git-select-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
          ) : (
            /* New Branch Creation */
            <div className="git-branch-create-mode">
              <input
                type="text"
                value={newBranchName}
                onChange={(e) => {
                  setNewBranchName(e.target.value);
                  onBranchChange(e.target.value);
                }}
                placeholder="e.g., feature/agent-name"
                className="git-branch-input"
              />
              <label className="git-branch-checkbox">
                <input
                  type="checkbox"
                  checked={fromCurrentBranch}
                  onChange={(e) => setFromCurrentBranch(e.target.checked)}
                />
                <span className="git-checkbox-checkmark"></span>
                <span className="git-checkbox-label">
                  Branch from current ({availableBranches.find(b => b.isCurrent)?.name || 'main'})
                </span>
              </label>
              <small className="git-branch-hint">
                Agent will work on this branch independently
              </small>
            </div>
          )}

          {/* Worktree Option */}
          {branchMode === 'new' && newBranchName && (
            <>
              <label className="git-branch-checkbox" style={{ marginTop: '12px' }}>
                <input
                  type="checkbox"
                  checked={useWorktree}
                  onChange={(e) => onUseWorktreeChange(e.target.checked)}
                />
                <span className="git-checkbox-checkmark"></span>
                <span className="git-checkbox-label">
                  Use Git Worktree (isolated directory)
                </span>
              </label>
              {useWorktree && (
                <small className="git-branch-hint" style={{ marginTop: '8px', display: 'block' }}>
                  Creates a separate directory for this agent - perfect for frequent switching!
                </small>
              )}
            </>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="modal-actions">
        <button type="button" className="secondary" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="primary"
          onClick={onNext}
          disabled={!selectedPath || !String(selectedPath).trim()}
        >
          Continue →
        </button>
      </div>
    </>
  );
}
