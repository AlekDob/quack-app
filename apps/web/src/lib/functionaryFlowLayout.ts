// Adapted from Functionary (MIT), Copyright (c) 2026 Nemanja Stojanovic.

import { type FunctionaryEdge, type FunctionaryNode } from "./functionaryMap";

export interface FunctionaryFlowLayout {
  positions: Map<string, [number, number]>;
  neighborhoods: Array<{
    id: string;
    label: string;
    nodeIds: string[];
    bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  }>;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

export function functionaryChildPlaqueWidth(label: string): number {
  return Math.max(2.2, Math.min(3.4, 1.55 + label.length * 0.055));
}

export function computeFunctionaryChildPositions(
  nodes: readonly FunctionaryNode[],
  parentPosition: [number, number],
): Map<string, [number, number]> {
  const columns = Math.min(3, nodes.length);
  const positions = new Map<string, [number, number]>();
  const gap = 0.5;

  for (let row = 0; row * columns < nodes.length; row += 1) {
    const rowNodes = nodes.slice(row * columns, row * columns + columns);
    const widths = rowNodes.map((node) => functionaryChildPlaqueWidth(node.label));
    const rowWidth =
      widths.reduce((total, width) => total + width, 0) + gap * Math.max(0, rowNodes.length - 1);
    let cursor = parentPosition[0] - rowWidth / 2;
    rowNodes.forEach((node, column) => {
      const width = widths[column]!;
      positions.set(node.id, [cursor + width / 2, parentPosition[1] + 3.2 + row * 2.55]);
      cursor += width + gap;
    });
  }

  return positions;
}

const NODE_STEP_X = 4.6;
const LAYER_STEP_Z = 5.2;
const NEIGHBORHOOD_GAP = 3.2;

export function computeFunctionaryFlowLayout(
  nodes: readonly FunctionaryNode[],
  allNodes: readonly FunctionaryNode[],
): FunctionaryFlowLayout {
  if (nodes.length === 0) {
    return {
      positions: new Map(),
      neighborhoods: [],
      bounds: { minX: -1, maxX: 1, minZ: -1, maxZ: 1 },
    };
  }

  const scopes = allNodes.filter((node) => node.kind === "scope");
  const scopeById = new Map(scopes.map((scope) => [scope.id, scope]));
  const scopeOrder = new Map(scopes.map((scope, index) => [scope.id, index]));
  const grouped = new Map<string, FunctionaryNode[]>();

  for (const node of nodes) {
    const neighborhoodId =
      node.parentId && scopeById.has(node.parentId) ? node.parentId : "__system";
    grouped.set(neighborhoodId, [...(grouped.get(neighborhoodId) ?? []), node]);
  }

  const groups = [...grouped.entries()].sort(
    ([left], [right]) =>
      (scopeOrder.get(left) ?? Number.MAX_SAFE_INTEGER) -
        (scopeOrder.get(right) ?? Number.MAX_SAFE_INTEGER) || left.localeCompare(right),
  );
  const widths = groups.map(([, group]) => Math.max(7.6, Math.min(3, group.length) * NODE_STEP_X));
  const totalWidth =
    widths.reduce((total, width) => total + width, 0) +
    Math.max(0, widths.length - 1) * NEIGHBORHOOD_GAP;
  const positions = new Map<string, [number, number]>();
  let cursor = -totalWidth / 2;

  const neighborhoods = groups.map(([id, group], groupIndex) => {
    const width = widths[groupIndex]!;
    const centerX = cursor + width / 2;
    const layers = new Map<number, FunctionaryNode[]>();

    for (const node of group) {
      const layer = node.display?.flowLayer ?? 0;
      layers.set(layer, [...(layers.get(layer) ?? []), node]);
    }

    const maxLayer = Math.max(...layers.keys(), 0);
    for (const [layer, layerNodes] of layers) {
      layerNodes.sort(
        (left, right) =>
          (left.display?.flowOrder ?? Number.MAX_SAFE_INTEGER) -
            (right.display?.flowOrder ?? Number.MAX_SAFE_INTEGER) ||
          left.label.localeCompare(right.label),
      );
      layerNodes.forEach((node, index) => {
        positions.set(node.id, [
          centerX + (index - (layerNodes.length - 1) / 2) * NODE_STEP_X,
          (maxLayer / 2 - layer) * LAYER_STEP_Z,
        ]);
      });
    }

    const extents = group.map((node) => {
      const [x, z] = positions.get(node.id)!;
      return { minX: x - 2.2, maxX: x + 2.2, minZ: z - 1.4, maxZ: z + 2.5 };
    });
    const neighborhood = {
      id,
      label: scopeById.get(id)?.label ?? "System",
      nodeIds: group.map((node) => node.id),
      bounds: {
        minX: Math.min(...extents.map((item) => item.minX)) - 0.8,
        maxX: Math.max(...extents.map((item) => item.maxX)) + 0.8,
        minZ: Math.min(...extents.map((item) => item.minZ)) - 0.8,
        maxZ: Math.max(...extents.map((item) => item.maxZ)) + 1.1,
      },
    };
    cursor += width + NEIGHBORHOOD_GAP;
    return neighborhood;
  });

  return {
    positions,
    neighborhoods,
    bounds: {
      minX: Math.min(...neighborhoods.map((item) => item.bounds.minX)),
      maxX: Math.max(...neighborhoods.map((item) => item.bounds.maxX)),
      minZ: Math.min(...neighborhoods.map((item) => item.bounds.minZ)),
      maxZ: Math.max(...neighborhoods.map((item) => item.bounds.maxZ)),
    },
  };
}

export function projectFunctionaryEdges(
  nodes: readonly FunctionaryNode[],
  edges: readonly FunctionaryEdge[],
  allNodes: readonly FunctionaryNode[],
): FunctionaryEdge[] {
  const visibleIds = new Set(nodes.map((node) => node.id));
  const nodeById = new Map(allNodes.map((node) => [node.id, node]));
  const ancestor = (nodeId: string) => {
    let node = nodeById.get(nodeId);
    while (node) {
      if (visibleIds.has(node.id)) return node.id;
      node = node.parentId ? nodeById.get(node.parentId) : undefined;
    }
    return null;
  };
  const projected = new Map<string, FunctionaryEdge>();
  const priority = { observed: 3, declared: 2, inferred: 1 } as const;

  for (const edge of edges) {
    const from = ancestor(edge.from);
    const to = ancestor(edge.to);
    if (!from || !to || from === to) continue;
    const key = `${from}->${to}`;
    const current = projected.get(key);
    if (!current || priority[edge.evidence] > priority[current.evidence]) {
      projected.set(key, { ...edge, id: `visible:${key}`, from, to });
    }
  }
  return [...projected.values()];
}
