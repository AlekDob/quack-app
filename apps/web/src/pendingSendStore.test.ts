import { ThreadId } from "@synara/contracts";
import { beforeEach, describe, expect, it } from "vitest";

import { hasUnacknowledgedSend, usePendingSendStore } from "./pendingSendStore";

const THREAD_ID = ThreadId.makeUnsafe("thread-1");

describe("pending send store", () => {
  beforeEach(() => {
    usePendingSendStore.setState({ pendingSendThreadIds: {}, unacknowledgedSendThreadIds: {} });
  });

  it("tracks unacknowledged sends per thread", () => {
    expect(hasUnacknowledgedSend(THREAD_ID)).toBe(false);
    usePendingSendStore.getState().markUnacknowledgedSend(THREAD_ID);
    expect(hasUnacknowledgedSend(THREAD_ID)).toBe(true);
    usePendingSendStore.getState().clearUnacknowledgedSend(THREAD_ID);
    expect(hasUnacknowledgedSend(THREAD_ID)).toBe(false);
  });

  it("keeps the two flags independent", () => {
    usePendingSendStore.getState().markPendingSend(THREAD_ID);
    expect(hasUnacknowledgedSend(THREAD_ID)).toBe(false);
    expect(usePendingSendStore.getState().pendingSendThreadIds[THREAD_ID]).toBe(true);
  });

  it("does not allocate a new object when nothing changes", () => {
    usePendingSendStore.getState().markUnacknowledgedSend(THREAD_ID);
    const first = usePendingSendStore.getState().unacknowledgedSendThreadIds;
    usePendingSendStore.getState().markUnacknowledgedSend(THREAD_ID);
    expect(usePendingSendStore.getState().unacknowledgedSendThreadIds).toBe(first);
  });
});
