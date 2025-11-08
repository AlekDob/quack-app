import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { GitStatusSummary, GitCommitEntry } from '../types';

interface GitState {
  // Git status
  gitSummary: GitStatusSummary | null;
  selectedGitPath: string | null;
  diffContent: string;
  diffView: 'worktree' | 'staged';
  commitMessage: string;
  commitHistory: GitCommitEntry[];
  loadingGit: boolean;
  diffLoading: boolean;
  committing: boolean;
  gitError: string | null;

  // Staging area
  stagedFiles: Set<string>;
  expandedGroups: Set<string>;

  // Actions - Git status
  setGitSummary: (summary: GitStatusSummary | null) => void;
  setSelectedGitPath: (path: string | null) => void;
  setDiffContent: (content: string) => void;
  setDiffView: (view: 'worktree' | 'staged') => void;
  setCommitMessage: (message: string) => void;
  setCommitHistory: (history: GitCommitEntry[]) => void;
  setLoadingGit: (loading: boolean) => void;
  setDiffLoading: (loading: boolean) => void;
  setCommitting: (committing: boolean) => void;
  setGitError: (error: string | null) => void;
  clearGitState: () => void;

  // Actions - Staging
  addStagedFile: (file: string) => void;
  removeStagedFile: (file: string) => void;
  toggleStagedFile: (file: string) => void;
  clearStagedFiles: () => void;
  setStagedFiles: (files: string[]) => void;

  // Actions - Groups
  expandGroup: (group: string) => void;
  collapseGroup: (group: string) => void;
  toggleGroup: (group: string) => void;

  // Selectors
  isFileStaged: (file: string) => boolean;
  isGroupExpanded: (group: string) => boolean;
  getStagedCount: () => number;
  getUnstagedCount: () => number;
  canCommit: () => boolean;
  hasChanges: () => boolean;
  getStagedFiles: () => string[];
  getUnstagedFiles: () => string[];
  getUntrackedFiles: () => string[];
}

export const useGitStore = create<GitState>()(
  devtools((set, get) => ({
    // Initial state
    gitSummary: null,
    selectedGitPath: null,
    diffContent: '',
    diffView: 'worktree',
    commitMessage: '',
    commitHistory: [],
    loadingGit: false,
    diffLoading: false,
    committing: false,
    gitError: null,
    stagedFiles: new Set(),
    expandedGroups: new Set(['staged', 'unstaged', 'untracked']),

    // Git status actions
    setGitSummary: (summary) => {
      set({ gitSummary: summary });
      // Update staged files based on summary
      if (summary) {
        const staged = new Set<string>();
        summary.entries.forEach(entry => {
          if (entry.staged_status) {
            staged.add(entry.path);
          }
        });
        set({ stagedFiles: staged });
      }
    },

    setSelectedGitPath: (path) => set({ selectedGitPath: path }),

    setDiffContent: (content) => set({ diffContent: content }),

    setDiffView: (view) => set({ diffView: view }),

    setCommitMessage: (message) => set({ commitMessage: message }),

    setCommitHistory: (history) => set({ commitHistory: history }),

    setLoadingGit: (loading) => set({ loadingGit: loading }),

    setDiffLoading: (loading) => set({ diffLoading: loading }),

    setCommitting: (committing) => set({ committing: committing }),

    setGitError: (error) => set({ gitError: error }),

    clearGitState: () => set({
      gitSummary: null,
      selectedGitPath: null,
      diffContent: '',
      commitMessage: '',
      commitHistory: [],
      loadingGit: false,
      diffLoading: false,
      committing: false,
      gitError: null,
      stagedFiles: new Set(),
    }),

    // Staging actions
    addStagedFile: (file) => set((state) => {
      const newStaged = new Set(state.stagedFiles);
      newStaged.add(file);
      return { stagedFiles: newStaged };
    }),

    removeStagedFile: (file) => set((state) => {
      const newStaged = new Set(state.stagedFiles);
      newStaged.delete(file);
      return { stagedFiles: newStaged };
    }),

    toggleStagedFile: (file) => {
      const state = get();
      if (state.stagedFiles.has(file)) {
        state.removeStagedFile(file);
      } else {
        state.addStagedFile(file);
      }
    },

    clearStagedFiles: () => set({ stagedFiles: new Set() }),

    setStagedFiles: (files) => set({ stagedFiles: new Set(files) }),

    // Group actions
    expandGroup: (group) => set((state) => {
      const newExpanded = new Set(state.expandedGroups);
      newExpanded.add(group);
      return { expandedGroups: newExpanded };
    }),

    collapseGroup: (group) => set((state) => {
      const newExpanded = new Set(state.expandedGroups);
      newExpanded.delete(group);
      return { expandedGroups: newExpanded };
    }),

    toggleGroup: (group) => {
      const state = get();
      if (state.expandedGroups.has(group)) {
        state.collapseGroup(group);
      } else {
        state.expandGroup(group);
      }
    },

    // Selectors
    isFileStaged: (file) => {
      const state = get();
      return state.stagedFiles.has(file);
    },

    isGroupExpanded: (group) => {
      const state = get();
      return state.expandedGroups.has(group);
    },

    getStagedCount: () => {
      const state = get();
      if (!state.gitSummary) return 0;
      return state.gitSummary.entries.filter(e => e.staged_status !== null).length;
    },

    getUnstagedCount: () => {
      const state = get();
      const summary = state.gitSummary;
      if (!summary) return 0;
      return summary.entries.filter(e => e.unstaged_status !== null || e.is_untracked).length;
    },

    canCommit: () => {
      const state = get();
      return (
        state.commitMessage.trim().length > 0 &&
        state.stagedFiles.size > 0 &&
        !state.committing
      );
    },

    hasChanges: () => {
      const state = get();
      const summary = state.gitSummary;
      if (!summary) return false;
      return summary.entries.length > 0 && !summary.clean;
    },

    getStagedFiles: () => {
      const state = get();
      if (!state.gitSummary) return [];
      return state.gitSummary.entries
        .filter(e => e.staged_status !== null)
        .map(e => e.path);
    },

    getUnstagedFiles: () => {
      const state = get();
      if (!state.gitSummary) return [];
      return state.gitSummary.entries
        .filter(e => e.unstaged_status !== null && !e.is_untracked)
        .map(e => e.path);
    },

    getUntrackedFiles: () => {
      const state = get();
      if (!state.gitSummary) return [];
      return state.gitSummary.entries
        .filter(e => e.is_untracked)
        .map(e => e.path);
    },
  }), { name: 'git-store' })
);