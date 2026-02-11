import { memo } from "react";
import { formatShortcut } from "../utils/platform";

interface FileActionButtonsProps {
  onRefresh: () => void;
  onFormat: () => void;
  onSave: () => void;
  onOpenIDE: () => void;
  onRevealFinder: () => void;
  onClose?: () => void;
  disabled?: boolean;
  formatting?: boolean;
  hasUnsavedChanges?: boolean;
  isImageFile?: boolean;
  isMarkdownFile?: boolean;
  isEditMode?: boolean;
  onToggleEditMode?: () => void;
}

function FileActionButtons({
  onRefresh,
  onFormat,
  onSave,
  onOpenIDE,
  onRevealFinder,
  onClose,
  disabled = false,
  formatting = false,
  hasUnsavedChanges = false,
  isImageFile = false,
  isMarkdownFile = false,
  isEditMode = false,
  onToggleEditMode,
}: FileActionButtonsProps) {
  if (isImageFile) {
    // Hide action buttons for images
    return null;
  }

  return (
    <div className="file-action-buttons">
      {/* Edit/Preview toggle for Markdown files */}
      {isMarkdownFile && onToggleEditMode && (
        <button
          type="button"
          className={`file-action-btn ${isEditMode ? '' : 'active'}`}
          onClick={onToggleEditMode}
          disabled={disabled}
        >
          {isEditMode ? (
            // Eye icon for Preview mode
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <span className="file-action-tooltip">Preview mode</span>
            </>
          ) : (
            // Pencil icon for Edit mode
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              <span className="file-action-tooltip">Edit mode</span>
            </>
          )}
        </button>
      )}

      {/* Reload */}
      <button
        type="button"
        className="file-action-btn"
        onClick={onRefresh}
        disabled={disabled || formatting}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
        </svg>
        <span className="file-action-tooltip">Reload file</span>
      </button>

      {/* Format - Hide for markdown files */}
      {!isMarkdownFile && (
        <button
          type="button"
          className="file-action-btn"
          onClick={onFormat}
          disabled={disabled || formatting}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
          <span className="file-action-tooltip">Format code</span>
        </button>
      )}

      {/* Save */}
      <button
        type="button"
        className={`file-action-btn ${hasUnsavedChanges ? "active" : ""}`}
        onClick={onSave}
        disabled={disabled || !hasUnsavedChanges}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
          <polyline points="17 21 17 13 7 13 7 21" />
          <polyline points="7 3 7 8 15 8" />
        </svg>
        <span className="file-action-tooltip">{hasUnsavedChanges ? `Save changes (${formatShortcut("⌘S")})` : "No changes"}</span>
      </button>

      {/* Open with IDE */}
      <button
        type="button"
        className="file-action-btn"
        onClick={onOpenIDE}
        disabled={disabled}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
        <span className="file-action-tooltip">Open with IDE</span>
      </button>

      {/* Reveal in Finder */}
      <button
        type="button"
        className="file-action-btn"
        onClick={onRevealFinder}
        disabled={disabled}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
        <span className="file-action-tooltip">Reveal in Finder</span>
      </button>

      {/* Close file tab */}
      {onClose && (
        <button
          type="button"
          className="file-action-btn close-btn"
          onClick={onClose}
          disabled={disabled}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
          <span className="file-action-tooltip">{`Close file (${formatShortcut("⌘W")})`}</span>
        </button>
      )}
    </div>
  );
}

export default memo(FileActionButtons);
