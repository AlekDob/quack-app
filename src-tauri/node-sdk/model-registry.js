/**
 * Model Registry for Vercel AI SDK providers.
 * Ported from NamiOS models.ts, adapted for Quack daemon.
 *
 * Provides: model catalog, auto-detection, presets, SDK model instantiation.
 */
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';

// @ts-check

/**
 * @typedef {'fast' | 'smart' | 'pro'} Preset
 * @typedef {'openai' | 'google' | 'openrouter' | 'anthropic-vercel' | 'minimax' | 'zai'} VercelProviderName
 * @typedef {{ id: string, label: string, provider: VercelProviderName, preset: Preset, toolUse: boolean, vision: boolean, contextWindow: number }} ModelEntry
 * @typedef {{ openai?: string, google?: string, openrouter?: string, anthropic?: string, minimax?: string, zai?: string }} DetectedKeys
 */

/** @type {ModelEntry[]} */
const REGISTRY = [
  // === OpenAI === (direct)
  { id: 'codex-mini-latest', label: 'Codex Mini', provider: 'openai', preset: 'smart', toolUse: true, vision: false, contextWindow: 192000 },
  { id: 'o4-mini', label: 'o4 Mini', provider: 'openai', preset: 'smart', toolUse: true, vision: true, contextWindow: 200000 },
  { id: 'o3', label: 'o3', provider: 'openai', preset: 'pro', toolUse: true, vision: true, contextWindow: 200000 },
  { id: 'o3-pro', label: 'o3 Pro', provider: 'openai', preset: 'pro', toolUse: true, vision: true, contextWindow: 200000 },
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini', provider: 'openai', preset: 'fast', toolUse: true, vision: true, contextWindow: 128000 },
  { id: 'gpt-4o', label: 'GPT-4o', provider: 'openai', preset: 'pro', toolUse: true, vision: true, contextWindow: 128000 },
  { id: 'gpt-4.1', label: 'GPT-4.1', provider: 'openai', preset: 'pro', toolUse: true, vision: true, contextWindow: 1047576 },
  { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini', provider: 'openai', preset: 'smart', toolUse: true, vision: true, contextWindow: 1047576 },
  { id: 'gpt-4.1-nano', label: 'GPT-4.1 Nano', provider: 'openai', preset: 'fast', toolUse: true, vision: false, contextWindow: 1047576 },
  { id: 'gpt-5.3-codex', label: 'GPT-5.3 Codex', provider: 'openai', preset: 'pro', toolUse: true, vision: false, contextWindow: 200000 },
  { id: 'gpt-5.3-codex-spark', label: 'GPT-5.3 Codex Spark', provider: 'openai', preset: 'fast', toolUse: true, vision: false, contextWindow: 128000 },

  // === Google === (direct)
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', provider: 'google', preset: 'pro', toolUse: true, vision: true, contextWindow: 1048576 },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'google', preset: 'fast', toolUse: true, vision: true, contextWindow: 1048576 },
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', provider: 'google', preset: 'fast', toolUse: true, vision: true, contextWindow: 1048576 },

  // === OpenRouter === (aggregator, uses OpenAI-compatible API)
  { id: 'openai/gpt-4o', label: 'GPT-4o (OpenRouter)', provider: 'openrouter', preset: 'pro', toolUse: true, vision: true, contextWindow: 128000 },
  { id: 'openai/gpt-4o-mini', label: 'GPT-4o Mini (OpenRouter)', provider: 'openrouter', preset: 'fast', toolUse: true, vision: true, contextWindow: 128000 },
  { id: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro (OpenRouter)', provider: 'openrouter', preset: 'pro', toolUse: true, vision: true, contextWindow: 1048576 },
  { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash (OpenRouter)', provider: 'openrouter', preset: 'fast', toolUse: true, vision: true, contextWindow: 1048576 },
  { id: 'meta-llama/llama-4-maverick', label: 'Llama 4 Maverick (OpenRouter)', provider: 'openrouter', preset: 'pro', toolUse: true, vision: true, contextWindow: 1048576 },
  { id: 'deepseek/deepseek-r1', label: 'DeepSeek R1 (OpenRouter)', provider: 'openrouter', preset: 'smart', toolUse: false, vision: false, contextWindow: 163840 },
  { id: 'qwen/qwen3-coder', label: 'Qwen3 Coder (OpenRouter)', provider: 'openrouter', preset: 'smart', toolUse: true, vision: false, contextWindow: 262144 },

  // === MiniMax === (direct + OpenRouter)
  { id: 'MiniMax-M2.5', label: 'MiniMax M2.5', provider: 'minimax', preset: 'smart', toolUse: true, vision: false, contextWindow: 1048576 },
  { id: 'MiniMax-M2.5-highspeed', label: 'MiniMax M2.5 HighSpeed', provider: 'minimax', preset: 'fast', toolUse: true, vision: false, contextWindow: 1048576 },
  { id: 'MiniMax-M2.1', label: 'MiniMax M2.1', provider: 'minimax', preset: 'smart', toolUse: true, vision: false, contextWindow: 1048576 },
  { id: 'minimax/MiniMax-M2.5', label: 'MiniMax M2.5 (OpenRouter)', provider: 'openrouter', preset: 'smart', toolUse: true, vision: false, contextWindow: 1048576 },
  { id: 'minimax/MiniMax-M2.5-highspeed', label: 'MiniMax M2.5 HS (OpenRouter)', provider: 'openrouter', preset: 'fast', toolUse: true, vision: false, contextWindow: 1048576 },

  // === ZAI / GLM === (direct + OpenRouter)
  { id: 'glm-5', label: 'GLM 5', provider: 'zai', preset: 'pro', toolUse: true, vision: false, contextWindow: 128000 },
  { id: 'glm-4.7', label: 'GLM 4.7', provider: 'zai', preset: 'smart', toolUse: true, vision: false, contextWindow: 128000 },
  { id: 'glm-4.7-flash', label: 'GLM 4.7 Flash', provider: 'zai', preset: 'fast', toolUse: true, vision: false, contextWindow: 128000 },
  { id: 'z-ai/glm-4.7-flash', label: 'GLM 4.7 Flash (OpenRouter)', provider: 'openrouter', preset: 'fast', toolUse: true, vision: false, contextWindow: 128000 },
  { id: 'z-ai/glm-4.7', label: 'GLM 4.7 (OpenRouter)', provider: 'openrouter', preset: 'smart', toolUse: true, vision: false, contextWindow: 128000 },
];

/**
 * Detect available API keys from provided object or env vars.
 * @param {Partial<DetectedKeys>} [override] — keys passed from frontend
 * @returns {DetectedKeys}
 */
export function detectApiKeys(override = {}) {
  return {
    openai: override.openai || process.env.OPENAI_API_KEY,
    google: override.google || process.env.GOOGLE_AI_API_KEY,
    openrouter: override.openrouter || process.env.OPENROUTER_API_KEY,
    anthropic: override.anthropic || process.env.ANTHROPIC_API_KEY,
    minimax: override.minimax || process.env.MINIMAX_API_KEY,
    zai: override.zai || process.env.ZAI_API_KEY,
  };
}

/**
 * Filter registry by available API keys.
 * @param {DetectedKeys} keys
 * @returns {ModelEntry[]}
 */
export function getAvailableModels(keys) {
  return REGISTRY.filter(m => {
    if (m.provider === 'openai') return Boolean(keys.openai);
    if (m.provider === 'google') return Boolean(keys.google);
    if (m.provider === 'openrouter') return Boolean(keys.openrouter);
    if (m.provider === 'anthropic-vercel') return Boolean(keys.anthropic);
    if (m.provider === 'minimax') return Boolean(keys.minimax);
    if (m.provider === 'zai') return Boolean(keys.zai);
    return false;
  });
}

/**
 * Pick best model for a given preset tier.
 * Prefers tool-use capable, direct providers over OpenRouter.
 * @param {Preset} preset
 * @param {DetectedKeys} keys
 * @returns {ModelEntry | null}
 */
export function pickBestModel(preset, keys) {
  const available = getAvailableModels(keys);
  const presetModels = available.filter(m => m.preset === preset);

  // Prefer direct providers with tool use
  const directWithTools = presetModels
    .filter(m => m.provider !== 'openrouter' && m.toolUse);
  if (directWithTools.length > 0) return directWithTools[0];

  // Fallback: any direct provider
  const direct = presetModels.filter(m => m.provider !== 'openrouter');
  if (direct.length > 0) return direct[0];

  // Last resort: OpenRouter
  if (presetModels.length > 0) return presetModels[0];

  // No match for this preset — return any available
  return available[0] || null;
}

/**
 * Find a model by ID or label (case-insensitive, partial match).
 * @param {string} nameOrId
 * @returns {ModelEntry | undefined}
 */
export function findModel(nameOrId) {
  const lower = nameOrId.toLowerCase();
  const exact = REGISTRY.find(m =>
    m.id.toLowerCase() === lower ||
    m.label.toLowerCase() === lower,
  );
  if (exact) return exact;
  return REGISTRY.find(m => m.id.toLowerCase().includes(lower));
}

/**
 * Instantiate a Vercel AI SDK model object for the given entry.
 * @param {ModelEntry} entry
 * @param {DetectedKeys} keys
 * @returns {import('ai').LanguageModel}
 */
export function createModel(entry, keys) {
  if (entry.provider === 'openai') {
    const provider = createOpenAI({ apiKey: keys.openai });
    return provider(entry.id);
  }

  if (entry.provider === 'google') {
    const provider = createGoogleGenerativeAI({ apiKey: keys.google });
    return provider(entry.id);
  }

  if (entry.provider === 'anthropic-vercel') {
    const provider = createAnthropic({ apiKey: keys.anthropic });
    return provider(entry.id);
  }

  // MiniMax — OpenAI-compatible API (same pattern as Meow)
  if (entry.provider === 'minimax') {
    const provider = createOpenAI({
      baseURL: 'https://api.minimax.io/v1',
      apiKey: keys.minimax,
      name: 'minimax',
    });
    return provider.chat(entry.id);
  }

  // ZAI / GLM — OpenAI-compatible API (same pattern as Meow)
  if (entry.provider === 'zai') {
    const provider = createOpenAI({
      baseURL: 'https://api.z.ai/api/coding/paas/v4',
      apiKey: keys.zai,
      name: 'zai',
    });
    return provider.chat(entry.id);
  }

  // OpenRouter — uses OpenAI-compatible endpoint via createOpenAI
  const provider = createOpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: keys.openrouter,
    name: 'openrouter',
  });
  return provider(entry.id);
}

/**
 * Get full registry (for UI display).
 * @returns {ModelEntry[]}
 */
export function getRegistry() {
  return [...REGISTRY];
}
