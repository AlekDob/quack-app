/**
 * New Terminal Modal - REFACTORED with 2-Step Process
 *
 * Step 1: Project Context (Directory + Git Branch)
 * Step 2: Agent Selection (Choose existing OR Create new)
 *
 * This version integrates with the agent storage system to allow
 * reusing agents across multiple projects.
 */

import { useState, useEffect, useRef } from 'react';
import type { AgentPersonality, GitBranch, SavedAgent } from '../types';
import PersonalityBuilder from './PersonalityBuilder';
import AgentSelector from './AgentSelector';
import { invoke } from '@tauri-apps/api/core';
import {
  uploadCustomAvatar,
  listCustomAvatars,
  deleteCustomAvatar,
  getCustomAvatarUrl,
  validateAvatarFile,
  revokeAvatarUrl,
  type CustomAvatarInfo
} from '../utils/customAvatarStorage';
import { saveAgent, markAgentAsUsed } from '../utils/agentStorage';

// Available duck avatars from /images/ducks/avatars/
const AVAILABLE_AVATARS = [
  '24d6c816fe40a284f2451b1469c5e6d63d236e53.png',
  '5a1b030fb3b46f153f9b4f786a56570d828d2d2f.png',
  '5c275f841f212073cbddbe734d1979a6c2f17ab8.png',
  '5ef21f43a917b3bbe86dad58669fdad1c9f3e7c1.png',
  '68b54025bcf1dfbc9e03e20882688ddcadd28c27.jpeg',
  '94ab4eb6a469bf7f9de538e5c2f3dc3f2637fddf.jpeg',
  '99d6b811344a0bd98d18246ca8208314e8b490f3.png',
  '9e56d5e5edfcef59ce2aba2b96130dad44ce1135.png',
  'ab7cadc881ab08dcc27d8a8a1f3cb3e8af002216.png',
  'bafc4d0ca4264fb26f014f27c641d860ff356f7a.png',
  'c036fd117629d44e78464dd12d95760f0f0b3d9b.png',
  'd305287d5c861601e285b34ec5a8c7835ae9f8ea.png',
  'de8b5bfa62130bde399a6cb5255323ac949756ec.png',
  'e34736e96c3537509d80e78454d6e88ebe18cc2a.png',
  'e98b4d01e977b8572b85c44cad2e32bbfde68902.jpeg',
  'fa574b2f56d31adfc5900e4bfd116f9cddff17a0.png',
]

// Helper function to get avatar image URL
function getAvatarUrl(avatarName: string): string {
  if (window.__TAURI__) {
    return `asset://localhost/images/ducks/avatars/${avatarName}`;
  }
  return `/images/ducks/avatars/${avatarName}`;
}

interface NewTerminalModalProps {
  open: boolean
  isEditing?: boolean
  initialStep?: 'context' | 'agent' // NEW: Allow specifying which step to start at
  initialAgentMode?: 'select' | 'create' // NEW: Specify agent mode when starting at agent step
  name: string
  path: string
  color: string
  workingOn?: string
  avatar?: string
  personality?: Partial<AgentPersonality>
  branch?: string
  useWorktree?: boolean
  availableColors: string[]
  selectingDirectory: boolean
  creating: boolean
  error: string | null
  onNameChange: (value: string) => void
  onColorChange: (color: string) => void
  onWorkingOnChange?: (value: string) => void
  onAvatarChange?: (avatar: string) => void
  onPersonalityChange?: (personality: Partial<AgentPersonality>) => void
  onBranchChange?: (branch: string) => void
  onUseWorktreeChange?: (useWorktree: boolean) => void
  onBrowse: () => void
  onCancel: () => void
  onConfirm: () => void
}

type ModalStep = 'context' | 'agent';
type AgentMode = 'select' | 'create';

