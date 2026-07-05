// Per-workspace chat context: editor attach toggle + @-mentioned files
// waiting for the next message. Scoped by wsId so switching projects
// doesn't bleed files from another workspace's chat.

import { useEffect, useState } from "react";
import { getJson, setJson } from "./localStore";
import { resolveUnderRoot } from "./pathUtils";

const attachKey = (wsId: string) => `lcp.chatContext.attach.${wsId}`;

const attachCache = new Map<string, boolean>();
const filesCache = new Map<string, string[]>();
const listeners = new Set<(wsId: string) => void>();

function notify(wsId: string) {
  for (const l of listeners) l(wsId);
}

export function getAttachContext(wsId: string): boolean {
  const hit = attachCache.get(wsId);
  if (hit !== undefined) return hit;
  const v = getJson(attachKey(wsId), true);
  attachCache.set(wsId, v);
  return v;
}

export function setAttachContext(wsId: string, value: boolean): void {
  attachCache.set(wsId, value);
  setJson(attachKey(wsId), value);
  notify(wsId);
}

export function getAttachedFiles(wsId: string): string[] {
  return filesCache.get(wsId) ?? [];
}

export function setAttachedFiles(
  wsId: string,
  next: string[] | ((prev: string[]) => string[]),
): void {
  const prev = getAttachedFiles(wsId);
  const resolved = typeof next === "function" ? next(prev) : next;
  filesCache.set(wsId, resolved);
  notify(wsId);
}

export function addAttachedFile(wsId: string, root: string, path: string): void {
  const abs = resolveUnderRoot(path, root);
  if (!abs) return;
  setAttachedFiles(wsId, (prev) =>
    prev.includes(abs) ? prev : [...prev, abs],
  );
}

export function clearAttachedFiles(wsId: string): void {
  filesCache.set(wsId, []);
  notify(wsId);
}

export function useWorkspaceChatContext(wsId: string) {
  const [, tick] = useState(0);
  useEffect(() => {
    const on = (id: string) => {
      if (id === wsId) tick((n) => n + 1);
    };
    listeners.add(on);
    return () => {
      listeners.delete(on);
    };
  }, [wsId]);

  return {
    attachContext: getAttachContext(wsId),
    setAttachContext: (v: boolean) => setAttachContext(wsId, v),
    attachedFiles: getAttachedFiles(wsId),
    setAttachedFiles: (
      next: string[] | ((prev: string[]) => string[]),
    ) => setAttachedFiles(wsId, next),
    addAttachedFile: (path: string, root: string) =>
      addAttachedFile(wsId, root, path),
    clearAttachedFiles: () => clearAttachedFiles(wsId),
  };
}
