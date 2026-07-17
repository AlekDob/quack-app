// User-configurable tier -> concrete model mapping, per backend. Exists
// because backends like cursor-cli have a DYNAMIC model
// catalog (discovered live from the CLI, not a fixed list Quack ships
// with) — capabilities.ts can only offer a "default" sentinel for them,
// which is why switching preset never changed the model on those backends.
// This store lets the user say "on cursor-cli, reasoning = <model X>"
// from Settings; resolvePresetConfigFor prefers it over the static
// capabilities.ts default. Same map/pub-sub pattern as settings.ts.
import { getJson, setJson } from "../localStore";
import type { BackendId, ModelId, ModelTier } from "./types";

const KEY = "lcp.tierModelMap.v1";
const listeners = new Set<() => void>();

type TierMap = Partial<Record<ModelTier, ModelId>>;
type OverridesMap = Partial<Record<BackendId, TierMap>>;

function isMap(v: unknown): v is OverridesMap {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function readMap(): OverridesMap {
  return getJson<OverridesMap>(KEY, {}, isMap);
}

function notify() {
  for (const l of listeners) l();
}

export function getTierModelOverrides(backendId: BackendId): TierMap {
  return readMap()[backendId] ?? {};
}

export function getTierModelOverride(
  backendId: BackendId,
  tier: ModelTier,
): ModelId | undefined {
  return readMap()[backendId]?.[tier];
}

export function setTierModelOverride(
  backendId: BackendId,
  tier: ModelTier,
  modelId: ModelId | null,
): void {
  const map = readMap();
  const forBackend = { ...(map[backendId] ?? {}) };
  if (modelId) forBackend[tier] = modelId;
  else delete forBackend[tier];
  if (Object.keys(forBackend).length) map[backendId] = forBackend;
  else delete map[backendId];
  setJson(KEY, map);
  notify();
}

export function subscribeTierModelOverrides(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
