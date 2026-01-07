import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useKanbanStore } from '../stores/kanbanStore';

export interface GitStatusData {
  branch: string;
  ahead: number;
  behind: number;
  dirty: boolean;
  files: Array<{ path: string; status: string; staged: boolean }>;
  stagedCount: number;
  unstagedCount: number;
}

export interface GitCommit {
  hash: string;
  message: string;
  author: string;
  timestamp: number;
}

export interface GitWorktree {
  path: string;
  branch: string;
  isCurrent: boolean;
}

export interface ProjectDashboardData {
  gitStatus: GitStatusData | null;
  commits: GitCommit[];
  worktrees: GitWorktree[];
  todoCount: number;
  inProgressCount: number;
  doneCount: number;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook to fetch project dashboard data
 * Aggregates git status, commits, worktrees, and kanban tasks for a project
 */
export function useProjectDashboard(projectPath: string): ProjectDashboardData {
  const [gitStatus, setGitStatus] = useState<GitStatusData | null>(null);
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [worktrees, setWorktrees] = useState<GitWorktree[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { tasks } = useKanbanStore();

  // Filter tasks by project path
  const projectTasks = tasks.filter((task) => task.projectPath === projectPath);
  const todoCount = projectTasks.filter((task) => task.status === 'todo').length;
  const inProgressCount = projectTasks.filter((task) => task.status === 'in_progress').length;
  const doneCount = projectTasks.filter((task) => task.status === 'done').length;

  useEffect(() => {
    let mounted = true;

    async function fetchProjectData() {
      setIsLoading(true);
      setError(null);

      // Minimum loading time for better UX (prevents flash)
      const loadingStartTime = Date.now();
      const MIN_LOADING_TIME = 400;

      try {
        // Fetch git status using correct Tauri command name
        const status = await invoke<{
          branch: string;
          upstream: string | null;
          ahead: number | null;
          behind: number | null;
          entries: Array<{ path: string; stagedStatus: string | null; unstagedStatus: string | null }>;
          clean: boolean;
        }>('git_status_summary', { rootPath: projectPath });

        if (mounted) {
          // Count staged and unstaged files
          const stagedFiles = status.entries.filter(e => e.stagedStatus !== null);
          const unstagedFiles = status.entries.filter(e => e.unstagedStatus !== null && e.stagedStatus === null);

          setGitStatus({
            branch: status.branch,
            ahead: status.ahead ?? 0,
            behind: status.behind ?? 0,
            dirty: !status.clean,
            files: status.entries.map(e => ({
              path: e.path,
              status: e.stagedStatus || e.unstagedStatus || 'U',
              staged: e.stagedStatus !== null
            })),
            stagedCount: stagedFiles.length,
            unstagedCount: unstagedFiles.length + status.entries.filter(e => e.unstagedStatus !== null && e.stagedStatus !== null).length
          });
        }

        // Fetch recent commits using correct Tauri command name
        const commitLog = await invoke<Array<{
          hash: string;
          summary: string;
          author: string;
          timestamp: number | null;
          relativeTime: string;
        }>>('git_commit_history', {
          rootPath: projectPath,
          limit: 10,
        });

        if (mounted) {
          // Map the Tauri response to our GitCommit interface
          setCommits(commitLog.map(c => ({
            hash: c.hash,
            message: c.summary,
            author: c.author,
            timestamp: c.timestamp ?? 0,
          })));
        }

        // Fetch worktrees
        try {
          const worktreeList = await invoke<Array<{
            path: string;
            branch: string;
            commitHash: string;
            isBare: boolean;
            isDetached: boolean;
          }>>('git_list_worktrees', {
            rootPath: projectPath,
          });

          if (mounted) {
            // Map to our GitWorktree interface
            setWorktrees(worktreeList.map(wt => ({
              path: wt.path,
              branch: wt.branch,
              isCurrent: false, // Can't determine from this data
            })));
          }
        } catch (err) {
          // Worktrees might not be available, ignore error
          console.log('[useProjectDashboard] No worktrees found:', err);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load project data');
          console.error('[useProjectDashboard] Error fetching data:', err);
        }
      } finally {
        if (mounted) {
          // Ensure minimum loading time for smooth UX
          const elapsed = Date.now() - loadingStartTime;
          if (elapsed < MIN_LOADING_TIME) {
            await new Promise(resolve => setTimeout(resolve, MIN_LOADING_TIME - elapsed));
          }
          setIsLoading(false);
        }
      }
    }

    fetchProjectData();

    return () => {
      mounted = false;
    };
  }, [projectPath]);

  return {
    gitStatus,
    commits,
    worktrees,
    todoCount,
    inProgressCount,
    doneCount,
    isLoading,
    error,
  };
}
