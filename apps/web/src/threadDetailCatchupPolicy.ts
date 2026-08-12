// FILE: threadDetailCatchupPolicy.ts
// Purpose: decide when a subscribed thread must be polled / reconciled to catch
// up with the server. Pure so the rules can be tested without the router.
//
// The rules used to read only the client's own view of the thread ("is it
// running?"). That is self-defeating: a client whose event stream died believes
// the thread is idle, so nothing polls, so the missing events never arrive. The
// unacknowledged-send flag breaks that loop — the user pressed send, the server
// never answered, so ask.

export interface CatchupThreadView {
  readonly orchestrationStatus?: string | null | undefined;
  readonly latestTurnState?: string | null | undefined;
  readonly hasStreamingAssistantMessage?: boolean | undefined;
}

export function shouldPollThreadDetailCatchupFor(
  thread: CatchupThreadView | null,
  hasUnacknowledgedSend: boolean,
): boolean {
  if (hasUnacknowledgedSend) {
    return true;
  }
  return thread?.orchestrationStatus === "running" || thread?.latestTurnState === "running";
}

export function shouldReconcileThreadProjectionFor(
  thread: CatchupThreadView | null,
  hasUnacknowledgedSend: boolean,
): boolean {
  if (hasUnacknowledgedSend) {
    return true;
  }
  return (
    thread?.orchestrationStatus === "starting" ||
    thread?.orchestrationStatus === "running" ||
    thread?.latestTurnState === "running" ||
    thread?.hasStreamingAssistantMessage === true
  );
}
