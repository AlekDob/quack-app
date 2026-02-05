/**
 * Shared types for multi-step agent creation modal
 * 2-step flow: project → agent (with inline create/edit)
 */

import type { GitBranch } from '../../types';

// Step identifier - 2-step flow
// - 'project': Select project (path + branch) - FIRST STEP
// - 'starters': Choose starter agent bundles from marketplace (onboarding only)
// - 'agent': Select existing agent or create new (includes inline form) - FINAL STEP
export type ModalStep = 'project' | 'starters' | 'agent';

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
