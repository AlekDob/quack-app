// Styled spend-limit card — replaces raw Claude "You've hit your org's…"
// prose with warn chrome + live plan/extra usage bars (feature 023 data).

import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  fmtLimitResetsIn,
  parseUsageExtra,
  parseUsageLimits,
  type SessionExtra,
  type SessionLimit,
} from "../sessionUsageLocal";
import { openSettings } from "../settingsBus";
import { Icon } from "./Icon";

function LimitBar({
  label,
  pct,
  detail,
  resetsAt,
}: {
  label: string;
  pct: number;
  detail?: string;
  resetsAt?: string | null;
}) {
  const hot = pct >= 80;
  const width = Math.min(100, Math.max(0, pct));
  const resetsIn = fmtLimitResetsIn(resetsAt ?? null);
  return (
    <div className="ai-spend-limit-bar">
      <div className="ai-spend-limit-bar-head">
        <span>{label}</span>
        <span className={`ai-spend-limit-bar-pct${hot ? " hot" : ""}`}>
          {detail ?? `${Math.round(pct)}%`}
        </span>
      </div>
      <div className="ai-spend-limit-bar-track">
        <div
          className={`ai-spend-limit-bar-fill${hot ? " hot" : ""}`}
          style={{ width: `${width}%` }}
        />
      </div>
      {resetsIn && (
        <div className="ai-spend-limit-bar-reset">Resets in {resetsIn}</div>
      )}
    </div>
  );
}

interface SpendLimitCardProps {
  raw: string;
}

export function SpendLimitCard({ raw }: SpendLimitCardProps) {
  const [limits, setLimits] = useState<SessionLimit[]>([]);
  const [extra, setExtra] = useState<SessionExtra | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await invoke<{ usage?: Record<string, unknown> }>(
          "claude_usage_limits",
        );
        if (cancelled) return;
        const u = (res.usage ?? {}) as Parameters<typeof parseUsageLimits>[0];
        setLimits(parseUsageLimits(u));
        setExtra(parseUsageExtra(u));
      } catch {
        /* offline / unsigned — card still useful without bars */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const extraDetail =
    extra && extra.limit > 0
      ? `$${(extra.used / 100).toFixed(2)} / $${(extra.limit / 100).toFixed(2)} ${extra.currency}`
      : undefined;

  return (
    <div className="ai-spend-limit-card" role="status">
      <div className="ai-spend-limit-head">
        <Icon name="alert-triangle" size={14} className="ai-spend-limit-icon" />
        <div className="ai-spend-limit-copy">
          <div className="ai-spend-limit-title">Monthly spend limit reached</div>
          <div className="ai-spend-limit-text">
            Your org&apos;s Claude usage cap is full. Ask an admin for a higher
            limit, or wait for the next billing cycle.
          </div>
        </div>
        <button
          type="button"
          className="ai-spend-limit-btn"
          onClick={() => openSettings("ai-usage-cross-chat-dashboard")}
        >
          View usage
        </button>
      </div>
      {(extra || limits.length > 0) && (
        <div className="ai-spend-limit-meters">
          {extra && (
            <LimitBar
              label="Extra usage (monthly)"
              pct={extra.pct || (extra.limit > 0 ? (extra.used / extra.limit) * 100 : 100)}
              detail={extraDetail}
            />
          )}
          {limits.map((w) => (
            <LimitBar
              key={w.label}
              label={w.label}
              pct={w.pct}
              resetsAt={w.resetsAt}
            />
          ))}
        </div>
      )}
      {!extra && limits.length === 0 && (
        <div className="ai-spend-limit-meters">
          <LimitBar label="Org monthly spend" pct={100} detail="Limit reached" />
        </div>
      )}
      <div className="ai-spend-limit-raw" title={raw}>
        {raw}
      </div>
    </div>
  );
}
