import { composerChipLabel } from "./modelDisplay";
import { makeQualifiedModel, type ProviderId, type ProviderModel } from "./providers/types";
import { modelKey } from "./modelPrefs";

export interface ProviderGroup {
  id: ProviderId;
  name: string;
  models: ProviderModel[];
}

const PROVIDER_LABELS: Record<ProviderId, string> = {
  ollama: "Ollama (local)",
  "claude-code": "Claude Code (CLI)",
  "cursor-cli": "Cursor CLI",
  "opencode-cli": "OpenCode (local)",
  openai: "OpenAI",
  anthropic: "Anthropic",
};

const PROVIDER_ORDER: ProviderId[] = [
  "ollama",
  "claude-code",
  "cursor-cli",
  "opencode-cli",
  "openai",
  "anthropic",
];

/** Build provider groups from live Ollama pulls + curated cloud catalog. */
export function buildModelGroups(
  cloudModels: ProviderModel[],
  ollamaModels: ProviderModel[],
  hasKey: Record<ProviderId, boolean>,
): ProviderGroup[] {
  const byProvider = new Map<ProviderId, ProviderModel[]>();
  if (ollamaModels.length > 0) {
    byProvider.set("ollama", ollamaModels);
  }
  for (const m of cloudModels) {
    if (m.providerId === "ollama") continue;
    if (!hasKey[m.providerId]) continue;
    const list = byProvider.get(m.providerId) ?? [];
    list.push(m);
    byProvider.set(m.providerId, list);
  }
  return PROVIDER_ORDER.filter((id) => byProvider.has(id)).map((id) => ({
    id,
    name: PROVIDER_LABELS[id],
    models: byProvider.get(id)!,
  }));
}

/** Pin the active provider section to the top of the picker list. */
export function reorderGroupsFirst(
  groups: ProviderGroup[],
  providerId: ProviderId,
): ProviderGroup[] {
  const idx = groups.findIndex((g) => g.id === providerId);
  if (idx <= 0) return groups;
  const next = groups.slice();
  const [hit] = next.splice(idx, 1);
  next.unshift(hit);
  return next;
}

export function filterVisibleGroups(
  groups: ProviderGroup[],
  query: string,
  isEnabled: (qualified: string) => boolean,
): ProviderGroup[] {
  const q = query.trim().toLowerCase();
  return groups
    .map((g) => ({
      ...g,
      models: g.models.filter((m) => {
        const key = modelKey(m.providerId, m.modelId);
        if (!isEnabled(key)) return false;
        if (!q) return true;
        return (
          m.modelId.toLowerCase().includes(q) ||
          m.displayName.toLowerCase().includes(q) ||
          g.name.toLowerCase().includes(q)
        );
      }),
    }))
    .filter((g) => g.models.length > 0);
}

export function splitFavoriteModels(
  groups: ProviderGroup[],
  favorites: Record<string, boolean>,
): { favorites: ProviderModel[]; groupsNoFav: ProviderGroup[] } {
  const isFav = (m: ProviderModel) =>
    !!favorites[makeQualifiedModel(m.providerId, m.modelId)];
  const favList = groups.flatMap((g) => g.models).filter(isFav);
  const groupsNoFav = groups
    .map((g) => ({ ...g, models: g.models.filter((m) => !isFav(m)) }))
    .filter((g) => g.models.length > 0);
  return { favorites: favList, groupsNoFav };
}

export function modelLabel(
  models: ProviderModel[],
  selectedQualified: string,
): string {
  return composerChipLabel(selectedQualified, models);
}
