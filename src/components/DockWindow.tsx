// The floating Dock window's UI (rendered when the app boots with ?dock=1).
// A horizontal strip of project circles; each shows the project color +
// initial, a status dot for the most urgent state, and a counter badge of
// chats needing attention. Click a circle → bring the main window forward
// and jump to that project's most urgent chat.

import { useEffect, useState } from "react";
import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";
import {
  DOCK_FOCUS_EVENT,
  DOCK_REQUEST_EVENT,
  DOCK_SUMMARY_EVENT,
  type DockProject,
} from "../dockSummary";
import {
  saveDockPos,
  saveDockOrient,
  getDockOrient,
  type DockOrient,
} from "../dock";
import { Icon } from "./Icon";

// Pill geometry — must match .dock-* CSS. Used to size the OS window so it
// fits the project count exactly (no clipping, no dead space).
const SHORT_SIDE = 104; // fixed cross-axis (height when horizontal)
const HEAD = 140; // grip + avatar + orient toggle + separator + paddings + insets
const CELL = 46; // circle (36) + gap (10)

function windowSizeFor(orient: DockOrient, n: number): LogicalSize {
  // +40 keeps the last circle (and its hover ring) clear of the edge.
  const long = HEAD + Math.max(n, 1) * CELL + 40;
  return orient === "h"
    ? new LogicalSize(long, SHORT_SIDE)
    : new LogicalSize(SHORT_SIDE, long);
}


function initials(name: string): string {
  const parts = name.trim().split(/[\s_\-./]+/).filter(Boolean);
  if (parts.length === 0) return "·";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

async function focusProject(wsId: string): Promise<void> {
  void emit(DOCK_FOCUS_EVENT, wsId);
  try {
    const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    const main = await WebviewWindow.getByLabel("main");
    if (main) {
      await main.unminimize();
      await main.show();
      await main.setFocus();
    }
  } catch {
    /* ignore */
  }
}

// Live theme sync from the main window (localStorage `storage` event).
function useThemeSync() {
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== "lcp.theme") return;
      const v = e.newValue;
      document.documentElement.dataset.theme =
        v === "light" || v === "dark"
          ? v
          : window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light";
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
}

export function DockWindow() {
  const [projects, setProjects] = useState<DockProject[]>([]);
  const [orient, setOrient] = useState<DockOrient>(getDockOrient);
  useThemeSync();

  // Transparent window chrome + initial theme from the URL (the main window
  // passes the resolved theme so the pill matches before any effect runs).
  useEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    const t = new URLSearchParams(window.location.search).get("theme");
    if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
  }, []);

  useEffect(() => {
    const off = listen<DockProject[]>(DOCK_SUMMARY_EVENT, (e) =>
      setProjects(e.payload),
    );
    // Ask the main window to push the current state right away.
    void emit(DOCK_REQUEST_EVENT);
    return () => void off.then((f) => f());
  }, []);

  // Persist position as the window is dragged. Orientation is changed
  // manually via the toggle button (not auto-detected from screen edge —
  // that was fiddly and surprising).
  useEffect(() => {
    const off = getCurrentWindow().onMoved(({ payload }) =>
      saveDockPos(payload.x, payload.y),
    );
    return () => void off.then((f) => f());
  }, []);

  const toggleOrient = () =>
    setOrient((cur) => {
      const next: DockOrient = cur === "h" ? "v" : "h";
      saveDockOrient(next);
      return next;
    });

  // Resize the OS window to fit the orientation + project count exactly.
  // If the resize is rejected (e.g. the set-size capability isn't active
  // until tauri restarts), fall back to horizontal so the dock never ends
  // up as a broken/invisible vertical pill in a wide-short window.
  useEffect(() => {
    let cancelled = false;
    void getCurrentWindow()
      .setSize(windowSizeFor(orient, projects.length))
      .catch(() => {
        if (!cancelled && orient !== "h") {
          saveDockOrient("h");
          setOrient("h");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [orient, projects.length]);

  return (
    <div
      className={`dock-shell ${orient === "v" ? "dock-vertical" : ""}`}
      data-tauri-drag-region
    >
      <span
        className="dock-grip"
        data-tauri-drag-region
        title="Drag to move"
        aria-hidden="true"
      />
      <div className="dock-mark" data-tauri-drag-region aria-hidden="true">
        <img src="/jack.jpeg" alt="" className="dock-mark-img" />
      </div>
      <button
        className="dock-orient-toggle"
        onClick={toggleOrient}
        title={orient === "h" ? "Switch to vertical" : "Switch to horizontal"}
        aria-label="Toggle dock orientation"
      >
        <Icon name="rotate-ccw" size={13} />
      </button>
      <div className="dock-sep" data-tauri-drag-region />
      {/* keyed by orientation so the reflow replays its entry animation */}
      <div className="dock-projects" key={orient}>
        {projects.map((p) => (
          <DockCircle key={p.wsId} project={p} />
        ))}
      </div>
    </div>
  );
}

function DockCircle({ project }: { project: DockProject }) {
  const { name, colorHex, ready, needsInput } = project;
  const total = ready + needsInput;
  // Most urgent state drives the ring/dot: needs-input (purple) > ready
  // (green) > none.
  const state = needsInput > 0 ? "needs-input" : ready > 0 ? "ready" : "idle";
  return (
    <button
      className={`dock-circle dock-state-${state}`}
      style={colorHex ? { background: colorHex } : undefined}
      title={`${name}${total ? ` — ${needsInput} needs input, ${ready} ready` : ""}`}
      aria-label={name}
      onClick={() => void focusProject(project.wsId)}
    >
      <span className="dock-circle-label">{initials(name)}</span>
      {total > 0 && (
        <span className={`dock-badge dock-badge-${state}`}>{total}</span>
      )}
    </button>
  );
}
