import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  activeAiChatId,
  useStore,
  type AIChatDescriptor,
  type WorkspaceData,
} from "../store";
import {
  getAgentStatus,
  isSeen,
  markSeen,
  resolveDisplayStatus,
  subscribeAgentStatus,
  type DisplayStatus,
} from "../agentStatusStore";
import {
  getWorkspaceColor,
  subscribeWorkspaceColors,
  type WorkspaceColor,
} from "../workspaceColors";
import {
  isSectionCollapsed,
  subscribeHubCollapsed,
  toggleSectionCollapsed,
  useHubExpanded,
  setHubExpanded,
} from "../hubPrefs";
import {
  getChatDiff,
  hydrateChatDiff,
  subscribeChatDiff,
  type SessionDiffSummary,
} from "../chatDiffStore";
import { fileBase } from "../sessionDiffStats";
import { pulseChatSwitch } from "../chatSwitch";
import { AgentCustomizations } from "./AgentCustomizations";
import {
  CustomizationsModal,
  type CustomizationTab,
} from "./CustomizationsModal";
import { AIIcon } from "./AIIcon";
import { Icon } from "./Icon";

// One flattened chat across all open workspaces, with its derived status
// and project color — the unit the hub groups and renders.
interface HubEntry {
  wsId: string;
  ws: WorkspaceData;
  chat: AIChatDescriptor;
  status: DisplayStatus;
  color: WorkspaceColor | null;
}

// Status groups, in attention order (top = most urgent). `archived` is not
// a group — those chats are filtered out entirely.
const GROUPS: Array<{ status: DisplayStatus; label: string }> = [
  { status: "error", label: "Error" },
  { status: "needs-input", label: "Needs input" },
  { status: "working", label: "Working" },
  { status: "ready", label: "Ready" },
  { status: "done", label: "Done" },
];

function lifecycleOf(chat: AIChatDescriptor): "active" | "done" | "archived" {
  if (chat.archivedAt) return "archived";
  if (chat.doneAt) return "done";
  return "active";
}

