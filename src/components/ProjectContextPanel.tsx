import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useProjectContext } from '../hooks/useProjectContext';
import { useFileSystemStore } from '../stores/fileSystemStore';
import './ProjectContextPanel.css';

interface ProjectContextPanelProps {
  rootPath: string;
}

export default function ProjectContextPanel({
  rootPath,
}: ProjectContextPanelProps) {
  const {
    notes,
    bookmarks,
    loading,
    saveStatus,
    updateNotes,
    addBookmark,
    removeBookmark,
    openBookmarkUrl,
  } = useProjectContext(rootPath);

  const {
    previewFile,
    editorSelection,
    externalIdeContext,
    ideContextEnabled,
    toggleIdeContext,
  } = useFileSystemStore();

  const [isEditing, setIsEditing] = useState(false); // Start in preview mode
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [isAddingBookmark, setIsAddingBookmark] = useState(false);

  // Build IDE context label
  const hasIdeContext = !!(previewFile || editorSelection || externalIdeContext);
  let ideContextLabel = '';
  let ideSourceName = 'Quack';
  if (editorSelection) {
    const fileName = editorSelection.filePath.split('/').pop() || editorSelection.filePath;
    ideContextLabel = `${fileName}:${editorSelection.startLine}-${editorSelection.endLine}`;
  } else if (externalIdeContext?.selection) {
    const fileName = externalIdeContext.selection.filePath.split('/').pop() || externalIdeContext.selection.filePath;
    ideContextLabel = `${fileName}:${externalIdeContext.selection.startLine}-${externalIdeContext.selection.endLine}`;
    ideSourceName = externalIdeContext.ideName || 'IDE';
  } else if (externalIdeContext?.activeFile) {
    ideContextLabel = externalIdeContext.activeFile.split('/').pop() || externalIdeContext.activeFile;
    ideSourceName = externalIdeContext.ideName || 'IDE';
  } else if (previewFile) {
    ideContextLabel = previewFile.split('/').pop() || previewFile;
  }
  if (!editorSelection && !previewFile && externalIdeContext) {
    ideSourceName = externalIdeContext.ideName || 'IDE';
  }

  const handleAddBookmark = async () => {
    const trimmedTitle = newTitle.trim();
    const trimmedUrl = newUrl.trim();
    if (!trimmedTitle || !trimmedUrl) return;
    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) return;
    await addBookmark(trimmedTitle, trimmedUrl);
    setNewTitle('');
    setNewUrl('');
    setIsAddingBookmark(false);
  };

  const handleUrlKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddBookmark();
    }
  };

  const handleCheckboxToggle = (lineIndex: number, currentChecked: boolean) => {
    const lines = notes.split('\n');
    const targetLine = lines[lineIndex];

    if (!targetLine) return;

    // Toggle between [ ] and [x]
    const newLine = currentChecked
      ? targetLine.replace(/- \[x\]/i, '- [ ]')
      : targetLine.replace(/- \[ \]/, '- [x]');

    lines[lineIndex] = newLine;
    updateNotes(lines.join('\n'));
  };

  if (loading) {
    return (
      <div className="project-context-panel">
        <div className="context-loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="project-context-panel">
      {/* Notes */}
      <div className="context-section">
        <div className="context-section-header">
          <span className="context-section-title">Notes</span>
          <div className="context-header-actions">
            <span className={`context-save-indicator ${saveStatus}`}>
              {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : ''}
            </span>
            <button
              type="button"
              className="context-edit-toggle"
              onClick={() => setIsEditing(!isEditing)}
              title={isEditing ? 'Preview' : 'Edit'}
            >
              {isEditing ? (
                <svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 10h14M3 6h14M3 14h10" strokeLinecap="round" />
                </svg>
              ) : (
                <svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M13.5 3.5l3 3L7 16H4v-3L13.5 3.5z" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          </div>
        </div>
        {isEditing ? (
          <textarea
            className="context-notes-editor"
            value={notes}
            onChange={(e) => updateNotes(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setIsEditing(false);
                e.currentTarget.blur();
              }
            }}
            onBlur={() => setIsEditing(false)}
            placeholder="Write markdown notes, tasks, ideas...&#10;&#10;Use: - [ ] for tasks, ## for headers"
            spellCheck={false}
            autoFocus
          />
        ) : (
          <div
            className="context-notes-preview"
            onClick={() => setIsEditing(true)}
          >
            {notes.trim() ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  input: ({ checked, ...props }) => {
                    // Get the task text from the parent node
                    const parent = (props as any).node?.position;
                    const lineIndex = parent ? parent.start.line - 1 : -1;

                    return (
                      <input
                        type="checkbox"
                        checked={!!checked}
                        onChange={() => {
                          if (lineIndex >= 0) {
                            handleCheckboxToggle(lineIndex, !!checked);
                          }
                        }}
                        className="context-checkbox"
                      />
                    );
                  },
                }}
              >
                {notes}
              </ReactMarkdown>
            ) : (
              <span className="context-notes-placeholder" onClick={() => setIsEditing(true)}>
                Click to add notes...
              </span>
            )}
          </div>
        )}
      </div>

      {/* Bookmarks */}
      <div className="context-section context-bookmarks-section">
        <div className="context-bookmarks-header">
          <h3 className="context-bookmarks-title">Bookmarks</h3>
          <button
            type="button"
            className="context-add-bookmark-btn"
            onClick={() => setIsAddingBookmark(!isAddingBookmark)}
            title="Add bookmark"
          >
            <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M10 5v10M5 10h10" />
            </svg>
          </button>
        </div>

        {bookmarks.length > 0 && (
          <div className="context-bookmarks-list">
            {bookmarks.map((bookmark) => (
              <div key={bookmark.id} className="context-bookmark-item">
                <button
                  type="button"
                  className="context-bookmark-link"
                  onClick={() => openBookmarkUrl(bookmark.url)}
                  title={bookmark.url}
                >
                  <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="10" cy="10" r="7" />
                    <path d="M10 3v14M3 10h14" />
                  </svg>
                  <span className="bookmark-title">{bookmark.title}</span>
                </button>
                <button
                  type="button"
                  className="context-bookmark-delete"
                  onClick={() => removeBookmark(bookmark.id)}
                  aria-label={`Remove ${bookmark.title}`}
                >
                  <svg viewBox="0 0 20 20" width="12" height="12" aria-hidden="true">
                    <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add Bookmark Popover */}
        {isAddingBookmark && (
          <>
            <div className="context-popover-backdrop" onClick={() => setIsAddingBookmark(false)} />
            <div className="context-add-bookmark-popover">
              <div className="context-popover-header">
                <span>Add Bookmark</span>
                <button
                  type="button"
                  className="context-popover-close"
                  onClick={() => setIsAddingBookmark(false)}
                >
                  <svg viewBox="0 0 20 20" width="12" height="12">
                    <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              <div className="context-add-bookmark">
                <input
                  type="text"
                  className="context-input"
                  placeholder="Title"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  autoFocus
                />
                <input
                  type="url"
                  className="context-input"
                  placeholder="https://..."
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  onKeyDown={handleUrlKeyDown}
                />
                <button
                  type="button"
                  className="context-add-btn"
                  onClick={handleAddBookmark}
                  disabled={!newTitle.trim() || !newUrl.trim()}
                >
                  Add
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* IDE Context — below bookmarks */}
      {hasIdeContext && (
        <div className={`context-section context-ide-section ${!ideContextEnabled ? 'context-ide-section--disabled' : ''}`}>
          <div className="context-ide-header">
            <button
              type="button"
              className={`context-ide-chip ${!ideContextEnabled ? 'context-ide-chip--disabled' : ''}`}
              onClick={toggleIdeContext}
              title={ideContextEnabled ? 'Click to disable IDE context' : 'Click to enable IDE context'}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
              <span className="context-ide-source">From {ideSourceName}</span>
            </button>
          </div>
          <span className="context-ide-file">{ideContextLabel}</span>
        </div>
      )}
    </div>
  );
}
