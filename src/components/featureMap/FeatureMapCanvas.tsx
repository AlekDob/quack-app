/**
 * Feature Map Canvas — Architecture Layers view (pure SVG)
 * Features auto-classified into horizontal layers.
 * Pan/zoom, hover highlighting, click→popover.
 */

import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { calculateLayeredLayout, classifyNode, LAYERS } from './featureMapLayout';
import type { FeatureGraph } from './featureMapTypes';
import type { LayerRect } from './featureMapLayout';

const BG = '#0a0e1a';
const BORDER_DEFAULT = '#1e293b';
const BORDER_HOVER = '#00d9ff';
const BORDER_SELECTED = '#ff6b35';
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

// Layer-specific node fills (darker versions of layer colors)
const LAYER_NODE_BG: Record<string, string> = {
  ui: '#0d1a2a',       // Blue-tinted dark
  logic: '#140d24',    // Purple-tinted dark
  infra: '#111318',    // Gray-tinted dark
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
}

export default function FeatureMapCanvas({ graph, onNodeSelect, selectedNodeId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [viewport, setViewport] = useState({ zoom: 1, panX: 0, panY: 0 });
  const [hovered, setHovered] = useState<string | null>(null);
  const dragRef = useRef({ active: false, x: 0, y: 0, panX: 0, panY: 0, didDrag: false });

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const layout = useMemo(
    () => calculateLayeredLayout(graph.nodes, size.w > 0 ? size.w : 900),
    [graph.nodes, size.w],
  );

  // Classify each node into a layer for coloring
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

  // Pan/Zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setViewport(v => ({
      ...v,
      zoom: Math.max(0.3, Math.min(2.5, v.zoom - e.deltaY * 0.002)),
    }));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragRef.current = {
      active: true, x: e.clientX, y: e.clientY,
      panX: viewport.panX, panY: viewport.panY, didDrag: false,
    };
  }, [viewport.panX, viewport.panY]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const d = dragRef.current;
    if (!d.active) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) d.didDrag = true;
    if (d.didDrag) setViewport(v => ({ ...v, panX: d.panX + dx, panY: d.panY + dy }));
  }, []);

  const handleMouseUp = useCallback(() => { dragRef.current.active = false; }, []);

  const nodeOp = (id: string) => (!hovered ? 1 : id === hovered || connected.has(id) ? 1 : DIM);
  const linkOp = (s: string, t: string) => (!hovered ? 0.35 : s === hovered || t === hovered ? 1 : DIM);
  const linkCol = (s: string, t: string) => (
    !hovered ? LINK_COLOR : s === hovered || t === hovered ? LINK_HL : LINK_COLOR
  );
  const trunc = (t: string, m: number) => (t.length > m ? t.slice(0, m - 1) + '\u2026' : t);

  const handleNodeClick = useCallback((nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (dragRef.current.didDrag) return;
    // Use mouse click coordinates directly — always accurate
    onNodeSelect({ nodeId, screenX: e.clientX, screenY: e.clientY });
  }, [onNodeSelect]);

  const handleBgClick = useCallback(() => {
    if (dragRef.current.didDrag) return;
    onNodeSelect(null);
  }, [onNodeSelect]);

  // Curve path for cross-layer links
  const curvePath = (x1: number, y1: number, x2: number, y2: number) => {
    const dy = Math.abs(y2 - y1);
    const cx = dy * 0.3;
    return `M${x1},${y1} C${x1 + cx},${y1} ${x2 - cx},${y2} ${x2},${y2}`;
  };

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', background: BG, overflow: 'hidden',
        cursor: dragRef.current.didDrag ? 'grabbing' : 'grab' }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
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
                <rect
                  x={lr.x} y={lr.y} width={lr.width} height={lr.height}
                  rx={16} fill={lr.layer.color}
                  stroke={lr.layer.borderColor} strokeWidth={1} strokeOpacity={0.3}
                />
                <text
                  x={lr.x + 18} y={lr.y + 28}
                  fill={lr.layer.borderColor} fontSize={14} fontWeight="700"
                  fontFamily="Inter, system-ui, sans-serif"
                >
                  {lr.layer.label}
                </text>
              </g>
            ))}

            {/* Cross-layer connections (curved) */}
            {graph.links.map((link) => {
              const from = layout.positions.get(link.source);
              const to = layout.positions.get(link.target);
              if (!from || !to) return null;
              const w = Math.min(1 + link.sharedFiles.length * 0.5, 4);
              const isHl = hovered === link.source || hovered === link.target;
              const mx = (from.x + to.x) / 2;
              const my = (from.y + to.y) / 2;
              return (
                <g key={`lk-${link.source}-${link.target}`}>
                  <path
                    d={curvePath(from.x, from.y, to.x, to.y)}
                    fill="none"
                    stroke={linkCol(link.source, link.target)}
                    strokeWidth={w}
                    opacity={linkOp(link.source, link.target)}
                    strokeLinecap="round"
                  />
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

            {/* Feature nodes — colored by layer */}
            {graph.nodes.map((node) => {
              const pos = layout.positions.get(node.id);
              if (!pos) return null;
              const sel = node.id === selectedNodeId;
              const hov = node.id === hovered;
              const layerId = nodeLayerMap.get(node.id) ?? 'infra';
              const nodeBg = LAYER_NODE_BG[layerId] ?? LAYER_NODE_BG.infra;
              const nodeAccent = LAYER_NODE_ACCENT[layerId] ?? LAYER_NODE_ACCENT.infra;
              const layer = LAYERS.find(l => l.id === layerId);
              const border = sel ? BORDER_SELECTED : hov ? BORDER_HOVER : (layer?.borderColor ?? BORDER_DEFAULT);
              const title = trunc(node.title, 28);
              const sub = node.files.length > 0
                ? `${node.files.length} file \u00B7 ${node.tags.slice(0, 2).join(', ')}`
                : node.tags.slice(0, 3).join(', ');

              return (
                <g key={node.id} transform={`translate(${pos.x}, ${pos.y})`}
                  opacity={nodeOp(node.id)} style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHovered(node.id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={(e) => handleNodeClick(node.id, e)}>
                  {/* Shadow */}
                  <rect x={-NW / 2 + 2} y={-NH / 2 + 3} width={NW} height={NH}
                    rx={NR} fill="rgba(0,0,0,0.3)" />
                  {/* Border glow */}
                  <rect x={-NW / 2} y={-NH / 2} width={NW} height={NH}
                    rx={NR} fill={border} />
                  {/* Accent gradient fill */}
                  <rect x={-NW / 2 + 1.5} y={-NH / 2 + 1.5} width={NW - 3} height={NH - 3}
                    rx={NR - 1} fill={nodeBg} />
                  {/* Subtle layer accent overlay */}
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
                </g>
              );
            })}
          </g>
        </svg>
      )}
    </div>
  );
}
