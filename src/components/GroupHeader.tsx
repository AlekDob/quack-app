import { useMemo } from 'react'

interface GroupHeaderProps {
  cwd: string
  count: number
  isCollapsed: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  onToggle: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}

const getSmartPath = (fullPath: string): string => {
  const normalized = fullPath.replace(/\\/g, '/')
  const segments = normalized.split('/').filter(Boolean)

  // For home directory paths
  if (normalized.startsWith('/Users/') || normalized.startsWith('/home/')) {
    const homeIndex = segments.findIndex(seg => seg === 'Users' || seg === 'home')
    if (homeIndex >= 0 && segments.length > homeIndex + 1) {
      // Replace /Users/username with ~
      const remaining = segments.slice(homeIndex + 2)
      if (remaining.length === 0) {
        return '~'
      }
      // Show last 2-3 segments after home
      const display = remaining.slice(-2).join('/')
      return `~/${display}`
    }
  }

  // For absolute paths, show last 2-3 segments
  if (segments.length > 3) {
    return segments.slice(-2).join('/')
  }

  // For short paths, show as-is
  return segments.join('/') || '/'
}

export default function GroupHeader({
  cwd,
  count,
  isCollapsed,
  canMoveUp,
  canMoveDown,
  onToggle,
  onMoveUp,
  onMoveDown
}: GroupHeaderProps) {
  const smartPath = useMemo(() => getSmartPath(cwd), [cwd])

  return (
    <div className="group-header-wrapper">
      <button
        type="button"
        className={`group-header ${isCollapsed ? 'collapsed' : 'expanded'}`}
        onClick={onToggle}
        title={cwd}
      >
        <span className={`group-chevron ${isCollapsed ? '' : 'open'}`} aria-hidden="true">
          ▼
        </span>
        <svg className="group-folder-icon" viewBox="0 0 20 20" aria-hidden="true">
          <path
            d="M3 4h6l2 2h6a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="group-path">{smartPath}</span>
        <span className="group-count">[{count}]</span>
      </button>
      <div className="group-reorder-controls">
        <button
          type="button"
          className="terminal-reorder-btn"
          disabled={!canMoveUp}
          aria-label="Sposta gruppo su"
          onClick={(e) => {
            e.stopPropagation()
            onMoveUp()
          }}
        >
          ▲
        </button>
        <button
          type="button"
          className="terminal-reorder-btn"
          disabled={!canMoveDown}
          aria-label="Sposta gruppo giù"
          onClick={(e) => {
            e.stopPropagation()
            onMoveDown()
          }}
        >
          ▼
        </button>
      </div>
    </div>
  )
}
