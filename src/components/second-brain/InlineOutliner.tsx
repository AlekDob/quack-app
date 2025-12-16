import { memo, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { ChevronRight, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  createMCPEntity,
  deleteMCPEntity,
  createMCPRelation,
  deleteMCPRelation,
  addMCPObservations,
  updateMCPObservations,
  generateEntityName,
  categoryToEntityType,
  categoryToRelationType,
} from '../../services/mcpMemoryService';
import { parseMentions, parseSupertag } from '../../services/outlineTreeBuilder';
import type { OutlineNode as OutlineNodeType } from '../../services/outlineTreeBuilder';

/**
 * Get bullet/entity color based on entity type
 */
const getEntityColor = (entityType: string): string => {
  const colors: Record<string, string> = {
    preference: '#3b82f6',
    fact: '#10b981',
    decision: '#8b5cf6',
    pattern: '#f97316',
    mistake: '#ef4444',
    context: '#6b7280',
    person: '#E84A7F',
    project: '#E84A7F',
    technology: '#00d9ff',
    tool: '#00d9ff',
    task: '#f59e0b',
    note: '#8b5cf6',
    idea: '#10b981',
  };
  return colors[entityType.toLowerCase()] || '#6b7280';
};

/**
 * Convert hex color to rgba with specified alpha
 */
const hexToRgba = (hex: string, alpha: number): string => {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * Editable observation component - for details in zoomed view
 */
interface EditableObservationProps {
  value: string;
  index: number;
  entityId: string;
  onRefresh: () => Promise<void>;
}

function EditableObservation({ value, index, entityId, onRefresh }: EditableObservationProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = () => {
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    // Note: Updating observations requires a new Rust command
    // For now, just reset to original value
    setEditValue(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setIsEditing(false);
      // TODO: Save updated observation when Rust command is available
      toast.info('Edit saved (visual only - backend update coming soon)');
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue(value);
    }
  };

  return (
    <div className="observation-item editable" onDoubleClick={handleDoubleClick}>
      <span className="observation-bullet">-</span>
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          className="observation-input editing"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
        />
      ) : (
        <span className="observation-text">{value}</span>
      )}
    </div>
  );
}

interface InlineBulletProps {
  node: OutlineNodeType;
  isExpanded: boolean;
  isFocused: boolean;
  isZoomed: boolean;
  /** Previous sibling in same parent level (for indent) */
  previousSibling: OutlineNodeType | null;
  onToggleExpand: (nodeId: string) => void;
  onFocus: (nodeId: string) => void;
  onZoom: (node: OutlineNodeType) => void;
  onCreateBelow: (parentId: string | null, afterId: string) => void;
  onDelete: (nodeId: string) => void;
  onUpdate: (nodeId: string, content: string) => void;
  onIndent: (nodeId: string, newParentId: string) => void;
  onOutdent: (nodeId: string, currentParentId: string) => void;
  onMoveUp: (nodeId: string) => void;
  onMoveDown: (nodeId: string) => void;
  expandedNodes: Set<string>;
  allNodes: OutlineNodeType[];
}

/**
 * Single inline bullet - always editable, Tana-style
 */
