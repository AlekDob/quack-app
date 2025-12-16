/**
 * Outline Tree Builder Service
 * Converts MCP Memory entities/relations into a hierarchical tree structure for the outliner
 */

import type { MCPEntity, MCPRelation, MCPKnowledgeGraph } from './mcpMemoryService';

export interface OutlineNode {
  id: string;
  entityName: string;
  content: string;
  entityType: string;
  observations: string[];
  children: OutlineNode[];
  parentId: string | null;
  depth: number;
  isExpanded: boolean;
  mentions: string[]; // Entity names mentioned via @
  createdAt?: number;
}

export interface OutlineTree {
  roots: OutlineNode[];
  nodeMap: Map<string, OutlineNode>;
  totalNodes: number;
}

/**
 * Parse @mentions from content text
 */
export function parseMentions(content: string): string[] {
  const mentionRegex = /@([a-zA-Z0-9_-]+)/g;
  const mentions: string[] = [];
  let match;
  while ((match = mentionRegex.exec(content)) !== null) {
    mentions.push(match[1]);
  }
  return mentions;
}

/**
 * Parse #supertag from content text
 */
export function parseSupertag(content: string): string | null {
  const tagRegex = /#([a-zA-Z0-9_-]+)/;
  const match = content.match(tagRegex);
  return match ? match[1] : null;
}

/**
 * Remove @mentions and #tags from content for display
 */
export function cleanContent(content: string): string {
  return content
    .replace(/@[a-zA-Z0-9_-]+/g, '')
    .replace(/#[a-zA-Z0-9_-]+/g, '')
    .trim();
}

/**
 * Build a hierarchical tree from MCP entities and relations
 *
 * Rules:
 * - Relations with type "contains" define parent-child relationships
 * - Entities without a "contains" parent are root nodes
 * - All other relation types are treated as @mentions
 */
export function buildOutlineTree(graph: MCPKnowledgeGraph): OutlineTree {
  const nodeMap = new Map<string, OutlineNode>();
  const childToParent = new Map<string, string>();

  // First pass: Create nodes for all entities
  for (const entity of graph.entities) {
    const content = entity.observations[0] || entity.name;
    const mentions = parseMentions(content);

    const node: OutlineNode = {
      id: entity.name,
      entityName: entity.name,
      content: cleanContent(content),
      entityType: entity.entityType,
      observations: entity.observations,
      children: [],
      parentId: null,
      depth: 0,
      isExpanded: true,
      mentions,
    };

    nodeMap.set(entity.name, node);
  }

  // Second pass: Build parent-child relationships from "contains" relations
  for (const relation of graph.relations) {
    if (relation.relationType === 'contains') {
      childToParent.set(relation.to, relation.from);
    }
  }

  // Third pass: Link children to parents and compute depths
  for (const [childName, parentName] of childToParent) {
    const child = nodeMap.get(childName);
    const parent = nodeMap.get(parentName);

    if (child && parent) {
      child.parentId = parentName;
      parent.children.push(child);
    }
  }

  // Fourth pass: Compute depths (BFS from roots)
  const roots: OutlineNode[] = [];
  for (const node of nodeMap.values()) {
    if (node.parentId === null) {
      roots.push(node);
      computeDepth(node, 0);
    }
  }

  // Sort roots by entityType first, then by name
  roots.sort((a, b) => {
    if (a.entityType !== b.entityType) {
      return a.entityType.localeCompare(b.entityType);
    }
    return a.content.localeCompare(b.content);
  });

  return {
    roots,
    nodeMap,
    totalNodes: nodeMap.size,
  };
}

/**
 * Recursively compute depth for a node and its children
 */
function computeDepth(node: OutlineNode, depth: number): void {
  node.depth = depth;
  for (const child of node.children) {
    computeDepth(child, depth + 1);
  }
}

/**
 * Find a node by ID in the tree
 */
export function findNode(tree: OutlineTree, nodeId: string): OutlineNode | undefined {
  return tree.nodeMap.get(nodeId);
}

/**
 * Get all nodes as a flat array (for search/filter)
 */
export function flattenTree(tree: OutlineTree): OutlineNode[] {
  const result: OutlineNode[] = [];

  function traverse(node: OutlineNode) {
    result.push(node);
    for (const child of node.children) {
      traverse(child);
    }
  }

  for (const root of tree.roots) {
    traverse(root);
  }

  return result;
}

/**
 * Filter tree by entityType (supertag)
 */
export function filterBySupertag(tree: OutlineTree, supertag: string): OutlineNode[] {
  const flat = flattenTree(tree);
  return flat.filter(node => node.entityType.toLowerCase() === supertag.toLowerCase());
}

/**
 * Get supertag counts for sidebar
 */
export function getSupertagCounts(tree: OutlineTree): Map<string, number> {
  const counts = new Map<string, number>();

  for (const node of tree.nodeMap.values()) {
    const type = node.entityType.toLowerCase();
    counts.set(type, (counts.get(type) || 0) + 1);
  }

  return counts;
}

/**
 * Search nodes by content
 */
export function searchNodes(tree: OutlineTree, query: string): OutlineNode[] {
  const lowerQuery = query.toLowerCase();
  const flat = flattenTree(tree);

  return flat.filter(node =>
    node.content.toLowerCase().includes(lowerQuery) ||
    node.entityName.toLowerCase().includes(lowerQuery) ||
    node.observations.some(obs => obs.toLowerCase().includes(lowerQuery))
  );
}
