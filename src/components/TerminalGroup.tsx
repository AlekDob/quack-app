import { type MouseEvent } from 'react'
import GroupHeader from './GroupHeader'
import type { TerminalInfo } from '../types'

interface TerminalGroupProps {
  cwd: string
  terminals: TerminalInfo[]
  isCollapsed: boolean
  activeId: string | null
  canGroupMoveUp: boolean
  canGroupMoveDown: boolean
  onToggle: () => void
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onContextMenu: (event: MouseEvent, terminal: TerminalInfo) => void
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
  onMoveGroupUp: (cwd: string) => void
  onMoveGroupDown: (cwd: string) => void
}

export default function TerminalGroup({
  cwd,
  terminals,
  isCollapsed,
  activeId,
  canGroupMoveUp,
  canGroupMoveDown,
  onToggle,
  onSelect,
  onClose,
  onContextMenu,
  onMoveUp,
  onMoveDown,
  onMoveGroupUp,
  onMoveGroupDown,
}: TerminalGroupProps) {
  return (
    <div className="terminal-group">
      <GroupHeader
        cwd={cwd}
        count={terminals.length}
        isCollapsed={isCollapsed}
        canMoveUp={canGroupMoveUp}
        canMoveDown={canGroupMoveDown}
        onToggle={onToggle}
        onMoveUp={() => onMoveGroupUp(cwd)}
        onMoveDown={() => onMoveGroupDown(cwd)}
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

            // Verifica se può muoversi su/giù nell'array globale dei terminali
            // (Nota: questo richiede accesso all'array completo, per ora usa index locale nel gruppo)
            const canMoveUp = index > 0
            const canMoveDown = index < terminals.length - 1

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
                  className={`terminal-dot ${(terminal.status ?? 'idle') === 'busy' ? 'pulsing' : ''}`}
                  style={{ backgroundColor: terminal.color }}
                />
                <div className="terminal-details">
                  <span className="terminal-name">
                    {terminal.label}
                    <span className="terminal-status-badge">
                      {(terminal.status ?? 'idle') === 'busy' ? '⚡' : '✓'}
                    </span>
                  </span>
                  {(terminal.status ?? 'idle') === 'busy' && (
                    <div className="terminal-progress-bar">
                      <div className="terminal-progress-indicator" />
                    </div>
                  )}
                </div>
                <div className="terminal-reorder-controls">
                  <button
                    type="button"
                    className="terminal-reorder-btn"
                    disabled={!canMoveUp}
                    aria-label="Sposta su"
                    onClick={(event) => {
                      event.stopPropagation()
                      onMoveUp(terminal.id)
                    }}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    className="terminal-reorder-btn"
                    disabled={!canMoveDown}
                    aria-label="Sposta giù"
                    onClick={(event) => {
                      event.stopPropagation()
                      onMoveDown(terminal.id)
                    }}
                  >
                    ▼
                  </button>
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
