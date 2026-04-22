import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { POSTIT_COLORS } from './officeConstants';
import type { OfficePostIt as PostItData } from './officeTypes';

interface Props {
  postIt: PostItData;
  selected?: boolean;
  onUpdate: (patch: Partial<Omit<PostItData, 'id'>>) => void;
  onDelete: () => void;
  onDragStart: (id: string, e: React.PointerEvent) => void;
}

function OfficePostItImpl({ postIt, selected, onUpdate, onDelete, onDragStart }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(postIt.text);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) textareaRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    setDraft(postIt.text);
  }, [postIt.text]);

  const commit = useCallback(() => {
    if (draft !== postIt.text) onUpdate({ text: draft });
    setEditing(false);
  }, [draft, postIt.text, onUpdate]);

  const cycleColor = useCallback(() => {
    const idx = POSTIT_COLORS.indexOf(postIt.color);
    const next = POSTIT_COLORS[(idx + 1) % POSTIT_COLORS.length];
    onUpdate({ color: next });
  }, [postIt.color, onUpdate]);

  return (
    <div
      className={`office-postit ${selected ? 'office-postit--selected' : ''}`}
      style={{
        width: postIt.w,
        height: postIt.h,
        transform: `translate(${postIt.x}px, ${postIt.y}px)`,
        background: postIt.color,
      }}
    >
      <div
        className="office-postit__drag"
        onPointerDown={(e) => { if (!editing) onDragStart(postIt.id, e); }}
        onDoubleClick={() => setEditing(true)}
      />
      {editing ? (
        <textarea
          ref={textareaRef}
          className="office-postit__textarea"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { setDraft(postIt.text); setEditing(false); }
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) commit();
          }}
        />
      ) : (
        <div className="office-postit__text" onDoubleClick={() => setEditing(true)}>
          {postIt.text || <span className="office-postit__placeholder">double-click to edit</span>}
        </div>
      )}
      <div className="office-postit__actions">
        <button type="button" className="office-postit__color" onClick={cycleColor} title="Cycle color" />
        <button type="button" className="office-postit__delete" onClick={onDelete} title="Delete">×</button>
      </div>
    </div>
  );
}

export const OfficePostIt = memo(OfficePostItImpl);
