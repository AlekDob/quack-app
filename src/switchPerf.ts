// Dev-only switch timing. The existing [chat-switch] logs only measure
// setActiveWorkspace (fast); the perceived lag is the render/mount cascade that
// follows — Monaco cold mount, FileTree list_dir, fs_watch_start, outgoing
// teardown. This records a switch-start stamp and logs each heavy phase with
// ms-since-switch so an intermittent slow switch shows WHICH phase cost it.
// Filter the console by `[switch-perf]`.

let switchStartAt = 0;
let switchToWsId = "";

export function markSwitchStart(wsId: string): void {
  if (!import.meta.env.DEV) return;
  switchStartAt = performance.now();
  switchToWsId = wsId;
}

/** Log a heavy switch phase, timed from the last switch start. `wsId` gates it
 *  to the workspace we're switching INTO, so background work isn't attributed. */
export function logSwitchPhase(
  phase: string,
  wsId: string,
  extra?: Record<string, unknown>,
): void {
  if (!import.meta.env.DEV || !switchStartAt || wsId !== switchToWsId) return;
  const sinceSwitchMs = Math.round(performance.now() - switchStartAt);
  console.log(`[switch-perf] ${phase}`, { wsId, sinceSwitchMs, ...extra });
}

// ── New-chat timing ────────────────────────────────────────────────────
// Creating a chat is intermittently slow — the cost is the fresh AIChatPanel
// mount + render cascade, which the switch logs above don't cover. Filter the
// console by `[new-chat-perf]`.
let newChatId = "";
let newChatAt = 0;

export function markNewChat(chatId: string): void {
  if (!import.meta.env.DEV) return;
  newChatId = chatId;
  newChatAt = performance.now();
}

/** Log a phase of the just-created chat's first mount, timed from creation.
 *  Gated to that chat so only its own panel logs. */
export function logNewChatPhase(
  chatId: string,
  phase: string,
  extra?: Record<string, unknown>,
): void {
  if (!import.meta.env.DEV || chatId !== newChatId || !newChatAt) return;
  console.log(`[new-chat-perf] ${phase}`, {
    chatId,
    sinceMs: Math.round(performance.now() - newChatAt),
    ...extra,
  });
}
