import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { OfficeLayout, Viewport } from './officeTypes';
import { OfficeZone } from './OfficeZone';
import { OfficeBreakRoom } from './OfficeBreakRoom';
import { OfficeRoomCard } from './OfficeRoomCard';
import { useOfficeDrag } from './useOfficeDrag';
import { projectNameFromPath } from './officeLayout';
import type { TerminalInfo } from '../../../types';
import type { DuckViewModel } from './OfficeRoomCard';

interface Props {
  layout: OfficeLayout;
  terminals: TerminalInfo[];
  ducksByProject: Map<string, DuckViewModel[]>;
  doorPlateColorByProject: Map<string, string>;
  busyRatioByProject: Map<string, number>;
  countsByProject: Map<string, { busy: number; idle: number; dormant: number }>;
  onRoomMoved: (projectPath: string, x: number, y: number, zoneId: string | undefined) => void;
  onZoneMoved: (zoneId: string, x: number, y: number) => void;
  onBreakRoomMoved: (x: number, y: number) => void;
  onDuckClick: (agentId: string, e: React.MouseEvent) => void;
  onCardDoubleClick: (projectPath: string) => void;
}

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2;

function OfficeCanvasImpl(props: Props) {
  const { layout, terminals, ducksByProject, doorPlateColorByProject, busyRatioByProject, countsByProject } = props;
  const [viewport, setViewport] = useState<Viewport>({ zoom: 1, panX: 0, panY: 0 });
  const [panning, setPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  const drag = useOfficeDrag(viewport, layout.zones, {
    onCardMove: (projectPath, x, y) => {
      props.onRoomMoved(projectPath, x, y, undefined);
    },
    onZoneMove: (zoneId, x, y) => props.onZoneMoved(zoneId, x, y),
    onCardDrop: (projectPath, x, y, zoneId) => props.onRoomMoved(projectPath, x, y, zoneId),
  });

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    setViewport(v => ({ ...v, zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.zoom + delta)) }));
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button === 1) {
      setPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY, panX: viewport.panX, panY: viewport.panY };
    }
  }, [viewport.panX, viewport.panY]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (panning && panStartRef.current) {
      setViewport(v => ({
        ...v,
        panX: panStartRef.current!.panX + (e.clientX - panStartRef.current!.x),
        panY: panStartRef.current!.panY + (e.clientY - panStartRef.current!.y),
      }));
    } else {
      drag.onPointerMove(e);
    }
  }, [panning, drag]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    setPanning(false);
    panStartRef.current = null;
    drag.onPointerUp(e);
  }, [drag]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '1') {
        e.preventDefault();
        setViewport({ zoom: 0.8, panX: 50, panY: 50 });
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '0') {
        e.preventDefault();
        setViewport({ zoom: 1, panX: 0, panY: 0 });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const activeTagIds = layout.activeTagIds;
  const hoverZoneId = drag.drag?.kind === 'card' ? drag.drag.hoverZoneId : undefined;

  const terminalsByPath = useMemo(() => {
    const map = new Map<string, TerminalInfo[]>();
    for (const t of terminals) {
      const arr = map.get(t.cwd) ?? [];
      arr.push(t);
      map.set(t.cwd, arr);
    }
    return map;
  }, [terminals]);

  return (
    <div
      className="office-canvas"
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{ cursor: panning ? 'grabbing' : 'default' }}
    >
      <svg className="office-canvas__svg">
        <g transform={`translate(${viewport.panX}, ${viewport.panY}) scale(${viewport.zoom})`}>
          {layout.zones.map(z => (
            <OfficeZone
              key={z.id}
              zone={z}
              hoverTarget={hoverZoneId === z.id}
              onLabelPointerDown={(zoneId, e) => drag.startZoneDrag(zoneId, z.x, z.y, e)}
            />
          ))}
          <OfficeBreakRoom x={layout.breakRoom.x} y={layout.breakRoom.y} />
        </g>
      </svg>

      <div
        className="office-canvas__cards"
        style={{ transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`, transformOrigin: '0 0' }}
      >
        {layout.rooms.map(card => {
          const projectTerminals = terminalsByPath.get(card.projectPath) ?? [];
          if (projectTerminals.length === 0) return null;
          const ducks = ducksByProject.get(card.projectPath) ?? [];
          const dimmed = activeTagIds.length > 0 && !card.tagIds.some(id => activeTagIds.includes(id));
          const branch = projectTerminals.find(t => t.branch)?.branch;
          return (
            <OfficeRoomCard
              key={card.projectPath}
              card={card}
              projectName={projectNameFromPath(card.projectPath)}
              branch={branch}
              ducks={ducks}
              doorPlateColor={doorPlateColorByProject.get(card.projectPath) ?? '#6b7280'}
              busyRatio={busyRatioByProject.get(card.projectPath) ?? 0}
              counts={countsByProject.get(card.projectPath) ?? { busy: 0, idle: 0, dormant: 0 }}
              tags={layout.tags}
              dimmed={dimmed}
              onDragStart={(projectPath, e) => drag.startCardDrag(projectPath, card.x, card.y, e)}
              onDoubleClick={props.onCardDoubleClick}
              onDuckClick={props.onDuckClick}
            />
          );
        })}
      </div>
    </div>
  );
}

export const OfficeCanvas = memo(OfficeCanvasImpl);
