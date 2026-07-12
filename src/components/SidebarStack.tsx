import { Fragment, useRef, useState } from "react";
import {
  useStore,
  type SidebarView,
  type WorkspaceData,
} from "../store";
import { FileTree } from "./FileTree";
import { SearchPanel } from "./SearchPanel";
import { SourceControlPanel } from "./SourceControlPanel";
import { TasksPanel } from "./TasksPanel";
import { UsagePanel } from "./UsagePanel";
import { AIChatPanel } from "./AIChatPanel";
import { OutlinePanel } from "./OutlinePanel";
import { BookmarksPanel } from "./BookmarksPanel";
import { LineBookmarksPanel } from "./LineBookmarksPanel";
import { DiagnosticsPanel } from "./DiagnosticsPanel";
import { RemoteSftpPanel } from "./RemoteSftpPanel";
import { Icon } from "./Icon";

const VIEW_LABEL: Record<SidebarView, string> = {
  files: "Explorer",
  search: "Search",
  git: "Source Control",
  tasks: "Tasks",
  outline: "Outline",
  bookmarks: "Bookmarks",
  ai: "AI Chat",
  remote: "Remote (SFTP)",
  usage: "Usage",
};

interface Props {
  wsId: string;
  ws: WorkspaceData;
}

export function SidebarStack({ wsId, ws }: Props) {
  const collapseSidebarSection = useStore((s) => s.collapseSidebarSection);
  const removeSidebarSection = useStore((s) => s.removeSidebarSection);
  const setSidebarW = useStore((s) => s.setSidebarW);
  const setSidebarSectionSize = useStore((s) => s.setSidebarSectionSize);
  const reorderSidebarSection = useStore((s) => s.reorderSidebarSection);
  const layout = ws.layout;
  const sections = layout.sidebarSections;

  const [drag, setDrag] = useState<{
    fromView: SidebarView;
    target: SidebarView | "end" | null;
  } | null>(null);
  const dragRef = useRef<{
    fromView: SidebarView;
    started: boolean;
    target: SidebarView | "end" | null;
  } | null>(null);

  const onHeaderPointerDown = (
    e: React.PointerEvent<HTMLButtonElement>,
    view: SidebarView,
  ) => {
    if (e.button !== 0) return;
    const t = e.target as HTMLElement;
    if (t.closest(".sidebar-section-close")) return;
    const startX = e.clientX;
    const startY = e.clientY;
    dragRef.current = { fromView: view, started: false, target: null };

    const onMove = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      if (!d.started) {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (dx * dx + dy * dy < 36) return;
        d.started = true;
        setDrag({ fromView: d.fromView, target: null });
      }
      const el = document.elementFromPoint(
        ev.clientX,
        ev.clientY,
      ) as HTMLElement | null;
      const sec = el?.closest("[data-sidebar-section]") as
        | HTMLElement
        | null;
      let target: SidebarView | "end" | null = null;
      if (sec) {
        const v = sec.dataset.sidebarSection as SidebarView;
        const rect = sec.getBoundingClientRect();
        const below = ev.clientY > rect.top + rect.height / 2;
        const arr = ws.layout.sidebarSections;
        const idx = arr.findIndex((s) => s.view === v);
        if (below) {
          target = idx >= arr.length - 1 ? "end" : arr[idx + 1].view;
        } else {
          target = v;
        }
        // Normalize: "drop right where it already is" should be a no-op.
        const fromIdx = arr.findIndex((s) => s.view === d.fromView);
        const beforeIdx = target === "end" ? arr.length : arr.findIndex((s) => s.view === target);
        if (fromIdx === beforeIdx || fromIdx + 1 === beforeIdx) {
          target = null;
        }
      }
      d.target = target;
      setDrag({ fromView: d.fromView, target });
    };

    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      const d = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      if (d?.started && d.target !== null) {
        const before = d.target === "end" ? null : d.target;
        reorderSidebarSection(wsId, d.fromView, before);
      }
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  };

  const renderContent = (view: SidebarView) => {
    switch (view) {
      case "files":
        return <FileTree wsId={wsId} root={ws.meta.root} />;
      case "search":
        return <SearchPanel wsId={wsId} root={ws.meta.root} />;
      case "git":
        return <SourceControlPanel wsId={wsId} root={ws.meta.root} />;
      case "tasks":
        return <TasksPanel wsId={wsId} root={ws.meta.root} />;
      case "outline":
        // Outline + Diagnostics share the "navigate to a line in the
        // workspace" purpose, so the Problems panel rides inside the
        // Outline section. Adding a top-level "diagnostics" SidebarView
        // would require extending the union in store.ts — out of scope
        // for this change — so the two stack vertically here instead.
        return (
          <>
            <OutlinePanel wsId={wsId} root={ws.meta.root} />
            <DiagnosticsPanel wsId={wsId} root={ws.meta.root} />
          </>
        );
      case "bookmarks":
        // The "bookmarks" section hosts two stacked lists: file-level
        // bookmarks (pinned files) and line-level bookmarks. They share
        // the same .bookmarks-panel visual vocabulary so they read as
        // one continuous surface with two headers — and embedding the
        // second list here avoids growing the SidebarView union for what
        // is conceptually the same feature.
        return (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              minHeight: 0,
              overflow: "hidden",
            }}
          >
            <BookmarksPanel wsId={wsId} root={ws.meta.root} />
            <LineBookmarksPanel wsId={wsId} root={ws.meta.root} />
          </div>
        );
      case "ai":
        return <AIChatPanel wsId={wsId} root={ws.meta.root} />;
      case "remote":
        return <RemoteSftpPanel wsId={wsId} root={ws.meta.root} />;
      case "usage":
        return <UsagePanel wsId={wsId} root={ws.meta.root} />;
    }
  };

  return (
    <>
      <div
        className="sidebar"
        style={{ width: layout.sidebarW, display: "flex" }}
      >
        {sections.map((sec, i) => (
          <Fragment key={sec.view}>
            {drag?.target === sec.view && (
              <div className="sidebar-section-drop-indicator" />
            )}
            <div
              data-sidebar-section={sec.view}
              className={`sidebar-section ${sec.collapsed ? "collapsed" : ""} ${
                drag?.fromView === sec.view ? "dragging" : ""
              }`}
              style={{
                flex: sec.collapsed ? "0 0 auto" : `${sec.size} 1 0`,
              }}
            >
              <button
                className="sidebar-section-header"
                onPointerDown={(e) => onHeaderPointerDown(e, sec.view)}
                onClick={() =>
                  collapseSidebarSection(wsId, sec.view, !sec.collapsed)
                }
                aria-expanded={!sec.collapsed}
                aria-controls={`sidebar-body-${sec.view}`}
              >
                <span className="sidebar-section-caret" aria-hidden="true">
                  <Icon
                    name={sec.collapsed ? "chevron-right" : "chevron-down"}
                    size={11}
                  />
                </span>
                <span className="sidebar-section-title">
                  {sec.view === "files" ? ws.meta.name : VIEW_LABEL[sec.view]}
                </span>
                {sections.length > 1 && (
                  // span (not <button>) because nested interactive elements
                  // are invalid HTML — the parent header is a <button>. We
                  // keep keyboard reachability via tabIndex + onKeyDown so
                  // the close action stays accessible without breaking the
                  // outer collapse-toggle.
                  <span
                    className="sidebar-section-close"
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeSidebarSection(wsId, sec.view);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        removeSidebarSection(wsId, sec.view);
                      }
                    }}
                    title="Remove section"
                    aria-label={`Remove ${VIEW_LABEL[sec.view]} section`}
                  >
                    <Icon name="x" size={11} />
                  </span>
                )}
              </button>
              {!sec.collapsed && (
                <div
                  className="sidebar-section-body"
                  id={`sidebar-body-${sec.view}`}
                >
                  {renderContent(sec.view)}
                </div>
              )}
            </div>
            {i < sections.length - 1 && (
              <div
                className="sidebar-section-split"
                role="separator"
                aria-orientation="horizontal"
                aria-label={`Resize between ${VIEW_LABEL[sec.view]} and ${VIEW_LABEL[sections[i + 1].view]}`}
                tabIndex={0}
                onKeyDown={(e) => {
                  // Up/Down keyboard nudging — same proportional scheme
                  // as the mouse drag, with 0.05 increments per press.
                  if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
                  const top = sec;
                  const bottom = sections[i + 1];
                  if (top.collapsed || bottom.collapsed) return;
                  e.preventDefault();
                  const dir = e.key === "ArrowDown" ? 1 : -1;
                  const total = top.size + bottom.size;
                  const newTop = Math.max(0.2, top.size + dir * 0.05);
                  const newBottom = Math.max(0.2, total - newTop);
                  setSidebarSectionSize(wsId, top.view, newTop);
                  setSidebarSectionSize(wsId, bottom.view, newBottom);
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  // Resize between sec[i] and sec[i+1] proportionally.
                  const top = sec;
                  const bottom = sections[i + 1];
                  if (top.collapsed || bottom.collapsed) return;
                  const startY = e.clientY;
                  const startTop = top.size;
                  const startBottom = bottom.size;
                  const totalSize = startTop + startBottom;
                  const onMove = (ev: MouseEvent) => {
                    const dy = ev.clientY - startY;
                    // Use 200px as the "per unit" baseline for sizing intuition.
                    const delta = dy / 200;
                    const newTop = Math.max(0.2, startTop + delta);
                    const newBottom = Math.max(0.2, totalSize - newTop);
                    if (newTop + newBottom > 0) {
                      setSidebarSectionSize(wsId, top.view, newTop);
                      setSidebarSectionSize(wsId, bottom.view, newBottom);
                    }
                  };
                  const onUp = () => {
                    window.removeEventListener("mousemove", onMove);
                    window.removeEventListener("mouseup", onUp);
                  };
                  window.addEventListener("mousemove", onMove);
                  window.addEventListener("mouseup", onUp);
                }}
              />
            )}
          </Fragment>
        ))}
      </div>
      <div
        className="vsplit"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        aria-valuenow={layout.sidebarW}
        aria-valuemin={160}
        aria-valuemax={700}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
          e.preventDefault();
          const dir = e.key === "ArrowRight" ? 1 : -1;
          const sign = layout.sidebarSide === "right" ? -1 : 1;
          const step = e.shiftKey ? 60 : 20;
          const next = Math.max(
            160,
            Math.min(700, layout.sidebarW + dir * sign * step),
          );
          setSidebarW(wsId, next);
        }}
        onMouseDown={(e) => {
          e.preventDefault();
          const startX = e.clientX;
          const startW = layout.sidebarW;
          const sign = layout.sidebarSide === "right" ? -1 : 1;
          const onMove = (ev: MouseEvent) => {
            setSidebarW(
              wsId,
              Math.max(
                160,
                Math.min(700, startW + sign * (ev.clientX - startX)),
              ),
            );
          };
          const onUp = () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
          };
          window.addEventListener("mousemove", onMove);
          window.addEventListener("mouseup", onUp);
        }}
      />
    </>
  );
}
