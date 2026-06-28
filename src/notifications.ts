// OS-level notifications for agent state changes — fired by the global
// AgentHubWatcher when a chat becomes ready or needs the user's input.
// Three channels: native OS notification (visible with the app in the
// background), an in-app toast (src/notify.ts), and the quack sound.
//
// Gating: only notify when the user isn't already looking at that chat
// (app unfocused OR a different chat is active). Dedup: at most one
// notification per chat per 60s, so a chatty run doesn't spam.

import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { notify as toast } from "./notify";

const DEDUP_MS = 60_000;
const lastNotifiedAt = new Map<string, number>();

// Cache the granted state — requesting on every event is wasteful and on
// some platforms re-prompts. null = not yet checked.
let permGranted: boolean | null = null;

let quackAudio: HTMLAudioElement | null = null;

function playQuack(): void {
  try {
    if (!quackAudio) quackAudio = new Audio("/sounds/quack.mp3");
    quackAudio.currentTime = 0;
    // Autoplay policy can reject before first user gesture — ignore.
    void quackAudio.play().catch(() => {});
  } catch {
    /* no audio device / blocked — silent */
  }
}

async function ensurePermission(): Promise<boolean> {
  if (permGranted !== null) return permGranted;
  try {
    let granted = await isPermissionGranted();
    if (!granted) granted = (await requestPermission()) === "granted";
    permGranted = granted;
    return granted;
  } catch {
    permGranted = false;
    return false;
  }
}

export interface AgentNotifyArgs {
  chatId: string;
  kind: "ready" | "needs-input";
  needsInputKind?: "permission" | "question";
  wsName: string;
  chatTitle: string;
  /** Skip the OS notification when the user is already on this chat. */
  isFocusedHere: boolean;
}

/**
 * Fire a notification for an agent state change. No-op when the user is
 * focused on the chat, or when the same chat fired within DEDUP_MS.
 */
export async function notifyAgentEvent(args: AgentNotifyArgs): Promise<void> {
  const { chatId, kind, needsInputKind, wsName, chatTitle, isFocusedHere } =
    args;
  if (isFocusedHere) return;

  const now = Date.now();
  if (now - (lastNotifiedAt.get(chatId) ?? 0) < DEDUP_MS) return;
  lastNotifiedAt.set(chatId, now);

  const body =
    kind === "needs-input"
      ? needsInputKind === "question"
        ? `Asked you a question: ${chatTitle}`
        : `Waiting for permission: ${chatTitle}`
      : `Agent ready: ${chatTitle}`;

  // In-app toast (always — cheap, no permission needed).
  toast(body, kind === "needs-input" ? "warning" : "success");
  playQuack();

  // OS notification (best-effort).
  try {
    if (await ensurePermission()) {
      sendNotification({ title: `Quack — ${wsName}`, body });
    }
  } catch {
    /* plugin unavailable (e.g. web preview) — toast already shown */
  }
}
