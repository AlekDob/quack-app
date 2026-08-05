import { describe, expect, it } from "vitest";

import { isThinkingOrbActivity, thinkingOrbStateForWorkEntry } from "./thinkingOrbState";

describe("isThinkingOrbActivity", () => {
  it("uses an orb for the normal running tool lifecycle path", () => {
    expect(
      isThinkingOrbActivity({
        tone: "tool",
        liveActivity: {
          state: "running_tool",
          label: "Command run",
          lastActivityAt: "2026-08-05T08:49:38.058Z",
        },
      }),
    ).toBe(true);
  });

  it("does not animate completed tool history", () => {
    expect(
      isThinkingOrbActivity({
        tone: "tool",
        liveActivity: {
          state: "completed",
          label: "Command run",
          lastActivityAt: "2026-08-05T08:49:38.058Z",
        },
      }),
    ).toBe(false);
  });
});

describe("thinkingOrbStateForWorkEntry", () => {
  it("maps commands to the working animation", () => {
    expect(
      thinkingOrbStateForWorkEntry({
        id: "command",
        createdAt: "2026-08-05T08:49:38.058Z",
        label: "Command run",
        tone: "tool",
        command: "rg --files",
      }),
    ).toBe("working");
  });
});
