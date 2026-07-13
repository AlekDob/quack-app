// Cross-component bus for "send this to the AI chat" requests.
//
// Used by editor right-click actions (Ask AI to explain / refactor /
// fix / write tests / add docs) so they can hand a pre-built prompt
// to the active chat panel without prop drilling through the layout
// tree. The chat panel listens, prefills its composer, focuses it,
// and — if the request was an "auto-send" — dispatches the message
// immediately.
//
// Why a bus instead of a callback: the editor and the chat panel are
// in different branches of the component tree (editor pane vs. side
// dock or pop-out window) and there's already a workspace-scoped
// store handling persistent state. A tiny pub/sub keeps this purely
// transient — no state to serialise, no extra store slice.
//
// Workspace scoping: every event carries a wsId so that an editor
// in workspace A can't accidentally hijack the chat panel in
// workspace B (e.g., when the user has multiple workspace windows
// open). Each AIChatPanel instance subscribes and discards events
// targeting other workspaces.

export interface AIPromptImageMeta {
  id: string;
  path: string;
  name: string;
}

export interface AIPromptRequest {
  /** Workspace this request is targeting; chat panels in other
   *  workspaces ignore the event. */
  wsId: string;
  /** When set, only the chat tab with this id handles the request.
   *  Used by queue multitasking so a parallel new chat receives the
   *  prompt without the busy panel stealing it. */
  chatId?: string;
  /** Pre-composed prompt body to drop into the composer. */
  text: string;
  /** Disk paths for queued image follow-ups (multitask / external send). */
  images?: AIPromptImageMeta[];
  /** When true, immediately dispatch the message after filling.
   *  When false, leave it in the composer so the user can edit
   *  before sending. */
  send: boolean;
}

type Listener = (req: AIPromptRequest) => void;

const listeners = new Set<Listener>();

// Brief replay buffer for requests that fire before the chat panel has
// finished subscribing — common when the editor action toggles the AI
// panel visible *and* dispatches in the same tick. Each entry expires
// after 1.5s so a forgotten request can't sit around silently and
// surprise a future panel mount.
interface BufferedRequest {
  req: AIPromptRequest;
  expiresAt: number;
}
const buffer: BufferedRequest[] = [];
const BUFFER_TTL_MS = 1500;

function pruneBuffer(now: number) {
  let i = 0;
  while (i < buffer.length && buffer[i].expiresAt <= now) i++;
  if (i > 0) buffer.splice(0, i);
}

export function requestAIPrompt(req: AIPromptRequest): void {
  if (listeners.size === 0) {
    buffer.push({ req, expiresAt: Date.now() + BUFFER_TTL_MS });
    return;
  }
  for (const l of listeners) l(req);
}

export function onAIPromptRequest(cb: Listener): () => void {
  listeners.add(cb);
  // Drain any requests that arrived before this subscriber existed.
  // Done in a microtask so the caller's effect cleanup runs first if
  // the subscription is re-established mid-render.
  const now = Date.now();
  pruneBuffer(now);
  if (buffer.length > 0) {
    const drain = buffer.splice(0, buffer.length);
    queueMicrotask(() => {
      for (const entry of drain) cb(entry.req);
    });
  }
  return () => listeners.delete(cb);
}
