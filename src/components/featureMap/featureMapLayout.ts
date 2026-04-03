/**
 * Feature Map — Architecture Layers layout
 * Features auto-classified into horizontal layers by tags.
 * Each layer is a row; nodes positioned within their layer.
 */

import type { FeatureNode, NodePosition } from './featureMapTypes';

export interface ArchLayer {
  id: string;
  label: string;
  emoji: string;
  color: string;       // Background tint
  borderColor: string;  // Layer border
  keywords: string[];   // Tags that map to this layer
}

export const LAYERS: ArchLayer[] = [
  {
    id: 'ui',
    label: 'UI Components',
    emoji: '',
    color: 'rgba(0, 217, 255, 0.06)',
    borderColor: '#5ce0ff',       // Bright cyan — legible on dark
    keywords: ['editor', 'codemirror', 'tab', 'popout', 'diff', 'highlighting', 'visualization', 'whiteboard', 'graph', 'pixi', 'feature-map', 'search', 'multi-tab'],
  },
  {
    id: 'logic',
    label: 'Business Logic',
    emoji: '',
    color: 'rgba(168, 85, 247, 0.06)',
    borderColor: '#c084fc',       // Bright purple — legible on dark
    keywords: ['permission', 'permission-modes', 'delegation', 'team', 'remote-api', 'agent-mode', 'sdk', 'build', 'plan', 'ask', 'debug', 'chat', 'mention', '025-team-delegation-footer'],
  },
  {
    id: 'infra',
    label: 'Infrastructure',
    emoji: '',
    color: 'rgba(100, 116, 139, 0.08)',
    borderColor: '#94a3b8',       // Bright slate — legible on dark
    keywords: ['terminal', 'ide', 'context-injection', 'saved-commands', 'git', 'tauri'],
  },
];

/** Classify a feature node into a layer based on its tags */
export function classifyNode(node: FeatureNode): string {
  const allTags = [...node.tags, ...node.id.toLowerCase().split(/[-_]/)];
  let bestLayer = 'infra'; // Default
  let bestScore = 0;

  for (const layer of LAYERS) {
    let score = 0;
    for (const kw of layer.keywords) {
      if (allTags.some(t => t.includes(kw) || kw.includes(t))) {
        score++;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestLayer = layer.id;
    }
  }

  return bestLayer;
}

/** Group nodes by layer */
export function groupByLayer(
  nodes: FeatureNode[],
): Map<string, FeatureNode[]> {
  const groups = new Map<string, FeatureNode[]>();
  for (const layer of LAYERS) {
    groups.set(layer.id, []);
  }

  for (const node of nodes) {
    const layerId = classifyNode(node);
    const list = groups.get(layerId) ?? [];
    list.push(node);
    groups.set(layerId, list);
  }

  return groups;
}

// Layout constants
const LAYER_PADDING_X = 24;
const LAYER_PADDING_TOP = 44; // Space for layer label
const LAYER_PADDING_BOTTOM = 20;
const NODE_W = 240;
const NODE_H = 72;
const NODE_GAP_X = 28;
const NODE_GAP_Y = 16;
const LAYER_GAP = 20;
const NODES_PER_ROW = 4;

export interface LayerRect {
  x: number;
  y: number;
  width: number;
  height: number;
  layer: ArchLayer;
}

export interface LayoutResult {
  positions: Map<string, NodePosition>;
  layerRects: LayerRect[];
  totalWidth: number;
  totalHeight: number;
}

/** Calculate layered positions for all nodes */
export function calculateLayeredLayout(
  nodes: FeatureNode[],
  canvasWidth: number,
): LayoutResult {
  const groups = groupByLayer(nodes);
  const positions = new Map<string, NodePosition>();
  const layerRects: LayerRect[] = [];

  // Dynamic columns based on canvas width
  const maxCols = Math.max(2, Math.min(NODES_PER_ROW, Math.floor(
    (canvasWidth - LAYER_PADDING_X * 2) / (NODE_W + NODE_GAP_X),
  )));

  const layerWidth = Math.max(
    canvasWidth - 60,
    maxCols * (NODE_W + NODE_GAP_X) + LAYER_PADDING_X * 2,
  );
  const startX = (canvasWidth - layerWidth) / 2;

  let currentY = 30;

  for (const layer of LAYERS) {
    const layerNodes = groups.get(layer.id) ?? [];
    if (layerNodes.length === 0) continue;

    const rows = Math.ceil(layerNodes.length / maxCols);
    const layerHeight = LAYER_PADDING_TOP + rows * (NODE_H + NODE_GAP_Y)
      - NODE_GAP_Y + LAYER_PADDING_BOTTOM;

    layerRects.push({
      x: startX,
      y: currentY,
      width: layerWidth,
      height: layerHeight,
      layer,
    });

    // Position nodes inside this layer
    for (let i = 0; i < layerNodes.length; i++) {
      const col = i % maxCols;
      const row = Math.floor(i / maxCols);
      // Center nodes within layer
      const nodesInRow = Math.min(maxCols, layerNodes.length - row * maxCols);
      const rowWidth = nodesInRow * (NODE_W + NODE_GAP_X) - NODE_GAP_X;
      const rowStartX = startX + (layerWidth - rowWidth) / 2;

      positions.set(layerNodes[i].id, {
        x: rowStartX + col * (NODE_W + NODE_GAP_X) + NODE_W / 2,
        y: currentY + LAYER_PADDING_TOP + row * (NODE_H + NODE_GAP_Y) + NODE_H / 2,
      });
    }

    currentY += layerHeight + LAYER_GAP;
  }

  return {
    positions,
    layerRects,
    totalWidth: layerWidth + startX * 2,
    totalHeight: currentY,
  };
}
