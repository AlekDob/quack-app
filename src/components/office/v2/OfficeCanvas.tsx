import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  OfficeLayout,
  Viewport,
  OfficeCustomGroup as GroupData,
  OfficePostIt as PostItData,
  OfficeSticker as StickerData,
} from './officeTypes';
import { OfficeRoomCard } from './OfficeRoomCard';
import { OfficePostIt } from './OfficePostIt';
import { OfficeCustomGroup } from './OfficeCustomGroup';
import { OfficeSticker } from './OfficeSticker';
import { projectNameFromPath } from './officeLayout';
import { GROUP_MIN_W, GROUP_MIN_H, POSTIT_DEFAULT_W, POSTIT_DEFAULT_H, POSTIT_COLORS, GROUP_DEFAULT_COLOR, STICKER_MIN_SIZE, CARD_DEFAULT_W, CARD_DEFAULT_H } from './officeConstants';
import { getStickerDef } from './officeStickerCatalog';
import type { TerminalInfo } from '../../../types';
import type { DuckViewModel } from './OfficeRoomCard';
import type { OfficeMode } from './OfficeToolbar';

interface Props {
  layout: OfficeLayout;
  terminals: TerminalInfo[];
  ducksByProject: Map<string, DuckViewModel[]>;
  doorPlateColorByProject: Map<string, string>;
  busyRatioByProject: Map<string, number>;
  countsByProject: Map<string, { busy: number; idle: number; dormant: number }>;

  mode: OfficeMode;
  activeSticker: string | null;
  onModeReset: () => void;
  onPopulate: () => void;

  selectedIds: Set<string>;
  onSelectedIds: (next: Set<string>) => void;

  onRoomMoved: (projectPath: string, x: number, y: number) => void;
  onDuckClick: (agentId: string, e: React.MouseEvent) => void;
  onCardDoubleClick: (projectPath: string) => void;
  onRoomContextMenu: (projectPath: string, e: React.MouseEvent) => void;

  onAddPostIt: (p: PostItData) => void;
  onUpdatePostIt: (id: string, patch: Partial<Omit<PostItData, 'id'>>) => void;
  onDeletePostIt: (id: string) => void;

  onAddGroup: (g: GroupData) => void;
  onUpdateGroup: (id: string, patch: Partial<Omit<GroupData, 'id'>>) => void;
  onDeleteGroup: (id: string) => void;

  onAddSticker: (s: StickerData) => void;
  onUpdateSticker: (id: string, patch: Partial<Omit<StickerData, 'id'>>) => void;
  onDeleteSticker: (id: string) => void;

  onBeginDrag: () => void;
  onEndDrag: () => void;
}

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2;

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

type GroupChild =
  | { kind: 'room'; projectPath: string; startX: number; startY: number }
  | { kind: 'postit'; id: string; startX: number; startY: number }
  | { kind: 'sticker'; id: string; startX: number; startY: number }
  | { kind: 'group'; id: string; startX: number; startY: number };

type AnnotationInteraction =
  | { kind: 'room-move'; projectPath: string; startX: number; startY: number; startPX: number; startPY: number; siblings: GroupChild[] }
  | { kind: 'postit-move'; id: string; startX: number; startY: number; startPX: number; startPY: number; siblings: GroupChild[] }
  | { kind: 'group-move'; id: string; startX: number; startY: number; startPX: number; startPY: number; children: GroupChild[] }
  | { kind: 'group-resize'; id: string; corner: 'nw' | 'ne' | 'sw' | 'se'; startX: number; startY: number; startW: number; startH: number; startPX: number; startPY: number }
  | { kind: 'sticker-move'; id: string; startX: number; startY: number; startPX: number; startPY: number; siblings: GroupChild[] }
  | { kind: 'sticker-resize'; id: string; startW: number; startH: number; startPX: number; startPY: number }
  | { kind: 'sticker-rotate'; id: string; centerX: number; centerY: number; startRot: number; startAngle: number };

