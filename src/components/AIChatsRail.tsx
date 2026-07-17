import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import { addNewAIChat, anchorFromElement } from "../addNewAIChat";
import { pulseChatSwitch } from "../chatSwitch";
import { logChatSwitch } from "../chatSwitchDebug";
import { deleteSession } from "../chatHistory";
import { confirm as dialogConfirm } from "../dialog";
import { AgentCustomizations } from "./AgentCustomizations";
import {
  CustomizationsModal,
  type CustomizationTab,
} from "./CustomizationsModal";
import { AIIcon } from "./AIIcon";
import { ContextMenu } from "./ContextMenu";
import { Icon } from "./Icon";
import { WorkHubBadge } from "./works/WorkHubBadge";

// One flattened chat across all open workspaces, with its derived status
// and project color — the unit the hub groups and renders.
interface HubEntry {
  wsId: string;
  ws: WorkspaceData;
  chat: AIChatDescriptor;
  status: DisplayStatus;
  color: WorkspaceColor | null;
}

// Status groups, in attention order (top = most urgent). Finished chats
// (done + legacy archived) live in a separate searchable Done section.
const DONE_PREVIEW = 10;
const DONE_SEARCH_CAP = 30;

const GROUPS: Array<{ status: DisplayStatus; label: string }> = [
  { status: "error", label: "Error" },
  { status: "needs-input", label: "Needs input" },
  { status: "working", label: "Working" },
  { status: "ready", label: "Ready" },
];

function isDonePile(chat: AIChatDescriptor): boolean {
  return !!(chat.doneAt || chat.archivedAt);
}

