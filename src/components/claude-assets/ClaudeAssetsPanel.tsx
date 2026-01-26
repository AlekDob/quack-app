/**
 * ClaudeAssetsPanel - Main container for Claude Assets Manager
 * Displays projects list and assets browser with drag & drop support
 */

import { useState, useEffect, useMemo } from 'react';
import {
  DndContext,
  pointerWithin,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { Store } from '@tauri-apps/plugin-store';
import { toast } from 'sonner';
import { useClaudeAssets } from '../../hooks/useClaudeAssets';
import ProjectsList from './ProjectsList';
import AssetsBrowser from './AssetsBrowser';
import AssetCard from './AssetCard';
import AssetPreviewModal from './AssetPreviewModal';
import type { ClaudeAsset, ClaudeAssetType } from '../../types/claudeAssets';
import './ClaudeAssetsPanel.css';

interface ClaudeAssetsPanelProps {
  projectPaths: string[];
  onOpenFile?: (path: string) => void;
  onSelectCommand?: (commandName: string, commandScope: 'global' | 'project', isNew?: boolean) => void;
  onSelectRule?: (ruleName: string, ruleScope: 'global' | 'project', isNew?: boolean) => void;
  onSelectDroid?: (agentName: string, agentScope: 'global' | 'project', isNew?: boolean) => void;
}

// Asset type labels - icons rendered as SVG
const ASSET_TYPE_CONFIG: Record<ClaudeAssetType | 'all', { label: string; color: string }> = {
  all: { label: 'All', color: '#6b7280' },
  droid: { label: 'Droids', color: '#8b5cf6' },
  command: { label: 'Commands', color: '#3b82f6' },
  rule: { label: 'Rules', color: '#f59e0b' },
  skill: { label: 'Skills', color: '#10b981' },
  mcp: { label: 'MCPs', color: '#ec4899' },
  hook: { label: 'Hooks', color: '#06b6d4' },
};

// SVG icons for asset types
const AssetTypeIcon = ({ type, size = 14 }: { type: ClaudeAssetType | 'all'; size?: number }) => {
  const icons: Record<ClaudeAssetType | 'all', React.ReactNode> = {
    all: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      </svg>
    ),
    droid: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="10" rx="2" />
        <circle cx="12" cy="5" r="2" />
        <path d="M12 7v4" />
        <line x1="8" y1="16" x2="8" y2="16" />
        <line x1="16" y1="16" x2="16" y2="16" />
      </svg>
    ),
    command: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 17 10 11 4 5" />
        <line x1="12" y1="19" x2="20" y2="19" />
      </svg>
    ),
    rule: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
    skill: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
      </svg>
    ),
    mcp: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v4" />
        <path d="M12 18v4" />
        <path d="M4.93 4.93l2.83 2.83" />
        <path d="M16.24 16.24l2.83 2.83" />
        <path d="M2 12h4" />
        <path d="M18 12h4" />
        <path d="M4.93 19.07l2.83-2.83" />
        <path d="M16.24 7.76l2.83-2.83" />
      </svg>
    ),
    hook: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    ),
  };
  return icons[type] || icons.all;
};

