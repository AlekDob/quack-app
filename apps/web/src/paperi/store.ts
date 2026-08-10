// FILE: store.ts
// Purpose: Persist papero overrides, per-provider ModelSelection maps, and active papero per thread.
// Layer: Web paperi store (localStorage)

import type { ModelSelection, ProviderKind, ThreadId } from "@synara/contracts";
import {
  DEFAULT_PAPERO_ID,
  getPaperoDefinition,
  isPaperoId,
  type PaperoDefinition,
  type PaperoId,
} from "@synara/shared/paperi";
import { create } from "zustand";

import {
  type PaperoModelSelectionMap,
  type PaperoOverrides,
  type PaperoPersistedState,
  resolvePaperoModelSelection,
} from "./resolve";

const STORAGE_KEY = "synara:paperi:v1";

function readPersisted(): PaperoPersistedState {
  if (typeof localStorage === "undefined") {
    return emptyState();
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<PaperoPersistedState>;
    if (parsed.version !== 1) return emptyState();
    return {
      version: 1,
      overridesByPaperoId: sanitizeOverrides(parsed.overridesByPaperoId),
      modelSelectionByProviderByPaperoId: sanitizeModelMaps(
        parsed.modelSelectionByProviderByPaperoId,
      ),
      activePaperoIdByThreadId: sanitizeActiveMap(parsed.activePaperoIdByThreadId),
    };
  } catch {
    return emptyState();
  }
}

function emptyState(): PaperoPersistedState {
  return {
    version: 1,
    overridesByPaperoId: {},
    modelSelectionByProviderByPaperoId: {},
    activePaperoIdByThreadId: {},
  };
}

function sanitizeOverrides(
  value: Partial<Record<PaperoId, PaperoOverrides>> | undefined,
): Partial<Record<PaperoId, PaperoOverrides>> {
  if (!value || typeof value !== "object") return {};
  const next: Partial<Record<PaperoId, PaperoOverrides>> = {};
  for (const [key, overrides] of Object.entries(value)) {
    if (!isPaperoId(key) || !overrides || typeof overrides !== "object") continue;
    next[key] = overrides;
  }
  return next;
}

function sanitizeModelMaps(
  value: Partial<Record<PaperoId, PaperoModelSelectionMap>> | undefined,
): Partial<Record<PaperoId, PaperoModelSelectionMap>> {
  if (!value || typeof value !== "object") return {};
  const next: Partial<Record<PaperoId, PaperoModelSelectionMap>> = {};
  for (const [key, map] of Object.entries(value)) {
    if (!isPaperoId(key) || !map || typeof map !== "object") continue;
    const cleaned: PaperoModelSelectionMap = {};
    for (const [provider, selection] of Object.entries(map)) {
      if (
        selection &&
        typeof selection === "object" &&
        "provider" in selection &&
        selection.provider === provider &&
        typeof selection.model === "string"
      ) {
        cleaned[provider as ProviderKind] = selection as ModelSelection;
      }
    }
    next[key] = cleaned;
  }
  return next;
}

function sanitizeActiveMap(value: Record<string, PaperoId> | undefined): Record<string, PaperoId> {
  if (!value || typeof value !== "object") return {};
  const next: Record<string, PaperoId> = {};
  for (const [threadId, paperoId] of Object.entries(value)) {
    if (typeof threadId === "string" && isPaperoId(paperoId)) {
      next[threadId] = paperoId;
    }
  }
  return next;
}

function persist(state: PaperoPersistedState): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore quota / private-mode failures.
  }
}

type PaperoStoreState = PaperoPersistedState & {
  getActivePaperoId: (threadId: ThreadId) => PaperoId;
  setActivePaperoId: (threadId: ThreadId, paperoId: PaperoId) => void;
  getModelSelectionMap: (paperoId: PaperoId) => PaperoModelSelectionMap;
  setModelSelectionForProvider: (paperoId: PaperoId, modelSelection: ModelSelection) => void;
  clearModelSelectionForProvider: (paperoId: PaperoId, provider: ProviderKind) => void;
  /**
   * Read-only: overrides are no longer written here. Agent edits live in the Team
   * roster on the server; this only still resolves pre-migration localStorage data.
   */
  resolveEffectiveDefinition: (paperoId: PaperoId) => PaperoDefinition;
  resolveModelForCurrentProvider: (
    paperoId: PaperoId,
    currentProvider: ProviderKind,
  ) => ModelSelection | null;
};

export const usePaperoStore = create<PaperoStoreState>((set, get) => {
  const initial = readPersisted();
  return {
    ...initial,
    getActivePaperoId: (threadId) => {
      return get().activePaperoIdByThreadId[threadId] ?? DEFAULT_PAPERO_ID;
    },
    setActivePaperoId: (threadId, paperoId) => {
      set((state) => {
        const activePaperoIdByThreadId = {
          ...state.activePaperoIdByThreadId,
          [threadId]: paperoId,
        };
        const next = { ...state, activePaperoIdByThreadId };
        persist({
          version: 1,
          overridesByPaperoId: next.overridesByPaperoId,
          modelSelectionByProviderByPaperoId: next.modelSelectionByProviderByPaperoId,
          activePaperoIdByThreadId: next.activePaperoIdByThreadId,
        });
        return { activePaperoIdByThreadId };
      });
    },
    getModelSelectionMap: (paperoId) => {
      return get().modelSelectionByProviderByPaperoId[paperoId] ?? {};
    },
    setModelSelectionForProvider: (paperoId, modelSelection) => {
      set((state) => {
        const previous = state.modelSelectionByProviderByPaperoId[paperoId] ?? {};
        const modelSelectionByProviderByPaperoId = {
          ...state.modelSelectionByProviderByPaperoId,
          [paperoId]: {
            ...previous,
            [modelSelection.provider]: modelSelection,
          },
        };
        persist({
          version: 1,
          overridesByPaperoId: state.overridesByPaperoId,
          modelSelectionByProviderByPaperoId,
          activePaperoIdByThreadId: state.activePaperoIdByThreadId,
        });
        return { modelSelectionByProviderByPaperoId };
      });
    },
    clearModelSelectionForProvider: (paperoId, provider) => {
      set((state) => {
        const previous = { ...(state.modelSelectionByProviderByPaperoId[paperoId] ?? {}) };
        delete previous[provider];
        const modelSelectionByProviderByPaperoId = {
          ...state.modelSelectionByProviderByPaperoId,
          [paperoId]: previous,
        };
        persist({
          version: 1,
          overridesByPaperoId: state.overridesByPaperoId,
          modelSelectionByProviderByPaperoId,
          activePaperoIdByThreadId: state.activePaperoIdByThreadId,
        });
        return { modelSelectionByProviderByPaperoId };
      });
    },
    resolveEffectiveDefinition: (paperoId) => {
      const base = getPaperoDefinition(paperoId);
      const overrides = get().overridesByPaperoId[paperoId];
      if (!overrides) return base;
      return {
        ...base,
        label: overrides.label?.trim() || base.label,
        role: overrides.role?.trim() || base.role,
        avatar: overrides.avatar?.trim() || base.avatar,
        instructions: overrides.instructions?.trim() || base.instructions,
      };
    },
    resolveModelForCurrentProvider: (paperoId, currentProvider) => {
      return resolvePaperoModelSelection({
        modelSelectionByProvider: get().modelSelectionByProviderByPaperoId[paperoId] ?? {},
        currentProvider,
      });
    },
  };
});
