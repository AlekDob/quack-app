import { useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { GitRemote } from '../types'
import './ChangesPanel.css'

interface RemotesTabProps {
  rootPath: string | null
}

export default function RemotesTab({ rootPath }: RemotesTabProps) {
  const [remotes, setRemotes] = useState<GitRemote[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadRemotes = useCallback(async () => {
    if (!rootPath) return
    setLoading(true)
    setError(null)
    try {
      const result = await invoke<GitRemote[]>('git_list_remotes', { rootPath })
      setRemotes(result)
    } catch (err) {
      setError(String(err))
      setRemotes([])
    } finally {
      setLoading(false)
    }
  }, [rootPath])

  useEffect(() => { loadRemotes() }, [loadRemotes])

  if (error) {
    return <div className="changes-panel-empty" style={{ color: '#f87171' }}>{error}</div>
  }

  if (loading && remotes.length === 0) {
    return <div className="changes-panel-empty">Loading remotes...</div>
  }

  if (remotes.length === 0) {
    return <div className="changes-panel-empty">No remotes configured</div>
  }

  return (
    <div className="sc-section-list">
      <div className="sc-section-header">
        <span className="changes-panel-summary">{remotes.length} remote{remotes.length !== 1 ? 's' : ''}</span>
      </div>
      {remotes.map((r) => (
        <div key={r.name} className="sc-row" title={r.url}>
          <div className="sc-row-main">
            <span className="sc-row-name sc-row-name-bold">{r.name}</span>
            <span className="sc-row-url">{r.url}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
