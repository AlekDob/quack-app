import { memo, useState, useCallback, useEffect, useImperativeHandle, forwardRef, lazy, Suspense, useRef } from "react";
import { toast } from "sonner";
import type { DiffInfo, LineChange } from "./CodeEditorCodeMirror";
import MarkdownText from "./MarkdownText";
import RevealInFinderButton from "./RevealInFinderButton";
import CodeEditorSkeleton from "./skeletons/CodeEditorSkeleton";
import SearchToolbar, { type SearchOptions } from "./SearchToolbar";
import type { CodeEditorRef } from "./CodeEditorCodeMirror";
import { formatShortcut } from "../utils/platform";
import { useIDEStore, selectHasPreferredIDE } from "../stores/ideStore";

// Lazy load CodeMirror editor
const CodeEditor = lazy(() => import("./CodeEditorCodeMirror"));

interface FilePreviewDrawerProps {
  open: boolean;
  filename: string | null;
  path: string | null;
  content: string;
  loading: boolean;
  error: string | null;
  formatting: boolean;
  diffInfo?: DiffInfo | null;
  lineChanges?: LineChange[]; // Detailed line-by-line changes for diff highlighting
  onClose: () => void;
  onRefresh: () => void;
  onFormat: () => void;
  onSave?: (content: string) => void;
  onHasUnsavedChanges?: (hasChanges: boolean) => void;
  imageData?: string | null;
  embedded?: boolean; // When true, renders without drawer backdrop (for tab system)
  onEditorSelectionChange?: (selection: { selectedText: string; startLine: number; endLine: number } | null) => void;
}

