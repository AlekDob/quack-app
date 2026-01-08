import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { SyncConflict } from '../../types/brainSync';
import './SyncConflictDialog.css';

interface SyncConflictDialogProps {
  conflicts: SyncConflict[];
  onResolve: (entityId: string, resolution: 'brain' | 'obsidian') => void;
  onResolveAll: (resolution: 'brain' | 'obsidian') => void;
  onClose: () => void;
}

export default function SyncConflictDialog({
  conflicts,
  onResolve,
  onResolveAll,
  onClose,
}: SyncConflictDialogProps) {
  const [resolving, setResolving] = useState<Set<string>>(new Set());
  const [resolvingAll, setResolvingAll] = useState(false);
  const [localConflicts, setLocalConflicts] = useState(conflicts);

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;

    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleResolve = async (entityId: string, resolution: 'brain' | 'obsidian') => {
    setResolving((prev) => new Set(prev).add(entityId));

    try {
      await invoke('brain_resolve_conflict', { entityId, resolution });
      onResolve(entityId, resolution);

      // Remove resolved conflict from local state
      setLocalConflicts((prev) => prev.filter((c) => c.entityId !== entityId));
    } catch (err) {
      console.error('Failed to resolve conflict:', err);
    } finally {
      setResolving((prev) => {
        const next = new Set(prev);
        next.delete(entityId);
        return next;
      });
    }
  };

  const handleResolveAll = async (resolution: 'brain' | 'obsidian') => {
    setResolvingAll(true);

    try {
      // Resolve all conflicts sequentially
      for (const conflict of localConflicts) {
        await invoke('brain_resolve_conflict', {
          entityId: conflict.entityId,
          resolution,
        });
      }

      onResolveAll(resolution);
      setLocalConflicts([]);
    } catch (err) {
      console.error('Failed to resolve all conflicts:', err);
    } finally {
      setResolvingAll(false);
    }
  };

  // Auto-close when all conflicts are resolved
  if (localConflicts.length === 0) {
    setTimeout(onClose, 300);
    return null;
  }

  return (
    <div className="sync-conflict-overlay" onClick={onClose}>
      <div className="sync-conflict-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sync-conflict-header">
          <h2>Resolve Sync Conflicts</h2>
          <span className="sync-conflict-count">
            {localConflicts.length} conflict{localConflicts.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Conflict List */}
        <div className="sync-conflict-list">
          {localConflicts.map((conflict) => {
            const isResolving = resolving.has(conflict.entityId);

            return (
              <div key={conflict.entityId} className="sync-conflict-item">
                <div className="sync-conflict-item-header">
                  <h3>{conflict.entityName}</h3>
                </div>

                <div className="sync-conflict-timestamps">
                  <div className="sync-conflict-timestamp">
                    <span className="timestamp-label">Brain:</span>
                    <span className="timestamp-value">
                      {formatTimestamp(conflict.brainUpdatedAt)}
                    </span>
                  </div>
                  <div className="sync-conflict-timestamp">
                    <span className="timestamp-label">Vault:</span>
                    <span className="timestamp-value">
                      {formatTimestamp(conflict.vaultUpdatedAt)}
                    </span>
                  </div>
                </div>

                <div className="sync-conflict-actions">
                  <button
                    className="ios-button ios-button-primary"
                    onClick={() => handleResolve(conflict.entityId, 'brain')}
                    disabled={isResolving || resolvingAll}
                  >
                    {isResolving ? 'Resolving...' : 'Keep Brain'}
                  </button>
                  <button
                    className="ios-button ios-button-secondary"
                    onClick={() => handleResolve(conflict.entityId, 'obsidian')}
                    disabled={isResolving || resolvingAll}
                  >
                    {isResolving ? 'Resolving...' : 'Keep Obsidian'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="sync-conflict-footer">
          <div className="sync-conflict-bulk-actions">
            <button
              className="ios-button ios-button-primary"
              onClick={() => handleResolveAll('brain')}
              disabled={resolvingAll}
            >
              {resolvingAll ? 'Resolving All...' : 'Resolve All: Keep Brain'}
            </button>
            <button
              className="ios-button ios-button-secondary"
              onClick={() => handleResolveAll('obsidian')}
              disabled={resolvingAll}
            >
              {resolvingAll ? 'Resolving All...' : 'Resolve All: Keep Obsidian'}
            </button>
          </div>
          <button
            className="ios-button ios-button-tertiary"
            onClick={onClose}
            disabled={resolvingAll}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
