import {
  loadUsage,
  thisMonthTotal,
  thisMonthWorkspaceTotal,
} from "./aiUsageLog";
import type {
  SessionExtra,
  SessionLimit,
  SessionUsageData,
} from "./components/SessionUsageDrawer";
import {
  contextFillPct,
  estimateContextUsed,
  resolveContextWindow,
} from "./contextUsage";
import type { ProviderModel } from "./providers/types";

type UsageApi = Record<
  string,
  { utilization?: number; resets_at?: string | null } | null
> & {
  extra_usage?: {
    is_enabled?: boolean;
    monthly_limit?: number;
    used_credits?: number;
    utilization?: number;
    currency?: string;
  } | null;
};

const LIMIT_WINDOWS: Array<[string, string]> = [
  ["five_hour", "Session (5hr)"],
  ["seven_day", "Weekly (7 day)"],
  ["seven_day_sonnet", "Weekly Sonnet"],
  ["seven_day_opus", "Weekly Opus"],
];

/** API may return 0–1 or 0–100 — normalize to percent. */
export function normUsagePct(v: number): number {
  if (v > 0 && v <= 1) return v * 100;
  return v;
}

/** Ring / hero %: context window when known, else best plan limit. */
export function sessionHeroPct(data: SessionUsageData): number {
  if (data.context.pct > 0) return data.context.pct;
  const five = data.limits.find((l) => l.label.includes("5hr"));
  return five?.pct ?? data.limits[0]?.pct ?? 0;
}

export function parseUsageLimits(u: UsageApi): SessionLimit[] {
  const limits: SessionLimit[] = [];
  for (const [key, label] of LIMIT_WINDOWS) {
    const w = u[key];
    if (w && typeof w.utilization === "number") {
      limits.push({
        label,
        pct: normUsagePct(w.utilization),
        resetsAt: w.resets_at ?? null,
      });
    }
  }
  return limits;
}

export function parseUsageExtra(u: UsageApi): SessionExtra | null {
  const ex = u.extra_usage;
  if (!ex?.is_enabled || typeof ex.used_credits !== "number") return null;
  return {
    used: ex.used_credits,
    limit: ex.monthly_limit ?? 0,
    pct: ex.utilization != null ? normUsagePct(ex.utilization) : 0,
    currency: ex.currency ?? "USD",
  };
}

interface LocalChatMetrics {
  cost: number;
  tokensIn: number;
  tokensOut: number;
  cacheRead: number;
  turns: number;
  model: string | null;
  durationMs: number;
}

interface BuildLocalOpts {
  wsId: string;
  chat: LocalChatMetrics;
  selectedQualified: string | null;
  models: ProviderModel[];
  lastTurnTokens?: {
    input: number;
    output: number;
    cacheRead: number;
    cacheCreate: number;
  };
}

export function buildSessionUsageLocal(opts: BuildLocalOpts): SessionUsageData {
  const { wsId, chat, selectedQualified, models, lastTurnTokens } = opts;
  const window = resolveContextWindow(selectedQualified, models);
  const { used, estimate } = estimateContextUsed(
    lastTurnTokens,
    chat.tokensIn,
    chat.cacheRead,
  );
  const records = loadUsage();
  const todayKey = new Date().toDateString();
  return {
    context: {
      pct: contextFillPct(used, window),
      used,
      window,
      estimate,
    },
    limits: [],
    extra: null,
    chat,
    wsMonth: thisMonthWorkspaceTotal(wsId, records),
    month: thisMonthTotal(records),
    today: records
      .filter((r) => new Date(r.ts).toDateString() === todayKey)
      .reduce((a, r) => a + r.costUsd, 0),
  };
}
