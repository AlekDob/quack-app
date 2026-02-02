/**
 * Dynamic Model Service
 * Fetches model configurations from Supabase app_config.
 * Falls back to hardcoded models when offline.
 */

export interface ModelConfig {
  id: string;
  modelId: string;
  label: string;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
}

/** Hardcoded fallback used when Supabase is unreachable */
const FALLBACK_MODELS: ModelConfig[] = [
  { id: 'opus', modelId: 'claude-opus-4-5-20251101', label: 'Opus 4.5', isDefault: false, isActive: true, sortOrder: 1 },
  { id: 'sonnet', modelId: 'claude-sonnet-4-5-20250929', label: 'Sonnet 4.5', isDefault: true, isActive: true, sortOrder: 2 },
  { id: 'haiku', modelId: 'claude-haiku-4-5', label: 'Haiku 4.5', isDefault: false, isActive: true, sortOrder: 3 },
];

/**
 * Get active models sorted by sortOrder.
 * Uses remote config if available, otherwise hardcoded fallback.
 */
export function getModels(remoteModels?: ModelConfig[]): ModelConfig[] {
  const models = remoteModels?.filter(m => m.isActive);
  if (models && models.length > 0) {
    return [...models].sort((a, b) => a.sortOrder - b.sortOrder);
  }
  return FALLBACK_MODELS;
}

/**
 * Map friendly model name (e.g. 'sonnet') to full API model ID.
 * Checks remote config first, then fallback.
 */
export function getModelId(
  friendlyName: string,
  remoteModels?: ModelConfig[]
): string {
  const models = getModels(remoteModels);
  const found = models.find(m => m.id === friendlyName);
  return found?.modelId ?? friendlyName;
}

/**
 * Get the default model config.
 */
export function getDefaultModel(
  remoteModels?: ModelConfig[]
): ModelConfig {
  const models = getModels(remoteModels);
  return models.find(m => m.isDefault) ?? models[0];
}

/**
 * Get model options for select dropdowns: { value, label }[]
 */
export function getModelOptions(
  remoteModels?: ModelConfig[]
): { value: string; label: string }[] {
  return getModels(remoteModels).map(m => ({
    value: m.id,
    label: m.label,
  }));
}

/**
 * Get the display label for a model ID.
 */
export function getModelLabel(
  friendlyName: string,
  remoteModels?: ModelConfig[]
): string {
  const models = getModels(remoteModels);
  return models.find(m => m.id === friendlyName)?.label ?? friendlyName;
}
