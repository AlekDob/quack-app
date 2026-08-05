// Purpose: shared "the user just hit send" flag, set synchronously before the
// send preflight (provider status refresh, worktree creation, thread.create)
// runs. The composer and the sidebar thread row both read it so a loader shows
// instantly instead of waiting for the server to acknowledge the turn.
import { type ThreadId } from "@synara/contracts";
import { create } from "zustand";

interface PendingSendStoreState {
  pendingSendThreadIds: Record<ThreadId, true | undefined>;
  markPendingSend: (threadId: ThreadId) => void;
  clearPendingSend: (threadId: ThreadId) => void;
}

export const usePendingSendStore = create<PendingSendStoreState>((set) => ({
  pendingSendThreadIds: {},
  markPendingSend: (threadId) => {
    if (threadId.length === 0) return;
    set((state) =>
      state.pendingSendThreadIds[threadId]
        ? state
        : { pendingSendThreadIds: { ...state.pendingSendThreadIds, [threadId]: true } },
    );
  },
  clearPendingSend: (threadId) => {
    if (threadId.length === 0) return;
    set((state) => {
      if (!state.pendingSendThreadIds[threadId]) return state;
      const next = { ...state.pendingSendThreadIds };
      delete next[threadId];
      return { pendingSendThreadIds: next };
    });
  },
}));
