import { useMemo, useState } from 'react'
import GraphColumn, { getGraphWidth } from './GraphColumn'
import RefBadge from './RefBadge'
import CommitPopover from './CommitPopover'
import { computeGraphLanes } from '../utils/gitGraphLayout'
import type { GraphCommitInput } from '../utils/gitGraphLayout'
import type { GitCommitEntry } from '../types'
import { MAX_LANES } from '../utils/gitGraphColors'
import './ChangesPanel.css'
import './GitGraph.css'

interface HistoryTabProps {
  history?: GitCommitEntry[]
  historyLoading?: boolean
  currentBranch?: string
}

function toGraphInput(entry: GitCommitEntry): GraphCommitInput {
  return {
    hash: entry.hash,
    parentHashes: entry.parentHashes ?? [],
    refs: entry.refs ?? [],
    summary: entry.summary,
    author: entry.author,
    relativeTime: entry.relativeTime,
    timestamp: entry.timestamp,
  }
}

export default function HistoryTab({ history, historyLoading, currentBranch }: HistoryTabProps) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)

  const graphNodes = useMemo(() => {
    if (!history || history.length === 0) return []
    return computeGraphLanes(history.map(toGraphInput))
  }, [history])

  const maxLanes = useMemo(() => {
    if (graphNodes.length === 0) return 1
    return Math.min(
      MAX_LANES,
      Math.max(...graphNodes.map((n) => n.activeLanes.length), 1)
    )
  }, [graphNodes])

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
        {graphNodes.map((node, idx) => {
          const rowClass = `git-graph-row${node.isMerge ? ' git-graph-row--merge' : ''}`
          return (
            <div key={node.commit.hash} style={{ position: 'relative' }}>
              <div
                className={rowClass}
                onClick={() => setSelectedIdx(selectedIdx === idx ? null : idx)}
                style={{ paddingLeft: getGraphWidth(Math.max(node.activeLanes.length, node.lane + 1)) }}
              >
                <GraphColumn node={node} totalLanes={maxLanes} />
                <div className="git-graph-content">
                  {node.commit.refs.length > 0 && (
                    <RefBadge
                      refs={node.commit.refs}
                      color={node.color}
                      currentBranch={currentBranch}
                    />
                  )}
                  <span className="git-graph-summary">{node.commit.summary}</span>
                  <span className="git-graph-meta">
                    {node.commit.author} • {node.commit.relativeTime}
                  </span>
                </div>
              </div>
              {selectedIdx === idx && (
                <CommitPopover
                  hash={node.commit.hash}
                  parentHashes={node.commit.parentHashes}
                  author={node.commit.author}
                  summary={node.commit.summary}
                  timestamp={node.commit.timestamp}
                  color={node.color}
                  onClose={() => setSelectedIdx(null)}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
