/**
 * Brain Tree Builder Service
 * Converts Brain entities/relations into a hierarchical tree structure for the outliner.
 * This is the Brain-based replacement for outlineTreeBuilder.ts
 *
 * @module services/brainTreeBuilder
 */

import type { BrainEntity, BrainRelation, BrainGraph } from '../types/brain';
import type { OutlineNode, OutlineTree } from './outlineTreeBuilder';
import {
  parseMentions,
  cleanContent,
} from './outlineTreeBuilder';

/**
 * Build a hierarchical tree from Brain entities and relations
 *
 * Rules:
 * - Relations with type "contains" define parent-child relationships
 * - Entities without a "contains" parent are root nodes
 * - "belongs_to_project" relations associate entities with projects
 */
export function buildBrainTree(graph: BrainGraph): OutlineTree {
  const nodeMap = new Map<string, OutlineNode>();
  const childToParent = new Map<string, string>();
  const pendingProjectIds = new Map<string, string>(); // nodeId -> projectId (to resolve later)

  // First pass: Create nodes for all entities
  for (const entity of graph.entities) {
    const content = entity.observations[0]?.content || entity.name;
    const mentions = parseMentions(content);

    const node: OutlineNode = {
      id: entity.id,
      entityName: entity.name,
      content: cleanContent(content),
      entityType: entity.entityType,
      observations: entity.observations.map(o => o.content),
      children: [],
      parentId: null,
      depth: 0,
      isExpanded: true,
      mentions,
      createdAt: entity.createdAt,
      // Don't assign projectId as projectName here - will resolve from relations
      projectName: undefined,
    };

    // Track projectId to resolve later
    if (entity.projectId) {
      pendingProjectIds.set(entity.id, entity.projectId);
    }

    nodeMap.set(entity.id, node);
  }

  // Second pass: Build parent-child relationships from "contains" relations
  // and project associations from "belongs_to_project" relations
  for (const relation of graph.relations) {
    if (relation.relationType === 'contains') {
      childToParent.set(relation.toEntityId, relation.fromEntityId);
    } else if (relation.relationType === 'belongs_to_project') {
      // relation.fromEntityId = entity ID, relation.toEntityId = project ID
      const node = nodeMap.get(relation.fromEntityId);
      if (node) {
        // Find project name
        const projectNode = nodeMap.get(relation.toEntityId);
        if (projectNode) {
          node.projectName = projectNode.entityName;
        }
      }

      // Find the project node by ID
      const projectNode = nodeMap.get(relation.toEntityId);

      if (projectNode && projectNode.entityType === 'project') {
        // Only add as child if not already a child of something else
        if (!childToParent.has(relation.fromEntityId)) {
          childToParent.set(relation.fromEntityId, projectNode.id);
        }
      }
    }
  }

  // Third pass: Resolve pending projectIds to project names
  // For entities with projectId but no belongs_to_project relation (or project not in nodeMap)
  for (const [nodeId, projectId] of pendingProjectIds) {
    const node = nodeMap.get(nodeId);
    if (node && !node.projectName) {
      // Try to find project entity by ID
      const projectNode = nodeMap.get(projectId);
      if (projectNode) {
        node.projectName = projectNode.entityName;
      } else {
        // Project not in graph - try to extract name from projectId
        // If projectId is a path, extract directory name
        // If it's a UUID, we can't do much - leave empty or show truncated ID
        if (projectId.includes('/')) {
          // It's a path - extract last segment as project name
          const parts = projectId.split('/');
          node.projectName = parts[parts.length - 1] || projectId;
        }
        // If it's a UUID, don't show it as project name (leave undefined)
      }
    }
  }

  // Fourth pass: Link children to parents
  for (const [childId, parentId] of childToParent) {
    const child = nodeMap.get(childId);
    const parent = nodeMap.get(parentId);

    if (child && parent) {
      child.parentId = parentId;
      parent.children.push(child);
    }
  }

  // Fifth pass: Compute depths (BFS from roots)
  const roots: OutlineNode[] = [];
  for (const node of nodeMap.values()) {
    if (node.parentId === null) {
      roots.push(node);
      computeDepth(node, 0);
    }
  }

  // Sort roots by entityType first, then by name
  roots.sort((a, b) => {
    const typeA = a.entityType || 'unknown';
    const typeB = b.entityType || 'unknown';
    if (typeA !== typeB) {
      return typeA.localeCompare(typeB);
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
 * Convert Brain entities to the format expected by existing components
 *
 * This is a compatibility layer that allows using Brain data with
 * existing UI components that expect MCP Memory format.
 */
export function brainGraphToOutlineTree(graph: BrainGraph): OutlineTree {
  return buildBrainTree(graph);
}
