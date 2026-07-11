import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useStore, type SidebarView } from "../store";
import { getGitStatus, subscribeGitStatus } from "../gitStatusStore";
import { addNewAIChat, anchorFromElement } from "../addNewAIChat";
import { AIIcon } from "./AIIcon";
import { Icon } from "./Icon";
import { WorkspaceColorPopover } from "./WorkspaceColorPopover";
import { getWorkspaceColor, subscribeWorkspaceColors } from "../workspaceColors";
import { useWorkspaceReorder } from "../useWorkspaceReorder";

function initials(name: string): string {
  const parts = name.split(/[\s\-_.]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function ActivityBar() {
  const openIds = useStore((s) => s.openIds);
  const activeId = useStore((s) => s.activeId);
  const loaded = useStore((s) => s.loaded);
  const setActive = useStore((s) => s.setActiveWorkspace);
  const closeWs = useStore((s) => s.closeWorkspace);
  const recent = useStore((s) => s.recent);
  const removeRecent = useStore((s) => s.removeFromRecent);
  const openWs = useStore((s) => s.openWorkspace);
  const setSidebarVisible = useStore((s) => s.setSidebarVisible);

  const ws = activeId ? loaded[activeId] : null;
  const sections = ws?.layout.sidebarSections ?? [];
  const sidebarVisible = ws?.layout.sidebarVisible ?? true;
  const sidebarSide = ws?.layout.sidebarSide ?? "left";
  const toggleSidebarSection = useStore((s) => s.toggleSidebarSection);
  const setSidebarSide = useStore((s) => s.setSidebarSide);
  const setAIPanelVisible = useStore((s) => s.setAIPanelVisible);
  const aiPanelVisible = ws?.layout.aiPanelVisible ?? false;
  const wbOpen = useStore((s) => s.wbOpen);
  const usageOpen = useStore((s) => s.usageOpen);
  const brainOpen = useStore((s) => s.brainOpen);

  // Key of the focused pane's active tab — drives the "this tab is open
  // and focused" highlight on the Organigramma + Usage icons. Walks the
  // pane tree to find the active pane.
  const activeTabKey: string | null = ((): string | null => {
    if (!ws) return null;
    const root = ws.layout.editorRoot;
    const activePaneId = ws.layout.activePaneId;
    if (!activePaneId) return null;
    // Holder object so the closure assignment doesn't trip TS's control
    // flow narrowing (which kept collapsing the result to `never`).
    const holder: { tab: string | null } = { tab: null };
    const walk = (p: typeof root): void => {
      if (p.kind === "tabs") {
        if (p.id === activePaneId) holder.tab = p.active;
        return;
      }
      walk(p.first);
      if (!holder.tab) walk(p.second);
    };
    walk(root);
    return holder.tab;
  })();
  const whiteboardActive = !!activeTabKey && activeTabKey.startsWith("wb:");
  const usageActive = !!activeTabKey && activeTabKey.startsWith("usage:");
  const brainActive = !!activeTabKey && activeTabKey.startsWith("brain:");
  const hasSection = (v: SidebarView) =>
    sections.some((s) => s.view === v && !s.collapsed);
  const sectionActive = (v: SidebarView) => sidebarVisible && hasSection(v);

  const [addOpen, setAddOpen] = useState(false);
  const addBtnRef = useRef<HTMLButtonElement>(null);

  // Drag-to-reorder the open-workspace icons (pointer-based — HTML5 DnD is
  // broken in Tauri/WKWebView; see useWorkspaceReorder).
  const { drag, onPointerDown, shouldSuppressClick } = useWorkspaceReorder();

  // Right-click color popover for a workspace icon. Re-render on color
  // change so the tint updates live across the activity bar.
  const [colorMenu, setColorMenu] = useState<{
    wsId: string;
    x: number;
    y: number;
    nameAnchor: { x: number; y: number };
  } | null>(null);
  const [, setColorTick] = useState(0);
  useEffect(
    () => subscribeWorkspaceColors(() => setColorTick((n) => n + 1)),
    [],
  );

  // Pending-changes badge on the Source Control icon. Piggybacks on the
  // shared gitStatusStore watch the FileTree/SourceControlPanel start —
  // we only SUBSCRIBE here (no startGitStatusWatch) so the badge costs
  // zero extra `git status` runs and simply reads whatever the cache
  // last published for the active workspace.
  const [, setGitTick] = useState(0);
  useEffect(() => {
    if (!activeId) return;
    return subscribeGitStatus(activeId, () => setGitTick((n) => n + 1));
  }, [activeId]);
  const gitChangeCount = activeId
    ? (getGitStatus(activeId).status?.files.length ?? 0)
    : 0;

  const switchView = (v: SidebarView) => {
    if (!activeId) return;
    // If the sidebar is hidden (e.g. Ctrl+B, or auto-hidden because the
    // last section was removed), the click should *reveal* the panel, not
    // toggle the section away. Only add the section if it isn't already
    // there; if it is, the existing one just becomes visible again.
    if (!sidebarVisible) {
      setSidebarVisible(activeId, true);
      const present = sections.some((s) => s.view === v);
      if (!present) toggleSidebarSection(activeId, v);
      return;
    }
    // Sidebar is visible — standard toggle. Removing the only remaining
    // section auto-hides the sidebar (handled in the store action).
    toggleSidebarSection(activeId, v);
  };

  const recentNotOpen = recent.filter((w) => !openIds.includes(w.id));

  return (
    <div
      className="activity-bar"
      onContextMenu={(e) => {
        e.preventDefault();
        if (!activeId) return;
        setSidebarSide(activeId, sidebarSide === "left" ? "right" : "left");
      }}
      title="Right-click to flip sidebar to the other side"
    >
      <div className="activity-section ws-list">
        {openIds.map((id, index) => {
          const meta = loaded[id]?.meta;
          if (!meta) return null;
          const isActive = id === activeId;
          const color = getWorkspaceColor(id);
          const isDragging = drag?.from === index;
          const isDragOver = !!drag && drag.over === index && drag.from !== index;
          return (
            <div
              key={id}
              data-ws-index={index}
              className={`ws-icon ${isActive ? "active" : ""} ${color ? "has-color" : ""} ${isDragging ? "dragging" : ""} ${isDragOver ? "drag-over" : ""}`}
              style={
                color
                  ? ({ "--ws-color": color.hex } as React.CSSProperties)
                  : undefined
              }
              title={`${meta.name}\n${meta.root}\nRight-click for actions · drag to reorder`}
              role="button"
              tabIndex={0}
              aria-label={`Switch to workspace ${meta.name}`}
              aria-pressed={isActive}
              onPointerDown={(e) => onPointerDown(e, index)}
              onClick={() => {
                // Suppress the click that trails a real drag.
                if (shouldSuppressClick()) return;
                void setActive(id);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const el = e.currentTarget as HTMLElement;
                const r = el.getBoundingClientRect();
                setColorMenu({
                  wsId: id,
                  x: r.right + 6,
                  y: r.top,
                  nameAnchor: anchorFromElement(el),
                });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  void setActive(id);
                }
              }}
              onMouseDown={(e) => {
                if (e.button === 1) {
                  e.preventDefault();
                  void closeWs(id);
                }
              }}
            >
              <span className="ws-icon-text">{initials(meta.name)}</span>
              <button
                className="ws-icon-close"
                onClick={(e) => {
                  e.stopPropagation();
                  void closeWs(id);
                }}
                title="Close workspace"
                aria-label={`Close workspace ${meta.name}`}
              >
                <Icon name="x" size={10} />
              </button>
            </div>
          );
        })}
        <button
          ref={addBtnRef}
          className="ws-icon ws-icon-add"
          title="Open workspace"
          aria-label="Open workspace"
          aria-haspopup="menu"
          aria-expanded={addOpen}
          onClick={() => setAddOpen((v) => !v)}
        >
          <Icon name="plus" size={18} />
        </button>
      </div>

      <div className="activity-sep" />

      <div className="activity-section view-icons" role="toolbar" aria-label="Sidebar sections">
        <button
          className={`activity-icon ${sectionActive("files") ? "active" : ""}`}
          title="Explorer (Ctrl+Shift+E) — click to toggle section"
          aria-label="Explorer"
          aria-pressed={sectionActive("files")}
          onClick={() => switchView("files")}
          disabled={!activeId}
        >
          <Icon name="folder" size={20} />
        </button>
        <button
          className={`activity-icon ${sectionActive("search") ? "active" : ""}`}
          title="Search (Ctrl+Shift+F) — full text search across the workspace"
          aria-label="Search"
          aria-pressed={sectionActive("search")}
          onClick={() => switchView("search")}
          disabled={!activeId}
        >
          <Icon name="search" size={20} />
        </button>
        <button
          className={`activity-icon activity-icon--git ${sectionActive("git") ? "active" : ""}${
            gitChangeCount > 0 ? " has-changes" : ""
          }`}
          title={`Source Control (Ctrl+Shift+G)${
            gitChangeCount > 0
              ? ` — ${gitChangeCount} changed file${gitChangeCount === 1 ? "" : "s"}`
              : ""
          } — click to toggle section`}
          aria-label={`Source Control${
            gitChangeCount > 0 ? `, ${gitChangeCount} pending changes` : ""
          }`}
          aria-pressed={sectionActive("git")}
          onClick={() => switchView("git")}
          disabled={!activeId}
        >
          <Icon name="git-branch" size={20} />
          {gitChangeCount > 0 && (
            <span className="activity-badge" aria-hidden="true">
              {gitChangeCount > 99 ? "99+" : gitChangeCount}
            </span>
          )}
        </button>
        <button
          className={`activity-icon ${sectionActive("tasks") ? "active" : ""}`}
          title="Tasks (npm scripts) — click to toggle section"
          aria-label="Tasks"
          aria-pressed={sectionActive("tasks")}
          onClick={() => switchView("tasks")}
          disabled={!activeId}
        >
          <Icon name="play" size={20} />
        </button>
        <button
          className={`activity-icon ${sectionActive("todos") ? "active" : ""}`}
          title="TODO / FIXME (Ctrl+Shift+T) — click to toggle section"
          aria-label="TODO and FIXME"
          aria-pressed={sectionActive("todos")}
          onClick={() => switchView("todos")}
          disabled={!activeId}
        >
          <Icon name="check-square" size={20} />
        </button>
        <button
          className={`activity-icon ${sectionActive("outline") ? "active" : ""}`}
          title="Outline — symbols defined in the active editor file"
          aria-label="Outline"
          aria-pressed={sectionActive("outline")}
          onClick={() => switchView("outline")}
          disabled={!activeId}
        >
          <Icon name="file-text" size={20} />
        </button>
        <button
          className={`activity-icon ${sectionActive("bookmarks") ? "active" : ""}`}
          title="Bookmarks — pinned files for quick access"
          aria-label="Bookmarks"
          aria-pressed={sectionActive("bookmarks")}
          onClick={() => switchView("bookmarks")}
          disabled={!activeId}
        >
          <Icon name="star" size={20} />
        </button>
        <button
          className={`activity-icon ${sectionActive("remote") ? "active" : ""}`}
          title="Remote (SFTP) — click to toggle section. Manage connections in Settings."
          aria-label="Remote SFTP"
          aria-pressed={sectionActive("remote")}
          onClick={() => switchView("remote")}
          disabled={!activeId}
        >
          <Icon name="cloud" size={20} />
        </button>
        <button
          className={`activity-icon ${usageActive ? "active" : ""}`}
          title="Usage — live Claude Code session + cost monitor (opens as a tab)"
          aria-label="Usage"
          aria-pressed={usageActive}
          onClick={() => activeId && usageOpen(activeId)}
          disabled={!activeId}
        >
          <Icon name="chart-bar" size={20} />
        </button>
        <button
          className={`activity-icon ${brainActive ? "active" : ""}`}
          title="Brain — Pinky knowledge search + pre-turn context (opens as a tab)"
          aria-label="Pinky Brain"
          aria-pressed={brainActive}
          onClick={() => activeId && brainOpen(activeId)}
          disabled={!activeId}
        >
          <Icon name="brain" size={20} />
        </button>
        <button
          className={`activity-icon ${whiteboardActive ? "active" : ""}`}
          title="Organigramma — agents + skills runbook (⌘P → Open Organigramma)"
          aria-label="Organigramma"
          aria-pressed={whiteboardActive}
          onClick={() => activeId && wbOpen(activeId)}
          disabled={!activeId}
        >
          <Icon name="whiteboard" size={20} />
        </button>
        <button
          className={`activity-icon ${aiPanelVisible ? "active" : ""}`}
          title="AI Chat (Claude Code · Anthropic · OpenAI · Ollama) — opens on the right"
          aria-label="AI chat panel"
          aria-pressed={aiPanelVisible}
          onClick={() => activeId && setAIPanelVisible(activeId, !aiPanelVisible)}
          disabled={!activeId}
        >
          <AIIcon size={20} />
        </button>
      </div>

      <div className="activity-spacer" />

      {addOpen &&
        addBtnRef.current &&
        (() => {
          const rect = addBtnRef.current.getBoundingClientRect();
          const style: React.CSSProperties = {
            position: "fixed",
            left: rect.right + 6,
            top: rect.top,
            minWidth: 320,
          };
          return createPortal(
            <>
              <div
                className="menu-overlay"
                onClick={() => setAddOpen(false)}
              />
              <div className="menu-dropdown" style={style}>
                <button
                  className="menu-item"
                  onClick={async () => {
                    setAddOpen(false);
                    const sel = await openDialog({
                      directory: true,
                      multiple: false,
                    });
                    if (typeof sel === "string") await openWs(sel);
                  }}
                >
                  <span className="menu-item-label">Open Folder…</span>
                </button>
                {recentNotOpen.length > 0 && (
                  <>
                    <div className="menu-separator" />
                    <div className="menu-section-title">Recent</div>
                    {recentNotOpen.map((w) => (
                      <div key={w.id} className="menu-item-row">
                        <button
                          className="menu-item"
                          onClick={() => {
                            setAddOpen(false);
                            void openWs(w.root);
                          }}
                          title={w.root}
                        >
                          <span className="menu-item-label">{w.name}</span>
                          <span className="menu-item-accel">{w.root}</span>
                        </button>
                        <button
                          className="menu-item-remove"
                          onClick={(e) => {
                            e.stopPropagation();
                            void removeRecent(w.id);
                          }}
                          title="Remove from recent"
                          aria-label={`Remove ${w.name} from recent`}
                        >
                          <Icon name="x" size={12} />
                        </button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </>,
            document.body,
          );
        })()}

      {colorMenu && (
        <WorkspaceColorPopover
          wsId={colorMenu.wsId}
          x={colorMenu.x}
          y={colorMenu.y}
          nameAnchor={colorMenu.nameAnchor}
          onClose={() => setColorMenu(null)}
          onNewChat={(wsId, anchor) => {
            if (activeId !== wsId) void setActive(wsId);
            addNewAIChat(wsId, "editor", anchor);
          }}
        />
      )}
    </div>
  );
}
