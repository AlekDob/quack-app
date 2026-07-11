import type { ChatProvider, ProviderId, ProviderModel } from "./types";
import { ollamaProvider } from "./ollama";
import { openaiProvider } from "./openai";
import { anthropicProvider } from "./anthropic";
import { claudeCodeProvider } from "./claudeCode";
import { cursorCliProvider } from "./cursorCode";
import { openCodeProvider } from "./openCode";

export { hasApiKey, getApiKey, setApiKey } from "./keys";
export type { ProviderId, ProviderModel } from "./types";
export { parseQualifiedModel, makeQualifiedModel, isAgenticProviderId } from "./types";
export { warmupOllamaModel } from "./ollama";
export { invalidateClaudeCodeCache, refreshClaudeCodeModelsLive, claudeCodePickerModels } from "./claudeCode";
export { invalidateCursorCliCache, refreshCursorModelsLive } from "./cursorCode";
export { invalidateOpenCodeCache, refreshOpenCodeModelsLive } from "./openCode";

const REGISTRY: Record<ProviderId, ChatProvider> = {
  ollama: ollamaProvider,
  openai: openaiProvider,
  anthropic: anthropicProvider,
  "claude-code": claudeCodeProvider,
  "cursor-cli": cursorCliProvider,
  "opencode-cli": openCodeProvider,
};

export const PROVIDERS: ChatProvider[] = [
  ollamaProvider,
  claudeCodeProvider,
  cursorCliProvider,
  openCodeProvider,
  openaiProvider,
  anthropicProvider,
];

export function getProvider(id: ProviderId): ChatProvider {
  return REGISTRY[id];
}
// Re-export so dynamic imports can grab it via the index.
export { REGISTRY as _registry };

/**
 * Fast picker probe — skips slow CLI spawns (`cursor-agent`, OpenCode sidecar,
 * Claude `/model` label probes). CLI catalogs load lazily via warmPickerCatalogs().
 */
export async function listFastModels(): Promise<ProviderModel[]> {
  const skip = new Set<ProviderId>(["cursor-cli", "opencode-cli", "claude-code"]);
  const chunks = await Promise.all(
    PROVIDERS.filter((p) => !skip.has(p.id)).map(async (p) => {
      try {
        if (!(await p.isAvailable())) return [] as ProviderModel[];
        return await p.listModels();
      } catch {
        return [] as ProviderModel[];
      }
    }),
  );
  return chunks.flat();
}

/**
 * Aggregate models from every available provider. Ollama is fetched (so the
 * user sees their local pulls); cloud providers contribute their default
 * curated lists when an API key is present.
 */
export async function listAllModels(): Promise<ProviderModel[]> {
  const chunks = await Promise.all(
    PROVIDERS.map(async (p) => {
      try {
        if (!(await p.isAvailable())) return [] as ProviderModel[];
        return await p.listModels();
      } catch {
        return [] as ProviderModel[];
      }
    }),
  );
  return chunks.flat();
}

/**
 * Return curated non-Ollama provider model lists regardless of key/CLI
 * status. Used by the model browser so users can see what's available
 * before deciding to set up a provider.
 */
export async function listAllCloudModels(): Promise<ProviderModel[]> {
  const chunks = await Promise.all(
    PROVIDERS.filter((p) => p.id !== "ollama").map(async (p) => {
      try {
        return await p.listModels();
      } catch {
        return [] as ProviderModel[];
      }
    }),
  );
  return chunks.flat();
}
