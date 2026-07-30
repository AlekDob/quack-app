import { describe, expect, it } from "vitest";
import {
  buildComposerHighlightHtml,
  findComposerTokenSpans,
} from "./composerInputHighlight";

describe("findComposerTokenSpans", () => {
  it("finds a linked feature @slug", () => {
    const spans = findComposerTokenSpans(
      "see @002-landing-content-update please",
      [],
      "002-landing-content-update",
    );
    expect(spans).toEqual([
      { start: 4, end: 31, kind: "feature" },
    ]);
  });

  it("finds /skill tokens mid-text", () => {
    const spans = findComposerTokenSpans("Sds /plane-so now", ["plane-so"], null);
    expect(spans).toEqual([{ start: 4, end: 13, kind: "skill" }]);
  });

  it("prefers longer skill names", () => {
    const spans = findComposerTokenSpans("/ab-cd", ["ab", "ab-cd"], null);
    expect(spans[0]).toEqual({ start: 0, end: 6, kind: "skill" });
  });

  it("finds @file path cites", () => {
    const spans = findComposerTokenSpans(
      "look at @README.md please",
      [],
      null,
      ["README.md"],
    );
    expect(spans).toEqual([{ start: 8, end: 18, kind: "file" }]);
  });

  it("prefers longer file paths over prefixes", () => {
    const spans = findComposerTokenSpans(
      "@src/a.ts done",
      [],
      null,
      ["src", "src/a.ts"],
    );
    expect(spans).toEqual([{ start: 0, end: 9, kind: "file" }]);
  });

  it("feature wins over same-token file", () => {
    const spans = findComposerTokenSpans(
      "@001-x here",
      [],
      "001-x",
      ["001-x"],
    );
    expect(spans).toEqual([{ start: 0, end: 6, kind: "feature" }]);
  });
});

describe("buildComposerHighlightHtml", () => {
  it("wraps skill + feature + file", () => {
    const html = buildComposerHighlightHtml(
      "@001-x /plane-so @README.md",
      ["plane-so"],
      "001-x",
      ["README.md"],
    );
    expect(html).toContain('class="tok-feature"');
    expect(html).toContain('class="tok-skill"');
    expect(html).toContain('class="tok-file"');
    expect(html).toContain("@001-x");
    expect(html).toContain("/plane-so");
    expect(html).toContain("@README.md");
  });
});
