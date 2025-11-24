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
import type { ModalStep, SkillMetadata, DroidMetadata } from './modal-steps/types';

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

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setCurrentStep('context');
      setCompletedSteps([]);
      setAgentMode('select');
    }
  }, [open]);

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

    onConfirm(agent);
  }

  function handleEditAgent(agent: SavedAgent) {
    onNameChange(agent.name);
    onColorChange(agent.color);
    onAvatarChange?.(agent.avatar);
    onWorkingOnChange?.(agent.workingOn || '');
    onPersonalityChange?.(agent.personality);
    markAgentAsUsed(agent.id);
    setAgentMode('create');
  }

  function handleCreateNewAgent() {
    setAgentMode('create');
  }

  function handleBackToAgentSelection() {
    setAgentMode('select');
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
    setCurrentStep('context');
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
    const updatedPersonality: Partial<AgentPersonality> = {
      ...personality,
      skills: selectedSkills.map(id => {
        const skill = availableSkills.find(s => s.id === id);
        return skill ? skill.path : id;
      }),
      // Store droids in customNotes for now (we can create a dedicated field later)
      customNotes: [
        personality?.customNotes || '',
        '',
        'Selected Protocol Droids:',
        ...selectedDroids.map(id => {
          const droid = availableDroids.find(d => d.id === id);
          return droid ? `- ${droid.path}` : `- ${id}`;
        })
      ].filter(Boolean).join('\n')
    };

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

    // Create terminal
    onConfirm();
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
              {isEditing ? '✏️ Edit agent' : '✨ Create new agent'}
            </h2>
            <p className="modal-subtitle">Step-by-step configuration</p>
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

        {/* Progress Indicator */}
        <StepProgress currentStep={currentStep} completedSteps={completedSteps} />

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
            personality={personality || {}}
            onNameChange={onNameChange}
            onColorChange={onColorChange}
            onAvatarChange={onAvatarChange || (() => {})}
            onPersonalityChange={onPersonalityChange || (() => {})}
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
            onDroidToggle={handleDroidToggle}
            onOpenDroidFactory={handleOpenDroidFactory}
            onBack={handleDroidsBack}
            onConfirm={handleFinalConfirm}
            creating={creating}
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
