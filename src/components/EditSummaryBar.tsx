import { useState } from 'react';
import FileStatusBadge, { type FileStatus } from './FileStatusBadge';
import FileDiffButton from './FileDiffButton';
import { useIDEStore, selectHasPreferredIDE } from '../stores/ideStore';
import './EditSummaryBar.css';

export interface LineChange {
  line: number;
  type: 'added' | 'modified' | 'removed';
}

export interface FileEdit {
  filePath: string;
  editCount: number;
  lineNumbers: number[];
  lineChanges?: LineChange[]; // Detailed line-by-line changes for diff highlighting
  status?: 'created' | 'modified'; // NEW: Track if file was created or modified
}

export interface FileDeleted {
  filePath: string;
}

interface EditSummaryBarProps {
  edits: FileEdit[];
  deletes?: FileDeleted[];
  onFileClick?: (filePath: string, lineChanges?: LineChange[]) => void;
  onDiffClick?: (filePath: string, status: FileStatus) => void; // NEW: Handler for diff button
  onOpenInQuack?: (filePath: string) => void; // Handler for opening file in Quack tab
  onClear?: () => void;
  onClearEdits?: () => void; // Deprecated, use onClear
}

export default function EditSummaryBar({ edits, deletes = [], onFileClick, onDiffClick, onOpenInQuack, onClear, onClearEdits }: EditSummaryBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isOpeningAll, setIsOpeningAll] = useState(false);

  // IDE Integration
  const hasPreferredIDE = useIDEStore(selectHasPreferredIDE);
  const openFileInIDE = useIDEStore((state) => state.openFileInIDE);
  const openMultipleFilesInIDE = useIDEStore((state) => state.openMultipleFilesInIDE);

  // Support both onClear and deprecated onClearEdits
  const handleClear = onClear || onClearEdits;

  if (edits.length === 0 && deletes.length === 0) {
    return null; // Don't show if no edits or deletes
  }

  // Check if file is markdown
  const isMarkdownFile = (filePath: string) => filePath.endsWith('.md');

  // Separate files by type: Markdown vs Code
  const markdownFiles = edits.filter(edit => isMarkdownFile(edit.filePath));
  const codeEdits = edits.filter(edit => !isMarkdownFile(edit.filePath));

  // Separate code files by status (NEW vs MODIFIED)
  const newFiles = codeEdits.filter(edit => edit.status === 'created');
  const modifiedFiles = codeEdits.filter(edit => edit.status !== 'created'); // includes undefined (backwards compat)
  const hasMarkdownFiles = markdownFiles.length > 0;

  const totalChanges = edits.reduce((sum, edit) => sum + edit.editCount, 0);
  const hasNewFiles = newFiles.length > 0;
  const hasModifiedFiles = modifiedFiles.length > 0;
  const hasDeletes = deletes.length > 0;
  const hasCodeFiles = hasNewFiles || hasModifiedFiles;

  const handleFileClick = async (filePath: string, lineChanges?: LineChange[]) => {
    console.log('[EditSummaryBar] handleFileClick called with:', { filePath, lineChanges, hasPreferredIDE });

    // If IDE is configured, open in external IDE
    if (hasPreferredIDE) {
      try {
        // Get first line from line changes for navigation
        const firstLine = lineChanges?.[0]?.line;
        console.log('[EditSummaryBar] Opening in IDE:', { filePath, firstLine });
        await openFileInIDE(filePath, firstLine);
      } catch (error) {
        console.error('[EditSummaryBar] Failed to open file in IDE:', error);
        // Fallback to internal handler
        if (onFileClick) {
          onFileClick(filePath, lineChanges);
        }
      }
    } else if (onFileClick) {
      // No IDE configured, use internal handler
      onFileClick(filePath, lineChanges);
    }
  };

  const handleDiffClick = (filePath: string, status: FileStatus) => {
    if (onDiffClick) {
      onDiffClick(filePath, status);
    }
  };

  const handleOpenAll = async () => {
    // If IDE is configured, open all files in external IDE
    if (hasPreferredIDE) {
      setIsOpeningAll(true);
      try {
        const filePaths = edits.map(edit => edit.filePath);
        await openMultipleFilesInIDE(filePaths);
      } catch (error) {
        console.error('[EditSummaryBar] Failed to open files in IDE:', error);
        // Fallback to internal handler
        if (onFileClick) {
          edits.forEach(edit => onFileClick(edit.filePath, edit.lineChanges));
        }
      } finally {
        setIsOpeningAll(false);
      }
    } else if (onFileClick) {
      // No IDE configured, use internal handler
      edits.forEach(edit => onFileClick(edit.filePath, edit.lineChanges));
    }
  };

  return (
    <div className={`edit-summary-bar ${hasMarkdownFiles && !hasCodeFiles && !hasDeletes ? 'edit-summary-bar-markdown-only' : ''}`}>
      <div className="edit-summary-bar-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="edit-summary-bar-title">
          {hasCodeFiles && (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              <span className="edit-summary-bar-label">Code ({codeEdits.length})</span>
              {hasNewFiles && <span className="edit-summary-bar-badge">{newFiles.length} new</span>}
              {hasModifiedFiles && <span className="edit-summary-bar-badge">{modifiedFiles.length} edited</span>}
            </>
          )}
          {hasCodeFiles && hasMarkdownFiles && <span className="edit-summary-bar-separator">•</span>}
          {hasMarkdownFiles && (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="edit-summary-bar-markdown-icon">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
                <path d="M16 13H8" />
                <path d="M16 17H8" />
              </svg>
              <span className="edit-summary-bar-label edit-summary-bar-label-markdown">Docs ({markdownFiles.length})</span>
              <span className="edit-summary-bar-badge edit-summary-bar-badge-markdown">{markdownFiles.length} md</span>
            </>
          )}
          {(hasCodeFiles || hasMarkdownFiles) && hasDeletes && <span className="edit-summary-bar-separator">•</span>}
          {hasDeletes && (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="edit-summary-bar-delete-icon">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              <span className="edit-summary-bar-label edit-summary-bar-label-delete">Deleted ({deletes.length})</span>
            </>
          )}
        </div>
        <div className="edit-summary-bar-actions">
          <svg
            className={`edit-summary-bar-chevron ${isExpanded ? 'expanded' : ''}`}
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="6 15 12 9 18 15" />
          </svg>
        </div>
      </div>

      <div className={`edit-summary-bar-content-wrapper ${isExpanded ? 'expanded' : ''}`}>
        <div className="edit-summary-bar-content">
          <div className="edit-summary-bar-content-inner">
            {/* NEW FILES Section */}
            {hasNewFiles && (
              <div className="edit-summary-bar-section">
                <div className="edit-summary-bar-section-title">New Files</div>
                <div className="edit-summary-bar-files">
                  {newFiles.map((edit, index) => {
                    const fileName = edit.filePath.split('/').pop() || edit.filePath;
                    const dirPath = edit.filePath.substring(0, edit.filePath.lastIndexOf('/'));

                    return (
                      <div
                        key={index}
                        className="edit-summary-bar-file"
                      >
                        <div className="edit-summary-bar-file-info">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                            <polyline points="13 2 13 9 20 9" />
                          </svg>
                          <span className="edit-summary-bar-file-name">{fileName}</span>
                          <FileStatusBadge status="created" />
                          {dirPath && <span className="edit-summary-bar-file-path">{dirPath}</span>}
                        </div>
                        <div className="edit-summary-bar-file-actions">
                          <FileDiffButton
                            filePath={edit.filePath}
                            onDiffClick={(path) => handleDiffClick(path, 'created')}
                          />
                          <button
                            className={`edit-summary-bar-open-btn ${hasPreferredIDE ? 'ide-enabled' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleFileClick(edit.filePath, edit.lineChanges);
                            }}
                            title={hasPreferredIDE ? 'Open in IDE' : 'Open file'}
                          >
                            {hasPreferredIDE ? 'IDE' : 'Open'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* MODIFIED FILES Section */}
            {hasModifiedFiles && (
              <div className="edit-summary-bar-section">
                <div className="edit-summary-bar-section-title">Modified</div>
                <div className="edit-summary-bar-files">
                  {modifiedFiles.map((edit, index) => {
                    const fileName = edit.filePath.split('/').pop() || edit.filePath;
                    const dirPath = edit.filePath.substring(0, edit.filePath.lastIndexOf('/'));

                    return (
                      <div
                        key={index}
                        className="edit-summary-bar-file"
                      >
                        <div className="edit-summary-bar-file-info">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                            <polyline points="13 2 13 9 20 9" />
                          </svg>
                          <span className="edit-summary-bar-file-name">{fileName}</span>
                          <FileStatusBadge status="modified" />
                          {dirPath && <span className="edit-summary-bar-file-path">{dirPath}</span>}
                        </div>
                        <div className="edit-summary-bar-file-actions">
                          <span className="edit-summary-bar-file-count">
                            {edit.editCount} {edit.editCount === 1 ? 'edit' : 'edits'}
                          </span>
                          <FileDiffButton
                            filePath={edit.filePath}
                            onDiffClick={(path) => handleDiffClick(path, 'modified')}
                          />
                          <button
                            className={`edit-summary-bar-open-btn ${hasPreferredIDE ? 'ide-enabled' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleFileClick(edit.filePath, edit.lineChanges);
                            }}
                            title={hasPreferredIDE ? 'Open in IDE' : 'Open file'}
                          >
                            {hasPreferredIDE ? 'IDE' : 'Open'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* MARKDOWN FILES Section - Purple theme */}
            {hasMarkdownFiles && (
              <div className="edit-summary-bar-section edit-summary-bar-section-markdown">
                <div className="edit-summary-bar-section-title">Documentation</div>
                <div className="edit-summary-bar-files">
                  {markdownFiles.map((edit, index) => {
                    const fileName = edit.filePath.split('/').pop() || edit.filePath;
                    const dirPath = edit.filePath.substring(0, edit.filePath.lastIndexOf('/'));
                    const isNew = edit.status === 'created';

                    return (
                      <div
                        key={index}
                        className="edit-summary-bar-file edit-summary-bar-file-markdown"
                      >
                        <div className="edit-summary-bar-file-info">
                          {/* Markdown file icon */}
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <path d="M14 2v6h6" />
                            <path d="M16 13H8" />
                            <path d="M16 17H8" />
                            <path d="M10 9H8" />
                          </svg>
                          <span className="edit-summary-bar-file-name">{fileName}</span>
                          <FileStatusBadge status={isNew ? 'created' : 'modified'} />
                          {dirPath && <span className="edit-summary-bar-file-path">{dirPath}</span>}
                        </div>
                        <div className="edit-summary-bar-file-actions">
                          {!isNew && (
                            <span className="edit-summary-bar-file-count edit-summary-bar-file-count-markdown hide-on-small">
                              {edit.editCount} {edit.editCount === 1 ? 'edit' : 'edits'}
                            </span>
                          )}
                          {onOpenInQuack && (
                            <button
                              className="edit-summary-bar-open-btn edit-summary-bar-quack-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenInQuack(edit.filePath);
                              }}
                              title="Open in Quack"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M15 3h6v6" />
                                <path d="M10 14L21 3" />
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                              </svg>
                              <span className="hide-on-small">Quack</span>
                            </button>
                          )}
                          <FileDiffButton
                            filePath={edit.filePath}
                            onDiffClick={(path) => handleDiffClick(path, isNew ? 'created' : 'modified')}
                          />
                          <button
                            className={`edit-summary-bar-open-btn ${hasPreferredIDE ? 'ide-enabled' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleFileClick(edit.filePath, edit.lineChanges);
                            }}
                            title={hasPreferredIDE ? 'Open in IDE' : 'Open file'}
                          >
                            {hasPreferredIDE ? 'IDE' : 'Open'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* DELETED FILES Section */}
            {hasDeletes && (
              <div className="edit-summary-bar-section edit-summary-bar-section-delete">
                <div className="edit-summary-bar-section-title">Deleted</div>
                <div className="edit-summary-bar-files">
                  {deletes.map((deleted, index) => {
                    const fileName = deleted.filePath.split('/').pop() || deleted.filePath;
                    const dirPath = deleted.filePath.substring(0, deleted.filePath.lastIndexOf('/'));

                    return (
                      <div
                        key={index}
                        className="edit-summary-bar-file edit-summary-bar-file-deleted"
                      >
                        <div className="edit-summary-bar-file-info">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                          <span className="edit-summary-bar-file-name">{fileName}</span>
                          <FileStatusBadge status="deleted" />
                          {dirPath && <span className="edit-summary-bar-file-path">{dirPath}</span>}
                        </div>
                        <div className="edit-summary-bar-file-actions">
                          <FileDiffButton
                            filePath={deleted.filePath}
                            onDiffClick={(path) => handleDiffClick(path, 'deleted')}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {(hasNewFiles || hasModifiedFiles) && (
              <div className="edit-summary-bar-footer">
                <button
                  className={`edit-summary-bar-open-all-btn ${hasPreferredIDE ? 'ide-enabled' : ''}`}
                  onClick={handleOpenAll}
                  disabled={isOpeningAll}
                >
                  {hasPreferredIDE ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="3" width="20" height="14" rx="2" />
                      <path d="M8 21h8" />
                      <path d="M12 17v4" />
                      <path d="M7 8l3 3-3 3" />
                      <path d="M13 11h4" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="7" height="7" />
                      <rect x="14" y="3" width="7" height="7" />
                      <rect x="14" y="14" width="7" height="7" />
                      <rect x="3" y="14" width="7" height="7" />
                    </svg>
                  )}
                  {isOpeningAll ? 'Opening...' : hasPreferredIDE ? 'Open All in IDE' : 'Open All Modified Files'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
