import { describe, it, expect } from "vitest";
import { deriveRow, deriveToolMaps } from "./chatRowDerive";
import type { ChatMessage } from "./ai";

function msg(partial: Partial<ChatMessage>): ChatMessage {
  return { role: "assistant", content: "", ...partial };
}

describe("deriveRow", () => {
  it("returns a cached reference for the same object + content", () => {
    const m = msg({ content: "hello ```ts\nconst a = 1;\n```" });
    const a = deriveRow(m);
    const b = deriveRow(m);
    expect(a).toBe(b); // WeakMap hit — no recompute
  });

  it("recomputes for a new message object (content changed)", () => {
    const a = deriveRow(msg({ content: "one" }));
    const b = deriveRow(msg({ content: "two" }));
    expect(a).not.toBe(b);
    expect(a.bodyForRender).toBe("one");
    expect(b.bodyForRender).toBe("two");
  });

  it("extracts fenced code blocks into blocks/insertText", () => {
    const d = deriveRow(msg({ content: "intro\n```js\nx=1\n```\nend" }));
    expect(d.blocks.length).toBe(1);
    expect(d.blocks[0]).toContain("x=1");
    expect(d.insertText).toBe(d.blocks.join("\n\n"));
  });

  it("insertText falls back to the body when there are no code blocks", () => {
    const d = deriveRow(msg({ content: "just prose" }));
    expect(d.blocks.length).toBe(0);
    expect(d.insertText).toBe(d.bodyForRender);
  });
});

describe("deriveToolMaps", () => {
  it("builds callsById / resultsById / erroredIds", () => {
    const m = msg({
      tool_calls: [{ id: "t1", function: { name: "Read", arguments: {} } }],
      tool_results: [
        { tool_use_id: "t1", content: "ok" },
        { tool_use_id: "t2", content: "boom", is_error: true },
      ],
    });
    const maps = deriveToolMaps(m);
    expect(maps.callsById.get("t1")?.function.name).toBe("Read");
    expect(maps.resultsById.get("t1")).toBe("ok");
    expect(maps.resultsById.get("t2")).toBe("boom");
    expect(maps.erroredIds.has("t2")).toBe(true);
    expect(maps.erroredIds.has("t1")).toBe(false);
  });

  it("returns a stable reference while tool arrays are unchanged", () => {
    const m = msg({ tool_calls: [], tool_results: [] });
    expect(deriveToolMaps(m)).toBe(deriveToolMaps(m));
  });

  it("skips tool_calls without an id", () => {
    const m = msg({
      tool_calls: [{ function: { name: "X", arguments: {} } }],
    });
    expect(deriveToolMaps(m).callsById.size).toBe(0);
  });
});
