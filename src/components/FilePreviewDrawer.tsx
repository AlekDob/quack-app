import { useState, useCallback, useEffect } from "react";
import CodeEditor, { type DiffInfo } from "./CodeEditor";

interface FilePreviewDrawerProps {
  open: boolean;
  filename: string | null;
  path: string | null;
  content: string;
  loading: boolean;
  error: string | null;
  formatting: boolean;
  diffInfo?: DiffInfo | null;
  onClose: () => void;
  onRefresh: () => void;
  onFormat: () => void;
  onSave?: (content: string) => void;
}

export default function FilePreviewDrawer({
  open,
  filename,
  path,
  content,
  loading,
  error,
  formatting,
  diffInfo,
  onClose,
  onRefresh,
  onFormat,
  onSave,
}: FilePreviewDrawerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const handleToggleEdit = useCallback(() => {
    if (isEditing && hasUnsavedChanges) {
      const confirmDiscard = window.confirm(
        "Hai modifiche non salvate. Vuoi scartarle?"
      );
      if (!confirmDiscard) return;
    }
    setIsEditing(!isEditing);
    setEditedContent(content);
    setHasUnsavedChanges(false);
  }, [isEditing, hasUnsavedChanges, content]);

  const handleContentChange = useCallback(
    (newContent: string) => {
      setEditedContent(newContent);
      setHasUnsavedChanges(newContent !== content);
    },
    [content]
  );

  const handleSave = useCallback(
    (contentToSave?: string) => {
      const finalContent = contentToSave || editedContent;
      if (onSave) {
        onSave(finalContent);
        setHasUnsavedChanges(false);
      }
    },
    [editedContent, onSave]
  );

  // Reset content when file changes
  useEffect(() => {
    setEditedContent(content);
    setHasUnsavedChanges(false);
    setIsEditing(false);
  }, [path, content]);
  if (!open) {
    return null;
  }

  return (
    <div className="preview-drawer" role="dialog" aria-modal="true">
      <div
        className="preview-drawer-backdrop"
        onClick={onClose}
        role="presentation"
      />
      <div className="preview-drawer-panel">
        <header className="preview-toolbar">
          <div className="preview-meta">
            <span className="preview-filename">{filename ?? "File"}</span>
            {path && <span className="preview-path">{path}</span>}
            {loading && <span className="preview-status">Caricamento…</span>}
            {error && !loading && (
              <span className="preview-error">{error}</span>
            )}
          </div>
          <div className="preview-actions">
            <button
              type="button"
              className="preview-action"
              onClick={onRefresh}
              disabled={loading || formatting}
            >
              Ricarica
            </button>
            <button
              type="button"
              className="preview-action"
              onClick={onFormat}
              disabled={loading || formatting || isEditing}
            >
              {formatting ? "Formatto…" : "Formatta"}
            </button>
            <button
              type="button"
              className={`preview-action ${isEditing ? "active" : ""}`}
              onClick={handleToggleEdit}
              disabled={loading}
            >
              {isEditing ? "Anteprima" : "Modifica"}
            </button>
            {isEditing && onSave && (
              <button
                type="button"
                className="preview-action save"
                onClick={() => handleSave()}
                disabled={!hasUnsavedChanges}
              >
                {hasUnsavedChanges ? "Salva *" : "Salvato"}
              </button>
            )}
            <button type="button" className="preview-close" onClick={onClose}>
              Chiudi
            </button>
          </div>
        </header>
        <div className="preview-content" data-loading={loading}>
          {loading ? (
            <div className="preview-placeholder">Lettura file…</div>
          ) : error ? (
            <div className="preview-placeholder">{error}</div>
          ) : isEditing ? (
            <div className="editor-container">
              <CodeEditor
                content={editedContent}
                filename={filename}
                readOnly={false}
                onChange={handleContentChange}
                onSave={handleSave}
                diffInfo={diffInfo}
              />
            </div>
          ) : (
            <div className="editor-container">
              <CodeEditor
                content={content}
                filename={filename}
                readOnly={true}
                diffInfo={diffInfo}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
