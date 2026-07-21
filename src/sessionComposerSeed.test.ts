import { describe, expect, it } from "vitest";
import {
  knobsFromSessionRow,
  nextSelectedAfterDiscovery,
  qualifyStoredModel,
} from "./sessionComposerSeed";
import type { ChatSession } from "./chatHistory";

function row(partial: Partial<ChatSession> = {}): ChatSession {
  return {
    id: "c1",
    title: "t",
    messages: [],
    updatedAt: 1,
    ...partial,
  };
}

describe("knobsFromSessionRow", () => {
  it("uses medium/Ask when legacy row lacks knob fields", () => {
    expect(knobsFromSessionRow(row())).toEqual({
      effort: "medium",
      thinking: null,
      permMode: null,
    });
  });

  it("keeps explicit knobs from the row", () => {
    expect(
      knobsFromSessionRow(
        row({
          ccEffort: "xhigh",
          ccThinking: true,
          ccPermMode: "bypassPermissions",
        }),
      ),
    ).toEqual({
      effort: "xhigh",
      thinking: true,
      permMode: "bypassPermissions",
    });
  });
});

describe("qualifyStoredModel", () => {
  it("passes through qualified ids", () => {
    expect(qualifyStoredModel("claude-code:opus")).toBe("claude-code:opus");
  });

  it("prefixes bare ollama names", () => {
    expect(qualifyStoredModel("llama3.1")).toBe("ollama:llama3.1");
  });
});

describe("nextSelectedAfterDiscovery", () => {
  const present = new Set(["claude-code:sonnet", "claude-code:opus"]);
  const isPresent = (q: string) => present.has(q);
  const migrate = (q: string) => q;
  const qualifyStored = (raw: string) =>
    raw.includes(":") ? raw : `ollama:${raw}`;

  it("keeps the current model when it is in the catalog", () => {
    expect(
      nextSelectedAfterDiscovery({
        current: "claude-code:sonnet",
        sessionReady: true,
        isPresent,
        migrate,
        globalStored: "claude-code:opus",
        qualifyStored,
        firstAggregate: "claude-code:opus",
      }),
    ).toBe("claude-code:sonnet");
  });

  it("does not apply global last-used while the session is still hydrating", () => {
    expect(
      nextSelectedAfterDiscovery({
        current: "",
        sessionReady: false,
        isPresent,
        migrate,
        globalStored: "claude-code:opus",
        qualifyStored,
        firstAggregate: "claude-code:sonnet",
      }),
    ).toBe("");
  });

  it("falls back to global last-used only after hydrate", () => {
    expect(
      nextSelectedAfterDiscovery({
        current: "",
        sessionReady: true,
        isPresent,
        migrate,
        globalStored: "claude-code:opus",
        qualifyStored,
        firstAggregate: "claude-code:sonnet",
      }),
    ).toBe("claude-code:opus");
  });
});
