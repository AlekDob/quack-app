import { memo, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { OfficeTag } from './officeTypes';
import { TAG_PALETTE } from './officeConstants';

export interface RoomContextTarget {
  projectPath: string;
  screenX: number;
  screenY: number;
}

interface Props {
  target: RoomContextTarget;
  tags: OfficeTag[];
  assignedTagIds: string[];
  onToggleTag: (tagId: string) => void;
  onCreateTag: (tag: OfficeTag) => void;
  onClose: () => void;
}

function genTagId(label: string): string {
  return `tag-${label.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 20)}-${Math.floor(Math.random() * 1e4).toString(36)}`;
}

function OfficeRoomContextMenuImpl({ target, tags, assignedTagIds, onToggleTag, onCreateTag, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState('');
  const [color, setColor] = useState(TAG_PALETTE[0]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', esc);
    };
  }, [onClose]);

  const submitNew = () => {
    const trimmed = label.trim();
    if (!trimmed) { setCreating(false); return; }
    const newTag: OfficeTag = { id: genTagId(trimmed), label: trimmed, color, source: 'manual' };
    onCreateTag(newTag);
    onToggleTag(newTag.id);
    setCreating(false);
    setLabel('');
  };

  return createPortal(
    <div
      ref={menuRef}
      className="office-room-context-menu"
      style={{ left: target.screenX, top: target.screenY }}
    >
      <div className="office-room-context-menu__header">Assign tags</div>

      {tags.length === 0 && <div className="office-room-context-menu__empty">No tags yet. Create one below.</div>}

      <div className="office-room-context-menu__list">
        {tags.map(t => {
          const on = assignedTagIds.includes(t.id);
          return (
            <button
              key={t.id}
              type="button"
              className="office-room-context-menu__item"
              onClick={() => onToggleTag(t.id)}
            >
              <span className="office-room-context-menu__checkbox" aria-checked={on}>
                {on ? '✓' : ''}
              </span>
              <span className="office-room-context-menu__dot" style={{ background: t.color }} />
              <span className="office-room-context-menu__label">{t.label}</span>
            </button>
          );
        })}
      </div>

      <div className="office-room-context-menu__divider" />

      {!creating ? (
        <button type="button" className="office-room-context-menu__create-btn" onClick={() => setCreating(true)}>
          + New tag
        </button>
      ) : (
        <div className="office-room-context-menu__create">
          <input
            autoFocus
            className="office-room-context-menu__input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitNew();
              if (e.key === 'Escape') { setCreating(false); setLabel(''); }
            }}
            placeholder="Tag name"
            maxLength={20}
          />
          <div className="office-room-context-menu__palette">
            {TAG_PALETTE.map(c => (
              <button
                key={c}
                type="button"
                className={`office-room-context-menu__swatch ${color === c ? 'office-room-context-menu__swatch--active' : ''}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
          <div className="office-room-context-menu__actions">
            <button type="button" className="office-room-context-menu__confirm" onClick={submitNew}>Create &amp; assign</button>
            <button type="button" className="office-room-context-menu__cancel" onClick={() => { setCreating(false); setLabel(''); }}>Cancel</button>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}

export const OfficeRoomContextMenu = memo(OfficeRoomContextMenuImpl);
