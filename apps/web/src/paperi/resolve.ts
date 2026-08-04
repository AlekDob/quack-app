// FILE: resolve.ts
// Purpose: Resolve papero model slot for the current provider (fallback B: never switch provider).
// Layer: Web paperi domain

import type { ModelSelection, ProviderKind } from "@synara/contracts";
import type { PaperoId } from "@synara/shared/paperi";

/**
 * Fallback B: return the saved ModelSelection for `currentProvider` only.
 * Never switches provider. Missing/mismatched slot → null (keep composer state).
 */
export function resolvePaperoModelSelection(input: {
  readonly modelSelectionByProvider: Partial<Record<ProviderKind, ModelSelection>>;
  readonly currentProvider: ProviderKind;
}): ModelSelection | null {
  const slot = input.modelSelectionByProvider[input.currentProvider];
  if (!slot || slot.provider !== input.currentProvider) {
    return null;
  }
  return slot;
}

export function paperoSlotProviders(
  modelSelectionByProvider: Partial<Record<ProviderKind, ModelSelection>>,
): ProviderKind[] {
  return (Object.keys(modelSelectionByProvider) as ProviderKind[]).filter(
    (provider) => modelSelectionByProvider[provider]?.provider === provider,
  );
}

export type PaperoModelSelectionMap = Partial<Record<ProviderKind, ModelSelection>>;

export type PaperoOverrides = {
  readonly label?: string;
  readonly role?: string;
  readonly instructions?: string;
  readonly instructionSuffix?: string;
  readonly houseStyle?: string;
  readonly avatar?: string;
};

export type PaperoPersistedState = {
  readonly version: 1;
  readonly overridesByPaperoId: Partial<Record<PaperoId, PaperoOverrides>>;
  readonly modelSelectionByProviderByPaperoId: Partial<Record<PaperoId, PaperoModelSelectionMap>>;
  readonly activePaperoIdByThreadId: Record<string, PaperoId>;
};
