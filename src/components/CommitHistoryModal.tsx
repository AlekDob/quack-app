import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { GitCommitEntry } from '../types'

interface CommitHistoryModalProps {
  branchName: string
  rootPath: string
  onClose: () => void
}

const TIMELINE_LINE_LEFT = 20
const TIMELINE_LINE_COLOR = 'rgba(232, 125, 62, 0.32)'

const GitTimelineItem = ({
  entry,
  lineLeft,
  isLast,
}: {
  entry: GitCommitEntry
  lineLeft: number
  isLast: boolean
}) => {
  const formattedDate = entry.timestamp
    ? new Date(entry.timestamp * 1000).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  // Generate initials from author name
  const getAuthorInitials = (author: string): string => {
    const parts = author.trim().split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return author.slice(0, 2).toUpperCase()
  }

  // Generate color from author name (deterministic)
  const getAuthorColor = (author: string): string => {
    const colors = [
      '#f87171', // red
      '#fb923c', // orange
      '#fbbf24', // yellow
      '#a3e635', // lime
      '#34d399', // emerald
      '#22d3ee', // cyan
      '#60a5fa', // blue
      '#a78bfa', // violet
      '#f472b6', // pink
    ]
    let hash = 0
    for (let i = 0; i < author.length; i++) {
      hash = author.charCodeAt(i) + ((hash << 5) - hash)
    }
    return colors[Math.abs(hash) % colors.length]
  }

  const initials = getAuthorInitials(entry.author)
  const avatarColor = getAuthorColor(entry.author)

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
      {/* Avatar with initials */}
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
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.2rem',
        }}
      >
        <span
          style={{
            fontSize: '0.78rem',
            color: '#f1f2f5',
          }}
        >
          {entry.summary}
        </span>
        <span
          style={{
            fontSize: '0.68rem',
            color: '#a8aebd',
          }}
        >
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

function CommitHistoryModal({ branchName, rootPath, onClose }: CommitHistoryModalProps) {
  const [commits, setCommits] = useState<GitCommitEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadCommits = async () => {
      setLoading(true)
      setError(null)
      try {
        const result = await invoke<GitCommitEntry[]>('git_commit_history', {
          limit: 100,
          branchName,
          rootPath,
        })
        setCommits(result)
      } catch (err) {
        console.error('Failed to load commit history:', err)
        setError(`Failed to load commits: ${err}`)
      } finally {
        setLoading(false)
      }
    }

    loadCommits()
  }, [branchName, rootPath])

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'rgba(20, 22, 31, 0.98)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          width: '90%',
          maxWidth: '700px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.2rem 1.5rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: '1.1rem',
                fontWeight: 600,
                color: '#f1f2f5',
              }}
            >
              Commit History
            </h2>
            <p
              style={{
                margin: '0.3rem 0 0 0',
                fontSize: '0.75rem',
                color: '#a8aebd',
              }}
            >
              Branch: <span style={{ color: '#e87d3e', fontWeight: 500 }}>{branchName}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
              color: '#a8aebd',
              padding: '0.4rem 0.8rem',
              fontSize: '0.75rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
            }}
          >
            Close
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1rem 1.5rem',
            position: 'relative',
          }}
        >
          {loading ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '200px',
                color: '#a8aebd',
                fontSize: '0.85rem',
              }}
            >
              Loading commits...
            </div>
          ) : error ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '200px',
                color: '#f87171',
                fontSize: '0.85rem',
              }}
            >
              {error}
            </div>
          ) : commits.length === 0 ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '200px',
                color: '#a8aebd',
                fontSize: '0.85rem',
              }}
            >
              No commits found
            </div>
          ) : (
            <>
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  left: `${TIMELINE_LINE_LEFT + 24}px`,
                  top: 0,
                  bottom: 0,
                  width: '2px',
                  background: 'rgba(232, 125, 62, 0.3)',
                  pointerEvents: 'none',
                }}
              />
              {commits.map((entry, index) => (
                <GitTimelineItem
                  key={entry.hash}
                  entry={entry}
                  lineLeft={TIMELINE_LINE_LEFT}
                  isLast={index === commits.length - 1}
                />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default CommitHistoryModal
