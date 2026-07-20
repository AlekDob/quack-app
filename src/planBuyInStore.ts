// Pending ExitPlanMode buy-in — Cursor-style "Pass the ball to Milo" CTA.
// The permission overlay holds the CC decision; this store drives the
// in-stream card so the user never sees the generic tool-permission UI.

export type PlanBuyIn = {
  requestId: string;
  plan: string;
  /** Claude Code session id (route to the owning chat panel). */
  sessionId: string | null;
  /** Workspace cwd for panel matching when session id is missing. */
  cwd: string | null;
};

const byKey = new Map<string, PlanBuyIn>();
const listeners = new Set<() => void>();

type DecideFn = (
  requestId: string,
  decision: "allow" | "deny",
) => Promise<void>;

/** Per-panel decide handlers — keyed like buy-in entries (s: / c:). */
const decides = new Map<string, DecideFn>();

function notify() {
  for (const l of listeners) l();
}

function keyOf(opts: {
  sessionId?: string | null;
  cwd?: string | null;
}): string | null {
  if (opts.sessionId) return `s:${opts.sessionId}`;
  if (opts.cwd) return `c:${opts.cwd.replace(/[\\/]+$/, "")}`;
  return null;
}

function normCwd(p: string | null | undefined): string | null {
  return p ? p.replace(/[\\/]+$/, "") : null;
}

/** Overlay registers how to settle ExitPlanMode for this panel. */
export function setPlanBuyInDecide(
  opts: { sessionId?: string | null; cwd?: string | null },
  fn: DecideFn | null,
): void {
  const k = keyOf(opts);
  if (!k) return;
  if (fn) decides.set(k, fn);
  else decides.delete(k);
}

function findDecide(entry: PlanBuyIn | null): DecideFn | null {
  if (!entry) return null;
  const keys = [
    entry.sessionId ? `s:${entry.sessionId}` : null,
    entry.cwd ? `c:${normCwd(entry.cwd)}` : null,
  ];
  for (const k of keys) {
    if (k && decides.has(k)) return decides.get(k)!;
  }
  // Last resort: any registered decide (single-panel common case).
  for (const fn of decides.values()) return fn;
  return null;
}

export async function resolvePlanBuyIn(
  requestId: string,
  decision: "allow" | "deny",
): Promise<void> {
  let entry: PlanBuyIn | null = null;
  for (const v of byKey.values()) {
    if (v.requestId === requestId) {
      entry = v;
      break;
    }
  }
  try {
    await findDecide(entry)?.(requestId, decision);
  } finally {
    clearPlanBuyIn({ requestId });
  }
}

/** Overlay publishes when ExitPlanMode lands with a non-empty plan. */
export function publishPlanBuyIn(entry: PlanBuyIn): void {
  const k = keyOf(entry) ?? `r:${entry.requestId}`;
  byKey.set(k, entry);
  notify();
}

export function clearPlanBuyIn(opts: {
  sessionId?: string | null;
  cwd?: string | null;
  requestId?: string;
}): void {
  let changed = false;
  if (opts.requestId) {
    for (const [k, v] of byKey) {
      if (v.requestId === opts.requestId) {
        byKey.delete(k);
        changed = true;
      }
    }
  }
  const k = keyOf(opts);
  if (k && byKey.delete(k)) changed = true;
  if (changed) notify();
}

export function getPlanBuyIn(opts: {
  sessionId?: string | null;
  cwd?: string | null;
}): PlanBuyIn | null {
  const k = keyOf(opts);
  if (k) {
    const hit = byKey.get(k);
    if (hit) return hit;
  }
  if (opts.sessionId) {
    for (const v of byKey.values()) {
      if (v.sessionId === opts.sessionId) return v;
    }
  }
  return null;
}

export function subscribePlanBuyIn(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
