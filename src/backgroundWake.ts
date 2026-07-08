// Claude Code background-task wake helper.
//
// In `claude -p` (headless) mode, plain background Bash shells are stopped
// ~5s after the final result once stdin closes — the model may say "I'll
// wake when it's done" but the subprocess has already exited. Subagents are
// different: the CLI waits for them (see CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS).
//
// When a turn ends with a background Bash launch and the CC process is no
// longer in activeSessions, nudge a --resume continuation so the agent can
// BashOutput / continue instead of leaving the chat idle.

import type { ChatMessage } from "./ai";
import { claudeCode } from "./ipc";

const GRACE_MS = 12_000;
const POLL_MS = 8_000;
const MAX_ACTIVE_POLLS = 450; // ~1h while CC waits on a subagent internally

export const BACKGROUND_WAKE_PROMPT =
  "Continue. Check on any background shell tasks you started (use BashOutput if needed), report their results, and proceed with the plan.";

function isBgBash(call: { function: { name: string; arguments: Record<string, unknown> } }): boolean {
  if (call.function.name !== "Bash") return false;
  const v = call.function.arguments.run_in_background;
  return v === true || v === "true";
}

/** True when the last assistant turn launched Bash in the background. */
export function lastTurnLaunchedBackgroundBash(
  msg: ChatMessage | undefined,
): boolean {
  if (!msg || msg.role !== "assistant" || !msg.tool_calls?.length) return false;
  if (!msg.tool_calls.some(isBgBash)) return false;
  // Same-turn BashOutput means CC already continued in-process.
  return !msg.tool_calls.some((c) => c.function.name === "BashOutput");
}

export interface BackgroundWakeHandle {
  cancel: () => void;
}

/** Poll activeSessions; call onWake once when the CC process has exited. */
export function scheduleBackgroundWake(args: {
  chatSessionId: string;
  onWake: () => void;
}): BackgroundWakeHandle {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let activePolls = 0;

  const tick = async () => {
    if (cancelled) return;
    try {
      const active = await claudeCode.activeSessions();
      if (active.includes(args.chatSessionId)) {
        activePolls += 1;
        if (activePolls < MAX_ACTIVE_POLLS) {
          timer = setTimeout(() => void tick(), POLL_MS);
        }
        return;
      }
    } catch {
      /* non-Tauri / backend not ready */
    }
    if (cancelled) return;
    args.onWake();
  };

  timer = setTimeout(() => void tick(), GRACE_MS);

  return {
    cancel: () => {
      cancelled = true;
      if (timer !== undefined) clearTimeout(timer);
    },
  };
}
