// Floating Perf Audit companion — separate WebviewWindow (?audit=1) that
// shows Quack/WebKit process stats + a timeline of switch/hydrate/resume
// events produced by the main window. Opt-in (default off).

import {
  getString as lsGetString,
  setString as lsSetString,
  getJson as lsGetJson,
  setJson as lsSetJson,
} from "./localStore";
import { error as toastError } from "./notify";

const LABEL = "audit";
const KEY_ENABLED = "lcp.audit.enabled";
const KEY_POS = "lcp.audit.pos";

const DEFAULT_W = 440;
const DEFAULT_H = 560;

export function isAuditEnabled(): boolean {
  return lsGetString(KEY_ENABLED) === "1";
}

function setAuditEnabled(v: boolean): void {
  lsSetString(KEY_ENABLED, v ? "1" : "0");
}

/** Pref only — used when the OS close button destroys the window. */
export function markAuditClosed(): void {
  setAuditEnabled(false);
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

export function saveAuditPos(x: number, y: number): void {
  lsSetJson(KEY_POS, { x: Math.round(x), y: Math.round(y) });
}

function onScreenPos(): { x: number; y: number } | null {
  const p = savedPos();
  if (!p) return null;
  const w = window.screen.availWidth || 1280;
  const h = window.screen.availHeight || 800;
  if (p.x < -50 || p.y < -50 || p.x > w - 120 || p.y > h - 120) return null;
  return p;
}

export async function openAudit(): Promise<void> {
  setAuditEnabled(true);
  const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
  const existing = await WebviewWindow.getByLabel(LABEL);
  if (existing) {
    const { LogicalSize, LogicalPosition } = await import("@tauri-apps/api/dpi");
    const recoverPos = onScreenPos() ?? { x: 80, y: 80 };
    try {
      await existing.setSize(new LogicalSize(DEFAULT_W, DEFAULT_H));
      await existing.setPosition(
        new LogicalPosition(recoverPos.x, recoverPos.y),
      );
    } catch {
      /* capability not live yet */
    }
    try {
      await existing.unminimize();
      await existing.show();
      await existing.setFocus();
    } catch {
      /* ignore */
    }
    return;
  }

  const theme =
    document.documentElement.dataset.theme === "light" ? "light" : "dark";
  const pos = onScreenPos();

  const w = new WebviewWindow(LABEL, {
    url: `index.html?audit=1&theme=${theme}`,
    title: "Quack Perf Audit",
    width: DEFAULT_W,
    height: DEFAULT_H,
    resizable: true,
    decorations: true,
    transparent: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    focus: true,
    ...(pos ? { x: pos.x, y: pos.y } : {}),
  });
  void w.once("tauri://error", (e) => {
    toastError(`Perf Audit failed: ${String(e.payload)}`);
  });
}

export async function closeAudit(): Promise<void> {
  setAuditEnabled(false);
  try {
    const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    const w = await WebviewWindow.getByLabel(LABEL);
    if (w) await w.close().catch(() => {});
  } catch {
    /* ignore */
  }
}

export async function toggleAudit(): Promise<void> {
  const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
  const w = await WebviewWindow.getByLabel(LABEL);
  if (w) await closeAudit();
  else await openAudit();
}
