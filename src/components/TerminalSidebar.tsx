import { useState, useMemo, type MouseEvent } from "react";
import TerminalGroup from "./TerminalGroup";
import ContextMenu from "./ContextMenu";
import TerminalActivityBar from "./TerminalActivityBar";
import type { TerminalInfo } from "../types";

const normalize = (value: string) => value.toLowerCase();
const fuzzyMatch = (query: string, target: string) => {
  if (!query) {
    return true;
  }
  const normalizedQuery = normalize(query);
  const normalizedTarget = normalize(target);
  let queryIndex = 0;
  let targetIndex = 0;
  while (
    queryIndex < normalizedQuery.length &&
    targetIndex < normalizedTarget.length
  ) {
    if (normalizedQuery[queryIndex] === normalizedTarget[targetIndex]) {
      queryIndex += 1;
    }
    targetIndex += 1;
  }
  return queryIndex === normalizedQuery.length;
};

interface TerminalSidebarProps {
  terminals: TerminalInfo[];
  activeId: string | null;
  creating: boolean;
  collapsedGroups: Set<string>;
  onAdd: () => void;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onColorChange: (id: string, color: string) => void;
  onEdit: (terminal: TerminalInfo) => void;
  onToggleGroup: (cwd: string) => void;
  onReorder: (reorderedIds: string[]) => void;
  onToggleProcesses: () => void;
  processesOpen: boolean;
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
  onReorder,
  onToggleProcesses,
  processesOpen,
}: TerminalSidebarProps) {
  void _onColorChange;
  const [query, setQuery] = useState("");
  const [contextMenu, setContextMenu] = useState<{
    position: { x: number; y: number };
    terminal: TerminalInfo;
  } | null>(null);

  const filteredTerminals = useMemo(() => {
    return terminals.filter((terminal) => fuzzyMatch(query, terminal.label));
  }, [terminals, query]);

  // Group terminals by cwd
  const { groups, ungrouped } = useMemo(() => {
    const groupMap: Record<string, TerminalInfo[]> = {};
    const ungroupedList: TerminalInfo[] = [];

    filteredTerminals.forEach((terminal) => {
      const cwdKey = terminal.cwd;
      if (!groupMap[cwdKey]) {
        groupMap[cwdKey] = [];
      }
      groupMap[cwdKey].push(terminal);
    });

    // Separate grouped (2+ terminals) from ungrouped (1 terminal)
    const groupedEntries: [string, TerminalInfo[]][] = [];
    Object.entries(groupMap).forEach(([cwd, terms]) => {
      if (terms.length > 1) {
        groupedEntries.push([cwd, terms]);
      } else {
        ungroupedList.push(...terms);
      }
    });

    // Mantieni ordine originale, non riordinare automaticamente
    // groupedEntries.sort(...) rimosso per preservare ordine fisso

    return {
      groups: groupedEntries,
      ungrouped: ungroupedList,
    };
  }, [filteredTerminals]);

  const handleContextMenu = (event: MouseEvent, terminal: TerminalInfo) => {
    event.preventDefault();
    setContextMenu({
      position: { x: event.clientX, y: event.clientY },
      terminal,
    });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  const handleMoveUp = (id: string) => {
    const currentIds = terminals.map((t) => t.id);
    const index = currentIds.indexOf(id);
    if (index <= 0) return; // Già in cima

    const reordered = [...currentIds];
    reordered.splice(index, 1);
    reordered.splice(index - 1, 0, id);
    onReorder(reordered);
  };

  const handleMoveDown = (id: string) => {
    const currentIds = terminals.map((t) => t.id);
    const index = currentIds.indexOf(id);
    if (index === -1 || index >= currentIds.length - 1) return; // Già in fondo

    const reordered = [...currentIds];
    reordered.splice(index, 1);
    reordered.splice(index + 1, 0, id);
    onReorder(reordered);
  };

  // Handlers per muovere gruppi interi
  const handleMoveGroupUp = (cwd: string) => {
    // Trova tutti i terminali del gruppo
    const groupTerminals = groups.find(([c]) => c === cwd)?.[1] || [];
    if (groupTerminals.length === 0) return;

    // Trova l'indice del primo terminale del gruppo nell'array globale
    const firstTerminalId = groupTerminals[0].id;
    const currentIds = terminals.map((t) => t.id);
    const firstIndex = currentIds.indexOf(firstTerminalId);

    if (firstIndex <= 0) return; // Già in cima

    // Rimuovi tutti i terminali del gruppo
    const groupIds = groupTerminals.map(t => t.id);
    const withoutGroup = currentIds.filter(id => !groupIds.includes(id));

    // Reinserisci il gruppo una posizione prima
    const reordered = [...withoutGroup];
    reordered.splice(firstIndex - 1, 0, ...groupIds);
    onReorder(reordered);
  };

  const handleMoveGroupDown = (cwd: string) => {
    // Trova tutti i terminali del gruppo
    const groupTerminals = groups.find(([c]) => c === cwd)?.[1] || [];
    if (groupTerminals.length === 0) return;

    // Trova l'indice dell'ultimo terminale del gruppo nell'array globale
    const lastTerminalId = groupTerminals[groupTerminals.length - 1].id;
    const currentIds = terminals.map((t) => t.id);
    const lastIndex = currentIds.indexOf(lastTerminalId);

    if (lastIndex === -1 || lastIndex >= currentIds.length - 1) return; // Già in fondo

    // Rimuovi tutti i terminali del gruppo
    const groupIds = groupTerminals.map(t => t.id);
    const withoutGroup = currentIds.filter(id => !groupIds.includes(id));

    // Reinserisci il gruppo una posizione dopo
    const reordered = [...withoutGroup];
    reordered.splice(lastIndex, 0, ...groupIds);
    onReorder(reordered);
  };
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-header-top">
          <span className="sidebar-title">Quack Agents</span>
          <button
            type="button"
            className="sidebar-button"
            onClick={onAdd}
            disabled={creating}
          >
            {creating ? "Creating…" : "New"}
          </button>
        </div>
        <input
          className="explorer-search"
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search agents"
        />
      </div>

      <div className="explorer-root-label sidebar-terminals-label">
        ACTIVE AGENTS
      </div>

      <div className="sidebar-list">
        {/* Render grouped terminals */}
        {groups.map(([cwd, groupTerminals]) => {
          // Calcola se il gruppo può muoversi su/giù
          const firstTerminalId = groupTerminals[0]?.id;
          const lastTerminalId = groupTerminals[groupTerminals.length - 1]?.id;
          const firstIndex = terminals.findIndex(t => t.id === firstTerminalId);
          const lastIndex = terminals.findIndex(t => t.id === lastTerminalId);

          const canGroupMoveUp = firstIndex > 0;
          const canGroupMoveDown = lastIndex < terminals.length - 1;

          return (
            <TerminalGroup
              key={cwd}
              cwd={cwd}
              terminals={groupTerminals}
              isCollapsed={collapsedGroups.has(cwd)}
              activeId={activeId}
              canGroupMoveUp={canGroupMoveUp}
              canGroupMoveDown={canGroupMoveDown}
              onToggle={() => onToggleGroup(cwd)}
              onSelect={onSelect}
              onClose={onClose}
              onContextMenu={handleContextMenu}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
              onMoveGroupUp={handleMoveGroupUp}
              onMoveGroupDown={handleMoveGroupDown}
            />
          );
        })}

        {/* Render ungrouped terminals */}
        {ungrouped.map((terminal) => {
          const active = terminal.id === activeId;
          const itemClasses = [
            "terminal-item",
            "terminal-item-ungrouped",
            active ? "active" : "",
            terminal.alive ? "" : "inactive",
          ]
            .filter(Boolean)
            .join(" ");

          const terminalIndex = terminals.findIndex(t => t.id === terminal.id);
          const canMoveUp = terminalIndex > 0;
          const canMoveDown = terminalIndex < terminals.length - 1;

          return (
            <div
              key={terminal.id}
              className={itemClasses}
              onClick={() => onSelect(terminal.id)}
              onContextMenu={(event) => handleContextMenu(event, terminal)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(terminal.id);
                }
              }}
            >
              <TerminalActivityBar terminal={terminal} />
              <div className="terminal-reorder-controls">
                <button
                  type="button"
                  className="terminal-reorder-btn"
                  disabled={!canMoveUp}
                  aria-label="Sposta su"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleMoveUp(terminal.id);
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
                    event.stopPropagation();
                    handleMoveDown(terminal.id);
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
                  event.stopPropagation();
                  onClose(terminal.id);
                }}
              >
                ×
              </button>
            </div>
          );
        })}

        {terminals.length === 0 && (
          <div className="empty-state">
            <div>🦆 Quack quack!</div>
            <div>No active agents</div>
          </div>
        )}

        {terminals.length > 0 && filteredTerminals.length === 0 && (
          <div className="empty-state">No agents found</div>
        )}
      </div>

  <div className="sidebar-footer">
    <button
      type="button"
      className={`sidebar-footer-button ${processesOpen ? "active" : ""}`}
      onClick={onToggleProcesses}
    >
      <span className="sidebar-footer-dot" aria-hidden="true" />
      Processes
    </button>
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
  );
}
