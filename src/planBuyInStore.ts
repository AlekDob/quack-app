// Pending ExitPlanMode buy-in — Cursor-style "Pass the ball to Milo" CTA.
// The permission overlay holds the CC decision; this store drives the
// in-stream card so the user never sees the generic tool-permission UI.
//
// Ownership is keyed by Quack chatId (never cwd). A cwd fallback once made
// every Agent Mode session in the same project show another chat's Plan
// ready card — see documentation/bugs/008-plan-buyin-cross-session.md.

export type PlanBuyIn = {
  requestId: string;
  plan: string;
  /** Quack AI chat id — primary ownership key. */
  chatId: string | null;
  /** Claude Code session id (decide / overlay routing). */
  sessionId: string | null;
  /** Workspace cwd (diagnostics only — not used for display lookup). */
  cwd: string | null;
};

const byKey = new Map<string, PlanBuyIn>();
const listeners = new Set<() => void>();

type DecideFn = (
  requestId: string,
  decision: "allow" | "deny",
) => Promise<void>;

/** Per-panel decide handlers — keyed by chat: / s:. */
const decides = new Map<string, DecideFn>();

function notify() {
  for (const l of listeners) l();
}

function chatKey(chatId: string): string {
  return `chat:${chatId}`;
}

function sessionKey(sessionId: string): string {
  return `s:${sessionId}`;
}

function keyOf(opts: {
  chatId?: string | null;
  sessionId?: string | null;
}): string | null {
  if (opts.chatId) return chatKey(opts.chatId);
  if (opts.sessionId) return sessionKey(opts.sessionId);
  return null;
}

/** Overlay registers how to settle ExitPlanMode for this panel. */
export function setPlanBuyInDecide(
  opts: { chatId?: string | null; sessionId?: string | null },
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
    entry.chatId ? chatKey(entry.chatId) : null,
    entry.sessionId ? sessionKey(entry.sessionId) : null,
  ];
  for (const k of keys) {
    if (k && decides.has(k)) return decides.get(k)!;
  }
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
    // Client-only buy-ins (ExitPlanMode failed / no hook) have no decide fn —
    // handoff still proceeds; ignore missing decide.
    await findDecide(entry)?.(requestId, decision);
  } finally {
    clearPlanBuyIn({ requestId });
  }
}

/** Overlay / stream publishes when ExitPlanMode lands with a non-empty plan. */
export function publishPlanBuyIn(entry: PlanBuyIn): void {
  const k = keyOf(entry) ?? `r:${entry.requestId}`;
  byKey.set(k, entry);
  // Dual-index by session when both ids exist so overlay decide + mid-turn
  // sid hydrate can find the same entry without a cwd scan.
  if (entry.chatId && entry.sessionId) {
    byKey.set(sessionKey(entry.sessionId), entry);
  }
  notify();
}

export function clearPlanBuyIn(opts: {
  chatId?: string | null;
  sessionId?: string | null;
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
  if (opts.sessionId) {
    if (byKey.delete(sessionKey(opts.sessionId))) changed = true;
  }
  if (changed) notify();
}

/**
 * Lookup for the Plan ready card / Plan tab. Strict: chatId first, then
 * sessionId. Never matches by cwd — that leaked across Agent Mode sessions.
 */
export function getPlanBuyIn(opts: {
  chatId?: string | null;
  sessionId?: string | null;
}): PlanBuyIn | null {
  if (opts.chatId) {
    const hit = byKey.get(chatKey(opts.chatId));
    if (hit) return hit;
    for (const v of byKey.values()) {
      if (v.chatId === opts.chatId) return v;
    }
  }
  if (opts.sessionId) {
    const hit = byKey.get(sessionKey(opts.sessionId));
    if (hit) return hit;
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

/** Test-only — wipe RAM store between cases. */
export function _resetPlanBuyInStoreForTests(): void {
  byKey.clear();
  decides.clear();
  notify();
}
