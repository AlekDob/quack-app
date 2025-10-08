import { memo } from 'react'

interface NewTerminalModalProps {
  open: boolean
  isEditing?: boolean
  name: string
  path: string
  color: string
  availableColors: string[]
  selectingDirectory: boolean
  creating: boolean
  error: string | null
  onNameChange: (value: string) => void
  onColorChange: (color: string) => void
  onBrowse: () => void
  onCancel: () => void
  onConfirm: () => void
}

function NewTerminalModal({
  open,
  isEditing = false,
  name,
  path,
  color,
  availableColors,
  selectingDirectory,
  creating,
  error,
  onNameChange,
  onColorChange,
  onBrowse,
  onCancel,
  onConfirm,
}: NewTerminalModalProps) {
  if (!open) {
    return null
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-panel">
        <h2>{isEditing ? '✏️ Edit terminal' : 'Create new terminal'}</h2>

        <label className="modal-field">
          <span>Terminal name</span>
          <input
            type="text"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="e.g. API Server"
            autoFocus
          />
        </label>

        <div className="modal-field">
          <span>Working directory</span>
          <div className="modal-selected-path">{path || 'No directory selected'}</div>
          <button
            type="button"
            className="directory-chooser"
            onClick={onBrowse}
            disabled={selectingDirectory}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>
            {selectingDirectory ? 'Opening Finder…' : 'Choose directory'}
          </button>
        </div>

        <div className="modal-field">
          <span>Terminal color</span>
          <div className="modal-color-grid">
            {availableColors.map((preset) => (
              <button
                key={preset}
                type="button"
                className={`modal-color-swatch ${preset === color ? 'selected' : ''}`}
                style={{ backgroundColor: preset }}
                onClick={() => onColorChange(preset)}
              />
            ))}
            <label className="modal-color-picker">
              <input
                type="color"
                value={color}
                onChange={(event) => onColorChange(event.target.value)}
                aria-label="Choose a custom color"
              />
            </label>
          </div>
        </div>

        {error && <p className="modal-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="primary"
            onClick={onConfirm}
            disabled={!name.trim() || !path.trim() || creating}
          >
            {creating ? (isEditing ? 'Saving…' : 'Creating…') : (isEditing ? 'Save changes' : 'Create terminal')}
          </button>
        </div>
      </div>
    </div>
  )
}

// Performance: Memo basato solo su open prop
export default memo(NewTerminalModal, (prev, next) => prev.open === next.open && !next.open)
