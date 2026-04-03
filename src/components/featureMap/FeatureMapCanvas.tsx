/**
 * Feature Map Canvas — Architecture Layers view (pure SVG)
 * Features auto-classified into horizontal layers.
 * Pan/zoom, hover highlighting, click→popover, drag-to-reposition nodes.
 */

import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { calculateLayeredLayout, classifyNode, LAYERS } from './featureMapLayout';
import type { FeatureGraph, NodePosition } from './featureMapTypes';
import type { LayerRect } from './featureMapLayout';

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
const NW = 240;
const NH = 72;
const NR = 12;
const DRAG_THRESHOLD = 4;

// Layer-specific node fills
const LAYER_NODE_BG: Record<string, string> = {
  ui: '#0d1a2a', logic: '#140d24', infra: '#111318',
};
const LAYER_NODE_ACCENT: Record<string, string> = {
  ui: 'rgba(0, 217, 255, 0.15)',
  logic: 'rgba(168, 85, 247, 0.15)',
  infra: 'rgba(100, 116, 139, 0.12)',
};

export interface NodeClickInfo {
  nodeId: string;
  screenX: number;
  screenY: number;
}

interface Props {
  graph: FeatureGraph;
  onNodeSelect: (info: NodeClickInfo | null) => void;
  selectedNodeId: string | null;
  customPositions: Map<string, NodePosition>;
  onNodeDrag: (nodeId: string, x: number, y: number) => void;
}