function InlineBullet({
  node,
  isExpanded,
  isFocused,
  isZoomed,
  previousSibling,
  onToggleExpand,
  onFocus,
  onZoom,
  onCreateBelow,
  onDelete,
  onUpdate,
  onIndent,
  onOutdent,
  onMoveUp,
  onMoveDown,
  expandedNodes,
  allNodes,
}: InlineBulletProps) {
  const [content, setContent] = useState(node.content);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasChildren = node.children.length > 0;

  // Focus input when this bullet is focused
  useEffect(() => {
    if (isFocused && inputRef.current) {
      inputRef.current.focus();
      // Move cursor to end
      const len = inputRef.current.value.length;
      inputRef.current.setSelectionRange(len, len);
    }
  }, [isFocused]);

  // Update local content when node changes
  useEffect(() => {
    setContent(node.content);
  }, [node.content]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const cursorAtStart = inputRef.current?.selectionStart === 0;
    const cursorAtEnd = inputRef.current?.selectionStart === content.length;

    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        // Save current content first
        if (content !== node.content) {
          onUpdate(node.id, content);
        }
        // Create new bullet below
        onCreateBelow(node.parentId, node.id);
        break;

      case 'Backspace':
        if (content === '' && cursorAtStart) {
          e.preventDefault();
          onDelete(node.id);
        }
        break;

      case 'Tab':
        e.preventDefault();
        if (e.shiftKey) {
          // Outdent: Move to parent's level (remove from current parent)
          if (node.parentId) {
            onOutdent(node.id, node.parentId);
          }
        } else {
          // Indent: Become child of previous sibling
          if (previousSibling) {
            onIndent(node.id, previousSibling.id);
          } else {
            toast.error('Cannot indent: no sibling above');
          }
        }
        break;

      case 'ArrowUp':
        if (cursorAtStart || e.metaKey || e.ctrlKey) {
          e.preventDefault();
          if (e.metaKey || e.ctrlKey) {
            onMoveUp(node.id);
          } else {
            // Navigate to previous bullet
            onMoveUp(node.id);
          }
        }
        break;

      case 'ArrowDown':
        if (cursorAtEnd || e.metaKey || e.ctrlKey) {
          e.preventDefault();
          if (e.metaKey || e.ctrlKey) {
            onMoveDown(node.id);
          } else {
            // Navigate to next bullet
            onMoveDown(node.id);
          }
        }
        break;

      case 'Escape':
        e.preventDefault();
        inputRef.current?.blur();
        break;
    }
  }, [content, node, onUpdate, onCreateBelow, onDelete, onIndent, onOutdent, onMoveUp, onMoveDown]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setContent(e.target.value);
  }, []);

  const handleBlur = useCallback(() => {
    if (content !== node.content) {
      onUpdate(node.id, content);
    }
  }, [content, node.content, node.id, onUpdate]);

  const handleBulletClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onZoom(node);
  }, [node, onZoom]);

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) {
      onToggleExpand(node.id);
    }
  }, [hasChildren, node.id, onToggleExpand]);

  const handleRowClick = useCallback(() => {
    onFocus(node.id);
  }, [node.id, onFocus]);


  // Dynamic background color for focused state based on entity type
  const focusedStyle = useMemo(() => {
    if (!isFocused) return { paddingLeft: isZoomed ? 0 : node.depth * 24 };
    const entityColor = getEntityColor(node.entityType);
    return {
      paddingLeft: isZoomed ? 0 : node.depth * 24,
      backgroundColor: hexToRgba(entityColor, 0.08),
    };
  }, [isFocused, isZoomed, node.depth, node.entityType]);

  return (
    <div className="inline-bullet-container">
      <div
        className={`inline-bullet-row ${isFocused ? 'focused' : ''} ${isZoomed ? 'zoomed-title' : ''}`}
        onClick={handleRowClick}
        style={focusedStyle}
      >
        {/* Drag handle - only visible on hover */}
        {!isZoomed && (
          <div className="inline-bullet-drag-handle">
            <GripVertical size={12} />
          </div>
        )}

        {/* Expand/Collapse toggle */}
        <button
          type="button"
          className={`inline-bullet-toggle ${hasChildren ? 'has-children' : ''} ${isExpanded ? 'expanded' : ''}`}
          onClick={handleToggle}
        >
          {hasChildren && <ChevronRight size={12} />}
        </button>

        {/* Bullet point - click to zoom */}
        <button
          type="button"
          className="inline-bullet-point"
          onClick={handleBulletClick}
          style={{ backgroundColor: getEntityColor(node.entityType) }}
          title="Click to zoom into this node"
        />

        {/* Inline editable content */}
        <input
          ref={inputRef}
          type="text"
          className={`inline-bullet-input ${isZoomed ? 'zoomed-input' : ''}`}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder="Type here... (Enter: new bullet, Tab: indent)"
          style={isZoomed ? { color: getEntityColor(node.entityType) } : undefined}
        />

        {/* Supertag badge */}
        {node.entityType && node.entityType !== 'fact' && (
          <span
            className="inline-bullet-tag"
            style={{ color: getEntityColor(node.entityType) }}
          >
            #{node.entityType}
          </span>
        )}
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="inline-bullet-children">
          {node.children.map((child, index) => (
            <InlineBullet
              key={child.id}
              node={child}
              isExpanded={expandedNodes.has(child.id)}
              isFocused={false}
              isZoomed={false}
              previousSibling={index > 0 ? node.children[index - 1] : null}
              onToggleExpand={onToggleExpand}
              onFocus={onFocus}
              onZoom={onZoom}
              onCreateBelow={onCreateBelow}
              onDelete={onDelete}
              onUpdate={onUpdate}
              onIndent={onIndent}
              onOutdent={onOutdent}
              onMoveUp={onMoveUp}
              onMoveDown={onMoveDown}
              expandedNodes={expandedNodes}
              allNodes={allNodes}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Sortable wrapper for InlineBullet - enables drag & drop
 */
interface SortableBulletProps extends Omit<InlineBulletProps, 'isFocused'> {
  isFocused: boolean;
}

function SortableInlineBullet(props: SortableBulletProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.node.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div className={`sortable-bullet-wrapper ${isDragging ? 'dragging' : ''}`}>
        {/* Drag listeners on the handle */}
        <div className="drag-handle-area" {...listeners}>
          <InlineBullet {...props} />
        </div>
      </div>
    </div>
  );
}

interface InlineOutlinerProps {
  roots: OutlineNodeType[];
  expandedNodes: Set<string>;
  onToggleExpand: (nodeId: string) => void;
  onRefresh: () => Promise<void>;
  zoomedNode: OutlineNodeType | null;
  onZoom: (node: OutlineNodeType | null) => void;
  breadcrumbs: OutlineNodeType[];
}

/**
 * Main inline outliner - Tana/Logseq style
 */
export function InlineOutliner({
  roots,
  expandedNodes,
  onToggleExpand,
  onRefresh,
  zoomedNode,
  onZoom,
  breadcrumbs,
}: InlineOutlinerProps) {
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const newBulletRef = useRef<HTMLInputElement>(null);
  const [newBulletContent, setNewBulletContent] = useState('');

  // DnD Kit sensors with activation constraints
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Flatten all nodes for navigation
  const allNodes = useMemo(() => {
    const flat: OutlineNodeType[] = [];
    const traverse = (nodes: OutlineNodeType[]) => {
      for (const node of nodes) {
        flat.push(node);
        if (expandedNodes.has(node.id)) {
          traverse(node.children);
        }
      }
    };
    traverse(zoomedNode ? [zoomedNode] : roots);
    return flat;
  }, [roots, zoomedNode, expandedNodes]);

  // Display nodes - either zoomed node's children or roots
  const displayNodes = useMemo(() => {
    if (zoomedNode) {
      return zoomedNode.children;
    }
    return roots;
  }, [roots, zoomedNode]);

  const handleFocus = useCallback((nodeId: string) => {
    setFocusedNodeId(nodeId);
  }, []);

  const handleZoom = useCallback((node: OutlineNodeType) => {
    onZoom(node);
    setFocusedNodeId(null);
  }, [onZoom]);

  const handleCreateBelow = useCallback(async (parentId: string | null, afterId: string) => {
    setIsCreating(true);
    try {
      // For now, create at root level
      // TODO: Support creating as child of parentId
      const tempId = `temp-${Date.now()}`;
      setFocusedNodeId(tempId);

      // Focus on new bullet input
      setTimeout(() => {
        newBulletRef.current?.focus();
      }, 50);
    } catch (err) {
      console.error('Failed to create bullet:', err);
    } finally {
      setIsCreating(false);
    }
  }, []);

  const handleNewBulletKeyDown = useCallback(async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && newBulletContent.trim()) {
      e.preventDefault();

      try {
        // Parse content
        const supertag = parseSupertag(newBulletContent);
        const mentions = parseMentions(newBulletContent);
        const cleanedContent = newBulletContent
          .replace(/#[a-zA-Z0-9_-]+/g, '')
          .replace(/@[a-zA-Z0-9_-]+/g, '')
          .trim();

        if (!cleanedContent && mentions.length === 0) {
          setNewBulletContent('');
          return;
        }

        // ZOOMED MODE: Add as observation to current entity
        if (zoomedNode && !supertag) {
          // Plain text → add as observation to zoomed entity
          if (cleanedContent) {
            await addMCPObservations(zoomedNode.id, [cleanedContent]);
            toast.success('Observation added');
          }

          // @mentions → create relations from zoomed entity
          for (const mention of mentions) {
            await createMCPRelation({
              from: zoomedNode.id,
              to: mention,
              relationType: 'relates_to',
            });
            toast.success(`Linked to ${mention}`);
          }
        }
        // ROOT MODE or #tag specified: Create new entity
        else {
          const entityType = supertag || 'fact';

          if (!cleanedContent) {
            setNewBulletContent('');
            return;
          }

          // Create new entity
          const entityName = generateEntityName(cleanedContent);
          await createMCPEntity({
            name: entityName,
            entityType: categoryToEntityType(entityType),
            observations: [cleanedContent],
          });

          // If we're zoomed, also create "contains" relation
          if (zoomedNode) {
            await createMCPRelation({
              from: zoomedNode.id,
              to: entityName,
              relationType: 'contains',
            });
          }

          // Create relations for @mentions
          for (const mention of mentions) {
            await createMCPRelation({
              from: entityName,
              to: mention,
              relationType: categoryToRelationType(entityType),
            });
          }
        }

        // Clear and keep focus for next entry
        setNewBulletContent('');
        await onRefresh();

        // Focus new bullet input again
        setTimeout(() => {
          newBulletRef.current?.focus();
        }, 100);
      } catch (err) {
        console.error('Failed to create:', err);
        toast.error('Failed to save');
      }
    } else if (e.key === 'Escape') {
      setNewBulletContent('');
      newBulletRef.current?.blur();
    }
  }, [newBulletContent, onRefresh, zoomedNode]);

  const handleDelete = useCallback(async (nodeId: string) => {
    try {
      await deleteMCPEntity(nodeId);
      await onRefresh();

      // Focus previous node
      const idx = allNodes.findIndex(n => n.id === nodeId);
      if (idx > 0) {
        setFocusedNodeId(allNodes[idx - 1].id);
      }
    } catch (err) {
      console.error('Failed to delete:', err);
      toast.error('Failed to delete bullet');
    }
  }, [allNodes, onRefresh]);

  const handleUpdate = useCallback(async (nodeId: string, content: string) => {
    try {
      // Find the node to get its current observations
      const node = allNodes.find(n => n.id === nodeId);
      if (!node) {
        console.warn('Node not found for update:', nodeId);
        return;
      }

      // The title is observations[0], so we update it while keeping other observations
      const newObservations = [...node.observations];
      newObservations[0] = content;

      const success = await updateMCPObservations(nodeId, newObservations);
      if (success) {
        toast.success('Updated');
      }
    } catch (err) {
      console.error('Failed to update:', err);
      toast.error('Failed to update');
    }
  }, [allNodes]);

  /**
   * Indent: Make this node a child of newParentId
   * Creates a "contains" relation from newParent -> this node
   * Also removes existing "contains" relation from old parent if any
   */
  const handleIndent = useCallback(async (nodeId: string, newParentId: string) => {
    try {
      // Find the node to get its current parent
      const node = allNodes.find(n => n.id === nodeId);
      if (!node) return;

      // Remove existing parent relation if any
      if (node.parentId) {
        await deleteMCPRelation(node.parentId, nodeId);
      }

      // Create new "contains" relation: newParent contains this node
      await createMCPRelation({
        from: newParentId,
        to: nodeId,
        relationType: 'contains',
      });

      await onRefresh();
      setFocusedNodeId(nodeId);
      toast.success('Indented');
    } catch (err) {
      console.error('Failed to indent:', err);
      toast.error('Failed to indent bullet');
    }
  }, [allNodes, onRefresh]);

  /**
   * Outdent: Move this node up one level
   * Removes "contains" relation from current parent
   * If grandparent exists, creates relation from grandparent -> this node
   */
  const handleOutdent = useCallback(async (nodeId: string, currentParentId: string) => {
    try {
      // Find the current parent to get grandparent
      const parentNode = allNodes.find(n => n.id === currentParentId);

      // Remove current parent relation
      await deleteMCPRelation(currentParentId, nodeId);

      // If parent has a parent (grandparent), create relation to grandparent
      if (parentNode?.parentId) {
        await createMCPRelation({
          from: parentNode.parentId,
          to: nodeId,
          relationType: 'contains',
        });
      }

      await onRefresh();
      setFocusedNodeId(nodeId);
      toast.success('Outdented');
    } catch (err) {
      console.error('Failed to outdent:', err);
      toast.error('Failed to outdent bullet');
    }
  }, [allNodes, onRefresh]);

  const handleMoveUp = useCallback((nodeId: string) => {
    const idx = allNodes.findIndex(n => n.id === nodeId);
    if (idx > 0) {
      setFocusedNodeId(allNodes[idx - 1].id);
    }
  }, [allNodes]);

  const handleMoveDown = useCallback((nodeId: string) => {
    const idx = allNodes.findIndex(n => n.id === nodeId);
    if (idx < allNodes.length - 1) {
      setFocusedNodeId(allNodes[idx + 1].id);
    } else {
      // Focus new bullet input at bottom
      newBulletRef.current?.focus();
    }
  }, [allNodes]);

  /**
   * Handle drag end - reorder nodes by updating relations
   * When a node is dragged to a new position, we need to:
   * 1. Remove old parent relation (if any)
   * 2. Create new parent relation based on drop position
   */
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    try {
      const draggedNodeId = active.id as string;
      const targetNodeId = over.id as string;

      // Find the nodes
      const draggedNode = allNodes.find(n => n.id === draggedNodeId);
      const targetNode = allNodes.find(n => n.id === targetNodeId);

      if (!draggedNode || !targetNode) return;

      // Remove existing parent relation
      if (draggedNode.parentId) {
        await deleteMCPRelation(draggedNode.parentId, draggedNodeId);
      }

      // If target has a parent, add dragged node to same parent
      // This keeps it as a sibling to the target
      if (targetNode.parentId) {
        await createMCPRelation({
          from: targetNode.parentId,
          to: draggedNodeId,
          relationType: 'contains',
        });
      }

      await onRefresh();
      toast.success('Moved');
    } catch (err) {
      console.error('Failed to reorder:', err);
      toast.error('Failed to move bullet');
    }
  }, [allNodes, onRefresh]);

  // Get sortable item IDs for SortableContext
  const sortableIds = useMemo(() => displayNodes.map(n => n.id), [displayNodes]);

  return (
    <div className="inline-outliner">
      {/* Breadcrumbs for zoom navigation */}
      {breadcrumbs.length > 0 && (
        <div className="inline-outliner-breadcrumbs">
          <button
            type="button"
            className="breadcrumb-item root"
            onClick={() => onZoom(null)}
          >
            Home
          </button>
          {breadcrumbs.map((crumb, idx) => (
            <span key={crumb.id} className="breadcrumb-separator">
              <span className="separator">/</span>
              <button
                type="button"
                className={`breadcrumb-item ${idx === breadcrumbs.length - 1 ? 'current' : ''}`}
                onClick={() => idx < breadcrumbs.length - 1 ? onZoom(crumb) : null}
              >
                {crumb.content.slice(0, 30)}{crumb.content.length > 30 ? '...' : ''}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Zoomed node title */}
      {zoomedNode && (
        <InlineBullet
          node={zoomedNode}
          isExpanded={true}
          isFocused={focusedNodeId === zoomedNode.id}
          isZoomed={true}
          previousSibling={null}
          onToggleExpand={onToggleExpand}
          onFocus={handleFocus}
          onZoom={handleZoom}
          onCreateBelow={handleCreateBelow}
          onDelete={handleDelete}
          onUpdate={handleUpdate}
          onIndent={handleIndent}
          onOutdent={handleOutdent}
          onMoveUp={handleMoveUp}
          onMoveDown={handleMoveDown}
          expandedNodes={expandedNodes}
          allNodes={allNodes}
        />
      )}

      {/* Observations of zoomed node (details/notes about this entity) */}
      {zoomedNode && zoomedNode.observations.length > 0 && (
        <div className="observations-section">
          <div className="observations-header">
            <span className="observations-label">Details</span>
            <span className="observations-count">
              {zoomedNode.observations.length - 1}
            </span>
          </div>
          <div className="observations-list">
            {zoomedNode.observations.slice(1).map((obs, idx) => (
              <EditableObservation
                key={`obs-${idx}`}
                value={obs}
                index={idx + 1}
                entityId={zoomedNode.id}
                onRefresh={onRefresh}
              />
            ))}
            {/* Input for adding new observation */}
            <div className="observation-item new-observation">
              <span className="observation-bullet">+</span>
              <input
                type="text"
                className="observation-input"
                placeholder="Add new detail..."
                onKeyDown={async (e) => {
                  if (e.key === 'Enter') {
                    const input = e.target as HTMLInputElement;
                    const value = input.value.trim();
                    if (value) {
                      await addMCPObservations(zoomedNode.id, [value]);
                      input.value = '';
                      await onRefresh();
                      toast.success('Detail added');
                    }
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Bullet list with drag & drop */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          <div className="inline-outliner-list">
            {displayNodes.map((node, index) => (
              <SortableInlineBullet
                key={node.id}
                node={node}
                isExpanded={expandedNodes.has(node.id)}
                isFocused={focusedNodeId === node.id}
                isZoomed={false}
                previousSibling={index > 0 ? displayNodes[index - 1] : null}
                onToggleExpand={onToggleExpand}
                onFocus={handleFocus}
                onZoom={handleZoom}
                onCreateBelow={handleCreateBelow}
                onDelete={handleDelete}
                onUpdate={handleUpdate}
                onIndent={handleIndent}
                onOutdent={handleOutdent}
                onMoveUp={handleMoveUp}
                onMoveDown={handleMoveDown}
                expandedNodes={expandedNodes}
                allNodes={allNodes}
              />
            ))}

            {/* New bullet input - only at root level (zoom mode uses DETAILS section) */}
            {!zoomedNode && (
              <div className="inline-bullet-row new-bullet">
                <div className="inline-bullet-toggle" />
                <div className="inline-bullet-point new" />
                <input
                  ref={newBulletRef}
                  type="text"
                  className="inline-bullet-input"
                  value={newBulletContent}
                  onChange={(e) => setNewBulletContent(e.target.value)}
                  onKeyDown={handleNewBulletKeyDown}
                  placeholder="Type a new thought... #tag @mention"
                />
              </div>
            )}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

export default memo(InlineOutliner);
