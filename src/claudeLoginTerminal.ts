import { pty } from "./ipc";
import { useStore } from "./store";
import { success as toastSuccess } from "./notify";
import {
  invalidateClaudeAuthCache,
  probeClaudeAuth,
  scheduleClaudeAuthRecheck,
} from "./claudeAuthStatus";

const LOGIN_OK = /login successful|logged in as/i;
const WATCH_MS = 8 * 60_000;
const activeWatches = new Map<string, () => void>();

function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "");
}

async function waitPtyId(wsId: string, termId: string): Promise<string | null> {
  const deadline = Date.now() + 12_000;
  while (Date.now() < deadline) {
    const id = useStore.getState().loaded[wsId]?.terminals[termId]?.ptyId;
    if (id) return id;
    await new Promise((r) => window.setTimeout(r, 150));
  }
  return null;
}

function dismissLoginTerminal(wsId: string, termId: string, ptyId: string): void {
  window.setTimeout(() => void pty.write(ptyId, "\r"), 400);
  window.setTimeout(() => {
    const st = useStore.getState();
    if (st.loaded[wsId]?.terminals[termId]) st.closeTerminal(wsId, termId);
  }, 1400);
}

function onLoginSuccess(wsId: string, termId: string, ptyId: string): void {
  invalidateClaudeAuthCache();
  scheduleClaudeAuthRecheck();
  void probeClaudeAuth(true);
  toastSuccess("Claude Code signed in — you're ready to chat.");
  dismissLoginTerminal(wsId, termId, ptyId);
}

/** Watch a guided-login terminal; toast + auto-close on CLI success text. */
export async function beginClaudeLoginWatch(
  wsId: string,
  termId: string,
): Promise<void> {
  activeWatches.get(termId)?.();
  const ptyId = await waitPtyId(wsId, termId);
  if (!ptyId) return;

  let buf = "";
  let done = false;
  let unlisten: (() => void) | undefined;
  const stop = () => {
    if (done) return;
    done = true;
    unlisten?.();
    activeWatches.delete(termId);
  };
  const timeout = window.setTimeout(stop, WATCH_MS);
  const cleanup = () => {
    window.clearTimeout(timeout);
    stop();
  };
  activeWatches.set(termId, cleanup);

  unlisten = await pty.onOutput((id, data) => {
    if (done || id !== ptyId) return;
    buf = (buf + stripAnsi(data)).slice(-4000);
    if (!LOGIN_OK.test(buf)) return;
    cleanup();
    onLoginSuccess(wsId, termId, ptyId);
  });
}
