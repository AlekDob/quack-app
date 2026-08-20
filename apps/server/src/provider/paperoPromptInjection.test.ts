// FILE: paperoPromptInjection.test.ts
// Purpose: Covers papero identity injection bounds and id validation.

import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { buildInlinePaperoInstructions } from "./paperoPromptInjection.ts";

describe("buildInlinePaperoInstructions", () => {
  it("returns empty for missing or unknown ids", () => {
    assert.equal(buildInlinePaperoInstructions({ paperoId: null, maxChars: 10_000 }), "");
    assert.equal(buildInlinePaperoInstructions({ paperoId: undefined, maxChars: 10_000 }), "");
    assert.equal(buildInlinePaperoInstructions({ paperoId: "nope", maxChars: 10_000 }), "");
    assert.equal(buildInlinePaperoInstructions({ paperoId: "builder", maxChars: 0 }), "");
  });

  it("builds a Milo identity block without mutating caller state", () => {
    const text = buildInlinePaperoInstructions({ paperoId: "builder", maxChars: 20_000 });
    assert.match(text, /\[Agent identity\]/);
    assert.match(text, /You are Milo, Builder/);
    assert.match(text, /PRESET: Builder \(Milo\)/);
    assert.match(text, /\[\/Agent identity\]/);
  });

  it("uses paperoInstructions override when provided", () => {
    const text = buildInlinePaperoInstructions({
      paperoId: "builder",
      paperoInstructions: "CUSTOM: only fix the bug.",
      maxChars: 20_000,
    });
    assert.match(text, /CUSTOM: only fix the bug/);
    assert.doesNotMatch(text, /PRESET: Builder \(Milo\)/);
  });

  it("truncates when over maxChars", () => {
    const text = buildInlinePaperoInstructions({ paperoId: "builder", maxChars: 80 });
    assert.ok(text.length <= 80);
    assert.match(text, /\[truncated\]/);
  });
});

describe("provider slash command turns", () => {
  it("skips the identity block so the slash stays at position 0", () => {
    // Regression: with a duck selected, "/compact" was sent as
    // "[Agent identity]...\n\n/compact" and the provider never ran the command.
    for (const text of ["/compact", "  /compact  ", "/compact focus on the bug", "/clear"]) {
      assert.equal(
        buildInlinePaperoInstructions({ paperoId: "builder", messageText: text, maxChars: 20_000 }),
        "",
        text,
      );
    }
  });

  it("still injects for ordinary prompts", () => {
    for (const text of ["fix the bug", "/compact\nand also explain", "// comment", "/ spaced"]) {
      assert.match(
        buildInlinePaperoInstructions({ paperoId: "builder", messageText: text, maxChars: 20_000 }),
        /\[Agent identity\]/,
        text,
      );
    }
  });
});
