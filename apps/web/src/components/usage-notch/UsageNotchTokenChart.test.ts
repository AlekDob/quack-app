import type { ProfileTokenStats } from "@synara/contracts";
import { describe, expect, it } from "vitest";

import { deriveUsageNotchTokenChart, USAGE_NOTCH_TOKEN_CHART_DAYS } from "./UsageNotchTokenChart";

function tokenStats(input: Partial<ProfileTokenStats> = {}): ProfileTokenStats {
  return {
    available: true,
    lifetimeTotalTokens: 1,
    peakDayTokens: 1,
    peakDay: "2026-08-05",
    providers: [],
    unavailableProviders: [],
    topProvider: null,
    topProviderPercent: null,
    models: [],
    heatmapMetric: "tokens",
    heatmap: [],
    ...input,
  };
}

describe("deriveUsageNotchTokenChart", () => {
  it("returns the chronological week ending on the latest heatmap day", () => {
    const chart = deriveUsageNotchTokenChart(
      tokenStats({
        heatmap: [
          { day: "2026-08-05", count: 50, weekday: 3, intensity: 4 },
          { day: "2026-08-03", count: 25, weekday: 1, intensity: 2 },
          { day: "2026-08-01", count: 10, weekday: 6, intensity: 1 },
        ],
      }),
    );

    expect(chart?.days).toHaveLength(USAGE_NOTCH_TOKEN_CHART_DAYS);
    expect(chart?.days.map((entry) => entry.day)).toEqual([
      "2026-07-30",
      "2026-07-31",
      "2026-08-01",
      "2026-08-02",
      "2026-08-03",
      "2026-08-04",
      "2026-08-05",
    ]);
    expect(chart?.today.tokens).toBe(50);
    expect(chart?.days.map((entry) => entry.tokens)).toEqual([0, 0, 10, 0, 25, 0, 50]);
    expect(chart?.days.map((entry) => entry.heightPercent)).toEqual([0, 0, 20, 0, 50, 0, 100]);
  });

  it("leaves an all-zero week empty", () => {
    const chart = deriveUsageNotchTokenChart(
      tokenStats({
        heatmap: [{ day: "2026-08-05", count: 0, weekday: 3, intensity: 0 }],
      }),
    );

    expect(chart?.today.tokens).toBe(0);
    expect(chart?.days.every((entry) => entry.heightPercent === 0)).toBe(true);
  });

  it("omits the chart when local token telemetry is unavailable or unusable", () => {
    expect(deriveUsageNotchTokenChart(tokenStats({ available: false }))).toBeNull();
    expect(deriveUsageNotchTokenChart(tokenStats())).toBeNull();
  });

  it("falls back to activity counts when token telemetry is unavailable", () => {
    const chart = deriveUsageNotchTokenChart(tokenStats({ available: false }), [
      { day: "2026-08-05", count: 3, weekday: 3, intensity: 2 },
    ]);

    expect(chart?.unit).toBe("prompts");
    expect(chart?.today.tokens).toBe(3);
  });
});
