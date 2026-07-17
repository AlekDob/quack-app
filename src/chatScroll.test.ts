import { describe, expect, it } from "vitest";
import {
  groupChatTurns,
  windowChatTurns,
  type ChatTurnGroup,
} from "./chatScroll";

function makeTurns(n: number): ChatTurnGroup[] {
  return Array.from({ length: n }, (_, i) => ({
    userIdx: i * 2,
    followIdxs: [i * 2 + 1],
  }));
}

describe("groupChatTurns", () => {
  it("groups user prompts with the assistant/tool msgs that follow", () => {
    const turns = groupChatTurns([
      { role: "user" },
      { role: "assistant" },
      { role: "tool" },
      { role: "user" },
      { role: "assistant" },
    ]);
    expect(turns).toEqual([
      { userIdx: 0, followIdxs: [1, 2] },
      { userIdx: 3, followIdxs: [4] },
    ]);
  });

  it("puts leading non-user msgs in a headless turn (userIdx null)", () => {
    const turns = groupChatTurns([{ role: "assistant" }, { role: "user" }]);
    expect(turns[0]).toEqual({ userIdx: null, followIdxs: [0] });
  });
});

describe("windowChatTurns", () => {
  it("returns everything when at or under the limit", () => {
    const turns = makeTurns(10);
    const out = windowChatTurns(turns, 40, false);
    expect(out.turns).toBe(turns);
    expect(out.hiddenCount).toBe(0);
  });

  it("keeps only the last `limit` turns when over it", () => {
    const turns = makeTurns(100);
    const out = windowChatTurns(turns, 40, false);
    expect(out.turns).toHaveLength(40);
    expect(out.hiddenCount).toBe(60);
    // The tail is preserved, newest last (streaming / pinned turn live here).
    expect(out.turns[out.turns.length - 1]).toBe(turns[99]);
    expect(out.turns[0]).toBe(turns[60]);
  });

  it("preserves ABSOLUTE display indices after slicing", () => {
    const turns = makeTurns(100);
    const out = windowChatTurns(turns, 40, false);
    // turn 60's userIdx must still be its absolute index (120), so display[i]
    // and data-anchor lookups keep working.
    expect(out.turns[0].userIdx).toBe(120);
  });

  it("returns everything when expanded, regardless of length", () => {
    const turns = makeTurns(100);
    const out = windowChatTurns(turns, 40, true);
    expect(out.turns).toBe(turns);
    expect(out.hiddenCount).toBe(0);
  });

  it("treats a non-positive limit as unbounded (no windowing)", () => {
    const turns = makeTurns(100);
    expect(windowChatTurns(turns, 0, false).hiddenCount).toBe(0);
  });
});
