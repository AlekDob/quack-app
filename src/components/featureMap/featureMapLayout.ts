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
export const LEFT_MARGIN = 30;
export const LEGEND_H = 36;       // Space for legend row at top
export const NODE_W = 240;
export const NODE_H = 72;
export const NODE_GAP_X = 16;
export const NODE_GAP_Y = 12;
const DEFAULT_COLS = 2;

export interface LayerRect {
  x: number;
  y: number;
  width: number;
  height: number;
  layer: ArchLayer;
}

export interface LayoutResult {
  positions: Map<string, NodePosition>;
  layerRects: LayerRect[];  // kept for compatibility, empty in flat mode
  totalWidth: number;
  totalHeight: number;
}

/** Flat layout — all nodes in 2 columns, sorted by layer then title */
export function calculateLayeredLayout(
  nodes: FeatureNode[],
  _canvasWidth: number,
  _collapsedLayers?: Set<string>,
): LayoutResult {
  const positions = new Map<string, NodePosition>();

  // Sort: by layer order, then alphabetically by title
  const layerOrder = LAYERS.map(l => l.id);
  const sorted = [...nodes].sort((a, b) => {
    const la = layerOrder.indexOf(classifyNode(a));
    const lb = layerOrder.indexOf(classifyNode(b));
    if (la !== lb) return la - lb;
    return a.title.localeCompare(b.title);
  });

  const cols = sorted.length <= 3 ? 1 : DEFAULT_COLS;
  const contentWidth = cols * NODE_W + (cols - 1) * NODE_GAP_X;
  const startY = LEGEND_H + 16; // after legend

  for (let i = 0; i < sorted.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions.set(sorted[i].id, {
      x: LEFT_MARGIN + col * (NODE_W + NODE_GAP_X) + NODE_W / 2,
      y: startY + row * (NODE_H + NODE_GAP_Y) + NODE_H / 2,
    });
  }

  const rows = Math.ceil(sorted.length / cols);
  const totalHeight = startY + rows * (NODE_H + NODE_GAP_Y);

  return {
    positions,
    layerRects: [], // no layer rects in flat mode
    totalWidth: LEFT_MARGIN + contentWidth + 60,
    totalHeight,
  };
}
