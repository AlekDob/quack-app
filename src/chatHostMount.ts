/**
 * Chat host mount policy: only the visible chat + hidden runs that are
 * actually streaming / waiting on input stay mounted. Idle live tabs and
 * DONE/archived unload to keep New chat and switches fast.
 *
 * Sticky live hosts also survive **cross-project** switch (Agent Mode mounts
 * working chats from every open workspace; IDE drops the `isActive` gate for
 * sticky only) — see bug `007` / feature `043`.
 */

import { useSyncExternalStore } from "react";
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

/**
 * Re-render a host when ITS OWN background chat starts or stops a run.
 *
 * `agentStatusStore.notify()` is unkeyed — it wakes every subscriber on any
 * chat's transition. Every mounted AIChatHost calls this hook, so with many
 * live chats (Agent Mode keeps them all mounted) a plain tick re-rendered
 * ALL hosts on ANY status change. useSyncExternalStore compares the snapshot
 * (this chat's derived status) and bails out when it is unchanged, so a host
 * re-renders only when its own chat transitions — the store stays untouched.
 */
export function useChatHostLiveStatus(chatId: string): LiveStatus | null {
  return useSyncExternalStore(
    subscribeAgentStatus,
    () => getAgentStatus(chatId)?.derived ?? null,
  );
}
