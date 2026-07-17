// User override store for presets — separate from the shipped defaults in
// builtins.ts. Built-in edits (Jack, Milo, Nora, Vera, Lia) persist to
// disk (no localStorage quota) with a localStorage fallback for Vite-only
// dev. Same pub/sub shape as workspaceColors.ts so composer + Team react
// without prop threading.
import { invoke } from "@tauri-apps/api/core";
import { getJson, setJson, remove } from "../localStore";
import type { UserPresetOverrides } from "./types";

const KEY = "lcp.presets.v1";
const listeners = new Set<() => void>();

type OverridesMap = Record<string, UserPresetOverrides>;

let cache: OverridesMap | null = null;
let hydrating: Promise<void> | null = null;

function isTauri(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

function isMap(v: unknown): v is OverridesMap {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function readLocalStorage(): OverridesMap {
  return getJson<OverridesMap>(KEY, {}, isMap);
}

function notify() {
  for (const l of listeners) l();
}

function ensureCache(): OverridesMap {
  return cache ?? readLocalStorage();
}

async function persistMap(map: OverridesMap): Promise<boolean> {
  cache = map;
  if (isTauri()) {
    try {
      await invoke("preset_overrides_save", { data: map });
      remove(KEY);
      return true;
    } catch {
      /* fall through to localStorage */
    }
  }
  return setJson(KEY, map);
}

/** Load overrides from disk (migrating legacy localStorage on first run). */
export async function hydratePresetOverrides(): Promise<void> {
  if (cache !== null) return;
  if (hydrating) {
    await hydrating;
    return;
  }
  hydrating = (async () => {
    if (isTauri()) {
      try {
        const disk = await invoke<unknown>("preset_overrides_load");
        if (isMap(disk) && Object.keys(disk).length > 0) {
          cache = disk;
          return;
        }
      } catch {
        /* fall through */
      }
    }
    const legacy = readLocalStorage();
    cache = legacy;
    if (Object.keys(legacy).length > 0) await persistMap(legacy);
  })();
  await hydrating;
  hydrating = null;
}

export function getPresetOverrides(id: string): UserPresetOverrides {
  return ensureCache()[id] ?? {};
}

export async function setPresetOverrides(
  id: string,
  ov: UserPresetOverrides,
): Promise<boolean> {
  await hydratePresetOverrides();
  const map = { ...ensureCache() };
  const clean = Object.fromEntries(
    Object.entries(ov).filter(([, v]) => v !== undefined && v !== ""),
  );
  if (Object.keys(clean).length) map[id] = clean as UserPresetOverrides;
  else delete map[id];
  const ok = await persistMap(map);
  if (ok) notify();
  return ok;
}

export async function clearPresetOverrides(id: string): Promise<void> {
  await hydratePresetOverrides();
  const map = { ...ensureCache() };
  delete map[id];
  await persistMap(map);
  notify();
}

export function subscribePresetSettings(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
