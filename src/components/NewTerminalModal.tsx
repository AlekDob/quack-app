/**
 * New Terminal Modal - SIMPLIFIED with 3-Step Process
 *
 * Step 1: Project Context (Directory + Git Branch)
 * Step 2: Agent Basics (Name, Color, Avatar, Personality)
 * Step 3: Rules Selection (Claude Code rules to follow)
 *
 * This version uses modular step components and the new Rules system.
 */

import { useState, useEffect, useRef } from 'react';
import type { AgentPersonality, GitBranch, SavedAgent, RuleScope } from '../types';
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
import { useRules } from '../hooks/useRules';

// Step components
import { StepProgress } from './modal-steps/StepProgress';
import { StepProjectContext } from './modal-steps/StepProjectContext';
import { StepAgentBasics } from './modal-steps/StepAgentBasics';
import { StepRules } from './modal-steps/StepRules';
import type { ModalStep } from './modal-steps/types';

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
  onNameChange: (value: string) => void
  onColorChange: (color: string) => void
  onWorkingOnChange?: (value: string) => void
  onAvatarChange?: (avatar: string) => void
  onPersonalityChange?: (personality: Partial<AgentPersonality>) => void
  onBranchChange?: (branch: string) => void
  onUseWorktreeChange?: (useWorktree: boolean) => void
  onBrowse: () => void
  onCancel: () => void
  onConfirm: (agentData?: SavedAgent) => void
  onOpenDroidFactory?: () => void
}