export interface FilePreviewDrawerRef {
  triggerSave: () => void;
  isEditMode: boolean;
  toggleEditMode: () => void;
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
  lineChanges,
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
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchMatchCount, setSearchMatchCount] = useState(0);
  const [currentSearchMatch, setCurrentSearchMatch] = useState(0);
  const codeEditorRef = useRef<CodeEditorRef>(null);
  const hasPreferredIDE = useIDEStore(selectHasPreferredIDE);
  const openFileInIDE = useIDEStore((state) => state.openFileInIDE);

  // Notify parent when hasUnsavedChanges state changes
  useEffect(() => {
    onHasUnsavedChanges?.(hasUnsavedChanges);
  }, [hasUnsavedChanges, onHasUnsavedChanges]);

  const handleOpenInIDE = useCallback(async () => {
    if (!path) return;

    try {
      await openFileInIDE(path);
      toast.success("File opened in IDE");
    } catch (error) {
      console.error("Failed to open file in IDE:", error);
      toast.error("Failed to open file in IDE");
    }
  }, [path, openFileInIDE]);

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

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    triggerSave: () => handleSave(),
    isEditMode,
    toggleEditMode: () => setIsEditMode(!isEditMode),
  }), [handleSave, isEditMode]);

  // Reset content and edit mode when file changes
  useEffect(() => {
    setEditedContent(content);
    setHasUnsavedChanges(false);
    setIsEditMode(false); // Always start in preview mode
    setIsSearchActive(false); // Close search when switching files
  }, [path, content]);

  // Search handlers
  const handleSearch = useCallback((query: string, options: SearchOptions) => {
    if (!codeEditorRef.current) return;
    const result = codeEditorRef.current.search(query, options);
    setSearchMatchCount(result.total);
    setCurrentSearchMatch(result.current);
  }, []);

  const handleNextMatch = useCallback(() => {
    if (!codeEditorRef.current) return;
    codeEditorRef.current.nextMatch();
    setCurrentSearchMatch(prev => (prev < searchMatchCount ? prev + 1 : 1));
  }, [searchMatchCount]);

  const handlePreviousMatch = useCallback(() => {
    if (!codeEditorRef.current) return;
    codeEditorRef.current.previousMatch();
    setCurrentSearchMatch(prev => (prev > 1 ? prev - 1 : searchMatchCount));
  }, [searchMatchCount]);

  const handleCloseSearch = useCallback(() => {
    if (codeEditorRef.current) {
      codeEditorRef.current.clearSearch();
    }
    setIsSearchActive(false);
    setSearchMatchCount(0);
    setCurrentSearchMatch(0);
  }, []);

  const handleReplace = useCallback((replaceText: string) => {
    if (!codeEditorRef.current) return;
    codeEditorRef.current.replace(replaceText);
    // Update match count after replace
    setSearchMatchCount(prev => Math.max(0, prev - 1));
    if (searchMatchCount <= 1) {
      setCurrentSearchMatch(0);
    }
  }, [searchMatchCount]);

  const handleReplaceAll = useCallback((replaceText: string) => {
    if (!codeEditorRef.current) return;
    codeEditorRef.current.replaceAll(replaceText);
    // Clear match count after replace all
    setSearchMatchCount(0);
    setCurrentSearchMatch(0);
  }, []);

  // Check if file is an image
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg', '.ico', '.tiff', '.tif'];
  const isImageFile = filename ? imageExtensions.some(ext => filename.toLowerCase().endsWith(ext)) : false;

  // Check if file is markdown
  const isMarkdownFile = filename ? filename.toLowerCase().endsWith('.md') : false;

  // Keyboard shortcut: Cmd+F / Ctrl+F to toggle search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f' && !isImageFile) {
        e.preventDefault();
        setIsSearchActive(prev => !prev); // Toggle instead of always true
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isImageFile]);

  if (!open) {
    return null;
  }

  // Shared content renderer
  const renderContent = () => {
    return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Search toolbar - replaces header when active */}
      {isSearchActive && !isImageFile ? (
        <SearchToolbar
          onSearch={handleSearch}
          onNext={handleNextMatch}
          onPrevious={handlePreviousMatch}
          onClose={handleCloseSearch}
          onReplace={handleReplace}
          onReplaceAll={handleReplaceAll}
          matchCount={searchMatchCount}
          currentMatch={currentSearchMatch}
        />
      ) : (
        <header className={`preview-toolbar ${embedded ? 'embedded' : ''}`}>
          <div className="preview-meta">
            <span className="preview-filename">{filename ?? "File"}</span>
            {path && <span className="preview-path">{path}</span>}
            {loading && <span className="preview-status">Caricamento…</span>}
            {error && !loading && (
              <span className="preview-error">{error}</span>
            )}
          </div>
          <div className="preview-actions">
            {/* Hide toolbar buttons in embedded mode - use bottom file-action-buttons instead */}
            {!embedded && (
              <>
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
                    {!isMarkdownFile && (
                      <button
                        type="button"
                        className="preview-action"
                        onClick={onFormat}
                        disabled={loading || formatting}
                        title="Format code"
                      >
                        {formatting ? "Formatting…" : "Format"}
                      </button>
                    )}
                    {onSave && (
                      <button
                        type="button"
                        className={`preview-action save ${hasUnsavedChanges ? "active" : ""}`}
                        onClick={() => handleSave()}
                        disabled={!hasUnsavedChanges}
                        title={hasUnsavedChanges ? `Save changes (${formatShortcut("⌘S")})` : "No changes to save"}
                      >
                        {hasUnsavedChanges ? "Save *" : "Saved"}
                      </button>
                    )}
                    <button
                      type="button"
                      className="preview-action"
                      onClick={() => setIsSearchActive(true)}
                      title={`Search in file (${formatShortcut("⌘F")})`}
                    >
                      Search
                    </button>
                  </>
                )}
                {path && (
                  <>
                    {hasPreferredIDE && (
                      <button
                        type="button"
                        className="preview-action"
                        onClick={handleOpenInIDE}
                        disabled={loading}
                        title="Open in IDE"
                      >
                        Open in IDE
                      </button>
                    )}
                    <RevealInFinderButton path={path} className="preview-action" />
                  </>
                )}
                <button type="button" className="preview-close" onClick={onClose} title="Close preview">
                  Close
                </button>
              </>
            )}
          </div>
        </header>
      )}
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
        ) : isMarkdownFile ? (
          <div className="editor-container">
            {isEditMode ? (
              <Suspense fallback={<CodeEditorSkeleton />}>
                <CodeEditor
                  ref={codeEditorRef}
                  content={editedContent}
                  filename={filename}
                  readOnly={false}
                  onChange={handleContentChange}
                  onSave={handleSave}
                  diffInfo={diffInfo}
                  lineChanges={lineChanges}
                />
              </Suspense>
            ) : (
              <div style={{ padding: '20px', overflow: 'auto', height: '100%' }}>
                <MarkdownText>{editedContent}</MarkdownText>
              </div>
            )}
          </div>
        ) : (
          <div className="editor-container">
            <Suspense fallback={<CodeEditorSkeleton />}>
              <CodeEditor
                ref={codeEditorRef}
                content={editedContent}
                filename={filename}
                readOnly={true}
                diffInfo={diffInfo}
                lineChanges={lineChanges}
              />
            </Suspense>
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
