// Cursor-style chat scroll: pin the active user turn at the top of the
// viewport on send so the response streams into the space below.

export interface ChatTurnGroup {
  userIdx: number | null;
  followIdxs: number[];
}

/** Group flat messages into turns (user prompt + following assistant/tool msgs). */
export function groupChatTurns(
  display: ReadonlyArray<{ role: string }>,
): ChatTurnGroup[] {
  const turns: ChatTurnGroup[] = [];
  let current: ChatTurnGroup | null = null;
  for (let i = 0; i < display.length; i++) {
    if (display[i].role === "user") {
      if (current) turns.push(current);
      current = { userIdx: i, followIdxs: [] };
    } else {
      if (!current) current = { userIdx: null, followIdxs: [] };
      current.followIdxs.push(i);
    }
  }
  if (current) turns.push(current);
  return turns;
}

export interface WindowedTurns {
  /** Turns to render — the tail when windowed, all when expanded. Turn objects
   *  keep their ABSOLUTE `display` indices, so scrub/anchor lookups by index
   *  stay correct after slicing. */
  turns: ChatTurnGroup[];
  /** Turns hidden off the top (0 = everything shown). */
  hiddenCount: number;
}

/** Default tail size for long transcripts (see feature 080). */
export const TURN_WINDOW = 40;

/** Cap tool chips on a single legacy (no-blocks) message row. */
export const TOOL_ROW_CAP = 12;

/** Render only the last `limit` turns of a long transcript (unless `expanded`),
 *  so switching into a huge chat doesn't paint hundreds of turns at once and
 *  stall. The newest turns — where streaming and the pinned user turn live —
 *  are always in the window. */
export function windowChatTurns(
  turns: ChatTurnGroup[],
  limit: number,
  expanded: boolean,
): WindowedTurns {
  if (expanded || limit <= 0 || turns.length <= limit) {
    return { turns, hiddenCount: 0 };
  }
  const start = turns.length - limit;
  return { turns: turns.slice(start), hiddenCount: start };
}

export interface WindowedRows<T> {
  rows: T[];
  hiddenCount: number;
}

/** Cap a chronological tool-row list to the first `limit` items (legacy
 *  ToolCallRow lists grow top→bottom; early tools stay visible, rest behind
 *  "Show N more"). Same expand semantics as turn windowing. */
export function windowToolRows<T>(
  rows: T[],
  limit: number,
  expanded: boolean,
): WindowedRows<T> {
  if (expanded || limit <= 0 || rows.length <= limit) {
    return { rows, hiddenCount: 0 };
  }
  return {
    rows: rows.slice(0, limit),
    hiddenCount: rows.length - limit,
  };
}

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
