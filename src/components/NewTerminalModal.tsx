// Available duck avatars from /images/ducks/avatars/
const AVAILABLE_AVATARS = [
  '24d6c816fe40a284f2451b1469c5e6d63d236e53.png',
  '5a1b030fb3b46f153f9b4f786a56570d828d2d2f.png',
  '5c275f841f212073cbddbe734d1979a6c2f17ab8.png',
  '5ef21f43a917b3bbe86dad58669fdad1c9f3e7c1.png',
  '68b54025bcf1dfbc9e03e20882688ddcadd28c27.jpeg',
  '94ab4eb6a469bf7f9de538e5c2f3dc3f2637fddf.jpeg',
  '99d6b811344a0bd98d18246ca8208314e8b490f3.png',
  '9e56d5e5edfcef59ce2aba2b96130dad44ce1135.png',
  'ab7cadc881ab08dcc27d8a8a1f3cb3e8af002216.png',
  'bafc4d0ca4264fb26f014f27c641d860ff356f7a.png',
  'c036fd117629d44e78464dd12d95760f0f0b3d9b.png',
  'd305287d5c861601e285b34ec5a8c7835ae9f8ea.png',
  'de8b5bfa62130bde399a6cb5255323ac949756ec.png',
  'e34736e96c3537509d80e78454d6e88ebe18cc2a.png',
  'e98b4d01e977b8572b85c44cad2e32bbfde68902.jpeg',
  'fa574b2f56d31adfc5900e4bfd116f9cddff17a0.png',
]

// Helper function to get avatar image URL (works in both dev and production)
function getAvatarUrl(avatarName: string): string {
  // Check if we're in Tauri context
  if (window.__TAURI__) {
    // In Tauri v2, use asset:// protocol for bundled resources
    return `asset://localhost/images/ducks/avatars/${avatarName}`;
  }
  // In dev mode, use standard public path
  return `/images/ducks/avatars/${avatarName}`;
}

interface NewTerminalModalProps {
  open: boolean
  isEditing?: boolean
  name: string
  path: string
  color: string
  workingOn?: string
  avatar?: string
  availableColors: string[]
  selectingDirectory: boolean
  creating: boolean
  error: string | null
  onNameChange: (value: string) => void
  onColorChange: (color: string) => void
  onWorkingOnChange?: (value: string) => void
  onAvatarChange?: (avatar: string) => void
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
  workingOn = '',
  avatar,
  availableColors,
  selectingDirectory,
  creating,
  error,
  onNameChange,
  onColorChange,
  onWorkingOnChange,
  onAvatarChange,
  onBrowse,
  onCancel,
  onConfirm,
}: NewTerminalModalProps) {
  if (!open) {
    return null
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-panel agent-modal">
        <div className="modal-header">
          <h2>{isEditing ? '✏️ Edit agent' : '✨ Create new agent'}</h2>
          <p className="modal-subtitle">Configure your agent settings</p>
        </div>

        <label className="modal-field">
          <span className="field-label">Agent name</span>
          <input
            type="text"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="e.g. API Server"
            autoFocus
          />
        </label>

        <div className="modal-field">
          <span className="field-label">Avatar</span>
          <span className="field-hint">Scroll for more avatars →</span>
          <div className="avatar-grid-container">
            <div className="avatar-grid">
              {AVAILABLE_AVATARS.map((avatarName) => (
              <button
                key={avatarName}
                type="button"
                className={`avatar-option ${avatar === avatarName ? 'selected' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('Avatar clicked:', avatarName);
                  onAvatarChange?.(avatarName);
                }}
                aria-label={`Select ${avatarName} avatar`}
              >
                <img
                  src={getAvatarUrl(avatarName)}
                  alt={avatarName}
                  className="avatar-image"
                  onError={(e) => {
                    // If image fails to load, show a placeholder
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    console.error(`Failed to load avatar: ${avatarName}`);
                  }}
                />
              </button>
            ))}
            </div>
          </div>
        </div>

        <label className="modal-field">
          <span className="field-label">What are you working on?</span>
          <input
            type="text"
            value={workingOn}
            onChange={(event) => onWorkingOnChange?.(event.target.value)}
            placeholder="e.g., 'AI implementation' or 'UI section X improvement'"
            maxLength={50}
          />
          <small className="field-hint">
            Brief context about what this agent is working on (max 5 words, optional)
          </small>
        </label>

        <div className="modal-field">
          <span className="field-label">Working directory</span>
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
          <span className="field-label">Agent color</span>
          <div className="modal-color-grid">
            {availableColors.map((preset) => (
              <button
                key={preset}
                type="button"
                className={`modal-color-swatch ${preset === color ? 'selected' : ''}`}
                style={{ backgroundColor: preset }}
                onClick={() => onColorChange(preset)}
                aria-label={`Select color ${preset}`}
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

        {error && (
          <div className="modal-error">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>{error}</span>
          </div>
        )}

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
            {creating ? (
              <>
                <span className="spinner"></span>
                {isEditing ? 'Saving…' : 'Creating…'}
              </>
            ) : (
              isEditing ? 'Save changes' : 'Create agent'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// Performance: Memo disabled to allow real-time updates when selecting avatar/color
export default NewTerminalModal
