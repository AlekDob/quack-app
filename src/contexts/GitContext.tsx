import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import type {
  GitStatusSummary,
  GitStatusEntry,
  GitCommitEntry,
} from '../types';

interface GitContextValue {
  // Git state
  gitSummary: GitStatusSummary | null;
  loadingGit: boolean;
  gitError: string | null;
  selectedGitPath: string | null;

  // Diff state
  diffContent: string;
  diffLoading: boolean;
  diffError: string | null;
  diffView: 'worktree' | 'staged';

  // Commit state
  commitMessage: string;
  committing: boolean;
  commitHistory: GitCommitEntry[];
  historyError: string | null;

  // Refresh trigger
  gitRefreshTrigger: number;

  // Actions
  loadGitStatus: (path: string) => Promise<void>;
  loadDiff: (path: string, staged: boolean) => Promise<void>;
  stageFile: (path: string) => Promise<void>;
  unstageFile: (path: string) => Promise<void>;
  stageAll: () => Promise<void>;
  unstageAll: () => Promise<void>;
  commit: (message: string) => Promise<void>;
  loadCommitHistory: (path: string) => Promise<void>;
  refreshGit: () => void;

  // Setters
  setSelectedGitPath: (path: string | null) => void;
  setDiffView: (view: 'worktree' | 'staged') => void;
  setCommitMessage: (message: string) => void;

  // Utilities
  getFileStatus: (path: string) => GitStatusEntry | undefined;
  hasStagedFiles: () => boolean;
  hasUnstagedChanges: () => boolean;
  isClean: () => boolean;
}

const GitContext = createContext<GitContextValue | null>(null);

