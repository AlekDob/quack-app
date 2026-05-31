/**
 * sessionStatusWrites — single source of truth for writing agent session
 * activity state into chatStore. Shared by the two status sources:
 *   - useHookStatusListener   (Claude Code hooks: instant, but lossy)
 *   - useScreenStateArbitration (xterm buffer scan: ~1s lag, but ground truth)
 *
 * herdr's lesson (github.com/ogulcancelik/herdr): hooks alone are unreliable
 * (missed Stop, out-of-order delivery, events that never fire for plan/question
 * prompts). The terminal SCREEN is the authority; hooks merely accelerate it.
 * Both sources funnel through these helpers so the four chatStore maps stay
 * consistent regardless of who wrote last.
 *
 * All writes are IDEMPOTENT: they no-op when the store already holds the target
 * value. This keeps the ~1s arbitration loop from spamming setLoading (and its
 * state-updater console.log) or triggering needless re-renders.
 *
 * Brain: 069-embedded-cli-hooks-pivot
 */
import { useChatStore } from '../stores/chatStore';

// Synthetic pending-question id for the "needs attention" (blocked) state.
// pendingQuestionsMap is a Set, so one stable id is enough to surface the dot.
export const WAITING_ID = 'hook:waiting';

type Store = ReturnType<typeof useChatStore.getState>;

const isLoading = (store: Store, key: string): boolean => store.chatLoadingMap.get(key) === true;
const isBlocked = (store: Store, key: string): boolean =>
  (store.pendingQuestionsMap.get(key)?.size ?? 0) > 0;

/** Contentless `user` marker so the session is not treated as dormant (the
 *  green "ready" dot requires a non-dormant turn). Chat UI is hidden in
 *  embedded mode, so empty content is invisible. */
const ensureOpenUserTurn = (store: Store, key: string): void => {
  const msgs = store.getSession(key);
  const last = msgs[msgs.length - 1];
  if (last && last.role === 'user') return;
  store.addMessage(key, {
    id: `status-user-${Date.now()}`,
    role: 'user',
    content: '',
    timestamp: Date.now(),
    status: 'complete',
  });
};

/** Contentless complete `assistant` marker so the dot turns green (agent done).
 *  Real last-message/tokens come from the transcript backfill on Stop. */
const ensureDoneMarker = (store: Store, key: string): void => {
  const msgs = store.getSession(key);
  const last = msgs[msgs.length - 1];
  const alreadyDone =
    last && last.role === 'assistant' && (last.status === 'complete' || last.status === undefined);
  if (alreadyDone) return;
  store.addMessage(key, {
    id: `status-done-${Date.now()}`,
    role: 'assistant',
    content: '',
    timestamp: Date.now(),
    status: 'complete',
  });
};

/** Agent actively working → yellow. */
export function markWorking(key: string): void {
  const store = useChatStore.getState();
  if (isBlocked(store, key)) store.setPendingQuestion(key, WAITING_ID, false);
  ensureOpenUserTurn(store, key);
  if (!isLoading(store, key)) store.setLoading(key, true);
}

/** Agent blocked waiting for a user decision (permission / plan / question) → purple. */
export function markBlocked(key: string): void {
  const store = useChatStore.getState();
  if (isLoading(store, key)) store.setLoading(key, false);
  if (!isBlocked(store, key)) store.setPendingQuestion(key, WAITING_ID, true);
}

/** Agent finished its turn → green (ready). */
export function markDone(key: string): void {
  const store = useChatStore.getState();
  if (isBlocked(store, key)) store.setPendingQuestion(key, WAITING_ID, false);
  if (isLoading(store, key)) store.setLoading(key, false);
  ensureDoneMarker(store, key);
}

/** Agent process gone (SessionEnd) → clear activity, no done marker. */
export function markReleased(key: string): void {
  const store = useChatStore.getState();
  if (isBlocked(store, key)) store.setPendingQuestion(key, WAITING_ID, false);
  if (isLoading(store, key)) store.setLoading(key, false);
}
