import InlineDiffView from './InlineDiffView'
import OpenInIDEButton from './OpenInIDEButton'
import type { FileStatus, DiffState } from '../types'
import './ChangesPanel.css'

export interface FileRowProps {
  filePath: string
  status: FileStatus
  isExpanded: boolean
  isStaged: boolean
  isCommitted: boolean
  diff: DiffState | undefined
  onToggle: () => void
  onStage?: () => void
  onUnstage?: () => void
  onDiscard?: () => void
  onOpenInEditor?: (filePath: string) => void
}

const shortenPath = (fullPath: string): string => {
  const parts = fullPath.split('/').filter(Boolean)
  if (parts.length <= 2) return fullPath
  return '.../' + parts.slice(-2).join('/')
}

const getStatusLabel = (s: FileStatus): string => {
  if (s === 'created') return 'N'
  if (s === 'modified') return 'M'
  return 'D'
}

const isMarkdown = (filePath: string): boolean => filePath.endsWith('.md')

const getStatusClass = (s: FileStatus, filePath: string): string => {
  if (isMarkdown(filePath)) return 'changes-status-markdown'
  if (s === 'created') return 'changes-status-new'
  if (s === 'modified') return 'changes-status-modified'
  return 'changes-status-deleted'
}

export default function FileRow({
  filePath,
  status,
  isExpanded,
  isStaged,
  isCommitted,
  diff,
  onToggle,
  onStage,
  onUnstage,
  onDiscard,
  onOpenInEditor,
}: FileRowProps) {
  const fileName = filePath.split('/').pop() || filePath
  const dirPath = shortenPath(filePath.substring(0, filePath.lastIndexOf('/')))

  return (
    <div className={`changes-file-item ${isStaged ? 'staged' : ''}`}>
      <div className="changes-file-row" onClick={onToggle}>
        <svg
          className={`changes-file-chevron ${isExpanded ? 'expanded' : ''}`}
          width="10" height="10" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
        <span className={`changes-file-status ${getStatusClass(status, filePath)}`}>
          {getStatusLabel(status)}
        </span>
        <span
          className={`changes-file-name ${isMarkdown(filePath) ? 'changes-file-name-markdown' : ''}`}
          title={filePath}
        >
          {fileName}
        </span>
        {isCommitted && <span className="changes-committed-badge">committed</span>}
        {isStaged && !isCommitted && <span className="changes-staged-badge">staged</span>}
        <span className="changes-file-dir" title={filePath}>
          {dirPath}
        </span>
        <div className="changes-file-actions" onClick={(e) => e.stopPropagation()}>
          {onOpenInEditor && (
            <button
              type="button"
              className="changes-btn changes-btn-editor"
              onClick={() => onOpenInEditor(filePath)}
              title="Open in editor"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
            </button>
          )}
          <OpenInIDEButton path={filePath} iconOnly className="changes-btn changes-btn-ide" />
          {!isCommitted && (
            <>
              {onDiscard && (
                <button
                  type="button"
                  className="changes-btn changes-btn-reject"
                  onClick={onDiscard}
                  title="Reject change"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
              {onStage && (
                <button
                  type="button"
                  className="changes-btn changes-btn-accept"
                  onClick={onStage}
                  title="Stage change"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </button>
              )}
              {onUnstage && (
                <button
                  type="button"
                  className="changes-btn changes-btn-unstage"
                  onClick={onUnstage}
                  title="Unstage change"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14" />
                  </svg>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {isExpanded && diff && (
        <div className="changes-file-diff">
          <InlineDiffView
            diffContent={diff.content}
            loading={diff.loading}
            error={diff.error}
            compact
          />
        </div>
      )}
    </div>
  )
}
