// Right slide-over drawer showing Claude Code session usage detail.
// CONTROLLED by parent `open` prop — the parent decides when to show/hide.
// Mirrors ToolResultDrawer's mount/animation pattern (stay mounted
// through close transition, double-rAF on open).
//
// Brain: session-usage-panel

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useModalFocus } from "../useModalFocus";
import { Icon } from "./Icon";
import { UsageRing } from "./UsageRing";
import { fmtTokenCount } from "../contextUsage";
import { sessionHeroPct } from "../sessionUsageLocal";

/** Shape from AIChatPanel's `claude_usage_limits` parsing. */
export interface SessionLimit {
  label: string;
  pct: number;
  resetsAt: string | null;
}

export interface SessionExtra {
  used: number; // cents
  limit: number; // cents
  pct: number;
  currency: string;
}

export interface SessionUsageData {
  /** Context window fill from the last turn (or estimate). */
  context: {
    pct: number;
    used: number;
    window: number;
    estimate: boolean;
  };
  /** Plan-limit windows (5hr, 7day, etc.) */
  limits: SessionLimit[];
  /** Extra usage (monthly overage) */
  extra: SessionExtra | null;
  /** Current chat totals from Quack's local ledger */
  chat: {
    cost: number;
    tokensIn: number;
    tokensOut: number;
    cacheRead: number;
    turns: number;
    model: string | null;
    durationMs: number;
  };
  /** Monthly workspace total (for the "this workspace" card) */
  wsMonth: number;
  /** Monthly global total */
  month: number;
  /** Today's total */
  today: number;
}

interface SessionUsageDrawerProps {
  /** Controlled by parent — true = open, false = close. */
  open: boolean;
  data: SessionUsageData | null;
  /** When OAuth plan limits could not be loaded. */
  limitsError?: string | null;
  onClose: () => void;
  onOpenDashboard: () => void;
}

