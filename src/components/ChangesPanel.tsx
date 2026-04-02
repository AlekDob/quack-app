import { useState, useCallback, useRef, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { toast } from 'sonner'
import InlineDiffView from './InlineDiffView'
import OpenInIDEButton from './OpenInIDEButton'
import CommitModal from './CommitModal'
import { ConfirmModal } from './ConfirmModal'
import GitTimelineItem, { TIMELINE_LINE_LEFT } from './GitTimelineItem'
import type { GitCommitEntry } from '../types'
import './ChangesPanel.css'

type FileStatus = 'created' | 'modified' | 'deleted'
type ActiveTab = 'pending' | 'committed' | 'history'

interface ChangesPanelProps {
  rootPath: string | null
  modifiedFiles: Map<string, FileStatus>
  onRefreshGitStatus: () => void
  onClearModifiedFiles?: () => void
  onRemoveModifiedFiles?: (paths: string[]) => void
  onOpenInEditor?: (filePath: string) => void
  // Branch context (US1)
  branch?: string | null
  isWorktree?: boolean
  projectName?: string | null
  // History tab (US2)
  history?: GitCommitEntry[]
  historyLoading?: boolean
}

interface DiffState {
  content: string
  loading: boolean
  error: string | null
}

export default function ChangesPanel({
  rootPath,
  modifiedFiles,
  onRefreshGitStatus,
  onClearModifiedFiles,
  onRemoveModifiedFiles,
  onOpenInEditor,
  branch,
  isWorktree,
  projectName,
  history,
  historyLoading,
}: ChangesPanelProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('pending')
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set())
  const [diffCache, setDiffCache] = useState<Map<string, DiffState>>(new Map())
  const [fileToDelete, setFileToDelete] = useState<string | null>(null)
  const [showCommitModal, setShowCommitModal] = useState(false)
  const [commitTitle, setCommitTitle] = useState('')
  const [commitDesc, setCommitDesc] = useState('')
  const [committing, setCommitting] = useState(false)
  const [stagedFiles, setStagedFiles] = useState<Set<string>>(new Set())
  const [committedFiles, setCommittedFiles] = useState<Set<string>>(new Set())

  // Ref for race condition guard in loadDiff
  const expandedFilesRef = useRef(expandedFiles)
  useEffect(() => { expandedFilesRef.current = expandedFiles }, [expandedFiles])

  // Split files into pending vs committed
  const allEntries = Array.from(modifiedFiles.entries())
  const pendingEntries = allEntries.filter(([fp]) => !committedFiles.has(fp))
  const committedEntries = allEntries.filter(([fp]) => committedFiles.has(fp))

  // Window focus: reconcile modifiedFiles with actual git status
  useEffect(() => {
    const handleFocus = async () => {
      if (!rootPath || modifiedFiles.size === 0) return
      const relativePaths = Array.from(modifiedFiles.keys()).map((fp) => {
        if (rootPath && fp.startsWith(rootPath)) {
          let rel = fp.substring(rootPath.length)
          if (rel.startsWith('/')) rel = rel.substring(1)
          return rel
        }
        return fp
      })

      try {
        const stillDirty = await invoke<string[]>('git_check_files_dirty', {
          paths: relativePaths,
          rootPath,
        })
        const dirtySet = new Set(stillDirty)

        // Files no longer dirty → mark as committed
        const newCommitted = new Set(committedFiles)
        let changed = false
        for (const [fp] of modifiedFiles.entries()) {
          const rel = rootPath && fp.startsWith(rootPath)
            ? fp.substring(rootPath.length).replace(/^\//, '')
            : fp
          if (!dirtySet.has(rel) && !committedFiles.has(fp)) {
            newCommitted.add(fp)
            changed = true
          }
        }
        if (changed) {
          setCommittedFiles(newCommitted)
          onRefreshGitStatus()
        }
      } catch {
        // Silent fail — will retry on next focus
      }
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [rootPath, modifiedFiles, committedFiles, onRefreshGitStatus])

  const shortenPath = (fullPath: string): string => {
    const parts = fullPath.split('/').filter(Boolean)
    if (parts.length <= 2) return fullPath
    return '.../' + parts.slice(-2).join('/')
  }

  const getRelativePath = useCallback(
    (filePath: string): string => {
      if (rootPath && filePath.startsWith(rootPath)) {
        let rel = filePath.substring(rootPath.length)
        if (rel.startsWith('/')) rel = rel.substring(1)
        return rel
      }
      return filePath
    },
    [rootPath],
  )

  const loadDiff = useCallback(
    async (filePath: string, status: FileStatus) => {
      const relativePath = getRelativePath(filePath)
      setDiffCache((prev) => {
        const next = new Map(prev)
        next.set(filePath, { content: '', loading: true, error: null })
        return next
      })

      try {
        let content = ''
        if (status === 'created') {
          const fileContent = await invoke<string>('read_file_content', {
            path: filePath,
            rootPath,
          })
          const lines = fileContent.split('\n')
          content = `diff --git a/${relativePath} b/${relativePath}\n`
          content += `new file\n--- /dev/null\n+++ b/${relativePath}\n`
          content += `@@ -0,0 +1,${lines.length} @@\n`
          content += lines.map((l) => `+${l}`).join('\n')
        } else {
          content = await invoke<string>('git_diff', {
            path: relativePath,
            staged: false,
            untracked: true,
            rootPath,
          })
        }

        setDiffCache((prev) => {
          // Guard: skip if user collapsed the file while loading
          if (!expandedFilesRef.current.has(filePath)) return prev
          const next = new Map(prev)
          next.set(filePath, { content, loading: false, error: null })
          return next
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setDiffCache((prev) => {
          const next = new Map(prev)
          next.set(filePath, { content: '', loading: false, error: msg })
          return next
        })
      }
    },
    [rootPath, getRelativePath],
  )

  // Brain: gotcha-console-log-inside-state-updater
  const toggleFile = useCallback(
    (filePath: string, status: FileStatus) => {
      const shouldLoad = !diffCache.has(filePath) && !expandedFiles.has(filePath)
      setExpandedFiles((prev) => {
        const next = new Set(prev)
        if (next.has(filePath)) {
          next.delete(filePath)
        } else {
          next.add(filePath)
        }
        return next
      })
      if (shouldLoad) {
        loadDiff(filePath, status)
      }
    },
    [diffCache, expandedFiles, loadDiff],
  )

  const handleAccept = useCallback(
    async (filePath: string) => {
      const relativePath = getRelativePath(filePath)
      try {
        await invoke('git_stage', { path: relativePath, rootPath })
        setStagedFiles((prev) => new Set(prev).add(filePath))
        toast.success(`Staged: ${relativePath}`)
        onRefreshGitStatus()
      } catch (err) {
        console.error('[ChangesPanel] Failed to stage:', err)
        toast.error(`Failed to stage: ${err}`)
      }
    },
    [rootPath, getRelativePath, onRefreshGitStatus],
  )

  const handleReject = useCallback(
    async (filePath: string, status: FileStatus) => {
      // Brain: gotcha-window-confirm-tauri-webview
      if (status === 'created') {
        setFileToDelete(filePath)
        return
      }
      const relativePath = getRelativePath(filePath)
      try {
        await invoke('git_discard_file', {
          path: relativePath,
          isUntracked: false,
          rootPath,
        })
        setExpandedFiles((prev) => {
          const next = new Set(prev)
          next.delete(filePath)
          return next
        })
        setDiffCache((prev) => {
          const next = new Map(prev)
          next.delete(filePath)
          return next
        })
        toast.success(`Discarded: ${relativePath}`)
        onRefreshGitStatus()
      } catch (err) {
        console.error('[ChangesPanel] Failed to discard:', err)
        toast.error(`Failed to discard: ${err}`)
      }
    },
    [rootPath, getRelativePath, onRefreshGitStatus],
  )

  const confirmDeleteFile = useCallback(async () => {
    if (!fileToDelete) return
    const relativePath = getRelativePath(fileToDelete)
    try {
      await invoke('git_discard_file', {
        path: relativePath,
        isUntracked: true,
        rootPath,
      })
      setExpandedFiles((prev) => {
        const next = new Set(prev)
        next.delete(fileToDelete)
        return next
      })
      setDiffCache((prev) => {
        const next = new Map(prev)
        next.delete(fileToDelete)
        return next
      })
      toast.success(`Deleted: ${relativePath}`)
      onRefreshGitStatus()
    } catch (err) {
      console.error('[ChangesPanel] Failed to delete file:', err)
      toast.error(`Failed to delete: ${err}`)
    } finally {
      setFileToDelete(null)
    }
  }, [fileToDelete, rootPath, getRelativePath, onRefreshGitStatus])

  const handleAcceptAll = useCallback(async () => {
    try {
      await invoke('git_stage_all', { rootPath })
      setStagedFiles(new Set(pendingEntries.map(([fp]) => fp)))
      toast.success('All files staged')
      onRefreshGitStatus()
    } catch (err) {
      console.error('[ChangesPanel] Failed to stage all:', err)
      toast.error(`Failed to stage all: ${err}`)
    }
  }, [rootPath, pendingEntries, onRefreshGitStatus])

  const handleCommit = useCallback(async () => {
    if (!commitTitle.trim()) {
      toast.error('Commit title required')
      return
    }
    setCommitting(true)
    try {
      const message = commitDesc.trim()
        ? `${commitTitle.trim()}\n\n${commitDesc.trim()}`
        : commitTitle.trim()
      await invoke('git_stage_all', { rootPath })
      await invoke('git_commit', { message, rootPath })
      toast.success('Commit created!')
      setCommitTitle('')
      setCommitDesc('')
      setShowCommitModal(false)
      // Move pending files to committed tab
      setCommittedFiles((prev) => {
        const next = new Set(prev)
        pendingEntries.forEach(([fp]) => next.add(fp))
        return next
      })
      setStagedFiles(new Set())
      setExpandedFiles(new Set())
      setDiffCache(new Map())
      onRefreshGitStatus()
    } catch (err) {
      console.error('[ChangesPanel] Failed to commit:', err)
      toast.error(`Commit failed: ${err}`)
    } finally {
      setCommitting(false)
    }
  }, [commitTitle, commitDesc, rootPath, pendingEntries, onRefreshGitStatus])

  const handleClearCommitted = useCallback(() => {
    const pathsToClear = committedEntries.map(([fp]) => fp)
    setCommittedFiles(new Set())
    onRemoveModifiedFiles?.(pathsToClear)
  }, [committedEntries, onRemoveModifiedFiles])

  const getStatusLabel = (s: FileStatus): string => {
    if (s === 'created') return 'N'
    if (s === 'modified') return 'M'
    return 'D'
  }

  const isMarkdown = (filePath: string): boolean => filePath.endsWith('.md')

  const getStatusClass = (s: FileStatus, filePath: string): string => {
    if (isMarkdown(filePath)) return 'changes-status-markdown'
    if (s === 'created') return 'changes-status-new'
    if (s === 'modified') return 'changes-status-modified'
    return 'changes-status-deleted'
  }

  const currentEntries = activeTab === 'pending' ? pendingEntries
    : activeTab === 'committed' ? committedEntries
    : [] // history tab renders its own content

  const renderFileRow = ([filePath, status]: [string, FileStatus]) => {
    const fileName = filePath.split('/').pop() || filePath
    const dirPath = shortenPath(filePath.substring(0, filePath.lastIndexOf('/')))
    const isExpanded = expandedFiles.has(filePath)
    const isStaged = stagedFiles.has(filePath)
    const isCommitted = committedFiles.has(filePath)
    const diff = diffCache.get(filePath)

    return (
      <div key={filePath} className={`changes-file-item ${isStaged ? 'staged' : ''}`}>
        <div
          className="changes-file-row"
          onClick={() => toggleFile(filePath, status)}
        >
          <svg
            className={`changes-file-chevron ${isExpanded ? 'expanded' : ''}`}
            width="10" height="10" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
          <span className={`changes-file-status ${getStatusClass(status, filePath)}`}>
            {getStatusLabel(status)}
          </span>
          <span className={`changes-file-name ${isMarkdown(filePath) ? 'changes-file-name-markdown' : ''}`} title={filePath}>
            {fileName}
          </span>
          {isCommitted && <span className="changes-committed-badge">committed</span>}
          {isStaged && !isCommitted && <span className="changes-staged-badge">staged</span>}
          <span className="changes-file-dir" title={filePath}>
            {dirPath}
          </span>
          <div className="changes-file-actions" onClick={(e) => e.stopPropagation()}>
            {onOpenInEditor && (
              <button
                type="button"
                className="changes-btn changes-btn-editor"
                onClick={() => onOpenInEditor(filePath)}
                title="Open in editor"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 18 22 12 16 6" />
                  <polyline points="8 6 2 12 8 18" />
                </svg>
              </button>
            )}
            <OpenInIDEButton path={filePath} iconOnly className="changes-btn changes-btn-ide" />
            {!isCommitted && (
              <>
                <button
                  type="button"
                  className="changes-btn changes-btn-reject"
                  onClick={() => handleReject(filePath, status)}
                  title="Reject change"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="changes-btn changes-btn-accept"
                  onClick={() => handleAccept(filePath)}
                  title="Stage change"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>

        {isExpanded && diff && (
          <div className="changes-file-diff">
            <InlineDiffView
              diffContent={diff.content}
              loading={diff.loading}
              error={diff.error}
              compact
            />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="changes-panel">
      {/* Context bar — project name + branch/worktree info (US1) */}
      {(branch || projectName) && (
        <div className="changes-context-bar">
          {projectName && (
            <span className="changes-project-name" title={projectName}>
              {projectName}
            </span>
          )}
          {branch && (
            <>
              <svg className="changes-branch-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="6" y1="3" x2="6" y2="15" />
                <circle cx="18" cy="6" r="3" />
                <circle cx="6" cy="18" r="3" />
                <path d="M18 9a9 9 0 0 1-9 9" />
              </svg>
              <span className="changes-branch-name" title={branch}>
                {branch}
              </span>
            </>
          )}
          {isWorktree && (
            <span className="changes-worktree-badge">worktree</span>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="changes-tabs">
        <button
          type="button"
          className={`changes-tab ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          Pending
          {pendingEntries.length > 0 && (
            <span className="changes-tab-count">{pendingEntries.length}</span>
          )}
        </button>
        <button
          type="button"
          className={`changes-tab ${activeTab === 'committed' ? 'active' : ''}`}
          onClick={() => setActiveTab('committed')}
        >
          Committed
          {committedEntries.length > 0 && (
            <span className="changes-tab-count changes-tab-count-committed">{committedEntries.length}</span>
          )}
        </button>
        <button
          type="button"
          className={`changes-tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          History
          {history && history.length > 0 && (
            <span className="changes-tab-count changes-tab-count-history">{history.length}</span>
          )}
        </button>
      </div>

      {/* Header actions — only for pending tab */}
      {activeTab === 'pending' && pendingEntries.length > 0 && (
        <div className="changes-panel-header">
          <span className="changes-panel-summary">
            {pendingEntries.length} file{pendingEntries.length !== 1 ? 's' : ''}
          </span>
          <div className="changes-panel-global-actions">
            <button
              type="button"
              className="changes-btn changes-btn-accept-all"
              onClick={handleAcceptAll}
              title="Stage all changes"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </button>
            <button
              type="button"
              className="changes-btn-commit-text"
              onClick={() => setShowCommitModal(true)}
              title="Commit session changes"
            >
              Commit
            </button>
          </div>
        </div>
      )}

      {/* Header actions — only for committed tab */}
      {activeTab === 'committed' && committedEntries.length > 0 && (
        <div className="changes-panel-header">
          <span className="changes-panel-summary">
            {committedEntries.length} file{committedEntries.length !== 1 ? 's' : ''}
          </span>
          <div className="changes-panel-global-actions">
            <button
              type="button"
              className="changes-btn changes-btn-clear-all"
              onClick={handleClearCommitted}
              title="Clear all committed"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* History tab content (US2) */}
      {activeTab === 'history' && (
        <div className="changes-history-list">
          {historyLoading ? (
            <div className="changes-panel-empty">Loading commits…</div>
          ) : !history || history.length === 0 ? (
            <div className="changes-panel-empty">Nessun commit trovato</div>
          ) : (
            <div style={{ position: 'relative', padding: '0.5rem 0.8rem 1rem 0' }}>
              {history.map((entry, index) => (
                <GitTimelineItem
                  key={entry.hash}
                  entry={entry}
                  lineLeft={TIMELINE_LINE_LEFT}
                  isLast={index === history.length - 1}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty state per tab (pending/committed only) */}
      {activeTab !== 'history' && currentEntries.length === 0 && (
        <div className="changes-panel-empty">
          {activeTab === 'pending' ? 'No pending changes' : 'No committed files yet'}
        </div>
      )}

      {/* File list (pending/committed only) */}
      {activeTab !== 'history' && currentEntries.length > 0 && (
        <div className="changes-panel-list">
          {currentEntries.map(renderFileRow)}
        </div>
      )}

      {showCommitModal && (
        <CommitModal
          fileCount={pendingEntries.length}
          commitTitle={commitTitle}
          commitDesc={commitDesc}
          committing={committing}
          onTitleChange={setCommitTitle}
          onDescChange={setCommitDesc}
          onCommit={handleCommit}
          onClose={() => setShowCommitModal(false)}
        />
      )}

      {/* Confirm modal for deleting new files */}
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
