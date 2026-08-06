import { describe, expect, it } from "vitest";

import { defaultProjectProvider, visibleProjectProviders } from "./projectDefaultProvider";

describe("project default providers", () => {
  it("respects the configured provider order and hidden providers", () => {
    expect(
      visibleProjectProviders({
        providerOrder: ["claudeAgent", "codex"],
        hiddenProviders: ["codex"],
      }),
    ).toEqual(["claudeAgent", "cursor", "antigravity", "grok", "droid", "kilo", "opencode", "pi"]);
  });

  it("falls back to the first visible provider", () => {
    expect(
      defaultProjectProvider({
        appDefaultProvider: "codex",
        providers: ["claudeAgent", "pi"],
      }),
    ).toBe("claudeAgent");
  });
});
