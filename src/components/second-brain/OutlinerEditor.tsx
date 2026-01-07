import { memo, useState, useCallback, useMemo, useEffect } from 'react';
import { Brain, RefreshCw, Search, X, PanelRightClose, PanelRightOpen, Check, AlertCircle, Database, FolderSync, Globe, Folder, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { useOutlineTreeBrain } from '../../hooks/useOutlineTreeBrain';
import { useTerminalStore } from '../../stores/terminalStore';
import type { OutlineNode as OutlineNodeType } from '../../services/outlineTreeBuilder';
import type { MemoryScope } from '../../services/mcpMemoryService';
import { brainService, listProjects, type MigrationStatus } from '../../services/brainService';
import type { BrainProject } from '../../types/brain';
import InlineOutliner from './InlineOutliner';
import SecondBrainSidebar from './SecondBrainSidebar';

/**
 * Simple project info derived from terminal paths
 */
interface SimpleProject {
  id: string;
  name: string;
  path: string;
}

/**
 * Format relative time (e.g., "2 min ago", "just now")
 */
function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface OutlinerEditorProps {
  initialNodeId?: string;
  /** Starting path for project detection (default: cwd or home) */
  projectPath?: string;
}

/**
 * Main Outliner Editor Component
 * Tana/Logseq-style inline editing experience
 */
export function OutlinerEditor({ initialNodeId, projectPath }: OutlinerEditorProps) {
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
    lastSyncTime,
    syncStatus,
  } = useOutlineTreeBrain();

  // Migration state
  const [migrationStatus, setMigrationStatus] = useState<MigrationStatus | null>(null);
  const [showMigrationPanel, setShowMigrationPanel] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);

  // Check migration status on mount
  useEffect(() => {
    const checkMigration = async () => {
      try {
        const status = await brainService.getMigrationStatus();
        setMigrationStatus(status);
        // Show migration panel if there's data to import and Brain is empty
        if ((status.mcpMemoryCount > 0 || status.quackMemoryCount > 0) && status.brainEntityCount === 0) {
          setShowMigrationPanel(true);
        }
      } catch (err) {
        console.error('[OutlinerEditor] Failed to check migration status:', err);
      }
    };
    checkMigration();
  }, []);

  // Handle import from MCP Memory
  const handleImportMCP = useCallback(async () => {
    setIsMigrating(true);
    try {
      const result = await brainService.importFromMCPMemory();
      toast.success('MCP Memory imported', {
        description: `${result.importedEntities} entities, ${result.importedRelations} relations`,
      });
      refresh();
      // Update migration status
      const status = await brainService.getMigrationStatus();
      setMigrationStatus(status);
    } catch (err) {
      toast.error('Import failed', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsMigrating(false);
    }
  }, [refresh]);

  // Handle import from Quack Memory
  const handleImportQuack = useCallback(async () => {
    setIsMigrating(true);
    try {
      const result = await brainService.importFromQuackMemory();
      toast.success('Quack Memory imported', {
        description: `${result.importedEntities} entities imported`,
      });
      refresh();
      // Update migration status
      const status = await brainService.getMigrationStatus();
      setMigrationStatus(status);
    } catch (err) {
      toast.error('Import failed', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsMigrating(false);
    }
  }, [refresh]);

  // Handle sync to markdown
  const handleSyncMarkdown = useCallback(async () => {
    try {
      const result = await brainService.syncAllToMarkdown();
      toast.success('Synced to Markdown', {
        description: `${result.filesCreated} created, ${result.filesUpdated} updated`,
      });
      // Open folder
      await brainService.openMarkdownFolder();
    } catch (err) {
      toast.error('Sync failed', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }, []);

  // Show toast on sync completion
  useEffect(() => {
    if (syncStatus === 'success' && lastSyncTime) {
      toast.success('Memory synced', {
        description: `${totalNodes} nodes loaded`,
        duration: 2000,
      });
    } else if (syncStatus === 'error' && error) {
      toast.error('Sync failed', {
        description: error,
        duration: 3000,
      });
    }
  }, [syncStatus, lastSyncTime, totalNodes, error]);

  // Get projects from terminals (projectTerminals store)
  const projectTerminals = useTerminalStore(state => state.projectTerminals);

  // Combine Brain projects with terminal-derived projects
  const [brainProjects, setBrainProjects] = useState<BrainProject[]>([]);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);

  // Load registered Brain projects
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const projects = await listProjects();
        setBrainProjects(projects);
      } catch (err) {
        console.error('[OutlinerEditor] Failed to load Brain projects:', err);
      }
    };
    loadProjects();
  }, []);

  // Merge Brain projects with terminal-derived projects (unique by path)
  const availableProjects = useMemo((): SimpleProject[] => {
    const projectMap = new Map<string, SimpleProject>();

    // Add Brain projects first
    brainProjects.forEach(p => {
      projectMap.set(p.path, {
        id: p.id,
        name: p.name,
        path: p.path,
      });
    });

    // Add terminal-derived projects (if not already present)
    projectTerminals.forEach(t => {
      if (t.projectPath && !projectMap.has(t.projectPath)) {
        // Extract project name from path
        const name = t.projectPath.split('/').pop() || t.projectPath;
        projectMap.set(t.projectPath, {
          id: t.projectPath, // Use path as ID for terminal-derived projects
          name,
          path: t.projectPath,
        });
      }
    });

    return Array.from(projectMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [brainProjects, projectTerminals]);

  const [searchQuery, setSearchQuery] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [zoomedNode, setZoomedNode] = useState<OutlineNodeType | null>(null);

  // Scope state for new memories
  const [selectedScope, setSelectedScope] = useState<MemoryScope>('global');
  // Selected project from dropdown (null = global)
  const [selectedProject, setSelectedProject] = useState<SimpleProject | null>(null);
  // Selected project name for InlineOutliner
  const selectedProjectName = selectedProject?.name || null;

  // Current project info (for InlineOutliner compatibility)
  const currentProject = selectedProject ? {
    root_path: selectedProject.path,
    name: selectedProject.name,
    markers: [],
  } : null;

  // Handle project selection from dropdown
  const handleProjectSelect = useCallback((project: SimpleProject | null) => {
    setSelectedProject(project);
    setSelectedScope(project ? 'project' : 'global');
    setShowProjectDropdown(false);
  }, []);

  // Toggle scope between global and project (when clicking the button)
  const toggleScope = useCallback(() => {
    if (selectedScope === 'global') {
      // If there are projects, show dropdown to select one
      if (availableProjects.length > 0) {
        setShowProjectDropdown(!showProjectDropdown);
      }
    } else {
      // Switch back to global
      setSelectedScope('global');
      setSelectedProject(null);
    }
  }, [selectedScope, availableProjects.length, showProjectDropdown]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showProjectDropdown) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.outliner-scope-wrapper')) {
        setShowProjectDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProjectDropdown]);

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

    // Apply tag filter
    if (activeTagFilter) {
      const tagFiltered = filterByTag(activeTagFilter);
      // Intersect with current filter
      const tagFilteredIds = new Set(tagFiltered.map(n => n.id));
      filtered = filtered.filter(root => tagFilteredIds.has(root.id));
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

  // Zoom to initial node when tree loads (e.g., from Knowledge Graph click)
  useEffect(() => {
    if (initialNodeId && tree) {
      const node = tree.nodeMap.get(initialNodeId);
      console.log('[SecondBrain] Looking for initialNodeId:', initialNodeId);
      console.log('[SecondBrain] Available nodeMap keys:', Array.from(tree.nodeMap.keys()).slice(0, 5));
      if (node) {
        console.log('[SecondBrain] Found node, zooming:', node.content);
        setZoomedNode(node);
      } else {
        console.log('[SecondBrain] Node not found in nodeMap');
      }
    }
  }, [initialNodeId, tree]);

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

            {/* Scope Selector with Dropdown */}
            <div className="outliner-scope-wrapper">
              <button
                type="button"
                className={`outliner-scope-btn ${selectedScope}`}
                onClick={toggleScope}
                title={selectedScope === 'global'
                  ? 'Click to select a project scope'
                  : `Project scope - memories linked to ${selectedProject?.name || 'project'}. Click to switch to Global.`
                }
              >
                {selectedScope === 'global' ? (
                  <>
                    <Globe size={14} />
                    <span>Global</span>
                    {availableProjects.length > 0 && <ChevronDown size={12} />}
                  </>
                ) : (
                  <>
                    <Folder size={14} />
                    <span>{selectedProject?.name || 'Project'}</span>
                  </>
                )}
              </button>

              {/* Project Dropdown */}
              {showProjectDropdown && availableProjects.length > 0 && (
                <div className="outliner-scope-dropdown">
                  <button
                    type="button"
                    className="scope-dropdown-item global"
                    onClick={() => handleProjectSelect(null)}
                  >
                    <Globe size={14} />
                    <span>Global</span>
                    <span className="scope-hint">Visible everywhere</span>
                  </button>
                  <div className="scope-dropdown-divider" />
                  {availableProjects.map((project) => (
                    <button
                      type="button"
                      key={project.id}
                      className={`scope-dropdown-item project ${selectedProject?.id === project.id ? 'selected' : ''}`}
                      onClick={() => handleProjectSelect(project)}
                    >
                      <Folder size={14} />
                      <span>{project.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Export to Markdown */}
            <button
              type="button"
              className="outliner-action-btn"
              onClick={handleSyncMarkdown}
              title="Export to Markdown (Obsidian)"
            >
              <FolderSync size={14} />
            </button>

            {/* Migration Toggle */}
            {migrationStatus && (migrationStatus.mcpMemoryCount > 0 || migrationStatus.quackMemoryCount > 0) && (
              <button
                type="button"
                className={`outliner-action-btn ${showMigrationPanel ? 'active' : ''}`}
                onClick={() => setShowMigrationPanel(!showMigrationPanel)}
                title="Import data from legacy storage"
              >
                <Database size={14} />
              </button>
            )}

            {/* Sync Status & Refresh Button */}
            <div className="outliner-sync-group">
              {lastSyncTime && (
                <span className="outliner-sync-time" title={new Date(lastSyncTime).toLocaleString()}>
                  {formatRelativeTime(lastSyncTime)}
                </span>
              )}
              <button
                type="button"
                className={`outliner-refresh-btn ${syncStatus === 'success' ? 'success' : ''} ${syncStatus === 'error' ? 'error' : ''}`}
                onClick={refresh}
                disabled={isLoading || syncStatus === 'syncing'}
                title={syncStatus === 'syncing' ? 'Syncing...' : 'Sync memory'}
              >
                {syncStatus === 'success' ? (
                  <Check size={14} />
                ) : syncStatus === 'error' ? (
                  <AlertCircle size={14} />
                ) : (
                  <RefreshCw size={14} className={isLoading || syncStatus === 'syncing' ? 'animate-spin' : ''} />
                )}
              </button>
            </div>

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

        {/* Migration Panel */}
        {showMigrationPanel && migrationStatus && (
          <div className="outliner-migration-panel">
            <div className="migration-header">
              <Database size={16} />
              <span>Import Legacy Data</span>
              <button
                type="button"
                className="migration-close"
                onClick={() => setShowMigrationPanel(false)}
              >
                <X size={14} />
              </button>
            </div>
            <div className="migration-content">
              <p className="migration-description">
                Import your existing memories into the new SQLite-based storage.
                This is a one-time migration - duplicates will be skipped.
              </p>
              <div className="migration-sources">
                {migrationStatus.mcpMemoryAvailable && migrationStatus.mcpMemoryCount > 0 && (
                  <div className="migration-source">
                    <div className="source-info">
                      <span className="source-name">MCP Memory</span>
                      <span className="source-count">{migrationStatus.mcpMemoryCount} entities</span>
                    </div>
                    <button
                      type="button"
                      className="migration-import-btn"
                      onClick={handleImportMCP}
                      disabled={isMigrating}
                    >
                      {isMigrating ? <RefreshCw size={12} className="animate-spin" /> : 'Import'}
                    </button>
                  </div>
                )}
                {migrationStatus.quackMemoryCount > 0 && (
                  <div className="migration-source">
                    <div className="source-info">
                      <span className="source-name">Quack Memory</span>
                      <span className="source-count">{migrationStatus.quackMemoryCount} memories</span>
                    </div>
                    <button
                      type="button"
                      className="migration-import-btn"
                      onClick={handleImportQuack}
                      disabled={isMigrating}
                    >
                      {isMigrating ? <RefreshCw size={12} className="animate-spin" /> : 'Import'}
                    </button>
                  </div>
                )}
              </div>
              <div className="migration-status">
                <span>Current Brain: {migrationStatus.brainEntityCount} entities</span>
              </div>
            </div>
          </div>
        )}

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
                selectedScope={selectedScope}
                currentProject={currentProject}
                selectedProjectName={selectedProjectName}
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
              selectedScope={selectedScope}
              currentProject={currentProject}
              selectedProjectName={selectedProjectName}
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
