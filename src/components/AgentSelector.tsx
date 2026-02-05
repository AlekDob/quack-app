/**
 * Agent Selector Component
 *
 * Allows users to select from saved agents or create a new one.
 * Shows agent cards with avatars, names, and personalities.
 * Includes inline editing/creation form when triggered.
 */

import { useState, useMemo, useEffect } from 'react';
import type { SavedAgent, AgentPersonality } from '../types';
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
import './AgentSelector.css';

// Communication styles for personality
const COMMUNICATION_STYLES = [
  { id: 'professional', label: 'Professional', description: 'Formal and precise' },
  { id: 'friendly', label: 'Friendly', description: 'Warm and approachable' },
  { id: 'casual', label: 'Casual', description: 'Relaxed and informal' },
  { id: 'technical', label: 'Technical', description: 'Highly detailed and technical' },
  { id: 'sarcastic', label: 'Sarcastic', description: 'Witty and ironic' },
];

interface AgentSelectorProps {
  onUseAgent: (agent: SavedAgent) => void;
  onEditAgent: (agent: SavedAgent) => void;
  onCreateNew: () => void;
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
}

type SortMode = 'recent' | 'frequent' | 'alphabetical';

export default function AgentSelector({
  onUseAgent,
  onEditAgent,
  onCreateNew,
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
}: AgentSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [deletingAgentId, setDeletingAgentId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0); // Force re-render after delete

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

  const handlePersonalityFieldChange = (field: string, value: string) => {
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
            {agents.length === 0
              ? 'No saved agents yet'
              : `${agents.length} saved ${agents.length === 1 ? 'agent' : 'agents'}`}
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

      {/* Agent Grid */}
      <div className="agent-selector-grid">
        {agents.length === 0 ? (
          <div className="agent-selector-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <line x1="19" y1="8" x2="19" y2="14"></line>
              <line x1="22" y1="11" x2="16" y2="11"></line>
            </svg>
            <p className="agent-selector-empty-title">
              {searchQuery ? 'No agents found' : 'No saved agents yet'}
            </p>
            <p className="agent-selector-empty-subtitle">
              {searchQuery
                ? 'Try a different search term'
                : 'Create your first agent to get started'}
            </p>
            {!searchQuery && (
              <button
                type="button"
                className="agent-selector-empty-create"
                onClick={onCreateNew}
              >
                Create New Agent
              </button>
            )}
          </div>
        ) : (
          agents.map((agent) => (
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
                      console.error('[AgentSelector] Image failed to load, using fallback duck15.jpeg');
                      // Always fallback to duck15.jpeg on error
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
          ))
        )}
      </div>
    </div>
  );
}
