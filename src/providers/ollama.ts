import type { ChatMessage, ChatStreamEvent, ToolDef } from "../ai";
import type { ChatProvider, ProviderModel } from "./types";

const OLLAMA_BASE = "http://localhost:11434";

let tagsCache: {
  ok: boolean;
  models: ProviderModel[];
  checkedAt: number;
} | null = null;
const TAGS_TTL_MS = 5_000;

async function readOllamaTags(): Promise<{
  ok: boolean;
  models: ProviderModel[];
}> {
  if (tagsCache && Date.now() - tagsCache.checkedAt < TAGS_TTL_MS) {
    return { ok: tagsCache.ok, models: tagsCache.models };
  }
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`);
    if (!res.ok) {
      tagsCache = { ok: false, models: [], checkedAt: Date.now() };
      return tagsCache;
    }
    const j = (await res.json()) as { models?: Array<{ name: string }> };
    const models = (j.models ?? []).map((m) => ({
      providerId: "ollama" as const,
      modelId: m.name,
      displayName: m.name,
      supportsTools: true,
    }));
    tagsCache = { ok: true, models, checkedAt: Date.now() };
    return tagsCache;
  } catch {
    tagsCache = { ok: false, models: [], checkedAt: Date.now() };
    return tagsCache;
  }
}

/**
 * Pre-load a model into Ollama's memory so the first real chat doesn't pay
 * the cold-start cost. Uses /api/generate with empty prompt — Ollama loads
 * the weights and returns immediately without generating anything.
 */
export async function warmupOllamaModel(model: string): Promise<void> {
  try {
    await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model, prompt: "", keep_alive: "30m" }),
    });
  } catch {
    /* best-effort: if Ollama is down, the chat call will surface the error */
  }
}

export const ollamaProvider: ChatProvider = {
  id: "ollama",
  displayName: "Ollama (local)",
  needsApiKey: false,
  keyHelpUrl: "https://ollama.com/download",

  async isAvailable() {
    return (await readOllamaTags()).ok;
  },

  async listModels(): Promise<ProviderModel[]> {
    const { ok, models } = await readOllamaTags();
    if (!ok) throw new Error("Ollama not reachable");
    return models;
  },

  async *chat({ model, messages, tools, signal }) {
    const body: Record<string, unknown> = {
      model,
      messages,
      stream: true,
      keep_alive: "30m",
    };
    if (tools && tools.length > 0) body.tools = tools;
    const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok || !res.body) {
      throw new Error(`Ollama chat failed: HTTP ${res.status}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    // Ollama's API returns no tool-call ids. Without one, the chat UI's
    // id-keyed rendering (blocks log, result pairing, status rows)
    // collapses every call in a turn onto the same row — synthesize a
    // unique id per call instead.
    let callSeq = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        try {
          const obj = JSON.parse(line) as {
            message?: {
              content?: string;
              tool_calls?: Array<{
                id?: string;
                function?: { name?: string; arguments?: unknown };
              }>;
            };
            done?: boolean;
          };
          if (obj.message?.content) {
            yield { kind: "content", text: obj.message.content };
          }
          if (obj.message?.tool_calls) {
            for (const c of obj.message.tool_calls) {
              const fn = c.function;
              if (!fn?.name) continue;
              let args: Record<string, unknown> = {};
              const a = fn.arguments;
              if (a && typeof a === "object" && !Array.isArray(a)) {
                args = a as Record<string, unknown>;
              } else if (typeof a === "string") {
                try {
                  const parsed = JSON.parse(a);
                  if (parsed && typeof parsed === "object") {
                    args = parsed as Record<string, unknown>;
                  }
                } catch {
                  /* leave empty */
                }
              }
              yield {
                kind: "tool_call",
                call: {
                  id: c.id ?? `ollama_${callSeq++}_${fn.name}`,
                  function: { name: fn.name, arguments: args },
                },
              };
            }
          }
          if (obj.done) return;
        } catch {
          /* skip malformed line */
        }
      }
    }
  },
};

// Suppress unused-imports warning while keeping the type imports explicit.
export type { ChatMessage, ChatStreamEvent, ToolDef };
