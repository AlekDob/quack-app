import { describe, expect, it } from "vitest";
import { resolveUsageNotchBounds } from "./usageNotchGeometry";

describe("usage notch geometry", () => {
  const display = { x: 100, y: 20, width: 1440, height: 900 };

  it("centers the compact pill on the display top edge", () => {
    expect(resolveUsageNotchBounds({ display, presentation: "compact" })).toEqual({
      x: 800,
      y: 20,
      width: 40,
      height: 40,
    });
  });

  it("centers the expanded panel without exceeding a narrow display", () => {
    expect(
      resolveUsageNotchBounds({
        display: { x: 0, y: 0, width: 600, height: 500 },
        presentation: "expanded",
      }),
    ).toEqual({ x: 0, y: 0, width: 600, height: 286 });
  });
});
