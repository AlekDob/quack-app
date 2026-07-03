// Summarize Edit/Write tool calls in a chat transcript — used by the
// Agent Hub row subtitle (+N -M · K files / Edited foo.ts).

import type { ChatMessage, ToolCall } from "./ai";
import {
  diffStats,
  extractEditDiffs,
  pathOf,
} from "./components/chatToolRender";

export interface SessionDiffSummary {
  added: number;
  removed: number;
  files: string[];
}

function collectEditCalls(messages: ChatMessage[]): ToolCall[] {
  const out: ToolCall[] = [];
  for (const m of messages) {
    if (m.role !== "assistant" || !m.tool_calls) continue;
    for (const c of m.tool_calls) {
      if (extractEditDiffs(c)) out.push(c);
    }
  }
  return out;
}

function summarizeCalls(calls: ToolCall[]): SessionDiffSummary | null {
  if (calls.length === 0) return null;
  let added = 0;
  let removed = 0;
  const files = new Set<string>();
  for (const c of calls) {
    const diffs = extractEditDiffs(c);
    if (!diffs) continue;
    const s = diffStats(diffs);
    added += s.added;
    removed += s.removed;
    const p = pathOf(c);
    if (p && p !== "(unknown)") files.add(p);
  }
  if (files.size === 0 && added === 0 && removed === 0) return null;
  return { added, removed, files: [...files] };
}

/** Aggregate edits from assistant messages in `messages`. */
export function summarizeEdits(messages: ChatMessage[]): SessionDiffSummary | null {
  return summarizeCalls(collectEditCalls(messages));
}

/** Edits produced after the last user message (latest agent turn). */
export function summarizeLastTurn(messages: ChatMessage[]): SessionDiffSummary | null {
  let lastUser = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      lastUser = i;
      break;
    }
  }
  if (lastUser < 0) return null;
  return summarizeCalls(collectEditCalls(messages.slice(lastUser + 1)));
}

export function fileBase(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}
