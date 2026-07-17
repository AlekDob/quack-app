import { describe, expect, it } from "vitest";
import { formatWorkedDuration } from "./formatWorkedDuration";

describe("formatWorkedDuration", () => {
  it("formats seconds under a minute", () => {
    expect(formatWorkedDuration(0)).toBe("0s");
    expect(formatWorkedDuration(400)).toBe("0s");
    expect(formatWorkedDuration(1500)).toBe("2s");
    expect(formatWorkedDuration(4000)).toBe("4s");
  });

  it("formats minutes and seconds", () => {
    expect(formatWorkedDuration(60_000)).toBe("1m");
    expect(formatWorkedDuration(102_000)).toBe("1m 42s");
    expect(formatWorkedDuration(125_000)).toBe("2m 5s");
  });
});
