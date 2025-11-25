/**
 * Shared types for multi-step agent creation modal
 */

import type { AgentPersonality, GitBranch } from '../../types';
import type { CustomAvatarInfo } from '../../utils/customAvatarStorage';

// Step identifier
export type ModalStep = 'context' | 'basics' | 'skills' | 'droids' | 'triggers';

// Skill metadata loaded from filesystem
export interface SkillMetadata {
  id: string;
  name: string;
  description: string;
  path: string;
  isGlobal: boolean;
}

// Droid metadata loaded from filesystem
export interface DroidMetadata {
  id: string;
  name: string;
  description: string;
  specialization: string;
  path: string;
  isGlobal: boolean;
}

// Trigger configuration for a skill or droid
export interface TriggerConfig {
  id: string;           // skill or droid id
  type: 'skill' | 'droid';
  name: string;
  trigger: string;      // When to use this skill/droid (user-defined)
  autoInvoke: boolean;  // Should agent invoke proactively without asking?
}

// Suggested triggers based on skill/droid type
export const TRIGGER_SUGGESTIONS: Record<string, string[]> = {
  // Common patterns
  'default': [
    'When the user asks about...',
    'Before making decisions about...',
    'When working on files related to...',
    'After completing...',
  ],
  // UI/Design related
  'ui': [
    'When creating or modifying UI components',
    'Before making design decisions',
    'When discussing user experience',
    'When implementing accessibility features',
  ],
  // Code related
  'code': [
    'When reviewing or analyzing code',
    'Before refactoring',
    'When debugging issues',
    'When implementing new features',
  ],
  // Documentation
  'docs': [
    'When writing documentation',
    'When explaining code or concepts',
    'Before publishing changes',
  ],
  // Testing
  'test': [
    'When writing or updating tests',
    'Before merging code',
    'When investigating failures',
  ],
  // API/Backend
  'api': [
    'When working with API endpoints',
    'When designing data structures',
    'When handling authentication',
  ],
};

// Props for StepProjectContext
export interface StepProjectContextProps {
  path: string;
  branch: string;
  useWorktree: boolean;
  availableBranches: GitBranch[];
  loadingBranches: boolean;
  isGitRepository: boolean | null;
  initializingGit: boolean;
  selectingDirectory: boolean;
  onBrowse: () => void;
  onBranchChange: (branch: string) => void;
  onUseWorktreeChange: (useWorktree: boolean) => void;
  onGitInit: () => Promise<void>;
  onNext: () => void;
  onCancel: () => void;
}

// Props for StepAgentBasics
export interface StepAgentBasicsProps {
  name: string;
  color: string;
  avatar: string;
  availableColors: readonly string[];
  customAvatars: CustomAvatarInfo[];
  customAvatarUrls: Record<string, string>;
  loadingAvatars: boolean;
  uploadingAvatar: boolean;
  uploadError: string | null;
  personality: Partial<AgentPersonality>;
  onNameChange: (name: string) => void;
  onColorChange: (color: string) => void;
  onAvatarChange: (avatar: string) => void;
  onPersonalityChange: (personality: Partial<AgentPersonality>) => void;
  onAvatarUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDeleteCustomAvatar: (avatarId: string, event: React.MouseEvent) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onNext: () => void;
  onBack: () => void;
}

// Props for StepAgentConfig
export interface StepAgentConfigProps {
  availableSkills: SkillMetadata[];
  availableDroids: DroidMetadata[];
  selectedSkills: string[];
  selectedDroids: string[];
  loadingSkills: boolean;
  loadingDroids: boolean;
  onSkillToggle: (skillId: string) => void;
  onDroidToggle: (droidId: string) => void;
  onOpenDroidFactory: () => void;
  onBack: () => void;
  onConfirm: () => void;
  creating: boolean;
}

// Progress indicator props
export interface StepProgressProps {
  currentStep: ModalStep;
  completedSteps: ModalStep[];
}
