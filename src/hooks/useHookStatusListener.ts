/**
 * useHookStatusListener (WS-pivot: embedded CLI)
 * ------------------------------------------------------------------
 * Maps Claude Code HOOKS onto the chatStore activity maps that the sidebar
 * (043) + Task Hub (054) read. The Rust `/hooks/status` route re-emits each
 * ping from `quack-status.js` as a `hook-status` Tauri event.
 *
 * Hooks are the INSTANT (0-latency) status source, but they are lossy: a Stop
 * can be dropped, events arrive out of order, and no hook fires for plan /
 * AskUserQuestion prompts. So they are paired with useScreenStateArbitration,
 * which reads the terminal screen as ground truth and corrects this within ~1s
 * (the herdr method). Both write through sessionStatusWrites so they agree.
 *
 * Mapping (mirrors herdr's claude integration, src/integration/mod.rs, plus a
 * targeted PreToolUse for the tools the screen scan can't disambiguate):
 *   UserPromptSubmit                          → working   (yellow)
 *   PermissionRequest                         → blocked   (purple — permission-gated prompts)
 *   PreToolUse(ExitPlanMode|AskUserQuestion)  → blocked   (purple — plan/question, no false menus)
 *   PostToolUse(ExitPlanMode|AskUserQuestion) → working   (resumed after answer)
 *   Stop / StopFailure                        → done      (green) + token backfill
 *   SessionStart / SessionEnd                 → released  (idle baseline / agent gone)
 * (Notification is intentionally NOT mapped: noisy in interactive mode. Working
 *  sustain + idle/done come from the screen scan, not from hooks.)
 *
 * Also persists Claude's session id (for `--resume`) and mirrors Claude's
 * session name (first user message) into the Quack session title on Stop.
 *
 * Brain: 069-embedded-cli-hooks-pivot
 */
import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { markBlocked, markDone, markReleased, markWorking } from '../utils/sessionStatusWrites';
import { useSessionStore } from '../stores/sessionStore';

interface HookStatusEvent {
  quack_session_id: string | null;
  session_id: string | null;
  hook_event_name: string;
  tool_name: string | null;
  notification_type: string | null;
  cwd: string | null;
  transcript_path: string | null;
  ts: number;
}

// Tools whose PreToolUse means "blocked on a user decision". These render as a
// generic selection box the screen scan can't disambiguate from a slash menu,
// so the hook is the precise signal (AskUserQuestion fires no PermissionRequest).
const BLOCKING_TOOLS = new Set(['ExitPlanMode', 'AskUserQuestion']);

/** Fase 4: hooks carry no usage data → backfill the stamina bar from the
 *  transcript tail on Stop. Bridges to App.tsx's handleTokenUpdate via a window
 *  event (this hook can't reach App.tsx local state). Best-effort, silent. */
function backfillTokensFromTranscript(key: string, transcriptPath: string): void {
  invoke<{
    usage: {
      input_tokens: number;
      output_tokens: number;
      cache_creation_input_tokens: number;
      cache_read_input_tokens: number;
    };
    last_text: string | null;
    total_cost_usd: number | null;
  }>('parse_transcript_tail', { path: transcriptPath })
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

/** Persist Claude Code's session id onto the Quack session so we can later
 *  `claude --resume <id>`. In embedded mode the SDK path never runs, so the
 *  hook (which carries both ids) is the only place this gets saved. Idempotent;
 *  also tracks a new id after `/clear` (which starts a fresh Claude session). */
function persistClaudeSessionId(quackSessionId: string, claudeSessionId: string): void {
  const store = useSessionStore.getState();
  const session = store.sessions.find((s) => s.id === quackSessionId);
  if (!session || session.claudeSessionId === claudeSessionId) return;
  store.updateSession(quackSessionId, { claudeSessionId }).catch(() => {});
}

/** Mirror Claude Code's session name (first user message) into the Quack session
 *  title on Stop. Always overwrites (user choice). Best-effort, silent. */
function syncTitleFromTranscript(quackSessionId: string, transcriptPath: string): void {
  invoke<string | null>('read_transcript_title', { path: transcriptPath })
    .then((title) => {
      if (!title) return;
      const store = useSessionStore.getState();
      const session = store.sessions.find((s) => s.id === quackSessionId);
      if (!session || session.title === title) return;
      store.updateSession(quackSessionId, { title }).catch(() => {});
    })
    .catch(() => {});
}

export function useHookStatusListener(): void {
  useEffect(() => {
    const apply = (evt: HookStatusEvent) => {
      const key = evt.quack_session_id || evt.session_id;
      if (!key) return;

      // Save Claude's session id onto the Quack session (enables --resume).
      if (evt.quack_session_id && evt.session_id) {
        persistClaudeSessionId(evt.quack_session_id, evt.session_id);
      }

      switch (evt.hook_event_name) {
        case 'UserPromptSubmit':
          markWorking(key);
          break;
        case 'PermissionRequest':
          markBlocked(key);
          break;
        case 'PreToolUse':
          // Plan / AskUserQuestion about to be shown → blocked on the user.
          if (evt.tool_name && BLOCKING_TOOLS.has(evt.tool_name)) markBlocked(key);
          break;
        case 'PostToolUse':
          // User answered the plan/question → agent resumes.
          if (evt.tool_name && BLOCKING_TOOLS.has(evt.tool_name)) markWorking(key);
          break;
        case 'Stop':
        case 'StopFailure':
          markDone(key);
          if (evt.transcript_path) {
            backfillTokensFromTranscript(key, evt.transcript_path);
            if (evt.quack_session_id) syncTitleFromTranscript(evt.quack_session_id, evt.transcript_path);
          }
          break;
        case 'SessionStart':
        case 'SessionEnd':
          markReleased(key);
          break;
        default:
          break;
      }
    };

    let unlisten: (() => void) | undefined;
    listen<HookStatusEvent>('hook-status', (event) => apply(event.payload)).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, []);
}
