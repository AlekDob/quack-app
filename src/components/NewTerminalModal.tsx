/**
 * New Terminal Modal - PROJECT-FIRST Flow
 *
 * Step 1: Project Selection (Choose project + Git Branch)
 * Step 2: Agent Selection (Use existing or create new)
 * Step 3: Agent Basics (Name, Color, Avatar, Personality) - FINAL STEP
 *
 * Key UX change: "Use" on existing agent = direct confirmation (project already selected)
 */

import { useState, useEffect, useRef } from 'react';
import type { AgentPersonality, GitBranch, SavedAgent } from '../types';
import AgentSelector from './AgentSelector';
import { invoke } from '@tauri-apps/api/core';
import {
  listCustomAvatars,
  deleteCustomAvatar,
  getCustomAvatarUrl,
  validateAvatarFile,
  revokeAvatarUrl,
  uploadCustomAvatar,
  type CustomAvatarInfo
} from '../utils/customAvatarStorage';
import { saveAgent, markAgentAsUsed } from '../utils/agentStorage';
import { getRandomName } from '../utils/agentNames';
import { useMarketplace } from '../hooks/useMarketplace';

// Step components
import { StepProgress } from './modal-steps/StepProgress';
import { StepProjectSelection } from './modal-steps/StepProjectSelection';
import { StepStarterBundles } from './modal-steps/StepStarterBundles';
import type { StarterBundle } from './modal-steps/StepStarterBundles';
import type { ModalStep, ActiveProject } from './modal-steps/types';

// Styles
import './modal-steps/ModalSteps.css';

interface NewTerminalModalProps {
  open: boolean
  isEditing?: boolean
  name: string
  path: string
  color: string
  workingOn?: string
  avatar?: string
  personality?: Partial<AgentPersonality>
  branch?: string
  useWorktree?: boolean
  availableColors: readonly string[]
  selectingDirectory: boolean
  creating: boolean
  error: string | null
  // Active projects from sidebar (for project-first flow)
  activeProjects?: ActiveProject[]
  // Initial step to skip to (e.g., 'agent' when clicking + on a project)
  initialStep?: 'project' | 'agent'
  onNameChange: (value: string) => void
  onPathChange?: (path: string) => void  // NEW: for project selection
  onColorChange: (color: string) => void
  onWorkingOnChange?: (value: string) => void
  onAvatarChange?: (avatar: string) => void
  onPersonalityChange?: (personality: Partial<AgentPersonality>) => void
  onBranchChange?: (branch: string) => void
  onUseWorktreeChange?: (useWorktree: boolean) => void
  onBrowse: () => void
  onCancel: () => void
  onConfirm: (agentData?: SavedAgent) => void
  /** When true, show starter agent bundles step after project selection */
  isOnboarding?: boolean
  /** Callback when user selects starter bundles to install */
  onInstallStarterBundles?: (bundles: StarterBundle[], projectPath: string, projectName: string) => Promise<void>
}

