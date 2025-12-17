import { memo, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  createMCPEntity,
  createProjectScopedEntity,
  ensureProjectEntity,
  deleteMCPEntity,
  createMCPRelation,
  deleteMCPRelation,
  addMCPObservations,
  updateMCPObservations,
  updateMCPEntityType,
  generateEntityName,
  categoryToEntityType,
  categoryToRelationType,
  mcpMemoryService,
  type MemoryScope,
} from '../../services/mcpMemoryService';
import type { ProjectInfo } from '../../hooks/useCurrentProject';
import { parseMentions, parseSupertag } from '../../services/outlineTreeBuilder';
import type { OutlineNode as OutlineNodeType } from '../../services/outlineTreeBuilder';
import { SUPERTAGS } from './EntityAutocomplete';
import { getSupertagColor } from '../../services/supertagConfigService';

/**
 * Get bullet/entity color based on entity type (uses dynamic config)
 */
const getEntityColor = (entityType: string): string => {
  return getSupertagColor(entityType);
};

/**
 * Detect trigger and query from input value at cursor position
 */
function detectTrigger(value: string, cursorPos: number): {
  trigger: '@' | '#' | null;
  query: string;
  startIndex: number;
} {
  let startIndex = cursorPos - 1;

  while (startIndex >= 0) {
    const char = value[startIndex];
    if (char === '@' || char === '#') {
      const query = value.slice(startIndex + 1, cursorPos);
      if (!query.includes(' ')) {
        return { trigger: char as '@' | '#', query, startIndex };
      }
      return { trigger: null, query: '', startIndex: -1 };
    }
    if (char === ' ') {
      return { trigger: null, query: '', startIndex: -1 };
    }
    startIndex--;
  }
  return { trigger: null, query: '', startIndex: -1 };
}

interface InlineAutocompleteProps {
  trigger: '@' | '#';
  query: string;
  selectedIndex: number;
  onSelect: (value: string, type: '@' | '#') => void;
}

/** Autocomplete item type */
interface AutocompleteItem {
  value: string;
  label: string;
  color: string;
  isNew?: boolean;
  entityType?: string;
}

/**
 * Get autocomplete items based on trigger type
 */
function getAutocompleteItems(trigger: '@' | '#', query: string): AutocompleteItem[] {
  if (trigger === '#') {
    const filtered = SUPERTAGS.filter(st =>
      st.value.toLowerCase().includes(query.toLowerCase())
    );
    const exactMatch = SUPERTAGS.some(st => st.value.toLowerCase() === query.toLowerCase());
    if (query && !exactMatch) {
      return [
        { value: query, label: `Create #${query}`, color: '#6b7280', isNew: true },
        ...filtered,
      ];
    }
    return filtered;
  }

  const graph = mcpMemoryService.getKnowledgeGraph();
  if (!graph) return [];

  return graph.entities
    .filter(e => e.name.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 8)
    .map(e => ({
      value: e.name,
      label: e.observations[0] || e.name,
      color: getEntityColor(e.entityType),
      entityType: e.entityType,
    }));
}

/**
 * Inline autocomplete dropdown for #tags and @mentions
 */
