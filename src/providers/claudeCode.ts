import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { ChatStreamEvent, ToolCall } from "../ai";
import { ccAliasContextWindow, contextTokensFromApiUsage } from "../contextUsage";
import type { ChatProvider, ProviderModel } from "./types";
import { flattenMessages, lastUserMessage } from "./cliPrompt";
import { getWorkspaceRoot } from "../wsRoot";
import { getJson as lsGetJson } from "../localStore";

/** Explicit opt-in for running Claude Code WITHOUT the permission
 *  guard (--dangerously-skip-permissions) when the local permission
 *  server is unavailable. Default false: the backend refuses to spawn
 *  unguarded unless this is set. Managed in Settings → Claude Code —
 *  Permission guard. */
export const CC_ALLOW_UNGUARDED_KEY = "lcp.claudeCode.allowUnguarded";

export function getAllowUnguarded(): boolean {
  return lsGetJson<boolean>(
    CC_ALLOW_UNGUARDED_KEY,
    false,
    (v): v is boolean => typeof v === "boolean",
  );
}

// "default" passes no --model flag, so Claude Code uses whatever your
// `claude /login` session is configured for.
const FALLBACK_MODELS: ProviderModel[] = [
  {
    providerId: "claude-code",
    modelId: "default",
    displayName: "Default",
    contextWindow: 200_000,
    supportsTools: true,
  },
  {
    providerId: "claude-code",
    modelId: "sonnet",
    displayName: "Sonnet",
    contextWindow: 1_000_000,
    supportsTools: true,
  },
  {
    providerId: "claude-code",
    modelId: "opus",
    displayName: "Opus",
    contextWindow: 1_000_000,
    supportsTools: true,
  },
  {
    providerId: "claude-code",
    modelId: "haiku",
    displayName: "Haiku",
    contextWindow: 200_000,
    supportsTools: true,
  },
  {
    providerId: "claude-code",
    modelId: "fable",
    displayName: "Fable",
    contextWindow: 200_000,
    supportsTools: true,
  },
];

/** Stable Codetta labels — alias title-case, not probed "Sonnet 5". */
const CC_ALIAS_TITLE: Record<string, string> = {
  default: "Default",
  sonnet: "Sonnet",
  opus: "Opus",
  haiku: "Haiku",
  fable: "Fable",
  best: "Best",
  opusplan: "Opus Plan",
};

function ccStableDisplayName(
  id: string,
  fromCli: string,
  isDefault: boolean,
): string {
  if (isDefault) return fromCli;
  if (id.endsWith("[1m]")) {
    const base = id.slice(0, -4);
    return `${ccStableDisplayName(base, fromCli, false)} (1M context)`;
  }
  if (CC_ALIAS_TITLE[id]) return CC_ALIAS_TITLE[id];
  return id ? id[0]!.toUpperCase() + id.slice(1) : fromCli;
}

/** Instant picker slice — no CLI spawn. */
export function claudeCodePickerModels(): ProviderModel[] {
  return FALLBACK_MODELS;
}

interface ClaudeModelEntry {
  id: string;
  display_name: string;
  is_default: boolean;
}

let modelsCache: { models: ProviderModel[]; checkedAt: number } | null = null;
const MODELS_TTL_MS = 60_000;

async function fetchModels(): Promise<ProviderModel[]> {
  const entries = await invoke<ClaudeModelEntry[]>("claude_code_list_models");
  if (entries.length === 0) return FALLBACK_MODELS;
  return entries.map((e) => ({
    providerId: "claude-code" as const,
    modelId: e.id,
    displayName: ccStableDisplayName(e.id, e.display_name, e.is_default),
    contextWindow: ccAliasContextWindow(e.id),
    supportsTools: true,
  }));
}

