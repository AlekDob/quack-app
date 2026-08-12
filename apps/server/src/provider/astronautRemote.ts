/** Small, dependency-free Astronaut HTTP/SSE client and parser. */
export const DEFAULT_ASTRONAUT_URL = "http://imac-di-alek:4567";

export type AstronautEvent = {
  readonly type: string;
  readonly data: unknown;
};

/** Parses SSE incrementally. Comments/heartbeats and fragmented chunks are safe. */
export function createAstronautSseParser(emit: (event: AstronautEvent) => void) {
  let buffer = "";
  let eventName = "message";
  let data: string[] = [];
  const flush = () => {
    if (data.length === 0) return;
    const raw = data.join("\n");
    let parsed: unknown = raw;
    try {
      parsed = JSON.parse(raw);
    } catch {
      /* Astronaut normally sends JSON; preserve text. */
    }
    emit({ type: eventName, data: parsed });
    eventName = "message";
    data = [];
  };
  const push = (chunk: string) => {
    buffer += chunk.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    let boundary = buffer.indexOf("\n\n");
    while (boundary >= 0) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      for (const line of frame.split("\n")) {
        if (!line || line.startsWith(":")) continue;
        const separator = line.indexOf(":");
        const field = separator < 0 ? line : line.slice(0, separator);
        const value = separator < 0 ? "" : line.slice(separator + 1).replace(/^ /, "");
        if (field === "event") eventName = value;
        if (field === "data") data.push(value);
      }
      flush();
      boundary = buffer.indexOf("\n\n");
    }
  };
  const end = () => {
    if (buffer.trim()) push("\n\n");
  };
  return { push, end };
}

export function astronautChatRequest(
  url: string,
  input: { message: string; sessionId?: string; model?: string },
) {
  return {
    url: `${url.replace(/\/$/, "")}/chat`,
    init: {
      method: "POST",
      headers: { "content-type": "application/json", accept: "text/event-stream" },
      body: JSON.stringify({ ...input, agent: "companion" }),
    },
  } as const;
}

export function astronautApprovalReply(
  url: string,
  requestId: string,
  reply: "once" | "always" | "reject",
) {
  return {
    url: `${url.replace(/\/$/, "")}/permission/${encodeURIComponent(requestId)}/reply`,
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reply }),
    },
  } as const;
}

export function astronautQuestionReply(url: string, requestId: string, answers: string[][]) {
  return {
    url: `${url.replace(/\/$/, "")}/question/${encodeURIComponent(requestId)}/reply`,
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ answers }),
    },
  } as const;
}
