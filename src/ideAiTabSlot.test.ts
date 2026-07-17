import { describe, expect, it } from "vitest";
import { placeAiKeyInTabsPane, pruneAiTabsInPane } from "./ideAiTabSlot";

describe("placeAiKeyInTabsPane", () => {
  it("adds an AI tab among files", () => {
    const next = placeAiKeyInTabsPane(
      { kind: "tabs" as const, tabs: ["file:/a.ts", "file:/b.ts"], active: "file:/a.ts" },
      "ai:c1",
    );
    expect(next.tabs).toEqual(["file:/a.ts", "file:/b.ts", "ai:c1"]);
    expect(next.active).toBe("ai:c1");
  });

  it("replaces another AI tab instead of stacking", () => {
    const next = placeAiKeyInTabsPane(
      {
        kind: "tabs" as const,
        tabs: ["file:/a.ts", "ai:old", "file:/b.ts"],
        active: "ai:old",
      },
      "ai:new",
    );
    expect(next.tabs).toEqual(["file:/a.ts", "file:/b.ts", "ai:new"]);
    expect(next.active).toBe("ai:new");
  });

  it("is idempotent when the key is already the slot", () => {
    const pane = {
      kind: "tabs" as const,
      tabs: ["file:/a.ts", "ai:c1"],
      active: "file:/a.ts",
    };
    const next = placeAiKeyInTabsPane(pane, "ai:c1");
    expect(next.tabs).toEqual(["file:/a.ts", "ai:c1"]);
    expect(next.active).toBe("ai:c1");
  });
});

describe("pruneAiTabsInPane", () => {
  it("keeps a single AI tab unchanged", () => {
    const pane = {
      kind: "tabs" as const,
      tabs: ["file:/a.ts", "ai:c1"],
      active: "ai:c1",
    };
    expect(pruneAiTabsInPane(pane)).toBe(pane);
  });

  it("keeps the active AI when several exist", () => {
    const next = pruneAiTabsInPane({
      kind: "tabs" as const,
      tabs: ["ai:a", "file:/x.ts", "ai:b", "ai:c"],
      active: "ai:b",
    });
    expect(next.tabs).toEqual(["file:/x.ts", "ai:b"]);
    expect(next.active).toBe("ai:b");
  });

  it("keeps the last AI when active is a file", () => {
    const next = pruneAiTabsInPane({
      kind: "tabs" as const,
      tabs: ["ai:a", "file:/x.ts", "ai:b"],
      active: "file:/x.ts",
    });
    expect(next.tabs).toEqual(["file:/x.ts", "ai:b"]);
    expect(next.active).toBe("ai:b");
  });
});
