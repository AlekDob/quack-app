/**
 * Agent Selector Component
 *
 * Allows users to select from saved agents or create a new one.
 * Shows agent cards with avatars, names, and personalities.
 * Includes inline editing/creation form when triggered.
 */

import { useState, useMemo, useEffect } from 'react';
import type { SavedAgent, AgentPersonality, AgentTemplate, MarketplaceResource } from '../types';
import {
  getSavedAgents,
  getRecentAgents,
  getFrequentAgents,
  searchAgents,
  deleteAgent
} from '../utils/agentStorage';
import { AVAILABLE_AVATARS, getAvatarUrl } from '../utils/agentAvatars';
import { convertFileSrc } from '@tauri-apps/api/core';
import { ask } from '@tauri-apps/plugin-dialog';
import type { CustomAvatarInfo } from '../utils/customAvatarStorage';
import SkillSelector from './SkillSelector';
import MarketplaceInstallModal from './MarketplaceInstallModal';
import { useMarketplace } from '../hooks/useMarketplace';
import { useBundleOperations } from '../hooks/useBundleOperations';
import './AgentSelector.css';

// Communication styles for personality
const COMMUNICATION_STYLES = [
  { id: 'professional', label: 'Professional', description: 'Formal and precise' },
  { id: 'friendly', label: 'Friendly', description: 'Warm and approachable' },
  { id: 'casual', label: 'Casual', description: 'Relaxed and informal' },
  { id: 'technical', label: 'Technical', description: 'Highly detailed and technical' },
  { id: 'sarcastic', label: 'Sarcastic', description: 'Witty and ironic' },
];

// Extended marketplace resource with agent template
interface MarketplaceAgentBundle extends MarketplaceResource {
  _agentTemplate?: AgentTemplate;
  _pluginSource?: string;
}

interface AgentSelectorProps {
  onUseAgent: (agent: SavedAgent) => void;
  onEditAgent: (agent: SavedAgent) => void;
  onCreateNew: () => void;
  // Callback when user selects a marketplace template
  onUseMarketplaceTemplate?: (template: AgentTemplate, resource: MarketplaceResource) => void;
  // Callback when an agent is imported from bundle
  onImportAgent?: (agent: SavedAgent) => void;
  // Project path for loading skills
  projectPath?: string;
  // New props for inline editing
  editingMode?: 'create' | 'edit' | null;
  editingAgent?: SavedAgent | null;
  // Form state props
  name?: string;
  color?: string;
  avatar?: string;
  availableColors?: readonly string[];
  customAvatars?: CustomAvatarInfo[];
  customAvatarUrls?: Record<string, string>;
  loadingAvatars?: boolean;
  uploadingAvatar?: boolean;
  uploadError?: string | null;
  personality?: Partial<AgentPersonality>;
  onNameChange?: (name: string) => void;
  onColorChange?: (color: string) => void;
  onAvatarChange?: (avatar: string) => void;
  onPersonalityChange?: (personality: Partial<AgentPersonality>) => void;
  onAvatarUpload?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDeleteCustomAvatar?: (avatarId: string, event: React.MouseEvent) => void;
  fileInputRef?: React.RefObject<HTMLInputElement | null>;
  onConfirm?: () => void;
  onCancelEdit?: () => void;
  /** Open the Quack Store drawer to browse details */
  onOpenStore?: () => void;
}

type SortMode = 'recent' | 'frequent' | 'alphabetical';

