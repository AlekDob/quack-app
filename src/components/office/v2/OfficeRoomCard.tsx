import { memo } from 'react';
import type { OfficeRoomCard as RoomCardData, OfficeTag } from './officeTypes';
import { CARD_DEFAULT_W, CARD_DEFAULT_H } from './officeConstants';
import { OfficeDuckAvatar, type DuckStatus } from './OfficeDuckAvatar';

export interface DuckViewModel {
  agentId: string;
  color: string;
  avatarUrl?: string;
  initial: string;
  status: DuckStatus;
  sessionDots: Array<{ awaiting: boolean; working: boolean; ready: boolean }>;
}

interface Props {
  card: RoomCardData;
  projectName: string;
  branch?: string;
  ducks: DuckViewModel[];
  doorPlateColor: string;
  busyRatio: number;
  counts: { busy: number; idle: number; dormant: number };
  tags: OfficeTag[];
  dimmed: boolean;
  selected?: boolean;
  onDragStart?: (projectPath: string, e: React.PointerEvent) => void;
  onDoubleClick?: (projectPath: string) => void;
  onCardClick?: (projectPath: string) => void;
  onDuckClick?: (agentId: string, e: React.MouseEvent) => void;
  onContextMenu?: (projectPath: string, e: React.MouseEvent) => void;
}

const MAX_VISIBLE = 5;

function OfficeRoomCardImpl({
  card, projectName, branch, ducks, doorPlateColor, busyRatio, counts, tags, dimmed, selected,
  onDragStart, onDoubleClick, onCardClick, onDuckClick, onContextMenu,
}: Props) {
  const w = card.w ?? CARD_DEFAULT_W;
  const h = card.h ?? CARD_DEFAULT_H;
  const visibleDucks = ducks.slice(0, MAX_VISIBLE);
  const overflow = ducks.length - visibleDucks.length;
  const relevantTags = tags.filter(t => card.tagIds.includes(t.id));

  return (
    <div
      className={`office-room-card ${dimmed ? 'office-room-card--dimmed' : ''} ${selected ? 'office-room-card--selected' : ''} ${counts.busy > 0 ? 'office-room-card--working' : ''}`}
      style={{
        width: w,
        height: h,
        transform: `translate(${card.x}px, ${card.y}px)`,
      }}
      onClick={() => onCardClick?.(card.projectPath)}
      onDoubleClick={() => onDoubleClick?.(card.projectPath)}
      onContextMenu={(e) => {
        if (!onContextMenu) return;
        e.preventDefault();
        e.stopPropagation();
        onContextMenu(card.projectPath, e);
      }}
    >
      <div
        className="office-room-card__plate"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => onDragStart?.(card.projectPath, e)}
      >
        <span className="office-room-card__status-dot" style={{ background: doorPlateColor }} />
        <span className="office-room-card__name">{projectName}</span>
      </div>

      <div className="office-room-card__body">
        <div className="office-room-card__meta">
          {relevantTags.map(t => (
            <span key={t.id} className="office-room-card__tag" style={{ background: t.color }}>{t.label}</span>
          ))}
          <span className="office-room-card__branch">{branch ?? 'main'}</span>
        </div>

        <div className="office-room-card__ducks">
          {visibleDucks.map(d => (
            <OfficeDuckAvatar key={d.agentId} {...d} onClick={onDuckClick} />
          ))}
          {overflow > 0 && <span className="office-room-card__overflow">+{overflow}</span>}
        </div>

        <div className="office-room-card__counts">
          <span style={{ color: '#F7931E' }}>● {counts.busy}</span>
          <span style={{ color: '#22c55e' }}>● {counts.idle}</span>
          <span style={{ color: 'rgba(255,255,255,0.35)' }}>● {counts.dormant}</span>
        </div>

        <div className="office-room-card__activity">
          <div className="office-room-card__activity-fill" style={{ width: `${Math.round(busyRatio * 100)}%` }} />
        </div>
      </div>

      <div className="office-room-card__wall office-room-card__wall--bl" aria-hidden />
      <div className="office-room-card__wall office-room-card__wall--br" aria-hidden />
    </div>
  );
}

export const OfficeRoomCard = memo(OfficeRoomCardImpl);
