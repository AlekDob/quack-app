/**
 * Claude Assets Manager Types
 * Types for managing .claude/ folder assets across multiple projects
 */

// Asset types that can be managed
export type ClaudeAssetType =
  | 'droid'    // .claude/agents/*.md
  | 'command'  // .claude/commands/*.md
  | 'rule'     // .claude/rules/*.md
  | 'skill'    // .claude/skills/*.md or .claude/skills/*/SKILL.md
  | 'mcp'      // .claude/mcps/*.json
  | 'hook';    // In settings.json hooks array

// Asset metadata parsed from YAML frontmatter (for MD files)
export interface ClaudeAssetMetadata {
  name?: string;
  description?: string;
  model?: string;
  tools?: string[];
  'allowed-tools'?: string;
  'argument-hint'?: string;
  alwaysApply?: boolean;
  globs?: string[];
}

// A single Claude asset
export interface ClaudeAsset {
  id: string;              // Unique identifier (hash of path)
  name: string;            // Display name (filename without extension)
  type: ClaudeAssetType;
  path: string;            // Full path to asset file
  relativePath: string;    // Path relative to .claude/ folder
  projectPath: string;     // Project root path
  projectName: string;     // Project name (folder name)
  metadata: ClaudeAssetMetadata;
  isDirectory: boolean;    // True for skill directories
  size: number;            // File size in bytes
  modifiedAt: number;      // Last modified timestamp
}

// All assets for a single project
export interface ProjectAssets {
  droids: ClaudeAsset[];
  commands: ClaudeAsset[];
  rules: ClaudeAsset[];
  skills: ClaudeAsset[];
  mcps: ClaudeAsset[];
  hooks: ClaudeAsset[];
}

// A project with its .claude/ assets
export interface ClaudeProject {
  name: string;           // Project folder name
  path: string;           // Full path to project
  branch?: string;        // Current git branch
  hasClaudeFolder: boolean;
  assets: ProjectAssets;
  assetCounts: {
    droids: number;
    commands: number;
    rules: number;
    skills: number;
    mcps: number;
    hooks: number;
    total: number;
  };
}

// Operation types for asset management
export type AssetOperation = 'copy' | 'move' | 'clone' | 'delete';

// Result of an asset operation
export interface AssetOperationResult {
  success: boolean;
  operation: AssetOperation;
  sourceAsset: ClaudeAsset;
  targetProject?: string;
  newPath?: string;
  error?: string;
}

// Drag and drop payload
export interface AssetDragPayload {
  asset: ClaudeAsset;
  sourceProject: string;
}

// Drop target info
export interface AssetDropTarget {
  projectPath: string;
  projectName: string;
  assetType: ClaudeAssetType;
}

// Filter state for asset browser
export interface AssetFilters {
  type: ClaudeAssetType | 'all';
  searchQuery: string;
  sortBy: 'name' | 'modified' | 'type';
  sortOrder: 'asc' | 'desc';
}

// State for the Claude Assets Manager
export interface ClaudeAssetsState {
  projects: ClaudeProject[];
  selectedProject: string | null;
  selectedAsset: ClaudeAsset | null;
  filters: AssetFilters;
  loading: boolean;
  error: string | null;
  draggedAsset: AssetDragPayload | null;
}

// Props for asset-related components
export interface AssetCardProps {
  asset: ClaudeAsset;
  isSelected: boolean;
  isDragging: boolean;
  onSelect: (asset: ClaudeAsset) => void;
  onCopy: (asset: ClaudeAsset, targetProject: string) => void;
  onDelete: (asset: ClaudeAsset) => void;
  onPreview: (asset: ClaudeAsset) => void;
  onEdit: (asset: ClaudeAsset) => void;
}

export interface ProjectItemProps {
  project: ClaudeProject;
  isSelected: boolean;
  isDropTarget: boolean;
  onSelect: (project: ClaudeProject) => void;
  onDrop: (asset: ClaudeAsset, project: ClaudeProject) => void;
}

// Tab configuration
export interface ClaudeAssetsTab {
  id: string;
  type: 'claude-assets';
  label: string;
  closable: boolean;
  selectedProject?: string;
}
