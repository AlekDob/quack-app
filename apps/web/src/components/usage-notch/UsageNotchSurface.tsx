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

const COLLAPSE_DELAY_MS = 100;
const PANEL_FADE_MS = 180;
const REFRESH_INTERVAL_MS = 60_000;

function visibleSnapshots(snapshots: readonly ServerProviderUsageSnapshot[]) {
  return snapshots.flatMap((snapshot) => {
    if (snapshot.status !== undefined && snapshot.status !== "ok") return [];
    const normalized = normalizeServerProviderUsageRateLimit(snapshot);
    const rows = normalized ? deriveProviderUsageDisplayRows([normalized]) : [];
    return rows.length > 0 ? [{ snapshot, rows }] : [];
  });
}

function ProviderUsageSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
      {[0, 1].map((index) => (
        <div
          key={index}
          className="animate-pulse rounded-2xl border border-white/8 bg-white/[0.045] px-3 py-2.5 motion-reduce:animate-none"
        >
          <div className="mb-3 h-3.5 w-20 rounded-full bg-white/12" />
          <div className="space-y-2">
            <div className="h-2.5 w-full rounded-full bg-white/8" />
            <div className="h-1 w-full rounded-full bg-white/10" />
            <div className="ml-auto h-2.5 w-14 rounded-full bg-white/8" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function UsageNotchSurface() {
  const [expanded, setExpanded] = useState(false);
  const [snapshots, setSnapshots] = useState<readonly ServerProviderUsageSnapshot[]>([]);
  const [panelVisible, setPanelVisible] = useState(false);
  const [loadingInitialUsage, setLoadingInitialUsage] = useState(false);
  const collapseTimer = useRef<number | null>(null);
  const compactTimer = useRef<number | null>(null);
  const revealFrame = useRef<number | null>(null);
  const refreshInFlight = useRef(false);
  const hasLoadedUsage = useRef(false);

  const refresh = async () => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    const isInitialLoad = !hasLoadedUsage.current;
    if (isInitialLoad) setLoadingInitialUsage(true);
    try {
      const next = await fetchAllProviderUsage({ forceRefresh: true });
      setSnapshots(next);
      hasLoadedUsage.current = true;
    } catch {
      // Keep the previous usable snapshot visible; the notch intentionally has no error chrome.
    } finally {
      if (isInitialLoad) setLoadingInitialUsage(false);
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
      if (compactTimer.current !== null) window.clearTimeout(compactTimer.current);
      if (revealFrame.current !== null) window.cancelAnimationFrame(revealFrame.current);
    },
    [],
  );

  const open = () => {
    if (collapseTimer.current !== null) window.clearTimeout(collapseTimer.current);
    if (compactTimer.current !== null) window.clearTimeout(compactTimer.current);
    if (expanded) {
      setPanelVisible(true);
      return;
    }
    setPanelVisible(false);
    setExpanded(true);
    revealFrame.current = window.requestAnimationFrame(() => setPanelVisible(true));
  };
  const close = () => {
    collapseTimer.current = window.setTimeout(() => {
      setPanelVisible(false);
      compactTimer.current = window.setTimeout(() => setExpanded(false), PANEL_FADE_MS);
    }, COLLAPSE_DELAY_MS);
  };
  const providers = visibleSnapshots(snapshots);
  const panelOpen = expanded && panelVisible;

  return (
    <main
      className="relative h-full w-full overflow-hidden text-white"
      onMouseEnter={open}
      onMouseLeave={close}
      aria-label="Provider usage monitor"
    >
      <div
        className={cn(
          "absolute inset-x-0 top-0 flex size-10 items-center justify-center rounded-full bg-black shadow-[0_8px_20px_rgba(0,0,0,.32)] transition-[opacity,transform] duration-180 [transition-timing-function:cubic-bezier(.23,1,.32,1)] motion-reduce:transition-none",
          expanded ? "pointer-events-none scale-95 opacity-0" : "scale-100 opacity-100",
        )}
      />
      <div
        className={cn(
          "absolute inset-0 rounded-b-[28px] bg-black shadow-[0_20px_50px_rgba(0,0,0,.42)] transition-[opacity,filter] duration-180 [transition-timing-function:cubic-bezier(.23,1,.32,1)] motion-reduce:transition-none",
          panelOpen ? "opacity-100 blur-0" : "pointer-events-none opacity-0 blur-[1px]",
        )}
      >
        <div className="h-8" aria-hidden />
        <div className={disclosureShellClassName(expanded, "px-5 pb-4")}>
          <div className="min-h-0 overflow-hidden">
            <section
              className={disclosureContentClassName(expanded, "pt-2")}
              aria-busy={loadingInitialUsage}
            >
              {loadingInitialUsage ? (
                <ProviderUsageSkeleton />
              ) : providers.length === 0 ? (
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
                        <ProviderIcon provider={snapshot.provider} className="size-3.5 text-white/90" />
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
      </div>
    </main>
  );
}
