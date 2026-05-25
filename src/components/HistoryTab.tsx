import { useState } from 'react'
import RefBadge from './RefBadge'
import CommitPopover from './CommitPopover'
import type { GitCommitEntry } from '../types'
import './ChangesPanel.css'
import './GitGraph.css'

interface HistoryTabProps {
  history?: GitCommitEntry[]
  historyLoading?: boolean
  currentBranch?: string
}

export default function HistoryTab({ history, historyLoading, currentBranch }: HistoryTabProps) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)

  if (historyLoading) {
    return <div className="changes-panel-empty">Loading commits...</div>
  }

  if (!history || history.length === 0) {
    return <div className="changes-panel-empty">No commits found</div>
  }

  return (
    <div className="changes-history-list">
      {currentBranch && (
        <div className="git-graph-header">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <line x1="6" y1="3" x2="6" y2="15" />
            <circle cx="18" cy="6" r="3" />
            <circle cx="6" cy="18" r="3" />
            <path d="M18 9a9 9 0 0 1-9 9" />
          </svg>
          <span className="git-graph-header-branch">{currentBranch}</span>
          <span className="git-graph-header-count">{history.length} commits</span>
        </div>
      )}

      <div className="git-graph-container">
        {history.map((commit, idx) => (
          <div key={commit.hash} style={{ position: 'relative' }}>
            <div
              className="git-graph-row"
              onClick={() => setSelectedIdx(selectedIdx === idx ? null : idx)}
            >
              <div className="git-graph-dot-col">
                <div className="git-graph-line" />
                <div className="git-graph-dot-simple" />
              </div>
              <div className="git-graph-content">
                {(commit.refs?.length ?? 0) > 0 && (
                  <RefBadge
                    refs={commit.refs ?? []}
                    color="#FF6B35"
                    currentBranch={currentBranch}
                  />
                )}
                <span className="git-graph-summary">{commit.summary}</span>
                <span className="git-graph-meta">
                  {commit.author} • {commit.relativeTime}
                </span>
              </div>
            </div>
            {selectedIdx === idx && (
              <CommitPopover
                hash={commit.hash}
                parentHashes={commit.parentHashes ?? []}
                author={commit.author}
                summary={commit.summary}
                timestamp={commit.timestamp}
                color="#FF6B35"
                onClose={() => setSelectedIdx(null)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
