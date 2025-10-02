import { type MouseEvent } from 'react'
import GroupHeader from './GroupHeader'
import type { TerminalInfo } from '../types'

interface TerminalGroupProps {
  cwd: string
  terminals: TerminalInfo[]
  isCollapsed: boolean
  activeId: string | null
  onToggle: () => void
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onContextMenu: (event: MouseEvent, terminal: TerminalInfo) => void
}

export default function TerminalGroup({
  cwd,
  terminals,
  isCollapsed,
  activeId,
  onToggle,
  onSelect,
  onClose,
  onContextMenu,
}: TerminalGroupProps) {
  return (
    <div className="terminal-group">
      <GroupHeader
        cwd={cwd}
        count={terminals.length}
        isCollapsed={isCollapsed}
        onToggle={onToggle}
      />

      {!isCollapsed && (
        <div className="terminal-group-items">
          {terminals.map((terminal, index) => {
            const active = terminal.id === activeId
            const itemClasses = [
              'terminal-item',
              'terminal-item-grouped',
              active ? 'active' : '',
              terminal.alive ? '' : 'inactive',
            ].filter(Boolean).join(' ')

            return (
              <div
                key={terminal.id}
                className={itemClasses}
                style={{ '--item-index': index } as React.CSSProperties}
                onClick={() => onSelect(terminal.id)}
                onContextMenu={(event) => onContextMenu(event, terminal)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onSelect(terminal.id)
                  }
                }}
              >
                <div
                  className="terminal-dot"
                  style={{ backgroundColor: terminal.color }}
                />
                <div className="terminal-details">
                  <span className="terminal-name">{terminal.label}</span>
                </div>
                <button
                  type="button"
                  className="terminal-close"
                  aria-label={`Chiudi ${terminal.label}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    onClose(terminal.id)
                  }}
                >
                  ×
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