export function SessionUsageDrawer({
  open,
  data,
  limitsError = null,
  onClose,
  onOpenDashboard,
}: SessionUsageDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  useModalFocus(panelRef, shown);

  // Mount/unmount with enter/exit animation.
  useEffect(() => {
    if (open && !mounted) {
      setMounted(true);
      // Double-rAF so the off-screen frame paints before we slide in.
      requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
    } else if (!open && mounted) {
      setShown(false);
      const t = window.setTimeout(() => setMounted(false), 220);
      return () => window.clearTimeout(t);
    }
  }, [open, mounted]);

  // Esc to close.
  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mounted, onClose]);

  if (!mounted) return null;

  const heroPct = data ? sessionHeroPct(data) : 0;

  return createPortal(
    <div
      className={`tool-drawer-scrim${shown ? " shown" : ""}`}
      onMouseDown={onClose}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`tool-drawer${shown ? " shown" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Session usage"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="tool-drawer-head">
          <div className="tool-drawer-titles">
            <span className="tool-drawer-title">Context &amp; Usage</span>
            <span className="tool-drawer-sub">
              {data?.chat.model
                ? data.chat.model.replace(/^claude-/, "")
                : "Claude Code session"}
            </span>
          </div>
          <button
            className="tool-drawer-close"
            onClick={onClose}
            title="Close (Esc)"
            aria-label="Close session usage"
          >
            <Icon name="x" size={14} />
          </button>
        </div>

        <div className="session-drawer-body">
          {!data ? (
            <div className="session-drawer-empty">No data yet — polling…</div>
          ) : (
            <>
              <div className="session-drawer-hero">
                <UsageRing pct={heroPct} size={72} stroke={5} />
                <div className="session-drawer-hero-text">
                  <span className="session-drawer-hero-pct">{heroPct}%</span>
                  <span className="session-drawer-hero-sub">
                    {data.context.pct > 0 || data.context.used > 0 ? (
                      <>
                        {fmtTokenCount(data.context.used)} /{" "}
                        {fmtTokenCount(data.context.window)} context
                        {data.context.estimate ? " (estimated)" : ""}
                      </>
                    ) : (
                      "Context — waiting for data"
                    )}
                  </span>
                </div>
              </div>
              <div className="session-drawer-ctx-bar">
                <div
                  className={`session-drawer-bar-fill ${heroPct >= 90 ? "hot" : heroPct >= 70 ? "warn" : ""}`}
                  style={{ width: `${heroPct}%` }}
                />
              </div>

              {limitsError && (
                <div className="session-drawer-limits-err" role="status">
                  Plan limits: {limitsError}
                </div>
              )}

              {data.limits.length > 0 && (
                <div className="session-drawer-section">
                  <div className="session-drawer-section-title">
                    Plan limits
                  </div>
                  {data.limits.map((w) => {
                    const resetsIn = (() => {
                      if (!w.resetsAt) return null;
                      const ms =
                        new Date(w.resetsAt).getTime() - Date.now();
                      if (ms <= 0) return null;
                      const h = ms / 3_600_000;
                      if (h < 1) return `${Math.ceil(ms / 60_000)}m`;
                      if (h < 48) return `${Math.ceil(h)}h`;
                      return `${Math.ceil(h / 24)}d`;
                    })();
                    const hot = w.pct >= 80;
                    return (
                      <div key={w.label} className="session-drawer-window">
                        <div className="session-drawer-window-head">
                          <span>{w.label}</span>
                          <span
                            className={`session-drawer-window-pct ${hot ? "hot" : ""}`}
                          >
                            {Math.round(w.pct)}%
                          </span>
                        </div>
                        <div className="session-drawer-bar">
                          <div
                            className={`session-drawer-bar-fill ${hot ? "hot" : ""}`}
                            style={{
                              width: `${Math.min(100, Math.max(0, w.pct))}%`,
                            }}
                          />
                        </div>
                        {resetsIn && (
                          <div className="session-drawer-reset">
                            Resets in {resetsIn}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Extra usage */}
              {data.extra && (
                <div className="session-drawer-section">
                  <div className="session-drawer-section-title">
                    Extra usage (monthly)
                  </div>
                  <div className="session-drawer-window">
                    <div className="session-drawer-window-head">
                      <span>Overage</span>
                      <span className="session-drawer-window-pct">
                        ${(data.extra.used / 100).toFixed(2)} / $
                        {(data.extra.limit / 100).toFixed(2)}{" "}
                        {data.extra.currency}
                      </span>
                    </div>
                    <div className="session-drawer-bar">
                      <div
                        className={`session-drawer-bar-fill ${data.extra.pct >= 80 ? "hot" : ""}`}
                        style={{
                          width: `${Math.min(100, Math.max(0, data.extra.pct))}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="session-drawer-section">
                <div className="session-drawer-section-title">This chat</div>
                <div className="session-drawer-kv">
                  <div className="session-drawer-kv-row">
                    <span>Cost</span>
                    <span className="mono">${data.chat.cost.toFixed(4)}</span>
                  </div>
                  <div className="session-drawer-kv-row">
                    <span>Turns</span>
                    <span>{data.chat.turns}</span>
                  </div>
                  <div className="session-drawer-kv-row">
                    <span>Input</span>
                    <span className="mono">
                      {fmtTokenCount(data.chat.tokensIn)}
                    </span>
                  </div>
                  <div className="session-drawer-kv-row">
                    <span>Output</span>
                    <span className="mono">
                      {fmtTokenCount(data.chat.tokensOut)}
                    </span>
                  </div>
                  {data.chat.cacheRead > 0 && (
                    <div className="session-drawer-kv-row">
                      <span>Cache read</span>
                      <span className="mono">
                        {fmtTokenCount(data.chat.cacheRead)}
                      </span>
                    </div>
                  )}
                  {data.chat.durationMs > 0 && (
                    <div className="session-drawer-kv-row">
                      <span>Duration</span>
                      <span>{fmtDuration(data.chat.durationMs)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="session-drawer-section">
                <div className="session-drawer-section-title">Quack spend</div>
                <div className="session-drawer-kv">
                  <div className="session-drawer-kv-row">
                    <span>Today</span>
                    <span className="mono">${data.today.toFixed(2)}</span>
                  </div>
                  <div className="session-drawer-kv-row">
                    <span>Workspace · month</span>
                    <span className="mono">${data.wsMonth.toFixed(2)}</span>
                  </div>
                  <div className="session-drawer-kv-row">
                    <span>All · month</span>
                    <span className="mono">${data.month.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="session-drawer-foot">
                <button
                  className="usage-dash-btn"
                  onClick={onOpenDashboard}
                >
                  Open Usage Dashboard →
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function fmtDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min < 60) return `${min}m ${sec}s`;
  const h = Math.floor(min / 60);
  const rem = min % 60;
  return `${h}h ${rem}m`;
}
