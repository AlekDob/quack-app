import type { ChatStreamEvent, ToolCall } from "../ai";

/** Mutable parser state for Claude/Cursor stream-json NDJSON lines. */
export interface CliStreamJsonState {
  currentMsgGotDeltas: boolean;
  anyTextEmitted: boolean;
  textBlocksStarted: Set<number>;
  toolUseBlocks: Map<number, { id?: string; name?: string; jsonBuf: string }>;
  emittedToolUseIds: Set<string>;
  thinkingBlocks: Map<number, string>;
}

export function createCliStreamJsonState(): CliStreamJsonState {
  return {
    currentMsgGotDeltas: false,
    anyTextEmitted: false,
    textBlocksStarted: new Set(),
    toolUseBlocks: new Map(),
    emittedToolUseIds: new Set(),
    thinkingBlocks: new Map(),
  };
}

/** Parse one stream-json object into zero or more ChatStreamEvents. */
export function parseCliStreamJsonObject(
  obj: Record<string, unknown>,
  state: CliStreamJsonState,
): ChatStreamEvent[] {
  const out: ChatStreamEvent[] = [];
  if (
    obj.type === "system" &&
    obj.subtype === "init" &&
    typeof obj.session_id === "string"
  ) {
    out.push({ kind: "session", id: obj.session_id });
    return out;
  }

  if (obj.type === "stream_event" && obj.event && typeof obj.event === "object") {
    const ev = obj.event as Record<string, unknown>;
    const delta =
      ev.delta && typeof ev.delta === "object"
        ? (ev.delta as Record<string, unknown>)
        : null;
    const contentBlock =
      ev.content_block && typeof ev.content_block === "object"
        ? (ev.content_block as Record<string, unknown>)
        : null;

    if (ev.type === "message_start") {
      state.currentMsgGotDeltas = false;
      state.toolUseBlocks.clear();
      state.thinkingBlocks.clear();
      state.textBlocksStarted.clear();
    } else if (
      ev.type === "content_block_start" &&
      contentBlock?.type === "thinking" &&
      typeof ev.index === "number"
    ) {
      const initial =
        typeof contentBlock.thinking === "string" ? contentBlock.thinking : "";
      state.thinkingBlocks.set(ev.index, initial);
    } else if (
      ev.type === "content_block_delta" &&
      typeof ev.index === "number" &&
      delta?.type === "thinking_delta" &&
      typeof delta.thinking === "string" &&
      state.thinkingBlocks.has(ev.index)
    ) {
      state.thinkingBlocks.set(
        ev.index,
        state.thinkingBlocks.get(ev.index)! + delta.thinking,
      );
      out.push({ kind: "content", text: "" });
    } else if (
      ev.type === "content_block_start" &&
      contentBlock?.type === "tool_use" &&
      typeof ev.index === "number"
    ) {
      state.toolUseBlocks.set(ev.index, {
        id: typeof contentBlock.id === "string" ? contentBlock.id : undefined,
        name:
          typeof contentBlock.name === "string" ? contentBlock.name : undefined,
        jsonBuf: "",
      });
    } else if (
      ev.type === "content_block_delta" &&
      typeof ev.index === "number" &&
      delta?.type === "input_json_delta" &&
      typeof delta.partial_json === "string"
    ) {
      const buf = state.toolUseBlocks.get(ev.index);
      if (buf) buf.jsonBuf += delta.partial_json;
    } else if (
      ev.type === "content_block_stop" &&
      typeof ev.index === "number" &&
      state.thinkingBlocks.has(ev.index)
    ) {
      const text = state.thinkingBlocks.get(ev.index)!.trim();
      state.thinkingBlocks.delete(ev.index);
      if (text.length > 0) {
        out.push({
          kind: "content",
          text: `<think>${text}</think>\n`,
        });
      }
    } else if (
      ev.type === "content_block_stop" &&
      typeof ev.index === "number" &&
      state.toolUseBlocks.has(ev.index)
    ) {
      const buf = state.toolUseBlocks.get(ev.index)!;
      state.toolUseBlocks.delete(ev.index);
      let parsedOk = false;
      let args: Record<string, unknown> = {};
      if (buf.jsonBuf.trim().length === 0) {
        parsedOk = true;
      } else {
        try {
          const parsed = JSON.parse(buf.jsonBuf);
          if (parsed && typeof parsed === "object") {
            args = parsed as Record<string, unknown>;
            parsedOk = true;
          }
        } catch {
          /* assistant event may repair */
        }
      }
      if (parsedOk) {
        const call: ToolCall = {
          id: buf.id,
          function: { name: buf.name ?? "tool", arguments: args },
        };
        if (buf.id) state.emittedToolUseIds.add(buf.id);
        out.push({ kind: "tool_call", call });
      }
    } else if (
      ev.type === "content_block_delta" &&
      delta?.type === "text_delta" &&
      typeof delta.text === "string"
    ) {
      state.currentMsgGotDeltas = true;
      let text = delta.text;
      if (typeof ev.index === "number" && !state.textBlocksStarted.has(ev.index)) {
        state.textBlocksStarted.add(ev.index);
        if (state.anyTextEmitted) text = "\n\n" + text;
      }
      state.anyTextEmitted = true;
      out.push({ kind: "content", text });
    }
    return out;
  }

  const isSubagentRecord = !!(obj.parent_tool_use_id || obj.parentToolUseID);
  if (
    obj.type === "assistant" &&
    obj.message &&
    typeof obj.message === "object" &&
    !isSubagentRecord
  ) {
    const message = obj.message as Record<string, unknown>;
    const content = message.content;
    if (!Array.isArray(content)) return out;
    const alreadyStreamed = state.currentMsgGotDeltas;
    state.currentMsgGotDeltas = false;
    for (const block of content) {
      if (!block || typeof block !== "object") continue;
      const b = block as Record<string, unknown>;
      if (alreadyStreamed && b.type === "text") continue;
      if (b.type === "text" && typeof b.text === "string") {
        out.push({ kind: "content", text: b.text });
      } else if (b.type === "tool_use") {
        const id = typeof b.id === "string" ? b.id : undefined;
        if (id && state.emittedToolUseIds.has(id)) continue;
        const call: ToolCall = {
          id,
          function: {
            name: typeof b.name === "string" ? b.name : "tool",
            arguments:
              b.input && typeof b.input === "object"
                ? (b.input as Record<string, unknown>)
                : {},
          },
        };
        out.push({ kind: "tool_call", call });
      }
    }
    return out;
  }

  if (obj.type === "result") {
    const u = (obj.usage ?? {}) as Record<string, unknown>;
    const num = (v: unknown) =>
      typeof v === "number" && Number.isFinite(v) ? v : 0;
    out.push({
      kind: "usage",
      cost: typeof obj.cost_usd === "number" ? obj.cost_usd : undefined,
      durationMs:
        typeof obj.duration_ms === "number" ? obj.duration_ms : undefined,
      model: typeof obj.model === "string" ? obj.model : undefined,
      tokens: {
        input: num(u.input_tokens),
        output: num(u.output_tokens),
        cacheRead: num(u.cache_read_input_tokens),
        cacheCreate: num(u.cache_creation_input_tokens),
      },
      isError: obj.is_error === true,
    });
    return out;
  }

  if (
    obj.type === "user" &&
    obj.message &&
    typeof obj.message === "object" &&
    !isSubagentRecord
  ) {
    const message = obj.message as Record<string, unknown>;
    const content = message.content;
    if (!Array.isArray(content)) return out;
    for (const block of content) {
      if (!block || typeof block !== "object") continue;
      const b = block as Record<string, unknown>;
      if (b.type !== "tool_result") continue;
      let text = "";
      if (typeof b.content === "string") {
        text = b.content;
      } else if (Array.isArray(b.content)) {
        text = b.content
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
      out.push({
        kind: "tool_result",
        tool_use_id: typeof b.tool_use_id === "string" ? b.tool_use_id : "",
        content: text,
        is_error: b.is_error === true,
      });
    }
  }

  return out;
}

export function parseCliStderrLine(
  line: string,
  stderrPrefix: string,
  modelErrorHint: string,
): string {
  const isModelError = /model.*(doesn't exist|not found|access)/i.test(line);
  return isModelError
    ? modelErrorHint
    : `\n[${stderrPrefix}] ${line}`;
}
