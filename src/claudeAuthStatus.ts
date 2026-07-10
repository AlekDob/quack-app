import { invoke } from "@tauri-apps/api/core";

export type ClaudeAuthStatus = "signed_in" | "signed_out" | "needs_login";

export interface ClaudeAuthProbe {
  status: ClaudeAuthStatus;
  reason?: string | null;
  subscriptionType?: string | null;
}

const CACHE_TTL_MS = 30_000;
let cache: { value: ClaudeAuthProbe; checkedAt: number } | null = null;
const listeners = new Set<(probe: ClaudeAuthProbe) => void>();

function notifyListeners(probe: ClaudeAuthProbe): void {
  listeners.forEach((fn) => fn(probe));
}

export function subscribeClaudeAuth(
  listener: (probe: ClaudeAuthProbe) => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function parseProbe(raw: unknown): ClaudeAuthProbe {
  const o = raw as Record<string, unknown>;
  const status = o.status;
  if (
    status !== "signed_in" &&
    status !== "signed_out" &&
    status !== "needs_login"
  ) {
    return { status: "signed_out", reason: "unknown" };
  }
  return {
    status,
    reason: typeof o.reason === "string" ? o.reason : null,
    subscriptionType:
      typeof o.subscriptionType === "string" ? o.subscriptionType : null,
  };
}

export function invalidateClaudeAuthCache(): void {
  cache = null;
}

export async function probeClaudeAuth(
  force = false,
): Promise<ClaudeAuthProbe> {
  if (
    !force &&
    cache &&
    Date.now() - cache.checkedAt < CACHE_TTL_MS
  ) {
    return cache.value;
  }
  try {
    const raw = await invoke<unknown>("claude_auth_status");
    const value = parseProbe(raw);
    cache = { value, checkedAt: Date.now() };
    return value;
  } catch {
    const value: ClaudeAuthProbe = {
      status: "signed_out",
      reason: "probe_failed",
    };
    cache = { value, checkedAt: Date.now() };
    return value;
  }
}

export function scheduleClaudeAuthRecheck(
  delaysMs: number[] = [5_000, 15_000, 30_000],
): () => void {
  const timers = delaysMs.map((ms) =>
    window.setTimeout(() => {
      void probeClaudeAuth(true).then((probe) => notifyListeners(probe));
    }, ms),
  );
  return () => timers.forEach((t) => window.clearTimeout(t));
}
