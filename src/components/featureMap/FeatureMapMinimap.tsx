/**
 * Feature Map Minimap — Small overview for navigation
 * Shows all nodes as dots + current viewport rectangle
 */

import { useMemo } from 'react';
import { classifyNode, LAYERS } from './featureMapLayout';
import type { FeatureGraph, NodePosition } from './featureMapTypes';
import type { LayoutResult } from './featureMapLayout';

const MM_W = 160;
const MM_H = 100;
const MM_PAD = 6;
const DOT_R = 3;

interface Props {
  graph: FeatureGraph;
  layout: LayoutResult;
  customPositions: Map<string, NodePosition>;
  viewport: { zoom: number; panX: number; panY: number };
  containerSize: { w: number; h: number };
  onNavigate: (panX: number, panY: number) => void;
}

export default function FeatureMapMinimap({
  graph, layout, customPositions, viewport,
  containerSize, onNavigate,
}: Props) {
  const getPos = (id: string) =>
    customPositions.get(id) ?? layout.positions.get(id);

  // Scale factor: fit all content into minimap
  const scale = useMemo(() => {
    if (layout.totalWidth === 0 || layout.totalHeight === 0) return 1;
    const sx = (MM_W - MM_PAD * 2) / layout.totalWidth;
    const sy = (MM_H - MM_PAD * 2) / layout.totalHeight;
    return Math.min(sx, sy);
  }, [layout.totalWidth, layout.totalHeight]);

  // Viewport rectangle in minimap coords
  const vpRect = useMemo(() => {
    const x = (-viewport.panX / viewport.zoom) * scale + MM_PAD;
    const y = (-viewport.panY / viewport.zoom) * scale + MM_PAD;
    const w = (containerSize.w / viewport.zoom) * scale;
    const h = (containerSize.h / viewport.zoom) * scale;
    return { x, y, w, h };
  }, [viewport, containerSize, scale]);

  const layerColors: Record<string, string> = {};
  for (const l of LAYERS) layerColors[l.id] = l.borderColor;

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    // Convert minimap coords to svg coords, center viewport
    const svgX = (mx - MM_PAD) / scale;
    const svgY = (my - MM_PAD) / scale;
    const panX = -(svgX - containerSize.w / (2 * viewport.zoom)) * viewport.zoom;
    const panY = -(svgY - containerSize.h / (2 * viewport.zoom)) * viewport.zoom;
    onNavigate(panX, panY);
  };

  if (graph.nodes.length === 0) return null;

  return (
    <div style={{
      position: 'absolute', bottom: 12, right: 12,
      background: 'rgba(10, 14, 26, 0.85)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 8, padding: 2, backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      zIndex: 10,
    }}>
      <svg width={MM_W} height={MM_H} style={{ display: 'block', cursor: 'crosshair' }}
        onClick={handleClick}>
        {/* Node dots */}
        {graph.nodes.map(node => {
          const pos = getPos(node.id);
          if (!pos) return null;
          const layerId = classifyNode(node);
          return (
            <circle key={node.id}
              cx={pos.x * scale + MM_PAD}
              cy={pos.y * scale + MM_PAD}
              r={DOT_R}
              fill={layerColors[layerId] ?? '#94a3b8'}
              opacity={0.7}
            />
          );
        })}
        {/* Viewport indicator */}
        <rect x={vpRect.x} y={vpRect.y} width={vpRect.w} height={vpRect.h}
          fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={1} rx={2} />
      </svg>
    </div>
  );
}
