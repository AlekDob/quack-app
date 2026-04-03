/**
 * Feature Map Canvas — Architecture Layers + annotations (pure SVG)
 * Pan/zoom, hover highlighting, click→popover, drag-to-reposition,
 * post-it notes, group rectangles.
 */

import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { calculateLayeredLayout, classifyNode, LAYERS } from './featureMapLayout';
import type { FeatureGraph, NodePosition } from './featureMapTypes';
import type { LayerRect } from './featureMapLayout';
import type { CanvasAnnotations, AnnotationMode, PostIt, GroupRect } from './annotationTypes';
import { GROUP_MIN_W, GROUP_MIN_H } from './annotationTypes';
import CanvasPostIt from './CanvasPostIt';
import CanvasGroupRect from './CanvasGroupRect';

const BG = '#0a0e1a';
const BORDER_DEFAULT = '#1e293b';
const BORDER_HOVER = '#00d9ff';
const BORDER_SELECTED = '#ff6b35';
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

const LAYER_NODE_BG: Record<string, string> = { ui: '#0d1a2a', logic: '#140d24', infra: '#111318' };
const LAYER_NODE_ACCENT: Record<string, string> = {
  ui: 'rgba(0,217,255,0.15)', logic: 'rgba(168,85,247,0.15)', infra: 'rgba(100,116,139,0.12)',
};

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
}