// Two-letter project initials for the color badge (clones AgentModeShell).
function initials(name: string): string {
  const parts = name.trim().split(/[\s_\-./]+/).filter(Boolean);
  if (parts.length === 0) return "··";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// Collapsed chip: first chat-title letter so same-project rows differ.
function chipLetter(title: string, wsName: string): string {
  const t = title.trim();
  if (t.length > 0) return t[0]!.toUpperCase();
  return initials(wsName)[0] ?? "?";
}

function useHubPeek(enabled: boolean) {
  const [peeking, setPeeking] = useState(false);
  const leaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEnter = () => {
    if (!enabled) return;
    if (leaveRef.current) clearTimeout(leaveRef.current);
    setPeeking(true);
  };
  const onLeave = () => {
    if (!enabled) return;
    leaveRef.current = setTimeout(() => setPeeking(false), 320);
  };
  useEffect(
    () => () => {
      if (leaveRef.current) clearTimeout(leaveRef.current);
    },
    [],
  );
  return { peeking, onEnter, onLeave };
}

interface AIChatsRailProps {
  /** Stack rail (editor) vs agent-mode left sidebar — always expanded. */
  placement?: "stack" | "agent-sidebar";
  /** Agent mode: no `ai:` tab — parent owns the focused session id. */
  activeChatId?: string | null;
  onSelectChat?: (wsId: string, chatId: string) => void;
  onNewChat?: (wsId: string, anchor: { x: number; y: number }) => void;
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
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const closeAIChat = useStore((s) => s.closeAIChat);
  const renameAIChat = useStore((s) => s.renameAIChat);
  const setAIChatLifecycle = useStore((s) => s.setAIChatLifecycle);
  const hubExpanded = useHubExpanded();
  const expanded = inSidebar || hubExpanded;
  const peekEnabled = !inSidebar && !hubExpanded;
  const { peeking, onEnter: onPeekEnter, onLeave: onPeekLeave } =
    useHubPeek(peekEnabled);
  const showExpanded = expanded || peeking;
  const railSide = inSidebar ? "left" : sidebarSide === "left" ? "right" : "left";

  // Re-render on status / color / section changes (module-level stores).
  const [tick, setTick] = useState(0);
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
  const [doneSearch, setDoneSearch] = useState("");

  // The chat the user is currently looking at (for highlight).
  const activeChatId =
    activeChatIdOverride !== undefined
      ? activeChatIdOverride
      : activeId && loaded[activeId]
        ? activeAiChatId(loaded[activeId])
        : null;

  // Finished pile: manual done + legacy archived (one searchable section).
  const doneSorted = useMemo(() => {
    const pile: HubEntry[] = [];
    for (const [wsId, ws] of Object.entries(loaded)) {
      const color = getWorkspaceColor(wsId);
      for (const chat of Object.values(ws.aiChats)) {
        if (!isDonePile(chat)) continue;
        pile.push({ wsId, ws, chat, status: "done", color });
      }
    }
    return pile.sort((a, b) => b.chat.createdAt - a.chat.createdAt);
  }, [loaded]);

  // `tick` MUST be a dep — status lives in agentStatusStore, not `loaded`.
  // Without it, Working/Ready stayed frozen until a chat switch mutated the store.
  const entries = useMemo(() => {
    const out: HubEntry[] = [];
    for (const [wsId, ws] of Object.entries(loaded)) {
      const color = getWorkspaceColor(wsId);
      for (const chat of Object.values(ws.aiChats)) {
        if (isDonePile(chat)) continue;
        const status = resolveDisplayStatus({
          lifecycle: "active",
          live: getAgentStatus(chat.id),
          seen: isSeen(chat.id),
        });
        out.push({ wsId, ws, chat, status, color });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tick = status/seen/diff/color
  }, [loaded, tick]);

  const doneVisible = useMemo(() => {
    const q = doneSearch.trim().toLowerCase();
    if (q) {
      return doneSorted
        .filter(
          (e) =>
            e.chat.title.toLowerCase().includes(q) ||
            e.ws.meta.name.toLowerCase().includes(q),
        )
        .slice(0, DONE_SEARCH_CAP);
    }
    return doneSorted.slice(0, DONE_PREVIEW);
  }, [doneSorted, doneSearch]);

  const doneRailItems = useMemo(() => {
    if (showExpanded) return doneVisible;
    return doneSorted.slice(0, DONE_PREVIEW);
  }, [showExpanded, doneVisible, doneSorted]);

  const focusChat = async (wsId: string, chatId: string) => {
    markSeen(chatId);
    if (onSelectChat) {
      onSelectChat(wsId, chatId);
      return;
    }
    const current =
      activeId && loaded[activeId] ? activeAiChatId(loaded[activeId]) : null;
    const crossWs = wsId !== activeId;
    if (chatId !== current || crossWs) {
      logChatSwitch("rail focus", { chatId, current, crossWs, wsId });
      pulseChatSwitch({
        veil: true,
        flush: crossWs,
        flushWsId: crossWs ? (activeId ?? undefined) : undefined,
        source: "AIChatsRail.focusChat",
        chatId,
      });
    }
    if (crossWs) await setActiveWorkspace(wsId);
    focusAIChat(wsId, chatId);
  };

  const closeChat = (wsId: string, chatId: string) => {
    closeAIChat(wsId, chatId);
    onCloseChat?.(wsId, chatId);
  };

  const deleteChat = async (entry: HubEntry) => {
    const title = entry.chat.title.trim() || "Untitled";
    const ok = await dialogConfirm(
      `Delete "${title}"? The transcript will be removed permanently.`,
      { title: "Delete chat", okLabel: "Delete", danger: true },
    );
    if (!ok) return;
    deleteSession(entry.wsId, entry.chat.sessionId);
    closeChat(entry.wsId, entry.chat.id);
  };

  const newChat = (e?: React.MouseEvent<HTMLButtonElement>) => {
    if (!activeId) return;
    const anchor = anchorFromElement(e?.currentTarget ?? addBtnRef.current);
    if (onNewChat) {
      onNewChat(activeId, anchor);
      return;
    }
    addNewAIChat(activeId, "editor", anchor);
  };

  const totalChats = entries.length;
  const activeRoot = activeId ? loaded[activeId]?.meta.root ?? "" : "";
  const entryKeys = useMemo(
    () => entries.map((e) => `${e.wsId}:${e.chat.id}`).join("\0"),
    [entries],
  );

  useEffect(() => {
    for (const e of entries) {
      hydrateChatDiff(e.chat.id, e.wsId, e.chat.sessionId);
    }
  }, [entryKeys, entries]);

  const hubBody = (
    <div
      className={`agent-hub ${showExpanded ? "expanded" : ""}${peeking && !expanded ? " peeking" : ""}${inSidebar ? " agent-hub--sidebar" : ""}`}
      data-rail-side={railSide}
      onMouseEnter={peekEnabled ? onPeekEnter : undefined}
      onMouseLeave={peekEnabled ? onPeekLeave : undefined}
    >
      <div className="agent-hub-header">
        <button
          ref={addBtnRef}
          className="agent-hub-add"
          onClick={newChat}
          title="New AI chat"
          aria-label="New AI chat"
          disabled={!activeId}
        >
          <AIIcon size={showExpanded ? 14 : 20} />
          {!showExpanded && (
            <span className="agent-hub-plus" aria-hidden="true">
              <Icon name="plus" size={10} />
            </span>
          )}
          {showExpanded && <span className="agent-hub-add-label">New chat</span>}
          {showExpanded && (
            <span className="agent-hub-add-hint" aria-hidden="true">
              <Icon name="plus" size={12} />
            </span>
          )}
        </button>
        {!inSidebar && (
          <button
            className="agent-hub-toggle"
            onClick={() => setHubExpanded(!hubExpanded)}
            title={hubExpanded ? "Collapse hub" : "Expand hub — or hover the rail"}
            aria-label={hubExpanded ? "Collapse agent hub" : "Expand agent hub"}
            aria-expanded={hubExpanded}
          >
            <Icon
              name={
                (showExpanded && sidebarSide === "left") ||
                (!showExpanded && sidebarSide !== "left")
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
              {showExpanded ? (
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
                expanded={showExpanded}
              >
                {items.map((entry) => (
                  <HubRow
                    key={entry.chat.id}
                    entry={entry}
                    expanded={showExpanded}
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
          {doneSorted.length > 0 && (
            <HubSection
              status="done"
              label="Done"
              count={doneSorted.length}
              expanded={showExpanded}
              bulkActions={{
                onReopenAll: () => {
                  for (const e of doneSorted) {
                    setAIChatLifecycle(e.wsId, e.chat.id, "active");
                  }
                },
              }}
            >
              {showExpanded && !isSectionCollapsed("done") && (
                <>
                  <div className="agent-hub-done-search">
                    <Icon name="search" size={12} aria-hidden="true" />
                    <input
                      className="agent-hub-done-search-input"
                      value={doneSearch}
                      onChange={(e) => setDoneSearch(e.target.value)}
                      placeholder="Search done…"
                      aria-label="Search done chats"
                      onClick={(e) => e.stopPropagation()}
                    />
                    {doneSearch && (
                      <button
                        type="button"
                        className="agent-hub-done-search-clear"
                        title="Clear search"
                        aria-label="Clear search"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDoneSearch("");
                        }}
                      >
                        <Icon name="x" size={10} />
                      </button>
                    )}
                  </div>
                  {doneSorted.length > DONE_PREVIEW && !doneSearch.trim() && (
                    <div className="agent-hub-done-hint">
                      Latest {DONE_PREVIEW} of {doneSorted.length} — search for
                      more
                    </div>
                  )}
                  {doneSearch.trim() && doneVisible.length === 0 && (
                    <div className="agent-hub-done-hint">
                      No done chats match
                    </div>
                  )}
                </>
              )}
              {(showExpanded ? !isSectionCollapsed("done") : true) &&
                doneRailItems.map((entry) => (
                  <HubRow
                    key={entry.chat.id}
                    entry={entry}
                    expanded={showExpanded}
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
          )}
        </div>
        {showExpanded && (
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
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            {
              label: "Rename",
              onClick: () => setRenaming(menu.entry.chat.id),
            },
            ...(isDonePile(menu.entry.chat)
              ? [
                  {
                    label: "Reopen",
                    onClick: () =>
                      setAIChatLifecycle(
                        menu.entry.wsId,
                        menu.entry.chat.id,
                        "active",
                      ),
                  },
                ]
              : [
                  {
                    label: "Mark done",
                    onClick: () =>
                      setAIChatLifecycle(
                        menu.entry.wsId,
                        menu.entry.chat.id,
                        "done",
                      ),
                  },
                ]),
            "separator",
            {
              label: "Delete",
              danger: true,
              onClick: () => void deleteChat(menu.entry),
            },
          ]}
        />
      )}
    </div>
  );

  if (inSidebar) return hubBody;

  return (
    <div
      className={`agent-hub-shell${expanded ? " is-expanded" : ""}${peeking ? " is-peeking" : ""}`}
      data-rail-side={railSide}
    >
      {hubBody}
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
  bulkActions?: {
    onReopenAll: () => void;
  };
  children: React.ReactNode;
}

function HubSection({
  status,
  label,
  count,
  expanded,
  bulkActions,
  children,
}: SectionProps) {
  const collapsed = isSectionCollapsed(status);
  if (!expanded) {
    // Collapsed rail: no headers, just the dots stacked by group order.
    return <div className={`agent-hub-section status-${status}`}>{children}</div>;
  }
  return (
    <div className={`agent-hub-section status-${status}`}>
      <div className="agent-hub-section-head-row">
        <button
          className="agent-hub-section-head"
          onClick={() => toggleSectionCollapsed(status)}
          aria-expanded={!collapsed}
        >
          <Icon name={collapsed ? "chevron-right" : "chevron-down"} size={11} />
          <span className="agent-hub-section-label">{label}</span>
        </button>
        <span className="agent-hub-section-count">{count}</span>
        {bulkActions && count > 0 && (
          <HubSectionBulkMenu actions={bulkActions} />
        )}
      </div>
      {!collapsed && children}
    </div>
  );
}

function HubSectionBulkMenu({
  actions,
}: {
  actions: { onReopenAll: () => void };
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest(".agent-hub-section-menu")) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div className="agent-hub-section-menu-wrap">
      <button
        type="button"
        className={`agent-hub-section-menu-btn ${open ? "active" : ""}`}
        title="Done section actions"
        aria-label="Done section actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <Icon name="more-horizontal" size={12} />
      </button>
      {open && (
        <div className="agent-hub-section-menu liquid-glass" role="menu">
          <button
            type="button"
            className="agent-hub-section-menu-item"
            role="menuitem"
            onClick={() => {
              actions.onReopenAll();
              setOpen(false);
            }}
          >
            Reopen all
          </button>
        </div>
      )}
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
  const chip = expanded ? badge : chipLetter(chat.title, ws.meta.name);
  const diff = expanded ? getChatDiff(chat.id) : undefined;
  const collapsedTip = `${chat.title} · ${ws.meta.name}`;
  return (
    <div
      className={`agent-hub-row ${active ? "active" : ""}${diff ? " has-diff" : ""}${chat.workItemId ? " has-work" : ""}`}
      data-status={status}
      role="tab"
      tabIndex={0}
      aria-selected={active}
      aria-label={`${chat.title} — ${ws.meta.name}`}
      title={expanded ? undefined : collapsedTip}
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
        aria-hidden={expanded ? true : undefined}
      >
        {chip}
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
      {expanded && (
        <WorkHubBadge
          workItemId={chat.workItemId}
          storyId={chat.storyId}
          planning={chat.planning}
        />
      )}
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
