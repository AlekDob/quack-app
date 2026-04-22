import { memo, useState } from 'react';
import type { OfficeSticker as StickerData } from './officeTypes';
import { getStickerDef } from './officeStickerCatalog';

interface Props {
  sticker: StickerData;
  selected?: boolean;
  onDragStart: (id: string, e: React.PointerEvent) => void;
  onResizeStart: (id: string, e: React.PointerEvent) => void;
  onRotateStart: (id: string, e: React.PointerEvent) => void;
  onDelete: () => void;
}

function OfficeStickerImpl({ sticker, selected, onDragStart, onResizeStart, onRotateStart, onDelete }: Props) {
  const def = getStickerDef(sticker.kind);
  const [hovered, setHovered] = useState(false);
  if (!def) return null;

  const cx = sticker.x + sticker.w / 2;
  const cy = sticker.y + sticker.h / 2;
  const scaleX = sticker.w / (def.defaultW * 2);
  const scaleY = sticker.h / (def.defaultH * 2);
  const scale = Math.min(scaleX, scaleY);

  return (
    <g
      className={`office-sticker ${selected ? 'office-sticker--selected' : ''}`}
      transform={`translate(${cx}, ${cy}) rotate(${sticker.rot})`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {selected && (
        <rect
          x={-sticker.w / 2 - 3}
          y={-sticker.h / 2 - 3}
          width={sticker.w + 6}
          height={sticker.h + 6}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          rx={3}
          pointerEvents="none"
        />
      )}
      <rect
        x={-sticker.w / 2}
        y={-sticker.h / 2}
        width={sticker.w}
        height={sticker.h}
        fill="transparent"
        onPointerDown={(e) => onDragStart(sticker.id, e)}
        style={{ cursor: 'move' }}
      />
      <g transform={`scale(${scale})`} pointerEvents="none">
        {def.render()}
      </g>

      {hovered && (
        <>
          <g
            className="office-sticker__delete"
            transform={`translate(${sticker.w / 2 - 8}, ${-sticker.h / 2 + 8})`}
            onClick={onDelete}
          >
            <circle r={7} fill="#dc2626" />
            <path d="M-3,-3 L3,3 M3,-3 L-3,3" stroke="#fff" strokeWidth={1.5} strokeLinecap="round" />
          </g>

          <circle
            cx={sticker.w / 2}
            cy={sticker.h / 2}
            r={5}
            className="office-sticker__resize"
            onPointerDown={(e) => onResizeStart(sticker.id, e)}
          />

          <g transform={`translate(0, ${-sticker.h / 2 - 14})`} onPointerDown={(e) => onRotateStart(sticker.id, e)}>
            <line x1="0" y1={sticker.h / 2 - 14} x2="0" y2="0" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
            <circle r={5} className="office-sticker__rotate" />
          </g>
        </>
      )}
    </g>
  );
}

export const OfficeSticker = memo(OfficeStickerImpl);
