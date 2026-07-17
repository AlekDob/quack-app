import { describe, expect, it } from "vitest";
import {
  estimateUserBarOverflow,
  USER_BAR_COMPACT_LINES,
} from "./useUserBarSticky";

describe("estimateUserBarOverflow", () => {
  it("keeps short single-line prompts expanded", () => {
    expect(estimateUserBarOverflow("hi")).toBe(false);
    expect(estimateUserBarOverflow("fix the sticky header")).toBe(false);
  });

  it("flags long pastes by character count", () => {
    expect(estimateUserBarOverflow("x".repeat(181))).toBe(true);
  });

  it("flags prompts with enough newlines for the compact line budget", () => {
    // 3 text lines = 2 newlines → fits the clamp; 4 lines = overflows.
    const fits = Array.from({ length: USER_BAR_COMPACT_LINES }, (_, i) =>
      `line ${i}`,
    ).join("\n");
    const overflows = Array.from(
      { length: USER_BAR_COMPACT_LINES + 1 },
      (_, i) => `line ${i}`,
    ).join("\n");
    expect(estimateUserBarOverflow(fits)).toBe(false);
    expect(estimateUserBarOverflow(overflows)).toBe(true);
    expect(estimateUserBarOverflow("a\nb")).toBe(false);
  });
});
