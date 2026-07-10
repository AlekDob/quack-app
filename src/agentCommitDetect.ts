import type { ChatMessage } from "./ai";
import { git } from "./ipc";
import { forceGitStatusRefresh } from "./gitStatusStore";
import {
  commitKey,
  markAgentCommitPushed,
  publishAgentCommit,
  type AgentCommitSnapshot,
} from "./agentCommitStore";

export function isGitCommitCmd(cmd: string): boolean {
  return /\bgit\s+commit\b/i.test(cmd);
}

export function isGitPushCmd(cmd: string): boolean {
  return /\bgit\s+push\b/i.test(cmd);
}

export function parseCommitMessageFromCmd(cmd: string): string | null {
  const quoted = cmd.match(
    /git\s+commit\b[\s\S]*?(?:-m|--message)(?:=|\s+)(['"])([\s\S]*?)\1/i,
  );
  if (quoted?.[2]) return quoted[2].replace(/\\n/g, "\n").trim();

  const heredoc = cmd.match(/<<-?['"]?\w+['"]?\s*\r?\n([\s\S]*?)\r?\n\w+/i);
  if (heredoc?.[1]) return heredoc[1].trim();

  return null;
}

export function parseHashFromCommitOutput(out: string): string | null {
  const m = out.match(/\[[^\]]+\s+([0-9a-f]{7,40})\]/i);
  return m?.[1] ?? null;
}

function bashCmdFromCall(call: {
  function: { name: string; arguments: Record<string, unknown> };
}): string | null {
  if (call.function.name !== "Bash") return null;
  const cmd = call.function.arguments.command;
  return typeof cmd === "string" ? cmd : null;
}

function resultText(
  results: NonNullable<ChatMessage["tool_results"]>,
  toolUseId: string,
): { content: string; isError: boolean } | null {
  const hit = results.find((r) => r.tool_use_id === toolUseId);
  if (!hit) return null;
  return { content: hit.content, isError: hit.is_error === true };
}

function lastBashGitCommit(
  messages: ChatMessage[],
): { cmd: string; output: string } | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "assistant" || !m.tool_calls?.length) continue;
    const results = m.tool_results ?? [];
    for (let j = m.tool_calls.length - 1; j >= 0; j--) {
      const call = m.tool_calls[j];
      const cmd = bashCmdFromCall(call);
      if (!cmd || !isGitCommitCmd(cmd)) continue;
      const id = call.id;
      if (!id) continue;
      const res = resultText(results, id);
      if (!res || res.isError) continue;
      return { cmd, output: res.content };
    }
  }
  return null;
}

function hadBashGitPushAfter(
  messages: ChatMessage[],
  afterIndex: number,
): boolean {
  for (let i = messages.length - 1; i > afterIndex; i--) {
    const m = messages[i];
    if (m.role !== "assistant" || !m.tool_calls?.length) continue;
    const results = m.tool_results ?? [];
    for (const call of m.tool_calls) {
      const cmd = bashCmdFromCall(call);
      if (!cmd || !isGitPushCmd(cmd)) continue;
      const id = call.id;
      if (!id) continue;
      const res = resultText(results, id);
      if (!res || res.isError) continue;
      return true;
    }
  }
  return false;
}

function commitMessageIndex(messages: ChatMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "assistant" || !m.tool_calls?.length) continue;
    for (const call of m.tool_calls) {
      const cmd = bashCmdFromCall(call);
      if (!cmd || !isGitCommitCmd(cmd)) continue;
      const id = call.id;
      if (!id) continue;
      const res = resultText(m.tool_results ?? [], id);
      if (!res || res.isError) continue;
      return i;
    }
  }
  return -1;
}

async function buildCommitSnap(
  root: string,
  cmd: string,
  output: string,
): Promise<AgentCommitSnapshot | null> {
  let message = parseCommitMessageFromCmd(cmd);
  let hash = parseHashFromCommitOutput(output);
  let shortHash = hash ? hash.slice(0, 7) : null;

  try {
    const log = await git.log(root, 1);
    const head = log[0];
    if (head) {
      if (!message) message = head.subject;
      hash = head.full_hash;
      shortHash = head.hash;
    }
  } catch {
    /* not a repo */
  }

  if (!message && !hash) return null;
  return {
    message: message ?? "Commit",
    hash,
    shortHash,
    at: Date.now(),
    pushed: false,
  };
}

export async function noteAgentBashOutcome(opts: {
  wsId: string;
  sessionId: string;
  root: string;
  cmd: string;
  output: string;
  isError: boolean;
}): Promise<void> {
  const { wsId, sessionId, root, cmd, output, isError } = opts;
  if (isError) return;
  const key = commitKey(wsId, sessionId);

  if (isGitPushCmd(cmd)) {
    markAgentCommitPushed(key);
    void forceGitStatusRefresh(wsId);
    return;
  }

  if (!isGitCommitCmd(cmd)) return;
  const snap = await buildCommitSnap(root, cmd, output);
  if (!snap) return;
  publishAgentCommit(key, snap);
  void forceGitStatusRefresh(wsId);
}

export function inspectBashToolResult(opts: {
  wsId: string;
  sessionId: string;
  root: string;
  toolName: string;
  cmd: string | undefined;
  output: string;
  isError: boolean;
}): void {
  if (opts.toolName !== "Bash" || !opts.cmd) return;
  void noteAgentBashOutcome({
    wsId: opts.wsId,
    sessionId: opts.sessionId,
    root: opts.root,
    cmd: opts.cmd,
    output: opts.output,
    isError: opts.isError,
  });
}

export async function hydrateAgentCommitFromMessages(
  wsId: string,
  sessionId: string,
  root: string,
  messages: ChatMessage[],
): Promise<void> {
  const key = commitKey(wsId, sessionId);
  const outcome = lastBashGitCommit(messages);
  if (!outcome) return;

  const snap = await buildCommitSnap(root, outcome.cmd, outcome.output);
  if (!snap) return;

  const idx = commitMessageIndex(messages);
  if (idx >= 0 && hadBashGitPushAfter(messages, idx)) {
    snap.pushed = true;
  }

  publishAgentCommit(key, snap);
}
