// FILE: resolve.test.ts
// Purpose: Covers papero model slot fallback B (never switches provider).

import type { ModelSelection } from "@synara/contracts";
import { describe, expect, it } from "vitest";

import { resolvePaperoModelSelection } from "./resolve";
import { resolveCycledPaperoId } from "@synara/shared/paperi";

const claude: ModelSelection = {
  provider: "claudeAgent",
  model: "claude-opus-5",
  options: { effort: "medium" },
};

const codex: ModelSelection = {
  provider: "codex",
  model: "gpt-5.6",
  options: { reasoningEffort: "high" },
};

describe("resolvePaperoModelSelection", () => {
  it("returns the slot for the current provider", () => {
    expect(
      resolvePaperoModelSelection({
        modelSelectionByProvider: { claudeAgent: claude, codex },
        currentProvider: "claudeAgent",
      }),
    ).toEqual(claude);
  });

  it("returns null when the current provider has no slot (fallback B)", () => {
    expect(
      resolvePaperoModelSelection({
        modelSelectionByProvider: { codex },
        currentProvider: "claudeAgent",
      }),
    ).toBeNull();
  });

  it("ignores a mismatched provider field inside a slot", () => {
    expect(
      resolvePaperoModelSelection({
        modelSelectionByProvider: {
          // Intentionally corrupt map entry
          claudeAgent: codex,
        },
        currentProvider: "claudeAgent",
      }),
    ).toBeNull();
  });
});

describe("resolveCycledPaperoId", () => {
  it("cycles Jack → Milo → … → Lia → Jack", () => {
    expect(resolveCycledPaperoId({ currentId: "jack", direction: "next" })).toBe("builder");
    expect(resolveCycledPaperoId({ currentId: "builder", direction: "next" })).toBe("debugger");
    expect(resolveCycledPaperoId({ currentId: "companion", direction: "next" })).toBe("jack");
    expect(resolveCycledPaperoId({ currentId: "jack", direction: "previous" })).toBe("companion");
  });
});
