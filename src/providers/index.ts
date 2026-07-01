import type { ChatProvider, ProviderId, ProviderModel } from "./types";
import { ollamaProvider } from "./ollama";
import { openaiProvider } from "./openai";
import { anthropicProvider } from "./anthropic";
import { claudeCodeProvider } from "./claudeCode";
import { cursorCliProvider } from "./cursorCode";

export { hasApiKey, getApiKey, setApiKey } from "./keys";
export type { ProviderId, ProviderModel } from "./types";
export { parseQualifiedModel, makeQualifiedModel } from "./types";
export { warmupOllamaModel } from "./ollama";
export { invalidateClaudeCodeCache } from "./claudeCode";
export { invalidateCursorCliCache } from "./cursorCode";

const REGISTRY: Record<ProviderId, ChatProvider> = {
  ollama: ollamaProvider,
  openai: openaiProvider,
  anthropic: anthropicProvider,
  "claude-code": claudeCodeProvider,
  "cursor-cli": cursorCliProvider,
};

export const PROVIDERS: ChatProvider[] = [
  ollamaProvider,
  claudeCodeProvider,
  cursorCliProvider,
  openaiProvider,
  anthropicProvider,
];

export function getProvider(id: ProviderId): ChatProvider {
  return REGISTRY[id];
}
// Re-export so dynamic imports can grab it via the index.
export { REGISTRY as _registry };

/**
 * Aggregate models from every available provider. Ollama is fetched (so the
 * user sees their local pulls); cloud providers contribute their default
 * curated lists when an API key is present.
 */
export async function listAllModels(): Promise<ProviderModel[]> {
  const out: ProviderModel[] = [];
  for (const p of PROVIDERS) {
    try {
      const ok = await p.isAvailable();
      if (!ok) continue;
      const m = await p.listModels();
      out.push(...m);
    } catch {
      /* skip provider that fails */
    }
  }
  return out;
}

/**
 * Return curated non-Ollama provider model lists regardless of key/CLI
 * status. Used by the model browser so users can see what's available
 * before deciding to set up a provider.
 */
export async function listAllCloudModels(): Promise<ProviderModel[]> {
  const out: ProviderModel[] = [];
  for (const p of PROVIDERS) {
    if (p.id === "ollama") continue;
    try {
      const m = await p.listModels();
      out.push(...m);
    } catch {
      /* skip */
    }
  }
  return out;
}
