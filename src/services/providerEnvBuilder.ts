// Brain: 037-anthropic-compatible-providers
// Builds a QuackProviderConfig from the active provider state.
// Returns null when the active provider is Anthropic or Bedrock — the daemon
// will then use its default env (OAuth / ANTHROPIC_API_KEY / Bedrock wiring).

import { findPresetById } from '../constants/providerPresets';
import { getProviderToken } from './providerService';
import { useSettingsStore } from '../stores/settingsStore';
import type {
  ActiveProviderState,
  ProviderEntry,
  QuackProviderConfig,
  SessionProviderOverride,
} from '../types/providers';

function resolveProvider(providerId: string): ProviderEntry | undefined {
  const preset = findPresetById(providerId);
  if (preset) return preset;
  const list = useSettingsStore.getState().claude.customProviders ?? [];
  return list.find((p) => p.id === providerId);
}

export async function buildProviderConfig(
  activeProvider: ActiveProviderState | undefined,
  sessionOverride?: SessionProviderOverride,
): Promise<QuackProviderConfig | null> {
  // Defensive: legacy persisted state may lack activeProvider.
  const ap = activeProvider ?? { kind: 'anthropic' as const };
  // Per-session override wins, then global default.
  let providerId: string | null = null;
  let activeModel: string | undefined;
  if (sessionOverride?.providerId) {
    providerId = sessionOverride.providerId;
  } else if (ap.kind === 'custom') {
    providerId = ap.providerId;
    activeModel = ap.activeModel;
  }

  if (!providerId) return null;

  // Anthropic preset is a no-op — let the daemon use default env.
  if (providerId === 'anthropic') return null;

  const provider = resolveProvider(providerId);
  if (!provider || !provider.baseUrl) return null;

  const token = await getProviderToken(providerId);
  if (!token) return null;

  // When the user picked a specific model from /v1/models (activeModel), route
  // all three tiers to it so the env override fires regardless of the friendly
  // id the SDK ends up sending.
  const sonnetModel = activeModel || provider.sonnetModel;
  const haikuModel = activeModel || provider.haikuModel;
  const defaultModel = activeModel || provider.defaultModel;

  return {
    baseUrl: provider.baseUrl,
    authToken: token,
    sonnetModel,
    haikuModel,
    defaultModel,
    contextWindow: provider.contextWindow,
  };
}
