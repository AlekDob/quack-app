// Compose review tabs — before/after diff for agent-edited files (Conductor-style).

import type { ToolCall } from "./ai";
import { extractEditDiffs, pathOf } from "./components/chatToolRender";
import { lookupSnapshot } from "./composeSnapshots";
import { requestDiff } from "./editorState";
import { fs } from "./ipc";
import { langOf } from "./langDetect";
import { basename } from "./pathUtils";

const metaByKey = new Map<string, ToolCall[]>();

export function composeReviewKey(
  wsId: string,
  chatId: string | undefined,
  msgIndex: number,
  path: string,
): string {
  return `crev:${wsId}|${chatId ?? "_"}|${msgIndex}|${encodeURIComponent(path)}`;
}

export function parseComposeReviewKey(k: string): {
  wsId: string;
  chatId: string | undefined;
  msgIndex: number;
  path: string;
} | null {
  if (!k.startsWith("crev:")) return null;
  const body = k.slice(5);
  let i = 0;
  const take = (): string | null => {
    const j = body.indexOf("|", i);
    if (j < 0) return null;
    const s = body.slice(i, j);
    i = j + 1;
    return s;
  };
  const wsId = take();
  const chatRaw = take();
  const msgRaw = take();
  if (!wsId || !chatRaw || !msgRaw) return null;
  const msgIndex = parseInt(msgRaw, 10);
  if (!Number.isFinite(msgIndex)) return null;
  const chatId = chatRaw === "_" ? undefined : chatRaw;
  try {
    return { wsId, chatId, msgIndex, path: decodeURIComponent(body.slice(i)) };
  } catch {
    return null;
  }
}

export function stashComposeReviewCalls(key: string, calls: ToolCall[]): void {
  metaByKey.set(key, calls);
}

export function composeReviewCalls(key: string): ToolCall[] {
  return metaByKey.get(key) ?? [];
}

/** Pre-turn content for the diff left pane. */
export function composeOriginalContent(
  wsId: string,
  chatId: string | undefined,
  msgIndex: number,
  path: string,
  calls: ToolCall[],
): string {
  const snap = lookupSnapshot(wsId, chatId, msgIndex);
  const fromSnap = snap?.files.get(path);
  if (fromSnap !== undefined) return fromSnap;
  for (const c of calls) {
    if (pathOf(c) !== path) continue;
    const diffs = extractEditDiffs(c);
    if (!diffs?.length) continue;
    return diffs.map((d) => d.oldText).join("\n\n");
  }
  return "";
}

function toolModifiedFallback(path: string, calls: ToolCall[]): string {
  for (const c of calls) {
    if (pathOf(c) !== path) continue;
    const diffs = extractEditDiffs(c);
    if (!diffs?.length) continue;
    return diffs.map((d) => d.newText).join("\n\n");
  }
  return "";
}

/** Agent Mode: centered DiffModal (chat stays full-width). */
export async function openComposeDiffModal(
  wsId: string,
  chatId: string | undefined,
  msgIndex: number,
  path: string,
  calls: ToolCall[],
): Promise<void> {
  const original = composeOriginalContent(wsId, chatId, msgIndex, path, calls);
  let modified = "";
  try {
    modified = await fs.readFile(path);
  } catch {
    modified = toolModifiedFallback(path, calls);
  }
  requestDiff({
    path: basename(path),
    refspec: "before → after",
    originalContent: original,
    modifiedContent: modified,
    language: langOf(path),
  });
}
