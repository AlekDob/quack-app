import type { ChatMessage, ChatStreamEvent, ToolDef } from "../ai";

export interface ProviderModel {
  providerId: ProviderId;
  modelId: string;
  /** Human-readable label (may equal modelId). */
  displayName: string;
  /** Approximate context window in tokens, when known. */
  contextWindow?: number;
  /** Whether the model supports native tool calling. */
  supportsTools?: boolean;
}

export type ProviderId = "ollama" | "openai" | "anthropic" | "claude-code";

export interface ChatProvider {
  id: ProviderId;
  displayName: string;
  /** Provider needs an API key to function. */
  needsApiKey: boolean;
  /** Help URL shown to the user when they need to obtain a key. */
  keyHelpUrl?: string;
  /** Quick check whether the provider is reachable / configured. */
  isAvailable(): Promise<boolean>;
  /** List available models for this provider. */
  listModels(): Promise<ProviderModel[]>;
  /**
   * Stream a chat completion. The implementation must yield content text
   * incrementally and emit any tool_calls as they arrive.
   */
  chat(args: {
    model: string;
    messages: ChatMessage[];
    tools?: ToolDef[];
    signal?: AbortSignal;
    /**
     * Provider-specific session id captured from a previous turn (via
     * the `session` ChatStreamEvent). When set, agentic providers like
     * Claude Code resume the existing server-side session instead of
     * spawning a fresh one — preserving context window + cache hits.
     * Non-agentic providers ignore this.
     */
    resumeSessionId?: string;
    /**
     * Stable per-chat-tab id (the AIChatDescriptor.sessionId in the
     * frontend). Agentic providers use this to register the in-flight
     * stream in a per-chat-session buffer so a frontend refresh can
     * re-attach via `claudeCode.attachToChat()` instead of losing the
     * stream. Non-agentic providers ignore this.
     */
    chatSessionId?: string;
    /**
     * Workspace root the chat BELONGS to. Agentic providers spawn in
     * this directory; without it they fell back to "whichever
     * workspace is active right now", so a chat in workspace A pointed
     * Claude Code's tools at workspace B after the user switched.
     */
    cwd?: string;
    /** Claude Code --effort (low|medium|high|xhigh|max). */
    effort?: string;
    /** Permission mode. plan/acceptEdits/auto keep the hook on (the GUI
     *  overlay enforces acceptEdits/auto); bypassPermissions runs hook-off
     *  (--dangerously-skip-permissions). null/absent = Ask (default). */
    permissionMode?: string;
    /** Claude Code extended-thinking toggle (MAX_THINKING_TOKENS env:
     *  true = forced on, false = off, undefined = CLI default). */
    thinking?: boolean;
  }): AsyncGenerator<ChatStreamEvent, void, unknown>;
}

/** Parse a provider-qualified model id of the form "<providerId>:<modelId>". */
export function parseQualifiedModel(
  qualified: string,
): { providerId: ProviderId; modelId: string } | null {
  const i = qualified.indexOf(":");
  if (i <= 0) return null;
  const providerId = qualified.slice(0, i);
  if (
    providerId !== "ollama" &&
    providerId !== "openai" &&
    providerId !== "anthropic" &&
    providerId !== "claude-code"
  ) {
    return null;
  }
  return { providerId, modelId: qualified.slice(i + 1) };
}

export function makeQualifiedModel(
  providerId: ProviderId,
  modelId: string,
): string {
  return `${providerId}:${modelId}`;
}
