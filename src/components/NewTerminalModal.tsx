/**
 * New Terminal Modal - REFACTORED with 4-Step Process
 *
 * Step 1: Project Context (Directory + Git Branch)
 * Step 2: Agent Basics (Name, Color, Avatar, Personality)
 * Step 3: Skills Selection (Knowledge domains)
 * Step 4: Droids Selection (Sub-agents for delegation)
 *
 * This version uses modular step components for better maintainability.
 */

import { useState, useEffect, useRef } from 'react';
import type { AgentPersonality, GitBranch, SavedAgent } from '../types';
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
import { loadAvailableSkills, loadAvailableDroids } from '../utils/skillsAndDroidsLoader';

// Step components
import { StepProgress } from './modal-steps/StepProgress';
import { StepProjectContext } from './modal-steps/StepProjectContext';
import { StepAgentBasics } from './modal-steps/StepAgentBasics';
import { StepSkills } from './modal-steps/StepSkills';
import { StepDroids } from './modal-steps/StepDroids';
import { StepTriggers } from './modal-steps/StepTriggers';
import type { ModalStep, SkillMetadata, DroidMetadata, TriggerConfig } from './modal-steps/types';

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

  // Skills & Droids state
  const [availableSkills, setAvailableSkills] = useState<SkillMetadata[]>([]);
  const [availableDroids, setAvailableDroids] = useState<DroidMetadata[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [selectedDroids, setSelectedDroids] = useState<string[]>([]);
  const [loadingSkills, setLoadingSkills] = useState(false);
  const [loadingDroids, setLoadingDroids] = useState(false);
  // Track skills/droids that were saved but don't exist in current project
  const [missingSkills, setMissingSkills] = useState<string[]>([]);
  const [missingDroids, setMissingDroids] = useState<string[]>([]);

  // Trigger configurations state
  const [triggerConfigs, setTriggerConfigs] = useState<TriggerConfig[]>([]);

  // Store editing agent data to restore skills/droids after loading
  const [editingAgentData, setEditingAgentData] = useState<SavedAgent | null>(null);

  // Local personality state to track changes across steps
  const [localPersonality, setLocalPersonality] = useState<Partial<AgentPersonality>>(personality || {});

  // Track if we've initialized for this modal session
  const hasInitializedRef = useRef(false);

  // Reset state when modal opens - ONLY trigger on open/close, not on prop changes
  useEffect(() => {
    if (open && !hasInitializedRef.current) {
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
      setSelectedSkills([]);
      setSelectedDroids([]);
      setTriggerConfigs([]);
      setMissingSkills([]);
      setMissingDroids([]);
    }

    // Reset the ref when modal closes
    if (!open) {
      hasInitializedRef.current = false;
    }
  }, [open]); // Only depend on 'open' - read other values at execution time

  // Load data when modal opens
  useEffect(() => {
    if (open && path) {
      checkGitRepository();
      if (customAvatars.length === 0) {
        loadCustomAvatars();
      }
    }
  }, [open, path]);

  // Load skills and droids when reaching skills step
  useEffect(() => {
    if (currentStep === 'skills' && path) {
      loadSkillsAndDroids();
    }
  }, [currentStep, path]);

  // Restore skills/droids selections when editing and data is loaded
  useEffect(() => {
    if (!editingAgentData || loadingSkills || loadingDroids) return;
    if (availableSkills.length === 0 && availableDroids.length === 0) return;

    const personality = editingAgentData.personality;
    if (!personality) return;

    // Parse saved skills and restore selections
    const restoredSkills: string[] = [];
    const restoredTriggers: TriggerConfig[] = [];
    const notFoundSkills: string[] = []; // Track missing skills

    if (personality.skills && Array.isArray(personality.skills)) {
      for (const skillLine of personality.skills) {
        const parsed = parseSkillOrDroidLine(skillLine);
        if (!parsed) continue;

        // Find matching skill by path
        const matchedSkill = availableSkills.find(s =>
          s.path === parsed.path || s.path.endsWith(parsed.path) || parsed.path.endsWith(s.path)
        );

        if (matchedSkill) {
          restoredSkills.push(matchedSkill.id);
          if (parsed.trigger || !parsed.autoInvoke) {
            restoredTriggers.push({
              id: matchedSkill.id,
              type: 'skill',
              name: matchedSkill.name,
              trigger: parsed.trigger,
              autoInvoke: parsed.autoInvoke
            });
          }
        } else {
          // Skill not found in current project - extract readable name from path
          const skillName = parsed.path.split('/').pop()?.replace('.md', '') || parsed.path;
          notFoundSkills.push(skillName);
        }
      }
    }

    // Parse saved droids from customNotes
    const restoredDroids: string[] = [];
    const notFoundDroids: string[] = []; // Track missing droids
    const originalCustomNotes = editingAgentData.personality?.customNotes || '';
    const droidLines = extractDroidLinesFromCustomNotes(originalCustomNotes);

    for (const droidLine of droidLines) {
      const parsed = parseSkillOrDroidLine(droidLine.replace(/^-\s*/, ''));
      if (!parsed) continue;

      // Find matching droid by path
      const matchedDroid = availableDroids.find(d =>
        d.path === parsed.path || d.path.endsWith(parsed.path) || parsed.path.endsWith(d.path)
      );

      if (matchedDroid) {
        restoredDroids.push(matchedDroid.id);
        if (parsed.trigger || !parsed.autoInvoke) {
          restoredTriggers.push({
            id: matchedDroid.id,
            type: 'droid',
            name: matchedDroid.name,
            trigger: parsed.trigger,
            autoInvoke: parsed.autoInvoke
          });
        }
      } else {
        // Droid not found in current project - extract readable name from path
        const droidName = parsed.path.split('/').pop()?.replace('.md', '') || parsed.path;
        notFoundDroids.push(droidName);
      }
    }

    // Apply restored selections
    if (restoredSkills.length > 0) {
      setSelectedSkills(restoredSkills);
    }
    if (restoredDroids.length > 0) {
      setSelectedDroids(restoredDroids);
    }
    if (restoredTriggers.length > 0) {
      setTriggerConfigs(restoredTriggers);
    }

    // Set missing items for warning display
    setMissingSkills(notFoundSkills);
    setMissingDroids(notFoundDroids);

    // Clear editing data after restore to prevent re-running
    setEditingAgentData(null);
  }, [editingAgentData, availableSkills, availableDroids, loadingSkills, loadingDroids]);

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

  async function loadSkillsAndDroids() {
    // Load skills
    setLoadingSkills(true);
    try {
      const skills = await loadAvailableSkills(path);
      setAvailableSkills(skills);
    } catch (err) {
      console.error('Failed to load skills:', err);
    } finally {
      setLoadingSkills(false);
    }

    // Load droids
    setLoadingDroids(true);
    try {
      const droids = await loadAvailableDroids(path);
      setAvailableDroids(droids);
    } catch (err) {
      console.error('Failed to load droids:', err);
    } finally {
      setLoadingDroids(false);
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

    // Filter out droids section from customNotes before showing in edit mode
    const filteredPersonality = agent.personality ? {
      ...agent.personality,
      customNotes: filterDroidsFromCustomNotes(agent.personality.customNotes)
    } : agent.personality;

    // ✅ Update BOTH parent state AND local state
    onPersonalityChange?.(filteredPersonality);
    setLocalPersonality(filteredPersonality || {}); // Update local state immediately
    markAgentAsUsed(agent.id);

    // Store original agent data to restore skills/droids after loading
    setEditingAgentData(agent);

    // Skip Step 1 when editing - go directly to Basics
    setIsEditingAgent(true);
    setCurrentStep('basics');
    setAgentMode('create');
  }

  // Helper function to filter out droids section from customNotes
  function filterDroidsFromCustomNotes(customNotes?: string): string | undefined {
    if (!customNotes) return customNotes;

    const lines = customNotes.split('\n');
    const filtered: string[] = [];
    let skipDroids = false;

    for (const line of lines) {
      if (line.includes('Selected Protocol Droids:')) {
        skipDroids = true;
        continue;
      }
      if (skipDroids) {
        const trimmed = line.trim();
        // Stop skipping when we hit non-droid content
        if (!trimmed.startsWith('- ') && trimmed.length > 0) {
          skipDroids = false;
          filtered.push(line);
        }
        // Skip droid lines and empty lines within droids section
        continue;
      }
      filtered.push(line);
    }

    return filtered.join('\n').trim();
  }

  // Helper to parse skill/droid line format: "path | WHEN: trigger | AUTO-INVOKE"
  function parseSkillOrDroidLine(line: string): { path: string; trigger: string; autoInvoke: boolean } | null {
    if (!line || !line.trim()) return null;

    const parts = line.split('|').map(p => p.trim());
    const path = parts[0];
    let trigger = '';
    let autoInvoke = true; // Default to true

    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      if (part.startsWith('WHEN:')) {
        trigger = part.replace('WHEN:', '').trim();
      } else if (part === 'AUTO-INVOKE') {
        autoInvoke = true;
      }
    }

    // If AUTO-INVOKE is not present in the line, it means it was disabled
    if (parts.length > 1 && !line.includes('AUTO-INVOKE')) {
      autoInvoke = false;
    }

    return { path, trigger, autoInvoke };
  }

  // Helper to extract droid lines from customNotes
  function extractDroidLinesFromCustomNotes(customNotes: string): string[] {
    if (!customNotes) return [];

    const lines = customNotes.split('\n');
    const droidLines: string[] = [];
    let inDroidsSection = false;

    for (const line of lines) {
      if (line.includes('Selected Protocol Droids:')) {
        inDroidsSection = true;
        continue;
      }
      if (inDroidsSection) {
        const trimmed = line.trim();
        if (trimmed.startsWith('- ')) {
          droidLines.push(trimmed);
        } else if (trimmed.length > 0 && !trimmed.startsWith('- ')) {
          // End of droids section
          break;
        }
      }
    }

    return droidLines;
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
    setCurrentStep('skills');
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

  function handleSkillsNext() {
    setCompletedSteps(prev => [...prev, 'skills']);
    setCurrentStep('droids');
  }

  function handleSkillsBack() {
    setCurrentStep('basics');
  }

  function handleDroidsBack() {
    setCurrentStep('skills');
  }

  function handleDroidsNext() {
    setCompletedSteps(prev => [...prev, 'droids']);
    setCurrentStep('triggers');
  }

  function handleTriggersBack() {
    setCurrentStep('droids');
  }

  // ===== Skills & Droids =====

  function handleSkillToggle(skillId: string) {
    setSelectedSkills(prev =>
      prev.includes(skillId)
        ? prev.filter(id => id !== skillId)
        : [...prev, skillId]
    );
  }

  function handleDroidToggle(droidId: string) {
    setSelectedDroids(prev =>
      prev.includes(droidId)
        ? prev.filter(id => id !== droidId)
        : [...prev, droidId]
    );
  }

  function handleOpenDroidFactory() {
    if (onOpenDroidFactory) {
      onOpenDroidFactory();
    } else {
      alert('Droid Factory is not available. Please configure it in your app.');
    }
  }

  // ===== Final Confirmation =====

  async function handleFinalConfirm() {
    // Update personality with selected skills and droids
    const skillPaths = selectedSkills.map(id => {
      const skill = availableSkills.find(s => s.id === id);
      return skill ? skill.path : id;
    });

    // Build trigger-enhanced droid lines with WHEN to use each
    const droidLines = selectedDroids.map(id => {
      const droid = availableDroids.find(d => d.id === id);
      const triggerConfig = triggerConfigs.find(t => t.id === id && t.type === 'droid');
      const path = droid ? droid.path : id;
      const trigger = triggerConfig?.trigger || '';
      const autoInvoke = triggerConfig?.autoInvoke !== false; // Default true

      if (trigger) {
        return `- ${path} | WHEN: ${trigger}${autoInvoke ? ' | AUTO-INVOKE' : ''}`;
      }
      return `- ${path}${autoInvoke ? ' | AUTO-INVOKE' : ''}`;
    });

    // Build trigger-enhanced skill paths with WHEN to use each
    const skillLines = selectedSkills.map(id => {
      const skill = availableSkills.find(s => s.id === id);
      const triggerConfig = triggerConfigs.find(t => t.id === id && t.type === 'skill');
      const path = skill ? skill.path : id;
      const trigger = triggerConfig?.trigger || '';
      const autoInvoke = triggerConfig?.autoInvoke !== false; // Default true

      if (trigger) {
        return `${path} | WHEN: ${trigger}${autoInvoke ? ' | AUTO-INVOKE' : ''}`;
      }
      return `${path}${autoInvoke ? ' | AUTO-INVOKE' : ''}`;
    });

    // Build custom notes: only include droids section if droids are selected
    // Use LOCAL personality state instead of prop
    let finalCustomNotes = localPersonality?.customNotes || '';

    if (selectedDroids.length > 0) {
      // Add droids section only if there are selected droids
      const droidsSection = [
        'Selected Protocol Droids:',
        ...droidLines
      ].join('\n');

      // Append droids to existing custom notes (if any)
      if (finalCustomNotes.trim()) {
        finalCustomNotes = `${finalCustomNotes}\n\n${droidsSection}`;
      } else {
        finalCustomNotes = droidsSection;
      }
    }

    // Use LOCAL personality state for complete data
    const updatedPersonality: Partial<AgentPersonality> = {
      ...localPersonality, // ✅ Use local state instead of prop
      skills: skillLines.length > 0 ? skillLines : undefined, // Include trigger info with skills
      customNotes: finalCustomNotes.trim() || undefined // Only include if not empty
    };

    // DEBUG: Log what we're sending
    console.log('🔍 [MODAL] handleFinalConfirm called');
    console.log('🔍 [MODAL] Local personality before merge:', JSON.stringify(localPersonality, null, 2));
    console.log('🔍 [MODAL] Selected skills:', selectedSkills);
    console.log('🔍 [MODAL] Skill paths:', skillPaths);
    console.log('🔍 [MODAL] Selected droids:', selectedDroids);
    console.log('🔍 [MODAL] Droid lines:', droidLines);
    console.log('🔍 [MODAL] Final custom notes:', finalCustomNotes);
    console.log('🔍 [MODAL] Updated personality:', JSON.stringify(updatedPersonality, null, 2));

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

        {/* Step 3: Skills Selection */}
        {currentStep === 'skills' && (
          <StepSkills
            availableSkills={availableSkills}
            selectedSkills={selectedSkills}
            loadingSkills={loadingSkills}
            missingSkills={missingSkills}
            onSkillToggle={handleSkillToggle}
            onOpenDroidFactory={handleOpenDroidFactory}
            onBack={handleSkillsBack}
            onNext={handleSkillsNext}
          />
        )}

        {/* Step 4: Droids Selection */}
        {currentStep === 'droids' && (
          <StepDroids
            availableDroids={availableDroids}
            selectedDroids={selectedDroids}
            loadingDroids={loadingDroids}
            missingDroids={missingDroids}
            onDroidToggle={handleDroidToggle}
            onOpenDroidFactory={handleOpenDroidFactory}
            onBack={handleDroidsBack}
            onNext={handleDroidsNext}
          />
        )}

        {/* Step 5: Triggers Configuration */}
        {currentStep === 'triggers' && (
          <StepTriggers
            selectedSkills={selectedSkills}
            selectedDroids={selectedDroids}
            availableSkills={availableSkills}
            availableDroids={availableDroids}
            triggerConfigs={triggerConfigs}
            onTriggerChange={setTriggerConfigs}
            onBack={handleTriggersBack}
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
