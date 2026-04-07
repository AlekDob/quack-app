/**
 * Dynamic Model Service
 * Fetches model configurations from Supabase app_config.
 *
 * ZERO CODE CHANGES POLICY:
 * - All model configuration lives in Supabase
 * - No hardcoded model IDs in this file
 * - Emergency fallback uses a single generic model
 * - To add/remove/update models: edit Supabase app_config only
 */

export interface ModelConfig {
  id: string;
  modelId: string;
  label: string;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
}

/**
 * Emergency fallback - used ONLY when Supabase is completely unreachable.
 * This should rarely happen in practice.
 * Uses Sonnet as a safe, cost-effective default.
 */
const EMERGENCY_FALLBACK: ModelConfig[] = [
  { id: 'opus46-1m', modelId: 'claude-opus-4-6[1m]', label: 'Opus 4.6 (1M)', isDefault: true, isActive: true, sortOrder: 0 },
  { id: 'opus46', modelId: 'claude-opus-4-6', label: 'Opus 4.6', isDefault: false, isActive: true, sortOrder: 1 },
  { id: 'sonnet46', modelId: 'claude-sonnet-4-6', label: 'Sonnet 4.6', isDefault: false, isActive: true, sortOrder: 2 },
  { id: 'sonnet45', modelId: 'claude-sonnet-4-5-20250929', label: 'Sonnet 4.5', isDefault: false, isActive: true, sortOrder: 3 },
  { id: 'haiku45', modelId: 'claude-haiku-4-5', label: 'Haiku 4.5', isDefault: false, isActive: true, sortOrder: 4 },
];

/**
 * Legacy ID mappings for backwards compatibility.
 * Maps old-style IDs used in code to new Supabase IDs.
 * This allows gradual migration without breaking existing code.
 */
const LEGACY_ID_MAP: Record<string, string> = {
  'sonnet': 'sonnet46',
  'sonnet45': 'sonnet46', // Sonnet 4.5 deprecated, upgrade to 4.6
  'haiku': 'haiku45',
  'opus': 'opus46',
};

/**
 * Get active models sorted by sortOrder.
 * Prioritizes remote config from Supabase.
 * Emergency fallback only used when Supabase is unreachable.
 */
export function getModels(remoteModels?: ModelConfig[]): ModelConfig[] {
  const models = remoteModels?.filter(m => m.isActive);
  if (models && models.length > 0) {
    const sorted = [...models].sort((a, b) => a.sortOrder - b.sortOrder);
    return sorted;
  }
  // Emergency fallback - Supabase unreachable
  console.warn('[ModelService] Using emergency fallback - Supabase models not available');
  return EMERGENCY_FALLBACK;
}

/**
 * Map friendly model ID (e.g. 'opus46') to full API model ID.
 * Supports legacy IDs ('sonnet', 'haiku', 'opus') via LEGACY_ID_MAP.
 * All model IDs are managed in Supabase - no hardcoded mappings.
 */
export function getModelId(
  friendlyName: string,
  remoteModels?: ModelConfig[]
): string {
  // Handle [1m] suffix for 1M context window
  const has1MSuffix = friendlyName.endsWith('[1m]');
  const baseName = has1MSuffix ? friendlyName.replace('[1m]', '') : friendlyName;

  const models = getModels(remoteModels);

  // Try direct match first
  let found = models.find(m => m.id === baseName);

  // If not found, try legacy mapping
  if (!found && LEGACY_ID_MAP[baseName]) {
    const mappedId = LEGACY_ID_MAP[baseName];
    found = models.find(m => m.id === mappedId);
    if (found) {
      console.debug(`[ModelService] Mapped legacy ID '${baseName}' → '${mappedId}'`);
    }
  }

  if (!found) {
    console.warn(`[ModelService] Model '${baseName}' not found in config, using as-is`);
  }

  const modelId = found?.modelId ?? baseName;
  // Re-append [1m] suffix — SDK strips it before sending to API
  return has1MSuffix ? `${modelId}[1m]` : modelId;
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
 * Supports legacy IDs via LEGACY_ID_MAP.
 */
export function getModelLabel(
  friendlyName: string,
  remoteModels?: ModelConfig[]
): string {
  // Handle [1m] suffix for 1M context window
  const has1MSuffix = friendlyName.endsWith('[1m]');
  const baseName = has1MSuffix ? friendlyName.replace('[1m]', '') : friendlyName;

  const models = getModels(remoteModels);

  // Try direct match first
  let found = models.find(m => m.id === baseName);

  // If not found, try legacy mapping
  if (!found && LEGACY_ID_MAP[baseName]) {
    found = models.find(m => m.id === LEGACY_ID_MAP[baseName]);
  }

  const label = found?.label ?? baseName;
  return has1MSuffix ? `${label} (1M)` : label;
}
