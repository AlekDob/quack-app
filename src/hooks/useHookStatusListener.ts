/**
 * useHookStatusListener (WS-pivot: embedded CLI)
 * ------------------------------------------------------------------
 * Standalone Tauri listener that drives session status from Claude Code
 * HOOKS instead of the Agent SDK event stream. The Rust `/hooks/status`
 * route (legacy_router) re-emits each ping from `quack-status.js` as a
 * `hook-status` Tauri event; here we map it onto the SAME chatStore maps
 * the sidebar (043) + Task Hub (054) already read — so the preserved UI
 * lights up with ZERO component edits.
 *
 * Single-writer invariant: writes ONLY when `useEmbeddedCLI` is enabled.
 * When off, the SDK feed stays authoritative and these events are ignored
 * (no double-writes / races on the same keys).
 *
 * Mapping:
 *   UserPromptSubmit          → setLoading(true),  clear "waiting"
 *   Stop                      → setLoading(false), clear "waiting"  (Agent done)
 *   Notification / PermissionRequest → setPendingQuestion("hook:waiting", true)  (Needs attention)
 *
 * Safety net: idle-expiry clears a session stuck on "working" after no
 * hook activity for IDLE_MS (a missed/timed-out Stop hook).
 *
 * Brain: 069-embedded-cli-hooks-pivot
 */
import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { useChatStore } from '../stores/chatStore';

interface HookStatusEvent {
  quack_session_id: string | null;
  session_id: string | null;
  hook_event_name: string;
  notification_type: string | null;
  cwd: string | null;
  transcript_path: string | null;
  ts: number;
}

// Synthetic pending-question id for the "needs attention" (waiting) state.
// pendingQuestionsMap is a Set, so a single stable id is enough to surface
// the P1 badge; cleared when the user submits or the turn stops.
const WAITING_ID = 'hook:waiting';

const IDLE_MS = 5 * 60 * 1000; // 5 min with no hook activity → force-clear
const SWEEP_MS = 60 * 1000;    // idle-expiry sweep cadence

export function useHookStatusListener(): void {
  useEffect(() => {
    // Per-session last-activity timestamps for idle-expiry reconciliation.
    const lastActivity = new Map<string, number>();

    const apply = (evt: HookStatusEvent) => {
      const key = evt.quack_session_id || evt.session_id;
      if (!key) return;

      const store = useChatStore.getState();
      lastActivity.set(key, evt.ts || Date.now());

      switch (evt.hook_event_name) {
        case 'UserPromptSubmit': {
          store.setPendingQuestion(key, WAITING_ID, false);
          store.setLoading(key, true);
          // Embedded mode: the user types in the xterm PTY, never through
          // chatStore — so chatSessions has no `user` message and the sidebar
          // (AgentSessionItem) treats the session as DORMANT, which blocks the
          // green "ready" dot forever (isAgentReady requires !isDormant). Drop a
          // contentless `user` marker so the turn is no longer dormant; the
          // matching assistant marker is added on Stop. Chat UI is hidden in
          // embedded mode, so empty content is invisible.
          const msgs = store.getSession(key);
          const last = msgs[msgs.length - 1];
          const turnAlreadyOpen = last && last.role === 'user';
          if (!turnAlreadyOpen) {
            store.addMessage(key, {
              id: `hook-user-${evt.ts || Date.now()}`,
              role: 'user',
              content: '',
              timestamp: evt.ts || Date.now(),
              status: 'complete',
            });
          }
          break;
        }
        case 'Stop':
        case 'StopFailure': {
          store.setPendingQuestion(key, WAITING_ID, false);
          store.setLoading(key, false);
          // Mark "agent done" so the sidebar/Task Hub dot turns GREEN (ready / P3).
          // The dot logic keys off a trailing complete assistant message; hooks
          // carry no content, so we drop a contentless marker (chat UI is hidden
          // in embedded mode). Real last-message/tokens come from the transcript
          // backfill in Fase 4.
          const msgs = store.getSession(key);
          const last = msgs[msgs.length - 1];
          const alreadyDone =
            last && last.role === 'assistant' && (last.status === 'complete' || last.status === undefined);
          if (!alreadyDone) {
            store.addMessage(key, {
              id: `hook-done-${evt.ts || Date.now()}`,
              role: 'assistant',
              content: '',
              timestamp: evt.ts || Date.now(),
              status: 'complete',
            });
          }
          // Fase 4: embedded mode has no SDK token stream → backfill the stamina
          // bar from the transcript tail. Bridge to App.tsx's handleTokenUpdate
          // (which owns the token map) via a window event, since this hook can't
          // reach App.tsx local state. Best-effort: silent on failure → UI N/A.
          if (evt.transcript_path) {
            invoke<{
              usage: {
                input_tokens: number;
                output_tokens: number;
                cache_creation_input_tokens: number;
                cache_read_input_tokens: number;
              };
              last_text: string | null;
              total_cost_usd: number | null;
            }>('parse_transcript_tail', { path: evt.transcript_path })
              .then((tail) => {
                if (!tail) return;
                window.dispatchEvent(
                  new CustomEvent('quack:transcript-usage', {
                    detail: {
                      sessionKey: key,
                      usage: tail.usage,
                      lastText: tail.last_text,
                      cost: tail.total_cost_usd ?? undefined,
                    },
                  })
                );
              })
              .catch(() => {});
          }
          break;
        }
        case 'Notification':
        case 'PermissionRequest':
          // Agent is blocked waiting for the user → P1 "Needs attention".
          store.setPendingQuestion(key, WAITING_ID, true);
          break;
        default:
          break;
      }
    };

    let unlisten: (() => void) | undefined;
    listen<HookStatusEvent>('hook-status', (event) => apply(event.payload)).then(
      (fn) => {
        unlisten = fn;
      }
    );

    // Idle-expiry: a session "working" with no hook for IDLE_MS likely missed
    // its Stop hook (script timeout / crash). Clear it so it doesn't hang.
    const sweep = window.setInterval(() => {
      const now = Date.now();
      const store = useChatStore.getState();
      for (const [key, ts] of lastActivity) {
        if (now - ts <= IDLE_MS) continue;
        if (store.chatLoadingMap.get(key)) {
          store.setLoading(key, false);
          store.setPendingQuestion(key, WAITING_ID, false);
        }
        lastActivity.delete(key);
      }
    }, SWEEP_MS);

    return () => {
      if (unlisten) unlisten();
      window.clearInterval(sweep);
    };
  }, []);
}
