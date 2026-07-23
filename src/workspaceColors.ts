// Per-project workspace colors. The app chrome is intentionally neutral
// (zero accent), so the ONE place real color lives is the workspace badge:
// each project can carry its own tint to tell them apart at a glance.
// Color is used as an accent (side trace + faint tint), never a full fill.
//
// Persisted in localStorage keyed by normalized workspace root (stable across
// re-imports). Legacy wsId keys are still read for migration. A tiny pub/sub
// (same shape as aiTaskStore) lets the activity bar + agent rail re-render
// when a color changes, without threading state through the store.

import { getJson, remove as removeLocal } from "./localStore";
import { workspaces } from "./ipc";
import { normalizeWorkspaceRoot } from "./pathUtils";
import { useStore } from "./store";

export interface WorkspaceColor {
  id: string;
  /** Human label for the popover tooltip. */
  label: string;
  /** Base hex — used for the side trace and (at low alpha) the tint. */
  hex: string;
}

// Premium, restrained palette. Includes Quack's signature orange as one
// option among neutrals-but-saturated hues. Tuned to read on both themes.
// Laid out as a 4-column grid in the popover (see WorkspaceColorPopover):
// the rows below read row-by-row, cool → warm → extras.
export const WORKSPACE_COLORS: WorkspaceColor[] = [
  // Row 1 — cool
  { id: "blue", label: "Blue", hex: "#3b82f6" },
  { id: "indigo", label: "Indigo", hex: "#6366f1" },
  { id: "sky", label: "Sky", hex: "#0ea5e9" },
  { id: "cyan", label: "Cyan", hex: "#06b6d4" },
  // Row 2 — green family
  { id: "teal", label: "Teal", hex: "#14b8a6" },
  { id: "emerald", label: "Emerald", hex: "#10b981" },
  { id: "green", label: "Green", hex: "#22c55e" },
  { id: "lime", label: "Lime", hex: "#84cc16" },
  // Row 3 — warm
  { id: "yellow", label: "Yellow", hex: "#eab308" },
  { id: "amber", label: "Amber", hex: "#f59e0b" },
  { id: "orange", label: "Orange", hex: "#f28c52" },
  { id: "red", label: "Red", hex: "#ef4444" },
  // Row 4 — pinks / purples / neutral
  { id: "rose", label: "Rose", hex: "#f43f5e" },
  { id: "pink", label: "Pink", hex: "#ec4899" },
  { id: "fuchsia", label: "Fuchsia", hex: "#d946ef" },
  { id: "violet", label: "Violet", hex: "#8b5cf6" },
  { id: "purple", label: "Purple", hex: "#a855f7" },
  { id: "slate", label: "Slate", hex: "#64748b" },
];

const KEY = "lcp.ws.colors"; // legacy localStorage key — read once for migration
const listeners = new Set<() => void>();

// Colors now live on disk (colors.json via Tauri) to dodge the localStorage
// quota that was silently breaking persistence in long-lived installs. The
// public API stays SYNCHRONOUS — render paths (activity bar, rail) read
// `getWorkspaceColor` inline — so we keep an in-RAM cache: hydrated once at
// boot, mutated on set, and written to disk async (fire-and-forget).
let cache: Record<string, string> = {};
let hydrated = false;

function isMap(v: unknown): v is Record<string, string> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function readMap(): Record<string, string> {
  return cache;
}

function notify() {
  for (const l of listeners) l();
}

/** Load colors from disk into the RAM cache, migrating any legacy
 *  localStorage map on first run. Call once at boot before first paint. */
export async function hydrateWorkspaceColors(): Promise<void> {
  if (hydrated) return;
  hydrated = true;
  try {
    const onDisk = await workspaces.loadColors();
    if (isMap(onDisk)) cache = onDisk;
  } catch {
    cache = {};
  }
  // One-time migration: fold the old localStorage map into disk, then drop it.
  const legacy = getJson<Record<string, string>>(KEY, {}, isMap);
  if (Object.keys(legacy).length) {
    let changed = false;
    for (const [k, v] of Object.entries(legacy)) {
      if (!(k in cache)) {
        cache[k] = v;
        changed = true;
      }
    }
    if (changed) void workspaces.saveColors(cache).catch(() => {});
    removeLocal(KEY);
  }
  notify();
}

function workspaceRoot(wsId: string): string | null {
  const state = useStore.getState();
  const fromLoaded = state.loaded[wsId]?.meta.root;
  if (fromLoaded) return fromLoaded;
  const fromRecent = state.recent.find((w) => w.id === wsId)?.root;
  return fromRecent ?? null;
}

/** Stable localStorage key — normalized root, not ephemeral wsId. */
function colorStorageKey(wsId: string): string {
  const root = workspaceRoot(wsId);
  return root ? normalizeWorkspaceRoot(root) : wsId;
}

function resolveColorId(map: Record<string, string>, wsId: string): string | undefined {
  const key = colorStorageKey(wsId);
  return map[key] ?? map[wsId];
}

/** True for a `#rrggbb` (or `#rgb`) hex — how custom colors are stored. */
export function isHexColor(v: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v);
}

/** Resolve a workspace's color object, or null if none / unknown id.
 *  The stored value is either a preset id ("blue") or a raw custom hex
 *  ("#7c3aed") picked via the color picker — both map to a WorkspaceColor. */
export function getWorkspaceColor(wsId: string): WorkspaceColor | null {
  const id = resolveColorId(readMap(), wsId);
  if (!id) return null;
  const preset = WORKSPACE_COLORS.find((c) => c.id === id);
  if (preset) return preset;
  return isHexColor(id) ? { id, label: "Custom", hex: id } : null;
}

/** Set (colorId) or clear (null) a workspace's color, then notify.
 *  Cache mutation is synchronous so the UI reflects the change instantly;
 *  the disk write is fire-and-forget (colors.json has no practical quota). */
export function setWorkspaceColor(wsId: string, colorId: string | null): void {
  const key = colorStorageKey(wsId);
  if (colorId) cache[key] = colorId;
  else delete cache[key];
  if (key !== wsId) delete cache[wsId];
  notify();
  void workspaces.saveColors(cache).catch(() => {
    // Disk write failing is rare (permissions / disk full) — unlike the old
    // localStorage quota it is not an expected steady-state; log, don't toast.
    console.warn("[ws-colors] failed to persist colors to disk");
  });
}

export function subscribeWorkspaceColors(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** "r, g, b" channels for CSS `rgba(var(--ws-color-rgb), α)`. */
export function hexRgbChannels(hex: string): string | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}
