import React, { useState } from 'react';
import './EditSummary.css';

export interface FileEdit {
  filePath: string;
  editCount: number;
  lineNumbers: number[]; // Line numbers that were modified
}

interface EditSummaryProps {
  edits: FileEdit[];
  onFileClick?: (filePath: string) => void;
}

const EditSummary: React.FC<EditSummaryProps> = ({ edits, onFileClick }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (edits.length === 0) {
    return null;
  }

  const totalEdits = edits.reduce((sum, file) => sum + file.editCount, 0);

  // Get short file name from path
  const getFileName = (path: string) => {
    const parts = path.split('/');
    return parts[parts.length - 1];
  };

  return (
    <div className="edit-summary-widget">
      <div
        className="edit-summary-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="edit-summary-title">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M11.013 1.427a1.75 1.75 0 012.474 0l1.086 1.086a1.75 1.75 0 010 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 01-.927-.928l.929-3.25a1.75 1.75 0 01.445-.758l8.61-8.61zm1.414 1.06a.25.25 0 00-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 000-.354l-1.086-1.086zM11.189 6.25L9.75 4.81l-6.286 6.287a.25.25 0 00-.064.108l-.558 1.953 1.953-.558a.249.249 0 00.108-.064l6.286-6.286z"/>
          </svg>
          <span className="edit-summary-count">
            Files Modified ({edits.length})
          </span>
          <span className="edit-summary-total">
            {totalEdits} {totalEdits === 1 ? 'change' : 'changes'}
          </span>
        </div>
        <svg
          className={`edit-summary-chevron ${isExpanded ? 'expanded' : ''}`}
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <path d="M4.427 9.427l3.396 3.396a.25.25 0 00.354 0l3.396-3.396A.25.25 0 0011.396 9H4.604a.25.25 0 00-.177.427z"/>
        </svg>
      </div>

      {isExpanded && (
        <div className="edit-summary-content">
          <div className="edit-summary-list">
            {edits.map((edit, idx) => (
              <div
                key={idx}
                className="edit-summary-item"
                onClick={() => onFileClick?.(edit.filePath)}
              >
                <div className="edit-summary-file">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0113.25 16h-9.5A1.75 1.75 0 012 14.25V1.75z"/>
                  </svg>
                  <span className="edit-summary-filename" title={edit.filePath}>
                    {getFileName(edit.filePath)}
                  </span>
                </div>
                <div className="edit-summary-meta">
                  <span className="edit-summary-badge">
                    {edit.editCount} {edit.editCount === 1 ? 'edit' : 'edits'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="edit-summary-actions">
            <button
              className="edit-summary-btn"
              onClick={(e) => {
                e.stopPropagation();
                edits.forEach(edit => onFileClick?.(edit.filePath));
              }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0a8 8 0 110 16A8 8 0 018 0zM1.5 8a6.5 6.5 0 1113 0 6.5 6.5 0 01-13 0z"/>
                <path d="M8 3.5a.75.75 0 01.75.75v3.5h3.5a.75.75 0 010 1.5h-4.25a.75.75 0 01-.75-.75V4.25A.75.75 0 018 3.5z"/>
              </svg>
              Open All Files
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditSummary;