export default function FeatureMapCanvas(props: Props) {
  const {
    graph, onNodeSelect, selectedNodeId, customPositions, onNodeDrag,
    annotations, annotationMode, selectedAnnotationId, onAnnotationSelect,
    onPostItAdd, onPostItUpdate, onPostItRemove,
    onGroupAdd, onGroupUpdate, onGroupRemove,
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [viewport, setViewport] = useState({ zoom: 1, panX: 0, panY: 0 });
  const [hovered, setHovered] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [drawingRect, setDrawingRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const panRef = useRef({ active: false, x: 0, y: 0, panX: 0, panY: 0, didDrag: false });
  const nodeDragRef = useRef<{ nodeId: string; startX: number; startY: number; origX: number; origY: number; didDrag: boolean } | null>(null);
  const groupDrawRef = useRef<{ sx: number; sy: number; svgSx: number; svgSy: number } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const layout = useMemo(() => calculateLayeredLayout(graph.nodes, size.w > 0 ? size.w : 900), [graph.nodes, size.w]);
  const getPos = useCallback((id: string) => customPositions.get(id) ?? layout.positions.get(id), [customPositions, layout.positions]);
  const nodeLayerMap = useMemo(() => { const m = new Map<string, string>(); for (const n of graph.nodes) m.set(n.id, classifyNode(n)); return m; }, [graph.nodes]);
  const connected = useMemo(() => { if (!hovered) return new Set<string>(); const s = new Set<string>(); for (const l of graph.links) { if (l.source === hovered) s.add(l.target); if (l.target === hovered) s.add(l.source); } return s; }, [hovered, graph.links]);

  const toSvg = useCallback((clientX: number, clientY: number) => {
    const r = containerRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return { x: (clientX - r.left - viewport.panX) / viewport.zoom, y: (clientY - r.top - viewport.panY) / viewport.zoom };
  }, [viewport]);

  const handleWheel = useCallback((e: React.WheelEvent) => { e.preventDefault(); setViewport(v => ({ ...v, zoom: Math.max(0.3, Math.min(2.5, v.zoom - e.deltaY * 0.002)) })); }, []);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (annotationMode === 'postit') {
      const svg = toSvg(e.clientX, e.clientY);
      onPostItAdd(svg.x, svg.y);
      return;
    }
    if (annotationMode === 'group') {
      const svg = toSvg(e.clientX, e.clientY);
      groupDrawRef.current = { sx: e.clientX, sy: e.clientY, svgSx: svg.x, svgSy: svg.y };
      setDrawingRect({ x: svg.x, y: svg.y, w: 0, h: 0 });
      return;
    }
    panRef.current = { active: true, x: e.clientX, y: e.clientY, panX: viewport.panX, panY: viewport.panY, didDrag: false };
  }, [annotationMode, viewport.panX, viewport.panY, toSvg, onPostItAdd]);

  const handleNodeMouseDown = useCallback((nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    const pos = getPos(nodeId);
    if (!pos) return;
    nodeDragRef.current = { nodeId, startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y, didDrag: false };
    setDraggingId(nodeId);
  }, [getPos]);

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
  }, [viewport.zoom, onNodeDrag, toSvg]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    // Group drawing finalize
    const gd = groupDrawRef.current;
    if (gd && drawingRect) {
      if (drawingRect.w >= GROUP_MIN_W && drawingRect.h >= GROUP_MIN_H) {
        onGroupAdd(drawingRect.x, drawingRect.y, drawingRect.w, drawingRect.h);
      }
      groupDrawRef.current = null;
      setDrawingRect(null);
      return;
    }
    // Node drag finalize
    const nd = nodeDragRef.current;
    if (nd) {
      if (!nd.didDrag) onNodeSelect({ nodeId: nd.nodeId, screenX: e.clientX, screenY: e.clientY });
      nodeDragRef.current = null;
      setDraggingId(null);
      return;
    }
    panRef.current.active = false;
  }, [onNodeSelect, onGroupAdd, drawingRect]);

  const handleBgClick = useCallback(() => {
    if (panRef.current.didDrag) return;
    if (annotationMode === 'select') { onNodeSelect(null); onAnnotationSelect(null); }
  }, [onNodeSelect, onAnnotationSelect, annotationMode]);

  const nodeOp = (id: string) => (!hovered ? 1 : id === hovered || connected.has(id) ? 1 : DIM);
  const linkOp = (s: string, t: string) => (!hovered ? 0.35 : s === hovered || t === hovered ? 1 : DIM);
  const linkCol = (s: string, t: string) => (!hovered ? LINK_COLOR : s === hovered || t === hovered ? LINK_HL : LINK_COLOR);
  const trunc = (t: string, m: number) => (t.length > m ? t.slice(0, m - 1) + '\u2026' : t);
  const curvePath = (x1: number, y1: number, x2: number, y2: number) => { const d = Math.abs(y2 - y1) * 0.3; return `M${x1},${y1} C${x1 + d},${y1} ${x2 - d},${y2} ${x2},${y2}`; };

  const cursor = draggingId ? 'grabbing' : annotationMode === 'postit' ? 'crosshair' : annotationMode === 'group' ? 'crosshair' : 'grab';

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', background: BG, overflow: 'hidden', cursor }}
      onWheel={handleWheel} onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
      {size.w > 0 && (
        <svg width={size.w} height={size.h} style={{ display: 'block' }}>
          <rect width={size.w} height={size.h} fill="transparent" onClick={handleBgClick} />
          <g transform={`translate(${viewport.panX},${viewport.panY}) scale(${viewport.zoom})`}>

            {/* Z1: Group rect annotations */}
            {annotations.groups.map(g => (
              <CanvasGroupRect key={g.id} group={g} zoom={viewport.zoom}
                isSelected={selectedAnnotationId === g.id}
                onUpdate={onGroupUpdate} onRemove={onGroupRemove} onSelect={onAnnotationSelect} />
            ))}

            {/* Z2: Layer backgrounds */}
            {layout.layerRects.map((lr: LayerRect) => (
              <g key={lr.layer.id}>
                <rect x={lr.x} y={lr.y} width={lr.width} height={lr.height} rx={16}
                  fill={lr.layer.color} stroke={lr.layer.borderColor} strokeWidth={1} strokeOpacity={0.3} />
                <text x={lr.x + 18} y={lr.y + 28} fill={lr.layer.borderColor} fontSize={14}
                  fontWeight="700" fontFamily="Inter, system-ui, sans-serif">{lr.layer.label}</text>
              </g>
            ))}

            {/* Z3: Links */}
            {graph.links.map(link => {
              const from = getPos(link.source); const to = getPos(link.target);
              if (!from || !to) return null;
              const isHl = hovered === link.source || hovered === link.target;
              const mx = (from.x + to.x) / 2; const my = (from.y + to.y) / 2;
              return (
                <g key={`lk-${link.source}-${link.target}`}>
                  <path d={curvePath(from.x, from.y, to.x, to.y)} fill="none"
                    stroke={linkCol(link.source, link.target)}
                    strokeWidth={Math.min(1 + link.sharedFiles.length * 0.5, 4)}
                    opacity={linkOp(link.source, link.target)} strokeLinecap="round" />
                  {isHl && link.sharedFiles.length > 0 && (
                    <><rect x={mx - 22} y={my - 11} width={44} height={22} rx={11} fill={LINK_HL} />
                    <text x={mx} y={my + 1} textAnchor="middle" dominantBaseline="central"
                      fill="#0a0e1a" fontSize={9} fontWeight="bold" fontFamily="Inter, system-ui, sans-serif">{link.sharedFiles.length} file</text></>
                  )}
                </g>);
            })}

            {/* Z4: Feature nodes */}
            {graph.nodes.map(node => {
              const pos = getPos(node.id); if (!pos) return null;
              const sel = node.id === selectedNodeId; const hov = node.id === hovered; const isDrag = node.id === draggingId;
              const layerId = nodeLayerMap.get(node.id) ?? 'infra';
              const layer = LAYERS.find(l => l.id === layerId);
              const border = isDrag ? BORDER_DRAGGING : sel ? BORDER_SELECTED : hov ? BORDER_HOVER : (layer?.borderColor ?? BORDER_DEFAULT);
              const title = trunc(node.title, 28);
              const sub = node.files.length > 0 ? `${node.files.length} file \u00B7 ${node.tags.slice(0, 2).join(', ')}` : node.tags.slice(0, 3).join(', ');
              return (
                <g key={node.id} transform={`translate(${pos.x},${pos.y})`} opacity={nodeOp(node.id)}
                  style={{ cursor: isDrag ? 'grabbing' : 'pointer' }}
                  onMouseEnter={() => setHovered(node.id)} onMouseLeave={() => setHovered(null)}
                  onMouseDown={e => handleNodeMouseDown(node.id, e)}>
                  <rect x={-NW/2+2} y={-NH/2+3} width={NW} height={NH} rx={NR} fill="rgba(0,0,0,0.3)" />
                  <rect x={-NW/2} y={-NH/2} width={NW} height={NH} rx={NR} fill={border} />
                  <rect x={-NW/2+1.5} y={-NH/2+1.5} width={NW-3} height={NH-3} rx={NR-1} fill={LAYER_NODE_BG[layerId]??LAYER_NODE_BG.infra} />
                  <rect x={-NW/2+1.5} y={-NH/2+1.5} width={NW-3} height={NH-3} rx={NR-1} fill={LAYER_NODE_ACCENT[layerId]??LAYER_NODE_ACCENT.infra} />
                  <text y={sub?-8:0} textAnchor="middle" dominantBaseline="central" fill={TEXT_1} fontSize={12} fontWeight="600" fontFamily="Inter, system-ui, sans-serif">{title}</text>
                  {sub && <text y={12} textAnchor="middle" dominantBaseline="central" fill={TEXT_3} fontSize={10} fontFamily="Inter, system-ui, sans-serif">{trunc(sub,34)}</text>}
                  {node.files.length > 0 && (<><rect x={NW/2-30} y={-NH/2-6} width={24} height={16} rx={8} fill={BADGE_BG} stroke={BORDER_DEFAULT} strokeWidth={0.5} /><text x={NW/2-18} y={-NH/2+2} textAnchor="middle" dominantBaseline="central" fill={TEXT_2} fontSize={9} fontWeight="bold" fontFamily="Inter, system-ui, sans-serif">{node.files.length}</text></>)}
                  {customPositions.has(node.id) && <circle cx={-NW/2+8} cy={-NH/2+8} r={3} fill={BORDER_DRAGGING} opacity={0.6} />}
                </g>);
            })}

            {/* Z5: Post-it annotations */}
            {annotations.postIts.map(p => (
              <CanvasPostIt key={p.id} postIt={p} zoom={viewport.zoom}
                isSelected={selectedAnnotationId === p.id}
                onUpdate={onPostItUpdate} onRemove={onPostItRemove} onSelect={onAnnotationSelect} />
            ))}

            {/* Group drawing preview */}
            {drawingRect && drawingRect.w > 5 && (
              <rect x={drawingRect.x} y={drawingRect.y} width={drawingRect.w} height={drawingRect.h}
                rx={12} fill="rgba(0,217,255,0.05)" stroke="#00d9ff" strokeWidth={2}
                strokeDasharray="8 4" strokeOpacity={0.6} />
            )}
          </g>
        </svg>
      )}
    </div>
  );
}
