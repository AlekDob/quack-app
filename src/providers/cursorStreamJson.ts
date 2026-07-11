import type { ChatStreamEvent, ToolCall } from "../ai";

/** Parser state for Cursor CLI native stream-json (Composer, etc.). */
export interface CursorStreamJsonState {
  thinkingBuf: string;
  emittedToolIds: Set<string>;
}

export function createCursorStreamJsonState(): CursorStreamJsonState {
  return { thinkingBuf: "", emittedToolIds: new Set() };
}

function cursorToolFromPayload(
  toolCall: Record<string, unknown>,
): { name: string; args: Record<string, unknown>; result?: unknown } | null {
  for (const [key, val] of Object.entries(toolCall)) {
    if (!key.endsWith("ToolCall") || !val || typeof val !== "object") continue;
    const tc = val as Record<string, unknown>;
    const name = key.slice(0, -"ToolCall".length);
    const args =
      tc.args && typeof tc.args === "object"
        ? (tc.args as Record<string, unknown>)
        : {};
    return { name, args, result: tc.result };
  }
  return null;
}

function formatCursorToolResult(result: unknown): string {
  if (result == null) return "";
  if (typeof result === "string") return result;
  try {
    return JSON.stringify(result, null, 2);
  } catch {
    return String(result);
  }
}

function mapUsageTokens(u: Record<string, unknown>) {
  const num = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) ? v : 0;
  return {
    input: num(u.input_tokens ?? u.inputTokens),
    output: num(u.output_tokens ?? u.outputTokens),
    cacheRead: num(u.cache_read_input_tokens ?? u.cacheReadTokens),
    cacheCreate: num(u.cache_creation_input_tokens ?? u.cacheWriteTokens),
  };
}

/** Parse one Cursor-native NDJSON line (Composer / cursor-agent). */
export function parseCursorStreamJsonObject(
  obj: Record<string, unknown>,
  state: CursorStreamJsonState,
): ChatStreamEvent[] {
  const out: ChatStreamEvent[] = [];

  if (obj.type === "thinking") {
    if (obj.subtype === "delta" && typeof obj.text === "string") {
      state.thinkingBuf += obj.text;
      out.push({ kind: "content", text: "" });
    } else if (obj.subtype === "completed") {
      const text = state.thinkingBuf.trim();
      state.thinkingBuf = "";
      if (text.length > 0) {
        out.push({
          kind: "content",
          text: `<think>${text}</think>\n`,
        });
      }
    }
    return out;
  }

  if (obj.type === "tool_call" && obj.tool_call && typeof obj.tool_call === "object") {
    const parsed = cursorToolFromPayload(obj.tool_call as Record<string, unknown>);
    if (!parsed) return out;
    const callId = typeof obj.call_id === "string" ? obj.call_id : undefined;

    if (obj.subtype === "started") {
      if (callId && state.emittedToolIds.has(callId)) return out;
      if (callId) state.emittedToolIds.add(callId);
      const call: ToolCall = {
        id: callId,
        function: { name: parsed.name, arguments: parsed.args },
      };
      out.push({ kind: "tool_call", call });
      return out;
    }

    if (obj.subtype === "completed" && callId) {
      const content = formatCursorToolResult(parsed.result);
      out.push({
        kind: "tool_result",
        tool_use_id: callId,
        content,
        is_error: false,
      });
    }
    return out;
  }

  if (obj.type === "result") {
    const u = (obj.usage ?? {}) as Record<string, unknown>;
    out.push({
      kind: "usage",
      cost: typeof obj.cost_usd === "number" ? obj.cost_usd : undefined,
      durationMs:
        typeof obj.duration_ms === "number"
          ? obj.duration_ms
          : typeof obj.duration_api_ms === "number"
            ? obj.duration_api_ms
            : undefined,
      model: typeof obj.model === "string" ? obj.model : undefined,
      tokens: mapUsageTokens(u),
      isError: obj.is_error === true,
    });
    return out;
  }

  return out;
}
