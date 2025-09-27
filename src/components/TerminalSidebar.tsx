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
            terminal.needsAttention ? 'attention' : '',
            terminal.alive ? (terminal.status === 'busy' ? 'busy' : 'idle') : '',
          ].filter(Boolean).join(' ')
          const statusLabel = terminal.alive
            ? terminal.status === 'busy'
              ? 'In esecuzione'
              : 'Pronto'
            : 'Terminato'
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
              <input
                type="color"
                className="terminal-color"
                value={terminal.color}
                aria-label={`Colore per ${terminal.label}`}
                onClick={(event) => event.stopPropagation()}
                onChange={(event) => onColorChange(terminal.id, event.target.value)}
              />
              <div className="terminal-details">
                <span className="terminal-name">{terminal.label}</span>
                <span className={`terminal-status-chip ${terminal.status ?? 'idle'}`}>
                  {statusLabel}
                </span>
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
