// How activity-bar surfaces open — editor tab vs right drawer.
// Works defaults to drawer; Brain and Team stay tab until changed.

import { useEffect, useState } from "react";
import { getJson, setJson } from "./localStore";

export type SurfaceMode = "tab" | "drawer";

export type SurfaceViewId = "works" | "brain" | "whiteboard" | "subagent";

const STORAGE_KEY = "lcp.surfaceView";

const DEFAULTS: Record<SurfaceViewId, SurfaceMode> = {
  works: "drawer",
  brain: "tab",
  whiteboard: "tab",
  subagent: "drawer",
};

const LABELS: Record<SurfaceViewId, string> = {
  works: "Works",
  brain: "Quack Brain",
  whiteboard: "Team",
  subagent: "Subagent transcripts",
};

type Prefs = Partial<Record<SurfaceViewId, SurfaceMode>>;

const listeners = new Set<() => void>();

function readAll(): Prefs {
  return getJson<Prefs>(STORAGE_KEY, {}, (v): v is Prefs => {
    if (!v || typeof v !== "object") return false;
    return true;
  });
}

function notify(): void {
  for (const fn of listeners) fn();
}

export function surfaceViewLabel(id: SurfaceViewId): string {
  return LABELS[id];
}

export function readSurfaceViewMode(id: SurfaceViewId): SurfaceMode {
  const hit = readAll()[id];
  if (hit === "tab" || hit === "drawer") return hit;
  return DEFAULTS[id];
}

export function writeSurfaceViewMode(
  id: SurfaceViewId,
  mode: SurfaceMode,
): void {
  const all = readAll();
  if (all[id] === mode) return;
  setJson(STORAGE_KEY, { ...all, [id]: mode });
  notify();
}

export function subscribeSurfaceViewPrefs(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useSurfaceViewPrefs(): Prefs {
  const [prefs, setPrefs] = useState(readAll);
  useEffect(() => subscribeSurfaceViewPrefs(() => setPrefs(readAll())), []);
  return prefs;
}

export const SURFACE_VIEW_IDS: SurfaceViewId[] = [
  "works",
  "brain",
  "whiteboard",
  "subagent",
];