function NewTerminalModal({
  open,
  isEditing = false,
  initialStep = 'context', // NEW: default to 'context'
  initialAgentMode = 'select', // NEW: default to 'select'
  name,
  path,
  color,
  workingOn = '',
  avatar,
  personality,
  branch = '',
  useWorktree = false,
  availableColors,
  selectingDirectory,
  creating,
  error,
  onNameChange,
  onColorChange,
  onWorkingOnChange,
  onAvatarChange,
  onPersonalityChange,
  onBranchChange,
  onUseWorktreeChange,
  onBrowse,
  onCancel,
  onConfirm,
}: NewTerminalModalProps) {
  // Step management
  const [currentStep, setCurrentStep] = useState<ModalStep>(initialStep);
  const [agentMode, setAgentMode] = useState<AgentMode>(initialAgentMode);
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);

  // Git branch state
  const [availableSkills, setAvailableSkills] = useState<string[]>([]);
  const [availableBranches, setAvailableBranches] = useState<GitBranch[]>([]);
  const [branchMode, setBranchMode] = useState<'existing' | 'new'>('existing');
  const [newBranchName, setNewBranchName] = useState('');
  const [fromCurrentBranch, setFromCurrentBranch] = useState(true);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [isGitRepository, setIsGitRepository] = useState<boolean | null>(null);
  const [initializingGit, setInitializingGit] = useState(false);

  // Custom avatar management
  const [customAvatars, setCustomAvatars] = useState<CustomAvatarInfo[]>([]);
  const [customAvatarUrls, setCustomAvatarUrls] = useState<Record<string, string>>({});
  const [loadingAvatars, setLoadingAvatars] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset to initial step when modal opens
  useEffect(() => {
    if (open) {
      setCurrentStep(initialStep);
      setAgentMode(initialAgentMode);
      // Only clear editingAgentId if not editing
      if (!isEditing) {
        setEditingAgentId(null);
      }
    }
  }, [open, initialStep, initialAgentMode, isEditing]);

  // Load data when modal opens
  useEffect(() => {
    if (open && path) {
      setAvailableSkills(['quack-agents-architecture', 'tauri-drag-and-drop-guide']);
      checkGitRepository();

      if (customAvatars.length === 0) {
        loadCustomAvatars();
      }
    }
  }, [open, path]);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(customAvatarUrls).forEach(url => {
        if (url && url.startsWith('blob:')) {
          revokeAvatarUrl(url);
        }
      });
    };
  }, []);

  async function loadCustomAvatars() {
    setLoadingAvatars(true);
    try {
      const avatars = await listCustomAvatars();
      setCustomAvatars(avatars);

      const BATCH_SIZE = 3;
      const BATCH_DELAY = 50;

      for (let i = 0; i < avatars.length; i += BATCH_SIZE) {
        const batch = avatars.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map(async (avatar) => {
          try {
            const url = await getCustomAvatarUrl(avatar.id);
            return { id: avatar.id, url };
          } catch (err) {
            console.error(`Failed to load URL for custom avatar ${avatar.id}:`, err);
            return { id: avatar.id, url: null };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        const newUrls: Record<string, string> = {};
        batchResults.forEach(result => {
          if (result.url) {
            newUrls[result.id] = result.url;
          }
        });

        setCustomAvatarUrls(prev => ({ ...prev, ...newUrls }));

        if (i + BATCH_SIZE < avatars.length) {
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
        }
      }
    } catch (err) {
      console.error('Failed to load custom avatars:', err);
    } finally {
      setLoadingAvatars(false);
    }
  }

  async function checkGitRepository() {
    if (!path) return;

    try {
      const isGit = await invoke<boolean>('is_git_repository', { path });
      setIsGitRepository(isGit);

      if (isGit) {
        await loadBranches();
      } else {
        setAvailableBranches([]);
      }
    } catch (err) {
      console.error('Failed to check Git repository:', err);
      setIsGitRepository(false);
      setAvailableBranches([]);
    }
  }

  async function loadBranches() {
    if (!path) return;

    setLoadingBranches(true);
    try {
      const branches = await invoke<GitBranch[]>('git_list_branches', {
        rootPath: path
      });
      setAvailableBranches(branches);
      setIsGitRepository(true);

      if (branches.length > 0 && !branch && onBranchChange) {
        const currentBranch = branches.find(b => b.isCurrent);
        if (currentBranch) {
          onBranchChange(currentBranch.name);
        } else {
          onBranchChange(branches[0].name);
        }
      }
    } catch (err) {
      console.warn('Could not load branches (not a git repository?):', err);
      setAvailableBranches([]);
      setIsGitRepository(false);
    } finally {
      setLoadingBranches(false);
    }
  }

  async function handleGitInit() {
    if (!path) return;

    setInitializingGit(true);
    try {
      const result = await invoke<string>('git_init', { path });
      console.log('Git initialized:', result);
      await checkGitRepository();
    } catch (err) {
      console.error('Failed to initialize Git:', err);
      alert(`Failed to initialize Git repository: ${err}`);
    } finally {
      setInitializingGit(false);
    }
  }

  // Branch name generation
  const prevBranchModeRef = useRef<'existing' | 'new'>(branchMode);

  useEffect(() => {
    if (branchMode === 'new' && name && !newBranchName) {
      const sanitized = name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
      setNewBranchName(`feature/${sanitized}`);
    }
  }, [branchMode, name, newBranchName]);

  useEffect(() => {
    if (branchMode === 'new' && newBranchName) {
      onBranchChange?.(newBranchName);
    }
  }, [branchMode, newBranchName]);

  useEffect(() => {
    const modeChanged = prevBranchModeRef.current !== branchMode;
    prevBranchModeRef.current = branchMode;

    if (modeChanged && branchMode === 'existing' && availableBranches.length > 0) {
      const currentBranch = availableBranches.find(b => b.isCurrent);
      onBranchChange?.(currentBranch?.name || availableBranches[0]?.name || 'main');
    }
  }, [branchMode, availableBranches.length]);

  // Avatar upload
  async function handleAvatarUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const validationError = validateAvatarFile(file);
    if (validationError) {
      setUploadError(validationError);
      return;
    }

    setUploadingAvatar(true);
    setUploadError(null);

    try {
      const avatarInfo = await uploadCustomAvatar(file);
      const avatarUrl = await getCustomAvatarUrl(avatarInfo.id);
      setCustomAvatars(prev => [avatarInfo, ...prev]);
      setCustomAvatarUrls(prev => ({ ...prev, [avatarInfo.id]: avatarUrl }));
      onAvatarChange?.(avatarInfo.id);
    } catch (err) {
      console.error('Failed to upload avatar:', err);
      setUploadError('Failed to upload avatar. Please try again.');
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  async function handleDeleteCustomAvatar(avatarId: string, event: React.MouseEvent) {
    event.stopPropagation();
    event.preventDefault();

    if (!confirm('Are you sure you want to delete this custom avatar?')) {
      return;
    }

    try {
      await deleteCustomAvatar(avatarId);
      setCustomAvatars(prev => prev.filter(a => a.id !== avatarId));
      setCustomAvatarUrls(prev => {
        const newUrls = { ...prev };
        delete newUrls[avatarId];
        return newUrls;
      });

      if (avatar === avatarId) {
        onAvatarChange?.('');
      }
    } catch (err) {
      console.error('Failed to delete custom avatar:', err);
      alert('Failed to delete avatar. Please try again.');
    }
  }

  // Agent selection handlers
  function handleUseAgent(agent: SavedAgent) {
    // Mark agent as used
    markAgentAsUsed(agent.id);

    // Save agent to storage (in case it's been modified)
    try {
      saveAgent({
        name: agent.name,
        avatar: agent.avatar || '',
        color: agent.color,
        workingOn: agent.workingOn,
        personality: agent.personality || {}
      });
    } catch (err) {
      console.warn('Failed to save agent to storage:', err);
    }

    // Load agent data into parent state and immediately confirm
    // We need to batch these updates by calling them all before onConfirm
    onNameChange(agent.name);
    onColorChange(agent.color);
    onAvatarChange?.(agent.avatar);
    onWorkingOnChange?.(agent.workingOn || '');
    onPersonalityChange?.(agent.personality);

    // Use requestAnimationFrame to ensure state updates are flushed
    requestAnimationFrame(() => {
      onConfirm();
    });
  }

  function handleEditAgent(agent: SavedAgent) {
    // Load agent data into form for editing
    onNameChange(agent.name);
    onColorChange(agent.color);
    onAvatarChange?.(agent.avatar);
    onWorkingOnChange?.(agent.workingOn || '');
    onPersonalityChange?.(agent.personality);

    // Mark agent as used
    markAgentAsUsed(agent.id);

    // Save the agent ID so we know we're editing (not creating new)
    setEditingAgentId(agent.id);

    // Move to create form so user can edit
    setAgentMode('create');
  }

  function handleCreateNewAgent() {
    // Clear editing state when creating new agent
    setEditingAgentId(null);
    setAgentMode('create');
  }

  function handleBackToAgentSelection() {
    // Clear editing state when going back
    setEditingAgentId(null);
    setAgentMode('select');
  }

  function handleBackToContext() {
    setCurrentStep('context');
    setAgentMode('select');
  }

  function handleContinueToAgent() {
    if (!path.trim()) {
      alert('Please select a working directory');
      return;
    }
    setCurrentStep('agent');
  }

  async function handleFinalConfirm() {
    // Save or update agent in storage
    try {
      const savedAgent = saveAgent({
        name,
        avatar: avatar || '',
        color,
        workingOn,
        personality: personality || {}
      });

      // If we're editing an agent from the grid (not a terminal),
      // just save and go back to selection
      if (editingAgentId && !isEditing) {
        console.log('Updated agent:', savedAgent);
        // Clear editing state and go back to agent selection
        setEditingAgentId(null);
        setAgentMode('select');
        return; // DON'T create terminal, just save and return
      }
    } catch (err) {
      console.warn('Failed to save agent to storage:', err);
      // Don't block terminal creation/update if save fails
    }

    // Create new terminal OR update existing terminal
    // Call original onConfirm (App.tsx will handle create vs update based on editingTerminal)
    onConfirm();
  }

  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-panel agent-modal">
        {/* Header */}
        <div className="modal-header">
          <div>
            <h2>
              {isEditing ? '✏️ Edit agent' : '✨ Create new agent'}
            </h2>
            <p className="modal-subtitle">
              {currentStep === 'context' ? 'Step 1: Project Context' : 'Step 2: Choose Agent'}
            </p>
          </div>
          <button
            type="button"
            className="modal-close-button"
            onClick={onCancel}
            aria-label="Close"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* STEP 1: Project Context */}
        {currentStep === 'context' && (
          <>
            <div className="modal-field">
              <span className="field-label">Working directory</span>
              <div className="modal-selected-path">{path || 'No directory selected'}</div>
              <button
                type="button"
                className="directory-chooser"
                onClick={onBrowse}
                disabled={selectingDirectory}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>
                {selectingDirectory ? 'Opening Finder…' : 'Choose directory'}
              </button>
            </div>

            {/* Git Section */}
            {isGitRepository === false && path && (
              <div className="git-warning-section">
                <div className="git-warning-header">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                  <span className="git-warning-title">Git repository not found</span>
                </div>
                <p className="git-warning-text">
                  This directory is not a Git repository. Initialize Git to use branch management features.
                </p>
                <button
                  type="button"
                  className="git-init-button"
                  onClick={handleGitInit}
                  disabled={initializingGit}
                >
                  {initializingGit ? (
                    <>
                      <span className="spinner"></span>
                      Initializing Git...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="6" y1="3" x2="6" y2="15"></line>
                        <circle cx="18" cy="6" r="3"></circle>
                        <circle cx="6" cy="18" r="3"></circle>
                        <path d="M18 9a9 9 0 0 1-9 9"></path>
                      </svg>
                      Initialize Git Repository
                    </>
                  )}
                </button>
              </div>
            )}

            {availableBranches.length > 0 && (
              <div className="git-branch-section">
                <div className="git-branch-header">
                  <svg className="git-branch-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="6" y1="3" x2="6" y2="15"></line>
                    <circle cx="18" cy="6" r="3"></circle>
                    <circle cx="6" cy="18" r="3"></circle>
                    <path d="M18 9a9 9 0 0 1-9 9"></path>
                  </svg>
                  <div className="git-branch-header-text">
                    <span className="git-branch-title">Git Branch</span>
                    <span className="git-branch-subtitle">Agent workspace</span>
                  </div>
                  <span className="git-badge">GIT</span>
                </div>

                <div className="git-branch-mode-selector">
                  <label className={`git-mode-option ${branchMode === 'existing' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      checked={branchMode === 'existing'}
                      onChange={() => setBranchMode('existing')}
                    />
                    <svg className="git-mode-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="6" y1="3" x2="6" y2="15"></line>
                      <circle cx="18" cy="6" r="3"></circle>
                      <circle cx="6" cy="18" r="3"></circle>
                      <path d="M18 9a9 9 0 0 1-9 9"></path>
                    </svg>
                    <span>Use existing</span>
                  </label>
                  <label className={`git-mode-option ${branchMode === 'new' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      checked={branchMode === 'new'}
                      onChange={() => setBranchMode('new')}
                    />
                    <svg className="git-mode-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="8" x2="12" y2="16"></line>
                      <line x1="8" y1="12" x2="16" y2="12"></line>
                    </svg>
                    <span>Create new</span>
                  </label>
                </div>

                {branchMode === 'existing' ? (
                  <div className="git-branch-input-wrapper">
                    <select
                      value={branch}
                      onChange={(e) => onBranchChange?.(e.target.value)}
                      disabled={loadingBranches}
                      className="git-branch-select"
                    >
                      {loadingBranches ? (
                        <option>Loading branches...</option>
                      ) : (
                        availableBranches.map((b) => (
                          <option key={b.name} value={b.name}>
                            {b.name} {b.isCurrent ? '⭐' : ''} {b.hasRemote ? '☁️' : ''}
                          </option>
                        ))
                      )}
                    </select>
                    <svg className="git-select-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </div>
                ) : (
                  <div className="git-branch-create-mode">
                    <input
                      type="text"
                      value={newBranchName}
                      onChange={(e) => setNewBranchName(e.target.value)}
                      placeholder="e.g., feature/agent-name"
                      className="git-branch-input"
                    />
                    <label className="git-branch-checkbox">
                      <input
                        type="checkbox"
                        checked={fromCurrentBranch}
                        onChange={(e) => setFromCurrentBranch(e.target.checked)}
                      />
                      <span className="git-checkbox-checkmark"></span>
                      <span className="git-checkbox-label">
                        Branch from current ({availableBranches.find(b => b.isCurrent)?.name || 'main'})
                      </span>
                    </label>
                    <small className="git-branch-hint">
                      🌿 Agent will work on this branch independently
                    </small>
                  </div>
                )}

                {branchMode === 'new' && newBranchName && (
                  <label className="git-branch-checkbox" style={{ marginTop: '12px' }}>
                    <input
                      type="checkbox"
                      checked={useWorktree}
                      onChange={(e) => onUseWorktreeChange?.(e.target.checked)}
                    />
                    <span className="git-checkbox-checkmark"></span>
                    <span className="git-checkbox-label">
                      Use Git Worktree (isolated directory)
                    </span>
                  </label>
                )}
                {useWorktree && branchMode === 'new' && (
                  <small className="git-branch-hint" style={{ marginTop: '8px', display: 'block' }}>
                    🌳 Creates a separate directory for this agent - perfect for frequent switching!
                  </small>
                )}
              </div>
            )}

            <div className="modal-actions">
              <button type="button" className="secondary" onClick={onCancel}>
                Cancel
              </button>
              <button
                type="button"
                className="primary"
                onClick={handleContinueToAgent}
                disabled={!path.trim()}
              >
                Continue →
              </button>
            </div>
          </>
        )}

        {/* STEP 2: Agent Selection */}
        {currentStep === 'agent' && (
          <>
            {agentMode === 'select' ? (
              <>
                <AgentSelector
                  onUseAgent={handleUseAgent}
                  onEditAgent={handleEditAgent}
                  onCreateNew={handleCreateNewAgent}
                />

                <div className="modal-actions">
                  <button type="button" className="secondary" onClick={handleBackToContext}>
                    ← Back
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Create/Edit Agent Form */}
                <label className="modal-field">
                  <span className="field-label">Agent name</span>
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => onNameChange(event.target.value)}
                    placeholder="e.g. API Server"
                    autoFocus
                  />
                </label>

                <div className="modal-field">
                  <span className="field-label">Avatar</span>
                  <span className="field-hint">
                    {customAvatars.length > 0 ? 'Custom and default avatars ↓' : 'Scroll for more avatars ↓'}
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
                      <button
                        type="button"
                        className="avatar-upload-button"
                        onClick={() => fileInputRef.current?.click()}
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

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarUpload}
                        style={{ display: 'none' }}
                      />

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
                          {customAvatarUrls[customAvatar.id] && (
                            <button
                              type="button"
                              className="avatar-delete-button"
                              onClick={(e) => handleDeleteCustomAvatar(customAvatar.id, e)}
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

                      {AVAILABLE_AVATARS.map((avatarName) => (
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

                <div className="modal-field">
                  <span className="field-label">Agent color</span>
                  <div className="modal-color-grid">
                    {availableColors.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        className={`modal-color-swatch ${preset === color ? 'selected' : ''}`}
                        style={{ backgroundColor: preset }}
                        onClick={() => onColorChange(preset)}
                        aria-label={`Select color ${preset}`}
                      />
                    ))}
                    <label className="modal-color-picker">
                      <input
                        type="color"
                        value={color}
                        onChange={(event) => onColorChange(event.target.value)}
                        aria-label="Choose a custom color"
                      />
                    </label>
                  </div>
                </div>

                <div className="modal-section-divider" />

                <PersonalityBuilder
                  personality={{
                    role: personality?.role || 'Feature Coordinator',
                    intro: personality?.intro || 'Experienced PM specializing in feature delivery and team coordination',
                    technicalContext: personality?.technicalContext || '',
                    rules: personality?.rules || [],
                    communicationStyle: personality?.communicationStyle || 'friendly',
                    customNotes: personality?.customNotes || '',
                    specialties: personality?.specialties || ['feature-planning', 'team-alignment'],
                    personality: personality?.personality || 'Organized. Proactive',
                    skills: personality?.skills || [],
                    expressions: personality?.expressions || []
                  }}
                  onPersonalityChange={onPersonalityChange || (() => {})}
                  availableSkills={availableSkills}
                  isModalOpen={open}
                />

                {error && (
                  <div className="modal-error">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="8" x2="12" y2="12"></line>
                      <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <span>{error}</span>
                  </div>
                )}

                <div className="modal-actions">
                  <button type="button" className="secondary" onClick={handleBackToAgentSelection}>
                    ← Back to selection
                  </button>
                  <button
                    type="button"
                    className="primary"
                    onClick={handleFinalConfirm}
                    disabled={!name.trim() || !path.trim() || creating}
                  >
                    {creating ? (
                      <>
                        <span className="spinner"></span>
                        {editingAgentId ? 'Saving…' : 'Creating…'}
                      </>
                    ) : (
                      editingAgentId ? 'Save changes' : 'Create agent'
                    )}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default NewTerminalModal;
