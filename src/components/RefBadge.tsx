import './GitGraph.css'

interface RefBadgeProps {
  refs: string[]
  color: string
}

function isBranchRef(ref: string): boolean {
  return !ref.startsWith('tag: ')
}

function cleanRefName(ref: string): string {
  return ref.replace('tag: ', '').replace('HEAD -> ', '')
}

function truncateRef(name: string, max: number = 24): string {
  return name.length > max ? `${name.slice(0, max - 1)}...` : name
}

export default function RefBadge({ refs, color }: RefBadgeProps) {
  if (!refs || refs.length === 0) return null

  return (
    <span className="ref-badge-group">
      {refs.map((ref) => {
        const isBranch = isBranchRef(ref)
        const name = cleanRefName(ref)
        return (
          <span
            key={ref}
            className="ref-badge"
            style={{
              background: `${color}20`,
              border: `1px solid ${color}40`,
              color,
            }}
            title={name}
          >
            {isBranch ? (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="6" y1="3" x2="6" y2="15" />
                <circle cx="18" cy="6" r="3" />
                <circle cx="6" cy="18" r="3" />
                <path d="M18 9a9 9 0 0 1-9 9" />
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                <line x1="7" y1="7" x2="7.01" y2="7" />
              </svg>
            )}
            {truncateRef(name)}
          </span>
        )
      })}
    </span>
  )
}