export default function ClaudeAssetsPanel({ projectPaths, onOpenFile, onSelectCommand, onSelectRule, onSelectDroid }: ClaudeAssetsPanelProps) {
  const {
    projects,
    selectedProject,
    selectedAsset,
    filteredAssets,
    globalSearchResults,
    isGlobalSearch,
    filters,
    loading,
    error,
    loadMultipleProjects,
    selectProject,
    selectAsset,
    setFilters,
    copyAsset,
    deleteAsset,
    readAssetContent,
    refreshAll,
  } = useClaudeAssets();

  const [draggedAsset, setDraggedAsset] = useState<ClaudeAsset | null>(null);
  const [dropTargetProject, setDropTargetProject] = useState<string | null>(null);
  const [previewAsset, setPreviewAsset] = useState<ClaudeAsset | null>(null);
  const [previewContent, setPreviewContent] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [repositoryOrder, setRepositoryOrder] = useState<string[]>([]);

  // Load repository order from store (same store used by TerminalSidebar)
  // NOTE: The store now uses new format { order: string[], colors: Record<string, string> }
  // but we need to handle both old (array) and new (object) formats for backwards compatibility
  useEffect(() => {
    const loadOrder = async () => {
      try {
        const store = await Store.load('.quack-repo-order.dat');
        const savedData = await store.get<{ order: string[]; colors: Record<string, string> } | string[]>('repository-order');

        if (savedData) {
          // Handle both old format (array) and new format (object with order property)
          if (Array.isArray(savedData)) {
            // Old format - array of repo keys
            setRepositoryOrder(savedData);
          } else if (savedData.order && Array.isArray(savedData.order)) {
            // New format - object with order property
            setRepositoryOrder(savedData.order);
          }
        }
      } catch (error) {
        console.error('Failed to load repository order:', error);
      }
    };
    loadOrder();
  }, []);

  // Sort projects based on repository order from TerminalSidebar
  const orderedProjects = useMemo(() => {
    if (repositoryOrder.length === 0) {
      return projects;
    }

    // Create a map for quick lookup
    const projectMap = new Map(projects.map(p => [p.name, p]));
    const ordered: typeof projects = [];
    const added = new Set<string>();

    // First add projects in the saved order
    for (const repoKey of repositoryOrder) {
      // repoKey format is "repo-projectName"
      const projectName = repoKey.replace(/^repo-/, '');
      const project = projectMap.get(projectName);
      if (project && !added.has(projectName)) {
        ordered.push(project);
        added.add(projectName);
      }
    }

    // Then add any new projects not in the saved order
    for (const project of projects) {
      if (!added.has(project.name)) {
        ordered.push(project);
      }
    }

    return ordered;
  }, [projects, repositoryOrder]);

  // Configure drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Load projects on mount or when paths change
  useEffect(() => {
    if (projectPaths.length > 0) {
      loadMultipleProjects(projectPaths);
    }
  }, [projectPaths, loadMultipleProjects]);

  // Update search filter
  useEffect(() => {
    setFilters({ searchQuery });
  }, [searchQuery, setFilters]);

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    const asset = filteredAssets.find(a => a.id === event.active.id);
    if (asset) {
      setDraggedAsset(asset);
    }
  };

  // Handle drag over - track which project is being hovered
  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (over) {
      // Extract project path from droppable id
      const overId = String(over.id);
      if (overId.startsWith('project-')) {
        const projectPath = overId.replace('project-', '');
        // Only set as drop target if it's not the selected project
        if (projectPath !== selectedProject?.path) {
          setDropTargetProject(projectPath);
        }
      }
    } else {
      setDropTargetProject(null);
    }
  };

  // Handle drag end
  const handleDragEnd = async (event: DragEndEvent) => {
    const { over } = event;

    if (over && draggedAsset) {
      // Extract project path from droppable id
      const overId = String(over.id);
      if (overId.startsWith('project-')) {
        const targetPath = overId.replace('project-', '');
        // Copy asset to target project if different from source
        if (targetPath !== selectedProject?.path) {
          // Find target project name for toast message
          const targetProject = projects.find(p => p.path === targetPath);
          const targetName = targetProject?.name || targetPath.split('/').pop() || 'target';

          const result = await copyAsset(draggedAsset, targetPath);
          if (result.success) {
            toast.success(`"${draggedAsset.name}" copied to ${targetName}`);
          } else {
            toast.error(`Failed to copy "${draggedAsset.name}": ${result.error}`);
          }
        }
      }
    }

    setDraggedAsset(null);
    setDropTargetProject(null);
  };

  // Handle asset preview - opens tab for commands/rules/droids, modal for others
  const handlePreview = async (asset: ClaudeAsset) => {
    // Determine scope from asset path - global if path includes home directory pattern
    // Global assets typically have path like /Users/*/.<something> or ~/.claude
    const isGlobal = asset.projectName === 'global' || asset.path.match(/\/Users\/[^/]+\/\./);
    const scope: 'global' | 'project' = isGlobal ? 'global' : 'project';

    // For droids/agents, open in dedicated tab
    if (asset.type === 'droid' && onSelectDroid) {
      onSelectDroid(asset.name, scope);
      return;
    }

    // For commands, open in dedicated tab
    if (asset.type === 'command' && onSelectCommand) {
      onSelectCommand(asset.name, scope);
      return;
    }

    // For rules, open in dedicated tab
    if (asset.type === 'rule' && onSelectRule) {
      onSelectRule(asset.name, scope);
      return;
    }

    // For other asset types, show preview modal
    try {
      // For directory assets (like skills), we need to modify the asset path
      const assetToRead = asset.isDirectory
        ? { ...asset, path: `${asset.path}/SKILL.md` }
        : asset;
      const content = await readAssetContent(assetToRead);
      setPreviewContent(content);
      setPreviewAsset(asset);
    } catch (err) {
      console.error('Failed to read asset:', err);
    }
  };

  // Handle asset edit (open in Monaco)
  const handleEdit = (asset: ClaudeAsset) => {
    if (onOpenFile) {
      // For directory assets (like skills), open the SKILL.md file inside
      let filePath = asset.path;
      if (asset.isDirectory) {
        filePath = `${asset.path}/SKILL.md`;
      }
      onOpenFile(filePath);
    }
  };

  // Handle asset delete
  const handleDelete = async (asset: ClaudeAsset) => {
    if (!confirm(`Delete "${asset.name}"? This action cannot be undone.`)) {
      return;
    }

    const result = await deleteAsset(asset);
    if (result.success) {
      toast.success(`"${asset.name}" deleted`);
    } else {
      toast.error(`Failed to delete "${asset.name}": ${result.error}`);
    }
  };

  // Get total asset count - show global results count when searching
  const totalAssets = isGlobalSearch
    ? globalSearchResults.reduce((sum, g) => sum + g.totalCount, 0)
    : selectedProject?.assetCounts.total || 0;

  // Count for header - show search results or project total
  const headerCount = isGlobalSearch
    ? `${totalAssets} result${totalAssets !== 1 ? 's' : ''}`
    : `${totalAssets} asset${totalAssets !== 1 ? 's' : ''}`;

  return (
    <div className="claude-assets-panel">
      {/* Header */}
      <div className="claude-assets-header">
        <div className="claude-assets-title">
          <h2>Project Assets</h2>
          <span className="asset-count">{headerCount}</span>
        </div>
        <div className="claude-assets-actions">
          <input
            type="text"
            className="claude-assets-search"
            placeholder="Search assets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button
            type="button"
            className="claude-assets-refresh"
            onClick={refreshAll}
            disabled={loading}
            title="Refresh all projects"
          >
            <svg
              className={loading ? 'spinning' : ''}
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="claude-assets-error">
          <p>{error}</p>
          <button type="button" onClick={refreshAll}>Retry</button>
        </div>
      )}

      {/* Main content */}
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="claude-assets-content">
          {/* Left sidebar - Projects list */}
          <div className="claude-assets-sidebar">
            <ProjectsList
              projects={orderedProjects}
              selectedProjectPath={selectedProject?.path || null}
              dropTargetProject={dropTargetProject}
              isDragging={!!draggedAsset}
              onSelectProject={(path) => selectProject(path)}
              onDropTargetChange={setDropTargetProject}
            />
          </div>

          {/* Right panel - Assets browser */}
          <div className="claude-assets-main">
            {/* Type filters */}
            <div className="claude-assets-filters">
              {(Object.keys(ASSET_TYPE_CONFIG) as Array<ClaudeAssetType | 'all'>).map((type) => {
                const config = ASSET_TYPE_CONFIG[type];
                const count = type === 'all'
                  ? totalAssets
                  : selectedProject?.assetCounts[type === 'droid' ? 'droids' :
                      type === 'command' ? 'commands' :
                      type === 'rule' ? 'rules' :
                      type === 'skill' ? 'skills' :
                      type === 'mcp' ? 'mcps' : 'hooks'] || 0;

                return (
                  <button
                    key={type}
                    type="button"
                    className={`filter-tab ${filters.type === type ? 'active' : ''}`}
                    onClick={() => setFilters({ type })}
                    style={{ '--filter-color': config.color } as React.CSSProperties}
                  >
                    <span className="filter-icon" style={{ color: config.color }}>
                      <AssetTypeIcon type={type} />
                    </span>
                    <span className="filter-label">{config.label}</span>
                    {count > 0 && <span className="filter-count">{count}</span>}
                  </button>
                );
              })}
            </div>

            {/* Assets grid */}
            <AssetsBrowser
              assets={filteredAssets}
              selectedAsset={selectedAsset}
              onSelectAsset={selectAsset}
              onPreview={handlePreview}
              onDelete={handleDelete}
              isGlobalSearch={isGlobalSearch}
              globalSearchResults={globalSearchResults}
              onSelectProject={(projectPath) => {
                selectProject(projectPath);
                setSearchQuery(''); // Clear search when selecting a project from results
              }}
            />
          </div>
        </div>

        {/* Drag overlay */}
        <DragOverlay>
          {draggedAsset && (
            <div className="asset-drag-preview" style={{ '--drag-color': ASSET_TYPE_CONFIG[draggedAsset.type as ClaudeAssetType]?.color || '#6b7280' } as React.CSSProperties}>
              <span className="drag-icon">
                <AssetTypeIcon type={draggedAsset.type as ClaudeAssetType} size={16} />
              </span>
              <span className="drag-name">{draggedAsset.name}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Preview modal */}
      {previewAsset && (
        <AssetPreviewModal
          asset={previewAsset}
          content={previewContent}
          onClose={() => setPreviewAsset(null)}
          onEdit={() => {
            handleEdit(previewAsset);
            setPreviewAsset(null);
          }}
        />
      )}
    </div>
  );
}