/** Full catalog — one fast `/model` call; version labels refresh in background. */
export async function refreshClaudeCodeModelsLive(
  force = false,
): Promise<ProviderModel[]> {
  if (
    !force &&
    modelsCache &&
    Date.now() - modelsCache.checkedAt < MODELS_TTL_MS
  ) {
    return modelsCache.models;
  }
  if (!force && modelsCache) {
    void fetchAndCacheModels();
    return modelsCache.models;
  }
  if (!(await checkAvailability())) return FALLBACK_MODELS;
  return fetchAndCacheModels();
}

async function fetchAndCacheModels(): Promise<ProviderModel[]> {
  try {
    const models = await fetchModels();
    modelsCache = { models, checkedAt: Date.now() };
    return models;
  } catch {
    return modelsCache?.models ?? FALLBACK_MODELS;
  }
}

let availabilityCache: { ok: boolean; checkedAt: number } | null = null;
const AVAILABILITY_TTL_MS = 5_000;

async function checkAvailability(): Promise<boolean> {
  if (
    availabilityCache &&
    Date.now() - availabilityCache.checkedAt < AVAILABILITY_TTL_MS
  ) {
    return availabilityCache.ok;
  }
  try {
    await invoke<string>("claude_code_check");
    availabilityCache = { ok: true, checkedAt: Date.now() };
    return true;
  } catch {
    availabilityCache = { ok: false, checkedAt: Date.now() };
    return false;
  }
}

/** Force a fresh availability check next time isAvailable is called. */
export function invalidateClaudeCodeCache(): void {
  availabilityCache = null;
  modelsCache = null;
}

