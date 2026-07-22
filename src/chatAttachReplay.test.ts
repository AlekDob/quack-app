import { describe, expect, it } from "vitest";
import {
  attachBufferAssistantChars,
  shouldSkipEndedAttachReplay,
} from "./chatAttachReplay";

function delta(text: string) {
  return {
    kind: "line" as const,
    line: JSON.stringify({
      type: "content_block_delta",
      delta: { type: "text_delta", text },
    }),
  };
}

describe("attachBufferAssistantChars", () => {
  it("sums text_delta chunks", () => {
    const n = attachBufferAssistantChars([
      delta("Hello "),
      delta("world"),
    ]);
    expect(n).toBe(11);
  });

  it("counts assistant text when no deltas were streamed", () => {
    const n = attachBufferAssistantChars([
      {
        kind: "line",
        line: JSON.stringify({
          type: "assistant",
          message: { content: [{ type: "text", text: "Final answer" }] },
        }),
      },
    ]);
    expect(n).toBe(12);
  });

  it("does not double-count assistant text after deltas", () => {
    const n = attachBufferAssistantChars([
      { kind: "line", line: JSON.stringify({ type: "message_start" }) },
      delta("Hi"),
      {
        kind: "line",
        line: JSON.stringify({
          type: "assistant",
          message: { content: [{ type: "text", text: "Hi" }] },
        }),
      },
    ]);
    expect(n).toBe(2);
  });
});

describe("shouldSkipEndedAttachReplay", () => {
  it("skips when Quack already has the full text", () => {
    expect(shouldSkipEndedAttachReplay(100, 100)).toBe(true);
    expect(shouldSkipEndedAttachReplay(120, 100)).toBe(true);
  });

  it("replays when the buffer is richer than the checkpoint", () => {
    expect(shouldSkipEndedAttachReplay(40, 200)).toBe(false);
  });

  it("skips empty buffer against an existing assistant", () => {
    expect(shouldSkipEndedAttachReplay(50, 0)).toBe(true);
  });
});
