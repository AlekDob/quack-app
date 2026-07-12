import { acceptanceFromBlocks } from "./worksBlocks";
import { findWork, type WorksSnapshot } from "./works";
import { getTasks, subscribeTasks } from "./aiTaskStore";
import { getChatDiff, subscribeChatDiff } from "./chatDiffStore";

export interface WorkProgress {
  workId: string;
  acceptanceDone: number;
  acceptanceTotal: number;
  linkedChats: number;
  activeTasks: number;
  hasEdits: boolean;
}

const progressByWork = new Map<string, WorkProgress>();
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

export function deriveWorkProgress(
  snap: WorksSnapshot,
  workId: string,
): WorkProgress | null {
  const w = findWork(snap, workId);
  if (!w) return null;
  const acc = acceptanceFromBlocks(w.descriptionBlocks);
  let activeTasks = 0;
  let hasEdits = false;
  for (const chatId of w.linkedChatIds) {
    const tasks = getTasks(chatId);
    activeTasks += tasks.filter((t) => t.status !== "completed").length;
    if (getChatDiff(chatId)) hasEdits = true;
  }
  return {
    workId,
    acceptanceDone: acc.done,
    acceptanceTotal: acc.total,
    linkedChats: w.linkedChatIds.length,
    activeTasks,
    hasEdits,
  };
}

export function publishWorkProgress(
  snap: WorksSnapshot,
  workId: string,
): void {
  const p = deriveWorkProgress(snap, workId);
  if (!p) {
    if (progressByWork.delete(workId)) notify();
    return;
  }
  progressByWork.set(workId, p);
  notify();
}

export function refreshAllWorkProgress(snap: WorksSnapshot): void {
  progressByWork.clear();
  for (const w of snap.items) {
    const p = deriveWorkProgress(snap, w.id);
    if (p) progressByWork.set(w.id, p);
  }
  notify();
}

export function getWorkProgress(workId: string): WorkProgress | undefined {
  return progressByWork.get(workId);
}

export function subscribeWorkProgress(cb: () => void): () => void {
  listeners.add(cb);
  const u1 = subscribeTasks(cb);
  const u2 = subscribeChatDiff(cb);
  return () => {
    listeners.delete(cb);
    u1();
    u2();
  };
}
