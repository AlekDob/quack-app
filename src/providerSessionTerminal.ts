// Spawn or reuse a bottom PTY and inject a provider resume command.
// Bridges Quack chat sessions ↔ interactive CLI in the terminal pane.

import { pty } from "./ipc";
import { useStore } from "./store";
import type { ProviderId } from "./providers/types";
import { error as toastError, success as toastSuccess } from "./notify";

function shellQuote(path: string): string {
  return `'${path.replace(/'/g, `'\\''`)}'`;
}

/** Headless resume argv for an interactive terminal session. */
export function cliResumeCommand(
  provider: ProviderId,
  cwd: string,
  sessionId: string,
): string | null {
  const dir = `cd ${shellQuote(cwd)}`;
  if (provider === "claude-code") {
    return `${dir} && claude --resume ${sessionId}`;
  }
  if (provider === "cursor-cli") {
    return `${dir} && cursor-agent --resume ${sessionId}`;
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => window.setTimeout(r, ms));
}

async function waitForPtyId(
  wsId: string,
  termId: string,
  tries = 40,
): Promise<string | null> {
  for (let i = 0; i < tries; i++) {
    const t = useStore.getState().loaded[wsId]?.terminals[termId];
    if (t?.ptyId) return t.ptyId;
    await sleep(100);
  }
  return null;
}

/** Open bottom terminal and run `claude --resume` (or cursor equivalent). */
export async function resumeProviderInTerminal(
  wsId: string,
  cwd: string,
  provider: ProviderId,
  sessionId: string,
): Promise<void> {
  const cmd = cliResumeCommand(provider, cwd, sessionId);
  if (!cmd) {
    toastError("This provider cannot be resumed in a terminal yet");
    return;
  }
  const { addTerminal } = useStore.getState();
  const ws = useStore.getState().loaded[wsId];
  const terms = ws ? Object.values(ws.terminals) : [];
  let termId = terms[terms.length - 1]?.id;
  if (!termId) termId = addTerminal(wsId, "bottom");
  const ptyId = await waitForPtyId(wsId, termId);
  if (!ptyId) {
    toastError("Terminal not ready — try again in a moment");
    return;
  }
  try {
    await pty.write(ptyId, `${cmd}\r`);
    toastSuccess("Resume command sent to terminal");
  } catch (e) {
    toastError(e instanceof Error ? e.message : "Failed to write to terminal");
  }
}
