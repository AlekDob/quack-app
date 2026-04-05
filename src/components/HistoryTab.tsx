import { useMemo, useState } from 'react'
import GitTimelineItem, { TIMELINE_LINE_LEFT } from './GitTimelineItem'
import GraphColumn from './GraphColumn'
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

function hasGraphData(history: GitCommitEntry[]): boolean {
  return history.some((e) => (e.parentHashes?.length ?? 0) > 0)
}

export default function HistoryTab({ history, historyLoading }: HistoryTabProps) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)

  const graphNodes = useMemo(() => {
    if (!history || history.length === 0) return []
    if (!hasGraphData(history)) return []
    return computeGraphLanes(history.map(toGraphInput))
  }, [history])

  const useGraph = graphNodes.length > 0
  const maxLanes = useMemo(() => {
    if (!useGraph) return 0
    return Math.min(
      MAX_LANES,
      Math.max(...graphNodes.map((n) => n.activeLanes.length), 1)
    )
  }, [graphNodes, useGraph])

  if (historyLoading) {
    return <div className="changes-panel-empty">Loading commits...</div>
  }

  if (!history || history.length === 0) {
    return <div className="changes-panel-empty">No commits found</div>
  }

  // Fallback: legacy linear timeline (no parent data)
  if (!useGraph) {
    return (
      <div className="changes-history-list">
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
      </div>
    )
  }

  return (
    <div className="changes-history-list">
      <div className="git-graph-container">
        {graphNodes.map((node, idx) => (
          <div key={node.commit.hash} style={{ position: 'relative' }}>
            <div
              className="git-graph-row"
              onClick={() => setSelectedIdx(selectedIdx === idx ? null : idx)}
            >
              <GraphColumn node={node} totalLanes={maxLanes} />
              <div className="git-graph-content">
                <RefBadge refs={node.commit.refs} color={node.color} />
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
        ))}
      </div>
    </div>
  )
}
