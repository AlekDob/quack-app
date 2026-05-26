import { useEffect, useState, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { SubRepoStatus } from '../types'
import './ChangesPanel.css'

interface SubReposSectionProps {
  rootPath: string | null
  refreshTs?: number
  onSelect: (subRepo: SubRepoStatus) => void
}

export default function SubReposSection({ rootPath, refreshTs, onSelect }: SubReposSectionProps) {
  const [subRepos, setSubRepos] = useState<SubRepoStatus[]>([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(true)

  const scan = useCallback(async () => {
    if (!rootPath) {
      setSubRepos([])
      return
    }
    setLoading(true)
    try {
      const result = await invoke<SubRepoStatus[]>('git_scan_subrepos', { rootPath })
      setSubRepos(result)
    } catch {
      setSubRepos([])
    } finally {
      setLoading(false)
    }
  }, [rootPath])

  useEffect(() => { scan() }, [scan, refreshTs])

  // Autohide: render nothing when no sub-repos found
  if (subRepos.length === 0 && !loading) return null

  return (
    <div className="changes-panel-section subrepos-section">
      <button
        type="button"
        className="changes-panel-section-header"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="changes-panel-section-chevron" style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
          ▶
        </span>
        <span className="changes-panel-section-title">
          Sub-repos {subRepos.length > 0 && <span className="subrepo-count">({subRepos.length})</span>}
        </span>
        <button
          type="button"
          className="subrepo-refresh-btn"
          onClick={(e) => { e.stopPropagation(); scan() }}
          title="Re-scan sub-repos"
        >
          ⟳
        </button>
      </button>

      {expanded && (
        <div className="subrepos-list">
          {subRepos.map((repo) => (
            <SubRepoRow key={repo.path} repo={repo} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  )
}

interface SubRepoRowProps {
  repo: SubRepoStatus
  onSelect: (subRepo: SubRepoStatus) => void
}

function SubRepoRow({ repo, onSelect }: SubRepoRowProps) {
  const dirty = !repo.clean
  const aheadBehind = formatAheadBehind(repo.ahead, repo.behind)
  const counts = formatCounts(repo)

  return (
    <button
      type="button"
      className={`subrepo-row ${dirty ? 'is-dirty' : 'is-clean'}`}
      onClick={() => onSelect(repo)}
      title={`Open ${repo.name} changes`}
    >
      <span className={`subrepo-dot ${dirty ? 'dot-dirty' : 'dot-clean'}`} />
      <span className="subrepo-name">{repo.name}</span>
      <span className="subrepo-branch">{repo.branch}</span>
      <span className="subrepo-counts">
        {counts || (dirty ? '' : 'clean')}
      </span>
      <span className="subrepo-meta">
        {aheadBehind && <span className="subrepo-aheadbehind">{aheadBehind}</span>}
        {repo.lastCommitRelative && (
          <span className="subrepo-last" title={repo.lastCommitSubject ?? ''}>
            · {repo.lastCommitRelative}
          </span>
        )}
      </span>
    </button>
  )
}

function formatCounts(repo: SubRepoStatus): string {
  const parts: string[] = []
  if (repo.added > 0) parts.push(`+${repo.added}`)
  if (repo.modified > 0) parts.push(`~${repo.modified}`)
  if (repo.untracked > 0) parts.push(`?${repo.untracked}`)
  return parts.join(' ')
}

function formatAheadBehind(ahead: number, behind: number): string {
  const parts: string[] = []
  if (ahead > 0) parts.push(`↑${ahead}`)
  if (behind > 0) parts.push(`↓${behind}`)
  return parts.join(' ')
}
