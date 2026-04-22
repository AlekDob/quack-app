import { memo } from 'react';
import type { OfficeTag } from './officeTypes';

interface Props {
  tags: OfficeTag[];
  activeTagIds: string[];
  onToggle: (tagId: string) => void;
  onReset?: () => void;
}

function OfficeTagFilterImpl({ tags, activeTagIds, onToggle, onReset }: Props) {
  if (tags.length === 0) return null;
  return (
    <div className="office-tag-filter">
      <div className="office-tag-filter__pills">
        {tags.map(tag => {
          const active = activeTagIds.includes(tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              className={`office-tag-filter__pill ${active ? 'office-tag-filter__pill--active' : ''}`}
              style={{ '--tag-color': tag.color } as React.CSSProperties}
              onClick={() => onToggle(tag.id)}
            >
              {tag.label}
            </button>
          );
        })}
      </div>
      {onReset && (
        <button
          type="button"
          className="office-tag-filter__reset"
          onClick={onReset}
          title="Reset layout: re-pack all projects into their matching zones"
        >
          Reset layout
        </button>
      )}
    </div>
  );
}

export const OfficeTagFilter = memo(OfficeTagFilterImpl);
