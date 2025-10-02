import { useState, useMemo, type MouseEvent } from 'react'
import TerminalGroup from './TerminalGroup'
import ContextMenu from './ContextMenu'
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
  collapsedGroups: Set<string>
  onAdd: () => void
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onColorChange: (id: string, color: string) => void
  onEdit: (terminal: TerminalInfo) => void
  onToggleGroup: (cwd: string) => void
}

export default function TerminalSidebar({
  terminals,
  activeId,
  creating,
  collapsedGroups,
  onAdd,
  onSelect,
  onClose,
  onColorChange: _onColorChange,
  onEdit,
  onToggleGroup,
}: TerminalSidebarProps) {
  const [query, setQuery] = useState('')
  const [contextMenu, setContextMenu] = useState<{
    position: { x: number; y: number }
    terminal: TerminalInfo
  } | null>(null)

  const filteredTerminals = useMemo(() => {
    return terminals.filter((terminal) => fuzzyMatch(query, terminal.label))
  }, [terminals, query])

  // Group terminals by cwd
  const { groups, ungrouped } = useMemo(() => {
    const groupMap: Record<string, TerminalInfo[]> = {}
    const ungroupedList: TerminalInfo[] = []

    filteredTerminals.forEach((terminal) => {
      const cwdKey = terminal.cwd
      if (!groupMap[cwdKey]) {
        groupMap[cwdKey] = []
      }
      groupMap[cwdKey].push(terminal)
    })

    // Separate grouped (2+ terminals) from ungrouped (1 terminal)
    const groupedEntries: [string, TerminalInfo[]][] = []
    Object.entries(groupMap).forEach(([cwd, terms]) => {
      if (terms.length > 1) {
        groupedEntries.push([cwd, terms])
      } else {
        ungroupedList.push(...terms)
      }
    })

    // Sort groups: active group first, then by recent activity
    groupedEntries.sort(([_cwdA, termsA], [_cwdB, termsB]) => {
      const hasActiveA = termsA.some(t => t.id === activeId)
      const hasActiveB = termsB.some(t => t.id === activeId)
      if (hasActiveA && !hasActiveB) return -1
      if (!hasActiveA && hasActiveB) return 1
      return 0 // Keep order for rest
    })

    return {
      groups: groupedEntries,
      ungrouped: ungroupedList,
    }
  }, [filteredTerminals, activeId])

  const handleContextMenu = (event: MouseEvent, terminal: TerminalInfo) => {
    event.preventDefault()
    setContextMenu({
      position: { x: event.clientX, y: event.clientY },
      terminal,
    })
  }

  const closeContextMenu = () => {
    setContextMenu(null)
  }
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
        {/* Render grouped terminals */}
        {groups.map(([cwd, groupTerminals]) => (
          <TerminalGroup
            key={cwd}
            cwd={cwd}
            terminals={groupTerminals}
            isCollapsed={collapsedGroups.has(cwd)}
            activeId={activeId}
            onToggle={() => onToggleGroup(cwd)}
            onSelect={onSelect}
            onClose={onClose}
            onContextMenu={handleContextMenu}
          />
        ))}

        {/* Render ungrouped terminals */}
        {ungrouped.map((terminal) => {
          const active = terminal.id === activeId
          const itemClasses = [
            'terminal-item',
            'terminal-item-ungrouped',
            active ? 'active' : '',
            terminal.alive ? '' : 'inactive',
          ].filter(Boolean).join(' ')
          return (
            <div
              key={terminal.id}
              className={itemClasses}
              onClick={() => onSelect(terminal.id)}
              onContextMenu={(event) => handleContextMenu(event, terminal)}
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

        {terminals.length === 0 && (
          <div className="empty-state">
            <div>🦆 Quack quack!</div>
            <div>Nessun terminale attivo</div>
          </div>
        )}

        {terminals.length > 0 && filteredTerminals.length === 0 && (
          <div className="empty-state">Nessun terminale trovato</div>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          position={contextMenu.position}
          terminal={contextMenu.terminal}
          onEdit={() => onEdit(contextMenu.terminal)}
          onClose={closeContextMenu}
          onCopyPath={() => {
            // Copy handled inside ContextMenu
          }}
          onCloseTerminal={() => onClose(contextMenu.terminal.id)}
        />
      )}
    </aside>
  )
}
