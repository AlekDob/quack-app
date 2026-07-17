/** Full-screen branded loader for COLD project switches.
 *
 * Switching into a project that isn't "warm" (workspaceWarmSet) pays a cold
 * mount — Monaco widget creation + file-tree list_dir — which reads as a lag.
 * This masks it with a graceful full-window wash in the project's own color
 * (WorkspaceSwitchVeil), so the switch feels intentional instead of janky.
 *
 * Perceived-performance only (no work is blocked). Timing mirrors chatSwitch.ts:
 *  - a SHOW_DELAY grace so fast cold switches don't flash a loader,
 *  - a MIN_VISIBLE floor so once shown it doesn't blink out,
 *  - a CAP fallback in case "editors ready" never signals.
 * Warm switches never call begin, so they stay instant with nothing shown.
 */

const SHOW_DELAY_MS = 90; // reveal only if the mount is actually slow
const MIN_VISIBLE_MS = 320; // once revealed, keep it briefly
const CAP_MS = 2500; // safety: drop even if the end signal is missed

let targetWsId: string | null = null;
let visible = false;
let revealedAt = 0;
let showTimer: ReturnType<typeof setTimeout> | null = null;
let endTimer: ReturnType<typeof setTimeout> | null = null;
let capTimer: ReturnType<typeof setTimeout> | null = null;
const subs = new Set<() => void>();

function notify(): void {
  subs.forEach((fn) => fn());
}

function clearTimers(): void {
  if (showTimer) clearTimeout(showTimer);
  if (endTimer) clearTimeout(endTimer);
  if (capTimer) clearTimeout(capTimer);
  showTimer = endTimer = capTimer = null;
}

function finish(): void {
  clearTimers();
  targetWsId = null;
  visible = false;
  revealedAt = 0;
  notify();
}

/** Start masking a cold switch into `wsId`. Call ONLY for cold projects. */
export function beginWorkspaceLoad(wsId: string): void {
  clearTimers();
  targetWsId = wsId;
  visible = false;
  showTimer = setTimeout(() => {
    if (targetWsId !== wsId) return;
    visible = true;
    revealedAt = performance.now();
    notify();
  }, SHOW_DELAY_MS);
  capTimer = setTimeout(() => endWorkspaceLoad(wsId), CAP_MS);
  notify();
}

/** The incoming project's editors are ready — fade the veil out. */
export function endWorkspaceLoad(wsId: string): void {
  if (targetWsId !== wsId) return;
  if (!visible) {
    // Never revealed (fast cold switch) — drop immediately, no flash.
    finish();
    return;
  }
  const remaining = MIN_VISIBLE_MS - (performance.now() - revealedAt);
  if (endTimer) clearTimeout(endTimer);
  endTimer = setTimeout(finish, Math.max(0, remaining));
}

export function getWorkspaceLoad(): { wsId: string | null; visible: boolean } {
  return { wsId: targetWsId, visible };
}

export function subscribeWorkspaceLoad(cb: () => void): () => void {
  subs.add(cb);
  return () => {
    subs.delete(cb);
  };
}
