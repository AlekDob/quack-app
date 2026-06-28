// Floating "Dock" companion window — a small always-on-top strip of project
// circles that stays visible (on every Space) even when the main window is
// behind other apps, so Alek can see which project's agents need him and
// jump straight there. Cloned structure from terminalPopout.ts.

import {
  getString as lsGetString,
  setString as lsSetString,
  getJson as lsGetJson,
  setJson as lsSetJson,
} from "./localStore";
import { error as toastError } from "./notify";

const LABEL = "dock";
const KEY_ENABLED = "lcp.dock.enabled";
const KEY_POS = "lcp.dock.pos";
const KEY_ORIENT = "lcp.dock.orient";

export type DockOrient = "h" | "v";

export function getDockOrient(): DockOrient {
  return lsGetString(KEY_ORIENT) === "v" ? "v" : "h";
}

export function saveDockOrient(o: DockOrient): void {
  lsSetString(KEY_ORIENT, o);
}

// Default ON — the Dock is the headline "read the room" surface. Persisted
// so a deliberate close survives reloads.
export function isDockEnabled(): boolean {
  return lsGetString(KEY_ENABLED) !== "0";
}

function setDockEnabled(v: boolean): void {
  lsSetString(KEY_ENABLED, v ? "1" : "0");
}

function savedPos(): { x: number; y: number } | null {
  const p = lsGetJson<{ x: number; y: number } | null>(
    KEY_POS,
    null,
    (v): v is { x: number; y: number } =>
      !!v &&
      typeof v === "object" &&
      typeof (v as { x: unknown }).x === "number" &&
      typeof (v as { y: unknown }).y === "number",
  );
  return p;
}

/** Persist the Dock's window position (called from the Dock window on move). */
export function saveDockPos(x: number, y: number): void {
  lsSetJson(KEY_POS, { x: Math.round(x), y: Math.round(y) });
}

// Keep a saved position only if it's actually on-screen — a stale off-screen
// pos (from a drag to another monitor, or a bad resize) would open the dock
// where you can't see it.
function onScreenPos(): { x: number; y: number } | null {
  const p = savedPos();
  if (!p) return null;
  const w = window.screen.availWidth || 1280;
  const h = window.screen.availHeight || 800;
  if (p.x < -50 || p.y < -50 || p.x > w - 80 || p.y > h - 60) return null;
  return p;
}

export async function openDock(): Promise<void> {
  setDockEnabled(true);
  const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
  const all = await WebviewWindow.getAll();
  console.log(
    "[dock] openDock — existing windows:",
    all.map((w) => w.label),
  );
  const existing = await WebviewWindow.getByLabel(LABEL);
  if (existing) {
    // Recover a possibly-broken (invisible / off-screen / wrong-sized)
    // window in place — no flicker. Reset to a known-good horizontal size +
    // an on-screen position, then show. set-size/position may reject if the
    // capability isn't live yet; show/focus still run.
    console.log("[dock] existing found — recovering in place");
    saveDockOrient("h");
    const { LogicalSize, LogicalPosition } = await import("@tauri-apps/api/dpi");
    const pos = onScreenPos() ?? { x: 120, y: 80 };
    try {
      await existing.setSize(new LogicalSize(440, 104));
      await existing.setPosition(new LogicalPosition(pos.x, pos.y));
    } catch (e) {
      console.warn("[dock] recover resize/move failed", e);
    }
    try {
      await existing.unminimize();
      await existing.show();
      await existing.setFocus();
    } catch (e) {
      console.warn("[dock] recover show failed", e);
    }
    return;
  }

  const theme =
    document.documentElement.dataset.theme === "light" ? "light" : "dark";
  const pos = onScreenPos();
  console.log("[dock] creating window", { theme, pos });

  const w = new WebviewWindow(LABEL, {
    url: `index.html?dock=1&theme=${theme}`,
    title: "Quack Dock",
    width: 440,
    height: 104,
    resizable: false,
    decorations: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    shadow: false,
    visibleOnAllWorkspaces: true,
    focus: false,
    ...(pos ? { x: pos.x, y: pos.y } : {}),
  });
  void w.once("tauri://created", () => console.log("[dock] window created OK"));
  void w.once("tauri://error", (e) => {
    console.error("[dock] window creation FAILED", e.payload);
    toastError(`Dock failed: ${String(e.payload)}`);
  });
}

export async function closeDock(): Promise<void> {
  setDockEnabled(false);
  try {
    const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    const w = await WebviewWindow.getByLabel(LABEL);
    if (w) await w.close();
  } catch {
    /* ignore */
  }
}

export async function toggleDock(): Promise<void> {
  const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
  const w = await WebviewWindow.getByLabel(LABEL);
  if (w) await closeDock();
  else await openDock();
}
