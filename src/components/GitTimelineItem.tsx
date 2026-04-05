import type { GitCommitEntry } from '../types'

export const TIMELINE_LINE_LEFT = 20
export const TIMELINE_LINE_COLOR = 'rgba(232, 125, 62, 0.32)'

/** Generate initials from author name */
function getAuthorInitials(author: string): string {
  const parts = author.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return author.slice(0, 2).toUpperCase()
}

/** Generate deterministic color from author name */
function getAuthorColor(author: string): string {
  const colors = [
    '#f87171', '#fb923c', '#fbbf24', '#a3e635',
    '#34d399', '#22d3ee', '#60a5fa', '#a78bfa', '#f472b6',
  ]
  let hash = 0
  for (let i = 0; i < author.length; i++) {
    hash = author.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

interface GitTimelineItemProps {
  entry: GitCommitEntry
  lineLeft: number
  isLast: boolean
  /** When true, hide timeline line + avatar (used inside git graph) */
  graphMode?: boolean
}

export default function GitTimelineItem({ entry, lineLeft, isLast, graphMode }: GitTimelineItemProps) {
  const formattedDate = entry.timestamp
    ? new Date(entry.timestamp * 1000).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  const initials = getAuthorInitials(entry.author)
  const avatarColor = getAuthorColor(entry.author)

  if (graphMode) {
    return (
      <div className="git-graph-content">
        <span className="git-graph-summary">{entry.summary}</span>
        <span className="git-graph-meta">{entry.author} • {entry.relativeTime}</span>
      </div>
    )
  }

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
      {/* Avatar con iniziali */}
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
        <span style={{ fontSize: '0.78rem', color: '#f1f2f5' }}>
          {entry.summary}
        </span>
        <span style={{ fontSize: '0.68rem', color: '#a8aebd' }}>
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
