import { memo, useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import CodeEditor, { type DiffInfo } from "./CodeEditor";
import RevealInFinderButton from "./RevealInFinderButton";
import MarkdownText from "./MarkdownText";
import MermaidDiagram from "./MermaidDiagram";

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
  imageData?: string | null;
}

function FilePreviewDrawer({
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
  imageData,
}: FilePreviewDrawerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const handleToggleEdit = useCallback(() => {
    if (isEditing && hasUnsavedChanges) {
      const confirmDiscard = window.confirm(
        "You have unsaved changes. Do you want to discard them?"
      );
      if (!confirmDiscard) return;
    }
    setIsEditing(!isEditing);
    setEditedContent(content);
    setHasUnsavedChanges(false);
  }, [isEditing, hasUnsavedChanges, content]);

  const handleOpenInEditor = useCallback(async () => {
    if (!path) return;

    try {
      await invoke("open_file_in_editor", { path });
      toast.success("File opened in default editor");
    } catch (error) {
      console.error("Failed to open file in editor:", error);
      toast.error("Failed to open file in editor");
    }
  }, [path]);

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

  // Check if file is markdown or mermaid
  const isMarkdownFile = filename?.toLowerCase().endsWith('.md') ?? false;
  const isMermaidFile = filename?.toLowerCase().endsWith('.mmd') ?? false;

  // Check if file is an image
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg', '.ico', '.tiff', '.tif'];
  const isImageFile = filename ? imageExtensions.some(ext => filename.toLowerCase().endsWith(ext)) : false;

  if (!open) {
    return null;
  }

  return (
    <div className={`preview-drawer ${open ? "open" : ""}`} role="dialog" aria-modal="true">
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
            {!isImageFile && (
              <>
                <button
                  type="button"
                  className="preview-action"
                  onClick={onRefresh}
                  disabled={loading || formatting}
                  title="Reload file from disk"
                >
                  Reload
                </button>
                <button
                  type="button"
                  className="preview-action"
                  onClick={onFormat}
                  disabled={loading || formatting || isEditing}
                  title="Format code"
                >
                  {formatting ? "Formatting…" : "Format"}
                </button>
                <button
                  type="button"
                  className={`preview-action ${isEditing ? "active" : ""}`}
                  onClick={handleToggleEdit}
                  disabled={loading}
                  title={isEditing ? "Switch to preview mode" : "Switch to edit mode"}
                >
                  {isEditing ? "Preview" : "Edit"}
                </button>
                {isEditing && onSave && (
                  <button
                    type="button"
                    className="preview-action save"
                    onClick={() => handleSave()}
                    disabled={!hasUnsavedChanges}
                    title={hasUnsavedChanges ? "Save changes" : "No changes to save"}
                  >
                    {hasUnsavedChanges ? "Save *" : "Saved"}
                  </button>
                )}
              </>
            )}
            {path && (
              <>
                <button
                  type="button"
                  className="preview-action"
                  onClick={handleOpenInEditor}
                  disabled={loading}
                  title="Open in default IDE"
                >
                  Open with IDE
                </button>
                <RevealInFinderButton path={path} className="preview-action" />
              </>
            )}
            <button type="button" className="preview-close" onClick={onClose} title="Close preview">
              Close
            </button>
          </div>
        </header>
        <div className={`preview-content ${(isMarkdownFile || isMermaidFile || isImageFile) && !isEditing ? 'markdown-preview' : ''}`} data-loading={loading}>
          {loading ? (
            <div className="preview-placeholder">Loading file…</div>
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
          ) : isImageFile && imageData ? (
            <div className="image-viewer">
              <img
                src={imageData}
                alt={filename || 'Image preview'}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  display: 'block',
                  margin: 'auto',
                }}
              />
            </div>
          ) : isMarkdownFile ? (
            <div className="markdown-viewer">
              <MarkdownText>{content}</MarkdownText>
            </div>
          ) : isMermaidFile ? (
            <div className="mermaid-viewer">
              <MermaidDiagram>{content}</MermaidDiagram>
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

// Performance: Memo drawer - skippa re-render quando chiuso
export default memo(FilePreviewDrawer, (prev, next) => prev.open === next.open && !next.open)
