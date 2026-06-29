// Public AI surface: shared types + a router that dispatches to the
// configured provider (Ollama, OpenAI, Anthropic). Provider-specific
// transport lives under src/providers/.

export interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
}

export interface ToolCall {
  id?: string;
  function: { name: string; arguments: Record<string, unknown> };
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: ToolCall[];
  /** Display-only: an opaque tag to associate a tool message with a call. */
  tool_call_id?: string;
  /**
   * Results of agentic provider tool calls (Claude Code Read / Edit /
   * Bash / Glob / etc.) that the provider executed itself. Indexed by
   * tool_use_id — the chat UI pairs each entry with its matching
   * tool_call by id and renders a collapsible result card. We never
   * send these BACK to the provider (Claude Code already saw them);
   * they're purely a UI / persistence concern.
   */
  tool_results?: Array<{
    tool_use_id: string;
    content: string;
    is_error?: boolean;
  }>;
  /**
   * Display-only: an ordered sequence of text fragments and tool
   * calls EXACTLY as they arrived from the provider. Lets the
   * renderer show "text → tool → text → tool" in real chronology
   * instead of the merged "all text first, then all tools" view
   * the legacy `content` + `tool_calls` fields force. Optional —
   * old saved sessions don't have it and fall back to the
   * combined render. Tool result lookup still goes through
   * tool_results above; the block only carries the call id.
   */
  blocks?: Array<
    | { kind: "text"; text: string }
    | { kind: "tool_call"; callId: string }
  >;
  /**
   * Image attachments on a user message (Claude Code only — it reads them
   * via its Read tool from the on-disk `path`). Additive + optional, so
   * providers that only consume `content` are unaffected and old saved
   * sessions render fine. We persist only the lightweight `path`/`name`
   * plus a tiny `thumb` data: URL for the inline preview — full-quality
   * bytes stay on disk and are fetched on demand for the zoom modal.
   */
  images?: Array<{ path: string; name: string; thumb: string }>;
}

export interface ToolDef {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, { type: string; description?: string }>;
      required?: string[];
    };
  };
}

export type ChatStreamEvent =
  | { kind: "content"; text: string }
  | { kind: "tool_call"; call: ToolCall }
  /**
   * Provider-emitted session identifier — agentic providers like Claude
   * Code use this so subsequent turns can `--resume <id>` and keep the
   * server-side context window alive instead of re-paying cold-start +
   * re-stating the whole transcript every turn.
   */
  | { kind: "session"; id: string }
  /**
   * Result of a tool the provider executed itself (Claude Code runs its
   * own internal Read / Edit / Bash / Glob loop). Pairs with the
   * tool_call event by `tool_use_id`. Lets the chat UI render what the
   * agent actually did/saw instead of pretending tool calls were silent.
   */
  | {
      kind: "tool_result";
      tool_use_id: string;
      content: string;
      is_error?: boolean;
    }
  /**
   * End-of-turn usage report — Claude Code emits this in its `result`
   * stream-json event. Lets the chat UI show cost + token breakdown so
   * users notice runaway spend (especially with the documented
   * resume-cache-miss class of bugs that have caused 20× cost spikes).
   * Other providers may emit a similar event in the future; for now
   * only Claude Code populates it.
   */
  | {
      kind: "usage";
      cost?: number;
      durationMs?: number;
      model?: string;
      tokens?: {
        input: number;
        output: number;
        cacheRead: number;
        cacheCreate: number;
      };
      isError?: boolean;
    };

import { getProvider, parseQualifiedModel } from "./providers";
import type { ProviderId } from "./providers";

const OLLAMA_BASE = "http://localhost:11434";

/** Back-compat: still used by the no-models / "Ollama running?" UI. */
export async function ping(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}

/** Back-compat: list LOCAL Ollama models only (used by the no-models flow). */
export async function listModels(): Promise<OllamaModel[]> {
  const res = await fetch(`${OLLAMA_BASE}/api/tags`);
  if (!res.ok) throw new Error("Ollama not reachable");
  const j = (await res.json()) as { models?: OllamaModel[] };
  return j.models ?? [];
}

/**
 * Stream a chat response. The model id is provider-qualified: e.g.
 * "ollama:qwen2.5-coder:7b" or "openai:gpt-4o-mini". For back-compat,
 * an unqualified id (no provider prefix recognized) defaults to ollama.
 */
export async function* chatStream(
  model: string,
  messages: ChatMessage[],
  signal?: AbortSignal,
  tools?: ToolDef[],
  resumeSessionId?: string,
  chatSessionId?: string,
  cwd?: string,
  effort?: string,
  permissionMode?: string,
  thinking?: boolean,
): AsyncGenerator<ChatStreamEvent, void, unknown> {
  const parsed = parseQualifiedModel(model);
  const providerId: ProviderId = parsed?.providerId ?? "ollama";
  const modelId = parsed?.modelId ?? model;
  const provider = getProvider(providerId);
  yield* provider.chat({
    model: modelId,
    messages,
    tools,
    signal,
    resumeSessionId,
    chatSessionId,
    cwd,
    effort,
    permissionMode,
    thinking,
  });
}

/** Ollama-only: pull a model. Yields progress lines. */
export async function* pullStream(
  name: string,
  signal?: AbortSignal,
): AsyncGenerator<{ status: string; completed?: number; total?: number }, void, unknown> {
  const res = await fetch(`${OLLAMA_BASE}/api/pull`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, stream: true }),
    signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`Ollama pull failed: HTTP ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
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
        yield JSON.parse(line);
      } catch {
        /* skip */
      }
    }
  }
}
