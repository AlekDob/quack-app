import './GitGraph.css'

interface RefBadgeProps {
  refs: string[]
  color: string
  currentBranch?: string
}

function isTag(ref: string): boolean {
  return ref.startsWith('tag: ')
}

function cleanRefName(ref: string): string {
  return ref.replace('tag: ', '').replace('HEAD -> ', '')
}

function truncateRef(name: string, max: number = 28): string {
  return name.length > max ? `${name.slice(0, max - 1)}...` : name
}

function isRemote(ref: string): boolean {
  return /^[^/]+\/[^/]+/.test(ref) && !ref.startsWith('tag: ')
}

function BranchIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="6" y1="3" x2="6" y2="15" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </svg>
  )
}

function TagIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  )
}

function CloudIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
    </svg>
  )
}

export default function RefBadge({ refs, color, currentBranch }: RefBadgeProps) {
  if (!refs || refs.length === 0) return null

  return (
    <span className="ref-badge-group">
      {refs.map((ref) => {
        const tag = isTag(ref)
        const remote = !tag && isRemote(ref)
        const name = cleanRefName(ref)
        const isCurrent = !tag && !remote && currentBranch != null && name === currentBranch

        const className = `ref-badge${isCurrent ? ' ref-badge--current' : ''}${remote ? ' ref-badge--remote' : ''}${tag ? ' ref-badge--tag' : ''}`

        const style = isCurrent
          ? { background: `${color}38`, border: `1px solid ${color}99`, color }
          : remote
            ? { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.55)' }
            : { background: `${color}1f`, border: `1px solid ${color}55`, color }

        return (
          <span key={ref} className={className} style={style} title={name}>
            {tag ? <TagIcon /> : remote ? <CloudIcon /> : <BranchIcon />}
            {isCurrent && <span className="ref-badge-check">✓</span>}
            <span className="ref-badge-name">{truncateRef(name)}</span>
          </span>
        )
      })}
    </span>
  )
}
