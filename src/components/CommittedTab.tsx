import FileRow from './FileRow'
import type { FileStatus, DiffState } from '../types'
import './ChangesPanel.css'

export interface CommittedTabProps {
  rootPath: string | null
  committedEntries: [string, FileStatus][]
  expandedFiles: Set<string>
  diffCache: Map<string, DiffState>
  onClearCommitted: () => void
  onToggleFile: (filePath: string) => void
  onOpenInEditor?: (filePath: string) => void
}

export default function CommittedTab({
  committedEntries,
  expandedFiles,
  diffCache,
  onClearCommitted,
  onToggleFile,
  onOpenInEditor,
}: CommittedTabProps) {
  return (
    <>
      {committedEntries.length > 0 && (
        <div className="changes-panel-header">
          <span className="changes-panel-summary">
            {committedEntries.length} file{committedEntries.length !== 1 ? 's' : ''}
          </span>
          <div className="changes-panel-global-actions">
            <button
              type="button"
              className="changes-btn changes-btn-clear-all"
              onClick={onClearCommitted}
              title="Clear all committed"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {committedEntries.length === 0 ? (
        <div className="changes-panel-empty">No committed files yet</div>
      ) : (
        <div className="changes-panel-list">
          {committedEntries.map(([filePath, status]) => (
            <FileRow
              key={filePath}
              filePath={filePath}
              status={status}
              isExpanded={expandedFiles.has(filePath)}
              isStaged={false}
              isCommitted={true}
              diff={diffCache.get(filePath)}
              onToggle={() => onToggleFile(filePath)}
              onOpenInEditor={onOpenInEditor}
            />
          ))}
        </div>
      )}
    </>
  )
}
