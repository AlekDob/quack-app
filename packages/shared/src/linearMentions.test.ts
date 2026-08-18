import { describe, expect, it } from "vitest";

import {
  identifierFromLinearMentionPath,
  isLinearMentionPath,
  linearIssueWebUrlForIdentifier,
  linearMentionNameFromIssue,
  linearMentionPathForIdentifier,
} from "./linearMentions";

describe("linear mention paths", () => {
  it("round-trips an issue identifier through the mention path", () => {
    const path = linearMentionPathForIdentifier("ALE-22");
    expect(path).toBe("linear://ALE-22");
    expect(isLinearMentionPath(path)).toBe(true);
    expect(identifierFromLinearMentionPath(path)).toBe("ALE-22");
  });

  it("rejects plugin tokens, empty ids, and non-linear paths", () => {
    expect(isLinearMentionPath("linear")).toBe(false);
    expect(isLinearMentionPath("plugin://linear@openai-curated")).toBe(false);
    expect(identifierFromLinearMentionPath("plugin://linear")).toBeNull();
    expect(identifierFromLinearMentionPath("linear://")).toBeNull();
    expect(identifierFromLinearMentionPath("linear://   ")).toBeNull();
  });

  it("builds the public issue URL and composer mention name", () => {
    expect(linearIssueWebUrlForIdentifier("ALE-22")).toBe("https://linear.app/issue/ALE-22");
    expect(linearMentionNameFromIssue({ identifier: "ALE-22", title: "Kanban" })).toBe(
      "ALE-22 Kanban",
    );
  });
});
