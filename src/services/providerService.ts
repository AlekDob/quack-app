// Brain: 037-anthropic-compatible-providers
// Provider service: list providers, save/load namespaced API keys,
// test connection. Uses Tauri commands `save_provider_api_key`/`get_provider_api_key`
// (additive — does NOT touch existing `save_api_key` schema).

import { invoke } from '@tauri-apps/api/core';
import { BUILTIN_PRESETS, findPresetById } from '../constants/providerPresets';
import { useSettingsStore } from '../stores/settingsStore';
import type {
  CustomProvider,
  FetchModelsResult,
  ProviderEntry,
  TestConnectionResult,
} from '../types/providers';

export function listAllProviders(): ProviderEntry[] {
  const custom = useSettingsStore.getState().claude.customProviders ?? [];
  return [...BUILTIN_PRESETS, ...custom];
}

export function getProviderById(id: string): ProviderEntry | undefined {
  const preset = findPresetById(id);
  if (preset) return preset;
  const list = useSettingsStore.getState().claude.customProviders ?? [];
  return list.find((p) => p.id === id);
}

export async function saveProviderToken(
  providerId: string,
  token: string,
): Promise<void> {
  await invoke('save_provider_api_key', { providerId, token });
}

export async function getProviderToken(
  providerId: string,
): Promise<string | null> {
  const token = await invoke<string | null>('get_provider_api_key', {
    providerId,
  });
  return token ?? null;
}

export async function testConnection(providerId: string): Promise<TestConnectionResult> {
  const provider = getProviderById(providerId);
  if (!provider) {
    return { ok: false, latencyMs: 0, error: 'Provider not found' };
  }
  if (!provider.baseUrl) {
    return {
      ok: false,
      latencyMs: 0,
      error: 'Anthropic official preset has no baseUrl to test',
    };
  }
  const token = await getProviderToken(providerId);
  if (!token) {
    return { ok: false, latencyMs: 0, error: 'No API key configured' };
  }
  const model = provider.sonnetModel || provider.defaultModel || '';
  return invoke<TestConnectionResult>('test_provider_connection', {
    baseUrl: provider.baseUrl,
    authToken: token,
    model,
  });
}

export function addCustomProvider(provider: Omit<CustomProvider, 'createdAt' | 'isBuiltIn'>): void {
  const store = useSettingsStore.getState();
  const existing = store.claude.customProviders ?? [];
  const next: CustomProvider = {
    ...provider,
    isBuiltIn: false,
    createdAt: Date.now(),
  };
  store.updateClaudeSettings({
    customProviders: [...existing, next],
  });
}

export function updateCustomProvider(id: string, patch: Partial<CustomProvider>): void {
  const store = useSettingsStore.getState();
  const existing = store.claude.customProviders ?? [];
  store.updateClaudeSettings({
    customProviders: existing.map((p) => (p.id === id ? { ...p, ...patch } : p)),
  });
}

// Brain: 037-anthropic-compatible-providers
// Calls GET /v1/models on the provider endpoint and caches the result on the store.
export async function fetchProviderModels(providerId: string): Promise<FetchModelsResult> {
  const provider = getProviderById(providerId);
  if (!provider) {
    return { ok: false, models: [], error: 'Provider not found' };
  }
  if (!provider.baseUrl) {
    return { ok: false, models: [], error: 'Anthropic preset has no baseUrl to list' };
  }
  const token = await getProviderToken(providerId);
  if (!token) {
    return { ok: false, models: [], error: 'No API key configured' };
  }
  const result = await invoke<FetchModelsResult>('fetch_provider_models', {
    baseUrl: provider.baseUrl,
    authToken: token,
  });
  if (result.ok && result.models.length > 0) {
    const store = useSettingsStore.getState();
    const cache = store.claude.providerModelCache ?? {};
    store.updateClaudeSettings({
      providerModelCache: {
        ...cache,
        [providerId]: { models: result.models, fetchedAt: Date.now() },
      },
    });
  }
  return result;
}

export function deleteCustomProvider(id: string): void {
  const store = useSettingsStore.getState();
  const existing = store.claude.customProviders ?? [];
  const filtered = existing.filter((p) => p.id !== id);
  const active = store.claude.activeProvider ?? { kind: 'anthropic' as const };
  const patch: Partial<typeof store.claude> = { customProviders: filtered };
  if (active.kind === 'custom' && active.providerId === id) {
    patch.activeProvider = { kind: 'anthropic' };
  }
  store.updateClaudeSettings(patch);
}
