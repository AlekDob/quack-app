// Brain: 037-anthropic-compatible-providers
// Built-in Anthropic-compatible provider presets.
// Read-only: only the API key is editable per preset. Use "Duplicate as custom" to fork.

import type { ProviderPreset } from '../types/providers';

export const BUILTIN_PRESETS: ProviderPreset[] = [
  {
    id: 'anthropic',
    name: 'Anthropic (Official)',
    baseUrl: '',
    sonnetModel: '',
    haikuModel: '',
    contextWindow: 200000,
    docsUrl: 'https://docs.anthropic.com/',
    isBuiltIn: true,
  },
  {
    id: 'zai',
    name: 'Z.AI',
    baseUrl: 'https://api.z.ai/api/anthropic',
    sonnetModel: 'glm-4.6',
    haikuModel: 'glm-4.5-air',
    contextWindow: 200000,
    docsUrl: 'https://docs.z.ai/devpack/tool/claude',
    isBuiltIn: true,
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    baseUrl: 'https://api.minimax.io/anthropic',
    sonnetModel: 'MiniMax-M2',
    haikuModel: 'MiniMax-M2',
    contextWindow: 1000000,
    docsUrl: 'https://www.minimax.io/platform_overview',
    isBuiltIn: true,
  },
  {
    id: 'kimi',
    name: 'Kimi',
    baseUrl: 'https://api.moonshot.ai/anthropic',
    sonnetModel: 'kimi-k2-0905-preview',
    haikuModel: 'kimi-k2-0905-preview',
    contextWindow: 256000,
    docsUrl: 'https://platform.moonshot.ai/docs',
    isBuiltIn: true,
  },
];

export const ANTHROPIC_PRESET_ID = 'anthropic';

export function findPresetById(id: string): ProviderPreset | undefined {
  return BUILTIN_PRESETS.find((p) => p.id === id);
}
