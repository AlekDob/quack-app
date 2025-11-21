import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGitStore } from '../stores/gitStore';

describe('Git Workflow Store', () => {
  beforeEach(() => {
    // Reset store state before each test
    const gitStore = useGitStore.getState();
    gitStore.clearGitState();
  });

  afterEach(() => {
    // Optional cleanup if needed
    const gitStore = useGitStore.getState();
    gitStore.clearGitState();
  });

  it('should initialize with empty git state', () => {
    const gitStore = useGitStore.getState();

    expect(gitStore.gitSummary).toBeNull();
    expect(gitStore.stagedFiles.size).toBe(0);
    expect(gitStore.commitMessage).toBe('');
    expect(gitStore.loadingGit).toBeFalsy();
  });

  it('should add and remove staged files correctly', () => {
    const gitStore = useGitStore.getState();

    gitStore.addStagedFile('src/example.ts');
    expect(gitStore.stagedFiles.has('src/example.ts')).toBeTruthy();
    expect(gitStore.getStagedCount()).toBe(1);

    gitStore.removeStagedFile('src/example.ts');
    expect(gitStore.stagedFiles.has('src/example.ts')).toBeFalsy();
    expect(gitStore.getStagedCount()).toBe(0);
  });

  it('should toggle commit ability based on staged files and message', () => {
    const gitStore = useGitStore.getState();

    // Initially cannot commit
    expect(gitStore.canCommit()).toBeFalsy();

    gitStore.addStagedFile('src/test.ts');
    expect(gitStore.canCommit()).toBeFalsy();

    gitStore.setCommitMessage('Test commit');
    expect(gitStore.canCommit()).toBeTruthy();

    gitStore.clearStagedFiles();
    expect(gitStore.canCommit()).toBeFalsy();
  });

  it('should manage git loading states', () => {
    const gitStore = useGitStore.getState();

    gitStore.setLoadingGit(true);
    expect(gitStore.loadingGit).toBeTruthy();

    gitStore.setLoadingGit(false);
    expect(gitStore.loadingGit).toBeFalsy();
  });
});