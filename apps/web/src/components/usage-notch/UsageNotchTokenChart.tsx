// FILE: UsageNotchTokenChart.tsx
// Purpose: Seven-day local token-usage summary for the expanded usage notch.

import type { ProfileHeatmapCell, ProfileTokenStats } from "@synara/contracts";

import {
  formatCompact,
  formatNumber,
  formatShortDate,
} from "~/components/profile/profileFormatting";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

export const USAGE_NOTCH_TOKEN_CHART_DAYS = 7;
// Zero days show only the track, like an empty provider quota bar; non-empty days
// keep a small floor so a tiny day is still visible.
const EMPTY_BAR_HEIGHT_PERCENT = 0;
const MIN_NON_EMPTY_BAR_HEIGHT_PERCENT = 6;

export interface UsageNotchTokenChartDay {
  readonly day: string;
  readonly tokens: number;
  readonly heightPercent: number;
}

export interface UsageNotchTokenChartModel {
  readonly today: UsageNotchTokenChartDay;
  readonly days: ReadonlyArray<UsageNotchTokenChartDay>;
  readonly unit: "tokens" | "prompts";
}

function addDaysIso(day: string, offset: number): string {
  const [year, month, date] = day.split("-").map(Number);
  const value = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, date ?? 1));
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}

function isIsoDay(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/u.test(value);
}

/**
 * Converts the profile heatmap into a fixed, chronological week ending on its
 * newest day. Missing cells are intentionally represented as zero-token days.
 */
export function deriveUsageNotchTokenChart(
  tokenStats: ProfileTokenStats | null | undefined,
  activityHeatmap: ReadonlyArray<ProfileHeatmapCell> = [],
): UsageNotchTokenChartModel | null {
  const heatmap = tokenStats?.available ? tokenStats.heatmap : activityHeatmap;
  const unit = tokenStats?.available ? "tokens" : "prompts";
  if (heatmap.length === 0) return null;

  const countsByDay = new Map<string, number>();
  for (const cell of heatmap) {
    if (!isIsoDay(cell.day)) continue;
    countsByDay.set(cell.day, Math.max(0, cell.count));
  }
  const todayDay = [...countsByDay.keys()].toSorted().at(-1);
  if (!todayDay) return null;

  const rawDays = Array.from({ length: USAGE_NOTCH_TOKEN_CHART_DAYS }, (_, index) => {
    const day = addDaysIso(todayDay, index - (USAGE_NOTCH_TOKEN_CHART_DAYS - 1));
    return { day, tokens: countsByDay.get(day) ?? 0 };
  });
  const weeklyMax = rawDays.reduce((max, entry) => Math.max(max, entry.tokens), 0);
  const days = rawDays.map((entry) => ({
    ...entry,
    heightPercent:
      entry.tokens === 0 || weeklyMax === 0
        ? EMPTY_BAR_HEIGHT_PERCENT
        : Math.max(MIN_NON_EMPTY_BAR_HEIGHT_PERCENT, Math.round((entry.tokens / weeklyMax) * 100)),
  }));

  return { days, today: days.at(-1)!, unit };
}

function dayLabel(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, { weekday: "short" })
    .format(new Date(year ?? 0, (month ?? 1) - 1, date ?? 1))
    .replace(".", "")
    .toLocaleUpperCase();
}

function usageLabel(tokens: number, unit: UsageNotchTokenChartModel["unit"]): string {
  const singular = unit === "tokens" ? "token" : "prompt";
  return `${formatNumber(tokens)} ${tokens === 1 ? singular : unit}`;
}

export function UsageNotchTokenChart({
  tokenStats,
  activityHeatmap,
}: {
  readonly tokenStats: ProfileTokenStats | null;
  readonly activityHeatmap?: ReadonlyArray<ProfileHeatmapCell> | undefined;
}) {
  const chart = deriveUsageNotchTokenChart(tokenStats, activityHeatmap);
  if (!chart) return null;

  return (
    <article
      className="rounded-2xl border border-white/10 bg-white/[0.055] px-3 py-2.5"
      aria-label={`Today: ${usageLabel(chart.today.tokens, chart.unit)}. Seven-day history.`}
    >
      <div className="flex justify-between gap-2 text-[10px] tabular-nums text-white/62">
        <span className="font-medium text-white/82">Today</span>
        <span>
          {formatCompact(chart.today.tokens)} {chart.unit}
        </span>
      </div>
      <div className="mt-2 flex h-7 items-end gap-2">
        {chart.days.map((entry, index) => (
          <Tooltip key={entry.day}>
            <TooltipTrigger
              delay={150}
              render={
                <div
                  className="flex h-full min-w-0 flex-1 cursor-default items-end justify-center outline-none focus-visible:ring-1 focus-visible:ring-white/60"
                  aria-label={`${formatShortDate(entry.day) ?? entry.day}: ${usageLabel(entry.tokens, chart.unit)}`}
                >
                  {/* Same 4px rounded track/fill language as the provider quota bars, rotated. */}
                  <div className="relative h-full w-1 overflow-hidden rounded-full bg-white/12">
                    <div
                      className={cn(
                        "absolute inset-x-0 bottom-0 rounded-full",
                        index === chart.days.length - 1 ? "bg-white/85" : "bg-white/38",
                      )}
                      style={{ height: `${entry.heightPercent}%` }}
                    />
                  </div>
                </div>
              }
            />
            <TooltipPopup
              side="top"
              sideOffset={6}
              className="border-white/12 bg-zinc-950 text-[10px] font-medium tabular-nums text-white shadow-lg"
            >
              {formatShortDate(entry.day) ?? entry.day} · {usageLabel(entry.tokens, chart.unit)}
            </TooltipPopup>
          </Tooltip>
        ))}
      </div>
      <div className="mt-1 flex gap-2" aria-hidden>
        {chart.days.map((entry) => (
          <span
            key={entry.day}
            className="min-w-0 flex-1 text-center text-[9px] font-medium text-white/45"
          >
            {dayLabel(entry.day)}
          </span>
        ))}
      </div>
    </article>
  );
}
