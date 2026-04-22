import { memo } from 'react';
import type { OfficeTag } from './officeTypes';

interface Props {
  tags: OfficeTag[];
  activeTagIds: string[];
  onToggle: (tagId: string) => void;
}

function OfficeTagFilterImpl({ tags, activeTagIds, onToggle }: Props) {
  if (tags.length === 0) return null;
  return (
    <div className="office-tag-filter">
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
  );
}

export const OfficeTagFilter = memo(OfficeTagFilterImpl);
