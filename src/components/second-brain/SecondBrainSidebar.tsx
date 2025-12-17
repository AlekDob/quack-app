import { memo, useMemo, useState, useCallback, useEffect } from 'react';
import { Hash, Clock, Filter, Plus, Globe, FolderOpen, ChevronDown, Check, Layers } from 'lucide-react';
import type { OutlineTree, OutlineNode } from '../../services/outlineTreeBuilder';
import type { MemoryScope, MCPEntity } from '../../services/mcpMemoryService';
import { getScopeStatistics, getAllProjects } from '../../services/mcpMemoryService';
import type { ProjectInfo } from '../../hooks/useCurrentProject';

/** View filter for displaying memories */
export type ScopeViewFilter = 'all' | 'global' | 'project';

interface SecondBrainSidebarProps {
  tree: OutlineTree | null;
  supertagCounts: Map<string, number>;
  onFilterByTag: (tag: string | null) => void;
  activeFilter: string | null;
  onAddNew: () => void;
  /** Current project info from detection (null if no project detected) */
  currentProject: ProjectInfo | null;
  /** Selected scope for new memories */
  selectedScope: MemoryScope;
  /** Callback when scope changes */
  onScopeChange: (scope: MemoryScope) => void;
  /** Selected project name for new memories (when scope is 'project') */
  selectedProjectName: string | null;
  /** Callback when project selection changes */
  onProjectChange: (projectName: string | null) => void;
  /** View filter for displaying memories */
  viewFilter: ScopeViewFilter;
  /** Callback when view filter changes */
  onViewFilterChange: (filter: ScopeViewFilter) => void;
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

/** Project option for dropdown */
interface ProjectOption {
  name: string;
  source: 'detected' | 'memory';
  path?: string;
}

function SecondBrainSidebar({
  tree,
  supertagCounts,
  onFilterByTag,
  activeFilter,
  onAddNew,
  currentProject,
  selectedScope,
  onScopeChange,
  selectedProjectName,
  onProjectChange,
  viewFilter,
  onViewFilterChange,
}: SecondBrainSidebarProps) {
  const [scopeDropdownOpen, setScopeDropdownOpen] = useState(false);

  // Get all available projects - HYBRID approach:
  // 1. Auto-detected project from filesystem
  // 2. Projects from MCP Memory
  const availableProjects = useMemo((): ProjectOption[] => {
    const projectsMap = new Map<string, ProjectOption>();

    // Add auto-detected project first (if available)
    if (currentProject?.name) {
      projectsMap.set(currentProject.name, {
        name: currentProject.name,
        source: 'detected',
        path: currentProject.root_path,
      });
    }

    // Add projects from MCP Memory (won't overwrite detected)
    const memoryProjects = getAllProjects();
    for (const proj of memoryProjects) {
      if (!projectsMap.has(proj.name)) {
        projectsMap.set(proj.name, {
          name: proj.name,
          source: 'memory',
        });
      }
    }

    return Array.from(projectsMap.values());
  }, [tree, currentProject]); // Re-fetch when tree or detected project changes

  // Convert map to sorted array
  const sortedTags = useMemo(() => {
    return Array.from(supertagCounts.entries())
      .sort((a, b) => b[1] - a[1]); // Sort by count descending
  }, [supertagCounts]);

  // Get recent nodes
  const recentNodes = useMemo(() => {
    return getRecentNodes(tree);
  }, [tree]);

  // Get scope statistics (use selected project, not detected project)
  const scopeStats = useMemo(() => {
    return getScopeStatistics(selectedProjectName || currentProject?.name);
  }, [selectedProjectName, currentProject?.name, tree]); // Re-calculate when tree changes

  // Handle scope selection (global)
  const handleScopeSelect = useCallback((scope: MemoryScope, projectName?: string) => {
    onScopeChange(scope);
    if (scope === 'project' && projectName) {
      onProjectChange(projectName);
    } else if (scope === 'global') {
      onProjectChange(null);
    }
    setScopeDropdownOpen(false);
  }, [onScopeChange, onProjectChange]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.sidebar-scope-dropdown')) {
        setScopeDropdownOpen(false);
      }
    };

