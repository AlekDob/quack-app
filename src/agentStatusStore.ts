// Global agent-status store — the single source of truth for the live
// run-state of every AI chat, surfaced by the cross-project Agent Hub
// (src/components/AIChatsRail.tsx). Module-level pub/sub (cloned from
// aiTaskStore.ts), NOT Zustand: this is transient UI state, not persisted
// workspace state.
//
// WHY a store the panels don't own: the hub must show status for chats
// whose AIChatPanel is NOT mounted (mount-asymmetry gotcha — only the
// active workspace's / active session's panel mounts). So a single global
// watcher (AgentHubWatcher) derives status from app-wide signals (the
// backend's active-session list + the global claude:permission-request
// event) and writes it here; the panels stay out of it.

export type LiveStatus = "working" | "needs-input" | "ready" | "error";

export interface AgentLiveRecord {
  chatId: string;
  wsId: string;
  derived: LiveStatus;
  /** Only set when derived === "needs-input". */
  needsInputKind?: "permission" | "question";
  /** When this live state was entered — used for group sort + expiry. */
  lastTransitionAt: number;
}

// Manual lifecycle a user sets via the hub's right-click menu. Derived
// from the persisted AIChatDescriptor (doneAt/archivedAt), passed into
// resolveDisplayStatus — kept here only as the type the UI reasons about.
export type Lifecycle = "active" | "done" | "archived";

export type DisplayStatus =
  | "needs-input"
  | "working"
  | "ready"
  | "idle"
  | "done"
  | "error"
  | "archived";

const liveByChat = new Map<string, AgentLiveRecord>();
const seen = new Set<string>();
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

/** Watcher writes the derived live status for a chat. Pass null to clear.
 *  A fresh ready / needs-input(question) record also marks the chat
 *  UNSEEN so it re-surfaces for the user. */
export function publishAgentStatus(
  chatId: string,
  rec: AgentLiveRecord | null,
): void {
  if (rec) {
    liveByChat.set(chatId, rec);
    if (rec.derived === "ready" || rec.derived === "needs-input") {
      seen.delete(chatId);
    }
  } else {
    liveByChat.delete(chatId);
  }
  notify();
}

/** Drop a chat's live status entirely (e.g. chat closed). */
export function clearAgentStatus(chatId: string): void {
  let changed = liveByChat.delete(chatId);
  changed = seen.delete(chatId) || changed;
  if (changed) notify();
}

export function getAgentStatus(chatId: string): AgentLiveRecord | null {
  return liveByChat.get(chatId) ?? null;
}

export function getAllAgentStatus(): ReadonlyMap<string, AgentLiveRecord> {
  return liveByChat;
}

export function subscribeAgentStatus(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

// "Seen" — the user has looked at this chat since its last ready /
// question. Clears the attention states (ready, needs-input question) so
// they drop to idle. Ephemeral by design: a restart re-surfacing a chat
// as ready is acceptable (mirrors notify.ts history non-persistence).
export function markSeen(chatId: string): void {
  if (seen.has(chatId)) return;
  seen.add(chatId);
  notify();
}

export function isSeen(chatId: string): boolean {
  return seen.has(chatId);
}

/**
 * Combine the three inputs into the final status the hub renders.
 * Priority (top wins): archived → error → needs-input → working → done →
 * ready. "ready" is the resting state — a chat that isn't actively running
 * or blocked is ready for the user (we don't show a separate "idle"). A
 * pending permission/question (needs-input) overrides a manual "done".
 */
export function resolveDisplayStatus(args: {
  lifecycle: Lifecycle;
  live: AgentLiveRecord | null;
  seen: boolean;
}): DisplayStatus {
  const { lifecycle, live, seen: isSeenFlag } = args;
  if (lifecycle === "archived") return "archived";
  if (live?.derived === "error") return "error";
  if (live?.derived === "needs-input" && !isSeenFlag) return "needs-input";
  if (live?.derived === "working") return "working";
  if (lifecycle === "done") return "done";
  return "ready";
}
