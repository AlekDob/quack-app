// Cursor-style chat scroll: pin the active user turn at the top of the
// viewport on send so the response streams into the space below.

const NEAR_BOTTOM_PX = 60;
const PIN_TOP_GAP_PX = 8;

export function isNearBottom(
  scroller: HTMLElement,
  threshold = NEAR_BOTTOM_PX,
): boolean {
  const remaining =
    scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
  return remaining < threshold;
}

export function scrollToBottom(scroller: HTMLElement): void {
  scroller.scrollTop = scroller.scrollHeight;
}

function lastUserTurnEl(scroller: HTMLElement): HTMLElement | null {
  const els = scroller.querySelectorAll<HTMLElement>(
    '[data-anchor-role="user"]',
  );
  return els.length > 0 ? els[els.length - 1] : null;
}

/** Pin the latest user turn to the top of the scroll viewport. */
export function pinUserTurnToTop(scroller: HTMLElement): boolean {
  const el = lastUserTurnEl(scroller);
  if (!el) return false;
  // offsetTop is reliable here: .ai-messages is position:relative (nav rail).
  scroller.scrollTop = Math.max(0, el.offsetTop - PIN_TOP_GAP_PX);
  return true;
}
