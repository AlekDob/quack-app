import { useState } from 'react'
import type { GitStatusEntry } from '../types'
import './GitFilesColumn.css'

interface GitFilesColumnProps {
  unstaged: GitStatusEntry[]
  staged: GitStatusEntry[]
  selected: GitStatusEntry | null
  onSelect: (entry: GitStatusEntry) => void
  onOpenFile: (path: string) => void
}

const statusBadgeClass = (kind: 'staged' | 'working') =>
  kind === 'staged' ? 'git-status-badge staged' : 'git-status-badge working'

function GitFilesColumn({
  unstaged,
  staged,
  selected,
  onSelect,
  onOpenFile,
}: GitFilesColumnProps) {
  const [unstagedExpanded, setUnstagedExpanded] = useState(true)
  const [stagedExpanded, setStagedExpanded] = useState(true)

  return (
    <div className="git-files-column">
      {/* Unstaged Section */}
      <div className="git-files-section">
        <button
          type="button"
          className="git-files-section-header"
          onClick={() => setUnstagedExpanded(!unstagedExpanded)}
        >
          <span
            className="git-files-chevron"
            style={{
              transform: unstagedExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
            }}
          >
            ›
          </span>
          <span className="git-files-section-title">
            Unstaged ({unstaged.length})
          </span>
        </button>
        {unstagedExpanded && (
          <div className="git-files-list">
            {unstaged.length === 0 ? (
              <div className="git-files-empty">No unstaged changes</div>
            ) : (
              unstaged.map((entry) => {
                const isSelected = selected?.path === entry.path
                return (
                  <div
                    key={entry.path}
                    className={`git-file-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => onSelect(entry)}
                    onDoubleClick={() => onOpenFile(entry.path)}
                  >
                    <span className="git-file-name">
                      {entry.path.split('/').pop()}
                    </span>
                    <div className="git-file-badges">
                      {entry.unstaged_status && (
                        <span className={statusBadgeClass('working')}>
                          {entry.unstaged_status}
                        </span>
                      )}
                      {entry.is_untracked && (
                        <span className={statusBadgeClass('working')}>U</span>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>

      {/* Staged Section */}
      <div className="git-files-section">
        <button
          type="button"
          className="git-files-section-header"
          onClick={() => setStagedExpanded(!stagedExpanded)}
        >
          <span
            className="git-files-chevron"
            style={{
              transform: stagedExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
            }}
          >
            ›
          </span>
          <span className="git-files-section-title">
            Staged ({staged.length})
          </span>
        </button>
        {stagedExpanded && (
          <div className="git-files-list">
            {staged.length === 0 ? (
              <div className="git-files-empty">No staged changes</div>
            ) : (
              staged.map((entry) => {
                const isSelected = selected?.path === entry.path
                return (
                  <div
                    key={entry.path}
                    className={`git-file-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => onSelect(entry)}
                    onDoubleClick={() => onOpenFile(entry.path)}
                  >
                    <span className="git-file-name">
                      {entry.path.split('/').pop()}
                    </span>
                    <div className="git-file-badges">
                      {entry.staged_status && (
                        <span className={statusBadgeClass('staged')}>
                          {entry.staged_status}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default GitFilesColumn
