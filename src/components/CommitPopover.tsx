import { useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import './GitGraph.css'

interface CommitPopoverProps {
  hash: string
  parentHashes: string[]
  author: string
  summary: string
  timestamp?: number
  color: string
  onClose: () => void
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function copyHash(hash: string) {
  navigator.clipboard.writeText(hash)
  toast.success('Hash copied')
}

export default function CommitPopover({
  hash, parentHashes, author, summary, timestamp, color, onClose,
}: CommitPopoverProps) {
  const ref = useRef<HTMLDivElement>(null)

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) onClose()
  }, [onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [handleKeyDown, handleClickOutside])

  const isMerge = parentHashes.length > 1

  return (
    <div ref={ref} className="commit-popover" style={{ borderColor: `${color}40` }}>
      <div className="commit-popover-row">
        <span className="commit-popover-label">Hash</span>
        <button
          type="button"
          className="commit-popover-hash"
          onClick={() => copyHash(hash)}
          title="Click to copy"
        >
          {hash.slice(0, 10)}
        </button>
      </div>

      <div className="commit-popover-row">
        <span className="commit-popover-label">
          {isMerge ? 'Parents (merge)' : 'Parent'}
        </span>
        <span className="commit-popover-value commit-popover-mono">
          {parentHashes.length > 0
            ? parentHashes.map((p) => p.slice(0, 7)).join(' + ')
            : 'root'}
        </span>
      </div>

      <div className="commit-popover-row">
        <span className="commit-popover-label">Author</span>
        <span className="commit-popover-value">{author}</span>
      </div>

      <div className="commit-popover-row">
        <span className="commit-popover-label">Message</span>
        <span className="commit-popover-value">{summary}</span>
      </div>

      {timestamp && (
        <div className="commit-popover-row">
          <span className="commit-popover-label">Date</span>
          <span className="commit-popover-value commit-popover-dim">
            {formatDate(timestamp)}
          </span>
        </div>
      )}
    </div>
  )
}
