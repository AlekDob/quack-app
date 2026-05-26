import { useState, useEffect, useCallback } from 'react'
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
import { useChangesPanelState } from '../hooks/useChangesPanelState'
import type { FileStatus, GitCommitEntry, GitBranch, GitWorktree, GitRemote } from '../types'
import './ChangesPanel.css'

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
    rootPath, modifiedFiles, onRefreshGitStatus, onRemoveModifiedFiles, lastRefreshTs,
  })

  const pendingCount = unstagedEntries.length + stagedEntries.length

  // Lazy-load counts for badge display
  const loadCounts = useCallback(async () => {
    if (!rootPath) return
    try {
      const [branches, worktrees, remotes] = await Promise.all([
        invoke<GitBranch[]>('git_list_branches', { rootPath }),
        invoke<GitWorktree[]>('git_list_worktrees', { rootPath }),
        invoke<GitRemote[]>('git_list_remotes', { rootPath }),
      ])
      setBranchCount(branches.length)
      setWorktreeCount(worktrees.length)
      setRemoteCount(remotes.length)
    } catch { /* counts stay at 0 */ }
  }, [rootPath])

  useEffect(() => { loadCounts() }, [loadCounts, lastRefreshTs])

  function handleBranchSwitch(_branchName: string) {
    onRefreshGitStatus()
    loadCounts()
  }

  return (
    <div className="changes-panel">
      <ChangesPanelContextBar branch={branch} isWorktree={isWorktree} projectName={projectName} />

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
          rootPath={rootPath}
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
      {activeTab === 'committed' && (
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
      {activeTab === 'history' && (
        <HistoryTab
          history={history}
          historyLoading={historyLoading}
          currentBranch={branch ?? undefined}
        />
      )}
      {activeTab === 'branches' && (
        <BranchesTab rootPath={rootPath} currentBranch={branch} onBranchSwitch={handleBranchSwitch} />
      )}
      {activeTab === 'worktrees' && (
        <WorktreesTab rootPath={rootPath} />
      )}
      {activeTab === 'remotes' && (
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
