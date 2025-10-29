import { memo, useState, useCallback, useEffect, useImperativeHandle, forwardRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import CodeEditor, { type DiffInfo } from "./CodeEditor";
import RevealInFinderButton from "./RevealInFinderButton";

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
  onHasUnsavedChanges?: (hasChanges: boolean) => void;
  imageData?: string | null;
  embedded?: boolean; // When true, renders without drawer backdrop (for tab system)
}

export interface FilePreviewDrawerRef {
  triggerSave: () => void;
}

const FilePreviewDrawer = forwardRef<FilePreviewDrawerRef, FilePreviewDrawerProps>(({
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
  onHasUnsavedChanges,
  imageData,
  embedded = false,
}, ref) => {
  const [editedContent, setEditedContent] = useState(content);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Notify parent when hasUnsavedChanges state changes
  useEffect(() => {
    onHasUnsavedChanges?.(hasUnsavedChanges);
  }, [hasUnsavedChanges, onHasUnsavedChanges]);

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

  // Expose triggerSave method via ref
  useImperativeHandle(ref, () => ({
    triggerSave: () => handleSave(),
  }), [handleSave]);

  // Reset content when file changes
  useEffect(() => {
    setEditedContent(content);
    setHasUnsavedChanges(false);
  }, [path, content]);

  // Check if file is an image
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg', '.ico', '.tiff', '.tif'];
  const isImageFile = filename ? imageExtensions.some(ext => filename.toLowerCase().endsWith(ext)) : false;

  if (!open) {
    return null;
  }

  // Shared content renderer
  const renderContent = () => {
    return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {!embedded && <header className="preview-toolbar">
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
                disabled={loading || formatting}
                title="Format code"
              >
                {formatting ? "Formatting…" : "Format"}
              </button>
              {onSave && (
                <button
                  type="button"
                  className={`preview-action save ${hasUnsavedChanges ? "active" : ""}`}
                  onClick={() => handleSave()}
                  disabled={!hasUnsavedChanges}
                  title={hasUnsavedChanges ? "Save changes (⌘S)" : "No changes to save"}
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
      </header>}
      <div
        className="preview-content"
        data-loading={loading}
      >
        {loading ? (
          <div className="preview-placeholder">Loading file…</div>
        ) : error ? (
          <div className="preview-placeholder">{error}</div>
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
        ) : (
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
        )}
      </div>
    </div>
    );
  };

  // Embedded mode (used in tab system) - no backdrop, full height
  if (embedded) {
    return (
      <div className="preview-drawer-panel preview-embedded" style={{ position: 'relative', height: '100%', maxWidth: 'none', borderRadius: 0, boxShadow: 'none', display: 'flex', flexDirection: 'column', minHeight: 0, transform: 'translateX(0)', width: '100%' }}>
        {renderContent()}
      </div>
    );
  }

  // Drawer mode (default) - with backdrop
  return (
    <div className={`preview-drawer ${open ? "open" : ""}`} role="dialog" aria-modal="true">
      <div
        className="preview-drawer-backdrop"
        onClick={onClose}
        role="presentation"
      />
      <div className="preview-drawer-panel">
        {renderContent()}
      </div>
    </div>
  );
});

// Add display name for debugging
FilePreviewDrawer.displayName = 'FilePreviewDrawer';

// Performance: Memo drawer - skippa re-render quando chiuso
export default memo(FilePreviewDrawer, (prev, next) => prev.open === next.open && !next.open);
