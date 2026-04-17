/**
 * Feature Map Canvas — Architecture Layers + annotations (pure SVG)
 * Pan/zoom, hover highlighting, click→popover, drag-to-reposition,
 * post-it notes, group rectangles.
 */

import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { calculateLayeredLayout, classifyNode, LAYERS, LEFT_MARGIN, LEGEND_H } from './featureMapLayout';
import type { FeatureGraph, NodePosition } from './featureMapTypes';
import type { CanvasAnnotations, AnnotationMode, PostIt, GroupRect, CanvasImage as CanvasImageType, MdCard, LassoRect } from './annotationTypes';
import { GROUP_MIN_W, GROUP_MIN_H } from './annotationTypes';
import CanvasPostIt from './CanvasPostIt';
import CanvasGroupRect from './CanvasGroupRect';
import CanvasImage from './CanvasImage';
import CanvasMdCard from './CanvasMdCard';
import FeatureMapMinimap from './FeatureMapMinimap';

const BG = 'var(--bg-base, #0f1115)';
const BORDER_DEFAULT = '#1e293b';
const BORDER_HOVER = '#00d9ff';
// Brain: gotcha-pixi-csp-unsafe-eval — SVG/Canvas requires resolved hex values (no CSS variables)
const BORDER_SELECTED = getComputedStyle(document.documentElement)
  .getPropertyValue('--accent-color').trim() || '#ff6b35';
const BORDER_DRAGGING = '#fbbf24';
const LINK_COLOR = '#334155';
const LINK_HL = '#00d9ff';
const TEXT_1 = '#f1f5f9';
const TEXT_2 = '#94a3b8';
const TEXT_3 = '#475569';
const BADGE_BG = '#1e293b';
const DIM = 0.1;
const NW = 240; const NH = 72; const NR = 12;
const DRAG_T = 4;

const NODE_BG = '#111827';  // Uniform dark bg for all cards
const ACCENT_BAR_W = 4;    // Left color bar width

export interface NodeClickInfo { nodeId: string; screenX: number; screenY: number; }

interface Props {
  graph: FeatureGraph;
  onNodeSelect: (info: NodeClickInfo | null) => void;
  selectedNodeId: string | null;
  customPositions: Map<string, NodePosition>;
  onNodeDrag: (nodeId: string, x: number, y: number) => void;
  // Annotations
  annotations: CanvasAnnotations;
  annotationMode: AnnotationMode;
  selectedAnnotationId: string | null;
  onAnnotationSelect: (id: string | null) => void;
  onPostItAdd: (x: number, y: number) => string;
  onPostItUpdate: (id: string, p: Partial<PostIt>) => void;
  onPostItRemove: (id: string) => void;
  onGroupAdd: (x: number, y: number, w: number, h: number) => string;
  onGroupUpdate: (id: string, p: Partial<GroupRect>) => void;
  onGroupRemove: (id: string) => void;
  // Images
  onImageAdd: (src: string, x: number, y: number, w?: number, h?: number) => string;
  onImageUpdate: (id: string, p: Partial<CanvasImageType>) => void;
  onImageRemove: (id: string) => void;
  onImageFilePick: (x: number, y: number) => void;
  onImageDrop: (file: File, x: number, y: number) => void;
  // MD Preview Cards
  onMdCardAdd: (x: number, y: number, init?: Partial<MdCard>) => string;
  onMdCardUpdate: (id: string, p: Partial<MdCard>) => void;
  onMdCardRemove: (id: string) => void;
  onOpenMdCardFile?: (filePath: string) => void;
  projectPath: string;
  onResetMode: () => void;
  searchQuery: string;
  // Multi-select (lasso + shift+click)
  multiSelectedIds: Set<string>;
  lassoRect: LassoRect | null;
  onLassoStart: (svgX: number, svgY: number) => void;
  onLassoUpdate: (svgX: number, svgY: number) => void;
  onLassoSelect: (ids: Set<string>) => void;
  onLassoReset: () => void;
  onMultiToggle: (id: string) => void;
  onMultiClear: () => void;
  onBeginDrag: () => void;
  onEndDrag: () => void;
  // Component navigation
  currentComponentId?: string | null;
  onEnterComponent?: (id: string, label: string) => void;
  getChildCount?: (componentId: string) => number;
  getChildAnnotations?: (componentId: string) => CanvasAnnotations;
  /** null = show all nodes, Set = show ONLY these node IDs */
  visibleNodeIds?: Set<string> | null;
  // Drag-assign / drag-eject
  onAssignToComponent?: (annotationId: string, componentId: string) => void;
  onEjectFromComponent?: (annotationId: string) => void;
}

