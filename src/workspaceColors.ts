// Per-project workspace colors. The app chrome is intentionally neutral
// (zero accent), so the ONE place real color lives is the workspace badge:
// each project can carry its own tint to tell them apart at a glance.
// Color is used as an accent (side trace + faint tint), never a full fill.
//
// Persisted in localStorage keyed by normalized workspace root (stable across
// re-imports). Legacy wsId keys are still read for migration. A tiny pub/sub
// (same shape as aiTaskStore) lets the activity bar + agent rail re-render
// when a color changes, without threading state through the store.

import { getJson, setJson } from "./localStore";
import { notify as toast } from "./notify";
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

const KEY = "lcp.ws.colors";
const listeners = new Set<() => void>();

function isMap(v: unknown): v is Record<string, string> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function readMap(): Record<string, string> {
  return getJson<Record<string, string>>(KEY, {}, isMap);
}

function notify() {
  for (const l of listeners) l();
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

/** Set (colorId) or clear (null) a workspace's color, then notify. */
export function setWorkspaceColor(wsId: string, colorId: string | null): void {
  const map = readMap();
  const key = colorStorageKey(wsId);
  if (colorId) map[key] = colorId;
  else delete map[key];
  if (key !== wsId) delete map[wsId];
  // setJson swallows quota/disabled-storage errors and returns false. Colors
  // silently not persisting (esp. in a long-lived prod install where
  // localStorage fills up) reads as a broken feature — surface it instead.
  if (!setJson(KEY, map)) {
    toast("Couldn't save the workspace color — local storage may be full.", "error");
  }
  notify();
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
