import { useState, useMemo } from 'react'
import type { TerminalInfo } from '../types'

const normalize = (value: string) => value.toLowerCase()
const fuzzyMatch = (query: string, target: string) => {
  if (!query) {
    return true
  }
  const normalizedQuery = normalize(query)
  const normalizedTarget = normalize(target)
  let queryIndex = 0
  let targetIndex = 0
  while (queryIndex < normalizedQuery.length && targetIndex < normalizedTarget.length) {
    if (normalizedQuery[queryIndex] === normalizedTarget[targetIndex]) {
      queryIndex += 1
    }
    targetIndex += 1
  }
  return queryIndex === normalizedQuery.length
}

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
  const [query, setQuery] = useState('')

  const filteredTerminals = useMemo(() => {
    return terminals.filter((terminal) => fuzzyMatch(query, terminal.label))
  }, [terminals, query])
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-header-top">
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
        <input
          className="explorer-search"
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cerca terminali"
        />
      </div>

      <div className="explorer-root-label">TERMINALI ATTIVI</div>

      <div className="sidebar-list">
        {filteredTerminals.map((terminal) => {
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

        {terminals.length > 0 && filteredTerminals.length === 0 && (
          <div className="empty-state">Nessun terminale trovato</div>
        )}
      </div>
    </aside>
  )
}
