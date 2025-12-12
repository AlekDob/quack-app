/**
 * Shared types for multi-step agent creation modal
 * Simplified flow: context → basics → rules
 */

import type { AgentPersonality, GitBranch, Rule, RuleScope } from '../../types';
import type { CustomAvatarInfo } from '../../utils/customAvatarStorage';

// Step identifier - simplified to 3 steps
export type ModalStep = 'context' | 'basics' | 'rules';

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
  // "Use" flow props
  isUsing?: boolean;
  onUseConfirm?: () => void;
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

// Props for StepRules - new simplified step
export interface StepRulesProps {
  availableRules: {
    project: Rule[];
    global: Rule[];
  };
  selectedRules: string[]; // Array of rule file paths
  loadingRules: boolean;
  missingRules?: string[]; // Rules saved but not available
  onRuleToggle: (rulePath: string) => void;
  onCreateRule?: (
    name: string,
    content: string,
    scope: RuleScope,
    description?: string,
    globs?: string[],
    alwaysApply?: boolean
  ) => Promise<void>;
  onBack: () => void;
  onConfirm: () => void;
  creating: boolean;
}

// Progress indicator props
export interface StepProgressProps {
  currentStep: ModalStep;
  completedSteps: ModalStep[];
  isEditing?: boolean; // Hide Step 1 (Project) when editing
}
