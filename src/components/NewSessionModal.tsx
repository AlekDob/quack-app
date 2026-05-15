/**
 * NewSessionModal Component
 *
 * Modal for creating a new AgentSession with branch selection.
 * Branch is per-session, not per-agent — allowing the same agent to work
 * on different branches across different sessions.
 *
 * Features:
 * - Use existing branch or create new
 * - Dirty working tree detection (warns if uncommitted changes)
 * - Worktree option for isolated work
 */

import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './NewSessionModal.css';

interface GitBranch {
  name: string;
  is_current: boolean;
  is_remote: boolean;
  tracking?: string;
}

interface NewSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (title: string, branch?: string, useWorktree?: boolean, backend?: import('../types/agentBackend').AgentBackendKind) => void;
  agentName?: string;
  projectPath?: string;
  defaultBranch?: string;
}

type BranchMode = 'existing' | 'new';

function generateDefaultTitle(): string {
  const now = new Date();
  const month = now.toLocaleString('en-US', { month: 'short' });
  const day = now.getDate();
  const hour = now.getHours().toString().padStart(2, '0');
  const minute = now.getMinutes().toString().padStart(2, '0');
  return `Session ${month} ${day} ${hour}:${minute}`;
}

export default function NewSessionModal({
  isOpen,
  onClose,
  onSubmit,
  agentName,
  projectPath,
  defaultBranch,
}: NewSessionModalProps) {
  const [title, setTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Branch state
  const [branches, setBranches] = useState<GitBranch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [branchMode, setBranchMode] = useState<BranchMode>('existing');
  const [newBranchName, setNewBranchName] = useState('');
  const [branchFromCurrent, setBranchFromCurrent] = useState(true);
  const [useWorktree, setUseWorktree] = useState(false);
  const [showBranchSection, setShowBranchSection] = useState(false);

  // Backend selector
  const [backend, setBackend] = useState<'claude' | 'codex'>('claude');
  const [codexAuth, setCodexAuth] = useState<'ready' | 'needs_login' | 'unknown'>('unknown');
  useEffect(() => {
    if (backend === 'codex') {
      import('../services/codexAuthService').then(m => m.getCodexAuthStatus().then(setCodexAuth));
    }
  }, [backend]);

  // Git status
  const [isDirty, setIsDirty] = useState(false);
  const [dirtyFileCount, setDirtyFileCount] = useState(0);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setIsSubmitting(false);
      setSelectedBranch(defaultBranch ?? '');
      setBranchMode('existing');
      setNewBranchName('');
      setBranchFromCurrent(true);
      setUseWorktree(false);
      setShowBranchSection(false);
      setBranches([]);
      setIsDirty(false);
      setDirtyFileCount(0);
    }
  }, [isOpen, defaultBranch]);

  // Load branches + git status when section opens
  useEffect(() => {
    if (!showBranchSection || !projectPath) return;

    // Load branches
    if (branches.length === 0) {
      invoke<GitBranch[]>('git_list_branches', { rootPath: projectPath })
        .then((result) => setBranches(result))
        .catch((err) =>
          console.warn('[NewSessionModal] Failed to load branches:', err)
        );
    }

    // Check dirty status
    invoke<{ clean: boolean; entries: unknown[] }>('git_status_summary', {
      rootPath: projectPath,
    })
      .then((status) => {
        setIsDirty(!status.clean);
        setDirtyFileCount(status.entries?.length ?? 0);
      })
      .catch(() => {
        // Silently fail — dirty check is a nice-to-have
      });
  }, [showBranchSection, projectPath, branches.length]);

  // Determine the effective branch for submission
  const getEffectiveBranch = useCallback((): string | undefined => {
    if (!showBranchSection) return undefined;

    if (branchMode === 'new' && newBranchName.trim()) {
      return newBranchName.trim();
    }

    if (
      branchMode === 'existing' &&
      selectedBranch &&
      selectedBranch !== defaultBranch
    ) {
      return selectedBranch;
    }

    return undefined;
  }, [
    showBranchSection,
    branchMode,
    newBranchName,
    selectedBranch,
    defaultBranch,
  ]);

  const effectiveBranch = getEffectiveBranch();
  const isBranchChange = !!effectiveBranch;
  const isBlockedByDirty = isDirty && isBranchChange && !useWorktree;

  // Handle form submission
  const handleSubmit = useCallback(() => {
    if (isSubmitting || isBlockedByDirty) return;

    setIsSubmitting(true);
    const sessionTitle = title.trim() || generateDefaultTitle();
    onSubmit(
      sessionTitle,
      effectiveBranch,
      effectiveBranch ? useWorktree : undefined,
      backend
    );
  }, [
    title,
    isSubmitting,
    isBlockedByDirty,
    onSubmit,
    effectiveBranch,
    useWorktree,
  ]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit, onClose]
  );

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  if (!isOpen) return null;

  const currentBranch = defaultBranch || 'main';

  return (
    <div
      className="new-session-modal-backdrop"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
    >
      <div className="new-session-modal" role="dialog" aria-modal="true">
        {/* Header */}
        <div className="new-session-modal-header">
          <h2>New Session</h2>
          {agentName && (
            <span className="new-session-modal-agent">for {agentName}</span>
          )}
          <button className="new-session-modal-close" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="new-session-modal-content">
          {/* Session Name */}
          <div className="new-session-form-field">
            <label htmlFor="session-title">
              Session Name
              <span className="new-session-optional">(optional)</span>
            </label>
            <input
              id="session-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={generateDefaultTitle()}
              autoFocus
            />
          </div>

          {/* Backend Selector */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-white/50 mb-1.5">Backend</label>
            <div className="flex gap-1 p-1 rounded-lg bg-white/5">
              {(['claude', 'codex'] as const).map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBackend(b)}
                  className={`flex-1 px-3 py-1.5 text-xs rounded-md transition-colors ${
                    backend === b ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white/80'
                  }`}
                >
                  {b === 'claude' ? 'Claude Code' : 'Codex'}
                </button>
              ))}
            </div>
            {backend === 'codex' && codexAuth === 'needs_login' && (
              <p className="mt-1.5 text-[11px] text-amber-400/90">
                Codex not authenticated. Run <code>codex login --api-key</code> in a terminal.
              </p>
            )}
          </div>

          {/* Git Branch Section */}
          {projectPath && (
            <div className="new-session-branch-section">
              {/* Section header — toggle */}
              <button
                type="button"
                className="new-session-branch-toggle"
                onClick={() => setShowBranchSection(!showBranchSection)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                  strokeLinejoin="round">
                  <line x1="6" y1="3" x2="6" y2="15" />
                  <circle cx="18" cy="6" r="3" />
                  <circle cx="6" cy="18" r="3" />
                  <path d="M18 9a9 9 0 0 1-9 9" />
                </svg>
                <span className="new-session-branch-label">GIT BRANCH</span>
                <span className="new-session-branch-sublabel">
                  Agent workspace
                </span>
                <span className="new-session-branch-badge-git">GIT</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2"
                  style={{
                    transform: showBranchSection
                      ? 'rotate(180deg)'
                      : 'none',
                    transition: 'transform 0.2s',
                    marginLeft: 'auto',
                  }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {showBranchSection && (
                <div className="new-session-branch-panel">
                  {/* Mode tabs: Use existing / Create new */}
                  <div className="new-session-branch-tabs">
                    <button
                      type="button"
                      className={`new-session-branch-tab ${branchMode === 'existing' ? 'active' : ''}`}
                      onClick={() => setBranchMode('existing')}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" strokeWidth="2"
                        strokeLinecap="round" strokeLinejoin="round">
                        <line x1="6" y1="3" x2="6" y2="15" />
                        <circle cx="18" cy="6" r="3" />
                        <circle cx="6" cy="18" r="3" />
                        <path d="M18 9a9 9 0 0 1-9 9" />
                      </svg>
                      Use existing
                    </button>
                    <button
                      type="button"
                      className={`new-session-branch-tab ${branchMode === 'new' ? 'active' : ''}`}
                      onClick={() => setBranchMode('new')}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" strokeWidth="2"
                        strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="16" />
                        <line x1="8" y1="12" x2="16" y2="12" />
                      </svg>
                      Create new
                    </button>
                  </div>

                  {/* Existing branch list */}
                  {branchMode === 'existing' && (
                    <div className="new-session-branch-list">
                      {branches
                        .filter((b) => !b.is_remote)
                        .map((branch) => (
                          <button
                            key={branch.name}
                            type="button"
                            className={`new-session-branch-item ${
                              (selectedBranch || defaultBranch) ===
                              branch.name
                                ? 'active'
                                : ''
                            }`}
                            onClick={() => setSelectedBranch(branch.name)}
                          >
                            <span className="new-session-branch-name">
                              {branch.name}
                            </span>
                            {branch.is_current && (
                              <span className="new-session-branch-current">
                                current
                              </span>
                            )}
                          </button>
                        ))}
                      {branches.length === 0 && (
                        <div className="new-session-branch-loading">
                          Loading branches...
                        </div>
                      )}
                    </div>
                  )}

                  {/* Create new branch */}
                  {branchMode === 'new' && (
                    <div className="new-session-new-branch">
                      <input
                        type="text"
                        value={newBranchName}
                        onChange={(e) => setNewBranchName(e.target.value)}
                        placeholder="e.g., feature/agent-name"
                        className="new-session-new-branch-input"
                      />
                      <label className="new-session-branch-from-current">
                        <input
                          type="checkbox"
                          checked={branchFromCurrent}
                          onChange={(e) =>
                            setBranchFromCurrent(e.target.checked)
                          }
                        />
                        <span>
                          Branch from current ({currentBranch})
                        </span>
                      </label>
                      {newBranchName.trim() && (
                        <span className="new-session-branch-hint">
                          Agent will work on this branch independently
                        </span>
                      )}
                    </div>
                  )}

                  {/* Worktree option — shown when branch differs */}
                  {isBranchChange && (
                    <label className="new-session-worktree-toggle">
                      <input
                        type="checkbox"
                        checked={useWorktree}
                        onChange={(e) => setUseWorktree(e.target.checked)}
                      />
                      <div className="new-session-worktree-info">
                        <span>Use worktree (isolated copy)</span>
                        <span className="new-session-worktree-desc">
                          Agent works in a separate directory without
                          affecting your main workspace
                        </span>
                      </div>
                    </label>
                  )}

                  {/* Dirty warning */}
                  {isDirty && isBranchChange && (
                    <div
                      className={`new-session-dirty-warning ${useWorktree ? 'resolved' : ''}`}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" strokeWidth="2"
                        strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                      <div>
                        {useWorktree ? (
                          <span>
                            Worktree will isolate changes —{' '}
                            {dirtyFileCount} uncommitted file
                            {dirtyFileCount !== 1 ? 's' : ''} in main
                            workspace won&apos;t be affected
                          </span>
                        ) : (
                          <span>
                            {dirtyFileCount} uncommitted file
                            {dirtyFileCount !== 1 ? 's' : ''} detected.
                            Commit or stash changes before switching
                            branch, or enable worktree for isolated work.
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="new-session-modal-footer">
          <button
            className="new-session-button secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            className="new-session-button primary"
            onClick={handleSubmit}
            disabled={isSubmitting || isBlockedByDirty}
            title={
              isBlockedByDirty
                ? 'Commit changes or enable worktree first'
                : undefined
            }
          >
            {isSubmitting ? (
              <>
                <span className="new-session-spinner" />
                Creating...
              </>
            ) : (
              <>Continue &rarr;</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
