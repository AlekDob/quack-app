import { useMemo } from 'react'

interface GroupHeaderProps {
  cwd: string
  count: number
  isCollapsed: boolean
  onToggle: () => void
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

export default function GroupHeader({ cwd, count, isCollapsed, onToggle }: GroupHeaderProps) {
  const smartPath = useMemo(() => getSmartPath(cwd), [cwd])

  return (
    <button
      type="button"
      className={`group-header ${isCollapsed ? 'collapsed' : 'expanded'}`}
      onClick={onToggle}
      title={cwd}
    >
      <span className={`group-chevron ${isCollapsed ? '' : 'open'}`} aria-hidden="true">
        ▼
      </span>
      <span className="group-folder-icon" aria-hidden="true">
        📁
      </span>
      <span className="group-path">{smartPath}</span>
      <span className="group-count">[{count}]</span>
    </button>
  )
}
