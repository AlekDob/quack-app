import { describe, expect, it } from "vitest";
import {
  contextTokensFromCompactMeta,
  estimateContextUsed,
} from "./contextUsage";

describe("contextTokensFromCompactMeta", () => {
  it("maps postTokens onto the ring used-total", () => {
    const snap = contextTokensFromCompactMeta({
      trigger: "manual",
      preTokens: 523_087,
      postTokens: 20_808,
    });
    expect(snap).toEqual({
      input: 20_808,
      output: 0,
      cacheRead: 0,
      cacheCreate: 0,
    });
    expect(estimateContextUsed(snap, 0)).toEqual({
      used: 20_808,
      estimate: false,
    });
  });

  it("accepts snake_case post_tokens", () => {
    expect(contextTokensFromCompactMeta({ post_tokens: 6400 })?.input).toBe(
      6400,
    );
  });

  it("ignores missing or non-positive postTokens", () => {
    expect(contextTokensFromCompactMeta({ preTokens: 100 })).toBeUndefined();
    expect(contextTokensFromCompactMeta({ postTokens: 0 })).toBeUndefined();
    expect(contextTokensFromCompactMeta(undefined)).toBeUndefined();
  });
});
