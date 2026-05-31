/**
 * useTerminalReaper (WS8 leak guard)
 * ------------------------------------------------------------------
 * Safety net for orphaned embedded-CLI PTYs. The center of Quack is now an
 * interactive `claude` terminal (one PTY per session, keyed `agent-cli-<id>`).
 * Its lifetime is NOT inherently tied to the session record: before the delete
 * choke-point fix, deleting a session left the PTY — and its `claude` child —
 * running, slowly accumulating orphan processes ("1000 instances" risk).
 *
 * `sessionStore.deleteSession` now disposes the terminal directly, so this hook
 * is belt-and-suspenders: it periodically asks the backend (authoritative for
 * actual processes) which PTYs are alive and kills any `agent-cli-*` whose
 * session no longer exists in the store. The Rust REGISTRY is in-memory, so it
 * only ever lists PTYs from the current run — no cross-restart false positives.
 *
 * Safety: a freshly created session is added to the store BEFORE its terminal
 * renders, so a live PTY normally implies a live session. The only legitimate
 * "PTY without session" windows are right after a delete (transient) and the
 * sub-ms cold-boot gap before loadSessions runs. We guard both with an
 * ORPHAN_GRACE window (must stay orphaned across several ticks) and by skipping
 * ticks while the store is still loading.
 *
 * Brain: 069-embedded-cli-hooks-pivot
 */
import { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useSessionStore } from '../stores/sessionStore';
import { disposeAgentTerminal } from '../components/AgentTerminalView';

const PREFIX = 'agent-cli-';
const REAP_MS = 3000; // how often we scan for orphans
const ORPHAN_GRACE_MS = 8000; // must stay orphaned this long before we kill it

interface TerminalInfo {
  id: string;
}

export function useTerminalReaper(): void {
  useEffect(() => {
    // Per-session timestamp of the first consecutive orphan observation.
    const orphanSince = new Map<string, number>();

    const tick = async () => {
      const store = useSessionStore.getState();
      // Don't reap while sessions are (re)loading — the store list is unreliable.
      if (store.isLoading) return;

      const terminals = await invoke<TerminalInfo[]>('list_terminals').catch(
        () => [] as TerminalInfo[]
      );
      const now = Date.now();
      const liveSessionIds = new Set(store.sessions.map((s) => s.id));
      const seenOrphans = new Set<string>();

      for (const t of terminals) {
        if (!t.id.startsWith(PREFIX)) continue;
        const sessionId = t.id.slice(PREFIX.length);
        if (liveSessionIds.has(sessionId)) {
          orphanSince.delete(sessionId);
          continue;
        }
        seenOrphans.add(sessionId);
        const since = orphanSince.get(sessionId);
        if (since === undefined) {
          orphanSince.set(sessionId, now);
        } else if (now - since >= ORPHAN_GRACE_MS) {
          // Confirmed orphan: kill the PTY (+ `claude`) and forget it.
          disposeAgentTerminal(sessionId);
          orphanSince.delete(sessionId);
        }
      }

      // Forget orphans that vanished on their own (e.g. disposed elsewhere).
      for (const sessionId of orphanSince.keys()) {
        if (!seenOrphans.has(sessionId)) orphanSince.delete(sessionId);
      }
    };

    const interval = window.setInterval(() => void tick(), REAP_MS);
    return () => window.clearInterval(interval);
  }, []);
}
