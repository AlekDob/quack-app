/**
 * useScreenStateArbitration (the herdr method)
 * ------------------------------------------------------------------
 * Periodically reads each live agent terminal's rendered screen and derives
 * the agent's activity state from it, then writes it into chatStore. This is
 * the GROUND TRUTH layer: hooks (useHookStatusListener) give instant feedback
 * but are lossy (missed Stop, out-of-order delivery, no event for plan/question
 * prompts) — the screen scan corrects them within one tick.
 *
 * Mirrors herdr's screen→hook arbitration (src/terminal/state.rs): a visible
 * blocker/working/idle screen overrides a stale store state. We keep it simple
 * and let the screen be authoritative, debouncing only `idle` (a brief idle
 * frame can appear between tool steps) so we don't flip to "done" mid-turn.
 *
 * `unknown` (claude not the foreground program, or no screen yet) defers to the
 * hooks — we never clobber state when we can't see the agent.
 *
 * Brain: 069-embedded-cli-hooks-pivot
 */
import { useEffect } from 'react';
import {
  listAgentTerminalSessionIds,
  readAgentTerminalScreen,
} from '../components/AgentTerminalView';
import { detectClaudeScreenState } from '../utils/agentScreenDetect';
import { markBlocked, markDone, markReleased, markWorking } from '../utils/sessionStatusWrites';

const SCAN_MS = 700; // screen poll cadence
const IDLE_GRACE_MS = 1500; // idle must persist this long before we commit "done"

export function useScreenStateArbitration(): void {
  useEffect(() => {
    // Per-session timestamp of the first consecutive idle observation.
    const idleSince = new Map<string, number>();

    const tick = () => {
      const now = Date.now();
      const live = new Set<string>();

      for (const sessionId of listAgentTerminalSessionIds()) {
        live.add(sessionId);
        const screen = readAgentTerminalScreen(sessionId);
        if (screen === null) continue;

        switch (detectClaudeScreenState(screen)) {
          case 'blocked':
            idleSince.delete(sessionId);
            markBlocked(sessionId);
            break;
          case 'working':
            idleSince.delete(sessionId);
            markWorking(sessionId);
            break;
          case 'idle': {
            // Debounce: a transient idle frame between tool steps must not flip
            // the dot to "done". Commit only after IDLE_GRACE_MS of steady idle.
            const since = idleSince.get(sessionId);
            if (since === undefined) {
              idleSince.set(sessionId, now);
            } else if (now - since >= IDLE_GRACE_MS) {
              markDone(sessionId);
            }
            break;
          }
          case 'unknown':
            // Can't see the agent → defer to hooks, don't touch state.
            break;
        }
      }

      // A terminal that disappeared (session/tab closed) → release + forget.
      for (const sessionId of idleSince.keys()) {
        if (!live.has(sessionId)) {
          markReleased(sessionId);
          idleSince.delete(sessionId);
        }
      }
    };

    const interval = window.setInterval(tick, SCAN_MS);
    return () => window.clearInterval(interval);
  }, []);
}
