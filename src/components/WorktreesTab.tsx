import { useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { toast } from 'sonner'
import { ConfirmModal } from './ConfirmModal'
import type { GitWorktree } from '../types'
import './ChangesPanel.css'

interface WorktreesTabProps {
  rootPath: string | null
}

export default function WorktreesTab({ rootPath }: WorktreesTabProps) {
  const [worktrees, setWorktrees] = useState<GitWorktree[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [newPath, setNewPath] = useState('')
  const [newBranch, setNewBranch] = useState('')
  const [worktreeToRemove, setWorktreeToRemove] = useState<string | null>(null)

  const loadWorktrees = useCallback(async () => {
    if (!rootPath) return
    setLoading(true)
    setError(null)
    try {
      const result = await invoke<GitWorktree[]>('git_list_worktrees', { rootPath })
      setWorktrees(result)
    } catch (err) {
      setError(String(err))
      setWorktrees([])
    } finally {
      setLoading(false)
    }
  }, [rootPath])

  useEffect(() => { loadWorktrees() }, [loadWorktrees])

  async function handleAdd() {
    if (!rootPath || !newPath.trim() || !newBranch.trim()) return
    try {
      await invoke('git_add_worktree', { path: newPath.trim(), branch: newBranch.trim(), rootPath })
      toast.success(`Worktree added at ${newPath.trim()}`)
      setNewPath('')
      setNewBranch('')
      setAdding(false)
      loadWorktrees()
    } catch (err) {
      toast.error(`Add worktree failed: ${err}`)
    }
  }

  async function handleRemove() {
    if (!rootPath || !worktreeToRemove) return
    try {
      await invoke('git_remove_worktree', { path: worktreeToRemove, rootPath })
      toast.success('Worktree removed')
      setWorktreeToRemove(null)
      loadWorktrees()
    } catch (err) {
      toast.error(`Remove worktree failed: ${err}`)
    }
  }

  function truncatePath(path: string): string {
    const parts = path.split('/')
    if (parts.length <= 3) return path
    return `.../${parts.slice(-2).join('/')}`
  }

  if (error) {
    return <div className="changes-panel-empty" style={{ color: '#f87171' }}>{error}</div>
  }

  if (loading && worktrees.length === 0) {
    return <div className="changes-panel-empty">Loading worktrees...</div>
  }

  return (
    <div className="sc-section-list">
      <div className="sc-section-header">
        <span className="changes-panel-summary">{worktrees.length} worktree{worktrees.length !== 1 ? 's' : ''}</span>
        <button type="button" className="sc-action-btn" onClick={() => setAdding(!adding)} title="Add worktree">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>

      {adding && (
        <div className="sc-inline-input sc-inline-input-multi">
          <input
            type="text"
            value={newPath}
            onChange={(e) => setNewPath(e.target.value)}
            placeholder="path (e.g. ../my-worktree)"
            autoFocus
          />
          <input
            type="text"
            value={newBranch}
            onChange={(e) => setNewBranch(e.target.value)}
            placeholder="branch name"
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAdding(false) }}
          />
          <button type="button" className="sc-confirm-btn" onClick={handleAdd}>Add</button>
        </div>
      )}

      {worktrees.length === 0 ? (
        <div className="changes-panel-empty">No worktrees</div>
      ) : (
        worktrees.map((wt) => (
          <div key={wt.path} className={`sc-row ${wt.isBare ? 'sc-row-muted' : ''}`} title={wt.path}>
            <div className="sc-row-main">
              <span className="sc-row-name">{truncatePath(wt.path)}</span>
              <span className="sc-row-detail">{wt.branch || 'detached'}</span>
              <span className="sc-row-hash">{wt.commitHash.slice(0, 7)}</span>
            </div>
            {!wt.isBare && (
              <button
                type="button"
                className="sc-delete-btn"
                onClick={() => setWorktreeToRemove(wt.path)}
                title="Remove worktree"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            )}
          </div>
        ))
      )}

      <ConfirmModal
        isOpen={worktreeToRemove !== null}
        title="Remove worktree"
        message={`Remove worktree at "${worktreeToRemove}"?`}
        confirmLabel="Remove"
        onConfirm={handleRemove}
        onCancel={() => setWorktreeToRemove(null)}
      />
    </div>
  )
}
