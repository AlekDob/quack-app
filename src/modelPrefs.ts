import { getJson as lsGetJson, setJson as lsSetJson } from "./localStore";
import { makeQualifiedModel, type ProviderId } from "./providers/types";

const FAVORITES_KEY = "lcp.modelFavorites";
const DISABLED_KEY = "lcp.modelDisabled";

export function modelKey(providerId: ProviderId, modelId: string): string {
  return makeQualifiedModel(providerId, modelId);
}

function readMap(key: string): Record<string, boolean> {
  return lsGetJson<Record<string, boolean>>(
    key,
    {},
    (v): v is Record<string, boolean> =>
      !!v && typeof v === "object" && !Array.isArray(v),
  );
}

export function getFavoriteModels(): Record<string, boolean> {
  return readMap(FAVORITES_KEY);
}

export function isFavoriteModel(qualified: string): boolean {
  return !!getFavoriteModels()[qualified];
}

export function toggleFavoriteModel(qualified: string): void {
  const map = { ...getFavoriteModels() };
  if (map[qualified]) delete map[qualified];
  else map[qualified] = true;
  lsSetJson(FAVORITES_KEY, map);
}

export function getDisabledModels(): Record<string, boolean> {
  return readMap(DISABLED_KEY);
}

export function isModelEnabled(qualified: string): boolean {
  return !getDisabledModels()[qualified];
}

export function toggleModelEnabled(qualified: string): void {
  const map = { ...getDisabledModels() };
  if (map[qualified]) delete map[qualified];
  else map[qualified] = true;
  lsSetJson(DISABLED_KEY, map);
}
