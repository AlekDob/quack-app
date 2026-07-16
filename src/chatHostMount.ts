/**
 * Chat host mount policy: only the visible chat + hidden runs that are
 * actually streaming / waiting on input stay mounted. Idle live tabs and
 * DONE/archived unload to keep New chat and switches fast.
 */

import { useEffect, useState } from "react";
import {
  getAgentStatus,
  subscribeAgentStatus,
  type LiveStatus,
} from "./agentStatusStore";

export function shouldKeepChatHostMounted(opts: {
  visible: boolean;
  doneAt?: number;
  archivedAt?: number;
  liveStatus?: LiveStatus | null;
  /** Live chat tab still open in the layout — keep mounted for fast tab switch. */
  tabOpen?: boolean;
}): boolean {
  if (opts.visible) return true;
  if (opts.doneAt || opts.archivedAt) return false;
  const live = opts.liveStatus;
  if (live === "working" || live === "needs-input") return true;
  if (opts.tabOpen) return true;
  return false;
}

/** Re-render hosts when a background chat starts or stops a run. */
export function useChatHostLiveStatus(chatId: string): LiveStatus | null {
  const [, tick] = useState(0);
  useEffect(() => subscribeAgentStatus(() => tick((t) => t + 1)), []);
  return getAgentStatus(chatId)?.derived ?? null;
}
