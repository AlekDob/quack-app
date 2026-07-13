// User override store for presets — separate from the shipped defaults in
// builtins.ts. Same shape as workspaceColors.ts: a map in localStorage +
// a tiny pub/sub so any UI (composer chip, settings tab, organigramma) can
// react to a change without threading state through props.
import { getJson, setJson } from "../localStore";
import type { UserPresetOverrides } from "./types";

const KEY = "lcp.presets.v1";
const listeners = new Set<() => void>();

// Disk shape: { [presetId]: UserPresetOverrides }. Empty = all product defaults.
type OverridesMap = Record<string, UserPresetOverrides>;

function isMap(v: unknown): v is OverridesMap {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function readMap(): OverridesMap {
  return getJson<OverridesMap>(KEY, {}, isMap);
}

function notify() {
  for (const l of listeners) l();
}

export function getPresetOverrides(id: string): UserPresetOverrides {
  return readMap()[id] ?? {};
}

export function setPresetOverrides(id: string, ov: UserPresetOverrides): boolean {
  const map = readMap();
  // Drop empty/undefined keys so storage doesn't bloat over time.
  const clean = Object.fromEntries(
    Object.entries(ov).filter(([, v]) => v !== undefined && v !== ""),
  );
  if (Object.keys(clean).length) map[id] = clean as UserPresetOverrides;
  else delete map[id];
  const ok = setJson(KEY, map);
  if (ok) notify();
  return ok;
}

export function clearPresetOverrides(id: string): void {
  const map = readMap();
  delete map[id];
  setJson(KEY, map);
  notify();
}

export function subscribePresetSettings(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
