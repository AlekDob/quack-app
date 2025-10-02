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

export default function NewTerminalModal({
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
        <h2>{isEditing ? '✏️ Modifica terminale' : 'Crea nuovo terminale'}</h2>

        <label className="modal-field">
          <span>Nome terminale</span>
          <input
            type="text"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="Es. API Server"
            autoFocus
          />
        </label>

        <div className="modal-field">
          <span>Cartella di lavoro</span>
          <div className="modal-selected-path">{path || 'Nessuna cartella selezionata'}</div>
          <button
            type="button"
            className="secondary"
            onClick={onBrowse}
            disabled={selectingDirectory}
          >
            {selectingDirectory ? 'Apertura Finder…' : 'Scegli cartella'}
          </button>
        </div>

        <div className="modal-field">
          <span>Colore del terminale</span>
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
                aria-label="Scegli un colore personalizzato"
              />
            </label>
          </div>
        </div>

        {error && <p className="modal-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onCancel}>
            Annulla
          </button>
          <button
            type="button"
            className="primary"
            onClick={onConfirm}
            disabled={!name.trim() || !path.trim() || creating}
          >
            {creating ? (isEditing ? 'Salvataggio…' : 'Creazione…') : (isEditing ? 'Salva modifiche' : 'Crea terminale')}
          </button>
        </div>
      </div>
    </div>
  )
}
