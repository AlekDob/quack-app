// FILE: UsageNotchSurface.tsx
// Purpose: Hover-only compact usage monitor rendered in the dedicated Electron overlay.

import type { ServerProviderUsageSnapshot } from "@synara/contracts";
import { providerUsageDisplayName } from "@synara/shared/providerUsage";
import { useEffect, useRef, useState } from "react";

import { ProviderIcon } from "~/components/ProviderIcon";
import { disclosureContentClassName, disclosureShellClassName } from "~/lib/disclosureMotion";
import { deriveProviderUsageDisplayRows } from "~/lib/providerUsageDisplay";
import { normalizeServerProviderUsageRateLimit } from "~/lib/providerUsageSnapshot";
import { fetchAllProviderUsage } from "~/lib/serverReactQuery";
import { cn } from "~/lib/utils";

const COLLAPSE_DELAY_MS = 120;
const REFRESH_INTERVAL_MS = 60_000;

function visibleSnapshots(snapshots: readonly ServerProviderUsageSnapshot[]) {
  return snapshots.flatMap((snapshot) => {
    if (snapshot.status !== undefined && snapshot.status !== "ok") return [];
    const normalized = normalizeServerProviderUsageRateLimit(snapshot);
    const rows = normalized ? deriveProviderUsageDisplayRows([normalized]) : [];
    return rows.length > 0 ? [{ snapshot, rows }] : [];
  });
}

export function UsageNotchSurface() {
  const [expanded, setExpanded] = useState(false);
  const [snapshots, setSnapshots] = useState<readonly ServerProviderUsageSnapshot[]>([]);
  const collapseTimer = useRef<number | null>(null);
  const refreshInFlight = useRef(false);

  const refresh = async () => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    try {
      const next = await fetchAllProviderUsage({ forceRefresh: true });
      setSnapshots(next);
    } catch {
      // Keep the previous usable snapshot visible; the notch intentionally has no error chrome.
    } finally {
      refreshInFlight.current = false;
    }
  };

  useEffect(() => {
    void window.usageNotchBridge?.setPresentation(expanded ? "expanded" : "compact");
    if (!expanded) return;
    void refresh();
    const interval = window.setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [expanded]);

  useEffect(
    () => () => {
      if (collapseTimer.current !== null) window.clearTimeout(collapseTimer.current);
    },
    [],
  );

  const open = () => {
    if (collapseTimer.current !== null) window.clearTimeout(collapseTimer.current);
    setExpanded(true);
  };
  const close = () => {
    collapseTimer.current = window.setTimeout(() => setExpanded(false), COLLAPSE_DELAY_MS);
  };
  const providers = visibleSnapshots(snapshots);

  return (
    <main
      className={cn(
        "h-full w-full overflow-hidden bg-black text-white",
        expanded ? "rounded-b-[28px] shadow-[0_20px_50px_rgba(0,0,0,.42)]" : "rounded-b-[18px]",
      )}
      onMouseEnter={open}
      onMouseLeave={close}
      aria-label="Provider usage monitor"
    >
      <div className="h-8" aria-hidden />
      <div className={disclosureShellClassName(expanded, "px-5 pb-4")}>
        <div className="min-h-0 overflow-hidden">
          <section className={disclosureContentClassName(expanded, "pt-2")}>
            {providers.length === 0 ? (
              <p className="px-2 py-8 text-center text-xs text-white/55">
                No provider usage available.
              </p>
            ) : (
              <div className="grid max-h-[218px] grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
                {providers.map(({ snapshot, rows }) => (
                  <article
                    key={snapshot.provider}
                    className="rounded-2xl border border-white/10 bg-white/[0.055] px-3 py-2.5"
                  >
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-white/90">
                      <ProviderIcon provider={snapshot.provider} className="size-3.5" />
                      {providerUsageDisplayName(snapshot.provider)}
                    </div>
                    <div className="space-y-2">
                      {rows.map((row) => (
                        <div key={row.id} className="space-y-1">
                          <div className="flex justify-between gap-2 text-[10px] tabular-nums text-white/62">
                            <span className="font-medium text-white/82">{row.label}</span>
                            <span>{row.leftText}</span>
                          </div>
                          <div className="h-1 overflow-hidden rounded-full bg-white/12">
                            <div
                              className={cn(
                                "h-full rounded-full transition-[width] duration-220 ease-out motion-reduce:transition-none",
                                row.remainingTone === "healthy"
                                  ? "bg-emerald-400"
                                  : row.remainingTone === "warning"
                                    ? "bg-amber-400"
                                    : "bg-red-400",
                              )}
                              style={{ width: `${row.remainingPercent}%` }}
                            />
                          </div>
                          {row.resetText ? (
                            <div className="text-right text-[10px] tabular-nums text-white/45">
                              {row.resetText}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
