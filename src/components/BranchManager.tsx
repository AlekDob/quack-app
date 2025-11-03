import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { GitBranch, GitMergeResult, TerminalInfo } from '../types';
import ConflictResolver from './ConflictResolver';
import { getAgentAvatar } from '../utils/agentAvatars';

interface BranchManagerProps {
  rootPath: string | null;
  currentBranch: string;
  terminals: TerminalInfo[];
  onBranchSwitch?: (branchName: string) => void;
  onRefresh?: () => void;
}

type BranchFilter = 'all' | 'current' | 'agent' | 'remote';

const BranchManager: React.FC<BranchManagerProps> = ({
  rootPath,
  currentBranch,
  terminals,
  onBranchSwitch,
  onRefresh,
}) => {
  const [branches, setBranches] = useState<GitBranch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [filter, setFilter] = useState<BranchFilter>('all');
  const [loading, setLoading] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [mergeResult, setMergeResult] = useState<GitMergeResult | null>(null);
  const [showConflictResolver, setShowConflictResolver] = useState(false);

  useEffect(() => {
    loadBranches();
  }, [rootPath]);

  async function loadBranches() {
    if (!rootPath) return;
    setLoading(true);
    try {
      const result = await invoke<GitBranch[]>('git_list_branches', { rootPath });
      setBranches(result);
    } catch (err) {
      console.error('Failed to load branches:', err);
      setBranches([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSwitchBranch(branchName: string) {
    if (!rootPath || branchName === currentBranch) return;
    setLoading(true);
    try {
      await invoke('git_switch_branch', { branchName, rootPath });
      if (onBranchSwitch) {
        onBranchSwitch(branchName);
      }
      if (onRefresh) {
        onRefresh();
      }
      loadBranches();
    } catch (err) {
      console.error('Failed to switch branch:', err);
      alert(`Failed to switch branch: ${err}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleMergeBranch() {
    if (!rootPath || !selectedBranch) return;
    setLoading(true);
    try {
      const result = await invoke<GitMergeResult>('git_merge_branch', {
        branchName: selectedBranch,
        rootPath,
      });
      setMergeResult(result);

      if (result.hasConflicts) {
        setShowConflictResolver(true);
      } else {
        alert(result.message);
        if (onRefresh) {
          onRefresh();
        }
      }
      setShowMergeModal(false);
      loadBranches();
    } catch (err) {
      console.error('Failed to merge branch:', err);
      alert(`Failed to merge branch: ${err}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteBranch(force: boolean = false) {
    if (!rootPath || !selectedBranch) return;
    setLoading(true);
    try {
      await invoke('git_delete_branch', {
        branchName: selectedBranch,
        force,
        rootPath,
      });
      setSelectedBranch(null);
      setShowDeleteConfirm(false);
      loadBranches();
      if (onRefresh) {
        onRefresh();
      }
    } catch (err) {
      console.error('Failed to delete branch:', err);
      alert(`Failed to delete branch: ${err}`);
    } finally {
      setLoading(false);
    }
  }

  function getAgentForBranch(branchName: string): TerminalInfo | undefined {
    return terminals.find((t) => t.branch === branchName);
  }

  function getFilteredBranches(): GitBranch[] {
    switch (filter) {
      case 'current':
        return branches.filter((b) => b.isCurrent);
      case 'agent':
        return branches.filter((b) => getAgentForBranch(b.name));
      case 'remote':
        return branches.filter((b) => b.hasRemote);
      default:
        return branches;
    }
  }

  const filteredBranches = getFilteredBranches();

  if (showConflictResolver && mergeResult?.hasConflicts) {
    return (
      <ConflictResolver
        rootPath={rootPath}
        conflictedFiles={mergeResult.conflictedFiles}
        onResolved={() => {
          setShowConflictResolver(false);
          setMergeResult(null);
          if (onRefresh) {
            onRefresh();
          }
        }}
        onAbort={() => {
          setShowConflictResolver(false);
          setMergeResult(null);
          if (onRefresh) {
            onRefresh();
          }
        }}
      />
    );
  }

  return (
    <div className="branch-manager">
      <div className="branch-manager-header">
        <div className="branch-manager-title">
          <svg className="branch-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="6" y1="3" x2="6" y2="15"></line>
            <circle cx="18" cy="6" r="3"></circle>
            <circle cx="6" cy="18" r="3"></circle>
            <path d="M18 9a9 9 0 0 1-9 9"></path>
          </svg>
          <span>Branches</span>
          <span className="branch-count">({filteredBranches.length})</span>
        </div>
        <button
          className="refresh-button"
          onClick={loadBranches}
          disabled={loading}
          title="Refresh branches"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
          </svg>
        </button>
      </div>

      <div className="branch-filters">
        <button
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        <button
          className={`filter-btn ${filter === 'current' ? 'active' : ''}`}
          onClick={() => setFilter('current')}
        >
          Current
        </button>
        <button
          className={`filter-btn ${filter === 'agent' ? 'active' : ''}`}
          onClick={() => setFilter('agent')}
        >
          Agent Branches
        </button>
        <button
          className={`filter-btn ${filter === 'remote' ? 'active' : ''}`}
          onClick={() => setFilter('remote')}
        >
          With Remote
        </button>
      </div>

      <div className="branch-list">
        {loading && branches.length === 0 ? (
          <div className="loading-state">Loading branches...</div>
        ) : filteredBranches.length === 0 ? (
          <div className="empty-state">No branches found</div>
        ) : (
          filteredBranches.map((branch) => {
            const agent = getAgentForBranch(branch.name);
            const isSelected = selectedBranch === branch.name;

            return (
              <div
                key={branch.name}
                className={`branch-item ${isSelected ? 'selected' : ''} ${branch.isCurrent ? 'current' : ''}`}
                onClick={() => setSelectedBranch(branch.name)}
              >
                <div className="branch-item-main">
                  <div className="branch-info">
                    {branch.isCurrent && <span className="branch-indicator current">CURRENT</span>}
                    {branch.hasRemote && <span className="branch-indicator remote">REMOTE</span>}
                    {agent && <span className="branch-indicator agent">AGENT</span>}
                    <span className="branch-name">{branch.name}</span>
                    {branch.upstream && (
                      <span className="branch-upstream">→ {branch.upstream}</span>
                    )}
                  </div>
                  {agent && (
                    <div className="branch-agent">
                      <img
                        src={getAgentAvatar(agent.label, agent.avatar)}
                        alt={agent.label}
                        className="branch-agent-avatar"
                      />
                      <span className="branch-agent-name">{agent.label}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {selectedBranch && selectedBranch !== currentBranch && (
        <div className="branch-actions">
          <div className="actions-label">Selected: {selectedBranch}</div>
          <div className="actions-buttons">
            <button
              className="action-btn switch"
              onClick={() => handleSwitchBranch(selectedBranch)}
              disabled={loading}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
              </svg>
              Switch
            </button>
            <button
              className="action-btn merge"
              onClick={() => setShowMergeModal(true)}
              disabled={loading}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 18a5 5 0 1 1-10 0 5 5 0 0 1 10 0zM7 18a5 5 0 1 1-10 0 5 5 0 0 1 10 0z"/>
                <path d="M17 18h-2m-5 0H8M12 2v14"/>
              </svg>
              Merge
            </button>
            <button
              className="action-btn delete"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={loading || selectedBranch === 'main' || selectedBranch === 'master'}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
              Delete
            </button>
          </div>
        </div>
      )}

      {showMergeModal && (
        <div className="modal-overlay" onClick={() => setShowMergeModal(false)}>
          <div className="modal-content merge-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Merge Branch</h3>
              <button className="modal-close" onClick={() => setShowMergeModal(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <p>
                Merge <strong>{selectedBranch}</strong> into <strong>{currentBranch}</strong>?
              </p>
              <div className="merge-info">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 16v-4M12 8h.01"/>
                </svg>
                <span>This will merge all changes from {selectedBranch} into your current branch.</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="modal-btn cancel" onClick={() => setShowMergeModal(false)}>
                Cancel
              </button>
              <button className="modal-btn confirm" onClick={handleMergeBranch} disabled={loading}>
                {loading ? 'Merging...' : 'Merge Branch'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal-content delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete Branch</h3>
              <button className="modal-close" onClick={() => setShowDeleteConfirm(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to delete <strong>{selectedBranch}</strong>?
              </p>
              <div className="delete-warning">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <path d="M12 9v4M12 17h.01"/>
                </svg>
                <span>This action cannot be undone.</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="modal-btn cancel" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </button>
              <button className="modal-btn delete" onClick={() => handleDeleteBranch(false)} disabled={loading}>
                {loading ? 'Deleting...' : 'Delete Branch'}
              </button>
              <button className="modal-btn force-delete" onClick={() => handleDeleteBranch(true)} disabled={loading}>
                Force Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BranchManager;
