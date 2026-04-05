import FileRow from './FileRow'
import type { FileStatus, DiffState } from '../types'
import './ChangesPanel.css'

export interface PendingTabProps {
  rootPath: string | null
  pendingEntries: [string, FileStatus][]
  stagedFiles: Set<string>
  expandedFiles: Set<string>
  diffCache: Map<string, DiffState>
  onToggleFile: (filePath: string) => void
  onStageFile: (filePath: string) => void
  onDiscardFile: (filePath: string) => void
  onAcceptAll: () => void
  onOpenCommitModal: () => void
  onOpenInEditor?: (filePath: string) => void
}

export default function PendingTab({
  pendingEntries,
  stagedFiles,
  expandedFiles,
  diffCache,
  onToggleFile,
  onStageFile,
  onDiscardFile,
  onAcceptAll,
  onOpenCommitModal,
  onOpenInEditor,
}: PendingTabProps) {
  return (
    <>
      {pendingEntries.length > 0 && (
        <div className="changes-panel-header">
          <span className="changes-panel-summary">
            {pendingEntries.length} file{pendingEntries.length !== 1 ? 's' : ''}
          </span>
          <div className="changes-panel-global-actions">
            <button
              type="button"
              className="changes-btn changes-btn-accept-all"
              onClick={onAcceptAll}
              title="Stage all changes"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </button>
            <button
              type="button"
              className="changes-btn-commit-text"
              onClick={onOpenCommitModal}
              title="Commit session changes"
            >
              Commit
            </button>
          </div>
        </div>
      )}

      {pendingEntries.length === 0 ? (
        <div className="changes-panel-empty">No pending changes</div>
      ) : (
        <div className="changes-panel-list">
          {pendingEntries.map(([filePath, status]) => (
            <FileRow
              key={filePath}
              filePath={filePath}
              status={status}
              isExpanded={expandedFiles.has(filePath)}
              isStaged={stagedFiles.has(filePath)}
              isCommitted={false}
              diff={diffCache.get(filePath)}
              onToggle={() => onToggleFile(filePath)}
              onStage={() => onStageFile(filePath)}
              onDiscard={() => onDiscardFile(filePath)}
              onOpenInEditor={onOpenInEditor}
            />
          ))}
        </div>
      )}
    </>
  )
}
