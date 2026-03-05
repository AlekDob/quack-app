/**
 * Step 1: Project Context
 * - Working directory selection
 * - Git repository setup
 * - Branch selection (existing or new)
 * - Worktree configuration
 */

import { useState } from 'react';
import type { StepProjectContextProps } from './types';

export function StepProjectContext({
  path,
  branch,
  useWorktree,
  availableBranches,
  loadingBranches,
  isGitRepository,
  initializingGit,
  selectingDirectory,
  onBrowse,
  onBranchChange,
  onUseWorktreeChange,
  onGitInit,
  onNext,
  onCancel,
  isUsing = false,
  onUseConfirm,
}: StepProjectContextProps) {
  // Branch mode state (existing vs new)
  const [branchMode, setBranchMode] = useState<'existing' | 'new'>('existing');
  const [newBranchName, setNewBranchName] = useState('');
  const [fromCurrentBranch, setFromCurrentBranch] = useState(true);

  return (
    <>
      {/* Working Directory */}
      <div className="modal-field">
        <span className="field-label">Working directory</span>
        <div className="modal-selected-path">{path || 'No directory selected'}</div>
        <button
          type="button"
          className="directory-chooser"
          onClick={onBrowse}
          disabled={selectingDirectory}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          </svg>
          {selectingDirectory ? 'Opening Finder…' : 'Choose directory'}
        </button>
      </div>

      {/* Git Warning - Not a Repository */}
      {isGitRepository === false && path && (
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

      {/* Git Branch Section */}
      {availableBranches.length > 0 && (
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
                value={branch}
                onChange={(e) => {
                  console.log('🔍 [StepProjectContext] Branch selected:', e.target.value, 'Previous:', branch);
                  onBranchChange(e.target.value);
                }}
                disabled={loadingBranches}
                className="git-branch-select"
              >
                {loadingBranches ? (
                  <option>Loading branches...</option>
                ) : (
                  availableBranches.map((b) => (
                    <option key={b.name} value={b.name}>
                      {b.name} {b.isCurrent ? '⭐' : ''} {b.hasRemote ? '☁️' : ''}
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
                🌿 Agent will work on this branch independently
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
                  🌳 Creates a separate directory for this agent - perfect for frequent switching!
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
          onClick={isUsing ? onUseConfirm : onNext}
          disabled={!path.trim()}
        >
          {isUsing ? 'Use' : 'Continue →'}
        </button>
      </div>
    </>
  );
}

