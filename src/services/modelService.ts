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
  { id: 'opus47', modelId: 'claude-opus-4-7', label: 'Opus 4.7', isDefault: true, isActive: true, sortOrder: 0 },
  { id: 'opus46-1m', modelId: 'claude-opus-4-6[1m]', label: 'Opus 4.6 (1M)', isDefault: false, isActive: true, sortOrder: 1 },
  { id: 'opus46', modelId: 'claude-opus-4-6', label: 'Opus 4.6', isDefault: false, isActive: true, sortOrder: 2 },
  { id: 'sonnet46', modelId: 'claude-sonnet-4-6', label: 'Sonnet 4.6', isDefault: false, isActive: true, sortOrder: 3 },
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
  'opus': 'opus47',
  'opus46': 'opus47', // Opus 4.6 deprecated, upgrade to 4.7
};

// Brain: fix-session-backup-quota-cascade
/**
 * Module-scoped flag: the fallback warning is called from many hot render paths
 * (every select dropdown, every settings read). Without dedup it spams the
 * console into oblivion when Supabase is unreachable. Log once per session.
 */
let emergencyFallbackWarned = false;

/**
 * Reset the fallback warning dedup flag. Call after a successful remote
 * models fetch so a later disconnect gets logged again.
 */
export function resetEmergencyFallbackWarning(): void {
  emergencyFallbackWarned = false;
}

/**
 * Get active models sorted by sortOrder.
 * Prioritizes remote config from Supabase.
 * Emergency fallback only used when Supabase is unreachable.
 */
export function getModels(remoteModels?: ModelConfig[]): ModelConfig[] {
  const models = remoteModels?.filter(m => m.isActive);
  if (models && models.length > 0) {
    emergencyFallbackWarned = false;
    const sorted = [...models].sort((a, b) => a.sortOrder - b.sortOrder);
    return sorted;
  }
  // Emergency fallback - Supabase unreachable. Warn once per session to avoid
  // flooding the console from hot render paths.
  if (!emergencyFallbackWarned) {
    emergencyFallbackWarned = true;
    console.warn('[ModelService] Using emergency fallback - Supabase models not available');
  }
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
 * Return the Anthropic-recommended default effort for a given Quack model ID.
 * - Opus 4.7 → 'xhigh' (recommended default, per code.claude.com/docs/en/model-config)
 * - Opus 4.6 / Sonnet 4.6 → 'high'
 * - Everything else (Sonnet 4.5, Haiku, Ollama/custom) → 'medium'
 *   (models without native effort support ignore the field SDK-side)
 */
export function defaultEffortForModel(modelId: string): 'low' | 'medium' | 'high' | 'xhigh' | 'max' {
  const base = modelId.replace('[1m]', '');
  if (base === 'opus47' || base === 'opus') return 'xhigh';
  if (base === 'opus46' || base === 'sonnet46') return 'high';
  return 'medium';
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
  const has1MySuffix = friendlyName.endsWith('[1m]');
  const baseName = has1MySuffix ? friendlyName.replace('[1m]', '') : friendlyName;

  const models = getModels(remoteModels);

  // Try direct match first
  let found = models.find(m => m.id === baseName);

  // If not found, try legacy mapping
  if (!found && LEGACY_ID_MAP[baseName]) {
    found = models.find(m => m.id === LEGACY_ID_MAP[baseName]);
  }

  const label = found?.label ?? baseName;
  return has1MySuffix ? `${label} (1M)` : label;
}
