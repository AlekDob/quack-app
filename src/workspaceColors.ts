// Per-project workspace colors. The app chrome is intentionally neutral
// (zero accent), so the ONE place real color lives is the workspace badge:
// each project can carry its own tint to tell them apart at a glance.
// Color is used as an accent (side trace + faint tint), never a full fill.
//
// Persisted in localStorage as a { wsId: colorId } map. A tiny pub/sub
// (same shape as aiTaskStore) lets the activity bar + agent rail re-render
// when a color changes, without threading state through the store.

import { getJson, setJson } from "./localStore";

export interface WorkspaceColor {
  id: string;
  /** Human label for the popover tooltip. */
  label: string;
  /** Base hex — used for the side trace and (at low alpha) the tint. */
  hex: string;
}

// Premium, restrained palette. Includes Quack's signature orange as one
// option among neutrals-but-saturated hues. Tuned to read on both themes.
export const WORKSPACE_COLORS: WorkspaceColor[] = [
  { id: "blue", label: "Blue", hex: "#3b82f6" },
  { id: "teal", label: "Teal", hex: "#14b8a6" },
  { id: "green", label: "Green", hex: "#22c55e" },
  { id: "amber", label: "Amber", hex: "#f59e0b" },
  { id: "orange", label: "Orange", hex: "#f28c52" },
  { id: "red", label: "Red", hex: "#ef4444" },
  { id: "pink", label: "Pink", hex: "#ec4899" },
  { id: "violet", label: "Violet", hex: "#8b5cf6" },
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

/** Resolve a workspace's color object, or null if none / unknown id. */
export function getWorkspaceColor(wsId: string): WorkspaceColor | null {
  const id = readMap()[wsId];
  if (!id) return null;
  return WORKSPACE_COLORS.find((c) => c.id === id) ?? null;
}

/** Set (colorId) or clear (null) a workspace's color, then notify. */
export function setWorkspaceColor(wsId: string, colorId: string | null): void {
  const map = readMap();
  if (colorId) map[wsId] = colorId;
  else delete map[wsId];
  setJson(KEY, map);
  notify();
}

export function subscribeWorkspaceColors(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
