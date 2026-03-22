import './ChangesPanel.css'

interface CommitModalProps {
  fileCount: number
  commitTitle: string
  commitDesc: string
  committing: boolean
  onTitleChange: (value: string) => void
  onDescChange: (value: string) => void
  onCommit: () => void
  onClose: () => void
}

export default function CommitModal({
  fileCount,
  commitTitle,
  commitDesc,
  committing,
  onTitleChange,
  onDescChange,
  onCommit,
  onClose,
}: CommitModalProps) {
  return (
    <>
      <div className="changes-modal-backdrop" onClick={onClose} />
      <div className="changes-commit-modal">
        <div className="changes-commit-modal-header">
          <span>Commit Changes</span>
          <button
            type="button"
            className="changes-modal-close"
            onClick={onClose}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="changes-commit-modal-body">
          <input
            type="text"
            className="changes-commit-input"
            placeholder="Commit title..."
            value={commitTitle}
            onChange={(e) => onTitleChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                onCommit()
              }
            }}
            disabled={committing}
            autoFocus
          />
          <textarea
            className="changes-commit-textarea"
            placeholder="Description (optional)..."
            value={commitDesc}
            onChange={(e) => onDescChange(e.target.value)}
            disabled={committing}
            rows={3}
          />
        </div>
        <div className="changes-commit-modal-footer">
          <span className="changes-commit-file-count">
            {fileCount} file{fileCount !== 1 ? 's' : ''}
          </span>
          <button
            type="button"
            className="changes-commit-btn"
            onClick={onCommit}
            disabled={committing || !commitTitle.trim()}
          >
            {committing ? 'Committing...' : 'Commit'}
          </button>
        </div>
      </div>
    </>
  )
}