type LassoState = {
  startCanvasX: number;
  startCanvasY: number;
  currentCanvasX: number;
  currentCanvasY: number;
};

export function selectionKey(kind: 'room' | 'postit' | 'sticker' | 'group', id: string): string {
  return `${kind}:${id}`;
}

type GroupCreationState = {
  startCanvasX: number;
  startCanvasY: number;
  currentCanvasX: number;
  currentCanvasY: number;
};

function OfficeCanvasImpl(props: Props) {
  const { layout, terminals, ducksByProject, doorPlateColorByProject, busyRatioByProject, countsByProject, mode, activeSticker } = props;

  const [viewport, setViewport] = useState<Viewport>({ zoom: 1, panX: 0, panY: 0 });
  const [panning, setPanning] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [groupCreation, setGroupCreation] = useState<GroupCreationState | null>(null);
  const [lasso, setLasso] = useState<LassoState | null>(null);

  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const annotRef = useRef<AnnotationInteraction | null>(null);
  const hasAutoFitRef = useRef(false);

  const screenToCanvas = useCallback((clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const ox = rect?.left ?? 0;
    const oy = rect?.top ?? 0;
    return {
      x: (clientX - ox - viewport.panX) / viewport.zoom,
      y: (clientY - oy - viewport.panY) / viewport.zoom,
    };
  }, [viewport.panX, viewport.panY, viewport.zoom]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    setViewport(v => ({ ...v, zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.zoom + delta)) }));
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    // Middle-click or space+drag = pan
    if (e.button === 1 || (spaceHeld && e.button === 0)) {
      e.preventDefault();
      setPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY, panX: viewport.panX, panY: viewport.panY };
      return;
    }

    if (e.button !== 0) return;

    // Create-on-click for modes
    const target = e.target as HTMLElement;
    const clickedCanvasBackground = target.tagName === 'svg' || target === containerRef.current || target.classList.contains('office-canvas__cards');

    if (!clickedCanvasBackground) return;

    const pt = screenToCanvas(e.clientX, e.clientY);

    if (mode === 'postit') {
      props.onAddPostIt({
        id: genId('p'),
        x: pt.x - POSTIT_DEFAULT_W / 2,
        y: pt.y - POSTIT_DEFAULT_H / 2,
        w: POSTIT_DEFAULT_W,
        h: POSTIT_DEFAULT_H,
        text: '',
        color: POSTIT_COLORS[0],
      });
      props.onModeReset();
      return;
    }

    if (mode === 'sticker' && activeSticker) {
      const def = getStickerDef(activeSticker);
      if (!def) return;
      props.onAddSticker({
        id: genId('s'),
        x: pt.x - def.defaultW / 2,
        y: pt.y - def.defaultH / 2,
        w: def.defaultW,
        h: def.defaultH,
        rot: 0,
        kind: activeSticker,
      });
      // stay in sticker mode so the user can drop multiple; Esc to exit
      return;
    }

    if (mode === 'group') {
      setGroupCreation({ startCanvasX: pt.x, startCanvasY: pt.y, currentCanvasX: pt.x, currentCanvasY: pt.y });
      e.preventDefault();
      return;
    }

    if (mode === 'lasso') {
      setLasso({ startCanvasX: pt.x, startCanvasY: pt.y, currentCanvasX: pt.x, currentCanvasY: pt.y });
      e.preventDefault();
      return;
    }
  }, [spaceHeld, viewport.panX, viewport.panY, mode, activeSticker, screenToCanvas, props]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (panning && panStartRef.current) {
      // Brain: fix-office-canvas-pointermove-ref-race
      const start = panStartRef.current;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      setViewport(v => ({
        ...v,
        panX: start.panX + dx,
        panY: start.panY + dy,
      }));
      return;
    }

    if (groupCreation) {
      const pt = screenToCanvas(e.clientX, e.clientY);
      setGroupCreation({ ...groupCreation, currentCanvasX: pt.x, currentCanvasY: pt.y });
      return;
    }

    if (lasso) {
      const pt = screenToCanvas(e.clientX, e.clientY);
      setLasso({ ...lasso, currentCanvasX: pt.x, currentCanvasY: pt.y });
      return;
    }

    // Annotation interaction
    const a = annotRef.current;
    if (a) {
      if (a.kind === 'room-move' || a.kind === 'postit-move' || a.kind === 'group-move' || a.kind === 'sticker-move') {
        const dx = (e.clientX - a.startPX) / viewport.zoom;
        const dy = (e.clientY - a.startPY) / viewport.zoom;
        if (a.kind === 'room-move') {
          props.onRoomMoved(a.projectPath, a.startX + dx, a.startY + dy);
        } else if (a.kind === 'postit-move') {
          props.onUpdatePostIt(a.id, { x: a.startX + dx, y: a.startY + dy });
        } else if (a.kind === 'group-move') {
          props.onUpdateGroup(a.id, { x: a.startX + dx, y: a.startY + dy });
        } else if (a.kind === 'sticker-move') {
          props.onUpdateSticker(a.id, { x: a.startX + dx, y: a.startY + dy });
        }

        const extras = a.kind === 'group-move' ? a.children : a.siblings;
        for (const c of extras) {
          if (c.kind === 'room') props.onRoomMoved(c.projectPath, c.startX + dx, c.startY + dy);
          else if (c.kind === 'postit') props.onUpdatePostIt(c.id, { x: c.startX + dx, y: c.startY + dy });
          else if (c.kind === 'sticker') props.onUpdateSticker(c.id, { x: c.startX + dx, y: c.startY + dy });
          else if (c.kind === 'group') props.onUpdateGroup(c.id, { x: c.startX + dx, y: c.startY + dy });
        }
      } else if (a.kind === 'group-resize') {
        const dx = (e.clientX - a.startPX) / viewport.zoom;
        const dy = (e.clientY - a.startPY) / viewport.zoom;
        let nx = a.startX, ny = a.startY, nw = a.startW, nh = a.startH;
        if (a.corner.includes('w')) { nx = a.startX + dx; nw = a.startW - dx; }
        if (a.corner.includes('e')) { nw = a.startW + dx; }
        if (a.corner.includes('n')) { ny = a.startY + dy; nh = a.startH - dy; }
        if (a.corner.includes('s')) { nh = a.startH + dy; }
        if (nw >= GROUP_MIN_W && nh >= GROUP_MIN_H) {
          props.onUpdateGroup(a.id, { x: nx, y: ny, w: nw, h: nh });
        }
      } else if (a.kind === 'sticker-resize') {
        const dx = (e.clientX - a.startPX) / viewport.zoom;
        const dy = (e.clientY - a.startPY) / viewport.zoom;
        const ratio = a.startH / a.startW;
        const nw = Math.max(STICKER_MIN_SIZE, a.startW + Math.max(dx, dy));
        const nh = Math.max(STICKER_MIN_SIZE, nw * ratio);
        props.onUpdateSticker(a.id, { w: nw, h: nh });
      } else if (a.kind === 'sticker-rotate') {
        const pt = screenToCanvas(e.clientX, e.clientY);
        const angle = Math.atan2(pt.y - a.centerY, pt.x - a.centerX);
        const deg = (angle - a.startAngle) * (180 / Math.PI);
        props.onUpdateSticker(a.id, { rot: (a.startRot + deg) % 360 });
      }
      return;
    }
  }, [panning, groupCreation, screenToCanvas, viewport.zoom, props]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (panning) {
      setPanning(false);
      panStartRef.current = null;
      return;
    }

    if (groupCreation) {
      const x = Math.min(groupCreation.startCanvasX, groupCreation.currentCanvasX);
      const y = Math.min(groupCreation.startCanvasY, groupCreation.currentCanvasY);
      const w = Math.abs(groupCreation.currentCanvasX - groupCreation.startCanvasX);
      const h = Math.abs(groupCreation.currentCanvasY - groupCreation.startCanvasY);
      if (w >= GROUP_MIN_W / 2 && h >= GROUP_MIN_H / 2) {
        props.onAddGroup({
          id: genId('g'),
          x,
          y,
          w: Math.max(GROUP_MIN_W, w),
          h: Math.max(GROUP_MIN_H, h),
          label: 'Group',
          color: GROUP_DEFAULT_COLOR,
        });
      }
      setGroupCreation(null);
      props.onModeReset();
      return;
    }

    if (lasso) {
      const x0 = Math.min(lasso.startCanvasX, lasso.currentCanvasX);
      const y0 = Math.min(lasso.startCanvasY, lasso.currentCanvasY);
      const x1 = Math.max(lasso.startCanvasX, lasso.currentCanvasX);
      const y1 = Math.max(lasso.startCanvasY, lasso.currentCanvasY);
      const inside = (cx: number, cy: number) => cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;

      const next = new Set<string>();
      for (const r of layout.rooms) {
        const rw = r.w ?? CARD_DEFAULT_W;
        const rh = r.h ?? CARD_DEFAULT_H;
        if (inside(r.x + rw / 2, r.y + rh / 2)) next.add(selectionKey('room', r.projectPath));
      }
      for (const p of layout.postIts) {
        if (inside(p.x + p.w / 2, p.y + p.h / 2)) next.add(selectionKey('postit', p.id));
      }
      for (const s of layout.stickers) {
        if (inside(s.x + s.w / 2, s.y + s.h / 2)) next.add(selectionKey('sticker', s.id));
      }
      for (const g of layout.customGroups) {
        if (inside(g.x + g.w / 2, g.y + g.h / 2)) next.add(selectionKey('group', g.id));
      }

      props.onSelectedIds(next);
      setLasso(null);
      props.onModeReset();
      return;
    }

    if (annotRef.current) {
      annotRef.current = null;
      props.onEndDrag();
      return;
    }
  }, [panning, groupCreation, props]);

  const buildSiblings = useCallback((excludeKind: 'room' | 'postit' | 'sticker' | 'group', excludeId: string): GroupChild[] => {
    const sel = props.selectedIds;
    if (sel.size === 0) return [];
    const excludeKey = selectionKey(excludeKind, excludeId);
    if (!sel.has(excludeKey)) return [];

    const out: GroupChild[] = [];
    for (const r of layout.rooms) {
      if (excludeKind === 'room' && r.projectPath === excludeId) continue;
      if (sel.has(selectionKey('room', r.projectPath))) {
        out.push({ kind: 'room', projectPath: r.projectPath, startX: r.x, startY: r.y });
      }
    }
    for (const p of layout.postIts) {
      if (excludeKind === 'postit' && p.id === excludeId) continue;
      if (sel.has(selectionKey('postit', p.id))) {
        out.push({ kind: 'postit', id: p.id, startX: p.x, startY: p.y });
      }
    }
    for (const s of layout.stickers) {
      if (excludeKind === 'sticker' && s.id === excludeId) continue;
      if (sel.has(selectionKey('sticker', s.id))) {
        out.push({ kind: 'sticker', id: s.id, startX: s.x, startY: s.y });
      }
    }
    for (const g of layout.customGroups) {
      if (excludeKind === 'group' && g.id === excludeId) continue;
      if (sel.has(selectionKey('group', g.id))) {
        out.push({ kind: 'group', id: g.id, startX: g.x, startY: g.y });
      }
    }
    return out;
  }, [props.selectedIds, layout.rooms, layout.postIts, layout.stickers, layout.customGroups]);

  const fitToContent = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const xs: number[] = [];
    const ys: number[] = [];
    for (const r of layout.rooms) {
      xs.push(r.x, r.x + (r.w ?? CARD_DEFAULT_W));
      ys.push(r.y, r.y + (r.h ?? CARD_DEFAULT_H));
    }
    for (const g of layout.customGroups) {
      xs.push(g.x, g.x + g.w);
      ys.push(g.y, g.y + g.h);
    }
    for (const s of layout.stickers) {
      xs.push(s.x, s.x + s.w);
      ys.push(s.y, s.y + s.h);
    }
    for (const p of layout.postIts) {
      xs.push(p.x, p.x + p.w);
      ys.push(p.y, p.y + p.h);
    }
    if (xs.length === 0) return;

    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    const contentW = Math.max(maxX - minX, 1);
    const contentH = Math.max(maxY - minY, 1);
    const padding = 40;
    const zoomX = (rect.width - padding * 2) / contentW;
    const zoomY = (rect.height - padding * 2) / contentH;
    const zoom = Math.min(1, Math.max(MIN_ZOOM, Math.min(zoomX, zoomY)));
    const panX = padding - minX * zoom + (rect.width - padding * 2 - contentW * zoom) / 2;
    const panY = padding - minY * zoom + (rect.height - padding * 2 - contentH * zoom) / 2;
    setViewport({ zoom, panX, panY });
  }, [layout.rooms, layout.customGroups, layout.stickers, layout.postIts]);

  useEffect(() => {
    if (hasAutoFitRef.current) return;
    if (layout.rooms.length === 0 && layout.customGroups.length === 0 && layout.stickers.length === 0 && layout.postIts.length === 0) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;
    fitToContent();
    hasAutoFitRef.current = true;
  }, [layout.rooms.length, layout.customGroups.length, layout.stickers.length, layout.postIts.length, fitToContent]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '1') {
        e.preventDefault();
        fitToContent();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '0') {
        e.preventDefault();
        setViewport({ zoom: 1, panX: 0, panY: 0 });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [fitToContent]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      if (isEditableTarget(e.target)) return;
      e.preventDefault();
      setSpaceHeld(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      setSpaceHeld(false);
    };
    const blur = () => setSpaceHeld(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);

  // Annotation drag starters (passed to children)
  const startPostItDrag = useCallback((id: string, e: React.PointerEvent) => {
    const p = layout.postIts.find(x => x.id === id);
    if (!p) return;
    props.onBeginDrag();
    annotRef.current = { kind: 'postit-move', id, startX: p.x, startY: p.y, startPX: e.clientX, startPY: e.clientY, siblings: buildSiblings('postit', id) };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }, [layout.postIts, props, buildSiblings]);

  const startGroupDrag = useCallback((id: string, e: React.PointerEvent) => {
    const g = layout.customGroups.find(x => x.id === id);
    if (!g) return;

    const inside = (cx: number, cy: number) =>
      cx >= g.x && cx <= g.x + g.w && cy >= g.y && cy <= g.y + g.h;

    const children: GroupChild[] = [];
    for (const r of layout.rooms) {
      const w = r.w ?? CARD_DEFAULT_W;
      const h = r.h ?? CARD_DEFAULT_H;
      if (inside(r.x + w / 2, r.y + h / 2)) {
        children.push({ kind: 'room', projectPath: r.projectPath, startX: r.x, startY: r.y });
      }
    }
    for (const p of layout.postIts) {
      if (inside(p.x + p.w / 2, p.y + p.h / 2)) {
        children.push({ kind: 'postit', id: p.id, startX: p.x, startY: p.y });
      }
    }
    for (const s of layout.stickers) {
      if (inside(s.x + s.w / 2, s.y + s.h / 2)) {
        children.push({ kind: 'sticker', id: s.id, startX: s.x, startY: s.y });
      }
    }
    for (const other of layout.customGroups) {
      if (other.id === id) continue;
      if (inside(other.x + other.w / 2, other.y + other.h / 2)) {
        children.push({ kind: 'group', id: other.id, startX: other.x, startY: other.y });
      }
    }

    // If the group itself is part of a multi-selection, add the sibling
    // snapshots so all selected elements follow the drag together.
    const siblings = buildSiblings('group', id);
    for (const s of siblings) {
      // avoid double-move: skip elements already captured as children
      const already = children.some(c =>
        (c.kind === 'room' && s.kind === 'room' && c.projectPath === s.projectPath) ||
        (c.kind !== 'room' && s.kind === c.kind && 'id' in c && 'id' in s && c.id === s.id)
      );
      if (!already) children.push(s);
    }

    props.onBeginDrag();
    annotRef.current = { kind: 'group-move', id, startX: g.x, startY: g.y, startPX: e.clientX, startPY: e.clientY, children };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }, [layout.customGroups, layout.rooms, layout.postIts, layout.stickers, props, buildSiblings]);

  const startGroupResize = useCallback((id: string, corner: 'nw' | 'ne' | 'sw' | 'se', e: React.PointerEvent) => {
    const g = layout.customGroups.find(x => x.id === id);
    if (!g) return;
    props.onBeginDrag();
    annotRef.current = {
      kind: 'group-resize', id, corner,
      startX: g.x, startY: g.y, startW: g.w, startH: g.h,
      startPX: e.clientX, startPY: e.clientY,
    };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }, [layout.customGroups, props]);

  const startStickerDrag = useCallback((id: string, e: React.PointerEvent) => {
    const s = layout.stickers.find(x => x.id === id);
    if (!s) return;
    props.onBeginDrag();
    annotRef.current = { kind: 'sticker-move', id, startX: s.x, startY: s.y, startPX: e.clientX, startPY: e.clientY, siblings: buildSiblings('sticker', id) };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }, [layout.stickers, props, buildSiblings]);

  const startStickerResize = useCallback((id: string, e: React.PointerEvent) => {
    const s = layout.stickers.find(x => x.id === id);
    if (!s) return;
    props.onBeginDrag();
    annotRef.current = { kind: 'sticker-resize', id, startW: s.w, startH: s.h, startPX: e.clientX, startPY: e.clientY };
    (e.target as Element).setPointerCapture?.(e.pointerId);
    e.stopPropagation();
  }, [layout.stickers, props]);

  const startStickerRotate = useCallback((id: string, e: React.PointerEvent) => {
    const s = layout.stickers.find(x => x.id === id);
    if (!s) return;
    const centerX = s.x + s.w / 2;
    const centerY = s.y + s.h / 2;
    const pt = screenToCanvas(e.clientX, e.clientY);
    const startAngle = Math.atan2(pt.y - centerY, pt.x - centerX);
    props.onBeginDrag();
    annotRef.current = { kind: 'sticker-rotate', id, centerX, centerY, startRot: s.rot, startAngle };
    (e.target as Element).setPointerCapture?.(e.pointerId);
    e.stopPropagation();
  }, [layout.stickers, screenToCanvas, props]);

  const activeTagIds = layout.activeTagIds;

  const terminalsByPath = useMemo(() => {
    const map = new Map<string, TerminalInfo[]>();
    for (const t of terminals) {
      const arr = map.get(t.cwd) ?? [];
      arr.push(t);
      map.set(t.cwd, arr);
    }
    return map;
  }, [terminals]);

  const cursorStyle = panning
    ? 'grabbing'
    : spaceHeld
      ? 'grab'
      : mode === 'postit' ? 'cell'
      : mode === 'group' ? 'crosshair'
      : mode === 'lasso' ? 'crosshair'
      : mode === 'sticker' ? 'copy'
      : 'default';

  return (
    <div
      ref={containerRef}
      className={`office-canvas office-canvas--mode-${mode}`}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{ cursor: cursorStyle }}
    >
      <svg className="office-canvas__svg">
        <g transform={`translate(${viewport.panX}, ${viewport.panY}) scale(${viewport.zoom})`}>
          {layout.customGroups.map(g => (
            <OfficeCustomGroup
              key={g.id}
              group={g}
              selected={props.selectedIds.has(selectionKey('group', g.id))}
              onUpdate={(patch) => props.onUpdateGroup(g.id, patch)}
              onDelete={() => props.onDeleteGroup(g.id)}
              onDragStart={startGroupDrag}
              onResizeStart={startGroupResize}
            />
          ))}
          {layout.stickers.map(s => (
            <OfficeSticker
              key={s.id}
              sticker={s}
              selected={props.selectedIds.has(selectionKey('sticker', s.id))}
              onDragStart={startStickerDrag}
              onResizeStart={startStickerResize}
              onRotateStart={startStickerRotate}
              onDelete={() => props.onDeleteSticker(s.id)}
            />
          ))}
          {groupCreation && (
            <rect
              x={Math.min(groupCreation.startCanvasX, groupCreation.currentCanvasX)}
              y={Math.min(groupCreation.startCanvasY, groupCreation.currentCanvasY)}
              width={Math.abs(groupCreation.currentCanvasX - groupCreation.startCanvasX)}
              height={Math.abs(groupCreation.currentCanvasY - groupCreation.startCanvasY)}
              fill={`${GROUP_DEFAULT_COLOR}26`}
              stroke={GROUP_DEFAULT_COLOR}
              strokeWidth={1.5}
              strokeDasharray="6 4"
              pointerEvents="none"
            />
          )}
          {lasso && (
            <rect
              x={Math.min(lasso.startCanvasX, lasso.currentCanvasX)}
              y={Math.min(lasso.startCanvasY, lasso.currentCanvasY)}
              width={Math.abs(lasso.currentCanvasX - lasso.startCanvasX)}
              height={Math.abs(lasso.currentCanvasY - lasso.startCanvasY)}
              fill="rgba(59, 130, 246, 0.1)"
              stroke="#3b82f6"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              pointerEvents="none"
            />
          )}
        </g>
      </svg>

      {layout.rooms.length === 0 && (
        <div className="office-canvas__empty">
          <div className="office-canvas__empty-title">No project rooms yet</div>
          <div className="office-canvas__empty-hint">
            {terminals.length > 0
              ? `Found ${terminals.length} active agent${terminals.length === 1 ? '' : 's'}. Populate the office to create one card per project.`
              : 'Create an agent first — then come back here.'}
          </div>
          {terminals.length > 0 && (
            <button type="button" className="office-canvas__empty-btn" onClick={props.onPopulate}>
              Populate office
            </button>
          )}
        </div>
      )}

      <div
        className="office-canvas__cards"
        style={{ transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`, transformOrigin: '0 0' }}
      >
        {layout.rooms.map(card => {
          const projectTerminals = terminalsByPath.get(card.projectPath) ?? [];
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
              selected={props.selectedIds.has(selectionKey('room', card.projectPath))}
              onDragStart={(projectPath, e) => {
                props.onBeginDrag();
                annotRef.current = {
                  kind: 'room-move',
                  projectPath,
                  startX: card.x,
                  startY: card.y,
                  startPX: e.clientX,
                  startPY: e.clientY,
                  siblings: buildSiblings('room', projectPath),
                };
                (e.target as Element).setPointerCapture?.(e.pointerId);
              }}
              onDoubleClick={props.onCardDoubleClick}
              onDuckClick={props.onDuckClick}
              onContextMenu={props.onRoomContextMenu}
            />
          );
        })}
        {layout.postIts.map(p => (
          <OfficePostIt
            key={p.id}
            postIt={p}
            selected={props.selectedIds.has(selectionKey('postit', p.id))}
            onUpdate={(patch) => props.onUpdatePostIt(p.id, patch)}
            onDelete={() => props.onDeletePostIt(p.id)}
            onDragStart={startPostItDrag}
          />
        ))}
      </div>
    </div>
  );
}

export const OfficeCanvas = memo(OfficeCanvasImpl);
