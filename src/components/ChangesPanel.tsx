import { useState, useEffect, useCallback, useMemo } from 'react'
import { invoke } from '@tauri-apps/api/core'
import CommitModal from './CommitModal'
import { ConfirmModal } from './ConfirmModal'
import PendingTab from './PendingTab'
import CommittedTab from './CommittedTab'
import HistoryTab from './HistoryTab'
import BranchesTab from './BranchesTab'
import WorktreesTab from './WorktreesTab'
import RemotesTab from './RemotesTab'
import ChangesPanelContextBar from './ChangesPanelContextBar'
import ChangesPanelTabs, { type ActiveTab } from './ChangesPanelTabs'
import SubReposSection from './SubReposSection'
import { useChangesPanelState } from '../hooks/useChangesPanelState'
import type { FileStatus, GitCommitEntry, GitBranch, GitWorktree, GitRemote, SubRepoStatus } from '../types'
import './ChangesPanel.css'

const EMPTY_FILES: Map<string, FileStatus> = new Map()

interface ChangesPanelProps {
  rootPath: string | null
  modifiedFiles: Map<string, FileStatus>
  onRefreshGitStatus: () => void
  onClearModifiedFiles?: () => void
  onRemoveModifiedFiles?: (paths: string[]) => void
  onOpenInEditor?: (filePath: string) => void
  onOpenDiff?: (filePath: string, status: FileStatus) => void
  branch?: string | null
  isWorktree?: boolean
  projectName?: string | null
  history?: GitCommitEntry[]
  historyLoading?: boolean
  lastRefreshTs?: number
}

