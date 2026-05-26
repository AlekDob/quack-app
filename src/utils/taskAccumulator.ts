import type { TodoItem } from '../types';

// Brain: WS01 SDK 0.3.150 — TodoWrite (snapshot-replace) deprecated since 0.2.136,
// fully replaced by Task tools (TaskCreate/TaskUpdate/TaskGet/TaskList) in 0.3.142.
// Tool consumers must accumulate per-taskId across tool_use events instead of
// reading a single `todos[]` snapshot. This helper bridges both worlds so the
// existing TodoWidget UX (StaminaBar + StreamMessage list) keeps working.

type AssistantStreamEvent = {
  type?: string;
  message?: {
    content?: unknown;
  };
};

type ToolUseContent = {
  type?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown> | null;
};

type AccumulatorResult = {
  todos: TodoItem[];
  lastTaskToolId: string | null;
};

const TASK_TOOL_NAMES = new Set([
  'todowrite',
  'taskcreate',
  'taskupdate',
  'tasklist',
]);

export function isTaskToolName(name?: string | null): boolean {
  if (!name) return false;
  return TASK_TOOL_NAMES.has(name.toLowerCase());
}

function parseJsonSafe<T>(raw: string | undefined): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function accumulateTodos(
  streamMessages: unknown[],
  toolResults: Map<string, string>
): AccumulatorResult {
  const byId = new Map<string, TodoItem>();
  const order: string[] = [];
  let lastTaskToolId: string | null = null;

  // TodoWrite legacy is snapshot-replace: when we see one, it wins over any
  // prior Task tool state. We track its position so a later Task tool can
  // re-take authority if the model mixes both.
  let snapshot: TodoItem[] | null = null;
  let snapshotIsLatest = false;

  const messages = streamMessages as AssistantStreamEvent[];
  for (const evt of messages) {
    if (evt?.type !== 'assistant' || !evt.message?.content) continue;
    const content = evt.message.content;
    if (!Array.isArray(content)) continue;

    for (const raw of content) {
      const c = raw as ToolUseContent;
      if (c.type !== 'tool_use') continue;
      const toolName = c.name?.toLowerCase();
      if (!isTaskToolName(toolName) || !c.id) continue;
      lastTaskToolId = c.id;

      if (toolName === 'todowrite') {
        const todos = (c.input?.todos as TodoItem[] | undefined) ?? null;
        if (todos && Array.isArray(todos)) {
          snapshot = todos;
          snapshotIsLatest = true;
        }
        continue;
      }

      snapshotIsLatest = false;

      if (toolName === 'taskcreate') {
        const input = c.input ?? {};
        const subject = (input.subject as string) ?? '';
        const activeForm = (input.activeForm as string) ?? '';
        const parsed = parseJsonSafe<{ task?: { id?: string } }>(toolResults.get(c.id));
        const id = parsed?.task?.id ?? `pending-${c.id}`;
        byId.set(id, { content: subject, status: 'pending', activeForm });
        if (!order.includes(id)) order.push(id);
      } else if (toolName === 'taskupdate') {
        const input = c.input ?? {};
        const id = input.taskId as string | undefined;
        if (!id) continue;
        const prev = byId.get(id) ?? { content: '', status: 'pending', activeForm: '' };
        const nextStatus = input.status as TodoItem['status'] | 'deleted' | undefined;
        if (nextStatus === 'deleted') {
          byId.delete(id);
          const i = order.indexOf(id);
          if (i >= 0) order.splice(i, 1);
          continue;
        }
        byId.set(id, {
          content: (input.subject as string) ?? prev.content,
          status: nextStatus ?? prev.status,
          activeForm: (input.activeForm as string) ?? prev.activeForm,
        });
        if (!order.includes(id)) order.push(id);
      } else if (toolName === 'tasklist') {
        const parsed = parseJsonSafe<{ tasks?: Array<{ id?: string; subject?: string; status?: TodoItem['status'] }> }>(
          toolResults.get(c.id)
        );
        if (parsed?.tasks && Array.isArray(parsed.tasks)) {
          byId.clear();
          order.length = 0;
          for (const t of parsed.tasks) {
            if (!t.id) continue;
            byId.set(t.id, {
              content: t.subject ?? '',
              status: t.status ?? 'pending',
              activeForm: '',
            });
            order.push(t.id);
          }
        }
      }
    }
  }

  if (snapshotIsLatest && snapshot) {
    return { todos: snapshot, lastTaskToolId };
  }

  return {
    todos: order
      .map((id) => byId.get(id))
      .filter((t): t is TodoItem => t !== undefined),
    lastTaskToolId,
  };
}

// Single-message variant for ChatView's currentTodos (StaminaBar):
// reads only the last assistant message's events instead of the full session stream.
export function accumulateTodosFromMessageEvents(
  events: unknown[],
  toolResults: Map<string, string>
): TodoItem[] {
  return accumulateTodos(events, toolResults).todos;
}
