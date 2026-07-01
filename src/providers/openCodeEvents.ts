import type { ChatStreamEvent, ToolCall } from "../ai";

export interface OpencodeEventState {
  textByPart: Map<string, string>;
  emittedToolIds: Set<string>;
}

export function createOpencodeEventState(): OpencodeEventState {
  return { textByPart: new Map(), emittedToolIds: new Set() };
}

interface RawEvent {
  type?: string;
  sessionID?: string;
  properties?: Record<string, unknown>;
}

function sessionIdOf(ev: RawEvent): string | undefined {
  if (typeof ev.sessionID === "string") return ev.sessionID;
  const sid = ev.properties?.sessionID;
  return typeof sid === "string" ? sid : undefined;
}

function partOf(ev: RawEvent): Record<string, unknown> | null {
  const props = ev.properties;
  if (!props) return null;
  const part = props.part;
  return part && typeof part === "object"
    ? (part as Record<string, unknown>)
    : null;
}

function isDoneSession(ev: RawEvent, sessionId: string): boolean {
  const sid = sessionIdOf(ev);
  if (sid && sid !== sessionId) return false;
  if (ev.type === "session.idle") return true;
  if (ev.type === "session.status") {
    const status = ev.properties?.status;
    if (status && typeof status === "object") {
      return (status as { type?: string }).type === "idle";
    }
  }
  return false;
}

/** Map one OpenCode SSE payload to zero or more ChatStreamEvents. */
export function parseOpencodeEvent(
  raw: unknown,
  sessionId: string,
  state: OpencodeEventState,
): { events: ChatStreamEvent[]; done: boolean } {
  const ev = raw as RawEvent;
  const out: ChatStreamEvent[] = [];
  if (!ev?.type) return { events: out, done: false };

  const sid = sessionIdOf(ev);
  if (sid && sid !== sessionId) {
    return { events: out, done: false };
  }

  if (isDoneSession(ev, sessionId)) {
    return { events: out, done: true };
  }

  if (ev.type === "message.part.updated") {
    const part = partOf(ev);
    if (!part) return { events: out, done: false };
    const partSid =
      typeof part.sessionID === "string" ? part.sessionID : sid;
    if (partSid && partSid !== sessionId) {
      return { events: out, done: false };
    }

    const partId =
      (typeof part.id === "string" && part.id) ||
      (typeof part.callID === "string" && part.callID) ||
      String(part.messageID ?? "");
    const partType = part.type;

    if (partType === "text" && typeof part.text === "string") {
      const prev = state.textByPart.get(partId) ?? "";
      const next = part.text;
      state.textByPart.set(partId, next);
      if (next.length > prev.length) {
        out.push({ kind: "content", text: next.slice(prev.length) });
      }
      return { events: out, done: false };
    }

    if (partType === "tool") {
      const toolName =
        (typeof part.tool === "string" && part.tool) ||
        (typeof part.name === "string" && part.name) ||
        "tool";
      const callId = partId || `${toolName}-${state.emittedToolIds.size}`;
      if (!state.emittedToolIds.has(callId)) {
        state.emittedToolIds.add(callId);
        const args =
          part.state && typeof part.state === "object"
            ? (part.state as Record<string, unknown>)
            : {};
        const call: ToolCall = {
          id: callId,
          function: { name: toolName, arguments: args },
        };
        out.push({ kind: "tool_call", call });
      }
      const status = part.status ?? part.state;
      const done =
        status === "completed" ||
        status === "error" ||
        (typeof status === "object" &&
          status !== null &&
          ((status as { status?: string }).status === "completed" ||
            (status as { status?: string }).status === "error"));
      if (done) {
        const content =
          typeof part.output === "string"
            ? part.output
            : JSON.stringify(part.state ?? {});
        out.push({
          kind: "tool_result",
          tool_use_id: callId,
          content,
          is_error: status === "error",
        });
      }
    }
    return { events: out, done: false };
  }

  if (ev.type === "session.error") {
    const err = ev.properties?.error;
    const msg =
      err && typeof err === "object" && "message" in err
        ? String((err as { message?: string }).message ?? "OpenCode session error")
        : "OpenCode session error";
    out.push({ kind: "content", text: `\n\n**Error:** ${msg}` });
    return { events: out, done: true };
  }

  return { events: out, done: false };
}
