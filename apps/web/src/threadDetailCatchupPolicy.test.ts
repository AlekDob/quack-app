import { describe, expect, it } from "vitest";

import {
  shouldPollThreadDetailCatchupFor,
  shouldReconcileThreadProjectionFor,
} from "./threadDetailCatchupPolicy";

describe("thread detail catch-up policy", () => {
  it("polls a thread the client already believes is running", () => {
    expect(shouldPollThreadDetailCatchupFor({ orchestrationStatus: "running" }, false)).toBe(true);
    expect(shouldPollThreadDetailCatchupFor({ latestTurnState: "running" }, false)).toBe(true);
  });

  it("does not poll an idle thread with nothing outstanding", () => {
    expect(
      shouldPollThreadDetailCatchupFor(
        { orchestrationStatus: "ready", latestTurnState: "completed" },
        false,
      ),
    ).toBe(false);
  });

  // Regression: the client's event stream dies mid-send, so its own view stays
  // "idle" while the server runs the turn. Reading only that view meant nothing
  // ever polled and the composer spinner stayed up until an unrelated snapshot
  // arrived — observed as a multi-minute freeze.
  it("polls a thread that looks idle but has an unacknowledged send", () => {
    expect(
      shouldPollThreadDetailCatchupFor(
        { orchestrationStatus: "ready", latestTurnState: "completed" },
        true,
      ),
    ).toBe(true);
  });

  it("polls an unknown thread with an unacknowledged send", () => {
    expect(shouldPollThreadDetailCatchupFor(null, true)).toBe(true);
    expect(shouldPollThreadDetailCatchupFor(null, false)).toBe(false);
  });

  it("reconciles a thread that looks idle but has an unacknowledged send", () => {
    expect(shouldReconcileThreadProjectionFor({ orchestrationStatus: "ready" }, false)).toBe(false);
    expect(shouldReconcileThreadProjectionFor({ orchestrationStatus: "ready" }, true)).toBe(true);
  });

  it("keeps reconciling starting sessions and streaming answers", () => {
    expect(shouldReconcileThreadProjectionFor({ orchestrationStatus: "starting" }, false)).toBe(
      true,
    );
    expect(shouldReconcileThreadProjectionFor({ hasStreamingAssistantMessage: true }, false)).toBe(
      true,
    );
  });
});
