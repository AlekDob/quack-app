import { describe, expect, it } from "vitest";
import {
  appendFeatureComment,
  featureLabelFromSlug,
  listFeatureTaskLines,
  setFeatureFrontmatterField,
  setFeatureStatusInMd,
  slugifyFeatureName,
  toggleFeatureTaskInMd,
} from "./featureCatalog";
import { featureRange } from "./worksTimelineDates";

describe("featureCatalog helpers", () => {
  it("slugifyFeatureName", () => {
    expect(slugifyFeatureName("Hello World!")).toBe("hello-world");
  });

  it("featureLabelFromSlug", () => {
    expect(featureLabelFromSlug("054-works-layer")).toBe("054 · works layer");
  });

  it("setFeatureStatusInMd inserts or replaces", () => {
    const withFm = setFeatureStatusInMd(
      "---\ntype: feature-doc\n---\n\n## Hi\n",
      "done",
    );
    expect(withFm).toMatch(/status: done/);
    expect(withFm).toMatch(/endDate: \d{4}-\d{2}-\d{2}/);
    const replaced = setFeatureStatusInMd(withFm, "draft");
    expect(replaced).toMatch(/status: draft/);
    expect(replaced.match(/status:/g)?.length).toBe(1);
  });

  it("setFeatureFrontmatterField for dates", () => {
    const src = "---\ncreated: 2026-07-01\n---\n\n## X\n";
    const next = setFeatureFrontmatterField(src, "startDate", "2026-07-10");
    expect(next).toMatch(/startDate: 2026-07-10/);
  });

  it("toggleFeatureTaskInMd", () => {
    const src = "## Tasks\n- [ ] one\n- [x] two\n";
    const next = toggleFeatureTaskInMd(src, 0);
    expect(listFeatureTaskLines(next)[0]?.done).toBe(true);
    expect(listFeatureTaskLines(next)[1]?.done).toBe(true);
  });

  it("appendFeatureComment", () => {
    const src = "## Notes\n\n### Comments\n- old\n";
    const next = appendFeatureComment(src, "hello");
    expect(next).toContain("hello");
    expect(next).toMatch(/### Comments\n- \d{4}-\d{2}-\d{2}: hello/);
  });

  it("featureRange uses startDate/endDate", () => {
    const r = featureRange({
      created: "2026-07-01",
      startDate: "2026-07-10",
      endDate: "2026-07-12",
      status: "active",
    });
    expect(r.end).toBeGreaterThanOrEqual(r.start);
  });
});
