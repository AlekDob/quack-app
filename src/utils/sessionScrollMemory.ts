/**
 * sessionScrollMemory
 *
 * Lightweight module-level anchor memory per session. No store, no subscriptions,
 * no re-renders. Cleared on app reload.
 *
 * Behavior:
 * - On session open: if an anchor exists, scroll to that message. Otherwise,
 *   always scroll to bottom.
 * - Anchor is opt-in: user clicks the anchor icon on the scrollbar rail to set
 *   it at the message currently centered in the viewport. Hovering the anchored
 *   icon reveals an "X" that removes the anchor.
 *
 * Brain: pattern-session-scroll-memory
 */

export interface SessionAnchorState {
  messageId: string;
}

const anchorMemory = new Map<string, SessionAnchorState>();

export function setSessionAnchor(sessionId: string, messageId: string): void {
  anchorMemory.set(sessionId, { messageId });
}

export function getSessionAnchor(sessionId: string): SessionAnchorState | undefined {
  return anchorMemory.get(sessionId);
}

export function clearSessionAnchor(sessionId: string): void {
  anchorMemory.delete(sessionId);
}
