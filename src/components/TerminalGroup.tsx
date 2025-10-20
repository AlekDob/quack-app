import { type MouseEvent } from 'react'
import GroupHeader from './GroupHeader'
import TerminalActivityBar from './TerminalActivityBar'
import type { TerminalInfo } from '../types'

interface TerminalGroupProps {
  cwd: string
  terminals: TerminalInfo[]
  isCollapsed: boolean
  activeId: string | null
  canGroupMoveUp: boolean
  canGroupMoveDown: boolean
  // Phase 4: AgentChat display data (optional for backward compatibility)
  agentChatName?: string
  agentChatColor?: string
  onToggle: () => void
  onSelect: (terminal: TerminalInfo) => void // Phase 4: Changed signature to pass full terminal
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
  agentChatName,
  agentChatColor,
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
        // Phase 4: Pass AgentChat display data
        agentChatName={agentChatName}
        agentChatColor={agentChatColor}
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
                onClick={() => onSelect(terminal)} // Phase 4: Pass terminal object
                onContextMenu={(event) => onContextMenu(event, terminal)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onSelect(terminal) // Phase 4: Pass terminal object
                  }
                }}
              >
                <TerminalActivityBar terminal={terminal} />
                <div className="terminal-reorder-controls">
                  <button
                    type="button"
                    className="terminal-reorder-btn"
                    disabled={!canMoveUp}
                    aria-label="Move up"
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
                    aria-label="Move down"
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
                  aria-label={`Close ${terminal.label}`}
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