export default function ChangesPanel({
  rootPath, modifiedFiles, onRefreshGitStatus, onRemoveModifiedFiles,
  onOpenInEditor, onOpenDiff, branch, isWorktree, projectName,
  history, historyLoading, lastRefreshTs,
}: ChangesPanelProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('pending')
  const [branchCount, setBranchCount] = useState(0)
  const [worktreeCount, setWorktreeCount] = useState(0)
  const [remoteCount, setRemoteCount] = useState(0)
  const [subRepoOverride, setSubRepoOverride] = useState<SubRepoStatus | null>(null)

  // Effective context: when override active, all queries use the sub-repo path.
  // Brain: feature-071-changes-panel-subrepos
  const effectiveRootPath = subRepoOverride?.path ?? rootPath
  const effectiveFiles = subRepoOverride ? EMPTY_FILES : modifiedFiles
  const effectiveBranch = subRepoOverride ? subRepoOverride.branch : branch
  const effectiveProjectName = subRepoOverride ? subRepoOverride.name : projectName

  // Force pending tab when override is active (other tabs not scoped to sub-repo)
  useEffect(() => {
    if (subRepoOverride && activeTab !== 'pending') {
      setActiveTab('pending')
    }
  }, [subRepoOverride, activeTab])

  const parentLabel = useMemo(() => projectName ?? 'project', [projectName])

  const {
    expandedFiles, diffCache,
    fileToDelete, setFileToDelete,
    showCommitModal, setShowCommitModal,
    commitTitle, setCommitTitle,
    commitDesc, setCommitDesc,
    committing,
    committedEntries,
    unstagedEntries, stagedEntries,
    toggleFile, toggleGitFile,
    handleStageRel, handleUnstageRel, handleDiscardGitEntry,
    confirmDeleteFile, handleAcceptAll, handleCommit, handleClearCommitted,
  } = useChangesPanelState({
    rootPath: effectiveRootPath,
    modifiedFiles: effectiveFiles,
    onRefreshGitStatus,
    onRemoveModifiedFiles: subRepoOverride ? undefined : onRemoveModifiedFiles,
    lastRefreshTs,
  })

  const pendingCount = unstagedEntries.length + stagedEntries.length

  // Lazy-load counts for badge display
  const loadCounts = useCallback(async () => {
    if (!effectiveRootPath) return
    try {
      const [branches, worktrees, remotes] = await Promise.all([
        invoke<GitBranch[]>('git_list_branches', { rootPath: effectiveRootPath }),
        invoke<GitWorktree[]>('git_list_worktrees', { rootPath: effectiveRootPath }),
        invoke<GitRemote[]>('git_list_remotes', { rootPath: effectiveRootPath }),
      ])
      setBranchCount(branches.length)
      setWorktreeCount(worktrees.length)
      setRemoteCount(remotes.length)
    } catch { /* counts stay at 0 */ }
  }, [effectiveRootPath])

  useEffect(() => { loadCounts() }, [loadCounts, lastRefreshTs])

  function handleBranchSwitch(_branchName: string) {
    onRefreshGitStatus()
    loadCounts()
  }

  return (
    <div className="changes-panel">
      <ChangesPanelContextBar branch={effectiveBranch} isWorktree={isWorktree && !subRepoOverride} projectName={effectiveProjectName} />

      {subRepoOverride && (
        <div className="subrepo-breadcrumb">
          <button
            type="button"
            className="subrepo-breadcrumb-back"
            onClick={() => setSubRepoOverride(null)}
            title="Back to parent project"
          >
            ← Back
          </button>
          <span className="subrepo-breadcrumb-trail">
            {parentLabel} ›
          </span>
          <span className="subrepo-breadcrumb-current">{subRepoOverride.name}</span>
        </div>
      )}

      {!subRepoOverride && (
        <SubReposSection
          rootPath={rootPath}
          refreshTs={lastRefreshTs}
          onSelect={setSubRepoOverride}
        />
      )}

      <ChangesPanelTabs
        activeTab={activeTab}
        pendingCount={pendingCount}
        committedCount={committedEntries.length}
        history={history}
        branchCount={branchCount}
        worktreeCount={worktreeCount}
        remoteCount={remoteCount}
        onTabChange={setActiveTab}
      />

      {activeTab === 'pending' && (
        <PendingTab
          rootPath={effectiveRootPath}
          unstagedEntries={unstagedEntries}
          stagedEntries={stagedEntries}
          expandedFiles={expandedFiles}
          diffCache={diffCache}
          onToggleGitFile={toggleGitFile}
          onStageRel={handleStageRel}
          onUnstageRel={handleUnstageRel}
          onDiscardGitEntry={handleDiscardGitEntry}
          onAcceptAll={handleAcceptAll}
          onOpenCommitModal={() => setShowCommitModal(true)}
          onOpenInEditor={onOpenInEditor}
          onOpenDiff={onOpenDiff}
        />
      )}
      {activeTab === 'committed' && !subRepoOverride && (
        <CommittedTab
          rootPath={rootPath}
          committedEntries={committedEntries}
          expandedFiles={expandedFiles}
          diffCache={diffCache}
          onClearCommitted={handleClearCommitted}
          onToggleFile={toggleFile}
          onOpenInEditor={onOpenInEditor}
        />
      )}
      {activeTab === 'history' && !subRepoOverride && (
        <HistoryTab
          history={history}
          historyLoading={historyLoading}
          currentBranch={branch ?? undefined}
        />
      )}
      {activeTab === 'branches' && !subRepoOverride && (
        <BranchesTab rootPath={rootPath} currentBranch={branch} onBranchSwitch={handleBranchSwitch} />
      )}
      {activeTab === 'worktrees' && !subRepoOverride && (
        <WorktreesTab rootPath={rootPath} />
      )}
      {activeTab === 'remotes' && !subRepoOverride && (
        <RemotesTab rootPath={rootPath} />
      )}

      {showCommitModal && (
        <CommitModal
          fileCount={pendingCount}
          commitTitle={commitTitle}
          commitDesc={commitDesc}
          committing={committing}
          onTitleChange={setCommitTitle}
          onDescChange={setCommitDesc}
          onCommit={handleCommit}
          onClose={() => setShowCommitModal(false)}
        />
      )}

      <ConfirmModal
        isOpen={fileToDelete !== null}
        title="Delete file"
        message={`Are you sure you want to delete "${fileToDelete?.split('/').pop()}"? This file was created in this session and will be permanently removed.`}
        confirmLabel="Delete"
        onConfirm={confirmDeleteFile}
        onCancel={() => setFileToDelete(null)}
      />
    </div>
  )
}
