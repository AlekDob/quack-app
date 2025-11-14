import { useState } from 'react';
import './EditSummaryBar.css';

export interface FileEdit {
  filePath: string;
  editCount: number;
  lineNumbers: number[];
}

export interface FileDeleted {
  filePath: string;
}

interface EditSummaryBarProps {
  edits: FileEdit[];
  deletes?: FileDeleted[];
  onFileClick?: (filePath: string) => void;
  onClear?: () => void;
  onClearEdits?: () => void; // Deprecated, use onClear
}

export default function EditSummaryBar({ edits, deletes = [], onFileClick, onClear, onClearEdits }: EditSummaryBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Support both onClear and deprecated onClearEdits
  const handleClear = onClear || onClearEdits;

  if (edits.length === 0 && deletes.length === 0) {
    return null; // Don't show if no edits or deletes
  }

  const totalChanges = edits.reduce((sum, edit) => sum + edit.editCount, 0);
  const hasEdits = edits.length > 0;
  const hasDeletes = deletes.length > 0;

  const handleFileClick = (filePath: string) => {
    if (onFileClick) {
      onFileClick(filePath);
    }
  };

  const handleOpenAll = () => {
    if (onFileClick) {
      edits.forEach(edit => onFileClick(edit.filePath));
    }
  };

  return (
    <div className="edit-summary-bar">
      <div className="edit-summary-bar-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="edit-summary-bar-title">
          {hasEdits && (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              <span className="edit-summary-bar-label">Files Modified ({edits.length})</span>
              <span className="edit-summary-bar-badge">{totalChanges} {totalChanges === 1 ? 'change' : 'changes'}</span>
            </>
          )}
          {hasEdits && hasDeletes && <span className="edit-summary-bar-separator">•</span>}
          {hasDeletes && (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="edit-summary-bar-delete-icon">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              <span className="edit-summary-bar-label edit-summary-bar-label-delete">Files Deleted ({deletes.length})</span>
            </>
          )}
        </div>
        <div className="edit-summary-bar-actions">
          {handleClear && (edits.length > 0 || deletes.length > 0) && (
            <button
              className="edit-summary-bar-clear-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              title="Clear list"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
          <svg
            className={`edit-summary-bar-chevron ${isExpanded ? 'expanded' : ''}`}
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      {isExpanded && (
        <div className="edit-summary-bar-content">
          {hasEdits && (
            <div className="edit-summary-bar-section">
              <div className="edit-summary-bar-section-title">Modified</div>
              <div className="edit-summary-bar-files">
                {edits.map((edit, index) => {
                  const fileName = edit.filePath.split('/').pop() || edit.filePath;
                  const dirPath = edit.filePath.substring(0, edit.filePath.lastIndexOf('/'));

                  return (
                    <div
                      key={index}
                      className="edit-summary-bar-file"
                      onClick={() => handleFileClick(edit.filePath)}
                    >
                      <div className="edit-summary-bar-file-info">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                          <polyline points="13 2 13 9 20 9" />
                        </svg>
                        <span className="edit-summary-bar-file-name">{fileName}</span>
                        {dirPath && <span className="edit-summary-bar-file-path">{dirPath}</span>}
                      </div>
                      <span className="edit-summary-bar-file-count">
                        {edit.editCount} {edit.editCount === 1 ? 'edit' : 'edits'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
                        {dirPath && <span className="edit-summary-bar-file-path">{dirPath}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {hasEdits && (
            <div className="edit-summary-bar-footer">
              <button
                className="edit-summary-bar-open-all-btn"
                onClick={handleOpenAll}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
                Open All Modified Files
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
