import type { GitStatusEntry } from '../types'
import './DiffDrawer.css'

type DiffView = 'worktree' | 'staged'

interface DiffDrawerProps {
  selected: GitStatusEntry | null
  diffContent: string
  diffLoading: boolean
  diffError: string | null
  diffView: DiffView
  onDiffViewChange: (view: DiffView) => void
  onStage: (entry: GitStatusEntry) => void
  onUnstage: (entry: GitStatusEntry) => void
  onClose: () => void
}

function DiffDrawer({
  selected,
  diffContent,
  diffLoading,
  diffError,
  diffView,
  onDiffViewChange,
  onStage,
  onUnstage,
  onClose,
}: DiffDrawerProps) {
  if (!selected) return null

  // Extract actual file path from diff content if available (more reliable than selected.path)
  const getFilePathFromDiff = () => {
    if (!diffContent) return selected.path;

    // Look for "diff --git a/path b/path" or "+++ b/path"
    const diffMatch = diffContent.match(/\+\+\+ b\/(.+?)(?:\n|$)/);
    if (diffMatch && diffMatch[1]) {
      return diffMatch[1];
    }

    return selected.path;
  };

  const displayPath = getFilePathFromDiff();

  return (
    <>
      {/* Backdrop */}
      <div className="diff-drawer-backdrop" onClick={onClose} />

      {/* Drawer */}
      <div className="diff-drawer">
        {/* Header */}
        <div className="diff-drawer-header">
          <div className="diff-drawer-header-left">
            <span className="diff-drawer-filename">{displayPath}</span>
            {selected.original_path && (
              <span className="diff-drawer-rename">from {selected.original_path}</span>
            )}
          </div>
          <button
            type="button"
            className="diff-drawer-close"
            onClick={onClose}
            title="Close diff viewer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Toolbar */}
        <div className="diff-drawer-toolbar">
          {selected.staged_status && selected.unstaged_status && (
            <div className="diff-drawer-toggle">
              <button
                type="button"
                className={diffView === 'worktree' ? 'active' : ''}
                onClick={() => onDiffViewChange('worktree')}
              >
                Working tree
              </button>
              <button
                type="button"
                className={diffView === 'staged' ? 'active' : ''}
                onClick={() => onDiffViewChange('staged')}
              >
                Staging
              </button>
            </div>
          )}
          <div className="diff-drawer-actions">
            {(selected.unstaged_status || selected.is_untracked) && (
              <button type="button" onClick={() => onStage(selected)}>
                Stage
              </button>
            )}
            {selected.staged_status && (
              <button type="button" onClick={() => onUnstage(selected)}>
                Unstage
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="diff-drawer-content">
          {diffLoading ? (
            <div className="diff-drawer-empty">Computing diff…</div>
          ) : diffError ? (
            <div className="diff-drawer-error">{diffError}</div>
          ) : (
            <div className="diff-drawer-diff">
              {(() => {
                // Parse diff to extract real line numbers
                // Safety check for undefined/null diffContent
                if (!diffContent) {
                  return <div className="diff-drawer-empty">No diff available</div>;
                }
                const lines = diffContent.split('\n');
                let oldLineNum = 0;
                let newLineNum = 0;

                return lines.map((line, index) => {
                  const isAddition = line.startsWith('+') && !line.startsWith('+++')
                  const isDeletion = line.startsWith('-') && !line.startsWith('---')
                  const isHunkHeader = line.startsWith('@@')
                  const isMeta =
                    isHunkHeader ||
                    line.startsWith('diff ') ||
                    line.startsWith('index ') ||
                    line.startsWith('---') ||
                    line.startsWith('+++')

                  // Parse hunk header to get starting line numbers
                  // Format: @@ -oldStart,oldCount +newStart,newCount @@
                  if (isHunkHeader) {
                    const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
                    if (match) {
                      oldLineNum = parseInt(match[1], 10)
                      newLineNum = parseInt(match[2], 10)
                    }
                  }

                  // Calculate line numbers for this line
                  let displayOldLine: string | number = ''
                  let displayNewLine: string | number = ''

                  if (!isMeta) {
                    if (isAddition) {
                      // Addition: only new file line number
                      displayNewLine = newLineNum
                      newLineNum++
                    } else if (isDeletion) {
                      // Deletion: only old file line number
                      displayOldLine = oldLineNum
                      oldLineNum++
                    } else {
                      // Context: both line numbers
                      displayOldLine = oldLineNum
                      displayNewLine = newLineNum
                      oldLineNum++
                      newLineNum++
                    }
                  }

                  const content = isAddition || isDeletion ? line.slice(1) : line
                  const displayText = content.length > 0 ? content : '\u00a0'

                  let background = 'transparent'
                  let borderLeft = '3px solid transparent'
                  let textColor = '#e5ecff'
                  let fontWeight: number | undefined

                  if (isAddition) {
                    background = 'rgba(34, 197, 94, 0.18)'
                    borderLeft = '3px solid rgba(34, 197, 94, 0.55)'
                    textColor = '#bbf7d0'
                  } else if (isDeletion) {
                    background = 'rgba(239, 68, 68, 0.22)'
                    borderLeft = '3px solid rgba(239, 68, 68, 0.55)'
                    textColor = '#fecaca'
                  } else if (isMeta) {
                    background = 'rgba(59, 130, 246, 0.15)'
                    borderLeft = '3px solid rgba(59, 130, 246, 0.6)'
                    textColor = '#cbd5f5'
                    fontWeight = 600
                  }

                  return (
                    <div
                      key={`${index}-${line}`}
                      className="diff-line"
                      style={{
                        background,
                        borderLeft,
                        color: textColor,
                        fontWeight,
                      }}
                    >
                      <span className="diff-line-number diff-line-old">{displayOldLine}</span>
                      <span className="diff-line-number diff-line-new">{displayNewLine}</span>
                      <span className="diff-line-content">{displayText}</span>
                    </div>
                  )
                })
              })()}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default DiffDrawer
