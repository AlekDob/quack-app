import { memo, useMemo } from 'react';
import { Hash, Clock, Filter, Plus } from 'lucide-react';
import type { OutlineTree, OutlineNode } from '../../services/outlineTreeBuilder';

interface SecondBrainSidebarProps {
  tree: OutlineTree | null;
  supertagCounts: Map<string, number>;
  onFilterByTag: (tag: string | null) => void;
  activeFilter: string | null;
  onAddNew: () => void;
}

// Color mapping for entity types
const SUPERTAG_COLORS: Record<string, string> = {
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

/**
 * Get recent nodes (last 10 by assumed creation order)
 */
function getRecentNodes(tree: OutlineTree | null, limit = 10): OutlineNode[] {
  if (!tree) return [];

  // Get all nodes and return the last N (assuming they were added recently)
  const allNodes = Array.from(tree.nodeMap.values());
  return allNodes.slice(-limit).reverse();
}

function SecondBrainSidebar({
  tree,
  supertagCounts,
  onFilterByTag,
  activeFilter,
  onAddNew,
}: SecondBrainSidebarProps) {
  // Convert map to sorted array
  const sortedTags = useMemo(() => {
    return Array.from(supertagCounts.entries())
      .sort((a, b) => b[1] - a[1]); // Sort by count descending
  }, [supertagCounts]);

  // Get recent nodes
  const recentNodes = useMemo(() => {
    return getRecentNodes(tree);
  }, [tree]);

  return (
    <div className="second-brain-sidebar">
      {/* Quick Actions */}
      <div className="sidebar-section">
        <button
          type="button"
          className="sidebar-add-btn"
          onClick={onAddNew}
        >
          <Plus size={14} />
          <span>New Thought</span>
        </button>
      </div>

      {/* Supertag Filters */}
      <div className="sidebar-section">
        <div className="sidebar-section-header">
          <Filter size={14} />
          <span>Supertags</span>
        </div>
        <div className="sidebar-tag-list">
          {/* All filter */}
          <button
            type="button"
            className={`sidebar-tag-item ${activeFilter === null ? 'active' : ''}`}
            onClick={() => onFilterByTag(null)}
          >
            <div className="sidebar-tag-bullet" style={{ background: '#6b7280' }} />
            <span className="sidebar-tag-name">All</span>
            <span className="sidebar-tag-count">{tree?.totalNodes || 0}</span>
          </button>

          {/* Individual tags */}
          {sortedTags.map(([tag, count]) => (
            <button
              key={tag}
              type="button"
              className={`sidebar-tag-item ${activeFilter === tag ? 'active' : ''}`}
              onClick={() => onFilterByTag(tag)}
            >
              <div
                className="sidebar-tag-bullet"
                style={{ background: SUPERTAG_COLORS[tag] || '#6b7280' }}
              />
              <span className="sidebar-tag-name">{tag}</span>
              <span className="sidebar-tag-count">{count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Recent Items */}
      <div className="sidebar-section">
        <div className="sidebar-section-header">
          <Clock size={14} />
          <span>Recent</span>
        </div>
        <div className="sidebar-recent-list">
          {recentNodes.length === 0 ? (
            <div className="sidebar-empty">No recent items</div>
          ) : (
            recentNodes.map(node => (
              <div key={node.id} className="sidebar-recent-item">
                <div
                  className="sidebar-tag-bullet"
                  style={{ background: SUPERTAG_COLORS[node.entityType] || '#6b7280' }}
                />
                <span className="sidebar-recent-content">
                  {node.content.slice(0, 50)}
                  {node.content.length > 50 ? '...' : ''}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(SecondBrainSidebar);
