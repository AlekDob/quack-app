/**
 * Feature Map — Markdown Preview Card (HTML overlay, NOT SVG foreignObject)
 *
 * WebKit has a known bug where SVG <foreignObject> inside a transformed <g>
 * clips children incorrectly (content bleeds outside the card). This component
 * renders as an absolute-positioned HTML div inside an overlay layer that
 * mirrors the SVG pan/zoom via a CSS transform on the parent wrapper — the
 * same pattern used by React Flow and Excalidraw.
 *
 * UX: inline cards open in EDIT mode by default (textarea visible). Toggle
 * edit/preview via header button. File-backed cards render preview-only;
 * double-click opens the source file in the Code Editor tab.
 */

import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { MdCard } from './annotationTypes';
import { MD_CARD_MIN_W, MD_CARD_MIN_H, MD_CARD_COLLAPSED_H } from './annotationTypes';
import MarkdownText from '../MarkdownText';
import { normalizeToForwardSlash } from '../../utils/platform';

const DRAG_T = 4;
const FILE_POLL_MS = 2000;

interface Props {
  card: MdCard;
  zoom: number;
  projectPath: string;
  isSelected: boolean;
  isMultiSelected?: boolean;
  onUpdate: (id: string, partial: Partial<MdCard>) => void;
  onRemove: (id: string) => void;
  onSelect: (id: string | null) => void;
  onMultiToggle?: (id: string) => void;
  onGroupDragStart?: (clientX: number, clientY: number) => void;
  onBeginDrag?: () => void;
  onEndDrag?: () => void;
  onOpenFile?: (filePath: string) => void;
  /** Called when header is mousedown — signals canvas to track drag-assign */
  onAnnotationDragStart?: (id: string) => void;
  /** Called when drag ends — signals canvas to finalize drop */
  onAnnotationDragEnd?: (id: string) => void;
}

type DragRef = { sx: number; sy: number; ox: number; oy: number; did: boolean } | null;
type ResizeRef = { sx: number; sy: number; ow: number; oh: number } | null;

