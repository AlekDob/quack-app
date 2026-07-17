import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useStore } from "../store";
import { getGitStatus, subscribeGitStatus } from "../gitStatusStore";
import { addNewAIChat, anchorFromElement } from "../addNewAIChat";
import { Icon } from "./Icon";
import { WorkspaceColorPopover } from "./WorkspaceColorPopover";
import { ActivityBarViewIcons } from "./ActivityBarViewIcons";
import { getWorkspaceColor, subscribeWorkspaceColors } from "../workspaceColors";
import { useWorkspaceReorder } from "../useWorkspaceReorder";
import { useActivityBarViewHeight } from "../useActivityBarViewHeight";

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
  const wbOpen = useStore((s) => s.wbOpen);
  const worksOpen = useStore((s) => s.worksOpen);
  const usageOpen = useStore((s) => s.usageOpen);
  const brainOpen = useStore((s) => s.brainOpen);
  const storeOpen = useStore((s) => s.storeOpen);

  const activeTabKey: string | null = ((): string | null => {
    if (!ws) return null;
    const root = ws.layout.editorRoot;
    const activePaneId = ws.layout.activePaneId;
    if (!activePaneId) return null;
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

  const drawerTabKey = ws?.layout.editorDrawer?.tabKey ?? null;

  const hasSection = (v: Parameters<typeof toggleSidebarSection>[1]) =>
    sections.some((s) => s.view === v && !s.collapsed);
  const sectionActive = (v: Parameters<typeof toggleSidebarSection>[1]) =>
    sidebarVisible && hasSection(v);

  const [addOpen, setAddOpen] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const wsListRef = useRef<HTMLDivElement>(null);
  const sepRef = useRef<HTMLDivElement>(null);
  const viewIconsRef = useRef<HTMLDivElement>(null);
  const viewIconsHeight = useActivityBarViewHeight(
    barRef,
    wsListRef,
    sepRef,
    openIds.length,
  );

  const { drag, onPointerDown, shouldSuppressClick } = useWorkspaceReorder();

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

  const [, setGitTick] = useState(0);
  useEffect(() => {
    if (!activeId) return;
    return subscribeGitStatus(activeId, () => setGitTick((n) => n + 1));
  }, [activeId]);
  const gitChangeCount = activeId
    ? (getGitStatus(activeId).status?.files.length ?? 0)
    : 0;

  const switchView = (v: Parameters<typeof toggleSidebarSection>[1]) => {
    if (!activeId) return;
    if (!sidebarVisible) {
      setSidebarVisible(activeId, true);
      const present = sections.some((s) => s.view === v);
      if (!present) toggleSidebarSection(activeId, v);
      return;
    }
    toggleSidebarSection(activeId, v);
  };

  const recentNotOpen = recent.filter((w) => !openIds.includes(w.id));

  return (
    <div
      ref={barRef}
      className="activity-bar"
      onContextMenu={(e) => {
        e.preventDefault();
        if (!activeId) return;
        setSidebarSide(activeId, sidebarSide === "left" ? "right" : "left");
      }}
      title="Right-click to flip sidebar to the other side"
    >
      <div ref={wsListRef} className="activity-section ws-list">
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

      <div ref={sepRef} className="activity-sep" />

      <ActivityBarViewIcons
        activeId={activeId}
        activeTabKey={activeTabKey}
        drawerTabKey={drawerTabKey}
        availableHeight={viewIconsHeight}
        gitChangeCount={gitChangeCount}
        sectionActive={sectionActive}
        onSwitchView={switchView}
        onStoreOpen={() => activeId && storeOpen(activeId)}
        onUsageOpen={() => activeId && usageOpen(activeId)}
        onBrainOpen={() => activeId && brainOpen(activeId)}
        onWhiteboardOpen={() => activeId && wbOpen(activeId)}
        onWorksOpen={() => activeId && worksOpen(activeId)}
        customizeOpen={customizeOpen}
        onCustomizeOpenChange={setCustomizeOpen}
        sectionRef={viewIconsRef}
      />

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
          root={loaded[colorMenu.wsId]?.meta.root ?? ""}
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