export default function AgentSelector({
  onUseAgent,
  onEditAgent,
  onCreateNew,
  onUseMarketplaceTemplate,
  onImportAgent,
  // Project path for loading skills
  projectPath = '',
  // Inline editing props
  editingMode,
  editingAgent,
  name = '',
  color = '#FF6B35',
  avatar = '',
  availableColors = [],
  customAvatars = [],
  customAvatarUrls = {},
  loadingAvatars = false,
  uploadingAvatar = false,
  uploadError = null,
  personality = {},
  onNameChange,
  onColorChange,
  onAvatarChange,
  onPersonalityChange,
  onAvatarUpload,
  onDeleteCustomAvatar,
  fileInputRef,
  onConfirm,
  onCancelEdit,
  onOpenStore,
}: AgentSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [deletingAgentId, setDeletingAgentId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0); // Force re-render after delete
  const [detailResource, setDetailResource] = useState<MarketplaceResource | null>(null);

  // Load marketplace agent bundles
  const { allResources, loading: marketplaceLoading, installResource } = useMarketplace();

  // Bundle import operations
  const {
    importing, error: bundleError, success: bundleSuccess,
    importBundle, clearError: clearBundleError,
  } = useBundleOperations();

  async function handleImportBundle() {
    const imported = await importBundle();
    if (imported) {
      setRefreshKey(prev => prev + 1);
      onImportAgent?.(imported);
    }
  }

  // Filter to get only agent-bundles (templates)
  const marketplaceAgentBundles = useMemo(() => {
    return allResources.filter(
      r => r.category === 'agent-bundles'
    ) as MarketplaceAgentBundle[];
  }, [allResources]);

  // Randomize avatar order (memoized so it doesn't change on re-renders)
  const randomizedAvatars = useMemo(() => {
    const avatars = [...AVAILABLE_AVATARS];
    // Fisher-Yates shuffle
    for (let i = avatars.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [avatars[i], avatars[j]] = [avatars[j], avatars[i]];
    }
    return avatars;
  }, []);

  // Auto-select first avatar if none selected (only in editing mode)
  useEffect(() => {
    if (editingMode && (!avatar || avatar.trim() === '') && randomizedAvatars.length > 0) {
      const firstAvatar = randomizedAvatars[0];
      onAvatarChange?.(firstAvatar);
    }
  }, [editingMode, randomizedAvatars, avatar, onAvatarChange]);

  const handlePersonalityFieldChange = (field: string, value: string | string[]) => {
    onPersonalityChange?.({
      ...personality,
      [field]: value,
    });
  };

  // Get agents based on sort mode
  const agents = useMemo(() => {
    if (searchQuery.trim()) {
      return searchAgents(searchQuery);
    }

    switch (sortMode) {
      case 'recent':
        return getRecentAgents(20); // Show top 20 recent
      case 'frequent':
        return getFrequentAgents(20); // Show top 20 frequent
      case 'alphabetical':
        return getSavedAgents().sort((a, b) => a.name.localeCompare(b.name));
      default:
        return getSavedAgents();
    }
  }, [searchQuery, sortMode, refreshKey]); // Add refreshKey to dependencies

  // Filter marketplace templates by search query - MUST be before any conditional returns
  const filteredMarketplaceAgents = useMemo(() => {
    if (!searchQuery.trim()) return marketplaceAgentBundles;
    const query = searchQuery.toLowerCase();
    return marketplaceAgentBundles.filter(bundle => {
      const template = bundle._agentTemplate;
      return (
        bundle.name.toLowerCase().includes(query) ||
        template?.role?.toLowerCase().includes(query) ||
        template?.suggestedName?.toLowerCase().includes(query)
      );
    });
  }, [marketplaceAgentBundles, searchQuery]);

  const handleDeleteAgent = async (agentId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();

    const agent = agents.find(a => a.id === agentId);
    if (!agent) return;

    // Use Tauri's async dialog - wait for user confirmation BEFORE any state changes
    const confirmed = await ask(`Are you sure you want to delete "${agent.name}"? This action cannot be undone.`, {
      title: 'Quack',
      kind: 'warning',
    });

    if (!confirmed) {
      return;
    }

    setDeletingAgentId(agentId);
    try {
      const success = deleteAgent(agentId);
      if (success) {
        // Force re-render by incrementing refreshKey - agent disappears immediately (visual feedback)
        setRefreshKey(prev => prev + 1);
      } else {
        // Only show dialog on error
        await ask('Failed to delete agent. Please try again.', {
          title: 'Quack',
          kind: 'error',
        });
      }
    } catch (error) {
      console.error('Error deleting agent:', error);
      await ask('Failed to delete agent. Please try again.', {
        title: 'Quack',
        kind: 'error',
      });
    } finally {
      setDeletingAgentId(null);
    }
  };

  // If in editing mode, show the edit/create form
  if (editingMode) {
    return (
      <div className="agent-selector agent-selector-editing">
        {/* Header */}
        <div className="agent-selector-header">
          <div className="agent-selector-title-section">
            <h3 className="agent-selector-title">
              {editingMode === 'create' ? 'Create New Agent' : `Edit ${editingAgent?.name || 'Agent'}`}
            </h3>
            <p className="agent-selector-subtitle">
              Configure your agent&apos;s identity and personality
            </p>
          </div>
        </div>

        {/* Agent Name */}
        <label className="modal-field">
          <span className="field-label">Agent name</span>
          <input
            type="text"
            value={name}
            onChange={(event) => onNameChange?.(event.target.value)}
            placeholder="e.g. API Server"
            autoFocus
          />
        </label>

        {/* Avatar Selection */}
        <div className="modal-field">
          <span className="field-label">Avatar</span>
          <span className="field-hint">
            {customAvatars.length > 0 ? 'Custom and default avatars' : 'Scroll for more avatars'}
          </span>
          {uploadError && (
            <div className="avatar-upload-error">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              {uploadError}
            </div>
          )}
          <div className="avatar-grid-container">
            <div className="avatar-grid">
              {/* Upload Button */}
              <button
                type="button"
                className="avatar-upload-button"
                onClick={() => fileInputRef?.current?.click()}
                disabled={uploadingAvatar}
                aria-label="Upload custom avatar"
              >
                {uploadingAvatar ? (
                  <div className="avatar-upload-spinner">
                    <svg className="spinner-icon" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" strokeWidth="3" />
                    </svg>
                  </div>
                ) : (
                  <>
                    <svg className="plus-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    <span className="upload-label">Upload</span>
                  </>
                )}
              </button>

              {fileInputRef && (
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={onAvatarUpload}
                  style={{ display: 'none' }}
                />
              )}

              {/* Custom Avatars */}
              {customAvatars.map((customAvatar) => (
                <button
                  key={customAvatar.id}
                  type="button"
                  className={`avatar-option custom-avatar ${avatar === customAvatar.id ? 'selected' : ''} ${!customAvatarUrls[customAvatar.id] && loadingAvatars ? 'loading' : ''}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (customAvatarUrls[customAvatar.id]) {
                      onAvatarChange?.(customAvatar.id);
                    }
                  }}
                  aria-label={`Select custom avatar ${customAvatar.originalName}`}
                  disabled={!customAvatarUrls[customAvatar.id] && loadingAvatars}
                >
                  {customAvatarUrls[customAvatar.id] ? (
                    <img
                      src={customAvatarUrls[customAvatar.id]}
                      alt={customAvatar.originalName}
                      className="avatar-image"
                    />
                  ) : loadingAvatars ? (
                    <div className="avatar-loading-spinner">
                      <svg className="spinner-icon" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" strokeWidth="3" />
                      </svg>
                    </div>
                  ) : null}
                  {customAvatarUrls[customAvatar.id] && onDeleteCustomAvatar && (
                    <button
                      type="button"
                      className="avatar-delete-button"
                      onClick={(e) => onDeleteCustomAvatar(customAvatar.id, e)}
                      aria-label="Delete custom avatar"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                  )}
                </button>
              ))}

              {/* Default Avatars - Randomized Order */}
              {randomizedAvatars.map((avatarName) => (
                <button
                  key={avatarName}
                  type="button"
                  className={`avatar-option ${avatar === avatarName ? 'selected' : ''}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onAvatarChange?.(avatarName);
                  }}
                  aria-label={`Select ${avatarName} avatar`}
                >
                  <img
                    src={getAvatarUrl(avatarName)}
                    alt={avatarName}
                    className="avatar-image"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Color Selection */}
        <div className="modal-field">
          <span className="field-label">Agent color</span>
          <div className="modal-color-grid">
            {availableColors.map((preset) => (
              <button
                key={preset}
                type="button"
                className={`modal-color-swatch ${preset === color ? 'selected' : ''}`}
                style={{ backgroundColor: preset }}
                onClick={() => onColorChange?.(preset)}
                aria-label={`Select color ${preset}`}
              />
            ))}
            <label className="modal-color-picker">
              <input
                type="color"
                value={color}
                onChange={(event) => onColorChange?.(event.target.value)}
                aria-label="Choose a custom color"
              />
            </label>
          </div>
        </div>

        <div className="modal-section-divider" />

        {/* Personality Configuration */}
        <div className="personality-section">
          <h3 className="personality-section-title">Agent Personality</h3>

          {/* Role/Mission */}
          <label className="modal-field personality-field">
            <span className="field-label">Role / Mission</span>
            <input
              type="text"
              value={personality.role || ''}
              onChange={(e) => handlePersonalityFieldChange('role', e.target.value)}
              placeholder="e.g. Feature Coordinator, Frontend Developer, API Architect..."
              className="personality-input"
            />
          </label>

          {/* Communication Style */}
          <div className="modal-field personality-field">
            <span className="field-label">Communication Style</span>
            <div className="communication-styles-grid">
              {COMMUNICATION_STYLES.map((style) => (
                <button
                  key={style.id}
                  type="button"
                  className={`communication-style-option ${personality.communicationStyle === style.id ? 'selected' : ''}`}
                  onClick={() => handlePersonalityFieldChange('communicationStyle', style.id)}
                >
                  <span className="style-label">{style.label}</span>
                  <span className="style-description">{style.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Notes */}
          <label className="modal-field personality-field">
            <span className="field-label">Custom Notes</span>
            <span className="field-hint">Additional instructions for this agent</span>
            <textarea
              value={personality.customNotes || ''}
              onChange={(e) => handlePersonalityFieldChange('customNotes', e.target.value)}
              placeholder="Any special instructions, preferences, or guidelines..."
              rows={5}
              className="personality-textarea"
            />
          </label>

          {/* Preferred Skills */}
          {projectPath && (
            <>
              <div className="modal-section-divider" />
              <div className="modal-field personality-field skills-section">
                <h3 className="personality-section-title">Preferred Skills</h3>
              <p className="skills-section-hint">Skills this agent will use proactively</p>
              <SkillSelector
                projectPath={projectPath}
                selectedSkills={personality.selectedSkills || []}
                onSkillsChange={(skills) => handlePersonalityFieldChange('selectedSkills', skills)}
              />
              </div>
            </>
          )}
        </div>

        {/* Actions - Create or Save */}
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onCancelEdit}>
            Back
          </button>
          <button
            type="button"
            className="primary"
            onClick={onConfirm}
            disabled={!name.trim()}
          >
            {editingMode === 'create' ? 'Create' : 'Save'}
          </button>
        </div>
      </div>
    );
  }

  // Normal agent selector view
  return (
    <div className="agent-selector">
      {/* Header */}
      <div className="agent-selector-header">
        <div className="agent-selector-title-section">
          <h3 className="agent-selector-title">Choose an agent</h3>
          <p className="agent-selector-subtitle">
            {`${agents.length} saved ${agents.length === 1 ? 'agent' : 'agents'}`}
          </p>
        </div>

        {/* Create New Button - Prominent */}
        <button
          type="button"
          className="agent-selector-create-new"
          onClick={onCreateNew}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Create New Agent
        </button>
      </div>

      {/* Bundle Import Action */}
      <div className="agent-selector-bundle-actions">
        <button
          type="button"
          className="agent-selector-import-btn"
          onClick={handleImportBundle}
          disabled={importing}
          title="Import agent from .quack bundle"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
          </svg>
          {importing ? 'Importing...' : 'Import from bundle'}
        </button>
        {bundleError && (
          <div className="agent-selector-bundle-error" onClick={clearBundleError}>
            {bundleError}
          </div>
        )}
        {bundleSuccess && (
          <div className="agent-selector-bundle-success">
            {bundleSuccess}
          </div>
        )}
      </div>

      {/* Search and Sort Controls */}
      <div className="agent-selector-controls">
        <div className="agent-selector-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
          <input
            type="text"
            placeholder="Search agents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="agent-selector-clear-search"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          )}
        </div>

        <div className="agent-selector-sort">
          <label>
            <span className="agent-selector-sort-label">Sort by:</span>
            <select value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)}>
              <option value="recent">Recently used</option>
              <option value="frequent">Most used</option>
              <option value="alphabetical">Name (A-Z)</option>
            </select>
          </label>
        </div>
      </div>

      {/* Installed Agents Section */}
      {agents.length > 0 && (
        <>
          <div className="agent-selector-section-header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
            </svg>
            <span>Your Agents</span>
            <span className="agent-selector-section-count">{agents.length}</span>
          </div>
          <div className="agent-selector-grid">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="agent-card"
                style={{ borderColor: agent.color }}
              >
                {/* Avatar - ALWAYS show with fallback */}
                <div className="agent-card-avatar-wrapper">
                  <div
                    className="agent-card-avatar"
                    style={{
                      backgroundColor: agent.color + '15',
                      borderColor: agent.color
                    }}
                  >
                    <img
                      src={agent.avatar ? getAvatarUrl(agent.avatar) : (
                        window.__TAURI__
                          ? convertFileSrc('/images/ducks/new-avatars/duck15.jpeg', 'asset')
                          : '/images/ducks/new-avatars/duck15.jpeg'
                      )}
                      alt={agent.name}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        if (window.__TAURI__) {
                          target.src = convertFileSrc('/images/ducks/new-avatars/duck15.jpeg', 'asset');
                        } else {
                          target.src = '/images/ducks/new-avatars/duck15.jpeg';
                        }
                      }}
                    />
                  </div>
                </div>

                {/* Info */}
                <div className="agent-card-info">
                  <h4 className="agent-card-name">{agent.name}</h4>
                  <p className="agent-card-role">
                    {agent.personality?.role || 'No role specified'}
                  </p>
                  {agent.workingOn && (
                    <p className="agent-card-working-on">
                      Working on: {agent.workingOn}
                    </p>
                  )}
                </div>

                {/* Stats */}
                <div className="agent-card-stats">
                  <span className="agent-card-stat">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    Used {agent.usageCount}x
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="agent-card-actions">
                  <button
                    type="button"
                    className="agent-card-action-btn agent-card-use-btn"
                    onClick={() => onUseAgent(agent)}
                    disabled={deletingAgentId === agent.id}
                    title="Use this agent immediately"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                    Use
                  </button>
                  <button
                    type="button"
                    className="agent-card-action-btn agent-card-edit-btn"
                    onClick={() => onEditAgent(agent)}
                    disabled={deletingAgentId === agent.id}
                    title="Edit before using"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="agent-card-action-btn agent-card-delete-btn"
                    onClick={(e) => handleDeleteAgent(agent.id, e)}
                    disabled={deletingAgentId === agent.id}
                    title="Delete agent"
                  >
                    {deletingAgentId === agent.id ? (
                      <svg className="agent-card-delete-spinner" width="14" height="14" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" strokeWidth="3" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* No search results */}
      {agents.length === 0 && searchQuery && filteredMarketplaceAgents.length === 0 && (
        <div className="agent-selector-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
          <p className="agent-selector-empty-title">No agents found</p>
          <p className="agent-selector-empty-subtitle">
            Try a different search term
          </p>
        </div>
      )}

      {/* Quack Store Templates Section */}
      {(filteredMarketplaceAgents.length > 0 || marketplaceLoading) && (
        <>
          <div className="agent-selector-section-header marketplace">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="2" y1="12" x2="22" y2="12"></line>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
            </svg>
            <span>From Quack Store</span>
            {marketplaceLoading && (
              <span className="agent-selector-loading-indicator">
                <svg className="spinner-mini" width="12" height="12" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" strokeWidth="3" />
                </svg>
              </span>
            )}
            {!marketplaceLoading && (
              <span className="agent-selector-section-count">{filteredMarketplaceAgents.length}</span>
            )}
          </div>

          {/* Loading skeleton while fetching from Quack Store */}
          {marketplaceLoading && filteredMarketplaceAgents.length === 0 && (
            <div className="agent-selector-grid marketplace-grid">
              {[1, 2, 3].map((i) => (
                <div key={i} className="agent-card marketplace-card skeleton-card">
                  <div className="agent-card-avatar-wrapper">
                    <div className="agent-card-avatar skeleton-avatar" />
                  </div>
                  <div className="agent-card-info">
                    <div className="skeleton-line skeleton-name" />
                    <div className="skeleton-line skeleton-role" />
                    <div className="skeleton-line skeleton-style" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Loaded templates */}
          {filteredMarketplaceAgents.length > 0 && (
            <div className="agent-selector-grid marketplace-grid">
              {filteredMarketplaceAgents.map((bundle) => {
                const template = bundle._agentTemplate;
                if (!template) return null;

                return (
                  <div
                    key={bundle.id}
                    className="agent-card marketplace-card"
                    style={{ borderColor: template.suggestedColor }}
                  >
                    {/* Avatar */}
                    <div className="agent-card-avatar-wrapper">
                      <div
                        className="agent-card-avatar"
                        style={{
                          backgroundColor: template.suggestedColor + '15',
                          borderColor: template.suggestedColor
                        }}
                      >
                        {template.suggestedAvatar ? (
                          <img
                            src={getAvatarUrl(template.suggestedAvatar)}
                            alt={template.suggestedName}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              if (window.__TAURI__) {
                                target.src = convertFileSrc('/images/ducks/new-avatars/duck15.jpeg', 'asset');
                              } else {
                                target.src = '/images/ducks/new-avatars/duck15.jpeg';
                              }
                            }}
                          />
                        ) : (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={template.suggestedColor} strokeWidth="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="2" y1="12" x2="22" y2="12"></line>
                            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                          </svg>
                        )}
                      </div>
                      {/* Quack Store badge */}
                      <div className="marketplace-badge" title="From Quack Store">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="2" y1="12" x2="22" y2="12"></line>
                          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                        </svg>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="agent-card-info">
                      <h4 className="agent-card-name">{template.suggestedName}</h4>
                      <p className="agent-card-role">{template.role}</p>
                      <p className="agent-card-style">
                        {template.communicationStyle} style
                        {(() => {
                          const skills = template.skills || template.bundledPlugins;
                          return skills && skills.length > 0 && (
                            <> · {skills.length} {skills.length === 1 ? 'skill' : 'skills'}</>
                          );
                        })()}
                      </p>
                      {bundle.description && (
                        <p className="agent-card-description">{bundle.description}</p>
                      )}
                      <span
                        className="agent-card-more-info"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetailResource(bundle);
                        }}
                      >
                        More info
                      </span>
                    </div>

                    {/* Action Buttons */}
                    <div className="agent-card-actions">
                      <button
                        type="button"
                        className="agent-card-action-btn agent-card-use-btn marketplace-use-btn"
                        onClick={() => onUseMarketplaceTemplate?.(template, bundle)}
                        title="Use this template"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                          <polyline points="7 10 12 15 17 10"></polyline>
                          <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        Add to Your Agents
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Detail modal overlay for "More info" */}
      {detailResource && (
        <MarketplaceInstallModal
          resource={detailResource}
          installed={false}
          onClose={() => setDetailResource(null)}
          onInstall={async (r, scope) => {
            const ok = await installResource(r, scope);
            return ok;
          }}
        />
      )}
    </div>
  );
}
