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

export async function openDock(): Promise<void> {
  setDockEnabled(true);
  const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
  const existing = await WebviewWindow.getByLabel(LABEL);
  if (existing) {
    try {
      await existing.show();
      await existing.setFocus();
    } catch {
      /* ignore */
    }
    return;
  }

  const theme =
    document.documentElement.dataset.theme === "light" ? "light" : "dark";
  const pos = savedPos();

  // Window is intentionally larger than the pill so the soft drop-shadow
  // has room to render inside the (transparent) window instead of being
  // clipped at the edge into a hard band.
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
  void w.once("tauri://error", (e) =>
    console.warn("dock window failed", e.payload),
  );
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
