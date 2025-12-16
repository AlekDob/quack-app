import { memo, useState, useCallback, useMemo, useEffect } from 'react';
import { Brain, RefreshCw, Search, X, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { useOutlineTree } from '../../hooks/useOutlineTree';
import type { OutlineNode as OutlineNodeType } from '../../services/outlineTreeBuilder';
import InlineOutliner from './InlineOutliner';
import SecondBrainSidebar from './SecondBrainSidebar';

/**
 * Main Outliner Editor Component
 * Tana/Logseq-style inline editing experience
 */
export function OutlinerEditor() {
  const {
    tree,
    roots,
    isLoading,
    error,
    supertagCounts,
    totalNodes,
    refresh,
    toggleExpand,
    expandedNodes,
    search,
    filterByTag,
  } = useOutlineTree();

  const [searchQuery, setSearchQuery] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [zoomedNode, setZoomedNode] = useState<OutlineNodeType | null>(null);

  // Build breadcrumbs from zoomed node path
  const breadcrumbs = useMemo(() => {
    if (!zoomedNode || !tree) return [];

    const path: OutlineNodeType[] = [];
    let current: OutlineNodeType | undefined = zoomedNode;

    // Walk up the tree to build path
    while (current) {
      path.unshift(current);
      if (current.parentId) {
        current = tree.nodeMap.get(current.parentId);
      } else {
        break;
      }
    }

    return path;
  }, [zoomedNode, tree]);

  // Filter roots by search query and tag filter
  const filteredRoots = useMemo(() => {
    let filtered = roots;

    // Apply tag filter first
    if (activeTagFilter) {
      filtered = filterByTag(activeTagFilter);
    }

    // Then apply search query
    if (searchQuery.trim()) {
      const results = search(searchQuery);
      filtered = filtered.filter(root =>
        results.some(r => r.id === root.id || root.children.some(c => c.id === r.id))
      );
    }

    return filtered;
  }, [roots, searchQuery, search, activeTagFilter, filterByTag]);

  const handleTagFilter = useCallback((tag: string | null) => {
    setActiveTagFilter(tag);
    setZoomedNode(null); // Reset zoom when filtering
  }, []);

  const handleZoom = useCallback((node: OutlineNodeType | null) => {
    setZoomedNode(node);
  }, []);

  const handleSidebarAddNew = useCallback(() => {
    // Focus the new bullet input at bottom
    // This will be handled by InlineOutliner
    setZoomedNode(null);
  }, []);

  // Update zoomedNode when tree changes (e.g., after refresh)
  // This ensures observations update immediately after adding
  useEffect(() => {
    if (zoomedNode && tree) {
      const updatedNode = tree.nodeMap.get(zoomedNode.id);
      if (updatedNode && updatedNode !== zoomedNode) {
        // Only update if the node data has actually changed
        const observationsChanged =
          JSON.stringify(updatedNode.observations) !== JSON.stringify(zoomedNode.observations);
        const childrenChanged =
          updatedNode.children.length !== zoomedNode.children.length;

        if (observationsChanged || childrenChanged) {
          setZoomedNode(updatedNode);
        }
      }
    }
  }, [tree, zoomedNode]);

  return (
    <div className="outliner-editor-container">
      <div className="outliner-editor">
        {/* Toolbar */}
        <div className="outliner-toolbar">
          <div className="outliner-toolbar-left">
            <div className="outliner-toolbar-title">
              <Brain size={18} />
              <span>Second Brain</span>
            </div>
            <div className="outliner-toolbar-stats">
              <span className="outliner-stat">
                {totalNodes} nodes
              </span>
              {activeTagFilter && (
                <span className="outliner-stat active-filter">
                  #{activeTagFilter}
                  <button
                    type="button"
                    onClick={() => setActiveTagFilter(null)}
                    className="clear-filter-btn"
                  >
                    <X size={10} />
                  </button>
                </span>
              )}
            </div>
          </div>

          <div className="outliner-toolbar-right">
            {/* Search */}
            <div className="outliner-search">
              <Search size={14} />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="search-clear"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              className="outliner-refresh-btn"
              onClick={refresh}
              disabled={isLoading}
              title="Refresh"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            </button>

            {/* Sidebar Toggle */}
            <button
              type="button"
              className={`outliner-sidebar-toggle ${showSidebar ? 'active' : ''}`}
              onClick={() => setShowSidebar(!showSidebar)}
              title={showSidebar ? 'Hide sidebar' : 'Show sidebar'}
            >
              {showSidebar ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="outliner-content">
          {isLoading ? (
            <div className="outliner-loading">
              <RefreshCw size={32} className="animate-spin" />
              <span>Loading knowledge graph...</span>
            </div>
          ) : error ? (
            <div className="outliner-empty">
              <Brain size={48} />
              <h3>Error loading data</h3>
              <p>{error}</p>
            </div>
          ) : filteredRoots.length === 0 && !zoomedNode ? (
            <div className="outliner-empty-inline">
              <p className="empty-hint">Start typing below to create your first thought...</p>
              <InlineOutliner
                roots={[]}
                expandedNodes={expandedNodes}
                onToggleExpand={toggleExpand}
                onRefresh={refresh}
                zoomedNode={null}
                onZoom={handleZoom}
                breadcrumbs={[]}
              />
            </div>
          ) : (
            <InlineOutliner
              roots={filteredRoots}
              expandedNodes={expandedNodes}
              onToggleExpand={toggleExpand}
              onRefresh={refresh}
              zoomedNode={zoomedNode}
              onZoom={handleZoom}
              breadcrumbs={breadcrumbs}
            />
          )}
        </div>
      </div>

      {/* Sidebar */}
      {showSidebar && (
        <SecondBrainSidebar
          tree={tree}
          supertagCounts={supertagCounts}
          onFilterByTag={handleTagFilter}
          activeFilter={activeTagFilter}
          onAddNew={handleSidebarAddNew}
        />
      )}
    </div>
  );
}

export default memo(OutlinerEditor);
