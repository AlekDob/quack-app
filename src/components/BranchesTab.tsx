import { useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { toast } from 'sonner'
import { ConfirmModal } from './ConfirmModal'
import type { GitBranch } from '../types'
import './ChangesPanel.css'

interface BranchesTabProps {
  rootPath: string | null
  currentBranch?: string | null
  onBranchSwitch?: (branchName: string) => void
}

export default function BranchesTab({ rootPath, currentBranch, onBranchSwitch }: BranchesTabProps) {
  const [branches, setBranches] = useState<GitBranch[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newBranchName, setNewBranchName] = useState('')
  const [branchToDelete, setBranchToDelete] = useState<string | null>(null)

  const loadBranches = useCallback(async () => {
    if (!rootPath) return
    setLoading(true)
    setError(null)
    try {
      const result = await invoke<GitBranch[]>('git_list_branches', { rootPath })
      setBranches(result)
    } catch (err) {
      setError(String(err))
      setBranches([])
    } finally {
      setLoading(false)
    }
  }, [rootPath])

  useEffect(() => { loadBranches() }, [loadBranches])

  async function handleSwitch(branchName: string) {
    if (!rootPath || branchName === currentBranch) return
    try {
      await invoke('git_switch_branch', { branchName, rootPath })
      toast.success(`Switched to ${branchName}`)
      onBranchSwitch?.(branchName)
      loadBranches()
    } catch (err) {
      toast.error(`Switch failed: ${err}`)
    }
  }

  async function handleCreate() {
    if (!rootPath || !newBranchName.trim()) return
    try {
      await invoke('git_create_branch', { branchName: newBranchName.trim(), rootPath })
      toast.success(`Branch "${newBranchName.trim()}" created`)
      setNewBranchName('')
      setCreating(false)
      loadBranches()
    } catch (err) {
      toast.error(`Create failed: ${err}`)
    }
  }

  async function handleDelete() {
    if (!rootPath || !branchToDelete) return
    try {
      await invoke('git_delete_branch', { branchName: branchToDelete, force: false, rootPath })
      toast.success(`Branch "${branchToDelete}" deleted`)
      setBranchToDelete(null)
      loadBranches()
    } catch (err) {
      toast.error(`Delete failed: ${err}`)
    }
  }

  function handleCreateKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleCreate()
    if (e.key === 'Escape') { setCreating(false); setNewBranchName('') }
  }

  if (error) {
    return <div className="changes-panel-empty" style={{ color: '#f87171' }}>{error}</div>
  }

  if (loading && branches.length === 0) {
    return <div className="changes-panel-empty">Loading branches...</div>
  }

  return (
    <div className="sc-section-list">
      <div className="sc-section-header">
        <span className="changes-panel-summary">{branches.length} branch{branches.length !== 1 ? 'es' : ''}</span>
        <button type="button" className="sc-action-btn" onClick={() => setCreating(!creating)} title="New branch">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>

      {creating && (
        <div className="sc-inline-input">
          <input
            type="text"
            value={newBranchName}
            onChange={(e) => setNewBranchName(e.target.value)}
            onKeyDown={handleCreateKeyDown}
            placeholder="branch-name"
            autoFocus
          />
        </div>
      )}

      {branches.length === 0 ? (
        <div className="changes-panel-empty">No branches found</div>
      ) : (
        branches.map((b) => (
          <div
            key={b.name}
            className={`sc-row ${b.isCurrent ? 'sc-row-current' : ''}`}
            onClick={() => handleSwitch(b.name)}
            title={b.upstream ? `Tracking: ${b.upstream}` : b.name}
          >
            <div className="sc-row-main">
              {b.isCurrent && <span className="sc-current-marker">*</span>}
              <span className="sc-row-name">{b.name}</span>
              {b.behind != null && b.behind > 0 && (
                <span className="sc-row-badge">{b.behind} behind</span>
              )}
            </div>
            {!b.isCurrent && b.name !== 'main' && b.name !== 'master' && (
              <button
                type="button"
                className="sc-delete-btn"
                onClick={(e) => { e.stopPropagation(); setBranchToDelete(b.name) }}
                title="Delete branch"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            )}
          </div>
        ))
      )}

      <ConfirmModal
        isOpen={branchToDelete !== null}
        title="Delete branch"
        message={`Delete branch "${branchToDelete}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setBranchToDelete(null)}
      />
    </div>
  )
}