export default function FeatureMapCanvas(props: Props) {
  const {
    graph, onNodeSelect, selectedNodeId, customPositions, onNodeDrag,
    annotations, annotationMode, selectedAnnotationId, onAnnotationSelect,
    onPostItAdd, onPostItUpdate, onPostItRemove,
    onGroupAdd, onGroupUpdate, onGroupRemove,
    onImageUpdate, onImageRemove, onImageFilePick, onImageDrop,
    onMdCardAdd, onMdCardUpdate, onMdCardRemove, onOpenMdCardFile,
    projectPath, onResetMode, searchQuery,
    multiSelectedIds, lassoRect: lassoRectProp,
    onLassoStart, onLassoUpdate, onLassoSelect, onLassoReset, onMultiToggle, onMultiClear, onBeginDrag, onEndDrag,
    currentComponentId, onEnterComponent, getChildCount, getChildAnnotations,
    visibleNodeIds,
    onAssignToComponent, onEjectFromComponent,
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [viewport, setViewport] = useState({ zoom: 1, panX: 0, panY: 0 });
  const hasAutoFit = useRef(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [drawingRect, setDrawingRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const panRef = useRef({ active: false, x: 0, y: 0, panX: 0, panY: 0, didDrag: false });
  const nodeDragRef = useRef<{ nodeId: string; startX: number; startY: number; origX: number; origY: number; didDrag: boolean } | null>(null);
  const groupDrawRef = useRef<{ sx: number; sy: number; svgSx: number; svgSy: number } | null>(null);
  // Group-drag ref: tracks multi-selection drag (all selected items move together)
  const multiDragRef = useRef<{ startX: number; startY: number; didDrag: boolean; origins: Map<string, { x: number; y: number }> } | null>(null);
  // Drag-assign/eject state
  const dragAnnotationRef = useRef<string | null>(null);
  const dropTargetRef = useRef<string | null>(null);
  const ejectRef = useRef(false);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [ejectActive, setEjectActive] = useState(false);

  // Space key held = force pan mode (like Figma)
  const [spaceHeld, setSpaceHeld] = useState(false);
  const spaceRef = useRef(false); // ref for synchronous access in handlers

  // Track Space key for pan override
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) { spaceRef.current = true; setSpaceHeld(true); }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') { spaceRef.current = false; setSpaceHeld(false); }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const insideComponent = currentComponentId != null;
  const layout = useMemo(() => calculateLayeredLayout(graph.nodes, size.w > 0 ? size.w : 900), [graph.nodes, size.w]);

  // Auto-fit content on first render
  useEffect(() => {
    if (hasAutoFit.current || size.w === 0 || size.h === 0) return;
    if (layout.totalWidth === 0 || layout.totalHeight === 0) return;
    hasAutoFit.current = true;
    const padX = 40;
    const padY = 40;
    const zoomX = size.w / (layout.totalWidth + padX);
    const zoomY = size.h / (layout.totalHeight + padY);
    const zoom = Math.min(Math.max(0.4, Math.min(zoomX, zoomY, 1)), 1);
    const panX = padX / 2;
    const panY = padY / 2;
    setViewport({ zoom, panX, panY });
  }, [size.w, size.h, layout.totalWidth, layout.totalHeight]);

  const getPos = useCallback((id: string) => customPositions.get(id) ?? layout.positions.get(id), [customPositions, layout.positions]);
  const nodeLayerMap = useMemo(() => { const m = new Map<string, string>(); for (const n of graph.nodes) m.set(n.id, classifyNode(n)); return m; }, [graph.nodes]);
  // Search: matching node IDs
  const searchMatches = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    return new Set(graph.nodes.filter(n =>
      n.title.toLowerCase().includes(q) || n.tags.some(t => t.toLowerCase().includes(q)),
    ).map(n => n.id));
  }, [searchQuery, graph.nodes]);

  // Auto-pan to single search match (only when query changes)
  const getPosRef = useRef(getPos);
  getPosRef.current = getPos;
  useEffect(() => {
    if (!searchMatches || searchMatches.size !== 1 || size.w === 0) return;
    const nodeId = [...searchMatches][0];
    const pos = getPosRef.current(nodeId);
    if (!pos) return;
    setViewport(v => ({
      ...v,
      panX: size.w / 2 - pos.x * v.zoom,
      panY: size.h / 2 - pos.y * v.zoom,
    }));
  }, [searchMatches, size.w, size.h]);

  const toSvg = useCallback((clientX: number, clientY: number) => {
    const r = containerRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return { x: (clientX - r.left - viewport.panX) / viewport.zoom, y: (clientY - r.top - viewport.panY) / viewport.zoom };
  }, [viewport]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    // Pinch-zoom: ctrlKey is set by trackpad pinch gesture
    if (e.ctrlKey) {
      setViewport(v => ({ ...v, zoom: Math.max(0.3, Math.min(2.5, v.zoom - e.deltaY * 0.002)) }));
    } else {
      // Trackpad two-finger scroll OR mouse wheel: pan
      setViewport(v => ({ ...v, panX: v.panX - e.deltaX, panY: v.panY - e.deltaY }));
    }
  }, []);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    // Clean up stale annotation drag ref (e.g. click without drag)
    if (dragAnnotationRef.current) {
      dragAnnotationRef.current = null;
      dropTargetRef.current = null;
      ejectRef.current = false;
      setDropTargetId(null);
      setEjectActive(false);
    }
    // Middle-click always starts pan (any mode)
    if (e.button === 1) {
      panRef.current = { active: true, x: e.clientX, y: e.clientY, panX: viewport.panX, panY: viewport.panY, didDrag: false };
      return;
    }
    if (e.button !== 0) return;
    // Space held = force pan in any mode
    if (spaceRef.current) {
      panRef.current = { active: true, x: e.clientX, y: e.clientY, panX: viewport.panX, panY: viewport.panY, didDrag: false };
      return;
    }
    if (annotationMode === 'postit') {
      const svg = toSvg(e.clientX, e.clientY);
      onPostItAdd(svg.x, svg.y);
      onResetMode();
      return;
    }
    if (annotationMode === 'image') {
      const svg = toSvg(e.clientX, e.clientY);
      onImageFilePick(svg.x, svg.y);
      // Reset happens in FeatureMapView after file pick completes/cancels
      return;
    }
    if (annotationMode === 'mdcard') {
      const svg = toSvg(e.clientX, e.clientY);
      onMdCardAdd(svg.x, svg.y);
      onResetMode();
      return;
    }
    if (annotationMode === 'group') {
      const svg = toSvg(e.clientX, e.clientY);
      groupDrawRef.current = { sx: e.clientX, sy: e.clientY, svgSx: svg.x, svgSy: svg.y };
      setDrawingRect({ x: svg.x, y: svg.y, w: 0, h: 0 });
      return;
    }
    // Lasso mode: draw selection rectangle
    if (annotationMode === 'lasso') {
      const svg = toSvg(e.clientX, e.clientY);
      onLassoStart(svg.x, svg.y);
      return;
    }
    // Select mode (and fallback): pan canvas
    panRef.current = { active: true, x: e.clientX, y: e.clientY, panX: viewport.panX, panY: viewport.panY, didDrag: false };
  }, [annotationMode, viewport.panX, viewport.panY, toSvg, onPostItAdd, onImageFilePick, onLassoStart]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setIsDragOver(true); }
  }, []);

  const handleDragLeave = useCallback(() => setIsDragOver(false), []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    const svg = toSvg(e.clientX, e.clientY);
    onImageDrop(file, svg.x, svg.y);
  }, [toSvg, onImageDrop]);

  /** Start group-drag when mousedown on a multi-selected element */
  const handleGroupDragStart = useCallback((clientX: number, clientY: number) => {
    const origins = new Map<string, { x: number; y: number }>();
    for (const id of multiSelectedIds) {
      // Check feature nodes first
      const nodePos = getPos(id);
      if (nodePos && graph.nodes.some(n => n.id === id)) { origins.set(id, { x: nodePos.x, y: nodePos.y }); continue; }
      // Then annotations
      const p = annotations.postIts.find(pi => pi.id === id);
      if (p) { origins.set(id, { x: p.x, y: p.y }); continue; }
      const g = annotations.groups.find(gi => gi.id === id);
      if (g) { origins.set(id, { x: g.x, y: g.y }); continue; }
      const img = annotations.images.find(ii => ii.id === id);
      if (img) { origins.set(id, { x: img.x, y: img.y }); continue; }
      const mc = (annotations.mdCards ?? []).find(ci => ci.id === id);
      if (mc) { origins.set(id, { x: mc.x, y: mc.y }); continue; }
    }
    onBeginDrag();
    multiDragRef.current = { startX: clientX, startY: clientY, didDrag: false, origins };
  }, [multiSelectedIds, annotations, graph.nodes, getPos, onBeginDrag]);

  const handleNodeMouseDown = useCallback((nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    // Shift+click toggles multi-select on feature nodes
    if (e.shiftKey) { onMultiToggle(nodeId); return; }
    // If multi-selected, start group drag
    if (multiSelectedIds.has(nodeId)) { handleGroupDragStart(e.clientX, e.clientY); return; }
    const pos = getPos(nodeId);
    if (!pos) return;
    onBeginDrag();
    nodeDragRef.current = { nodeId, startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y, didDrag: false };
    setDraggingId(nodeId);
  }, [getPos, onMultiToggle, multiSelectedIds, handleGroupDragStart, onBeginDrag]);

  /** Apply delta to all multi-selected elements (feature nodes + annotations) */
  const applyMultiDragDelta = useCallback((dx: number, dy: number, origins: Map<string, { x: number; y: number }>) => {
    for (const [id, orig] of origins) {
      const nx = orig.x + dx;
      const ny = orig.y + dy;
      // Feature node?
      if (graph.nodes.some(n => n.id === id)) { onNodeDrag(id, nx, ny); continue; }
      // Annotations
      const np = { x: nx, y: ny };
      if (annotations.postIts.some(p => p.id === id)) onPostItUpdate(id, np);
      else if (annotations.groups.some(g => g.id === id)) onGroupUpdate(id, np);
      else if (annotations.images.some(i => i.id === id)) onImageUpdate(id, np);
      else if ((annotations.mdCards ?? []).some(c => c.id === id)) onMdCardUpdate(id, np);
    }
  }, [annotations, graph.nodes, onNodeDrag, onPostItUpdate, onGroupUpdate, onImageUpdate, onMdCardUpdate]);

  /** Check if target is a valid drop destination (prevents circular nesting) */
  const canDropOnTarget = useCallback((dragId: string, targetId: string): boolean => {
    if (dragId === targetId) return false;
    const dragged = annotations.groups.find(g => g.id === dragId);
    if (!dragged?.isComponent) return true; // non-component can drop anywhere
    // Walk descendants of dragged component to check if target is one
    const seen = new Set<string>();
    const isDesc = (pid: string): boolean => {
      if (seen.has(pid)) return false;
      seen.add(pid);
      return annotations.groups.some(g =>
        g.parentComponentId === pid &&
        (g.id === targetId || (g.isComponent && isDesc(g.id))),
      );
    };
    return !isDesc(dragId);
  }, [annotations.groups]);

  /** Finalize annotation drag — check drop target or eject zone */
  const handleAnnotationDragEnd = useCallback((id: string) => {
    const target = dropTargetRef.current;
    if (target && canDropOnTarget(id, target)) {
      onAssignToComponent?.(id, target);
    } else if (ejectRef.current && currentComponentId) {
      onEjectFromComponent?.(id);
    }
    dragAnnotationRef.current = null;
    dropTargetRef.current = null;
    ejectRef.current = false;
    setDropTargetId(null);
    setEjectActive(false);
    onEndDrag();
  }, [canDropOnTarget, currentComponentId, onAssignToComponent, onEjectFromComponent, onEndDrag]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    // Group drawing
    const gd = groupDrawRef.current;
    if (gd) {
      const svg = toSvg(e.clientX, e.clientY);
      const x = Math.min(gd.svgSx, svg.x);
      const y = Math.min(gd.svgSy, svg.y);
      setDrawingRect({ x, y, w: Math.abs(svg.x - gd.svgSx), h: Math.abs(svg.y - gd.svgSy) });
      return;
    }
    // Multi-selection group drag
    const md = multiDragRef.current;
    if (md) {
      const dx = e.clientX - md.startX;
      const dy = e.clientY - md.startY;
      if (Math.abs(dx) > DRAG_T || Math.abs(dy) > DRAG_T) md.didDrag = true;
      if (md.didDrag) applyMultiDragDelta(dx / viewport.zoom, dy / viewport.zoom, md.origins);
      return;
    }
    // Lasso selection (only in lasso mode)
    if (lassoRectProp && annotationMode === 'lasso') {
      const svg = toSvg(e.clientX, e.clientY);
      onLassoUpdate(svg.x, svg.y);
      return;
    }
    // Annotation drag-assign hit-test (fires during child-component drag)
    if (dragAnnotationRef.current) {
      const svg = toSvg(e.clientX, e.clientY);
      const dragId = dragAnnotationRef.current;
      let hit: string | null = null;
      for (const g of annotations.groups) {
        if (!g.isComponent || g.id === dragId) continue;
        if (svg.x >= g.x && svg.x <= g.x + g.w && svg.y >= g.y && svg.y <= g.y + g.h) {
          if (canDropOnTarget(dragId, g.id)) { hit = g.id; break; }
        }
      }
      if (hit !== dropTargetRef.current) {
        dropTargetRef.current = hit;
        setDropTargetId(hit);
      }
      // Eject zone: top 40px of canvas when inside a component
      if (currentComponentId) {
        const rect = containerRef.current?.getBoundingClientRect();
        const inEject = !hit && rect ? e.clientY < rect.top + 40 : false;
        if (inEject !== ejectRef.current) {
          ejectRef.current = inEject;
          setEjectActive(inEject);
        }
      }
    }
    // Node drag
    const nd = nodeDragRef.current;
    if (nd) {
      const dx = e.clientX - nd.startX;
      const dy = e.clientY - nd.startY;
      if (Math.abs(dx) > DRAG_T || Math.abs(dy) > DRAG_T) nd.didDrag = true;
      if (nd.didDrag) onNodeDrag(nd.nodeId, nd.origX + dx / viewport.zoom, nd.origY + dy / viewport.zoom);
      return;
    }
    // Pan
    const d = panRef.current;
    if (!d.active) return;
    const dx = e.clientX - d.x; const dy = e.clientY - d.y;
    if (Math.abs(dx) > DRAG_T || Math.abs(dy) > DRAG_T) d.didDrag = true;
    if (d.didDrag) setViewport(v => ({ ...v, panX: d.panX + dx, panY: d.panY + dy }));
  }, [viewport.zoom, onNodeDrag, toSvg, lassoRectProp, annotationMode, onLassoUpdate, applyMultiDragDelta, annotations.groups, canDropOnTarget, currentComponentId]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    // Annotation drag cleanup (e.g. mouse left canvas during child drag)
    if (dragAnnotationRef.current) {
      const dragId = dragAnnotationRef.current;
      const rect = containerRef.current?.getBoundingClientRect();
      // If mouse exited toward top and inside component → eject
      if (rect && e.clientY <= rect.top + 10 && currentComponentId) {
        onEjectFromComponent?.(dragId);
      } else if (dropTargetRef.current && canDropOnTarget(dragId, dropTargetRef.current)) {
        onAssignToComponent?.(dragId, dropTargetRef.current);
      }
      dragAnnotationRef.current = null;
      dropTargetRef.current = null;
      ejectRef.current = false;
      setDropTargetId(null);
      setEjectActive(false);
      onEndDrag();
      return;
    }
    // Group drawing finalize
    const gd = groupDrawRef.current;
    if (gd && drawingRect) {
      if (drawingRect.w >= GROUP_MIN_W && drawingRect.h >= GROUP_MIN_H) {
        onGroupAdd(drawingRect.x, drawingRect.y, drawingRect.w, drawingRect.h);
      }
      groupDrawRef.current = null;
      setDrawingRect(null);
      onResetMode();
      return;
    }
    // Multi-drag finalize
    if (multiDragRef.current) {
      multiDragRef.current = null;
      onEndDrag();
      return;
    }
    // Lasso finalize — hit-test all elements (feature nodes + annotations) directly
    if (lassoRectProp && annotationMode === 'lasso') {
      const r = lassoRectProp;
      if (r.w > 5 && r.h > 5) {
        const hits = new Set<string>();
        // Hit-test feature nodes (center = getPos, filtered by visibility)
        for (const node of graph.nodes) {
          if (visibleNodeIds && !visibleNodeIds.has(node.id)) continue;
          const pos = getPos(node.id);
          if (pos && pos.x >= r.x && pos.x <= r.x + r.w && pos.y >= r.y && pos.y <= r.y + r.h) {
            hits.add(node.id);
          }
        }
        // Hit-test annotations (post-its center, group center, image center)
        for (const p of annotations.postIts) {
          const cx = p.x + 80; const cy = p.y + 50;
          if (cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h) hits.add(p.id);
        }
        for (const g of annotations.groups) {
          const cx = g.x + g.w / 2; const cy = g.y + g.h / 2;
          if (cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h) hits.add(g.id);
        }
        for (const img of annotations.images) {
          const cx = img.x + img.w / 2; const cy = img.y + img.h / 2;
          if (cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h) hits.add(img.id);
        }
        for (const c of (annotations.mdCards ?? [])) {
          const cx = c.x + c.w / 2; const cy = c.y + c.h / 2;
          if (cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h) hits.add(c.id);
        }
        onLassoSelect(hits);
      }
      onLassoReset();
      return;
    }
    // Node drag finalize
    const nd = nodeDragRef.current;
    if (nd) {
      if (!nd.didDrag) onNodeSelect({ nodeId: nd.nodeId, screenX: e.clientX, screenY: e.clientY });
      else onEndDrag();
      nodeDragRef.current = null;
      setDraggingId(null);
      return;
    }
    panRef.current.active = false;
  }, [onNodeSelect, onGroupAdd, drawingRect, lassoRectProp, annotationMode, onLassoSelect, onLassoReset, graph.nodes, getPos, annotations, onEndDrag, currentComponentId, onAssignToComponent, onEjectFromComponent, canDropOnTarget]);

  const handleBgClick = useCallback(() => {
    if (panRef.current.didDrag) return;
    if (annotationMode === 'select') {
      onNodeSelect(null);
      onAnnotationSelect(null);
      onMultiClear();
    }
  }, [onNodeSelect, onAnnotationSelect, annotationMode, onMultiClear]);

  const handleMinimapNavigate = useCallback((panX: number, panY: number) => {
    setViewport(v => ({ ...v, panX, panY }));
  }, []);

  // Nodes: dim only for search filter, never for hover
  const nodeOp = (id: string) => {
    if (searchMatches && !searchMatches.has(id)) return DIM;
    return 1;
  };
  // Links: highlight connected on hover (full opacity + cyan), dim only for search
  const linkOp = (s: string, t: string) => {
    if (searchMatches && !searchMatches.has(s) && !searchMatches.has(t)) return DIM;
    if (!hovered) return 0.35;
    return s === hovered || t === hovered ? 1 : 0.35;
  };
  const linkCol = (s: string, t: string) => (!hovered ? LINK_COLOR : s === hovered || t === hovered ? LINK_HL : LINK_COLOR);
  const trunc = (t: string, m: number) => (t.length > m ? t.slice(0, m - 1) + '\u2026' : t);
  // Returns the center of the side facing the target + outward direction (nx,ny)
  const edgePoint = (cx: number, cy: number, tx: number, ty: number) => {
    const dx = tx - cx, dy = ty - cy;
    if (dx === 0 && dy === 0) return { x: cx, y: cy, nx: 0, ny: 0 };
    const hw = NW / 2, hh = NH / 2;
    if (Math.abs(dx) * hh > Math.abs(dy) * hw) {
      const dir = dx > 0 ? 1 : -1;
      return { x: cx + dir * hw, y: cy, nx: dir, ny: 0 };
    } else {
      const dir = dy > 0 ? 1 : -1;
      return { x: cx, y: cy + dir * hh, nx: 0, ny: dir };
    }
  };
  // Cubic Bézier that exits straight from each anchor point's normal direction
  const curvePath = (ep1: { x: number; y: number; nx: number; ny: number }, ep2: { x: number; y: number; nx: number; ny: number }) => {
    const dist = Math.hypot(ep2.x - ep1.x, ep2.y - ep1.y);
    const arm = Math.max(40, dist * 0.35);
    const c1x = ep1.x + ep1.nx * arm, c1y = ep1.y + ep1.ny * arm;
    const c2x = ep2.x + ep2.nx * arm, c2y = ep2.y + ep2.ny * arm;
    return `M${ep1.x},${ep1.y} C${c1x},${c1y} ${c2x},${c2y} ${ep2.x},${ep2.y}`;
  };

  const cursor = draggingId || multiDragRef.current ? 'grabbing'
    : spaceHeld ? 'grab'
    : annotationMode === 'lasso' ? 'crosshair'
    : annotationMode === 'postit' || annotationMode === 'group' || annotationMode === 'image' || annotationMode === 'mdcard' ? 'crosshair'
    : 'grab';

  return (
    <div ref={containerRef}
      style={{ width: '100%', height: '100%', background: BG, overflow: 'hidden', cursor,
        position: 'relative',
        outline: isDragOver ? '2px dashed #00d9ff' : 'none', outlineOffset: '-2px' }}
      onWheel={handleWheel} onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
      onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
      {size.w > 0 && (
        <svg width={size.w} height={size.h} style={{ display: 'block' }}>
          <rect width={size.w} height={size.h} fill="transparent" onClick={handleBgClick} />
          <g transform={`translate(${viewport.panX},${viewport.panY}) scale(${viewport.zoom})`}>

            {/* Z1: Group rect annotations */}
            {annotations.groups.map(g => (
              <CanvasGroupRect key={g.id} group={g} zoom={viewport.zoom}
                isSelected={selectedAnnotationId === g.id}
                isMultiSelected={multiSelectedIds.has(g.id)}
                onUpdate={onGroupUpdate} onRemove={onGroupRemove}
                onSelect={onAnnotationSelect} onMultiToggle={onMultiToggle}
                onGroupDragStart={handleGroupDragStart}
                onBeginDrag={() => { dragAnnotationRef.current = g.id; onBeginDrag(); }}
                onEndDrag={() => handleAnnotationDragEnd(g.id)}
                onEnterComponent={onEnterComponent}
                childCount={g.isComponent ? getChildCount?.(g.id) ?? 0 : 0}
                childAnnotations={g.isComponent ? getChildAnnotations?.(g.id) : undefined}
                isDropTarget={dropTargetId === g.id} />
            ))}

            {/* Z1.5: Image annotations */}
            {annotations.images.map(img => (
              <CanvasImage key={img.id} image={img} zoom={viewport.zoom}
                projectPath={projectPath} isSelected={selectedAnnotationId === img.id}
                isMultiSelected={multiSelectedIds.has(img.id)}
                onUpdate={onImageUpdate} onRemove={onImageRemove}
                onSelect={onAnnotationSelect} onMultiToggle={onMultiToggle}
                onGroupDragStart={handleGroupDragStart}
                onBeginDrag={() => { dragAnnotationRef.current = img.id; onBeginDrag(); }}
                onEndDrag={() => handleAnnotationDragEnd(img.id)} />
            ))}

            {/* Z2: Legend row — hidden inside components */}
            {!insideComponent && (() => {
              let lx = LEFT_MARGIN;
              return LAYERS.map(layer => {
                const count = graph.nodes.filter(n => classifyNode(n) === layer.id).length;
                if (count === 0) return null;
                const x = lx;
                lx += layer.label.length * 6.5 + 40;
                return (
                  <g key={`legend-${layer.id}`}>
                    <circle cx={x} cy={LEGEND_H / 2} r={4} fill={layer.borderColor} opacity={0.8} />
                    <text x={x + 10} y={LEGEND_H / 2 + 1} fill={TEXT_2} fontSize={10}
                      dominantBaseline="central" fontFamily="Inter, system-ui, sans-serif">
                      {layer.label} ({count})
                    </text>
                  </g>
                );
              });
            })()}

            {/* Z3: Links — filtered to only visible nodes */}
            {graph.links.map(link => {
              // Skip links where either node is hidden
              if (visibleNodeIds && (!visibleNodeIds.has(link.source) || !visibleNodeIds.has(link.target))) return null;
              const from = getPos(link.source); const to = getPos(link.target);
              if (!from || !to) return null;
              const isHl = hovered === link.source || hovered === link.target;
              const ep1 = edgePoint(from.x, from.y, to.x, to.y);
              const ep2 = edgePoint(to.x, to.y, from.x, from.y);
              const mx = (ep1.x + ep2.x) / 2; const my = (ep1.y + ep2.y) / 2;
              const col = linkCol(link.source, link.target);
              const op = linkOp(link.source, link.target);
              return (
                <g key={`lk-${link.source}-${link.target}`}>
                  <path d={curvePath(ep1, ep2)} fill="none"
                    stroke={col}
                    strokeWidth={Math.min(1 + link.sharedFiles.length * 0.5, 4)}
                    opacity={op} strokeLinecap="round" />
                  <circle cx={ep1.x} cy={ep1.y} r={3.5} fill={col} opacity={op} />
                  <circle cx={ep2.x} cy={ep2.y} r={3.5} fill={col} opacity={op} />
                </g>);
            })}

            {/* Z4: Feature nodes — filtered by visibleNodeIds */}
            {graph.nodes.map(node => {
              // Skip nodes not in visible set
              if (visibleNodeIds && !visibleNodeIds.has(node.id)) return null;
              const pos = getPos(node.id); if (!pos) return null;
              const sel = node.id === selectedNodeId; const hov = node.id === hovered; const isDrag = node.id === draggingId;
              const layerId = nodeLayerMap.get(node.id) ?? 'infra';
              const layer = LAYERS.find(l => l.id === layerId);
              const accentColor = layer?.borderColor ?? '#94a3b8';
              const isMultiSel = multiSelectedIds.has(node.id);
              const borderColor = isMultiSel ? '#3b82f6' : isDrag ? BORDER_DRAGGING : sel ? BORDER_SELECTED : hov ? BORDER_HOVER : BORDER_DEFAULT;
              const title = trunc(node.title, 28);
              const sub = node.files.length > 0 ? `${node.files.length} file \u00B7 ${node.tags.slice(0, 2).join(', ')}` : node.tags.slice(0, 3).join(', ');
              return (
                <g key={node.id} transform={`translate(${pos.x},${pos.y})`} opacity={nodeOp(node.id)}
                  style={{ cursor: isDrag ? 'grabbing' : 'pointer' }}
                  onMouseEnter={() => setHovered(node.id)} onMouseLeave={() => setHovered(null)}
                  onMouseDown={e => handleNodeMouseDown(node.id, e)}>
                  {/* Clip for accent bar */}
                  <defs>
                    <clipPath id={`clip-${node.id}`}>
                      <rect x={-NW/2} y={-NH/2} width={NW} height={NH} rx={NR} />
                    </clipPath>
                  </defs>
                  {/* Shadow */}
                  <rect x={-NW/2+2} y={-NH/2+3} width={NW} height={NH} rx={NR} fill="rgba(0,0,0,0.25)" />
                  {/* Card border */}
                  <rect x={-NW/2} y={-NH/2} width={NW} height={NH} rx={NR} fill={borderColor} />
                  {/* Card bg — uniform */}
                  <rect x={-NW/2+1} y={-NH/2+1} width={NW-2} height={NH-2} rx={NR-1} fill={NODE_BG} />
                  {/* Left accent bar — full height, clipped to card shape */}
                  <rect x={-NW/2} y={-NH/2} width={ACCENT_BAR_W} height={NH}
                    fill={accentColor} clipPath={`url(#clip-${node.id})`} />
                  {/* Title + subtitle — padded after accent bar */}
                  <text x={-NW/2+ACCENT_BAR_W+12} y={sub?-8:0} textAnchor="start" dominantBaseline="central" fill={TEXT_1} fontSize={12} fontWeight="600" fontFamily="Inter, system-ui, sans-serif">{title}</text>
                  {sub && <text x={-NW/2+ACCENT_BAR_W+12} y={12} textAnchor="start" dominantBaseline="central" fill={TEXT_3} fontSize={10} fontFamily="Inter, system-ui, sans-serif">{trunc(sub,34)}</text>}
                  {/* File count badge */}
                  {node.files.length > 0 && (<><rect x={NW/2-30} y={-NH/2-6} width={24} height={16} rx={8} fill={BADGE_BG} stroke={BORDER_DEFAULT} strokeWidth={0.5} /><text x={NW/2-18} y={-NH/2+2} textAnchor="middle" dominantBaseline="central" fill={TEXT_2} fontSize={9} fontWeight="bold" fontFamily="Inter, system-ui, sans-serif">{node.files.length}</text></>)}
                  {/* Custom position dot */}
                  {customPositions.has(node.id) && <circle cx={-NW/2+8} cy={-NH/2+8} r={3} fill={BORDER_DRAGGING} opacity={0.6} />}
                </g>);
            })}

            {/* Z5: Hovered link overlay — renders above nodes so splines show through */}
            {hovered && graph.links.map(link => {
              if (link.source !== hovered && link.target !== hovered) return null;
              if (visibleNodeIds && (!visibleNodeIds.has(link.source) || !visibleNodeIds.has(link.target))) return null;
              const from = getPos(link.source); const to = getPos(link.target);
              if (!from || !to) return null;
              const ep1 = edgePoint(from.x, from.y, to.x, to.y);
              const ep2 = edgePoint(to.x, to.y, from.x, from.y);
              const mx = (ep1.x + ep2.x) / 2; const my = (ep1.y + ep2.y) / 2;
              return (
                <g key={`lk-ov-${link.source}-${link.target}`}>
                  <path d={curvePath(ep1, ep2)} fill="none"
                    stroke={LINK_HL}
                    strokeWidth={Math.min(1 + link.sharedFiles.length * 0.5, 4)}
                    opacity={0.18} strokeLinecap="round" />
                  <circle cx={ep1.x} cy={ep1.y} r={3.5} fill={LINK_HL} opacity={0.18} />
                  <circle cx={ep2.x} cy={ep2.y} r={3.5} fill={LINK_HL} opacity={0.18} />
                </g>);
            })}

            {/* Z6: Link pills — rendered above nodes and hover overlay */}
            {graph.links.map(link => {
              if (visibleNodeIds && (!visibleNodeIds.has(link.source) || !visibleNodeIds.has(link.target))) return null;
              const isHl = hovered === link.source || hovered === link.target;
              if (!isHl || link.sharedFiles.length === 0) return null;
              const from = getPos(link.source); const to = getPos(link.target);
              if (!from || !to) return null;
              const ep1 = edgePoint(from.x, from.y, to.x, to.y);
              const ep2 = edgePoint(to.x, to.y, from.x, from.y);
              const mx = (ep1.x + ep2.x) / 2; const my = (ep1.y + ep2.y) / 2;
              // Dim pill if it overlaps any node box
              const overlapsNode = graph.nodes.some(n => {
                if (visibleNodeIds && !visibleNodeIds.has(n.id)) return false;
                const p = getPos(n.id);
                if (!p) return false;
                return mx > p.x - NW / 2 && mx < p.x + NW / 2 && my > p.y - NH / 2 && my < p.y + NH / 2;
              });
              const pillOp = overlapsNode ? 0.15 : 1;
              return (
                <g key={`pill-${link.source}-${link.target}`} opacity={pillOp}>
                  <rect x={mx - 22} y={my - 11} width={44} height={22} rx={11} fill={LINK_HL} />
                  <text x={mx} y={my + 1} textAnchor="middle" dominantBaseline="central"
                    fill="#0a0e1a" fontSize={9} fontWeight="bold" fontFamily="Inter, system-ui, sans-serif">{link.sharedFiles.length} file</text>
                </g>);
            })}

            {/* Z7: Post-it annotations */}
            {annotations.postIts.map(p => (
              <CanvasPostIt key={p.id} postIt={p} zoom={viewport.zoom}
                isSelected={selectedAnnotationId === p.id}
                isMultiSelected={multiSelectedIds.has(p.id)}
                onUpdate={onPostItUpdate} onRemove={onPostItRemove}
                onSelect={onAnnotationSelect} onMultiToggle={onMultiToggle}
                onGroupDragStart={handleGroupDragStart}
                onBeginDrag={() => { dragAnnotationRef.current = p.id; onBeginDrag(); }}
                onEndDrag={() => handleAnnotationDragEnd(p.id)} />
            ))}

            {/* Group drawing preview */}
            {drawingRect && drawingRect.w > 5 && (
              <rect x={drawingRect.x} y={drawingRect.y} width={drawingRect.w} height={drawingRect.h}
                rx={12} fill="rgba(0,217,255,0.05)" stroke="#00d9ff" strokeWidth={2}
                strokeDasharray="8 4" strokeOpacity={0.6} />
            )}

            {/* Lasso selection rectangle */}
            {lassoRectProp && lassoRectProp.w > 3 && lassoRectProp.h > 3 && (
              <rect x={lassoRectProp.x} y={lassoRectProp.y}
                width={lassoRectProp.w} height={lassoRectProp.h}
                rx={4} fill="rgba(59,130,246,0.08)" stroke="#3b82f6" strokeWidth={1.5}
                strokeDasharray="6 3" strokeOpacity={0.7} />
            )}
          </g>
        </svg>
      )}
      {/* HTML overlay layer for MD Preview Cards — avoids WebKit foreignObject bug.
          Applies the same pan/zoom transform as the SVG `<g>` so cards stay aligned
          with post-its/groups. pointer-events: none on wrapper, auto on each card. */}
      <div className="fm-html-overlay" style={{
        position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none',
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, width: 0, height: 0,
          transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`,
          transformOrigin: '0 0',
        }}>
          {(annotations.mdCards ?? []).map(c => (
            <CanvasMdCard key={c.id} card={c} zoom={viewport.zoom}
              projectPath={projectPath}
              isSelected={selectedAnnotationId === c.id}
              isMultiSelected={multiSelectedIds.has(c.id)}
              onUpdate={onMdCardUpdate} onRemove={onMdCardRemove}
              onSelect={onAnnotationSelect} onMultiToggle={onMultiToggle}
              onGroupDragStart={handleGroupDragStart}
              onBeginDrag={onBeginDrag}
              onEndDrag={onEndDrag}
              onOpenFile={onOpenMdCardFile}
              onAnnotationDragStart={(id) => { dragAnnotationRef.current = id; }}
              onAnnotationDragEnd={handleAnnotationDragEnd} />
          ))}
        </div>
      </div>

      <FeatureMapMinimap
        graph={graph} layout={layout}
        customPositions={customPositions} viewport={viewport}
        containerSize={size} onNavigate={handleMinimapNavigate}
      />
      {/* Eject zone hint — top of canvas when dragging inside a component */}
      {insideComponent && ejectActive && (
        <div className="fm-eject-zone active">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
          Drop to eject from component
        </div>
      )}
    </div>
  );
}
