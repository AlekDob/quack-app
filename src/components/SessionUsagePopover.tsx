// Cursor-style context usage popover — anchored above the composer ring.
// Context breakdown + Claude Code plan-limit bars (OAuth poll from parent).

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { buildContextBreakdown, type ContextSegment } from "../contextBreakdown";
import { fmtTokenCount } from "../contextUsage";
import {
  fmtLimitResetsIn,
  sessionHeroPct,
  type SessionLimit,
  type SessionUsageData,
} from "../sessionUsageLocal";
import { Icon } from "./Icon";

const POP_GAP = 8;
const POP_MARGIN = 8;

function clampPopPos(btn: DOMRect, popW: number, popH: number) {
  let left = btn.left + btn.width / 2 - popW / 2;
  left = Math.max(POP_MARGIN, Math.min(left, window.innerWidth - popW - POP_MARGIN));
  let top = btn.top - popH - POP_GAP;
  if (top < POP_MARGIN) top = btn.bottom + POP_GAP;
  return { left, top };
}

function fmtSegCount(seg: ContextSegment): string {
  const n = fmtTokenCount(seg.tokens);
  return seg.estimate ? `~${n}` : n;
}

function LimitRow({ limit }: { limit: SessionLimit }) {
  const hot = limit.pct >= 80;
  const resetsIn = fmtLimitResetsIn(limit.resetsAt);
  const pct = Math.min(100, Math.max(0, limit.pct));
  return (
    <div className="session-usage-pop-limit">
      <div className="session-usage-pop-limit-head">
        <span>{limit.label}</span>
        <span className={`session-usage-pop-limit-pct${hot ? " hot" : ""}`}>
          {Math.round(limit.pct)}%
        </span>
      </div>
      <div className="session-usage-pop-limit-bar">
        <div
          className={`session-usage-pop-limit-fill${hot ? " hot" : ""}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {resetsIn && (
        <div className="session-usage-pop-limit-reset">Resets in {resetsIn}</div>
      )}
    </div>
  );
}

interface SessionUsagePopoverProps {
  open: boolean;
  anchorRef: RefObject<HTMLButtonElement | null>;
  data: SessionUsageData | null;
  root: string;
  onClose: () => void;
  onOpenDashboard: () => void;
}

export function SessionUsagePopover({
  open,
  anchorRef,
  data,
  root,
  onClose,
  onOpenDashboard,
}: SessionUsagePopoverProps) {
  const popRef = useRef<HTMLDivElement>(null);
  const [popPos, setPopPos] = useState({ left: 0, top: 0 });
  const [segments, setSegments] = useState<ContextSegment[]>([]);
  const [loading, setLoading] = useState(false);

  const heroPct = data ? sessionHeroPct(data) : 0;
  const total = data?.context.used ?? 0;
  const ctxWindow = data?.context.window ?? 0;

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;
    const btn = anchorRef.current.getBoundingClientRect();
    const place = () => {
      const pop = popRef.current?.getBoundingClientRect();
      setPopPos(clampPopPos(btn, pop?.width ?? 320, pop?.height ?? 280));
    };
    place();
    const id = window.requestAnimationFrame(place);
    return () => window.cancelAnimationFrame(id);
  }, [open, anchorRef, segments.length, loading, data?.limits.length, data?.extra]);

  useEffect(() => {
    if (!open || !data) {
      setSegments([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void buildContextBreakdown(root, data.context.used).then((bd) => {
      if (cancelled) return;
      setSegments(bd.segments);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, root, data?.context.used]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const barTotal = Math.max(total, segments.reduce((s, x) => s + x.tokens, 0), 1);

  return createPortal(
    <>
      <div className="ai-flag-menu-overlay" onClick={onClose} />
      <div
        ref={popRef}
        className="session-usage-pop liquid-glass"
        role="dialog"
        aria-label="Context usage"
        style={{ left: popPos.left, top: popPos.top }}
      >
        <div className="session-usage-pop-head">
          <span className="session-usage-pop-title">Context Usage</span>
          <button
            type="button"
            className="session-usage-pop-close"
            onClick={onClose}
            title="Close"
            aria-label="Close context usage"
          >
            <Icon name="x" size={14} />
          </button>
        </div>

        {!data ? (
          <div className="session-usage-pop-empty">No data yet — polling…</div>
        ) : (
          <>
            <div className="session-usage-pop-hero">
              <span className="session-usage-pop-pct">{heroPct}% Full</span>
              <span className="session-usage-pop-tokens">
                {fmtTokenCount(total)} / {fmtTokenCount(ctxWindow)} Tokens
                {data.context.estimate ? " (est.)" : ""}
              </span>
            </div>

            {loading ? (
              <div className="session-usage-pop-empty">Loading breakdown…</div>
            ) : segments.length > 0 ? (
              <>
                <div
                  className="session-usage-pop-bar"
                  role="img"
                  aria-label="Context breakdown"
                >
                  {segments.map((seg) => (
                    <div
                      key={seg.id}
                      className={`session-usage-pop-bar-seg ctx-seg-${seg.id}`}
                      style={{ width: `${(seg.tokens / barTotal) * 100}%` }}
                      title={`${seg.label}: ${fmtSegCount(seg)}`}
                    />
                  ))}
                </div>
                <ul className="session-usage-pop-list">
                  {segments.map((seg) => (
                    <li key={seg.id} className="session-usage-pop-row">
                      <span
                        className={`session-usage-pop-swatch ctx-seg-${seg.id}`}
                        aria-hidden="true"
                      />
                      <span className="session-usage-pop-label">{seg.label}</span>
                      <span className="session-usage-pop-count mono">
                        {fmtSegCount(seg)}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            {(data.limits.length > 0 || data.extra) && (
              <div className="session-usage-pop-limits">
                <div className="session-usage-pop-section-title">Plan limits</div>
                {data.limits.map((w) => (
                  <LimitRow key={w.label} limit={w} />
                ))}
                {data.extra && (
                  <div className="session-usage-pop-limit">
                    <div className="session-usage-pop-limit-head">
                      <span>Extra usage (monthly)</span>
                      <span className="session-usage-pop-limit-pct mono">
                        ${(data.extra.used / 100).toFixed(2)} / $
                        {(data.extra.limit / 100).toFixed(2)} {data.extra.currency}
                      </span>
                    </div>
                    <div className="session-usage-pop-limit-bar">
                      <div
                        className={`session-usage-pop-limit-fill${data.extra.pct >= 80 ? " hot" : ""}`}
                        style={{
                          width: `${Math.min(100, Math.max(0, data.extra.pct))}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="session-usage-pop-foot">
              <button
                type="button"
                className="session-usage-pop-dash"
                onClick={() => {
                  onClose();
                  onOpenDashboard();
                }}
              >
                Usage dashboard →
              </button>
            </div>
          </>
        )}
      </div>
    </>,
    document.body,
  );
}
