import type { TerminalInfo } from '../types'

interface TerminalSidebarProps {
  terminals: TerminalInfo[]
  activeId: string | null
  creating: boolean
  onAdd: () => void
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onColorChange: (id: string, color: string) => void
}

export default function TerminalSidebar({
  terminals,
  activeId,
  creating,
  onAdd,
  onSelect,
  onClose,
  onColorChange,
}: TerminalSidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">Quack Terminal</span>
        <button
          type="button"
          className="sidebar-button"
          onClick={onAdd}
          disabled={creating}
        >
          {creating ? 'Creazione…' : 'Nuovo'}
        </button>
      </div>

      <div className="sidebar-list">
        {terminals.map((terminal) => {
          const active = terminal.id === activeId
          const itemClasses = [
            'terminal-item',
            active ? 'active' : '',
            terminal.alive ? '' : 'inactive',
            // Temporarily commented out status logic for Fork-style clean design
            // terminal.needsAttention ? 'attention' : '',
            // terminal.alive ? (terminal.status === 'busy' ? 'busy' : 'idle') : '',
          ].filter(Boolean).join(' ')
          return (
            <div
              key={terminal.id}
              className={itemClasses}
              onClick={() => onSelect(terminal.id)}
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
                onClick={(event) => {
                  event.stopPropagation()
                  // Maybe later: open color picker on dot click
                }}
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

        {terminals.length === 0 && (
          <div className="empty-state">Nessun terminale attivo</div>
        )}
      </div>
    </aside>
  )
}