type AgentMode = 'select' | 'create';

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
  onOpenDroidFactory,
}: NewTerminalModalProps) {
  // Step management
  const [currentStep, setCurrentStep] = useState<ModalStep>('context');
  const [completedSteps, setCompletedSteps] = useState<ModalStep[]>([]);
  const [agentMode, setAgentMode] = useState<AgentMode>('select');
  const [isEditingAgent, setIsEditingAgent] = useState(false); // Track internal edit mode
  const [isUsingAgent, setIsUsingAgent] = useState(false); // Track "Use" flow (only Step 1)
  const [usingAgentData, setUsingAgentData] = useState<SavedAgent | null>(null); // Agent being used

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

  // Rules state - using the useRules hook
  const { rules, loading: loadingRules, createRule, loadRules } = useRules(path);
  const [selectedRules, setSelectedRules] = useState<string[]>([]);
  const [missingRules, setMissingRules] = useState<string[]>([]);

  // Store editing agent data to restore rules after loading
  const [editingAgentData, setEditingAgentData] = useState<SavedAgent | null>(null);

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
      // skip agent selection and go directly to Step 2 (Basics)
      if (isEditing) {
        setCurrentStep('basics');
        setAgentMode('create');
        setIsEditingAgent(true);
        setIsUsingAgent(false);
        // Create synthetic agent data from props to trigger skills/droids restore
        setEditingAgentData({
          id: 'editing-from-external',
          name: name,
          avatar: avatar || '',
          color: color,
          workingOn: workingOn || '',
          personality: personality || {},
          createdAt: Date.now(),
          lastUsed: Date.now(),
          usageCount: 0,
        });
      } else {
        setCurrentStep('context');
        setAgentMode('select');
        setIsEditingAgent(false);
        setIsUsingAgent(false);
        setEditingAgentData(null);
      }
      setCompletedSteps([]);
      setUsingAgentData(null);
      setLocalPersonality(personality || {});
      setSelectedRules([]);
      setMissingRules([]);
    }

    // Reset the ref when modal closes
    if (!open) {
      hasInitializedRef.current = false;
    }
  }, [open, isEditing]); // Depend on 'open' and 'isEditing' to ensure correct initialization

  // Load data when modal opens
  useEffect(() => {
    if (open && path) {
      checkGitRepository();
      if (customAvatars.length === 0) {
        loadCustomAvatars();
      }
    }
  }, [open, path]);

  // Restore rules selections when editing and data is loaded
  useEffect(() => {
    if (!editingAgentData || loadingRules) return;

    const personality = editingAgentData.personality;
    if (!personality?.selectedRules) {
      setEditingAgentData(null);
      return;
    }

    const allRules = [...rules.project, ...rules.global];
    const restoredRules: string[] = [];
    const notFoundRules: string[] = [];

    for (const rulePath of personality.selectedRules) {
      const matchedRule = allRules.find(r =>
        r.filePath === rulePath || r.filePath.endsWith(rulePath) || rulePath.endsWith(r.filePath)
      );

      if (matchedRule) {
        restoredRules.push(matchedRule.filePath);
      } else {
        notFoundRules.push(rulePath);
      }
    }

    if (restoredRules.length > 0) {
      setSelectedRules(restoredRules);
    }
    setMissingRules(notFoundRules);

    // Clear editing data after restore to prevent re-running
    setEditingAgentData(null);
  }, [editingAgentData, rules, loadingRules]);

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

  // ===== Agent Selection Functions =====

  function handleUseAgent(agent: SavedAgent) {
    // Store the agent data and show Step 1 for project/branch selection
    setUsingAgentData(agent);
    setIsUsingAgent(true);
    setCurrentStep('context');
    setAgentMode('create');

    // Pre-populate fields from the agent
    onNameChange(agent.name);
    onColorChange(agent.color);
    onAvatarChange?.(agent.avatar);
    onWorkingOnChange?.(agent.workingOn || '');
    onPersonalityChange?.(agent.personality || {});
    setLocalPersonality(agent.personality || {});
  }

  // Confirm the agent after Step 1 in "Use" flow
  function handleUseConfirm() {
    if (!usingAgentData) return;

    markAgentAsUsed(usingAgentData.id);

    try {
      saveAgent({
        name: usingAgentData.name,
        avatar: usingAgentData.avatar || '',
        color: usingAgentData.color,
        workingOn: usingAgentData.workingOn,
        personality: usingAgentData.personality || {}
      });
    } catch (err) {
      console.warn('Failed to save agent to storage:', err);
    }

    onConfirm(usingAgentData);
  }

  function handleEditAgent(agent: SavedAgent) {
    onNameChange(agent.name);
    onColorChange(agent.color);
    onAvatarChange?.(agent.avatar);
    onWorkingOnChange?.(agent.workingOn || '');

    // Update BOTH parent state AND local state
    onPersonalityChange?.(agent.personality || {});
    setLocalPersonality(agent.personality || {});
    markAgentAsUsed(agent.id);

    // Store original agent data to restore rules after loading
    setEditingAgentData(agent);

    // Skip Step 1 when editing - go directly to Basics
    setIsEditingAgent(true);
    setCurrentStep('basics');
    setAgentMode('create');
  }

  function handleCreateNewAgent() {
    setAgentMode('create');
  }

  function handleBackToAgentSelection() {
    setAgentMode('select');
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

  function handleContextNext() {
    if (!path.trim()) {
      alert('Please select a working directory');
      return;
    }
    setCompletedSteps(prev => [...prev, 'context']);
    setCurrentStep('basics');
  }

  function handleBasicsNext() {
    if (!name.trim()) {
      alert('Please enter an agent name');
      return;
    }
    setCompletedSteps(prev => [...prev, 'basics']);
    setCurrentStep('rules');
  }

  function handleBasicsBack() {
    if (isEditingAgent) {
      // In edit mode, go back to agent selector (not Step 1)
      setAgentMode('select');
      setIsEditingAgent(false);
      setCurrentStep('context'); // Reset for potential future create
    } else {
      setCurrentStep('context');
    }
  }

  function handleRulesBack() {
    setCurrentStep('basics');
  }

  // ===== Rules Selection =====

  function handleRuleToggle(rulePath: string) {
    setSelectedRules(prev =>
      prev.includes(rulePath)
        ? prev.filter(p => p !== rulePath)
        : [...prev, rulePath]
    );
  }

  // Create a new rule and auto-select it
  async function handleCreateRule(
    name: string,
    content: string,
    scope: RuleScope,
    description?: string,
    globs?: string[],
    alwaysApply?: boolean
  ) {
    await createRule(name, content, scope, description, globs, alwaysApply);
    // After creation, find the new rule and select it
    // The rules will be reloaded by the hook automatically
    // We'll select it by path in the next render
    const expectedPath = scope === 'project'
      ? `${path}/.claude/rules/${name}.md`
      : `~/.claude/rules/${name}.md`;
    setSelectedRules(prev => [...prev, expectedPath]);
  }

  // ===== Final Confirmation =====

  async function handleFinalConfirm() {
    // Build updated personality with selected rules
    const updatedPersonality: Partial<AgentPersonality> = {
      ...localPersonality,
      selectedRules: selectedRules.length > 0 ? selectedRules : undefined,
    };

    // DEBUG: Log what we're sending
    console.log('[MODAL] handleFinalConfirm called');
    console.log('[MODAL] Selected rules:', selectedRules);
    console.log('[MODAL] Updated personality:', JSON.stringify(updatedPersonality, null, 2));

    onPersonalityChange?.(updatedPersonality);

    // Save agent to storage
    try {
      saveAgent({
        name,
        avatar: avatar || '',
        color,
        workingOn,
        personality: updatedPersonality
      });
    } catch (err) {
      console.warn('Failed to save agent to storage:', err);
    }

    // Create terminal - pass complete agent data with updated personality
    const completeAgentData: SavedAgent = {
      id: `agent-${Date.now()}`,
      name,
      avatar: avatar || '',
      color,
      workingOn,
      personality: updatedPersonality,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      usageCount: 0,
    };

    onConfirm(completeAgentData);
  }

  if (!open) {
    return null;
  }

  // Render agent selector first (before step creation)
  if (agentMode === 'select') {
    return (
      <div className="modal-backdrop" role="dialog" aria-modal="true">
        <div className="modal-panel agent-modal">
          {/* Header */}
          <div className="modal-header">
            <div>
              <h2>✨ Create new agent</h2>
              <p className="modal-subtitle">Choose existing or create new</p>
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

          <AgentSelector
            onUseAgent={handleUseAgent}
            onEditAgent={handleEditAgent}
            onCreateNew={handleCreateNewAgent}
          />

          <div className="modal-actions">
            <button type="button" className="secondary" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render step-by-step creation
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-panel agent-modal">
        {/* Header */}
        <div className="modal-header">
          <div>
            <h2>
              {isUsingAgent ? 'Use agent' : isEditingAgent ? 'Agent editor' : 'Create new agent'}
            </h2>
            <p className="modal-subtitle">
              {isUsingAgent ? 'Select project and branch' : 'Step-by-step configuration'}
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

        {/* Progress Indicator - hide in "Use" flow (single step) */}
        {!isUsingAgent && (
          <StepProgress currentStep={currentStep} completedSteps={completedSteps} isEditing={isEditingAgent} />
        )}

        {/* Step 1: Project Context */}
        {currentStep === 'context' && (
          <StepProjectContext
            path={path}
            branch={branch}
            useWorktree={useWorktree}
            availableBranches={availableBranches}
            loadingBranches={loadingBranches}
            isGitRepository={isGitRepository}
            initializingGit={initializingGit}
            selectingDirectory={selectingDirectory}
            onBrowse={onBrowse}
            onBranchChange={onBranchChange || (() => {})}
            onUseWorktreeChange={onUseWorktreeChange || (() => {})}
            onGitInit={handleGitInit}
            onNext={handleContextNext}
            onCancel={onCancel}
            isUsing={isUsingAgent}
            onUseConfirm={handleUseConfirm}
          />
        )}

        {/* Step 2: Agent Basics */}
        {currentStep === 'basics' && (
          <StepAgentBasics
            name={name}
            color={color}
            avatar={avatar || ''}
            availableColors={availableColors}
            customAvatars={customAvatars}
            customAvatarUrls={customAvatarUrls}
            loadingAvatars={loadingAvatars}
            uploadingAvatar={uploadingAvatar}
            uploadError={uploadError}
            personality={localPersonality} // ✅ Use local state
            onNameChange={onNameChange}
            onColorChange={onColorChange}
            onAvatarChange={onAvatarChange || (() => {})}
            onPersonalityChange={handlePersonalityChangeLocal} // ✅ Use local handler
            onAvatarUpload={handleAvatarUpload}
            onDeleteCustomAvatar={handleDeleteCustomAvatar}
            fileInputRef={fileInputRef}
            onNext={handleBasicsNext}
            onBack={handleBasicsBack}
          />
        )}

        {/* Step 3: Rules Selection */}
        {currentStep === 'rules' && (
          <StepRules
            availableRules={rules}
            selectedRules={selectedRules}
            loadingRules={loadingRules}
            missingRules={missingRules}
            onRuleToggle={handleRuleToggle}
            onCreateRule={handleCreateRule}
            onBack={handleRulesBack}
            onConfirm={handleFinalConfirm}
            creating={creating}
            isEditing={isEditingAgent}
          />
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
