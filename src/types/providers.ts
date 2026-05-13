// Brain: 037-anthropic-compatible-providers
// Types for Anthropic-compatible provider system.
// See: specs/037-anthropic-compatible-providers/data-model.md

export type ProviderKind = 'anthropic' | 'bedrock' | 'custom';

export interface ProviderPreset {
  id: string;
  name: string;
  baseUrl: string;
  sonnetModel: string;
  haikuModel: string;
  defaultModel?: string;
  contextWindow: number;
  docsUrl: string;
  isBuiltIn: true;
}

export interface CustomProvider {
  id: string;
  name: string;
  baseUrl: string;
  sonnetModel: string;
  haikuModel: string;
  defaultModel?: string;
  contextWindow: number;
  notes?: string;
  isBuiltIn: false;
  createdAt: number;
}

export type ProviderEntry = ProviderPreset | CustomProvider;

export type ActiveProviderState =
  | { kind: 'anthropic' }
  | { kind: 'bedrock'; region?: string; modelId?: string }
  // activeModel: when set, overrides the provider's tier models for env override
  // (sonnet/haiku/default all routed to this id). Used when user picks from
  // the refreshed /v1/models list rather than the bundled tier slots.
  | { kind: 'custom'; providerId: string; activeModel?: string };

// Cache of /v1/models responses, keyed by provider id.
export interface ProviderModelCacheEntry {
  models: string[];
  fetchedAt: number;
}

export interface FetchModelsResult {
  ok: boolean;
  models: string[];
  statusCode?: number | null;
  error?: string | null;
}

export interface SessionProviderOverride {
  providerId: string;
}

// Payload sent in daemon query JSON when a custom provider is active.
export interface QuackProviderConfig {
  baseUrl: string;
  authToken: string;
  sonnetModel: string;
  haikuModel: string;
  defaultModel?: string;
  contextWindow: number;
}

export interface TestConnectionResult {
  ok: boolean;
  latencyMs: number;
  modelEcho?: string | null;
  statusCode?: number | null;
  error?: string | null;
}
