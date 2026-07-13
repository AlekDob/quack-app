// Sync Works artifacts ↔ composer chat descriptors when agents edit disk.

import { getAllAgentStatus } from "./agentStatusStore";
import { activeAiChatId, useStore, type WorkspaceData } from "./store";
import { findStory, findWork, type WorksSnapshot } from "./works";

function normRoot(root: string): string {
  return root.replace(/\\/g, "/").replace(/\/+$/, "");
}

export function wsIdForRoot(root: string): string | null {
  const want = normRoot(root);
  const st = useStore.getState();
  for (const [id, ws] of Object.entries(st.loaded)) {
    if (normRoot(ws.meta.root) === want) return id;
  }
  return st.activeId;
}

function openChatIds(wsId: string, ws: WorkspaceData): string[] {
  const out: string[] = [];
  const active = activeAiChatId(ws);
  if (active) out.push(active);
  for (const [chatId, rec] of getAllAgentStatus()) {
    if (rec.wsId !== wsId || rec.derived !== "working") continue;
    if (!out.includes(chatId)) out.push(chatId);
  }
  return out;
}

function syncLinkedChatsToStore(wsId: string, snap: WorksSnapshot): void {
  const store = useStore.getState();
  const ws = store.loaded[wsId];
  if (!ws) return;

  for (const s of snap.stories) {
    for (const chatId of s.linkedChatIds) {
      if (!ws.aiChats[chatId]) continue;
      const chat = ws.aiChats[chatId];
      if (chat.storyId === s.id && chat.workItemId == null) continue;
      if (chat.workItemId) {
        const w = findWork(snap, chat.workItemId);
        if (w?.parentId === s.id && chat.storyId === s.id) continue;
      }
      store.setAIChatStory(wsId, chatId, s.id);
      store.setAIChatPlanning(wsId, chatId, s.status === "draft");
    }
  }

  for (const w of snap.items) {
    for (const chatId of w.linkedChatIds) {
      if (!ws.aiChats[chatId]) continue;
      const chat = ws.aiChats[chatId];
      if (chat.workItemId === w.id) continue;
      store.setAIChatWorkItem(wsId, chatId, w.id);
      store.setAIChatPlanning(wsId, chatId, false);
      if (w.parentId) store.setAIChatStory(wsId, chatId, w.parentId);
    }
  }
}

function pickAutoLinkChat(
  wsId: string,
  ws: WorkspaceData,
  snap: WorksSnapshot,
  kind: "story" | "work",
  entityId: string,
): string | null {
  const candidates = openChatIds(wsId, ws);
  if (!candidates.length) return null;

  if (kind === "story") {
    const story = findStory(snap, entityId);
    if (!story) return null;
    for (const chatId of candidates) {
      const chat = ws.aiChats[chatId];
      if (!chat || chat.archivedAt || chat.doneAt) continue;
      if (chat.storyId || chat.workItemId) continue;
      return chatId;
    }
    return null;
  }

  const work = findWork(snap, entityId);
  if (!work) return null;
  for (const chatId of candidates) {
    const chat = ws.aiChats[chatId];
    if (!chat || chat.archivedAt || chat.doneAt) continue;
    if (chat.workItemId) continue;
    if (work.parentId && chat.storyId && work.parentId !== chat.storyId) {
      continue;
    }
    if (!chat.storyId && !chat.workItemId) return chatId;
    if (chat.storyId && work.parentId === chat.storyId) return chatId;
    if (chat.storyId && !work.parentId) return chatId;
  }
  return null;
}

/** After Works snapshot persists — mirror linkedChats + auto-link fresh artifacts. */
export async function afterWorksSaved(
  root: string,
  prev: WorksSnapshot,
  next: WorksSnapshot,
): Promise<void> {
  const wsId = wsIdForRoot(root);
  if (!wsId) return;

  syncLinkedChatsToStore(wsId, next);

  const prevLen = prev.items.length + prev.stories.length;
  const newStories = next.stories.filter(
    (s) => !prev.stories.some((p) => p.id === s.id),
  );
  const newWorks = next.items.filter(
    (w) => !prev.items.some((p) => p.id === w.id),
  );
  if (!newStories.length && !newWorks.length) return;
  if (prevLen === 0 && newStories.length + newWorks.length > 1) return;

  const { linkStoryToChat, linkWorkToChat } = await import("./quackPlanHarness");
  const ws = useStore.getState().loaded[wsId];
  if (!ws) return;

  // Draft stories are planning artifacts — link only when linkedChats is set
  // explicitly (synced above) or the user picks Plan a feature / @S-NNN.
  for (const s of newStories) {
    if (s.status === "draft" || s.linkedChatIds.length) continue;
    const chatId = pickAutoLinkChat(wsId, ws, next, "story", s.id);
    if (chatId) await linkStoryToChat(wsId, chatId, root, s.id);
  }
  for (const w of newWorks) {
    if (w.linkedChatIds.length) continue;
    const chatId = pickAutoLinkChat(wsId, ws, next, "work", w.id);
    if (chatId) await linkWorkToChat(wsId, chatId, root, w.id);
  }
}
