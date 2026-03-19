import { useState, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { toast } from 'sonner'
import InlineDiffView from './InlineDiffView'
import { ConfirmModal } from './ConfirmModal'
import './ChangesPanel.css'

interface ChangesPanelProps {
  rootPath: string | null
  modifiedFiles: Map<string, 'created' | 'modified' | 'deleted'>
  onRefreshGitStatus: () => void
  onClearModifiedFiles?: () => void
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
}: ChangesPanelProps) {
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set())
  const [diffCache, setDiffCache] = useState<Map<string, DiffState>>(new Map())
  const [fileToDelete, setFileToDelete] = useState<string | null>(null)
  const [showCommitModal, setShowCommitModal] = useState(false)
  const [commitTitle, setCommitTitle] = useState('')
  const [commitDesc, setCommitDesc] = useState('')
  const [committing, setCommitting] = useState(false)
  const [stagedFiles, setStagedFiles] = useState<Set<string>>(new Set())

  const entries = Array.from(modifiedFiles.entries())

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
    async (filePath: string, status: 'created' | 'modified' | 'deleted') => {
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
            untracked: false,
            rootPath,
          })
        }

        setDiffCache((prev) => {
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

  const toggleFile = useCallback(
    (filePath: string, status: 'created' | 'modified' | 'deleted') => {
      setExpandedFiles((prev) => {
        const next = new Set(prev)
        if (next.has(filePath)) {
          next.delete(filePath)
        } else {
          next.add(filePath)
          if (!diffCache.has(filePath)) {
            loadDiff(filePath, status)
          }
        }
        return next
      })
    },
    [diffCache, loadDiff],
  )

  const handleAccept = useCallback(
    async (filePath: string) => {
      const relativePath = getRelativePath(filePath)
      console.log('[ChangesPanel] Accept:', { filePath, relativePath, rootPath })
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
    async (filePath: string, status: 'created' | 'modified' | 'deleted') => {
      // Brain: gotcha-window-confirm-tauri-webview
      if (status === 'created') {
        setFileToDelete(filePath)
        return
      }
      const relativePath = getRelativePath(filePath)
      console.log('[ChangesPanel] Reject:', { filePath, relativePath, rootPath })
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
      setStagedFiles(new Set(entries.map(([fp]) => fp)))
      toast.success('All files staged')
      onRefreshGitStatus()
    } catch (err) {
      console.error('[ChangesPanel] Failed to stage all:', err)
      toast.error(`Failed to stage all: ${err}`)
    }
  }, [rootPath, entries, onRefreshGitStatus])

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
      setStagedFiles(new Set())
      setExpandedFiles(new Set())
      setDiffCache(new Map())
      onClearModifiedFiles?.()
      onRefreshGitStatus()
    } catch (err) {
      console.error('[ChangesPanel] Failed to commit:', err)
      toast.error(`Commit failed: ${err}`)
    } finally {
      setCommitting(false)
    }
  }, [commitTitle, commitDesc, rootPath, onRefreshGitStatus])

  const getStatusLabel = (s: 'created' | 'modified' | 'deleted'): string => {
    if (s === 'created') return 'N'
    if (s === 'modified') return 'M'
    return 'D'
  }

  const getStatusClass = (s: 'created' | 'modified' | 'deleted'): string => {
    if (s === 'created') return 'changes-status-new'
    if (s === 'modified') return 'changes-status-modified'
    return 'changes-status-deleted'
  }

  if (entries.length === 0) {
    return (
      <div className="changes-panel-empty">
        No changes in this session
      </div>
    )
  }

  return (
    <div className="changes-panel">
      {/* Header */}
      <div className="changes-panel-header">
        <span className="changes-panel-summary">
          {entries.length} file{entries.length !== 1 ? 's' : ''} changed
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

      {/* File list */}
      <div className="changes-panel-list">
        {entries.map(([filePath, status]) => {
          const fileName = filePath.split('/').pop() || filePath
          const dirPath = shortenPath(filePath.substring(0, filePath.lastIndexOf('/')))
          const isExpanded = expandedFiles.has(filePath)
          const isStaged = stagedFiles.has(filePath)
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
                <span className={`changes-file-status ${getStatusClass(status)}`}>
                  {getStatusLabel(status)}
                </span>
                <span className="changes-file-name" title={filePath}>
                  {fileName}
                </span>
                {isStaged && <span className="changes-staged-badge">staged</span>}
                <span className="changes-file-dir" title={filePath}>
                  {dirPath}
                </span>
                <div className="changes-file-actions" onClick={(e) => e.stopPropagation()}>
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
        })}
      </div>

      {/* Commit modal */}
      {showCommitModal && (
        <>
          <div className="changes-modal-backdrop" onClick={() => setShowCommitModal(false)} />
          <div className="changes-commit-modal">
            <div className="changes-commit-modal-header">
              <span>Commit Changes</span>
              <button
                type="button"
                className="changes-modal-close"
                onClick={() => setShowCommitModal(false)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="changes-commit-modal-body">
              <input
                type="text"
                className="changes-commit-input"
                placeholder="Commit title..."
                value={commitTitle}
                onChange={(e) => setCommitTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleCommit()
                  }
                }}
                disabled={committing}
                autoFocus
              />
              <textarea
                className="changes-commit-textarea"
                placeholder="Description (optional)..."
                value={commitDesc}
                onChange={(e) => setCommitDesc(e.target.value)}
                disabled={committing}
                rows={3}
              />
            </div>
            <div className="changes-commit-modal-footer">
              <span className="changes-commit-file-count">
                {entries.length} file{entries.length !== 1 ? 's' : ''}
              </span>
              <button
                type="button"
                className="changes-commit-btn"
                onClick={handleCommit}
                disabled={committing || !commitTitle.trim()}
              >
                {committing ? 'Committing...' : 'Commit'}
              </button>
            </div>
          </div>
        </>
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
