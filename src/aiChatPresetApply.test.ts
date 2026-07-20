import { describe, expect, it } from "vitest";
import {
  agenticProviderForPresetApply,
  presetIdForEmptyHydrate,
  shouldApplyPresetOnEmptyHydrate,
} from "./aiChatPresetApply";
import type { ChatSession } from "./chatHistory";

function emptySeed(partial: Partial<ChatSession> = {}): ChatSession {
  return {
    id: "c1",
    title: "AI Chat",
    messages: [],
    updatedAt: 1,
    ...partial,
  };
}

describe("shouldApplyPresetOnEmptyHydrate", () => {
  it("applies for 087 empty RAM seeds (no model)", () => {
    expect(shouldApplyPresetOnEmptyHydrate(emptySeed(), 0)).toBe(true);
  });

  it("skips when the session already has a persisted model", () => {
    expect(
      shouldApplyPresetOnEmptyHydrate(
        emptySeed({ model: "claude-code:sonnet" }),
        0,
      ),
    ).toBe(false);
  });

  it("skips once the transcript has messages", () => {
    expect(
      shouldApplyPresetOnEmptyHydrate(
        emptySeed({ model: undefined }),
        3,
      ),
    ).toBe(false);
  });
});

describe("presetIdForEmptyHydrate", () => {
  it("defaults to Milo (builder) when the seed has no presetId", () => {
    expect(presetIdForEmptyHydrate(emptySeed())).toBe("builder");
  });

  it("keeps an explicit preset from the seed", () => {
    expect(
      presetIdForEmptyHydrate(emptySeed({ presetId: "debugger" })),
    ).toBe("debugger");
  });
});

describe("agenticProviderForPresetApply", () => {
  it("falls back to Claude Code when the picker is still empty", () => {
    expect(
      agenticProviderForPresetApply("", {
        claudeCode: true,
        cursorCli: false,
      }),
    ).toBe("claude-code");
  });

  it("returns null when no agentic CLI is available yet", () => {
    expect(
      agenticProviderForPresetApply("", {
        claudeCode: false,
        cursorCli: false,
      }),
    ).toBeNull();
  });

  it("prefers the selected agentic provider over the CC fallback", () => {
    expect(
      agenticProviderForPresetApply("cursor-cli:default", {
        claudeCode: true,
        cursorCli: true,
      }),
    ).toBe("cursor-cli");
  });
});
