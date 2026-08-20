import { describe, expect, it } from "vitest";

import {
  identifierFromLinearMentionPath,
  isLinearMentionPath,
  linearIssueWebUrlForIdentifier,
  linearMentionNameFromIssue,
  linearMentionPathForIdentifier,
  linearWorkspaceDisplayName,
  parseLinearMentionPath,
} from "./linearMentions";

describe("linear mention paths", () => {
  it("round-trips an issue identifier through the mention path", () => {
    const path = linearMentionPathForIdentifier("ALE-22");
    expect(path).toBe("linear://ALE-22");
    expect(isLinearMentionPath(path)).toBe(true);
    expect(identifierFromLinearMentionPath(path)).toBe("ALE-22");
    expect(parseLinearMentionPath(path)).toEqual({ identifier: "ALE-22", urlKey: null });
  });

  it("stores the workspace slug so two orgs can share ENG-1", () => {
    const path = linearMentionPathForIdentifier("ENG-1", "alekdob");
    expect(path).toBe("linear://alekdob/ENG-1");
    expect(parseLinearMentionPath(path)).toEqual({ identifier: "ENG-1", urlKey: "alekdob" });
    expect(linearIssueWebUrlForIdentifier("ENG-1", "alekdob")).toBe(
      "https://linear.app/alekdob/issue/ENG-1",
    );
  });

  it("rejects plugin tokens, empty ids, and non-linear paths", () => {
    expect(isLinearMentionPath("linear")).toBe(false);
    expect(isLinearMentionPath("plugin://linear@openai-curated")).toBe(false);
    expect(identifierFromLinearMentionPath("plugin://linear")).toBeNull();
    expect(identifierFromLinearMentionPath("linear://")).toBeNull();
    expect(identifierFromLinearMentionPath("linear://   ")).toBeNull();
    expect(parseLinearMentionPath("linear://alekdob/")).toBeNull();
    expect(parseLinearMentionPath("linear://alekdob/ENG-1/extra")).toBeNull();
  });

  it("builds the public issue URL and composer mention name", () => {
    expect(linearIssueWebUrlForIdentifier("ALE-22")).toBe("https://linear.app/issue/ALE-22");
    expect(linearMentionNameFromIssue({ identifier: "ALE-22", title: "Kanban" })).toBe(
      "ALE-22 Kanban",
    );
  });

  it("prefers a user label over the Linear org name", () => {
    expect(linearWorkspaceDisplayName({ name: "Alek", label: "Casa" })).toBe("Casa");
    expect(linearWorkspaceDisplayName({ name: "Alek", label: "  " })).toBe("Alek");
    expect(linearWorkspaceDisplayName({ name: "Alek" })).toBe("Alek");
  });
});
