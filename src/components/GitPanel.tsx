import { useMemo, useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'

import GitSidebar from './GitSidebar'
import GitFilesColumn from './GitFilesColumn'
import type { GitBranch, GitCommitEntry, GitStatusEntry, GitStatusSummary, GitPullResult, TerminalInfo, GitWorktree } from '../types'

interface GitPanelProps {
  summary: GitStatusSummary | null
  loading: boolean
  error: string | null
  history: GitCommitEntry[]
  historyLoading: boolean
  historyError: string | null
  selected: GitStatusEntry | null
  onRefresh: () => void
  onSelect: (entry: GitStatusEntry) => void
  onStageAll: () => void
  onOpenFile: (path: string) => void
  commitMessage: string
  onCommitMessageChange: (message: string) => void
  onCommit: () => void
  committing: boolean
  onGenerateCommitMessage: () => Promise<void>
  rootPath: string | null
  terminals: TerminalInfo[]
  onBranchSwitch?: (branchName: string) => void
  onOpenWorktree?: (worktreePath: string) => void
}

const TIMELINE_LINE_LEFT = 20
const TIMELINE_LINE_COLOR = 'rgba(232, 125, 62, 0.32)'
// const TIMELINE_DOT_COLOR = '#e87d3e' // Kept for potential future use

const GitTimelineItem = ({
  entry,
  lineLeft,
  isLast,
}: {
  entry: GitCommitEntry
  lineLeft: number
  isLast: boolean
}) => {
  const formattedDate = entry.timestamp
    ? new Date(entry.timestamp * 1000).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  // Generate initials from author name
  const getAuthorInitials = (author: string): string => {
    const parts = author.trim().split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return author.slice(0, 2).toUpperCase()
  }

  // Generate color from author name (deterministic)
  const getAuthorColor = (author: string): string => {
    const colors = [
      '#f87171', // red
      '#fb923c', // orange
      '#fbbf24', // yellow
      '#a3e635', // lime
      '#34d399', // emerald
      '#22d3ee', // cyan
      '#60a5fa', // blue
      '#a78bfa', // violet
      '#f472b6', // pink
    ]
    let hash = 0
    for (let i = 0; i < author.length; i++) {
      hash = author.charCodeAt(i) + ((hash << 5) - hash)
    }
    return colors[Math.abs(hash) % colors.length]
  }

  const initials = getAuthorInitials(entry.author)
  const avatarColor = getAuthorColor(entry.author)

  return (
    <div
      style={{
        position: 'relative',
        paddingLeft: `${lineLeft + 28}px`,
        paddingBottom: isLast ? 0 : '1.2rem',
      }}
    >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: `${lineLeft}px`,
            top: 0,
            bottom: 0,
            width: '2px',
            background: TIMELINE_LINE_COLOR,
            transform: 'translateX(-50%)',
            zIndex: 0,
          }}
        />
      {/* Avatar con iniziali invece del pallino */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: `${lineLeft}px`,
          top: '0.1rem',
          width: '24px',
          height: '24px',
          borderRadius: '999px',
          background: avatarColor,
          border: '2px solid rgba(15, 17, 26, 1)',
          boxShadow: `0 0 0 2px ${avatarColor}30`,
          transform: 'translate(-50%, 0)',
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.6rem',
          fontWeight: 600,
          color: '#000',
        }}
      >
        {initials}
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.2rem',
        }}
      >
        <span
          style={{
            fontSize: '0.78rem',
            color: '#f1f2f5',
          }}
        >
          {entry.summary}
        </span>
        <span
          style={{
            fontSize: '0.68rem',
            color: '#a8aebd',
          }}
        >
          {entry.author} • {entry.relativeTime}
        </span>
        {formattedDate && (
          <span
            style={{
              fontSize: '0.62rem',
              color: 'rgba(255, 255, 255, 0.35)',
              fontWeight: 400,
              marginTop: '0.2rem',
            }}
          >
            {formattedDate}
          </span>
        )}
      </div>
    </div>
  )
}

