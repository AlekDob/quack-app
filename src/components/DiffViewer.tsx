import { memo, useState, useMemo, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { ToolDiff, DiffLine } from '../types';
import './DiffViewer.css';

interface DiffViewerProps {
  diff: ToolDiff;
}

interface SplitRow {
  left: DiffLine | null;
  right: DiffLine | null;
}

function buildSplitRows(lines: DiffLine[]): SplitRow[] {
  const removed: DiffLine[] = [];
  const added: DiffLine[] = [];
  const rows: SplitRow[] = [];

  const flushPending = () => {
    const max = Math.max(removed.length, added.length);
    for (let i = 0; i < max; i++) {
      rows.push({
        left: removed[i] ?? null,
        right: added[i] ?? null,
      });
    }
    removed.length = 0;
    added.length = 0;
  };

  for (const line of lines) {
    if (line.type === 'unchanged') {
      flushPending();
      rows.push({ left: line, right: line });
    } else if (line.type === 'removed') {
      removed.push(line);
    } else {
      added.push(line);
    }
  }
  flushPending();
  return rows;
}

function DiffContent({ lines, splitMode, splitRows }: {
  lines: DiffLine[];
  splitMode: boolean;
  splitRows: SplitRow[];
}) {
  if (splitMode) {
    return (
      <div className="diff-split">
        <div className="diff-split-col diff-split-left">
          {splitRows.map((row, i) => (
            <div
              key={i}
              className={`diff-line ${row.left ? `diff-line-${row.left.type === 'unchanged' ? 'unchanged' : 'removed'}` : 'diff-line-empty'}`}
              data-line-number={row.left?.lineNumber}
            >
              <span className="diff-line-marker">
                {row.left ? (row.left.type === 'removed' ? '-' : ' ') : ' '}
              </span>
              <span className="diff-line-content">
                {row.left?.content ?? ''}
              </span>
            </div>
          ))}
        </div>
        <div className="diff-split-col diff-split-right">
          {splitRows.map((row, i) => (
            <div
              key={i}
              className={`diff-line ${row.right ? `diff-line-${row.right.type === 'unchanged' ? 'unchanged' : 'added'}` : 'diff-line-empty'}`}
              data-line-number={row.right?.lineNumber}
            >
              <span className="diff-line-marker">
                {row.right ? (row.right.type === 'added' ? '+' : ' ') : ' '}
              </span>
              <span className="diff-line-content">
                {row.right?.content ?? ''}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      {lines.map((line, index) => (
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
    </>
  );
}

function DiffViewer({ diff }: DiffViewerProps) {
  const [splitMode, setSplitMode] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const splitRows = useMemo(
    () => (splitMode ? buildSplitRows(diff.lines) : []),
    [splitMode, diff.lines]
  );

  const closeFullscreen = useCallback(() => setFullscreen(false), []);

  useEffect(() => {
    if (!fullscreen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeFullscreen();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [fullscreen, closeFullscreen]);

  const headerButtons = (
    <>
      <button
        className={`diff-view-toggle ${splitMode ? 'active' : ''}`}
        onClick={() => setSplitMode(v => !v)}
        title={splitMode ? 'Unified' : 'Split'}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
          <path d="M1.5 2A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h13a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 14.5 2h-13ZM7 3.5v9H1.5V3.5H7Zm1.5 0h6v9h-6v-9Z"/>
        </svg>
      </button>
      <button
        className={`diff-view-toggle ${fullscreen ? 'active' : ''}`}
        onClick={() => setFullscreen(v => !v)}
        title={fullscreen ? 'Chiudi' : 'Fullscreen'}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
          {fullscreen ? (
            <path d="M5.5 0a.5.5 0 0 1 .5.5v4A1.5 1.5 0 0 1 4.5 6h-4a.5.5 0 0 1 0-1h4a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 1 .5-.5Zm5 0a.5.5 0 0 1 .5.5v4a.5.5 0 0 0 .5.5h4a.5.5 0 0 1 0 1h-4A1.5 1.5 0 0 1 10 4.5v-4a.5.5 0 0 1 .5-.5ZM0 10.5a.5.5 0 0 1 .5-.5h4A1.5 1.5 0 0 1 6 11.5v4a.5.5 0 0 1-1 0v-4a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 1-.5-.5Zm10 0a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 0 1h-4a.5.5 0 0 0-.5.5v4a.5.5 0 0 1-1 0v-4Z"/>
          ) : (
            <path d="M1.5 1a.5.5 0 0 0-.5.5v4a.5.5 0 0 1-1 0v-4A1.5 1.5 0 0 1 1.5 0h4a.5.5 0 0 1 0 1h-4ZM10 .5a.5.5 0 0 1 .5-.5h4A1.5 1.5 0 0 1 16 1.5v4a.5.5 0 0 1-1 0v-4a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 1-.5-.5ZM.5 10a.5.5 0 0 1 .5.5v4a.5.5 0 0 0 .5.5h4a.5.5 0 0 1 0 1h-4A1.5 1.5 0 0 1 0 14.5v-4a.5.5 0 0 1 .5-.5Zm15 0a.5.5 0 0 1 .5.5v4a1.5 1.5 0 0 1-1.5 1.5h-4a.5.5 0 0 1 0-1h4a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 1 .5-.5Z"/>
          )}
        </svg>
      </button>
    </>
  );

  const fullscreenOverlay = fullscreen ? createPortal(
    <div className="diff-fullscreen-overlay" onClick={closeFullscreen}>
      <div className="diff-fullscreen-container" onClick={e => e.stopPropagation()}>
        <div className="diff-viewer diff-viewer--fullscreen">
          <div className="diff-viewer-header">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="diff-viewer-icon">
              <path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25V1.75Z"/>
            </svg>
            <span className="diff-viewer-filename">{diff.fileName}</span>
            {headerButtons}
          </div>
          <div className="diff-viewer-content diff-viewer-content--fullscreen">
            <DiffContent lines={diff.lines} splitMode={splitMode} splitRows={splitRows} />
          </div>
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <div className="diff-viewer">
        {diff.fileName && (
          <div className="diff-viewer-header">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="diff-viewer-icon">
              <path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25V1.75Z"/>
            </svg>
            <span className="diff-viewer-filename">{diff.fileName}</span>
            {headerButtons}
          </div>
        )}

        <div className="diff-viewer-content">
          <DiffContent lines={diff.lines} splitMode={splitMode} splitRows={splitRows} />
        </div>
      </div>
      {fullscreenOverlay}
    </>
  );
}

export default memo(DiffViewer);