function NewTerminalModal({
  open,
  isEditing = false,
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
  activeProjects = [],
  initialStep = 'project',
  onNameChange,
  onPathChange,
  onColorChange,
  onWorkingOnChange,
  onAvatarChange,
  onPersonalityChange,
  onBranchChange,
  onUseWorktreeChange,
  onBrowse,
  onCancel,
  onConfirm,
  isOnboarding = false,
  onInstallStarterBundles,
}: NewTerminalModalProps) {
  // Marketplace for starter bundles
  const { getStarterBundles, loading: marketplaceLoading, allResources } = useMarketplace();

  // Step management - PROJECT-FIRST FLOW (2 steps: project → agent)
  // Edit mode: agent step with inline editing form
  const [currentStep, setCurrentStep] = useState<ModalStep>('project');
  const [completedSteps, setCompletedSteps] = useState<ModalStep[]>([]);
  const [isEditingAgent, setIsEditingAgent] = useState(false); // Track internal edit mode
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null); // Preserve agent ID during edit
  const [selectedProjectColor, setSelectedProjectColor] = useState<string>(''); // Color from project selection

  // Inline editing mode within the agent step
  const [inlineEditingMode, setInlineEditingMode] = useState<'create' | 'edit' | null>(null);
  const [editingAgentData, setEditingAgentData] = useState<SavedAgent | null>(null);

  // Starter bundles install state
  const [installingBundles, setInstallingBundles] = useState(false);

  // Git branch state
  const [availableBranches, setAvailableBranches] = useState<GitBranch[]>([]);
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

  // Local personality state to track changes across steps
  const [localPersonality, setLocalPersonality] = useState<Partial<AgentPersonality>>(personality || {});

  // Track if we've initialized for this modal session
  const hasInitializedRef = useRef(false);

  // Track last isEditing value to detect changes
  const lastIsEditingRef = useRef(isEditing);

  // Reset state when modal opens - trigger on open/close AND isEditing changes
  useEffect(() => {
    // Detect if isEditing changed while modal was already open
    const isEditingChanged = lastIsEditingRef.current !== isEditing;
    lastIsEditingRef.current = isEditing;

    // Initialize when modal opens OR when isEditing changes while open
    if (open && (!hasInitializedRef.current || isEditingChanged)) {
      hasInitializedRef.current = true;

      // If isEditing prop is true (editing from external source like sidebar),
      // go to agent step with inline editing form visible
      if (isEditing) {
        setCurrentStep('agent');
        setCompletedSteps(['project']); // Project already selected
        setIsEditingAgent(true);
        setInlineEditingMode('edit');
        // Use the agent ID from personality if available, otherwise generate one
        const agentId = personality?.id as string || `editing-${Date.now()}`;
        // Preserve agent ID for edit mode (so save updates instead of creates)
        setEditingAgentId(agentId);
        // Set editing agent data
        setEditingAgentData({
          id: agentId,
          name: name || '',
          avatar: avatar || '',
          color: color || '#FF6B35',
          workingOn: workingOn || '',
          personality: personality || {},
          createdAt: Date.now(),
          lastUsed: Date.now(),
          usageCount: 0,
        });
      } else {
        // PROJECT-FIRST FLOW: Start with project selection or agent (if initialStep is 'agent')
        setCurrentStep(initialStep);
        setIsEditingAgent(false);
        setInlineEditingMode(null);
        setEditingAgentData(null);
        // If starting at 'agent' step (from sidebar +), mark 'project' as completed
        setCompletedSteps(initialStep === 'agent' ? ['project'] : []);
      }
      setLocalPersonality(personality || {});
      setSelectedProjectColor('');
    }

    // Reset the ref when modal closes
    if (!open) {
      hasInitializedRef.current = false;
    }
  }, [open, isEditing, initialStep]); // Depend on 'open', 'isEditing', and 'initialStep' to ensure correct initialization

  // Load data when modal opens
  useEffect(() => {
    if (open && path) {
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

  // ===== Data Loading Functions =====

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

      // FIX: Always set the current branch when loading a new repository
      // This ensures the branch is correctly set when:
      // 1. First time opening modal (branch is empty)
      // 2. Using an existing agent on a different project (branch was from previous repo)
      // 3. Changing directory within the modal
      if (branches.length > 0 && onBranchChange) {
        const currentBranch = branches.find(b => b.isCurrent);
        // Only auto-set if branch is empty OR if current branch value doesn't exist in this repo
        const branchExistsInRepo = branch && branches.some(b => b.name === branch);
        if (!branch || !branchExistsInRepo) {
          if (currentBranch) {
            onBranchChange(currentBranch.name);
          } else {
            onBranchChange(branches[0].name);
          }
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

  // ===== Git Functions =====

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

  // ===== Avatar Functions =====

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

  // ===== Agent Selection Functions (Step 2: Agent) =====

  // "Use" an existing agent - PROJECT-FIRST: project already selected, so confirm directly!
  function handleUseAgent(agent: SavedAgent) {
    // Pre-populate fields from the agent
    onNameChange(agent.name);
    onColorChange(agent.color);
    onAvatarChange?.(agent.avatar);
    onWorkingOnChange?.(agent.workingOn || '');
    onPersonalityChange?.(agent.personality || {});
    setLocalPersonality(agent.personality || {});

    // Mark as used and save
    markAgentAsUsed(agent.id);
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

    // DIRECT CONFIRMATION - project is already selected in Step 1!
    onConfirm(agent);
  }

  // "Edit" an existing agent - show inline editing form
  function handleEditAgent(agent: SavedAgent) {
    onNameChange(agent.name);
    onColorChange(agent.color);
    onAvatarChange?.(agent.avatar);
    onWorkingOnChange?.(agent.workingOn || '');

    // Update BOTH parent state AND local state
    onPersonalityChange?.(agent.personality || {});
    setLocalPersonality(agent.personality || {});
    markAgentAsUsed(agent.id);

    // Preserve agent ID for edit mode (so save updates instead of creates)
    setEditingAgentId(agent.id);
    setEditingAgentData(agent);

    // Show inline editing form
    setIsEditingAgent(true);
    setInlineEditingMode('edit');
  }

  // "Create New" agent - show inline creation form
  function handleCreateNewAgent() {
    // Auto-generate random agent name from international list
    const randomName = getRandomName();

    // Reset to defaults for new agent with random name
    onNameChange(randomName);
    onColorChange(selectedProjectColor || availableColors[0] || '#FF6B35');
    onAvatarChange?.('');
    onWorkingOnChange?.('');
    onPersonalityChange?.({});
    setLocalPersonality({});

    setIsEditingAgent(false);
    setEditingAgentId(null);
    setEditingAgentData(null);

    // Show inline creation form
    setInlineEditingMode('create');
  }

  // Back to agent selection from inline editing
  function handleCancelInlineEdit() {
    setInlineEditingMode(null);
    setEditingAgentData(null);
    setIsEditingAgent(false);
  }

  // Confirm inline creation/editing
  function handleInlineConfirm() {
    if (!name.trim()) {
      alert('Please enter an agent name');
      return;
    }

    // Build complete agent
    const completeAgent: SavedAgent = {
      id: editingAgentId || `agent-${Date.now()}`,
      name,
      avatar: avatar || '',
      color,
      workingOn,
      personality: localPersonality,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      usageCount: 0,
    };

    // Save to storage (pass ID for edit mode to update correct agent)
    try {
      saveAgent(
        {
          name,
          avatar: avatar || '',
          color,
          workingOn,
          personality: localPersonality
        },
        editingAgentId || undefined
      );
    } catch (err) {
      console.warn('Failed to save agent to storage:', err);
    }

    // Confirm and close modal
    onConfirm(completeAgent);
  }

  // Back to agent selection from basics (legacy - keep for safety)
  function handleBackToAgentSelection() {
    setCurrentStep('agent');
    setCompletedSteps(prev => prev.filter(s => s !== 'agent'));
    setInlineEditingMode(null);
  }

  // ===== Personality Change Handler =====

  function handlePersonalityChangeLocal(newPersonality: Partial<AgentPersonality>) {
    // Update local state with merge
    setLocalPersonality(prev => {
      const merged = { ...prev, ...newPersonality };
      console.log('🔍 [MODAL] Local personality updated:', JSON.stringify(merged, null, 2));
      return merged;
    });

    // Also call parent handler to keep App.tsx in sync
    onPersonalityChange?.(newPersonality);
  }

  // ===== Step Navigation =====

  // Step 1: Project Selection → Step 2: Agent Selection
  function handleProjectNext() {
    if (!path.trim()) {
      alert('Please select a working directory');
      return;
    }
    setCompletedSteps(prev => [...prev, 'project']);
    // Show starter bundles during onboarding (first project creation)
    if (isOnboarding) {
      setCurrentStep('starters');
    } else {
      setCurrentStep('agent');
    }
  }

  // Handle project selection from StepProjectSelection
  function handleSelectProject(selectedPath: string, projectColor: string) {
    onPathChange?.(selectedPath);
    setSelectedProjectColor(projectColor);
    // Also trigger git repository check for the new path
    checkGitRepository();
  }

  if (!open) {
    return null;
  }

  // Determine modal title and subtitle based on current step
  const getModalHeader = () => {
    // In inline editing mode, show appropriate title
    if (inlineEditingMode === 'edit') {
      return { title: 'Edit Agent', subtitle: 'Update agent configuration' };
    }
    if (inlineEditingMode === 'create') {
      return { title: 'Create Agent', subtitle: 'Configure your new agent' };
    }
    // External edit mode (from sidebar)
    if (isEditing || isEditingAgent) {
      return { title: 'Edit Agent', subtitle: 'Update agent configuration' };
    }
    switch (currentStep) {
      case 'project':
        return { title: 'Select Project', subtitle: 'Choose your workspace' };
      case 'agent':
        return { title: 'Select Agent', subtitle: 'Use existing or create new' };
      default:
        return { title: 'New Agent', subtitle: 'Step-by-step configuration' };
    }
  };

  const header = getModalHeader();

  // Render the modal with project-first flow
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-panel agent-modal">
        {/* Header */}
        <div className="modal-header">
          <div>
            <h2>{header.title}</h2>
            <p className="modal-subtitle">{header.subtitle}</p>
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

        {/* Progress Indicator - show for multi-step flows */}
        {!isEditing && (
          <StepProgress currentStep={currentStep} completedSteps={completedSteps} isEditing={isEditingAgent} />
        )}

        {/* Step 1: Project Selection (NEW - Project First!) */}
        {currentStep === 'project' && (
          <StepProjectSelection
            activeProjects={activeProjects}
            selectedPath={path}
            selectedBranch={branch}
            useWorktree={useWorktree}
            availableBranches={availableBranches}
            loadingBranches={loadingBranches}
            isGitRepository={isGitRepository}
            initializingGit={initializingGit}
            selectingDirectory={selectingDirectory}
            onSelectProject={handleSelectProject}
            onBrowse={onBrowse}
            onBranchChange={onBranchChange || (() => {})}
            onUseWorktreeChange={onUseWorktreeChange || (() => {})}
            onGitInit={handleGitInit}
            onNext={handleProjectNext}
            onCancel={onCancel}
          />
        )}

        {/* Step 1.5: Starter Bundles (onboarding only) */}
        {currentStep === 'starters' && (
          <StepStarterBundles
            bundles={getStarterBundles().map(resource => {
              const ext = resource as typeof resource & { _agentTemplate?: import('../types').AgentTemplate };
              return {
                resource,
                template: ext._agentTemplate!,
              };
            }).filter(b => b.template)}
            loading={marketplaceLoading}
            installing={installingBundles}
            onConfirm={async (selected) => {
              setInstallingBundles(true);
              try {
                const projectName = path.split('/').pop() || path;
                await onInstallStarterBundles?.(selected, path, projectName);
              } finally {
                setInstallingBundles(false);
                onCancel();
              }
            }}
            onSkip={() => {
              setCompletedSteps(prev => [...prev, 'starters']);
              setCurrentStep('agent');
            }}
            onBack={() => {
              setCurrentStep('project');
              setCompletedSteps(prev => prev.filter(s => s !== 'project'));
            }}
          />
        )}

        {/* Step 2: Agent Selection (with inline editing) */}
        {currentStep === 'agent' && (
          <>
            <AgentSelector
              onUseAgent={handleUseAgent}
              onEditAgent={handleEditAgent}
              onCreateNew={handleCreateNewAgent}
              // Inline editing props
              editingMode={inlineEditingMode}
              editingAgent={editingAgentData}
              name={name}
              color={color}
              avatar={avatar || ''}
              availableColors={availableColors}
              customAvatars={customAvatars}
              customAvatarUrls={customAvatarUrls}
              loadingAvatars={loadingAvatars}
              uploadingAvatar={uploadingAvatar}
              uploadError={uploadError}
              personality={localPersonality}
              onNameChange={onNameChange}
              onColorChange={onColorChange}
              onAvatarChange={onAvatarChange || (() => {})}
              onPersonalityChange={handlePersonalityChangeLocal}
              onAvatarUpload={handleAvatarUpload}
              onDeleteCustomAvatar={handleDeleteCustomAvatar}
              fileInputRef={fileInputRef}
              onConfirm={handleInlineConfirm}
              onCancelEdit={handleCancelInlineEdit}
            />
            {/* Back button only when not in inline editing mode */}
            {!inlineEditingMode && (
              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setCurrentStep('project');
                    setCompletedSteps(prev => prev.filter(s => s !== 'project'));
                  }}
                >
                  Back
                </button>
              </div>
            )}
          </>
        )}

        {/* Error Display */}
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
      </div>
    </div>
  );
}

export default NewTerminalModal;
