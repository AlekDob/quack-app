import { describe, expect, it } from "vitest";
import { astronautChatRequest, createAstronautSseParser } from "./astronautRemote";

describe("Astronaut remote protocol", () => {
  it("parses fragmented frames, multiline data, and heartbeats", () => {
    const events: unknown[] = [];
    const parser = createAstronautSseParser((event) => events.push(event));
    parser.push(": ping\n\nevent: token\ndata: {\"text\":\"hel");
    parser.push("lo\"}\n\nevent: done\ndata: {}\n\n");
    expect(events).toEqual([{ type: "token", data: { text: "hello" } }, { type: "done", data: {} }]);
  });

  it("always selects the companion agent and preserves resume fields", () => {
    const request = astronautChatRequest("http://host/", { message: "hi", sessionId: "s", model: "m" });
    expect(request.url).toBe("http://host/chat");
    expect(JSON.parse(request.init.body)).toEqual({ message: "hi", sessionId: "s", model: "m", agent: "companion" });
  });
});
