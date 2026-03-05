/**
 * WorktreeService - Manages Git worktrees for Kanban tasks
 *
 * Each task can have an isolated worktree for parallel development.
 * Worktrees are created when task moves to IN_PROGRESS and cleaned up on DONE.
 */

import { invoke } from '@tauri-apps/api/core';
import type { KanbanTask } from '../types';

interface GitWorktree {
  path: string;
  branch: string;
  commitHash: string;
  isBare: boolean;
  isDetached: boolean;
}

interface MergeResult {
  success: boolean;
  strategy?: 'fast-forward' | 'merge-commit';
  hasConflicts?: boolean;
  conflictedFiles?: string[];
  error?: string;
}

interface WorktreeConfig {
  /** Maximum worktrees allowed per project */
  maxWorktrees: number;
  /** Target branch for merge (default: main) */
  defaultTargetBranch: string;
  /** Cleanup worktree after merge */
  cleanupOnMerge: boolean;
  /** Delete branch after merge */
  deleteBranchOnMerge: boolean;
}

const DEFAULT_CONFIG: WorktreeConfig = {
  maxWorktrees: 10,
  defaultTargetBranch: 'main',
  cleanupOnMerge: true,
  deleteBranchOnMerge: true,
};

/**
 * Convert a string to kebab-case slug
 */
function slugify(text: string, maxLength: number = 50): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .trim()
    .split(/\s+/) // Split by whitespace
    .slice(0, 5) // Take first 5 words
    .join('-')
    .slice(0, maxLength); // Limit length
}

/**
 * Generate branch name for a task
 * Format: task/{taskId}-{slug}
 */
export function generateBranchName(task: KanbanTask): string {
  const slug = slugify(task.title);
  const shortId = task.id.slice(-8); // Last 8 chars of task ID
  return `task/${shortId}-${slug}`;
}

/**
 * Generate worktree path for a task
 * Format: {projectPath}/.worktrees/task-{taskId}
 */
function generateWorktreePath(task: KanbanTask): string {
  const shortId = task.id.slice(-8);
  return `${task.projectPath}/.worktrees/task-${shortId}`;
}

/**
 * List all worktrees for a project
 */
async function listWorktrees(projectPath: string): Promise<GitWorktree[]> {
  try {
    const worktrees = await invoke<GitWorktree[]>('git_list_worktrees', {
      rootPath: projectPath,
    });
    return worktrees || [];
  } catch (error) {
    console.error('[WorktreeService] Failed to list worktrees:', error);
    return [];
  }
}

/**
 * Check if a worktree exists for a task
 */
async function worktreeExists(task: KanbanTask): Promise<boolean> {
  const worktreePath = generateWorktreePath(task);
  const worktrees = await listWorktrees(task.projectPath);
  return worktrees.some(wt => wt.path === worktreePath);
}

/**
 * Ensure worktree exists for a task. Creates if not exists.
 * Called when task moves to IN_PROGRESS.
 *
 * @returns Worktree path
 */
export async function ensureWorktree(
  task: KanbanTask,
  config: Partial<WorktreeConfig> = {}
): Promise<string> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const worktreePath = generateWorktreePath(task);
  const branchName = generateBranchName(task);

  // Check existing worktrees
  const worktrees = await listWorktrees(task.projectPath);

  // Check if already exists
  const existing = worktrees.find(wt => wt.path === worktreePath);
  if (existing) {
    console.log('[WorktreeService] Worktree already exists:', worktreePath);
    return worktreePath;
  }

  // Check worktree limit
  if (worktrees.length >= cfg.maxWorktrees) {
    throw new Error(
      `Maximum worktrees limit (${cfg.maxWorktrees}) reached. ` +
      `Please complete or cancel some tasks first.`
    );
  }

  // Create worktree with new branch
  console.log('[WorktreeService] Creating worktree:', { worktreePath, branchName });

  try {
    await invoke('git_add_worktree', {
      path: worktreePath,
      branchName: branchName,
      createBranch: true,
      rootPath: task.projectPath,
    });

    console.log('[WorktreeService] Worktree created successfully');
    return worktreePath;
  } catch (error) {
    console.error('[WorktreeService] Failed to create worktree:', error);
    throw new Error(`Failed to create worktree: ${error}`);
  }
}

/**
 * Clean up worktree and optionally delete branch.
 * Called after successful merge or task cancellation.
 */
