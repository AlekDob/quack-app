import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { GitConflictFile } from '../types';

interface ConflictResolverProps {
  rootPath: string | null;
  conflictedFiles?: string[];
  onResolved: () => void;
  onAbort: () => void;
}

type ResolutionStrategy = 'ours' | 'theirs' | 'manual';

const ConflictResolver: React.FC<ConflictResolverProps> = ({
  rootPath,
  conflictedFiles: _conflictedFiles,
  onResolved,
  onAbort,
}) => {
  const [conflicts, setConflicts] = useState<GitConflictFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [resolving, setResolving] = useState(false);
  const [abortingMerge, setAbortingMerge] = useState(false);

  useEffect(() => {
    loadConflictDetails();
  }, []);

  async function loadConflictDetails() {
    if (!rootPath) return;
    try {
      const result = await invoke<GitConflictFile[]>('git_get_conflicts', { rootPath });
      setConflicts(result);
      // Select all files by default
      setSelectedFiles(new Set(result.map((c) => c.path)));
    } catch (err) {
      console.error('Failed to load conflict details:', err);
    }
  }

  async function handleResolveConflict(strategy: ResolutionStrategy) {
    if (!rootPath || strategy === 'manual') return;
    setResolving(true);
    try {
      // Resolve all selected files with the chosen strategy
      for (const filePath of selectedFiles) {
        await invoke('git_resolve_conflict', {
          filePath,
          strategy,
          rootPath,
        });
      }
      onResolved();
    } catch (err) {
      console.error('Failed to resolve conflicts:', err);
      alert(`Failed to resolve conflicts: ${err}`);
    } finally {
      setResolving(false);
    }
  }

  async function handleAbortMerge() {
    if (!rootPath) return;
    setAbortingMerge(true);
    try {
      await invoke('git_abort_merge', { rootPath });
      onAbort();
    } catch (err) {
      console.error('Failed to abort merge:', err);
      alert(`Failed to abort merge: ${err}`);
    } finally {
      setAbortingMerge(false);
    }
  }

  function toggleFileSelection(filePath: string) {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(filePath)) {
        next.delete(filePath);
      } else {
        next.add(filePath);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedFiles.size === conflicts.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(conflicts.map((c) => c.path)));
    }
  }

  return (
    <div className="conflict-resolver">
      <div className="conflict-header">
        <div className="conflict-title">
          <svg className="conflict-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <path d="M12 9v4M12 17h.01"/>
          </svg>
          <span>Merge Conflicts</span>
        </div>
        <button className="close-btn" onClick={onAbort} title="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div className="conflict-summary">
        <p>The merge has conflicts in {conflicts.length} file(s). Choose how to resolve them:</p>
      </div>

      <div className="conflict-files">
        <div className="files-header">
          <label className="select-all">
            <input
              type="checkbox"
              checked={selectedFiles.size === conflicts.length}
              onChange={toggleSelectAll}
            />
            <span>Select All ({selectedFiles.size}/{conflicts.length})</span>
          </label>
        </div>
        <div className="files-list">
          {conflicts.map((conflict) => (
            <label key={conflict.path} className="conflict-file-item">
              <input
                type="checkbox"
                checked={selectedFiles.has(conflict.path)}
                onChange={() => toggleFileSelection(conflict.path)}
              />
              <div className="file-info">
                <span className="file-path">{conflict.path}</span>
                <span className="file-status">{conflict.status}</span>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="resolution-actions">
        <div className="actions-title">Conflict Resolution</div>
        <div className="actions-grid">
          <button
            className="resolution-btn accept-ours"
            onClick={() => handleResolveConflict('ours')}
            disabled={resolving || selectedFiles.size === 0}
            title="Keep changes from current branch"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <path d="M22 4L12 14.01l-3-3"/>
            </svg>
            <div className="btn-content">
              <span className="btn-label">Accept Ours</span>
              <span className="btn-hint">Keep current branch changes</span>
            </div>
          </button>
          <button
            className="resolution-btn accept-theirs"
            onClick={() => handleResolveConflict('theirs')}
            disabled={resolving || selectedFiles.size === 0}
            title="Accept changes from incoming branch"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <path d="M22 4L12 14.01l-3-3"/>
            </svg>
            <div className="btn-content">
              <span className="btn-label">Accept Theirs</span>
              <span className="btn-hint">Accept incoming changes</span>
            </div>
          </button>
        </div>

        <div className="secondary-actions">
          <button
            className="secondary-btn abort"
            onClick={handleAbortMerge}
            disabled={abortingMerge || resolving}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M15 9l-6 6M9 9l6 6"/>
            </svg>
            {abortingMerge ? 'Aborting...' : 'Abort Merge'}
          </button>
        </div>
      </div>

      <div className="conflict-help">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 16v-4M12 8h.01"/>
        </svg>
        <div className="help-content">
          <p><strong>Accept Ours:</strong> Keep changes from your current branch</p>
          <p><strong>Accept Theirs:</strong> Accept changes from the branch being merged</p>
          <p><strong>Abort Merge:</strong> Cancel the merge and return to previous state</p>
        </div>
      </div>
    </div>
  );
};

export default ConflictResolver;