// Two-letter project initials for the color badge (clones AgentModeShell).
function initials(name: string): string {
  const parts = name.trim().split(/[\s_\-./]+/).filter(Boolean);
  if (parts.length === 0) return "··";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

interface AIChatsRailProps {
  /** Stack rail (editor) vs agent-mode left sidebar — always expanded. */
  placement?: "stack" | "agent-sidebar";
  /** Agent mode: no `ai:` tab — parent owns the focused session id. */
  activeChatId?: string | null;
  onSelectChat?: (wsId: string, chatId: string) => void;
  onNewChat?: (wsId: string) => void;
  onCloseChat?: (wsId: string, chatId: string) => void;
  /** Rendered below customizations (tasks, exit, …). */
  footer?: ReactNode;
}

export function AIChatsRail({
  placement = "stack",
  activeChatId: activeChatIdOverride,
  onSelectChat,
  onNewChat,
  onCloseChat,
  footer,
}: AIChatsRailProps = {}) {
  const inSidebar = placement === "agent-sidebar";
  const loaded = useStore((s) => s.loaded);
  const activeId = useStore((s) => s.activeId);
  const sidebarSide = useStore((s) =>
    s.activeId ? (s.loaded[s.activeId]?.layout.sidebarSide ?? "left") : "left",
  );
  const setActiveWorkspace = useStore((s) => s.setActiveWorkspace);
  const focusAIChat = useStore((s) => s.focusAIChat);
  const addAIChat = useStore((s) => s.addAIChat);
  const closeAIChat = useStore((s) => s.closeAIChat);
  const renameAIChat = useStore((s) => s.renameAIChat);
  const setAIChatLifecycle = useStore((s) => s.setAIChatLifecycle);
  const hubExpanded = useHubExpanded();
  const expanded = inSidebar || hubExpanded;

  // Re-render on status / color / section changes (module-level stores).
  const [, setTick] = useState(0);
  useEffect(() => {
    const force = () => setTick((t) => t + 1);
    const offs = [
      subscribeAgentStatus(force),
      subscribeWorkspaceColors(force),
      subscribeHubCollapsed(force),
      subscribeChatDiff(force),
    ];
    return () => offs.forEach((f) => f());
  }, []);

  const [menu, setMenu] = useState<{ entry: HubEntry; x: number; y: number } | null>(
    null,
  );
  const [renaming, setRenaming] = useState<string | null>(null);
  const [custTab, setCustTab] = useState<CustomizationTab | null>(null);

  // The chat the user is currently looking at (for highlight).
  const activeChatId =
    activeChatIdOverride !== undefined
      ? activeChatIdOverride
      : activeId && loaded[activeId]
        ? activeAiChatId(loaded[activeId])
        : null;

  // Flatten every open workspace's chats, drop archived, attach status.
  const entries: HubEntry[] = [];
  for (const [wsId, ws] of Object.entries(loaded)) {
    const color = getWorkspaceColor(wsId);
    for (const chat of Object.values(ws.aiChats)) {
      const status = resolveDisplayStatus({
        lifecycle: lifecycleOf(chat),
        live: getAgentStatus(chat.id),
        seen: isSeen(chat.id),
      });
      if (status === "archived") continue;
      entries.push({ wsId, ws, chat, status, color });
    }
  }

  const focusChat = async (wsId: string, chatId: string) => {
    markSeen(chatId);
    if (onSelectChat) {
      onSelectChat(wsId, chatId);
      return;
    }
    const current =
      activeId && loaded[activeId] ? activeAiChatId(loaded[activeId]) : null;
    if (chatId !== current || wsId !== activeId) pulseChatSwitch();
    if (wsId !== activeId) await setActiveWorkspace(wsId);
    focusAIChat(wsId, chatId);
  };

  const closeChat = (wsId: string, chatId: string) => {
    closeAIChat(wsId, chatId);
    onCloseChat?.(wsId, chatId);
  };

  const newChat = () => {
    if (!activeId) return;
    if (onNewChat) {
      onNewChat(activeId);
      return;
    }
    pulseChatSwitch();
    addAIChat(activeId, "editor");
  };

  const totalChats = entries.length;
  const activeRoot = activeId ? loaded[activeId]?.meta.root ?? "" : "";

  useEffect(() => {
    for (const e of entries) {
      hydrateChatDiff(e.chat.id, e.wsId, e.chat.sessionId);
    }
  }, [totalChats, activeId, loaded]);

  return (
    <div
      className={`agent-hub ${expanded ? "expanded" : ""}${inSidebar ? " agent-hub--sidebar" : ""}`}
      data-rail-side={inSidebar ? "left" : sidebarSide === "left" ? "right" : "left"}
    >
      <div className="agent-hub-header">
        <button
          className="agent-hub-add"
          onClick={newChat}
          title="New AI chat"
          aria-label="New AI chat"
          disabled={!activeId}
        >
          <AIIcon size={expanded ? 14 : 22} />
          {!expanded && (
            <span className="agent-hub-plus" aria-hidden="true">
              <Icon name="plus" size={10} />
            </span>
          )}
          {expanded && <span className="agent-hub-add-label">New chat</span>}
          {expanded && (
            <span className="agent-hub-add-hint" aria-hidden="true">
              <Icon name="plus" size={12} />
            </span>
          )}
        </button>
        {!inSidebar && (
          <button
            className="agent-hub-toggle"
            onClick={() => setHubExpanded(!hubExpanded)}
            title={expanded ? "Collapse hub" : "Expand hub"}
            aria-label={expanded ? "Collapse agent hub" : "Expand agent hub"}
            aria-expanded={expanded}
          >
            <Icon
              name={
                (expanded && sidebarSide === "left") ||
                (!expanded && sidebarSide !== "left")
                  ? "chevron-right"
                  : "chevron-left"
              }
              size={12}
            />
          </button>
        )}
      </div>

      <div className="agent-hub-list">
        <div className="agent-hub-list-body">
          {totalChats === 0 && (
            <div className="agent-hub-empty" title="No AI chats yet">
              {expanded ? (
                <>
                  <AIIcon size={32} className="agent-hub-empty-mark" />
                  <span className="agent-hub-empty-title">No chats yet</span>
                  <span className="agent-hub-empty-hint">
                    Start a new one with the button above.
                  </span>
                </>
              ) : (
                "·"
              )}
            </div>
          )}
          {GROUPS.map(({ status, label }) => {
            const items = entries
              .filter((e) => e.status === status)
              .sort(byRecency);
            if (items.length === 0) return null;
            return (
              <HubSection
                key={status}
                status={status}
                label={label}
                count={items.length}
                expanded={expanded}
              >
                {items.map((entry) => (
                  <HubRow
                    key={entry.chat.id}
                    entry={entry}
                    expanded={expanded}
                    active={
                      entry.wsId === activeId && entry.chat.id === activeChatId
                    }
                    renaming={renaming === entry.chat.id}
                    onClick={() => focusChat(entry.wsId, entry.chat.id)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setMenu({ entry, x: e.clientX, y: e.clientY });
                    }}
                    onClose={() => closeChat(entry.wsId, entry.chat.id)}
                    onRename={(title) => {
                      if (title.trim())
                        renameAIChat(entry.wsId, entry.chat.id, title.trim());
                      setRenaming(null);
                    }}
                    onRenameCancel={() => setRenaming(null)}
                  />
                ))}
              </HubSection>
            );
          })}
        </div>
        {expanded && (
          <AgentCustomizations onOpen={(t) => setCustTab(t)} />
        )}
        {footer}
      </div>

      <CustomizationsModal
        open={!!custTab}
        initialTab={custTab ?? "instructions"}
        onClose={() => setCustTab(null)}
        root={activeRoot}
      />

      {menu && (
        <HubContextMenu
          entry={menu.entry}
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          onRename={() => {
            setRenaming(menu.entry.chat.id);
            setMenu(null);
          }}
          onLifecycle={(state) => {
            setAIChatLifecycle(menu.entry.wsId, menu.entry.chat.id, state);
            setMenu(null);
          }}
        />
      )}
    </div>
  );
}

