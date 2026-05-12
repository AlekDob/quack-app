import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { TEXT_DEFAULT_FONT, TEXT_MIN_FONT, TEXT_MAX_FONT, type CanvasText as TextData } from './annotationTypes';

interface Props {
  text: TextData;
  selected?: boolean;
  autoEditOnMount?: boolean;
  onUpdate: (patch: Partial<Omit<TextData, 'id'>>) => void;
  onDelete: () => void;
  onDragStart: (id: string, e: React.PointerEvent) => void;
}

function CanvasTextImpl({ text, selected, autoEditOnMount, onUpdate, onDelete, onDragStart }: Props) {
  const [editing, setEditing] = useState(!!autoEditOnMount);
  const [draft, setDraft] = useState(text.text);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) {
      const el = inputRef.current;
      if (el) {
        el.focus();
        el.select();
      }
    }
  }, [editing]);

  useEffect(() => { setDraft(text.text); }, [text.text]);

  const commit = useCallback(() => {
    if (draft !== text.text) onUpdate({ text: draft });
    setEditing(false);
  }, [draft, text.text, onUpdate]);

  const bumpFont = useCallback((delta: number) => {
    const next = Math.max(TEXT_MIN_FONT, Math.min(TEXT_MAX_FONT, (text.fontSize ?? TEXT_DEFAULT_FONT) + delta));
    onUpdate({ fontSize: next });
  }, [text.fontSize, onUpdate]);

  const fontSize = text.fontSize ?? TEXT_DEFAULT_FONT;

  return (
    <div
      className={`canvas-text ${selected ? 'canvas-text--selected' : ''}`}
      style={{
        position: 'absolute',
        left: text.x,
        top: text.y,
        fontSize,
      }}
      onPointerDown={(e) => {
        if (editing) return;
        onDragStart(text.id, e);
      }}
      onDoubleClick={() => setEditing(true)}
    >
      {editing ? (
        <textarea
          ref={inputRef}
          className="canvas-text__input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { setDraft(text.text); setEditing(false); }
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); }
          }}
          rows={1}
          spellCheck={false}
        />
      ) : (
        <span className="canvas-text__label">{text.text || 'Title'}</span>
      )}
      <div className="canvas-text__actions">
        <button
          type="button"
          className="canvas-text__btn"
          onClick={(e) => { e.stopPropagation(); bumpFont(-2); }}
          title="Smaller"
          aria-label="Decrease font size"
        >A−</button>
        <button
          type="button"
          className="canvas-text__btn"
          onClick={(e) => { e.stopPropagation(); bumpFont(2); }}
          title="Larger"
          aria-label="Increase font size"
        >A+</button>
        <button
          type="button"
          className="canvas-text__btn canvas-text__btn--delete"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="Delete"
          aria-label="Delete title"
        >×</button>
      </div>
    </div>
  );
}

export const CanvasText = memo(CanvasTextImpl);
