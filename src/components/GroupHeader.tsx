import { useMemo } from 'react'

interface GroupHeaderProps {
  cwd: string
  count: number
  isCollapsed: boolean
  // Phase 4: AgentChat display data (optional for backward compatibility)
  agentChatName?: string
  agentChatColor?: string
  onToggle: () => void
  // Drag & drop support
  draggedTerminalId: string | null
  draggedGroupCwd: string | null
  dragOverGroupCwd: string | null
  groupDropPosition: 'before' | 'after'
  onGroupDragStart: (cwd: string) => void
  onGroupDragOver: (cwd: string, event: React.DragEvent) => void
  onGroupDragLeave: () => void
  onGroupDrop: (targetCwd: string) => void
  onGroupDragEnd: () => void
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
  agentChatName,
  agentChatColor,
  onToggle,
  draggedTerminalId,
  draggedGroupCwd,
  dragOverGroupCwd,
  groupDropPosition,
  onGroupDragStart,
  onGroupDragOver,
  onGroupDragLeave,
  onGroupDrop,
  onGroupDragEnd,
}: GroupHeaderProps) {
  const smartPath = useMemo(() => getSmartPath(cwd), [cwd])

  // Phase 4: Use AgentChat name if available, otherwise fall back to smart path
  const displayName = agentChatName || smartPath

  const isDragging = draggedGroupCwd === cwd
  const isDragOver = dragOverGroupCwd === cwd

  // Don't show drop indicator on group header if dragging a terminal (only when dragging groups)
  const isTerminalDrag = draggedTerminalId !== null
  const shouldShowDropIndicator = isDragOver && !isTerminalDrag

  const headerClasses = [
    'group-header',
    isCollapsed ? 'collapsed' : 'expanded',
    isDragging ? 'dragging' : '',
    shouldShowDropIndicator && groupDropPosition === 'before' ? 'drag-over-before' : '',
    shouldShowDropIndicator && groupDropPosition === 'after' ? 'drag-over-after' : '',
  ].filter(Boolean).join(' ')

  return (
    <div
      className="group-header-wrapper"
      draggable={true}
      onDragStart={() => onGroupDragStart(cwd)}
      onDragOver={(e) => {
        e.preventDefault()
        onGroupDragOver(cwd, e)
      }}
      onDragLeave={onGroupDragLeave}
      onDrop={(e) => {
        e.preventDefault()
        onGroupDrop(cwd)
      }}
      onDragEnd={onGroupDragEnd}
    >
      <button
        type="button"
        className={headerClasses}
        onClick={onToggle}
        title={cwd}
        style={agentChatColor ? { '--agent-color': agentChatColor } as React.CSSProperties : undefined}
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
        <span className="group-path">{displayName}</span>
        <span className="group-count">[{count}]</span>
      </button>
    </div>
  )
}