export default function FeatureMapCanvas({
  graph, onNodeSelect, selectedNodeId,
  customPositions, onNodeDrag,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [viewport, setViewport] = useState({ zoom: 1, panX: 0, panY: 0 });
  const [hovered, setHovered] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // Canvas pan ref
  const panRef = useRef({ active: false, x: 0, y: 0, panX: 0, panY: 0, didDrag: false });
  // Node drag ref
  const nodeDragRef = useRef<{
    nodeId: string; startX: number; startY: number;
    origX: number; origY: number; didDrag: boolean;
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(([e]) => setSize({
      w: e.contentRect.width, h: e.contentRect.height,
    }));
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const layout = useMemo(
    () => calculateLayeredLayout(graph.nodes, size.w > 0 ? size.w : 900),
    [graph.nodes, size.w],
  );

  // Effective position: custom override or auto-layout
  const getPos = useCallback((nodeId: string): NodePosition | undefined => {
    return customPositions.get(nodeId) ?? layout.positions.get(nodeId);
  }, [customPositions, layout.positions]);

  const nodeLayerMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const node of graph.nodes) m.set(node.id, classifyNode(node));
    return m;
  }, [graph.nodes]);

  const connected = useMemo(() => {
    if (!hovered) return new Set<string>();
    const s = new Set<string>();
    for (const l of graph.links) {
      if (l.source === hovered) s.add(l.target);
      if (l.target === hovered) s.add(l.source);
    }
    return s;
  }, [hovered, graph.links]);

  // Wheel → zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setViewport(v => ({
      ...v, zoom: Math.max(0.3, Math.min(2.5, v.zoom - e.deltaY * 0.002)),
    }));
  }, []);

  // Mousedown on canvas → start pan
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    panRef.current = {
      active: true, x: e.clientX, y: e.clientY,
      panX: viewport.panX, panY: viewport.panY, didDrag: false,
    };
  }, [viewport.panX, viewport.panY]);

  // Mousedown on node → start node drag
  const handleNodeMouseDown = useCallback((nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent canvas pan
    if (e.button !== 0) return;
    const pos = getPos(nodeId);
    if (!pos) return;
    nodeDragRef.current = {
      nodeId, startX: e.clientX, startY: e.clientY,
      origX: pos.x, origY: pos.y, didDrag: false,
    };
    setDraggingId(nodeId);
  }, [getPos]);

  // Mousemove → node drag or canvas pan
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    // Node drag takes priority
    const nd = nodeDragRef.current;
    if (nd) {
      const dx = e.clientX - nd.startX;
      const dy = e.clientY - nd.startY;
      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
        nd.didDrag = true;
      }
      if (nd.didDrag) {
        // Convert pixel delta to layout coords (account for zoom)
        onNodeDrag(nd.nodeId, nd.origX + dx / viewport.zoom, nd.origY + dy / viewport.zoom);
      }
      return;
    }
    // Canvas pan
    const d = panRef.current;
    if (!d.active) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) d.didDrag = true;
    if (d.didDrag) setViewport(v => ({ ...v, panX: d.panX + dx, panY: d.panY + dy }));
  }, [viewport.zoom, onNodeDrag]);

  // Mouseup → finalize
  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    const nd = nodeDragRef.current;
    if (nd) {
      if (!nd.didDrag) {
        // Click without drag → open popover
        onNodeSelect({ nodeId: nd.nodeId, screenX: e.clientX, screenY: e.clientY });
      }
      nodeDragRef.current = null;
      setDraggingId(null);
      return;
    }
    panRef.current.active = false;
  }, [onNodeSelect]);

  const handleBgClick = useCallback(() => {
    if (panRef.current.didDrag) return;
    onNodeSelect(null);
  }, [onNodeSelect]);

  const nodeOp = (id: string) => (!hovered ? 1 : id === hovered || connected.has(id) ? 1 : DIM);
  const linkOp = (s: string, t: string) => (!hovered ? 0.35 : s === hovered || t === hovered ? 1 : DIM);
  const linkCol = (s: string, t: string) => (
    !hovered ? LINK_COLOR : s === hovered || t === hovered ? LINK_HL : LINK_COLOR
  );
  const trunc = (t: string, m: number) => (t.length > m ? t.slice(0, m - 1) + '\u2026' : t);

  const curvePath = (x1: number, y1: number, x2: number, y2: number) => {
    const dy = Math.abs(y2 - y1);
    const cx = dy * 0.3;
    return `M${x1},${y1} C${x1 + cx},${y1} ${x2 - cx},${y2} ${x2},${y2}`;
  };

  const cursorStyle = draggingId ? 'grabbing' : panRef.current.didDrag ? 'grabbing' : 'grab';

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', background: BG, overflow: 'hidden', cursor: cursorStyle }}
      onWheel={handleWheel}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {size.w > 0 && (
        <svg width={size.w} height={size.h} style={{ display: 'block' }}>
          <rect width={size.w} height={size.h} fill="transparent" onClick={handleBgClick} />

          <g transform={`translate(${viewport.panX}, ${viewport.panY}) scale(${viewport.zoom})`}>
            {/* Layer backgrounds */}
            {layout.layerRects.map((lr: LayerRect) => (
              <g key={lr.layer.id}>
                <rect x={lr.x} y={lr.y} width={lr.width} height={lr.height}
                  rx={16} fill={lr.layer.color}
                  stroke={lr.layer.borderColor} strokeWidth={1} strokeOpacity={0.3} />
                <text x={lr.x + 18} y={lr.y + 28}
                  fill={lr.layer.borderColor} fontSize={14} fontWeight="700"
                  fontFamily="Inter, system-ui, sans-serif">
                  {lr.layer.label}
                </text>
              </g>
            ))}

            {/* Cross-layer connections */}
            {graph.links.map((link) => {
              const from = getPos(link.source);
              const to = getPos(link.target);
              if (!from || !to) return null;
              const w = Math.min(1 + link.sharedFiles.length * 0.5, 4);
              const isHl = hovered === link.source || hovered === link.target;
              const mx = (from.x + to.x) / 2;
              const my = (from.y + to.y) / 2;
              return (
                <g key={`lk-${link.source}-${link.target}`}>
                  <path d={curvePath(from.x, from.y, to.x, to.y)}
                    fill="none" stroke={linkCol(link.source, link.target)}
                    strokeWidth={w} opacity={linkOp(link.source, link.target)}
                    strokeLinecap="round" />
                  {isHl && link.sharedFiles.length > 0 && (
                    <>
                      <rect x={mx - 22} y={my - 11} width={44} height={22} rx={11} fill={LINK_HL} />
                      <text x={mx} y={my + 1} textAnchor="middle" dominantBaseline="central"
                        fill="#0a0e1a" fontSize={9} fontWeight="bold"
                        fontFamily="Inter, system-ui, sans-serif">
                        {link.sharedFiles.length} file
                      </text>
                    </>
                  )}
                </g>
              );
            })}

            {/* Feature nodes */}
            {graph.nodes.map((node) => {
              const pos = getPos(node.id);
              if (!pos) return null;
              const sel = node.id === selectedNodeId;
              const hov = node.id === hovered;
              const isDrag = node.id === draggingId;
              const layerId = nodeLayerMap.get(node.id) ?? 'infra';
              const nodeBg = LAYER_NODE_BG[layerId] ?? LAYER_NODE_BG.infra;
              const nodeAccent = LAYER_NODE_ACCENT[layerId] ?? LAYER_NODE_ACCENT.infra;
              const layer = LAYERS.find(l => l.id === layerId);
              const border = isDrag ? BORDER_DRAGGING
                : sel ? BORDER_SELECTED
                : hov ? BORDER_HOVER
                : (layer?.borderColor ?? BORDER_DEFAULT);
              const title = trunc(node.title, 28);
              const sub = node.files.length > 0
                ? `${node.files.length} file \u00B7 ${node.tags.slice(0, 2).join(', ')}`
                : node.tags.slice(0, 3).join(', ');
              const isCustom = customPositions.has(node.id);

              return (
                <g key={node.id} transform={`translate(${pos.x}, ${pos.y})`}
                  opacity={nodeOp(node.id)}
                  style={{ cursor: isDrag ? 'grabbing' : 'pointer' }}
                  onMouseEnter={() => setHovered(node.id)}
                  onMouseLeave={() => setHovered(null)}
                  onMouseDown={(e) => handleNodeMouseDown(node.id, e)}>
                  {/* Shadow */}
                  <rect x={-NW / 2 + 2} y={-NH / 2 + 3} width={NW} height={NH}
                    rx={NR} fill="rgba(0,0,0,0.3)" />
                  {/* Border glow */}
                  <rect x={-NW / 2} y={-NH / 2} width={NW} height={NH}
                    rx={NR} fill={border} />
                  {/* Fill */}
                  <rect x={-NW / 2 + 1.5} y={-NH / 2 + 1.5} width={NW - 3} height={NH - 3}
                    rx={NR - 1} fill={nodeBg} />
                  {/* Layer accent */}
                  <rect x={-NW / 2 + 1.5} y={-NH / 2 + 1.5} width={NW - 3} height={NH - 3}
                    rx={NR - 1} fill={nodeAccent} />
                  {/* Title */}
                  <text y={sub ? -8 : 0} textAnchor="middle" dominantBaseline="central"
                    fill={TEXT_1} fontSize={12} fontWeight="600"
                    fontFamily="Inter, system-ui, sans-serif">{title}</text>
                  {/* Subtitle */}
                  {sub && (
                    <text y={12} textAnchor="middle" dominantBaseline="central"
                      fill={TEXT_3} fontSize={10}
                      fontFamily="Inter, system-ui, sans-serif">{trunc(sub, 34)}</text>
                  )}
                  {/* File count badge */}
                  {node.files.length > 0 && (
                    <>
                      <rect x={NW / 2 - 30} y={-NH / 2 - 6} width={24} height={16}
                        rx={8} fill={BADGE_BG} stroke={BORDER_DEFAULT} strokeWidth={0.5} />
                      <text x={NW / 2 - 18} y={-NH / 2 + 2}
                        textAnchor="middle" dominantBaseline="central"
                        fill={TEXT_2} fontSize={9} fontWeight="bold"
                        fontFamily="Inter, system-ui, sans-serif">{node.files.length}</text>
                    </>
                  )}
                  {/* Custom position indicator */}
                  {isCustom && (
                    <circle cx={-NW / 2 + 8} cy={-NH / 2 + 8} r={3}
                      fill={BORDER_DRAGGING} opacity={0.6} />
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      )}
    </div>
  );
}
