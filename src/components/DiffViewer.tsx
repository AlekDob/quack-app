import { memo } from 'react';
import type { ToolDiff } from '../types';
import './DiffViewer.css';

interface DiffViewerProps {
  diff: ToolDiff;
}

function DiffViewer({ diff }: DiffViewerProps) {
  return (
    <div className="diff-viewer">
      {diff.fileName && (
        <div className="diff-viewer-header">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="diff-viewer-icon">
            <path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25V1.75Z"/>
          </svg>
          <span className="diff-viewer-filename">{diff.fileName}</span>
        </div>
      )}
      <div className="diff-viewer-content">
        {diff.lines.map((line, index) => (
          <div
            key={index}
            className={`diff-line diff-line-${line.type}`}
            data-line-number={line.lineNumber}
          >
            <span className="diff-line-marker">
              {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
            </span>
            <span className="diff-line-content">{line.content}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(DiffViewer);