function byRecency(a: HubEntry, b: HubEntry): number {
  const at = getAgentStatus(a.chat.id)?.lastTransitionAt ?? a.chat.createdAt;
  const bt = getAgentStatus(b.chat.id)?.lastTransitionAt ?? b.chat.createdAt;
  return bt - at;
}

interface SectionProps {
  status: DisplayStatus;
  label: string;
  count: number;
  expanded: boolean;
  children: React.ReactNode;
}

function HubSection({ status, label, count, expanded, children }: SectionProps) {
  const collapsed = isSectionCollapsed(status);
  if (!expanded) {
    // Collapsed rail: no headers, just the dots stacked by group order.
    return <div className={`agent-hub-section status-${status}`}>{children}</div>;
  }
  return (
    <div className={`agent-hub-section status-${status}`}>
      <button
        className="agent-hub-section-head"
        onClick={() => toggleSectionCollapsed(status)}
        aria-expanded={!collapsed}
      >
        <Icon name={collapsed ? "chevron-right" : "chevron-down"} size={11} />
        <span className="agent-hub-section-label">{label}</span>
        <span className="agent-hub-section-count">{count}</span>
      </button>
      {!collapsed && children}
    </div>
  );
}

interface RowProps {
  entry: HubEntry;
  expanded: boolean;
  active: boolean;
  renaming: boolean;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onClose: () => void;
  onRename: (title: string) => void;
  onRenameCancel: () => void;
}

