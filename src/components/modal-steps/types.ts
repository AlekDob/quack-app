/**
 * Shared types for multi-step agent creation modal
 * Project-first flow: project → agent → basics → rules
 */

import type { AgentPersonality, GitBranch, Rule, RuleScope } from '../../types';
import type { CustomAvatarInfo } from '../../utils/customAvatarStorage';

// Step identifier - project-first flow
// - 'project': Select project (path + branch) - FIRST STEP
// - 'agent': Select existing agent or create new - renamed from 'select' mode
// - 'basics': Agent configuration (name, color, avatar, personality)
// - 'rules': Rules selection
export type ModalStep = 'project' | 'agent' | 'basics' | 'rules';

// Active project from sidebar (derived from terminals)
export interface ActiveProject {
  name: string;      // e.g., "quack-app"
  path: string;      // e.g., "/Users/alekdob/Desktop/Dev/Personal/quack-app"
  color: string;     // e.g., "#FF6B35"
  agentCount: number;
}

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
  isEditing?: boolean; // True when editing existing agent
}

// Progress indicator props
export interface StepProgressProps {
  currentStep: ModalStep;
  completedSteps: ModalStep[];
  isEditing?: boolean; // Hide Step 1 (Project) when editing
}

// Skill metadata for agent configuration
export interface SkillMetadata {
  id: string;
  name: string;
  description: string;
  path: string;
  isGlobal: boolean;
}

// Droid metadata for agent configuration
export interface DroidMetadata {
  id: string;
  name: string;
  description: string;
  specialization: string;
  path: string;
  isGlobal: boolean;
}