function GitPanel({
  summary,
  loading,
  error,
  history,
  historyLoading,
  historyError,
  selected,
  onRefresh,
  onSelect,
  onStageAll,
  onOpenFile,
  commitMessage,
  onCommitMessageChange,
  onCommit,
  committing,
  onGenerateCommitMessage,
  rootPath,
  terminals,
  onBranchSwitch,
  onOpenWorktree,
}: GitPanelProps) {
  const [pushing, setPushing] = useState(false)
  const [pulling, setPulling] = useState(false)
  const [branches, setBranches] = useState<GitBranch[]>([])
  const [worktrees, setWorktrees] = useState<GitWorktree[]>([])

  // Load branches
  useEffect(() => {
    const loadBranches = async () => {
      if (!rootPath) return
      try {
        const result = await invoke<GitBranch[]>('git_list_branches', {
          rootPath: rootPath,
        })
        setBranches(result)
      } catch (error) {
        console.error('Failed to load branches:', error)
        setBranches([])
      }
    }

    loadBranches()
  }, [rootPath, summary]) // Reload when summary changes (e.g., after branch switch)

  // Load worktrees
  useEffect(() => {
    const loadWorktrees = async () => {
      if (!rootPath) return
      try {
        const result = await invoke<GitWorktree[]>('git_list_worktrees', {
          rootPath: rootPath,
        })
        setWorktrees(result)
      } catch (error) {
        console.error('Failed to load worktrees:', error)
        setWorktrees([])
      }
    }

    loadWorktrees()
  }, [rootPath, summary]) // Reload when summary changes

  const handlePush = async () => {
    if (!rootPath || !summary?.branch) return

    setPushing(true)
    try {
      const result = await invoke<string>('git_push', {
        branchName: summary.branch,
        force: false,
        rootPath: rootPath,
      })
      console.log('Push result:', result)
      onRefresh()
    } catch (error) {
      console.error('Push failed:', error)
      alert(`Push failed: ${error}`)
    } finally {
      setPushing(false)
    }
  }

  const handlePull = async () => {
    if (!rootPath || !summary?.branch) return

    setPulling(true)
    try {
      const result = await invoke<GitPullResult>('git_pull', {
        branchName: summary.branch,
        rootPath: rootPath,
      })

      if (result.hasConflicts) {
        // TODO Phase 4: Show ConflictResolver with result.conflictedFiles
        alert(`Pull has conflicts in ${result.conflictedFiles.length} file(s):\n${result.conflictedFiles.join('\n')}`)
      } else {
        console.log('Pull result:', result.message)
      }

      onRefresh()
    } catch (error) {
      console.error('Pull failed:', error)
      alert(`Pull failed: ${error}`)
    } finally {
      setPulling(false)
    }
  }

  const handleMerge = async (sourceBranch: string, targetBranch: string) => {
    if (!rootPath) return

    try {
      // First switch to target branch
      await invoke('git_switch_branch', {
        branchName: targetBranch,
        rootPath: rootPath,
      })

      // Then merge source into target
      const result = await invoke<{
        success: boolean
        hasConflicts: boolean
        conflictedFiles: string[]
        message: string
      }>('git_merge_branch', {
        branchName: sourceBranch,
        rootPath: rootPath,
      })

      if (result.hasConflicts) {
        alert(
          `Merge has conflicts in ${result.conflictedFiles.length} file(s):\n${result.conflictedFiles.join('\n')}`
        )
      } else {
        alert(`Successfully merged '${sourceBranch}' into '${targetBranch}'`)
      }

      onRefresh()
    } catch (error) {
      console.error('Merge failed:', error)
      alert(`Merge failed: ${error}`)
    }
  }

  const handleRemoveWorktree = async (worktreePath: string, force = false) => {
    if (!rootPath) return

    try {
      await invoke('git_remove_worktree', {
        path: worktreePath,
        force: force,
        rootPath: rootPath,
      })

      // Reload worktrees
      const result = await invoke<GitWorktree[]>('git_list_worktrees', {
        rootPath: rootPath,
      })
      setWorktrees(result)

      onRefresh()
    } catch (error) {
      console.error('Failed to remove worktree:', error)
      throw error // Re-throw so GitSidebar can show error
    }
  }

  const groupedEntries = useMemo(() => {
    const entries = summary?.entries ?? []
    const staged: GitStatusEntry[] = []
    const unstaged: GitStatusEntry[] = []
    for (const entry of entries) {
      if (entry.staged_status) {
        staged.push(entry)
      }
      if (entry.unstaged_status || entry.is_untracked) {
        unstaged.push(entry)
      }
    }
    return { staged, unstaged }
  }, [summary])

  return (
    <div className="git-panel fork-style">
      <header className="git-panel-header">
        <div className="git-branch-meta">
          <span className="git-branch-label">{summary?.branch ?? '—'}</span>
          {summary?.upstream && <span className="git-upstream">↦ {summary.upstream}</span>}
          {(summary?.ahead ?? 0) > 0 && (
            <span className="git-ahead">↑ {summary?.ahead}</span>
          )}
          {(summary?.behind ?? 0) > 0 && (
            <span className="git-behind">↓ {summary?.behind}</span>
          )}
        </div>
        <div className="git-panel-actions">
          {(summary?.behind ?? 0) > 0 && (
            <button
              type="button"
              className="git-pull-button"
              onClick={handlePull}
              disabled={pulling}
            >
              {pulling ? 'Pulling…' : `Pull ↓ ${summary?.behind}`}
            </button>
          )}
          {(summary?.ahead ?? 0) > 0 && (
            <button
              type="button"
              className="git-push-button"
              onClick={handlePush}
              disabled={pushing}
            >
              {pushing ? 'Pushing…' : `Push ↑ ${summary?.ahead}`}
            </button>
          )}
          <button
            type="button"
            className="git-stage-all-button"
            onClick={onStageAll}
            disabled={loading || groupedEntries.unstaged.length === 0}
          >
            Stage All
          </button>
          <button type="button" className="git-refresh" onClick={onRefresh} disabled={loading}>
            Refresh
          </button>
        </div>
      </header>

      {error ? (
        <div className="git-panel-error">{error}</div>
      ) : (
        <div className="git-panel-body fork-layout three-column">
          {/* LEFT SIDEBAR - Branches */}
          <GitSidebar
            branches={branches}
            currentBranch={summary?.branch ?? ''}
            terminals={terminals}
            onBranchSwitch={onBranchSwitch}
            unstagedCount={groupedEntries.unstaged.length}
            onMerge={handleMerge}
            worktrees={worktrees}
            onRemoveWorktree={handleRemoveWorktree}
            onOpenWorktree={onOpenWorktree}
          />

          {/* FILES COLUMN - Unstaged/Staged */}
          <GitFilesColumn
            unstaged={groupedEntries.unstaged}
            staged={groupedEntries.staged}
            selected={selected}
            onSelect={onSelect}
            onOpenFile={onOpenFile}
          />

          {/* RIGHT - Timeline & Commit */}
          <section className="git-right-column">
            <div className="git-history-timeline">
              <header className="git-history-header">
                <h3>Timeline</h3>
                {historyLoading && <span className="git-history-status">Updating…</span>}
                {historyError && !historyLoading && (
                  <span className="git-history-error">{historyError}</span>
                )}
              </header>
              <div
                style={{
                  position: 'relative',
                  flex: 1,
                  overflowY: 'auto',
                  padding: '0.5rem 0.8rem 1rem 0',
                  minHeight: 0,
                }}
              >
                <div
                  aria-hidden
                  style={{
                    position: 'absolute',
                    left: `${TIMELINE_LINE_LEFT}px`,
                    top: 0,
                    bottom: 0,
                    width: '2px',
                    background: 'rgba(232, 125, 62, 0.3)',
                    pointerEvents: 'none',
                  }}
                />
                {historyLoading ? (
                  <div className="git-empty">Loading commits…</div>
                ) : history.length === 0 ? (
                  <div className="git-empty">No recent commits</div>
                ) : (
                  history.map((entry, index) => (
                    <GitTimelineItem
                      key={entry.hash}
                      entry={entry}
                      lineLeft={TIMELINE_LINE_LEFT}
                      isLast={index === history.length - 1}
                    />
                  ))
                )}
              </div>

              <div className="git-commit-box">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <h3 style={{ margin: 0 }}>Commit</h3>
                  <button
                    type="button"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.35rem 0.65rem',
                      background: 'rgba(139, 92, 246, 0.12)',
                      border: '1px solid rgba(139, 92, 246, 0.25)',
                      borderRadius: '5px',
                      color: '#a78bfa',
                      fontSize: '0.7rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    onClick={onGenerateCommitMessage}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(139, 92, 246, 0.18)';
                      e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(139, 92, 246, 0.12)';
                      e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.25)';
                    }}
                    disabled={groupedEntries.staged.length === 0}
                    title="Generate commit message with AI"
                  >
                    <span>✨</span>
                    <span>AI Generate</span>
                  </button>
                </div>
                <textarea
                  className="git-commit-message"
                  placeholder="Commit message"
                  value={commitMessage}
                  onChange={(event) => onCommitMessageChange(event.target.value)}
                />
                <button
                  type="button"
                  className="git-commit-button"
                  onClick={onCommit}
                  disabled={committing || commitMessage.trim().length === 0}
                >
                  {committing ? 'Committing…' : 'Commit'}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

// Performance: Memo rimosso temporaneamente per debug input
export default GitPanel