    if (scopeDropdownOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [scopeDropdownOpen]);

  return (
    <div className="second-brain-sidebar">
      {/* Scope Selection - For NEW memories */}
      <div className="sidebar-scope-section">
        <div className="sidebar-scope-label">
          <Layers size={12} />
          <span>New Memory Scope</span>
        </div>

        <div className="sidebar-scope-dropdown">
          <button
            type="button"
            className={`sidebar-scope-button ${scopeDropdownOpen ? 'open' : ''}`}
            onClick={() => setScopeDropdownOpen(!scopeDropdownOpen)}
          >
            <div className="sidebar-scope-button-content">
              <div className={`sidebar-scope-icon ${selectedScope}`}>
                {selectedScope === 'global' ? <Globe size={16} /> : <FolderOpen size={16} />}
              </div>
              <span>
                {selectedScope === 'global' ? 'Global' : selectedProjectName || 'Select Project'}
              </span>
            </div>
            <ChevronDown className="sidebar-scope-chevron" />
          </button>

          {scopeDropdownOpen && (
            <div className="sidebar-scope-menu">
              <button
                type="button"
                className={`sidebar-scope-option ${selectedScope === 'global' ? 'active' : ''}`}
                onClick={() => handleScopeSelect('global')}
              >
                <div className="sidebar-scope-option-icon global">
                  <Globe size={16} />
                </div>
                <span className="sidebar-scope-option-text">Global</span>
                {selectedScope === 'global' && <Check className="sidebar-scope-option-check" />}
              </button>

              {/* Show all available projects (detected + from memory) */}
              {availableProjects.length > 0 ? (
                availableProjects.map((project) => (
                  <button
                    key={project.name}
                    type="button"
                    className={`sidebar-scope-option ${selectedScope === 'project' && selectedProjectName === project.name ? 'active' : ''}`}
                    onClick={() => handleScopeSelect('project', project.name)}
                    title={project.source === 'detected' ? `Detected: ${project.path}` : 'From memory'}
                  >
                    <div className="sidebar-scope-option-icon project">
                      <FolderOpen size={16} />
                    </div>
                    <span className="sidebar-scope-option-text">{project.name}</span>
                    {selectedScope === 'project' && selectedProjectName === project.name && (
                      <Check className="sidebar-scope-option-check" />
                    )}
                  </button>
                ))
              ) : (
                <div className="sidebar-no-project">
                  <FolderOpen size={14} />
                  No project detected
                </div>
              )}
            </div>
          )}
        </div>

        {/* View Filter Tabs */}
        <div className="sidebar-scope-filters">
          <button
            type="button"
            className={`sidebar-scope-filter ${viewFilter === 'all' ? 'active' : ''}`}
            onClick={() => onViewFilterChange('all')}
          >
            All
          </button>
          <button
            type="button"
            className={`sidebar-scope-filter ${viewFilter === 'global' ? 'active' : ''}`}
            onClick={() => onViewFilterChange('global')}
          >
            Global
          </button>
          <button
            type="button"
            className={`sidebar-scope-filter ${viewFilter === 'project' ? 'active' : ''}`}
            onClick={() => onViewFilterChange('project')}
            disabled={!selectedProjectName}
            title={selectedProjectName ? `Show only ${selectedProjectName}` : 'Select a project first'}
          >
            Project
          </button>
        </div>

        {/* Scope Statistics */}
        <div className="sidebar-scope-stats">
          <div className="sidebar-scope-stat">
            <Globe size={10} />
            <span className="sidebar-scope-stat-value">{scopeStats.global}</span>
            <span>global</span>
          </div>
          <div className="sidebar-scope-stat">
            <FolderOpen size={10} />
            <span className="sidebar-scope-stat-value">{scopeStats.project}</span>
            <span>project</span>
          </div>
        </div>
      </div>

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