function HubRow({
  entry,
  expanded,
  active,
  renaming,
  onClick,
  onContextMenu,
  onClose,
  onRename,
  onRenameCancel,
}: RowProps) {
  const { chat, ws, color, status } = entry;
  const badge = initials(ws.meta.name);
  const diff = expanded ? getChatDiff(chat.id) : undefined;
  return (
    <div
      className={`agent-hub-row ${active ? "active" : ""}${diff ? " has-diff" : ""}`}
      data-status={status}
      role="tab"
      tabIndex={0}
      aria-selected={active}
      aria-label={`${chat.title} — ${ws.meta.name}`}
      title={`${chat.title}\n${ws.meta.name} · ${status}`}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onKeyDown={(e) => {
        if (renaming) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        } else if (
          (e.key === "Delete" || e.key === "Backspace") &&
          !e.repeat
        ) {
          e.preventDefault();
          onClose();
        }
      }}
    >
      <span className={`agent-hub-dot ${status}`} aria-hidden="true" />
      <span
        className={`agent-hub-badge ${color ? "has-color" : ""}`}
        style={
          color
            ? ({ "--ws-color": color.hex } as React.CSSProperties)
            : undefined
        }
        title={ws.meta.name}
        aria-hidden="true"
      >
        {badge}
      </span>
      {expanded &&
        (renaming ? (
          <RenameInput
            initial={chat.title}
            onCommit={onRename}
            onCancel={onRenameCancel}
          />
        ) : diff ? (
          <div className="agent-hub-row-body">
            <span className="agent-hub-row-title">{chat.title}</span>
            <HubDiffLine summary={diff} />
          </div>
        ) : (
          <span className="agent-hub-row-title">{chat.title}</span>
        ))}
      {expanded && !renaming && (
        <button
          className="agent-hub-row-close"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          title="Close chat"
          aria-label={`Close chat ${chat.title}`}
        >
          <Icon name="x" size={10} />
        </button>
      )}
    </div>
  );
}

function DiffCounts({
  added,
  removed,
}: {
  added: number;
  removed: number;
}) {
  if (added === 0 && removed === 0) return null;
  return (
    <>
      {" "}
      {removed > 0 && (
        <span className="agent-hub-diff-del">−{removed}</span>
      )}
      {removed > 0 && added > 0 && " "}
      {added > 0 && <span className="agent-hub-diff-add">+{added}</span>}
    </>
  );
}

function HubDiffLine({ summary }: { summary: SessionDiffSummary }) {
  if (summary.files.length === 1) {
    return (
      <span className="agent-hub-row-diff">
        Edited {fileBase(summary.files[0])}
        <DiffCounts added={summary.added} removed={summary.removed} />
      </span>
    );
  }
  const n = summary.files.length;
  return (
    <span className="agent-hub-row-diff">
      <DiffCounts added={summary.added} removed={summary.removed} />
      {n > 0 && (summary.added > 0 || summary.removed > 0) && " · "}
      {n > 0 && `${n} ${n === 1 ? "file" : "files"}`}
    </span>
  );
}

function RenameInput({
  initial,
  onCommit,
  onCancel,
}: {
  initial: string;
  onCommit: (v: string) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  return (
    <input
      ref={ref}
      className="agent-hub-rename"
      defaultValue={initial}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") onCommit(e.currentTarget.value);
        else if (e.key === "Escape") onCancel();
      }}
      onBlur={(e) => onCommit(e.currentTarget.value)}
    />
  );
}

interface MenuProps {
  entry: HubEntry;
  x: number;
  y: number;
  onClose: () => void;
  onRename: () => void;
  onLifecycle: (state: "active" | "done" | "archived") => void;
}

function HubContextMenu({ entry, x, y, onClose, onRename, onLifecycle }: MenuProps) {
  const isDone = !!entry.chat.doneAt;
  return createPortal(
    <>
      <div className="ws-color-overlay" onClick={onClose} />
      <div
        className="agent-hub-menu liquid-glass"
        style={{ left: x, top: y }}
        role="menu"
        aria-label="Chat actions"
      >
        <button className="agent-hub-menu-item" onClick={onRename}>
          Rename
        </button>
        <button
          className="agent-hub-menu-item"
          onClick={() => onLifecycle(isDone ? "active" : "done")}
        >
          {isDone ? "Reopen" : "Mark done"}
        </button>
        <button
          className="agent-hub-menu-item"
          onClick={() => onLifecycle("archived")}
        >
          Archive
        </button>
      </div>
    </>,
    document.body,
  );
}
