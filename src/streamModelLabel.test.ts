import { describe, expect, it } from "vitest";
import { streamModelLabel } from "./streamModelLabel";

describe("streamModelLabel", () => {
  it("formats dated Claude ids with major.minor", () => {
    expect(streamModelLabel("claude-haiku-4-5-20251001")).toBe("Haiku 4.5");
    expect(streamModelLabel("claude-opus-4-8")).toBe("Opus 4.8");
    expect(streamModelLabel("claude-sonnet-5")).toBe("Sonnet 5");
  });

  it("title-cases bare aliases", () => {
    expect(streamModelLabel("haiku")).toBe("Haiku");
    expect(streamModelLabel("sonnet")).toBe("Sonnet");
    expect(streamModelLabel("opus")).toBe("Opus");
    expect(streamModelLabel("default")).toBe("Default");
  });

  it("returns null for empty or synthetic", () => {
    expect(streamModelLabel(null)).toBeNull();
    expect(streamModelLabel(undefined)).toBeNull();
    expect(streamModelLabel("")).toBeNull();
    expect(streamModelLabel("<synthetic>")).toBeNull();
  });

  it("falls back to the raw id when no family matches", () => {
    expect(streamModelLabel("gpt-4o")).toBe("gpt-4o");
  });
});
