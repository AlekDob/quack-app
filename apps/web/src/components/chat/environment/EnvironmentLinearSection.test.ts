import { describe, expect, it } from "vitest";

import { collectLinearEnvironmentItems } from "./EnvironmentLinearSection";

describe("collectLinearEnvironmentItems", () => {
  it("keeps unique linear:// mentions and ignores other kinds", () => {
    expect(
      collectLinearEnvironmentItems([
        { name: "ALE-22 Kanban", path: "linear://ALE-22" },
        { name: "ALE-22 Kanban", path: "linear://ALE-22" },
        { name: "Release planning", path: "thread://thread-123" },
        { name: "ALE-9 Auth", path: "linear://ALE-9" },
      ]),
    ).toEqual([
      {
        identifier: "ALE-22",
        title: "Kanban",
        url: "https://linear.app/issue/ALE-22",
      },
      {
        identifier: "ALE-9",
        title: "Auth",
        url: "https://linear.app/issue/ALE-9",
      },
    ]);
  });
});
