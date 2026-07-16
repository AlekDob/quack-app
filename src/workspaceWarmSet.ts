// Warm-LRU of recently-active workspaces. A "warm" workspace keeps its heavy
// UI (Monaco editors + sidebar) MOUNTED while hidden (shell is display:none),
// so switching back to it is instant — no Monaco widget recreation, no file-
// tree re-list. Capped so memory stays bounded: only the last WARM_LIMIT
// projects the user touched stay warm; older ones tear down as before.
//
// Tradeoff (decided with Alek): ~1-2 extra mounted Monaco instances in exchange
// for instant switching between the projects you actually bounce between. Lower
// WARM_LIMIT to trade snappiness back for memory.

const WARM_LIMIT = 3; // active + 2 most-recent kept warm

let order: string[] = []; // most-recently-active first
const listeners = new Set<() => void>();

/** Promote a workspace to most-recently-active; evicts past WARM_LIMIT. */
export function markWorkspaceActive(wsId: string): void {
  if (order[0] === wsId) return;
  order = [wsId, ...order.filter((id) => id !== wsId)].slice(0, WARM_LIMIT);
  for (const l of listeners) l();
}

/** True while the workspace is in the warm window (keep heavy UI mounted). */
export function isWorkspaceWarm(wsId: string): boolean {
  return order.includes(wsId);
}

export function subscribeWarmSet(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
