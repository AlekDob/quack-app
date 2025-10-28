import { useState, useMemo, type MouseEvent } from "react";
import TerminalGroup from "./TerminalGroup";
import ContextMenu from "./ContextMenu";
import type { TerminalInfo, AgentChat } from "../types";

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
  // Phase 4: AgentChat props
  agentChats: AgentChat[];
  activeAgentChatId: string | null;
  onSelectAgentChat: (agentChatId: string | null) => void;
  onDeleteAgentChat: (agentChatId: string) => void;
  onUpdateAgentChat: (agentChatId: string, updates: Partial<Omit<AgentChat, 'id'>>) => void;
  onCreateAgent: () => void; // NEW: Create AgentChat only (no terminal)
  // PiP props
  onTogglePip?: () => void;
  isPipOpen?: boolean;
  // Terminal props
  onAdd: () => void; // Will be used by "+" button for terminal creation
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onColorChange: (id: string, color: string) => void;
  onEdit: (terminal: TerminalInfo) => void;
  onDuplicate: (terminal: TerminalInfo) => void;
  onToggleGroup: (cwd: string) => void;
  onReorder: (reorderedIds: string[]) => void;
  onOpenSettings?: () => void; // NEW: Open settings panel
}

export default function TerminalSidebar({
  terminals,
  activeId,
  creating,
  collapsedGroups,
  // AgentChat props (unused - kept for backward compatibility)
  agentChats: _agentChats,
  activeAgentChatId: _activeAgentChatId,
  onSelectAgentChat: _onSelectAgentChat,
  onDeleteAgentChat: _onDeleteAgentChat,
  onUpdateAgentChat: _onUpdateAgentChat,
  onCreateAgent,
  // PiP props
  onTogglePip,
  isPipOpen,
  // Terminal props
  onAdd,
  onSelect,
  onClose,
  onColorChange: _onColorChange,
  onEdit,
  onDuplicate,
  onToggleGroup,
  onReorder,
  onOpenSettings,
}: TerminalSidebarProps) {
  void _onColorChange;
  void _onDeleteAgentChat; // Will be used in context menu (Phase 4)
  void _onUpdateAgentChat; // Will be used in rename functionality (Phase 4)
  void onAdd; // Used by "+" button in toolbar (kept for future use)
  const [query, setQuery] = useState("");
  const [contextMenu, setContextMenu] = useState<{
    position: { x: number; y: number };
    terminal: TerminalInfo;
  } | null>(null);

  // Filter terminals by query only
  const filteredTerminals = useMemo(() => {
    return terminals.filter((terminal) => fuzzyMatch(query, terminal.label));
  }, [terminals, query]);

  // SIMPLE: Group terminals by cwd only!
  const cwdGroups = useMemo(() => {
    const groupMap: Record<string, TerminalInfo[]> = {};

    filteredTerminals.forEach((terminal) => {
      const cwd = terminal.cwd || 'unknown';
      if (!groupMap[cwd]) {
        groupMap[cwd] = [];
      }
      groupMap[cwd].push(terminal);
    });

    // Just return cwd groups - no AgentChat mapping!
    const groups: Array<[string, TerminalInfo[]]> = Object.entries(groupMap);

    return { groups };
  }, [filteredTerminals]);

  // SIMPLE: Just select terminal - no AgentChat logic!
  const handleSelectTerminal = (terminal: TerminalInfo) => {
    onSelect(terminal.id);
  };

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

  // SIMPLE: Move groups by cwd
  const handleMoveGroupUp = (cwd: string) => {
    // Find all terminals in this cwd group
    const groupTerminals = cwdGroups.groups.find(([groupCwd]) => groupCwd === cwd)?.[1] || [];
    if (groupTerminals.length === 0) return;

    const firstTerminalId = groupTerminals[0].id;
    const currentIds = terminals.map((t) => t.id);
    const firstIndex = currentIds.indexOf(firstTerminalId);

    if (firstIndex <= 0) return; // Already at top

    const groupIds = groupTerminals.map((t) => t.id);
    const withoutGroup = currentIds.filter((id) => !groupIds.includes(id));

    const reordered = [...withoutGroup];
    reordered.splice(firstIndex - 1, 0, ...groupIds);
    onReorder(reordered);
  };

  const handleMoveGroupDown = (cwd: string) => {
    // Find all terminals in this cwd group
    const groupTerminals = cwdGroups.groups.find(([groupCwd]) => groupCwd === cwd)?.[1] || [];
    if (groupTerminals.length === 0) return;

    const lastTerminalId = groupTerminals[groupTerminals.length - 1].id;
    const currentIds = terminals.map((t) => t.id);
    const lastIndex = currentIds.indexOf(lastTerminalId);

    if (lastIndex === -1 || lastIndex >= currentIds.length - 1) return; // Already at bottom

    const groupIds = groupTerminals.map((t) => t.id);
    const withoutGroup = currentIds.filter((id) => !groupIds.includes(id));

    const reordered = [...withoutGroup];
    reordered.splice(lastIndex, 0, ...groupIds);
    onReorder(reordered);
  };
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-header-top">
          <span className="sidebar-title">Quack Agents</span>
          <div style={{ display: 'flex', gap: '6px' }}>
            {/* PiP Mode Button */}
            {onTogglePip && (
              <button
                type="button"
                className="sidebar-button"
                onClick={onTogglePip}
                style={{
                  background: isPipOpen ? 'rgba(242, 140, 82, 0.2)' : undefined,
                  borderColor: isPipOpen ? 'rgba(242, 140, 82, 0.4)' : undefined,
                  color: isPipOpen ? '#f28c52' : undefined,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                title={isPipOpen ? 'Close PiP Mode' : 'Open PiP Mode'}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="2" />
                  <rect x="8" y="8" width="8" height="8" rx="1" />
                </svg>
                PiP
              </button>
            )}
            {/* New Agent Button */}
            <button
              type="button"
              className="sidebar-button"
              onClick={onCreateAgent}
              disabled={creating}
            >
              {creating ? "Creating…" : "New"}
            </button>
          </div>
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
        {/* SIMPLE: Render cwd-based groups */}
        {cwdGroups.groups.map(([cwd, groupTerminals]) => {
          const firstTerminalId = groupTerminals[0]?.id;
          const lastTerminalId = groupTerminals[groupTerminals.length - 1]?.id;
          const firstIndex = firstTerminalId ? terminals.findIndex(t => t.id === firstTerminalId) : -1;
          const lastIndex = lastTerminalId ? terminals.findIndex(t => t.id === lastTerminalId) : -1;

          const canGroupMoveUp = firstIndex > 0;
          const canGroupMoveDown = lastIndex >= 0 && lastIndex < terminals.length - 1;

          const isCollapsed = collapsedGroups.has(cwd);

          return (
            <TerminalGroup
              key={cwd}
              cwd={cwd}
              terminals={groupTerminals}
              isCollapsed={isCollapsed}
              activeId={activeId}
              canGroupMoveUp={canGroupMoveUp}
              canGroupMoveDown={canGroupMoveDown}
              onToggle={() => onToggleGroup(cwd)}
              onSelect={handleSelectTerminal}
              onClose={onClose}
              onContextMenu={handleContextMenu}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
              onMoveGroupUp={() => handleMoveGroupUp(cwd)}
              onMoveGroupDown={() => handleMoveGroupDown(cwd)}
            />
          );
        })}

        {/* Empty state */}
        {terminals.length === 0 && (
          <div className="empty-state">
            <div>🦆 Quack quack!</div>
            <div>No terminals</div>
          </div>
        )}

        {terminals.length > 0 && cwdGroups.groups.length === 0 && (
          <div className="empty-state">No terminals found</div>
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
          onDuplicate={() => onDuplicate(contextMenu.terminal)}
          onCloseTerminal={() => onClose(contextMenu.terminal.id)}
        />
      )}

      {/* Settings Button */}
      {onOpenSettings && (
        <button
          type="button"
          className="sidebar-settings-button"
          onClick={onOpenSettings}
        >
          <div className="sidebar-settings-content">
            <div className="sidebar-settings-top">
              <svg className="sidebar-settings-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              <span className="sidebar-settings-label">Settings</span>
            </div>
            <span className="sidebar-settings-version">v1.0.0</span>
          </div>
        </button>
      )}
    </aside>
  );
}
