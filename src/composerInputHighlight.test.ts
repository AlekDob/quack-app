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
});

describe("buildComposerHighlightHtml", () => {
  it("wraps skill + feature", () => {
    const html = buildComposerHighlightHtml(
      "@001-x /plane-so",
      ["plane-so"],
      "001-x",
    );
    expect(html).toContain('class="tok-feature"');
    expect(html).toContain('class="tok-skill"');
    expect(html).toContain("@001-x");
    expect(html).toContain("/plane-so");
  });
});
