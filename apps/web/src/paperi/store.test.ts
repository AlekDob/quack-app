// FILE: store.test.ts
// Purpose: Covers papero store per-provider slot save/clear and active-id defaults.

import type { ModelSelection } from "@synara/contracts";
import { beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_PAPERO_ID } from "@synara/shared/paperi";
import { usePaperoStore } from "./store";

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

describe("usePaperoStore", () => {
  beforeEach(() => {
    usePaperoStore.setState({
      version: 1,
      overridesByPaperoId: {},
      modelSelectionByProviderByPaperoId: {},
      activePaperoIdByThreadId: {},
    });
  });

  it("defaults active papero to Milo (builder)", () => {
    expect(usePaperoStore.getState().getActivePaperoId("thread-1" as never)).toBe(
      DEFAULT_PAPERO_ID,
    );
  });

  it("saves only the selected provider slot", () => {
    const store = usePaperoStore.getState();
    store.setModelSelectionForProvider("builder", claude);
    store.setModelSelectionForProvider("builder", codex);
    expect(store.getModelSelectionMap("builder")).toEqual({
      claudeAgent: claude,
      codex,
    });
    store.clearModelSelectionForProvider("builder", "claudeAgent");
    expect(usePaperoStore.getState().getModelSelectionMap("builder")).toEqual({
      codex,
    });
  });

  it("resolves model for current provider only (fallback B)", () => {
    const store = usePaperoStore.getState();
    store.setModelSelectionForProvider("builder", codex);
    expect(store.resolveModelForCurrentProvider("builder", "codex")).toEqual(codex);
    expect(store.resolveModelForCurrentProvider("builder", "claudeAgent")).toBeNull();
  });

  it("still resolves pre-migration overrides left in localStorage", () => {
    usePaperoStore.setState({
      overridesByPaperoId: { builder: { instructions: "CUSTOM: ship smaller diffs." } },
    });
    expect(usePaperoStore.getState().resolveEffectiveDefinition("builder").instructions).toBe(
      "CUSTOM: ship smaller diffs.",
    );
  });
});
