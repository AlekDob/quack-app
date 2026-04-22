import { memo, useState } from 'react';
import type { OfficeTag } from './officeTypes';
import { TAG_PALETTE } from './officeConstants';

interface Props {
  tags: OfficeTag[];
  activeTagIds: string[];
  onToggle: (tagId: string) => void;
  onReset?: () => void;
  onAddTag?: (tag: OfficeTag) => void;
  onDeleteTag?: (tagId: string) => void;
}

function genTagId(label: string): string {
  return `tag-${label.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 20)}-${Math.floor(Math.random() * 1e4).toString(36)}`;
}

function OfficeTagFilterImpl({ tags, activeTagIds, onToggle, onReset, onAddTag, onDeleteTag }: Props) {
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState('');
  const [color, setColor] = useState<string>(TAG_PALETTE[0]);

  const submit = () => {
    const trimmed = label.trim();
    if (!trimmed || !onAddTag) { setCreating(false); return; }
    onAddTag({ id: genTagId(trimmed), label: trimmed, color, source: 'manual' });
    setLabel('');
    setColor(TAG_PALETTE[0]);
    setCreating(false);
  };

  return (
    <div className="office-tag-filter">
      <div className="office-tag-filter__pills">
        {tags.map(tag => {
          const active = activeTagIds.includes(tag.id);
          return (
            <span key={tag.id} className="office-tag-filter__pill-wrap">
              <button
                type="button"
                className={`office-tag-filter__pill ${active ? 'office-tag-filter__pill--active' : ''}`}
                style={{ '--tag-color': tag.color } as React.CSSProperties}
                onClick={() => onToggle(tag.id)}
              >
                {tag.label}
              </button>
              {onDeleteTag && (
                <button
                  type="button"
                  className="office-tag-filter__remove"
                  onClick={() => onDeleteTag(tag.id)}
                  title={`Delete tag "${tag.label}"`}
                >×</button>
              )}
            </span>
          );
        })}

        {onAddTag && !creating && (
          <button
            type="button"
            className="office-tag-filter__add"
            onClick={() => setCreating(true)}
            title="Create new tag"
          >+</button>
        )}

        {creating && (
          <span className="office-tag-filter__create">
            <input
              autoFocus
              className="office-tag-filter__input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
                if (e.key === 'Escape') { setCreating(false); setLabel(''); }
              }}
              placeholder="Tag name"
              maxLength={20}
            />
            <span className="office-tag-filter__palette">
              {TAG_PALETTE.map(c => (
                <button
                  key={c}
                  type="button"
                  className={`office-tag-filter__swatch ${color === c ? 'office-tag-filter__swatch--active' : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </span>
            <button type="button" className="office-tag-filter__confirm" onClick={submit}>Create</button>
            <button type="button" className="office-tag-filter__cancel" onClick={() => { setCreating(false); setLabel(''); }}>×</button>
          </span>
        )}
      </div>
      {onReset && (
        <button
          type="button"
          className="office-tag-filter__reset"
          onClick={onReset}
          title="Reset layout"
        >
          Reset layout
        </button>
      )}
    </div>
  );
}

export const OfficeTagFilter = memo(OfficeTagFilterImpl);
