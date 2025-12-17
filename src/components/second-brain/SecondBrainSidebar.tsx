import { memo, useMemo, useState, useCallback } from 'react';
import { Filter, Plus } from 'lucide-react';
import type { OutlineTree } from '../../services/outlineTreeBuilder';
import { useSupertagConfig } from '../../hooks/useSupertagConfig';
import { SupertagConfigDrawer } from './SupertagConfigDrawer';
import type { SupertagConfig } from '../../services/supertagConfigService';

interface SecondBrainSidebarProps {
  tree: OutlineTree | null;
  supertagCounts: Map<string, number>;
  onFilterByTag: (tag: string | null) => void;
  activeFilter: string | null;
  onAddNew: () => void;
}

function SecondBrainSidebar({
  tree,
  supertagCounts,
  onFilterByTag,
  activeFilter,
  onAddNew,
}: SecondBrainSidebarProps) {
  // Use supertag config hook for dynamic colors
  const { getColor, getConfig, saveConfig } = useSupertagConfig();

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Convert map to sorted array
  const sortedTags = useMemo(() => {
    return Array.from(supertagCounts.entries())
      .sort((a, b) => b[1] - a[1]); // Sort by count descending
  }, [supertagCounts]);

  // Handle right-click on tag
  const handleTagContextMenu = useCallback((e: React.MouseEvent, tag: string) => {
    e.preventDefault();
    setSelectedTag(tag);
    setDrawerOpen(true);
  }, []);

  // Handle drawer close
  const handleDrawerClose = useCallback(() => {
    setDrawerOpen(false);
    setSelectedTag(null);
  }, []);

  // Handle save config
  const handleSaveConfig = useCallback(async (config: SupertagConfig) => {
    await saveConfig(config);
  }, [saveConfig]);

  // Get current config for selected tag
  const selectedTagConfig = useMemo(() => {
    if (!selectedTag) return null;
    return getConfig(selectedTag);
  }, [selectedTag, getConfig]);

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
              onContextMenu={(e) => handleTagContextMenu(e, tag)}
            >
              <div
                className="sidebar-tag-bullet"
                style={{ background: getColor(tag) }}
              />
              <span className="sidebar-tag-name">{tag}</span>
              <span className="sidebar-tag-count">{count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Supertag Config Drawer */}
      {selectedTag && selectedTagConfig && (
        <SupertagConfigDrawer
          isOpen={drawerOpen}
          tagName={selectedTag}
          initialConfig={selectedTagConfig}
          onClose={handleDrawerClose}
          onSave={handleSaveConfig}
        />
      )}
    </div>
  );
}

export default memo(SecondBrainSidebar);