async function cleanupWorktree(
  task: KanbanTask,
  deleteBranch: boolean = true,
  force: boolean = false
): Promise<void> {
  const worktreePath = task.worktreePath || generateWorktreePath(task);
  const branchName = task.branch || generateBranchName(task);

  // Check if worktree exists
  const worktrees = await listWorktrees(task.projectPath);
  const exists = worktrees.some(wt => wt.path === worktreePath);

  if (!exists) {
    console.log('[WorktreeService] Worktree does not exist, skipping cleanup');
    return;
  }

  try {
    // Remove worktree
    console.log('[WorktreeService] Removing worktree:', worktreePath);
    await invoke('git_remove_worktree', {
      path: worktreePath,
      force,
      rootPath: task.projectPath,
    });

    // Optionally delete branch
    if (deleteBranch) {
      console.log('[WorktreeService] Deleting branch:', branchName);
      try {
        await invoke('git_delete_branch', {
          branchName,
          force,
          rootPath: task.projectPath,
        });
      } catch (branchError) {
        // Branch deletion is optional, don't fail the whole operation
        console.warn('[WorktreeService] Failed to delete branch:', branchError);
      }
    }

    console.log('[WorktreeService] Cleanup completed');
  } catch (error) {
    console.error('[WorktreeService] Failed to cleanup worktree:', error);
    throw new Error(`Failed to cleanup worktree: ${error}`);
  }
}

/**
 * Check for uncommitted changes in worktree
 */
async function hasUncommittedChanges(worktreePath: string): Promise<boolean> {
  try {
    const status = await invoke<{ clean: boolean }>('git_status_summary', {
      rootPath: worktreePath,
    });
    console.log('[WorktreeService] Worktree status check:', { worktreePath, clean: status.clean });
    return !status.clean;
  } catch (error) {
    console.error('[WorktreeService] Failed to check git status:', error);
    return false;
  }
}

/**
 * Auto-commit all changes in a worktree before merge.
 * This ensures no work is lost when the worktree is cleaned up.
 */
async function autoCommitWorktreeChanges(
  worktreePath: string,
  taskTitle: string
): Promise<boolean> {
  try {
    // Stage all changes (including untracked files)
    console.log('[WorktreeService] Staging all changes in worktree:', worktreePath);
    await invoke('git_stage_all', {
      rootPath: worktreePath,
    });

    // Create commit with descriptive message
    const commitMessage = `🤖 Auto-commit: ${taskTitle}\n\nThis commit was automatically created when the task was marked as done.`;
    console.log('[WorktreeService] Creating auto-commit...');
    await invoke('git_commit', {
      message: commitMessage,
      rootPath: worktreePath,
    });

    console.log('[WorktreeService] Auto-commit successful');
    return true;
  } catch (error) {
    console.error('[WorktreeService] Failed to auto-commit:', error);
    return false;
  }
}

/**
 * Check for uncommitted changes in main repo (not worktree)
 */
async function hasUncommittedChangesInMain(projectPath: string): Promise<boolean> {
  try {
    const status = await invoke<{ dirty: boolean }>('git_status_summary', {
      rootPath: projectPath,
    });
    return status.dirty;
  } catch (error) {
    console.error('[WorktreeService] Failed to check main repo status:', error);
    return false;
  }
}

/**
 * Merge task branch to target and cleanup.
 * Called when task moves to DONE.
 *
 * If main branch has uncommitted changes, will stash them, merge, then unstash.
 */