function extractTitle(content: string): string | null {
  const h1 = content.match(/^#\s+(.+)$/m);
  if (h1) return h1[1].trim();
  const firstLine = content.split('\n').find(l => l.trim().length > 0);
  return firstLine ? firstLine.replace(/^#+\s*/, '').slice(0, 60) : null;
}

function useCardContent(card: MdCard, projectPath: string) {
  const [loaded, setLoaded] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const lastContent = useRef('');

  useEffect(() => {
    if (card.content !== undefined && !card.filePath) {
      setLoaded(card.content);
      setError(null);
      return;
    }
    if (!card.filePath) { setLoaded(''); return; }

    const norm = normalizeToForwardSlash(projectPath);
    const abs = `${norm}/${card.filePath.replace(/^\//, '')}`;
    let alive = true;

    const load = async () => {
      try {
        const raw = await invoke<string>('read_file_content', { path: abs });
        if (!alive) return;
        if (raw !== lastContent.current) {
          lastContent.current = raw;
          setLoaded(raw);
          setError(null);
        }
      } catch {
        if (!alive) return;
        setError(`File not found: ${card.filePath}`);
        setLoaded('');
      }
    };

    void load();
    const timer = setInterval(load, FILE_POLL_MS);
    return () => { alive = false; clearInterval(timer); };
  }, [card.content, card.filePath, projectPath]);

  return { content: loaded, error };
}

export default function CanvasMdCard({
  card, zoom, projectPath, isSelected, isMultiSelected,
  onUpdate, onRemove, onSelect, onMultiToggle, onGroupDragStart,
  onBeginDrag, onEndDrag, onOpenFile,
  onAnnotationDragStart, onAnnotationDragEnd,
}: Props) {
  const isInline = card.content !== undefined && !card.filePath;
  const [editing, setEditing] = useState<boolean>(isInline);
  const dragRef = useRef<DragRef>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { content: rawContent, error: fileError } = useCardContent(card, projectPath);

  const displayContent = useMemo(() => {
    if (card.filePath?.endsWith('.mmd')) {
      return '```mermaid\n' + (rawContent || '') + '\n```';
    }
    return rawContent;
  }, [rawContent, card.filePath]);

  const displayTitle = useMemo(() => {
    if (card.title) return card.title;
    if (card.filePath) return card.filePath.split('/').pop() ?? card.filePath;
    return extractTitle(rawContent) ?? 'Untitled';
  }, [card.title, card.filePath, rawContent]);

  useEffect(() => {
    if (editing && isInline) {
      const t = setTimeout(() => textareaRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [editing, isInline]);

  // --- Drag (header) — window-level listeners, coords in client space / zoom ---
  const handleHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    if (e.shiftKey && onMultiToggle) { onMultiToggle(card.id); return; }
    if (isMultiSelected && onGroupDragStart) { onGroupDragStart(e.clientX, e.clientY); return; }

    onBeginDrag?.();
    onAnnotationDragStart?.(card.id);
    onSelect(card.id);
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: card.x, oy: card.y, did: false };

    const onMove = (ev: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = ev.clientX - d.sx;
      const dy = ev.clientY - d.sy;
      if (Math.abs(dx) > DRAG_T || Math.abs(dy) > DRAG_T) d.did = true;
      if (d.did) onUpdate(card.id, { x: d.ox + dx / zoom, y: d.oy + dy / zoom });
    };
    const onUp = () => {
      const d = dragRef.current;
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (d?.did) onEndDrag?.();
      onAnnotationDragEnd?.(card.id);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [card.id, card.x, card.y, zoom, isMultiSelected, onMultiToggle, onGroupDragStart,
    onBeginDrag, onEndDrag, onSelect, onUpdate, onAnnotationDragStart, onAnnotationDragEnd]);

  // --- Resize (bottom-right corner) ---
  const handleResizeDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    const r: ResizeRef = { sx: e.clientX, sy: e.clientY, ow: card.w, oh: card.h };
    onBeginDrag?.();

    const onMove = (ev: MouseEvent) => {
      if (!r) return;
      const dw = (ev.clientX - r.sx) / zoom;
      const dh = (ev.clientY - r.sy) / zoom;
      onUpdate(card.id, {
        w: Math.max(MD_CARD_MIN_W, r.ow + dw),
        h: Math.max(MD_CARD_MIN_H, r.oh + dh),
      });
    };
    const onUp = () => {
      onEndDrag?.();
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [card.id, card.w, card.h, zoom, onUpdate, onBeginDrag, onEndDrag]);

  // --- Editing ---
  const handlePreviewDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (card.filePath && onOpenFile) { onOpenFile(card.filePath); return; }
    if (isInline) setEditing(true);
  }, [card.filePath, isInline, onOpenFile]);

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onUpdate(card.id, { content: e.target.value });
  }, [card.id, onUpdate]);

  const toggleEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isInline) return;
    setEditing(v => !v);
  }, [isInline]);

  const toggleCollapsed = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdate(card.id, { collapsed: !card.collapsed });
  }, [card.id, card.collapsed, onUpdate]);

  const handleOpenSource = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (card.filePath && onOpenFile) onOpenFile(card.filePath);
  }, [card.filePath, onOpenFile]);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove(card.id);
  }, [card.id, onRemove]);

  const { w, h, x, y, collapsed } = card;
  const displayH = collapsed ? MD_CARD_COLLAPSED_H : h;

  const rootClassNames = [
    'fm-md-card',
    isSelected ? 'is-selected' : '',
    isMultiSelected ? 'is-multi-selected' : '',
    collapsed ? 'is-collapsed' : '',
  ].filter(Boolean).join(' ');

  const Icon = () => {
    if (card.filePath) {
      if (card.filePath.endsWith('.mmd')) {
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="5" r="2" /><circle cx="5" cy="19" r="2" /><circle cx="19" cy="19" r="2" />
            <path d="M12 7v10M7 19h10" />
          </svg>
        );
      }
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      );
    }
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16v16H4z" /><path d="M8 8h8M8 12h8M8 16h5" />
      </svg>
    );
  };

  return (
    <div
      className={rootClassNames}
      style={{ left: x, top: y, width: w, height: displayH }}
      onMouseDown={(e) => { e.stopPropagation(); onSelect(card.id); }}
    >
      {/* Header — draggable */}
      <div
        className="fm-md-card-header"
        onMouseDown={handleHeaderMouseDown}
      >
        <span className="fm-md-card-header-icon"><Icon /></span>
        <span className="fm-md-card-header-title">{displayTitle}</span>
        <span className="fm-md-card-header-spacer" />

        {isInline && (
          <button
            type="button"
            className="fm-md-card-header-btn"
            title={editing ? 'Preview' : 'Edit'}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={toggleEdit}
          >
            {editing ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            )}
          </button>
        )}

        {!isInline && card.filePath && (
          <button
            type="button"
            className="fm-md-card-header-btn"
            title="Open in editor"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={handleOpenSource}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </button>
        )}

        <button
          type="button"
          className="fm-md-card-header-btn"
          title={collapsed ? 'Expand' : 'Collapse'}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={toggleCollapsed}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {collapsed ? <polyline points="6 9 12 15 18 9" /> : <polyline points="18 15 12 9 6 15" />}
          </svg>
        </button>

        <button
          type="button"
          className="fm-md-card-header-btn fm-md-card-header-btn-danger"
          title="Delete"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={handleDelete}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Body (hidden when collapsed) */}
      {!collapsed && (
        <div className="fm-md-card-body">
          {fileError ? (
            <div className="fm-md-card-error">
              <div className="fm-md-card-error-icon">!</div>
              <div className="fm-md-card-error-text">{fileError}</div>
              <div className="fm-md-card-error-hint">Check the file path.</div>
            </div>
          ) : editing && isInline ? (
            <textarea
              ref={textareaRef}
              value={card.content ?? ''}
              onChange={handleTextChange}
              className="fm-md-card-editor"
              placeholder={'# Title\n\nWrite markdown here… use ```mermaid``` blocks for diagrams, tables, code, lists.'}
              spellCheck={false}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              onWheel={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            />
          ) : (
            <div
              className="fm-md-card-content"
              onDoubleClick={handlePreviewDoubleClick}
              onMouseDown={(e) => e.stopPropagation()}
              onWheel={(e) => e.stopPropagation()}
            >
              <MarkdownText>{displayContent || (isInline ? '_Empty card — click the pencil icon to edit._' : '')}</MarkdownText>
            </div>
          )}

          {/* Resize handle */}
          <div
            className="fm-md-card-resize"
            onMouseDown={handleResizeDown}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M22 2L2 22M22 10L10 22M22 18L18 22" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}
