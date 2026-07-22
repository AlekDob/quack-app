// Tiny shared store for the agent's task checklist (TodoWrite /
// TaskCreate / TaskUpdate), keyed by AI chat id. AIChatPanel owns the
// authoritative state and publishes here; other surfaces (the agent-mode
// sidebar's Tasks section) subscribe read-only. Module-level, not Zustand
// — it's transient per-session UI state, not persisted workspace state.

export interface AiTaskItem {
  content: string;
  status: "pending" | "in_progress" | "completed";
  activeForm?: string;
}

const tasksByChat = new Map<string, AiTaskItem[]>();
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

function sameTasks(a: AiTaskItem[] | undefined, b: AiTaskItem[] | null): boolean {
  const bb = b ?? [];
  const aa = a ?? [];
  if (aa.length !== bb.length) return false;
  for (let i = 0; i < aa.length; i++) {
    if (
      aa[i].content !== bb[i].content ||
      aa[i].status !== bb[i].status ||
      aa[i].activeForm !== bb[i].activeForm
    ) {
      return false;
    }
  }
  return true;
}

/** AIChatPanel calls this whenever its checklist changes. Empty/null
 *  clears the entry. AIChatPanel republishes on every TodoWrite AND on
 *  stream ticks, so dedupe identical lists — an unchanged publish must not
 *  fan out to AgentTasks + workProgressStore (mirrors chatDiffStore.sameDiff). */
export function publishTasks(chatId: string, items: AiTaskItem[] | null): void {
  if (sameTasks(tasksByChat.get(chatId), items)) return;
  if (items && items.length > 0) tasksByChat.set(chatId, items);
  else tasksByChat.delete(chatId);
  notify();
}

/** Drop a chat's tasks entirely (e.g. session closed). */
export function clearTasks(chatId: string): void {
  if (tasksByChat.delete(chatId)) notify();
}

export function getTasks(chatId: string | null | undefined): AiTaskItem[] {
  return chatId ? (tasksByChat.get(chatId) ?? []) : [];
}

export function subscribeTasks(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