function InlineAutocomplete({ trigger, query, selectedIndex, onSelect }: InlineAutocompleteProps) {
  const items = useMemo(() => getAutocompleteItems(trigger, query), [trigger, query]);

  if (items.length === 0) return null;

  return (
    <div className="inline-autocomplete">
      <div className="inline-autocomplete-header">
        {trigger === '#' ? 'Supertags' : 'Entities'}
      </div>
      {items.map((item, index) => (
        <button
          key={`${trigger}-${item.value}`}
          type="button"
          className={`inline-autocomplete-item ${index === selectedIndex ? 'selected' : ''}`}
          onClick={() => onSelect(item.value, trigger)}
          onMouseDown={(e) => e.preventDefault()} // Prevent blur
        >
          <span
            className="inline-autocomplete-indicator"
            style={{ backgroundColor: item.color }}
          />
          <span className="inline-autocomplete-label">
            {trigger === '#' ? `#${item.value}` : item.label}
          </span>
          {item.isNew && (
            <span className="inline-autocomplete-new">new</span>
          )}
          {item.entityType && (
            <span className="inline-autocomplete-type">
              {item.entityType}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

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
  const [cursorPosition, setCursorPosition] = useState(0);
  const [autocompleteIndex, setAutocompleteIndex] = useState(0);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasChildren = node.children.length > 0;

  // Detect trigger for autocomplete
  const triggerInfo = useMemo(
    () => detectTrigger(content, cursorPosition),
    [content, cursorPosition]
  );

  // Get autocomplete items
  const autocompleteItems = useMemo((): AutocompleteItem[] => {
    if (!triggerInfo.trigger) return [];
    return getAutocompleteItems(triggerInfo.trigger, triggerInfo.query);
  }, [triggerInfo]);

  // Reset autocomplete index when items change
  useEffect(() => {
    setAutocompleteIndex(0);
  }, [autocompleteItems.length]);

  // Show autocomplete when trigger is detected
  useEffect(() => {
    setShowAutocomplete(!!triggerInfo.trigger && autocompleteItems.length > 0);
  }, [triggerInfo.trigger, autocompleteItems.length]);

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

  // Auto-resize textarea on mount and when content changes
  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) {
      // Reset height first to get accurate scrollHeight
      textarea.style.height = '0';
      // Set to scrollHeight but ensure minimum of 24px (single line)
      const newHeight = Math.max(24, textarea.scrollHeight);
      textarea.style.height = `${newHeight}px`;
    }
  }, [content]);

  // Handle autocomplete selection
  const handleAutocompleteSelect = useCallback((value: string, type: '@' | '#') => {
    const { startIndex } = triggerInfo;
    if (startIndex >= 0) {
      const before = content.slice(0, startIndex);
      const after = content.slice(cursorPosition);
      const newContent = `${before}${type}${value} ${after}`;
      setContent(newContent);
      setShowAutocomplete(false);

      // Set cursor position after the inserted value
      const newCursorPos = startIndex + type.length + value.length + 1;
      setTimeout(() => {
        inputRef.current?.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    }
  }, [content, cursorPosition, triggerInfo]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle autocomplete navigation first
    if (showAutocomplete && autocompleteItems.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setAutocompleteIndex(prev => (prev + 1) % autocompleteItems.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setAutocompleteIndex(prev => (prev - 1 + autocompleteItems.length) % autocompleteItems.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const selectedItem = autocompleteItems[autocompleteIndex];
        if (selectedItem && triggerInfo.trigger) {
          handleAutocompleteSelect(selectedItem.value, triggerInfo.trigger);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowAutocomplete(false);
        return;
      }
    }

    const cursorAtStart = inputRef.current?.selectionStart === 0;
    const cursorAtEnd = inputRef.current?.selectionStart === content.length;

    switch (e.key) {
      case 'Enter':
        // Shift+Enter = new line in textarea
        if (e.shiftKey) {
          // Allow default behavior (new line)
          return;
        }
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
  }, [content, node, onUpdate, onCreateBelow, onDelete, onIndent, onOutdent, onMoveUp, onMoveDown, showAutocomplete, autocompleteItems, autocompleteIndex, triggerInfo, handleAutocompleteSelect]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    setCursorPosition(e.target.selectionStart || 0);

    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = '0';
    const newHeight = Math.max(24, textarea.scrollHeight);
    textarea.style.height = `${newHeight}px`;
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
  // Use marginLeft for depth indentation to preserve CSS padding
  const focusedStyle = useMemo(() => {
    if (!isFocused) return { marginLeft: isZoomed ? 0 : node.depth * 24 };
    const entityColor = getEntityColor(node.entityType);
    return {
      marginLeft: isZoomed ? 0 : node.depth * 24,
      backgroundColor: hexToRgba(entityColor, 0.08),
    };
  }, [isFocused, isZoomed, node.depth, node.entityType]);

  return (
    <div className="inline-bullet-container">
      {/* Expand/Collapse toggle - positioned absolutely to the left, hidden when zoomed (children shown separately) */}
      {hasChildren && !isZoomed && (
        <button
          type="button"
          className={`inline-bullet-toggle has-children ${isExpanded ? 'expanded' : ''}`}
          onClick={handleToggle}
          style={{ left: `${node.depth * 24 + 12}px` }}
        >
          <ChevronRight size={12} />
        </button>
      )}

      <div
        className={`inline-bullet-row ${isFocused ? 'focused' : ''} ${isZoomed ? 'zoomed-title' : ''}`}
        onClick={handleRowClick}
        style={focusedStyle}
      >
        {/* Bullet point - click to zoom */}
        <button
          type="button"
          className="inline-bullet-point"
          onClick={handleBulletClick}
          style={{ backgroundColor: getEntityColor(node.entityType) }}
          title="Click to zoom into this node"
        />

        {/* Inline editable content with autocomplete */}
        <div className="inline-bullet-input-wrapper">
          <textarea
            ref={inputRef}
            className={`inline-bullet-input ${isZoomed ? 'zoomed-input' : ''}`}
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            placeholder="Type here... (Enter: new bullet, Tab: indent)"
            style={isZoomed ? { color: getEntityColor(node.entityType) } : undefined}
            rows={1}
          />

          {/* Autocomplete dropdown */}
          {showAutocomplete && triggerInfo.trigger && (
            <InlineAutocomplete
              trigger={triggerInfo.trigger}
              query={triggerInfo.query}
              selectedIndex={autocompleteIndex}
              onSelect={handleAutocompleteSelect}
            />
          )}
        </div>

        {/* Badges container - only show in list view, not when zoomed */}
        {!isZoomed && (
          <div className="inline-bullet-badges">
            {/* Project badge */}
            {node.projectName && (
              <span className="inline-bullet-project-badge">
                @{node.projectName}
              </span>
            )}

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
        )}
      </div>

      {/* Children - don't render when this is the zoomed title (children are shown below) */}
      {hasChildren && isExpanded && !isZoomed && (
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
  /** Selected scope for new memories */
  selectedScope: MemoryScope;
  /** Current project info (null if no project detected) */
  currentProject: ProjectInfo | null;
  /** Selected project name for 'project' scope */
  selectedProjectName: string | null;
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
  selectedScope,
  currentProject,
  selectedProjectName,
}: InlineOutlinerProps) {
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const newBulletRef = useRef<HTMLInputElement>(null);
  const [newBulletContent, setNewBulletContent] = useState('');
  const [newBulletCursor, setNewBulletCursor] = useState(0);
  const [newBulletAutocompleteIndex, setNewBulletAutocompleteIndex] = useState(0);
  const [showNewBulletAutocomplete, setShowNewBulletAutocomplete] = useState(false);

  // Detect trigger for new bullet autocomplete
  const newBulletTriggerInfo = useMemo(
    () => detectTrigger(newBulletContent, newBulletCursor),
    [newBulletContent, newBulletCursor]
  );

  // Get autocomplete items for new bullet
  const newBulletAutocompleteItems = useMemo((): AutocompleteItem[] => {
    if (!newBulletTriggerInfo.trigger) return [];
    return getAutocompleteItems(newBulletTriggerInfo.trigger, newBulletTriggerInfo.query);
  }, [newBulletTriggerInfo]);

  // Reset autocomplete index when items change
  useEffect(() => {
    setNewBulletAutocompleteIndex(0);
  }, [newBulletAutocompleteItems.length]);

  // Show autocomplete when trigger is detected
  useEffect(() => {
    setShowNewBulletAutocomplete(
      !!newBulletTriggerInfo.trigger && newBulletAutocompleteItems.length > 0
    );
  }, [newBulletTriggerInfo.trigger, newBulletAutocompleteItems.length]);

  // Handle autocomplete selection for new bullet
  const handleNewBulletAutocompleteSelect = useCallback((value: string, type: '@' | '#') => {
    const { startIndex } = newBulletTriggerInfo;
    if (startIndex >= 0) {
      const before = newBulletContent.slice(0, startIndex);
      const after = newBulletContent.slice(newBulletCursor);
      const newContent = `${before}${type}${value} ${after}`;
      setNewBulletContent(newContent);
      setShowNewBulletAutocomplete(false);

      const newCursorPos = startIndex + type.length + value.length + 1;
      setTimeout(() => {
        newBulletRef.current?.setSelectionRange(newCursorPos, newCursorPos);
        setNewBulletCursor(newCursorPos);
      }, 0);
    }
  }, [newBulletContent, newBulletCursor, newBulletTriggerInfo]);

  // DnD Kit sensors with activation constraints
  // NOTE: KeyboardSensor removed because it intercepts Space key in inputs
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required before drag starts
      },
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
    // Handle autocomplete navigation first
    if (showNewBulletAutocomplete && newBulletAutocompleteItems.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setNewBulletAutocompleteIndex(prev => (prev + 1) % newBulletAutocompleteItems.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setNewBulletAutocompleteIndex(prev =>
          (prev - 1 + newBulletAutocompleteItems.length) % newBulletAutocompleteItems.length
        );
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        const selectedItem = newBulletAutocompleteItems[newBulletAutocompleteIndex];
        if (selectedItem && newBulletTriggerInfo.trigger) {
          handleNewBulletAutocompleteSelect(selectedItem.value, newBulletTriggerInfo.trigger);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowNewBulletAutocomplete(false);
        return;
      }
    }

    if (e.key === 'Enter' && newBulletContent.trim()) {
      e.preventDefault();

      // If autocomplete is open, select the item instead of submitting
      if (showNewBulletAutocomplete && newBulletAutocompleteItems.length > 0) {
        const selectedItem = newBulletAutocompleteItems[newBulletAutocompleteIndex];
        if (selectedItem && newBulletTriggerInfo.trigger) {
          handleNewBulletAutocompleteSelect(selectedItem.value, newBulletTriggerInfo.trigger);
          return;
        }
      }

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

        // ZOOMED MODE on PROJECT: Create new entity related to the project
        // (Not as observation, but as a separate thought linked to this project)
        const isZoomedOnProject = zoomedNode?.entityType === 'project';

        if (zoomedNode && !supertag && !isZoomedOnProject) {
          // Plain text on non-project → add as observation to zoomed entity
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
        // ROOT MODE or #tag specified OR zoomed on project: Create new entity
        else {
          const entityType = supertag || 'fact';

          if (!cleanedContent) {
            setNewBulletContent('');
            return;
          }

          // Create new entity with scope
          const entityName = generateEntityName(cleanedContent);
          const entityData = {
            name: entityName,
            entityType: categoryToEntityType(entityType),
            observations: [cleanedContent],
          };

          // SPECIAL CASE: Zoomed on a project → auto-relate to that project
          if (isZoomedOnProject && zoomedNode) {
            // Create entity first (global)
            await createMCPEntity(entityData);
            // Then add belongs_to_project relation to the zoomed project
            await createMCPRelation({
              from: entityName,
              to: zoomedNode.id,
              relationType: 'belongs_to_project',
            });
            console.log('[InlineOutliner] Created entity related to project:', entityName, '->', zoomedNode.id);
            toast.success(`Added to ${zoomedNode.content.slice(0, 20)}...`);
          }
          // Use project-scoped entity if scope is 'project' and project is selected
          // Prefer selectedProjectName (from dropdown) over currentProject (auto-detected)
          else {
            const projectToUse = selectedProjectName || currentProject?.name;
            if (selectedScope === 'project' && projectToUse) {
              // Ensure project entity exists first (use currentProject.root_path if available)
              await ensureProjectEntity(projectToUse, currentProject?.root_path || '');
              // Create entity with project relation
              await createProjectScopedEntity(entityData, projectToUse);
              console.log('[InlineOutliner] Created project-scoped entity:', entityName, '->', projectToUse);
            } else {
              // Create global entity (no project relation)
              await createMCPEntity(entityData);
              console.log('[InlineOutliner] Created global entity:', entityName);
            }

            // If we're zoomed on non-project, also create "contains" relation
            if (zoomedNode) {
              await createMCPRelation({
                from: zoomedNode.id,
                to: entityName,
                relationType: 'contains',
              });
            }
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
        setNewBulletCursor(0);
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
      setNewBulletCursor(0);
      newBulletRef.current?.blur();
    }
  }, [newBulletContent, onRefresh, zoomedNode, showNewBulletAutocomplete, newBulletAutocompleteItems, newBulletAutocompleteIndex, newBulletTriggerInfo, handleNewBulletAutocompleteSelect, selectedScope, currentProject]);

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

      // Check if there's a #tag in the content (user wants to change entity type)
      const newTag = parseSupertag(content);

      // Clean content by removing the tag
      const cleanedContent = content
        .replace(/#[a-zA-Z0-9_-]+/g, '')
        .trim();

      // Update observations with cleaned content
      const newObservations = [...node.observations];
      newObservations[0] = cleanedContent || content; // Use cleaned content, fallback to original if empty

      // If there's a new tag, update entity type (even if same - categoryToEntityType normalizes)
      if (newTag) {
        const newEntityType = categoryToEntityType(newTag);
        console.log('[InlineOutliner] Tag detected:', newTag, '-> entityType:', newEntityType, 'current:', node.entityType);

        // Always try to update if tag is present (handles custom tags too)
        const typeSuccess = await updateMCPEntityType(nodeId, newEntityType);
        if (typeSuccess) {
          // Also update observations with cleaned content
          await updateMCPObservations(nodeId, newObservations);
          toast.success(`Updated to #${newTag}`);
          await onRefresh(); // Refresh to see the new type
          return;
        }
      }

      // No tag - just update observations
      const obsSuccess = await updateMCPObservations(nodeId, newObservations);
      if (obsSuccess) {
        toast.success('Updated');
        await onRefresh();
      }
    } catch (err) {
      console.error('Failed to update:', err);
      toast.error('Failed to update');
    }
  }, [allNodes, onRefresh]);

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

      {/* Zoomed node metadata badges (above title) */}
      {zoomedNode && (
        <div className="zoomed-node-meta">
          {/* Project badge */}
          {zoomedNode.projectName && (
            <span className="zoomed-node-project-badge">
              @{zoomedNode.projectName}
            </span>
          )}
          {/* Supertag badge */}
          {zoomedNode.entityType && zoomedNode.entityType !== 'fact' && (
            <span
              className="zoomed-node-tag-badge"
              style={{ color: getEntityColor(zoomedNode.entityType) }}
            >
              #{zoomedNode.entityType}
            </span>
          )}
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

            {/* New bullet input - at root level OR in zoom mode for adding related thoughts */}
            <div className={`inline-bullet-row new-bullet ${zoomedNode ? 'in-detail-view' : ''}`}>
              <div className="inline-bullet-point new" />
              <div className="inline-bullet-input-wrapper">
                <input
                  ref={newBulletRef}
                  type="text"
                  className="inline-bullet-input"
                  value={newBulletContent}
                  onChange={(e) => {
                    setNewBulletContent(e.target.value);
                    setNewBulletCursor(e.target.selectionStart || 0);
                  }}
                  onKeyDown={handleNewBulletKeyDown}
                  placeholder={zoomedNode
                    ? `Add thought related to ${zoomedNode.content.slice(0, 20)}${zoomedNode.content.length > 20 ? '...' : ''}`
                    : "Type a new thought... #tag @mention"}
                />
                {/* Autocomplete dropdown for new bullet */}
                {showNewBulletAutocomplete && newBulletTriggerInfo.trigger && (
                  <InlineAutocomplete
                    trigger={newBulletTriggerInfo.trigger}
                    query={newBulletTriggerInfo.query}
                    selectedIndex={newBulletAutocompleteIndex}
                    onSelect={handleNewBulletAutocompleteSelect}
                  />
                )}
              </div>
            </div>
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

export default memo(InlineOutliner);