export const claudeCodeProvider: ChatProvider = {
  id: "claude-code",
  displayName: "Claude Code (local CLI)",
  needsApiKey: false,
  keyHelpUrl: "https://docs.claude.com/en/docs/claude-code/quickstart",

  async isAvailable() {
    return await checkAvailability();
  },

  async listModels(): Promise<ProviderModel[]> {
    if (
      modelsCache &&
      Date.now() - modelsCache.checkedAt < MODELS_TTL_MS
    ) {
      return modelsCache.models;
    }
    return FALLBACK_MODELS;
  },

  async *chat({
    model,
    messages,
    signal,
    resumeSessionId,
    chatSessionId,
    cwd: cwdArg,
    effort,
    permissionMode,
    thinking,
  }) {
    // When resuming an existing Claude Code session, send only the LATEST
    // user message — the CLI already has the server-side history. Sending
    // the full transcript again would double-count it. On a fresh session
    // we still flatten the whole thing so the model has context.
    const prompt = resumeSessionId
      ? lastUserMessage(messages)
      : flattenMessages(messages);
    // The chat's OWN workspace root wins; the active-workspace fallback
    // only covers callers that predate the cwd arg.
    const cwd = cwdArg ?? getWorkspaceRoot();

    let streamId: string;
    try {
      streamId = await invoke<string>("claude_code_chat", {
        prompt,
        cwd,
        model,
        resumeSessionId,
        chatSessionId,
        allowUnguarded: getAllowUnguarded(),
        effort,
        permissionMode,
        thinking,
      });
    } catch (e) {
      const msg = String(e);
      // The backend's permission-guard refusal is already a complete,
      // user-worthy message — don't bury it under a spawn-error prefix.
      if (msg.includes("permission guard")) throw new Error(msg);
      throw new Error(`claude CLI failed to spawn: ${e}`);
    }

    const queue: ChatStreamEvent[] = [];
    let done = false;
    let waker: (() => void) | null = null;
    const wake = () => {
      if (waker) {
        const fn = waker;
        waker = null;
        fn();
      }
    };
    // Track whether the CURRENT in-flight message has had any text
    // streamed via content_block_delta events. Reset on message_start;
    // checked when the wrapping `assistant` event arrives. Avoids
    // double-rendering: if we got deltas, skip the text blocks in
    // the assistant event (tool_use blocks always pass through).
    // Per-flag rather than per-message-id because Claude Code's
    // stream_event records don't reliably propagate message_id.
    let currentMsgGotDeltas = false;
    // Paragraph separation between text segments. Claude narrates in
    // bursts between tool batches — separate content blocks (often
    // separate assistant MESSAGES) whose deltas all concatenated into
    // one run-on paragraph ("…where it lives.The open file is…").
    // Track block boundaries and inject "\n\n" when a new text block
    // starts after text has already streamed.
    let anyTextEmitted = false;
    const textBlocksStarted = new Set<number>();
    // Track per-content-block tool_use buffers so we can emit each
    // tool_call EAGERLY at content_block_stop — not at the trailing
    // `assistant` event. Eager emission preserves the true text →
    // tool_use → text → tool_use interleave inside a single
    // assistant message; without it, all text deltas merge into one
    // block followed by all tool_use blocks at end (which the UI
    // then renders out of order). Indexed by content_block index.
    const toolUseBlocks = new Map<
      number,
      { id?: string; name?: string; jsonBuf: string }
    >();
    // Set of tool_use ids we've already emitted via stream_event so
    // the wrapping `assistant` event handler can skip duplicates.
    const emittedToolUseIds = new Set<string>();
    // Buffer extended-thinking content per content-block index. The model
    // can spend many seconds (sometimes minutes) in extended thinking
    // before emitting its first text token; without surfacing those
    // deltas the chat looks frozen and the staleness watchdog fires.
    // We accumulate the per-block thinking text and flush it on
    // content_block_stop wrapped in <think>...</think> so the existing
    // splitThinking() in AIChatPanel renders it as a collapsible
    // "💭 Reasoning" block. We also emit a keep-alive content event
    // (empty text) on each thinking delta so the staleness timer
    // resets — the user sees "still working" instead of dead silence.
    const thinkingBlocks = new Map<number, string>();
    // Latest message_start usage — the real context snapshot. The
    // terminal `result` event sums cache reads across every internal
    // tool-loop API call, which inflates context % (same prefix
    // counted N times). Claude Code's /context uses the last call.
    let latestContextTokens: {
      input: number;
      output: number;
      cacheRead: number;
      cacheCreate: number;
    } | null = null;

    const handle = (data: { kind: string; line?: string; code?: number }) => {
      if (data.kind === "end") {
        done = true;
        wake();
        return;
      }
      if (data.kind === "stderr" && data.line) {
        // Detect "model doesn't exist" error and rewrite to actionable message.
        const line = data.line;
        const isModelError = /model.*(doesn't exist|not found|access)/i.test(
          line,
        );
        const isAuthError =
          !isModelError &&
          /not logged in|run\s+\/?login|oauth|credentials/i.test(line);
        const text = isModelError
          ? `\n\n**Model rejected by Claude Code CLI.** Open the model picker and choose another model (Sonnet, Opus, Haiku, or Default).`
          : isAuthError
            ? `\n\n**Claude Code isn't signed in.** Use the **Sign in** button above the composer, or run \`claude /login\` in a terminal.`
            : `\n[claude] ${line}`;
        queue.push({ kind: "content", text });
        wake();
        return;
      }
      if (data.kind !== "line" || !data.line) return;
      try {
        const obj = JSON.parse(data.line);
        const isSubagentRecord = !!(
          obj.parent_tool_use_id || obj.parentToolUseID
        );
        // Claude Code stream-json shape:
        //   {"type":"system","subtype":"init","session_id":"<uuid>",...}
        //   {"type":"assistant","message":{"role":"assistant","content":[
        //      {"type":"text","text":"..."},
        //      {"type":"tool_use","id":"...","name":"Read","input":{...}},
        //   ]}}
        //   {"type":"user","message":{"role":"user","content":[
        //      {"type":"tool_result","tool_use_id":"...","content":"..."},
        //   ]}}
        //   {"type":"result","subtype":"success","session_id":"<uuid>",...}
        // Capture the session id once at init so the chat panel can
        // pass it back via resumeSessionId on the next turn.
        if (
          obj.type === "system" &&
          obj.subtype === "init" &&
          typeof obj.session_id === "string"
        ) {
          queue.push({ kind: "session", id: obj.session_id });
          wake();
        }
        // Token-level streaming via --include-partial-messages.
        // Each `stream_event` line wraps a raw Anthropic API
        // streaming event. We only need text deltas — tool_use
        // input deltas and message_stop are noise here because the
        // wrapping `assistant` event (still emitted) gives us the
        // complete tool_use block at end of message. message_start
        // resets the per-message "got deltas" flag.
        if (obj.type === "stream_event" && obj.event) {
          const ev = obj.event;
          if (ev.type === "message_start") {
            currentMsgGotDeltas = false;
            toolUseBlocks.clear();
            thinkingBlocks.clear();
            // Block indices restart per message; the cross-message
            // anyTextEmitted flag intentionally survives.
            textBlocksStarted.clear();
            const snap = contextTokensFromApiUsage(
              (ev as { message?: { usage?: Record<string, unknown> } })
                .message?.usage,
            );
            if (snap) {
              latestContextTokens = snap;
              queue.push({ kind: "context_snapshot", tokens: snap });
              wake();
            }
          } else if (ev.type === "message_delta") {
            const snap = contextTokensFromApiUsage(
              (ev as { usage?: Record<string, unknown> }).usage,
              latestContextTokens ?? undefined,
            );
            if (snap) {
              latestContextTokens = snap;
              queue.push({ kind: "context_snapshot", tokens: snap });
              wake();
            }
          } else if (
            ev.type === "content_block_start" &&
            ev.content_block?.type === "thinking" &&
            typeof ev.index === "number"
          ) {
            // Open buffer for this thinking block. Initial thinking text
            // (rare — usually streams via deltas) is captured here.
            const initial =
              typeof ev.content_block.thinking === "string"
                ? ev.content_block.thinking
                : "";
            thinkingBlocks.set(ev.index, initial);
          } else if (
            ev.type === "content_block_delta" &&
            typeof ev.index === "number" &&
            ev.delta?.type === "thinking_delta" &&
            typeof ev.delta.thinking === "string" &&
            thinkingBlocks.has(ev.index)
          ) {
            thinkingBlocks.set(
              ev.index,
              thinkingBlocks.get(ev.index)! + ev.delta.thinking,
            );
            // Keep-alive ping so the inline-status's "still working"
            // staleness timer resets — empty text doesn't accumulate
            // in the visible bubble (appendTextBlock guards against
            // empty strings) but the for-await loop's
            // setLastStreamEventAt at the top still fires.
            queue.push({ kind: "content", text: "" });
            wake();
          } else if (
            ev.type === "content_block_start" &&
            ev.content_block?.type === "tool_use" &&
            typeof ev.index === "number"
          ) {
            // Open buffer for this tool_use block. id + name come on
            // start; arguments accumulate via input_json_delta below.
            toolUseBlocks.set(ev.index, {
              id:
                typeof ev.content_block.id === "string"
                  ? ev.content_block.id
                  : undefined,
              name:
                typeof ev.content_block.name === "string"
                  ? ev.content_block.name
                  : undefined,
              jsonBuf: "",
            });
          } else if (
            ev.type === "content_block_delta" &&
            typeof ev.index === "number" &&
            ev.delta?.type === "input_json_delta" &&
            typeof ev.delta.partial_json === "string"
          ) {
            const buf = toolUseBlocks.get(ev.index);
            if (buf) buf.jsonBuf += ev.delta.partial_json;
          } else if (
            ev.type === "content_block_stop" &&
            typeof ev.index === "number" &&
            thinkingBlocks.has(ev.index)
          ) {
            // Flush the accumulated extended-thinking content as a
            // single content event wrapped in <think>…</think> so the
            // chat panel's splitThinking() pulls it into a collapsible
            // 💭 Reasoning block instead of rendering raw.
            const text = thinkingBlocks.get(ev.index)!.trim();
            thinkingBlocks.delete(ev.index);
            if (text.length > 0) {
              queue.push({
                kind: "content",
                text: `<think>${text}</think>\n`,
              });
              wake();
            }
          } else if (
            ev.type === "content_block_stop" &&
            typeof ev.index === "number" &&
            toolUseBlocks.has(ev.index)
          ) {
            // Close out the tool_use block — emit tool_call NOW so
            // the chronological log gets text → tool → text instead
            // of text+text → tool+tool. If args fail to parse (rare —
            // partial JSON, encoding issue), DON'T mark the id as
            // emitted, so the wrapping `assistant` event can repair
            // it with the complete block.input below.
            const buf = toolUseBlocks.get(ev.index)!;
            toolUseBlocks.delete(ev.index);
            let parsedOk = false;
            let args: Record<string, unknown> = {};
            if (buf.jsonBuf.trim().length === 0) {
              // No-arg tool — that's valid; emit immediately.
              parsedOk = true;
            } else {
              try {
                const parsed = JSON.parse(buf.jsonBuf);
                if (parsed && typeof parsed === "object") {
                  args = parsed as Record<string, unknown>;
                  parsedOk = true;
                }
              } catch {
                /* fall through — assistant event will emit instead */
              }
            }
            if (parsedOk) {
              const call: ToolCall = {
                id: buf.id,
                function: { name: buf.name ?? "tool", arguments: args },
              };
              if (buf.id) emittedToolUseIds.add(buf.id);
              queue.push({ kind: "tool_call", call });
              wake();
            }
          } else if (
            ev.type === "content_block_delta" &&
            ev.delta?.type === "text_delta" &&
            typeof ev.delta.text === "string"
          ) {
            currentMsgGotDeltas = true;
            let text = ev.delta.text;
            if (
              typeof ev.index === "number" &&
              !textBlocksStarted.has(ev.index)
            ) {
              textBlocksStarted.add(ev.index);
              // First delta of a NEW text block with text already on
              // screen → paragraph break, not mid-sentence glue.
              if (anyTextEmitted) text = "\n\n" + text;
            }
            anyTextEmitted = true;
            queue.push({ kind: "content", text });
            wake();
          }
        }
        // Subagent (sidechain) activity carries parent_tool_use_id — the
        // id of the parent Agent/Task call. We hide these inner steps from
        // the main transcript: the duck-avatar chip shows the run, and the
        // full subagent transcript lives in its own read-only tab.
        if (obj.type === "assistant" && obj.message?.content && !isSubagentRecord) {
          // If we've already streamed this message's text via
          // content_block_delta events, suppress the duplicate text
          // blocks here. tool_use blocks always pass through (their
          // arg deltas weren't consumed above).
          const alreadyStreamed = currentMsgGotDeltas;
          // Reset for the next message — assistant events fire after
          // all deltas for that message have flushed.
          currentMsgGotDeltas = false;
          for (const block of obj.message.content) {
            if (alreadyStreamed && block.type === "text") continue;
            if (block.type === "text" && typeof block.text === "string") {
              // Claude Code sometimes returns model-rejection errors as
              // assistant text (not stderr). Detect that and append a
              // helpful action hint.
              const looksLikeModelError =
                /selected model.*may not exist|may not have access|Run --model to pick/i.test(
                  block.text,
                );
              const text = looksLikeModelError
                ? `${block.text}\n\n**→ Open ⊕ Models in the menu and pick "Default" — it skips the --model flag and uses whatever your \`claude /login\` is configured for.**`
                : block.text;
              queue.push({ kind: "content", text });
            } else if (block.type === "tool_use") {
              // If we already emitted this tool_use eagerly via
              // content_block_stop, skip — would duplicate the row.
              const id = typeof block.id === "string" ? block.id : undefined;
              if (id && emittedToolUseIds.has(id)) continue;
              const call: ToolCall = {
                id,
                function: {
                  name: typeof block.name === "string" ? block.name : "tool",
                  arguments:
                    block.input && typeof block.input === "object"
                      ? (block.input as Record<string, unknown>)
                      : {},
                },
              };
              queue.push({ kind: "tool_call", call });
            }
          }
          wake();
        }
        // Tool results from Claude Code's own loop arrive as user messages
        // with tool_result blocks. Surface them so the chat UI can render
        // what each tool actually returned (Read file contents, Bash
        // stdout, Glob hits, etc.) — without this the user sees only
        // "I'll explore the codebase" → silence → final answer.
        // End-of-turn report carries cost + token usage + total duration +
        // model used. Surface it so the chat UI can show "$0.02 · 1.2k in /
        // 567 out · cached 89% · 3.1s" in the status strip — invaluable for
        // catching the documented resume-cache-miss spend regressions.
        if (obj.type === "result" && !isSubagentRecord) {
          const u = (obj.usage ?? {}) as Record<string, unknown>;
          const num = (v: unknown) =>
            typeof v === "number" && Number.isFinite(v) ? v : 0;
          queue.push({
            kind: "usage",
            cost: typeof obj.cost_usd === "number" ? obj.cost_usd : undefined,
            durationMs:
              typeof obj.duration_ms === "number"
                ? obj.duration_ms
                : undefined,
            model: typeof obj.model === "string" ? obj.model : undefined,
            tokens: {
              input: num(u.input_tokens),
              output: num(u.output_tokens),
              cacheRead: num(u.cache_read_input_tokens),
              cacheCreate: num(u.cache_creation_input_tokens),
            },
            contextTokens: latestContextTokens ?? undefined,
            isError: obj.is_error === true,
          });
          wake();
        }
        if (obj.type === "user" && obj.message?.content && !isSubagentRecord) {
          for (const block of obj.message.content) {
            if (block.type !== "tool_result") continue;
            // Content can be a string OR an array of blocks (text + image).
            // Flatten to a string for the simple chat-card renderer.
            let text = "";
            if (typeof block.content === "string") {
              text = block.content;
            } else if (Array.isArray(block.content)) {
              text = block.content
                .map((c: unknown) => {
                  if (c && typeof c === "object") {
                    const co = c as Record<string, unknown>;
                    if (co.type === "text" && typeof co.text === "string") {
                      return co.text;
                    }
                    if (co.type === "image") return "[image]";
                  }
                  return "";
                })
                .join("\n");
            }
            queue.push({
              kind: "tool_result",
              tool_use_id:
                typeof block.tool_use_id === "string"
                  ? block.tool_use_id
                  : "",
              content: text,
              is_error: block.is_error === true,
            });
          }
          wake();
        }
      } catch {
        /* skip non-JSON lines */
      }
    };

    let unlisten: UnlistenFn | null = null;
    try {
      unlisten = await listen<{ kind: string; line?: string; code?: number }>(
        `claude-stream:${streamId}`,
        (e) => handle(e.payload),
      );
    } catch (e) {
      throw new Error(`failed to listen for claude stream: ${e}`);
    }

    const onAbort = () => {
      void invoke("claude_code_kill", { id: streamId }).catch(() => {});
      // Don't depend on the kill round-trip emitting an "end" event —
      // when that raced (or the process was already gone) the generator
      // parked on the waker forever, and the whole chat looked hung
      // after Stop / "Send now". Abort ends the stream locally, period;
      // everything already yielded survives as the partial turn.
      done = true;
      wake();
    };
    signal?.addEventListener("abort", onAbort);

    try {
      while (true) {
        // Drain the queue.
        while (queue.length > 0) {
          const ev = queue.shift()!;
          yield ev;
        }
        if (done) break;
        // Wait for next event.
        await new Promise<void>((resolve) => {
          waker = resolve;
        });
      }
    } finally {
      signal?.removeEventListener("abort", onAbort);
      if (unlisten) unlisten();
    }
  },
};
