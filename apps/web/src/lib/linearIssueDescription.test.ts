import { describe, expect, it } from "vitest";

import { buildLinearIssueDescription } from "./linearIssueDescription";

describe("buildLinearIssueDescription", () => {
  it("returns just the trimmed text when there are no images", () => {
    expect(buildLinearIssueDescription("  hello  ", [])).toBe("hello");
  });

  it("appends one image as markdown", () => {
    expect(
      buildLinearIssueDescription("bug", [{ name: "shot.png", assetUrl: "https://a/1.png" }]),
    ).toBe("bug\n\n![shot.png](https://a/1.png)");
  });

  it("appends every image and drops an empty body", () => {
    expect(
      buildLinearIssueDescription("   ", [
        { name: "a.png", assetUrl: "https://a/a.png" },
        { name: "b.png", assetUrl: "https://a/b.png" },
      ]),
    ).toBe("![a.png](https://a/a.png)\n\n![b.png](https://a/b.png)");
  });
});
