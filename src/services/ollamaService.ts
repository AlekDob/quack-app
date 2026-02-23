/**
 * Ollama Service - Discovery and health check for local Ollama instance
 * Used when LLM provider is set to 'ollama'
 */

import type { OllamaModel } from '../types';

const DEFAULT_TIMEOUT = 3000;

interface OllamaTagsResponse {
  models: OllamaModel[];
}

/** Check if Ollama is running at the given base URL */
export async function checkOllamaRunning(baseUrl: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
    const res = await fetch(`${baseUrl}/api/tags`, { signal: controller.signal });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

/** Fetch available models from Ollama */
export async function fetchOllamaModels(baseUrl: string): Promise<OllamaModel[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
    const res = await fetch(`${baseUrl}/api/tags`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return [];
    const data: OllamaTagsResponse = await res.json();
    return data.models ?? [];
  } catch {
    return [];
  }
}

/** Format model options for dropdown */
export function getOllamaModelOptions(models: OllamaModel[]): { value: string; label: string }[] {
  return models.map(m => ({
    value: m.name,
    label: `${m.name} (${formatSize(m.size)})`,
  }));
}

function formatSize(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}
