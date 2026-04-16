/**
 * sessionScrollMemory
 *
 * Lightweight module-level scroll memory per session. No store, no subscriptions,
 * no re-renders. Cleared on app reload.
 *
 * Rule:
 * - If the user was NOT at the bottom when leaving a session, restore scrollTop on return.
 * - If the user was at the bottom (or session was auto-scrolling), scroll to bottom on return.
 *
 * Brain: pattern-session-scroll-memory
 */

export interface SessionScrollState {
  scrollTop: number;
  wasAtBottom: boolean;
}

const scrollMemory = new Map<string, SessionScrollState>();

export function saveSessionScroll(sessionId: string, state: SessionScrollState): void {
  scrollMemory.set(sessionId, state);
}

export function getSessionScroll(sessionId: string): SessionScrollState | undefined {
  return scrollMemory.get(sessionId);
}

export function clearSessionScroll(sessionId: string): void {
  scrollMemory.delete(sessionId);
}