export const GitProvider = ({ children }: { children: React.ReactNode }) => {
  const [gitSummary, setGitSummary] = useState<GitStatusSummary | null>(null);
  const [loadingGit, setLoadingGit] = useState(false);
  const [gitError, setGitError] = useState<string | null>(null);
  const [selectedGitPath, setSelectedGitPath] = useState<string | null>(null);

  const [diffContent, setDiffContent] = useState('');
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);
  const [diffView, setDiffView] = useState<'worktree' | 'staged'>('worktree');

  const [commitMessage, setCommitMessage] = useState('');
  const [committing, setCommitting] = useState(false);
  const [commitHistory, setCommitHistory] = useState<GitCommitEntry[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [gitRefreshTrigger, setGitRefreshTrigger] = useState(0);

  // Load Git status
  const loadGitStatus = useCallback(async (path: string) => {
    if (loadingGit) return;

    setLoadingGit(true);
    setGitError(null);

    try {
      const status = await invoke<GitStatusSummary>('git_status', { path });
      setGitSummary(status);

      // Auto-select first file with changes
      if (status.entries.length > 0 && !selectedGitPath) {
        const firstChangedFile = status.entries[0];
        setSelectedGitPath(firstChangedFile.path);
      }
    } catch (error) {
      console.error('Failed to load Git status:', error);
      setGitError(String(error));
      setGitSummary(null);
    } finally {
      setLoadingGit(false);
    }
  }, [loadingGit, selectedGitPath]);

  // Load diff for a file
  const loadDiff = useCallback(async (path: string, staged: boolean) => {
    if (!gitSummary) return;

    setDiffLoading(true);
    setDiffError(null);

    try {
      const cwd = gitSummary.entries.length > 0
        ? gitSummary.entries[0].path.substring(0, gitSummary.entries[0].path.lastIndexOf('/')) || '.'
        : '.';

      const diff = await invoke<string>('git_diff_file', {
        path: cwd,
        filePath: path,
        staged,
      });

      setDiffContent(diff || '');
    } catch (error) {
      console.error('Failed to load diff:', error);
      setDiffError(String(error));
      setDiffContent('');
    } finally {
      setDiffLoading(false);
    }
  }, [gitSummary]);

  // Stage a file
  const stageFile = useCallback(async (path: string) => {
    if (!gitSummary) return;

    try {
      const cwd = gitSummary.entries.length > 0
        ? gitSummary.entries[0].path.substring(0, gitSummary.entries[0].path.lastIndexOf('/')) || '.'
        : '.';

      await invoke('git_stage_file', { path: cwd, filePath: path });
      toast.success('File staged');
      setGitRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Failed to stage file:', error);
      toast.error(`Failed to stage file: ${error}`);
    }
  }, [gitSummary]);

  // Unstage a file
  const unstageFile = useCallback(async (path: string) => {
    if (!gitSummary) return;

    try {
      const cwd = gitSummary.entries.length > 0
        ? gitSummary.entries[0].path.substring(0, gitSummary.entries[0].path.lastIndexOf('/')) || '.'
        : '.';

      await invoke('git_unstage_file', { path: cwd, filePath: path });
      toast.success('File unstaged');
      setGitRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Failed to unstage file:', error);
      toast.error(`Failed to unstage file: ${error}`);
    }
  }, [gitSummary]);

  // Stage all files
  const stageAll = useCallback(async () => {
    if (!gitSummary || gitSummary.entries.length === 0) return;

    try {
      const cwd = gitSummary.entries[0].path.substring(0, gitSummary.entries[0].path.lastIndexOf('/')) || '.';
      await invoke('git_stage_all', { path: cwd });
      toast.success('All files staged');
      setGitRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Failed to stage all files:', error);
      toast.error(`Failed to stage all files: ${error}`);
    }
  }, [gitSummary]);

  // Unstage all files
  const unstageAll = useCallback(async () => {
    if (!gitSummary || gitSummary.entries.length === 0) return;

    try {
      const cwd = gitSummary.entries[0].path.substring(0, gitSummary.entries[0].path.lastIndexOf('/')) || '.';
      await invoke('git_unstage_all', { path: cwd });
      toast.success('All files unstaged');
      setGitRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Failed to unstage all files:', error);
      toast.error(`Failed to unstage all files: ${error}`);
    }
  }, [gitSummary]);

  // Commit changes
  const commit = useCallback(async (message: string) => {
    if (!gitSummary || !message.trim()) return;

    setCommitting(true);

    try {
      const cwd = gitSummary.entries.length > 0
        ? gitSummary.entries[0].path.substring(0, gitSummary.entries[0].path.lastIndexOf('/')) || '.'
        : '.';

      await invoke('git_commit', { path: cwd, message: message.trim() });
      toast.success('Changes committed');
      setCommitMessage('');
      setGitRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Failed to commit:', error);
      toast.error(`Failed to commit: ${error}`);
    } finally {
      setCommitting(false);
    }
  }, [gitSummary]);

  // Load commit history
  const loadCommitHistory = useCallback(async (path: string) => {
    setHistoryError(null);

    try {
      const history = await invoke<GitCommitEntry[]>('git_log', { path, limit: 50 });
      setCommitHistory(history);
    } catch (error) {
      console.error('Failed to load commit history:', error);
      setHistoryError(String(error));
      setCommitHistory([]);
    }
  }, []);

  // Refresh Git status
  const refreshGit = useCallback(() => {
    setGitRefreshTrigger(prev => prev + 1);
  }, []);

  // Utilities
  const getFileStatus = useCallback((path: string): GitStatusEntry | undefined => {
    return gitSummary?.entries.find(entry => entry.path === path);
  }, [gitSummary]);

  const hasStagedFiles = useCallback((): boolean => {
    return gitSummary?.entries.some(entry => entry.staged_status !== null) || false;
  }, [gitSummary]);

  const hasUnstagedChanges = useCallback((): boolean => {
    return gitSummary?.entries.some(entry => entry.unstaged_status !== null || entry.is_untracked) || false;
  }, [gitSummary]);

  const isClean = useCallback((): boolean => {
    return gitSummary?.clean || false;
  }, [gitSummary]);

  // Auto-load diff when selected path changes
  useEffect(() => {
    if (selectedGitPath && gitSummary) {
      loadDiff(selectedGitPath, diffView === 'staged');
    }
  }, [selectedGitPath, diffView, gitSummary, loadDiff]);

  // Auto-refresh Git status on trigger change
  useEffect(() => {
    if (gitRefreshTrigger > 0 && gitSummary) {
      const cwd = gitSummary.entries.length > 0
        ? gitSummary.entries[0].path.substring(0, gitSummary.entries[0].path.lastIndexOf('/')) || '.'
        : '.';
      loadGitStatus(cwd);
    }
  }, [gitRefreshTrigger, gitSummary, loadGitStatus]);

  const value: GitContextValue = {
    gitSummary,
    loadingGit,
    gitError,
    selectedGitPath,
    diffContent,
    diffLoading,
    diffError,
    diffView,
    commitMessage,
    committing,
    commitHistory,
    historyError,
    gitRefreshTrigger,
    loadGitStatus,
    loadDiff,
    stageFile,
    unstageFile,
    stageAll,
    unstageAll,
    commit,
    loadCommitHistory,
    refreshGit,
    setSelectedGitPath,
    setDiffView,
    setCommitMessage,
    getFileStatus,
    hasStagedFiles,
    hasUnstagedChanges,
    isClean,
  };

  return (
    <GitContext.Provider value={value}>
      {children}
    </GitContext.Provider>
  );
};

const useGit = () => {
  const context = useContext(GitContext);
  if (!context) {
    throw new Error('useGit must be used within GitProvider');
  }
  return context;
};