import type { ModelSelection, NativeApi, ProviderKind } from "@synara/contracts";
import { PROVIDER_DISPLAY_NAMES } from "@synara/contracts";
import { getDefaultModel, hasDefaultModel } from "@synara/shared/model";

import { normalizeHiddenProviders, normalizeProviderOrder } from "../providerOrdering";

export function visibleProjectProviders(input: {
  providerOrder: ReadonlyArray<string>;
  hiddenProviders: ReadonlyArray<string>;
}): ProviderKind[] {
  const hidden = new Set(normalizeHiddenProviders(input.hiddenProviders));
  return normalizeProviderOrder(input.providerOrder).filter((provider) => !hidden.has(provider));
}

export function defaultProjectProvider(input: {
  appDefaultProvider: ProviderKind;
  providers: ReadonlyArray<ProviderKind>;
}): ProviderKind {
  return input.providers.includes(input.appDefaultProvider)
    ? input.appDefaultProvider
    : (input.providers[0] ?? input.appDefaultProvider);
}

export async function resolveProjectDefaultModelSelection(input: {
  api: NativeApi;
  provider: ProviderKind;
  workspaceRoot: string;
}): Promise<ModelSelection> {
  if (hasDefaultModel(input.provider)) {
    return {
      provider: input.provider,
      model: getDefaultModel(input.provider),
    };
  }

  // Pi and Companion have no hardcoded default: ask the runtime for its catalogue.
  const result = await input.api.provider.listModels({
    provider: input.provider,
    cwd: input.workspaceRoot,
  });
  const model = result.models[0]?.slug;
  if (!model) {
    throw new Error(
      `${PROVIDER_DISPLAY_NAMES[input.provider]} has no available models for this project.`,
    );
  }
  return { provider: input.provider, model } as ModelSelection;
}
