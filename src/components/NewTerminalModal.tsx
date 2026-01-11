/**
 * New Terminal Modal - PROJECT-FIRST Flow
 *
 * Step 1: Project Selection (Choose project + Git Branch)
 * Step 2: Agent Selection (Use existing or create new)
 * Step 3: Agent Basics (Name, Color, Avatar, Personality) - only for Create/Edit
 * Step 4: Rules Selection (Claude Code rules to follow) - only for Create/Edit
 * Step 5: Toolkit Selection (Skills, droids, commands) - only for Create/Edit
 *
 * Key UX change: "Use" on existing agent = direct confirmation (project already selected)
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
import { normalizeRulePaths, areRulePathsEqual } from '../utils/rulePathUtils';
import { loadAvailableSkills, loadAvailableDroids, loadAvailableCommands } from '../utils/skillsAndDroidsLoader';

// Step components
import { StepProgress } from './modal-steps/StepProgress';
import { StepProjectSelection } from './modal-steps/StepProjectSelection';
import { StepAgentBasics } from './modal-steps/StepAgentBasics';
import { StepRules } from './modal-steps/StepRules';
import type { ModalStep, ActiveProject, SkillMetadata, DroidMetadata } from './modal-steps/types';

// Cyberpunk Agent Bundle Editor
import { AgentBundleEditor } from './agent-bundle';

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
  onOpenDroidFactory?: () => void
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
  onOpenDroidFactory,
}: NewTerminalModalProps) {
  // Step management - PROJECT-FIRST FLOW
  // Normal: project → agent → basics → rules → toolkit
  // Edit mode: basics directly
  const [currentStep, setCurrentStep] = useState<ModalStep>('project');
  const [completedSteps, setCompletedSteps] = useState<ModalStep[]>([]);
  const [isEditingAgent, setIsEditingAgent] = useState(false); // Track internal edit mode
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null); // Preserve agent ID during edit
  const [selectedProjectColor, setSelectedProjectColor] = useState<string>(''); // Color from project selection

  // Toolkit loading state
  const [loadingEquipment, setLoadingEquipment] = useState(false);

  // Available equipment for Cyberpunk Editor (loaded from filesystem)
  const [skillsMetadata, setSkillsMetadata] = useState<SkillMetadata[]>([]);
  const [droidsMetadata, setDroidsMetadata] = useState<DroidMetadata[]>([]);
  const [commandsMetadata, setCommandsMetadata] = useState<string[]>([]);

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
      // skip project + agent selection and go directly to Basics step
      if (isEditing) {
        setCurrentStep('basics');
        setIsEditingAgent(true);
        // Create synthetic agent data from props to trigger skills/droids restore
        // Use the agent ID from personality if available, otherwise generate one
        const agentId = personality?.id as string || `editing-${Date.now()}`;
        setEditingAgentData({
          id: agentId,
          name: name,
          avatar: avatar || '',
          color: color,
          workingOn: workingOn || '',
          personality: personality || {},
          createdAt: Date.now(),
          lastUsed: Date.now(),
          usageCount: 0,
        });
        // Preserve agent ID for edit mode (so save updates instead of creates)
        setEditingAgentId(agentId);
        // Load equipment for Toolkit step (skills, droids, commands)
        if (path) {
          loadEquipmentForToolkitEditor(path);
        }
      } else {
        // PROJECT-FIRST FLOW: Start with project selection or agent (if initialStep is 'agent')
        setCurrentStep(initialStep);
        setIsEditingAgent(false);
        setEditingAgentData(null);
        // If starting at 'agent' step (from sidebar +), mark 'project' as completed
        setCompletedSteps(initialStep === 'agent' ? ['project'] : []);
      }
      setLocalPersonality(personality || {});
      setSelectedRules([]);
      setMissingRules([]);
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
      // Use areRulePathsEqual to properly match normalized paths with absolute paths
      // This handles cases like:
      // - Saved: ".claude/rules/my-rule.md"
      // - Backend: "/Users/xxx/project/.claude/rules/my-rule.md"
      const matchedRule = allRules.find(r => areRulePathsEqual(r.filePath, rulePath));

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

  /**
   * Load available equipment (skills, droids, commands) for the Toolkit Editor
   */
  async function loadEquipmentForToolkitEditor(projectPath: string) {
    if (!projectPath) return;

    setLoadingEquipment(true);
    try {
      console.log('[NewTerminalModal] Loading equipment for Toolkit Editor...');

      // Load skills, droids, and commands in parallel
      const [skills, droids, commands] = await Promise.all([
        loadAvailableSkills(projectPath),
        loadAvailableDroids(projectPath),
        loadAvailableCommands(projectPath),
      ]);

      console.log('[NewTerminalModal] Loaded skills:', skills.length);
      console.log('[NewTerminalModal] Loaded droids:', droids.length);
      console.log('[NewTerminalModal] Loaded commands:', commands.length);

      setSkillsMetadata(skills);
      setDroidsMetadata(droids);
      setCommandsMetadata(commands);
    } catch (err) {
      console.error('[NewTerminalModal] Failed to load equipment:', err);
    } finally {
      setLoadingEquipment(false);
    }
  }

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

  // "Edit" an existing agent - go to basics step
  function handleEditAgent(agent: SavedAgent) {
    console.log('[NewTerminalModal] handleEditAgent - path:', path, 'agent:', agent.name);
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
    // Preserve agent ID separately (survives editingAgentData clearing)
    setEditingAgentId(agent.id);

    // Load equipment in background for Toolkit step
    console.log('[NewTerminalModal] handleEditAgent - calling loadEquipmentForToolkitEditor with path:', path);
    loadEquipmentForToolkitEditor(path);

    // Go to Basics step for editing
    setIsEditingAgent(true);
    setCompletedSteps(prev => [...prev, 'agent']);
    setCurrentStep('basics');
  }

  // "Create New" agent - go to Basics step first, then Rules, then Toolkit
  function handleCreateNewAgent() {
    setIsEditingAgent(false);
    setEditingAgentId(null); // Clear any previous editing ID
    setCompletedSteps(prev => [...prev, 'agent']);
    // Load equipment in background for later steps
    loadEquipmentForToolkitEditor(path);
    // Go to Basics step first (avatar, name, color)
    setCurrentStep('basics');
  }

  // Handle save from Toolkit Editor
  function handleToolkitSave(agent: SavedAgent) {
    console.log('[NewTerminalModal] Toolkit Editor save:', agent);

    // Normalize rule paths for portable storage
    const normalizedRules = agent.personality?.selectedRules?.length
      ? normalizeRulePaths(agent.personality.selectedRules, path)
      : undefined;

    // Build complete agent with normalized rules
    const completeAgent: SavedAgent = {
      ...agent,
      personality: {
        ...agent.personality,
        selectedRules: normalizedRules,
      },
    };

    // Save to storage (pass ID for edit mode to update correct agent)
    try {
      saveAgent(
        {
          name: completeAgent.name,
          avatar: completeAgent.avatar || '',
          color: completeAgent.color,
          workingOn: completeAgent.workingOn,
          personality: completeAgent.personality,
        },
        editingAgentId || undefined // Pass existing ID for edit mode
      );
    } catch (err) {
      console.warn('Failed to save agent to storage:', err);
    }

    // Confirm and close
    onConfirm(completeAgent);
  }

  // Handle cancel from Toolkit Editor - go back to Rules step
  function handleToolkitCancel() {
    // Go back to Rules step
    setCurrentStep('rules');
    setCompletedSteps(prev => prev.filter(s => s !== 'rules'));
  }

  // Back to agent selection from basics
  function handleBackToAgentSelection() {
    setCurrentStep('agent');
    setCompletedSteps(prev => prev.filter(s => s !== 'agent'));
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
    setCurrentStep('agent');
  }

  // Handle project selection from StepProjectSelection
  function handleSelectProject(selectedPath: string, projectColor: string) {
    onPathChange?.(selectedPath);
    setSelectedProjectColor(projectColor);
    // Also trigger git repository check for the new path
    checkGitRepository();
  }

  // Step 3: Basics → Rules
  function handleBasicsNext() {
    if (!name.trim()) {
      alert('Please enter an agent name');
      return;
    }
    setCompletedSteps(prev => [...prev, 'basics']);
    // Go to Rules step
    setCurrentStep('rules');
  }

  // Back from Basics
  function handleBasicsBack() {
    if (isEditingAgent && isEditing) {
      // External edit mode (from sidebar) - just cancel
      onCancel();
    } else {
      // Go back to agent selection
      handleBackToAgentSelection();
    }
  }

  // Back from Rules
  function handleRulesBack() {
    setCurrentStep('basics');
    setCompletedSteps(prev => prev.filter(s => s !== 'basics'));
  }

  // Step 4: Rules → Toolkit
  function handleRulesNext() {
    setCompletedSteps(prev => [...prev, 'rules']);
    // Go to Toolkit step
    setCurrentStep('toolkit');
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

  // ===== Rules Confirmation - Goes to Toolkit =====

  async function handleRulesConfirm() {
    // Normalize rule paths for portable storage
    // - Project rules: `.claude/rules/name.md` (relative)
    // - Global rules: `~/.claude/rules/name.md` (tilde notation)
    const normalizedRules = selectedRules.length > 0
      ? normalizeRulePaths(selectedRules, path)
      : undefined;

    // Build updated personality with normalized rules
    const updatedPersonality: Partial<AgentPersonality> = {
      ...localPersonality,
      selectedRules: normalizedRules,
    };

    // DEBUG: Log what we're sending
    console.log('[MODAL] handleRulesConfirm called');
    console.log('[MODAL] Selected rules (original):', selectedRules);
    console.log('[MODAL] Selected rules (normalized):', normalizedRules);
    console.log('[MODAL] Updated personality:', JSON.stringify(updatedPersonality, null, 2));

    onPersonalityChange?.(updatedPersonality);
    setLocalPersonality(updatedPersonality);

    // Move to Toolkit step
    handleRulesNext();
  }

  if (!open) {
    return null;
  }

  // Determine modal title and subtitle based on current step
  const getModalHeader = () => {
    if (isEditing || isEditingAgent) {
      return { title: 'Edit Agent', subtitle: 'Update agent configuration' };
    }
    switch (currentStep) {
      case 'project':
        return { title: 'Select Project', subtitle: 'Choose your workspace' };
      case 'agent':
        return { title: 'Select Agent', subtitle: 'Use existing or create new' };
      case 'basics':
        return { title: 'Configure Agent', subtitle: 'Set name, color, and personality' };
      case 'rules':
        return { title: 'Select Rules', subtitle: 'Choose Claude Code rules' };
      case 'toolkit':
        return { title: 'Agent Toolkit', subtitle: 'Select your quick-access tools' };
      default:
        return { title: 'New Agent', subtitle: 'Step-by-step configuration' };
    }
  };

  const header = getModalHeader();

  // Determine if we need a wider modal (toolkit step)
  const isToolkitStep = currentStep === 'toolkit';

  // Render the modal with project-first flow
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className={`modal-panel agent-modal ${isToolkitStep ? 'equipment-step-wide' : ''}`}>
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

        {/* Step 2: Agent Selection */}
        {currentStep === 'agent' && (
          <>
            <AgentSelector
              onUseAgent={handleUseAgent}
              onEditAgent={handleEditAgent}
              onCreateNew={handleCreateNewAgent}
            />
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
          </>
        )}

        {/* Step 3: Agent Basics */}
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
            personality={localPersonality}
            onNameChange={onNameChange}
            onColorChange={onColorChange}
            onAvatarChange={onAvatarChange || (() => {})}
            onPersonalityChange={handlePersonalityChangeLocal}
            onAvatarUpload={handleAvatarUpload}
            onDeleteCustomAvatar={handleDeleteCustomAvatar}
            fileInputRef={fileInputRef}
            onNext={handleBasicsNext}
            onBack={handleBasicsBack}
          />
        )}

        {/* Step 4: Rules Selection */}
        {currentStep === 'rules' && (
          <StepRules
            availableRules={rules}
            selectedRules={selectedRules}
            loadingRules={loadingRules}
            missingRules={missingRules}
            onRuleToggle={handleRuleToggle}
            onCreateRule={handleCreateRule}
            onBack={handleRulesBack}
            onConfirm={handleRulesConfirm}
            creating={creating}
            isEditing={isEditingAgent}
          />
        )}

        {/* Step 5: Toolkit Editor (Fallout Style) */}
        {currentStep === 'toolkit' && (
          <>
            {(() => {
              // Convert metadata arrays to string arrays for the editor
              const availableSkillNames = skillsMetadata.map(s => s.name);
              const availableDroidNames = droidsMetadata.map(d => d.name);
              const availableRuleNames = rules.project.concat(rules.global).map(r => r.name);
              const availableCommandNames: string[] = commandsMetadata;

              console.log('[NewTerminalModal] Toolkit step - skillsMetadata:', skillsMetadata.length, 'droidsMetadata:', droidsMetadata.length);
              console.log('[NewTerminalModal] Toolkit step - availableSkillNames:', availableSkillNames);
              console.log('[NewTerminalModal] Toolkit step - loadingEquipment:', loadingEquipment);

              // Create agent object from Basics step data
              // Use existing ID if editing, otherwise generate new
              const agentFromBasics: SavedAgent = {
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

              return (
                <AgentBundleEditor
                  agent={agentFromBasics}
                  availableSkills={availableSkillNames}
                  availableDroids={availableDroidNames}
                  availableRules={availableRuleNames}
                  availableCommands={availableCommandNames}
                  onSave={handleToolkitSave}
                  onCancel={handleToolkitCancel}
                  isEditing={isEditingAgent}
                />
              );
            })()}
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
