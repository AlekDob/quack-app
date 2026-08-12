// Purpose: shared "the user just hit send" flags, set synchronously before the
// send preflight (provider status refresh, worktree creation, thread.create)
// runs. The composer and the sidebar thread row both read them so a loader shows
// instantly instead of waiting for the server to acknowledge the turn.
import { type ThreadId } from "@synara/contracts";
import { create } from "zustand";

type ThreadIdFlags = Record<ThreadId, true | undefined>;

function withFlag(flags: ThreadIdFlags, threadId: ThreadId): ThreadIdFlags | null {
  return flags[threadId] ? null : { ...flags, [threadId]: true };
}

function withoutFlag(flags: ThreadIdFlags, threadId: ThreadId): ThreadIdFlags | null {
  if (!flags[threadId]) return null;
  const next = { ...flags };
  delete next[threadId];
  return next;
}

interface PendingSendStoreState {
  pendingSendThreadIds: ThreadIdFlags;
  /**
   * Threads with a dispatched send the server has not acknowledged yet.
   *
   * The thread-detail catch-up poll reads this. Without it the poll only runs
   * for threads the client already believes are running, so a client whose
   * event stream silently died keeps believing the thread is idle, never polls,
   * and leaves the composer spinner up until some unrelated snapshot arrives.
   */
  unacknowledgedSendThreadIds: ThreadIdFlags;
  markPendingSend: (threadId: ThreadId) => void;
  clearPendingSend: (threadId: ThreadId) => void;
  markUnacknowledgedSend: (threadId: ThreadId) => void;
  clearUnacknowledgedSend: (threadId: ThreadId) => void;
}

export const usePendingSendStore = create<PendingSendStoreState>((set) => ({
  pendingSendThreadIds: {},
  unacknowledgedSendThreadIds: {},
  markPendingSend: (threadId) => {
    if (threadId.length === 0) return;
    set((state) => {
      const next = withFlag(state.pendingSendThreadIds, threadId);
      return next ? { pendingSendThreadIds: next } : state;
    });
  },
  clearPendingSend: (threadId) => {
    if (threadId.length === 0) return;
    set((state) => {
      const next = withoutFlag(state.pendingSendThreadIds, threadId);
      return next ? { pendingSendThreadIds: next } : state;
    });
  },
  markUnacknowledgedSend: (threadId) => {
    if (threadId.length === 0) return;
    set((state) => {
      const next = withFlag(state.unacknowledgedSendThreadIds, threadId);
      return next ? { unacknowledgedSendThreadIds: next } : state;
    });
  },
  clearUnacknowledgedSend: (threadId) => {
    if (threadId.length === 0) return;
    set((state) => {
      const next = withoutFlag(state.unacknowledgedSendThreadIds, threadId);
      return next ? { unacknowledgedSendThreadIds: next } : state;
    });
  },
}));

/** Read once outside React (catch-up polling runs in a plain interval). */
export function hasUnacknowledgedSend(threadId: ThreadId): boolean {
  return usePendingSendStore.getState().unacknowledgedSendThreadIds[threadId] === true;
}