export async function mergeAndCleanup(
  task: KanbanTask,
  config: Partial<WorktreeConfig> = {}
): Promise<MergeResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const branchName = task.branch || generateBranchName(task);
  const targetBranch = cfg.defaultTargetBranch;

  console.log('[WorktreeService] Merging:', { branchName, targetBranch, worktreePath: task.worktreePath });

  let didStash = false;

  try {
    // Check for uncommitted changes in worktree and auto-commit if needed
    if (task.worktreePath) {
      const hasChanges = await hasUncommittedChanges(task.worktreePath);
      if (hasChanges) {
        console.log('[WorktreeService] Task has uncommitted changes in worktree, auto-committing...');
        const autoCommitSuccess = await autoCommitWorktreeChanges(task.worktreePath, task.title);
        if (!autoCommitSuccess) {
          console.error('[WorktreeService] Auto-commit failed');
          return {
            success: false,
            error: 'Failed to auto-commit changes in worktree. Please commit manually.',
          };
        }
      }
    }

    // Check for uncommitted changes in main repo
    const mainHasChanges = await hasUncommittedChangesInMain(task.projectPath);
    if (mainHasChanges) {
      console.log('[WorktreeService] Main branch has uncommitted changes, stashing...');
      try {
        await invoke('git_stash_push', {
          message: `Auto-stash before merging task ${task.id}`,
          rootPath: task.projectPath,
        });
        didStash = true;
        console.log('[WorktreeService] Stash created successfully');
      } catch (stashError) {
        console.warn('[WorktreeService] Failed to stash:', stashError);
        // If stash fails, try to continue anyway - checkout might work if changes are in different files
      }
    }

    // Switch to target branch in main repo
    console.log('[WorktreeService] Switching to target branch:', targetBranch);
    try {
      await invoke('git_switch_branch', {
        branchName: targetBranch,
        rootPath: task.projectPath,
      });
    } catch (switchError) {
      console.error('[WorktreeService] Failed to switch branch:', switchError);
      // Try to restore stash if we created one
      if (didStash) {
        try {
          await invoke('git_stash_pop', { rootPath: task.projectPath });
        } catch (e) {
          console.warn('[WorktreeService] Failed to pop stash after switch error:', e);
        }
      }
      return {
        success: false,
        error: `Failed to switch to ${targetBranch}: ${switchError}. Make sure you have no uncommitted changes that conflict.`,
      };
    }

    // Attempt merge
    console.log('[WorktreeService] Attempting merge of branch:', branchName);
    try {
      await invoke('git_merge_branch', {
        branchName,
        rootPath: task.projectPath,
      });

      // Merge successful
      console.log('[WorktreeService] Merge successful');

      // Cleanup if configured
      if (cfg.cleanupOnMerge && task.worktreePath) {
        console.log('[WorktreeService] Cleaning up worktree...');
        await cleanupWorktree(task, cfg.deleteBranchOnMerge);
      }

      // Restore stashed changes if we stashed
      if (didStash) {
        console.log('[WorktreeService] Restoring stashed changes...');
        try {
          await invoke('git_stash_pop', { rootPath: task.projectPath });
        } catch (popError) {
          console.warn('[WorktreeService] Failed to pop stash (might have conflicts):', popError);
        }
      }

      return {
        success: true,
        strategy: 'merge-commit',
      };
    } catch (mergeError: unknown) {
      // Check if it's a conflict
      const errorStr = String(mergeError);
      console.error('[WorktreeService] Merge error:', errorStr);

      if (errorStr.includes('conflict') || errorStr.includes('CONFLICT')) {
        // Get conflicted files
        const conflictedFiles = await getConflictedFiles(task.projectPath);

        return {
          success: false,
          hasConflicts: true,
          conflictedFiles,
          error: 'Merge conflicts detected. Please resolve them manually.',
        };
      }

      // For other errors, try to restore stash
      if (didStash) {
        try {
          await invoke('git_stash_pop', { rootPath: task.projectPath });
        } catch (e) {
          console.warn('[WorktreeService] Failed to pop stash after merge error:', e);
        }
      }

      throw mergeError;
    }
  } catch (error) {
    console.error('[WorktreeService] Merge failed:', error);
    return {
      success: false,
      error: `Merge failed: ${error}`,
    };
  }
}

/**
 * Get list of conflicted files after a merge
 */
async function getConflictedFiles(projectPath: string): Promise<string[]> {
  try {
    const status = await invoke<{ entries: Array<{ path: string; staged_status: string | null; unstaged_status: string | null }> }>('git_status', {
      path: projectPath,
    });

    // Files with 'U' (unmerged) status are in conflict
    return status.entries
      .filter(entry =>
        entry.staged_status === 'U' ||
        entry.unstaged_status === 'U' ||
        (entry.staged_status && entry.unstaged_status)
      )
      .map(entry => entry.path);
  } catch (error) {
    console.error('[WorktreeService] Failed to get conflicted files:', error);
    return [];
  }
}

/**
 * Abort an in-progress merge
 */
async function abortMerge(projectPath: string): Promise<void> {
  try {
    await invoke('git_merge_abort', {
      rootPath: projectPath,
    });
    console.log('[WorktreeService] Merge aborted');
  } catch (error) {
    console.error('[WorktreeService] Failed to abort merge:', error);
    throw error;
  }
}

/**
 * Resolve conflicts by keeping one side
 */
async function resolveConflicts(
  projectPath: string,
  strategy: 'ours' | 'theirs'
): Promise<void> {
  try {
    await invoke('git_resolve_conflicts', {
      strategy,
      rootPath: projectPath,
    });
    console.log('[WorktreeService] Conflicts resolved with strategy:', strategy);
  } catch (error) {
    console.error('[WorktreeService] Failed to resolve conflicts:', error);
    throw error;
  }
}

// Export service object for convenience
const worktreeService = {
  generateBranchName,
  generateWorktreePath,
  listWorktrees,
  worktreeExists,
  ensureWorktree,
  cleanupWorktree,
  hasUncommittedChanges,
  mergeAndCleanup,
  abortMerge,
  resolveConflicts,
};

