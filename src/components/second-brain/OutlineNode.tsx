import { memo, useCallback, useState, useRef, useEffect } from 'react';
import { ChevronRight, GripVertical } from 'lucide-react';
import type { OutlineNode as OutlineNodeType } from '../../services/outlineTreeBuilder';

interface OutlineNodeProps {
  node: OutlineNodeType;
  isExpanded: boolean;
  onToggleExpand: (nodeId: string) => void;
  onNodeClick: (node: OutlineNodeType) => void;
  onNodeEdit?: (nodeId: string, newContent: string) => void;
  focusedNodeId?: string | null;
}

/**
 * Render inline mentions and supertags with styled chips
 */
function renderContentWithChips(content: string, entityType: string): React.ReactNode {
  // Simple markdown-like rendering
  let processed = content;

  // Bold **text**
  processed = processed.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic *text*
  processed = processed.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Code `text`
  processed = processed.replace(/`(.+?)`/g, '<code>$1</code>');
  // Links [text](url)
  processed = processed.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  return (
    <>
      <span dangerouslySetInnerHTML={{ __html: processed }} />
      {entityType && entityType !== 'fact' && (
        <span className="outline-node-supertag">#{entityType}</span>
      )}
    </>
  );
}

function OutlineNode({
  node,
  isExpanded,
  onToggleExpand,
  onNodeClick,
  onNodeEdit,
  focusedNodeId,
}: OutlineNodeProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(node.content);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasChildren = node.children.length > 0;
  const isFocused = focusedNodeId === node.id;

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) {
      onToggleExpand(node.id);
    }
  }, [hasChildren, node.id, onToggleExpand]);

  const handleClick = useCallback(() => {
    onNodeClick(node);
  }, [node, onNodeClick]);

  const handleDoubleClick = useCallback(() => {
    setIsEditing(true);
    setEditContent(node.content);
  }, [node.content]);

  const handleBlur = useCallback(() => {
    setIsEditing(false);
    if (editContent !== node.content && onNodeEdit) {
      onNodeEdit(node.id, editContent);
    }
  }, [editContent, node.content, node.id, onNodeEdit]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleBlur();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditContent(node.content);
    }
  }, [handleBlur, node.content]);

  return (
    <div className="outline-node" style={{ marginLeft: node.depth * 24 }}>
      <div
        className={`outline-node-row ${isFocused ? 'focused' : ''}`}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        {/* Toggle button */}
        <button
          type="button"
          className={`outline-node-toggle ${hasChildren ? 'has-children' : ''} ${isExpanded ? 'expanded' : ''}`}
          onClick={handleToggle}
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          {hasChildren ? (
            <ChevronRight size={12} />
          ) : (
            <span style={{ width: 12, height: 12 }} />
          )}
        </button>

        {/* Bullet point */}
        <div className={`outline-node-bullet ${node.entityType.toLowerCase()}`} />

        {/* Content */}
        <div className="outline-node-content">
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              className="outline-node-edit-input"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#e7ebf3',
                fontSize: '14px',
                padding: 0,
              }}
            />
          ) : (
            <span className="outline-node-text">
              {renderContentWithChips(node.content, node.entityType)}
            </span>
          )}
        </div>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="outline-node-children">
          {node.children.map(child => (
            <OutlineNode
              key={child.id}
              node={child}
              isExpanded={true}
              onToggleExpand={onToggleExpand}
              onNodeClick={onNodeClick}
              onNodeEdit={onNodeEdit}
              focusedNodeId={focusedNodeId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default memo(OutlineNode);
