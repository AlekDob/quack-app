import { ORCHESTRATION_WS_METHODS, WS_METHODS } from "@synara/contracts";
import { Deferred, Effect, Fiber } from "effect";
import { describe, expect, it } from "vitest";

import {
  classifyWsRequest,
  makeWsRequestAdmission,
  WS_REQUEST_CLASS_LIMITS,
} from "./wsRequestAdmission";

describe("WsRequestAdmission", () => {
  it("keeps lightweight shell reads out of the expensive lane", () => {
    expect(classifyWsRequest(ORCHESTRATION_WS_METHODS.getShellSnapshot)).toBe("standard");
    expect(classifyWsRequest(ORCHESTRATION_WS_METHODS.getThreadDetailSnapshot)).toBe(
      "expensive-read",
    );
    expect(classifyWsRequest(ORCHESTRATION_WS_METHODS.getTurnDiff)).toBe("expensive-read");
    expect(classifyWsRequest(ORCHESTRATION_WS_METHODS.repairState)).toBe("expensive-read");
    expect(classifyWsRequest(WS_METHODS.serverPrewarmVoice)).toBe("expensive-read");
    expect(classifyWsRequest(WS_METHODS.terminalAckOutput)).toBe("control");
  });

  it("reserves independent capacity for control traffic during an expensive-read flood", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const admission = yield* makeWsRequestAdmission;
        expect(WS_REQUEST_CLASS_LIMITS["expensive-read"]).toBe(10);
        const leases = yield* Effect.all(
          Array.from({ length: WS_REQUEST_CLASS_LIMITS["expensive-read"] }, (_, index) =>
            admission.acquire(
              1,
              index % 2 === 0
                ? ORCHESTRATION_WS_METHODS.getSnapshot
                : WS_METHODS.statsGetProfileStats,
            ),
          ),
        );
        const rejected = yield* admission
          .acquire(1, WS_METHODS.gitReadWorkingTreeDiff)
          .pipe(Effect.exit);

        expect(rejected._tag).toBe("Failure");
        if (rejected._tag === "Failure") {
          expect(String(rejected.cause)).toContain("RPC_EXPENSIVE_READ_CAPACITY_EXCEEDED");
        }

        const control = yield* admission.acquire(1, WS_METHODS.terminalAckOutput);
        expect(control.requestClass).toBe("control");
        yield* Effect.forEach(leases, admission.release);
        yield* admission.release(control);
        expect(yield* admission.snapshot).toMatchObject({
          active: 0,
          admittedTotal: WS_REQUEST_CLASS_LIMITS["expensive-read"] + 1,
          releasedTotal: WS_REQUEST_CLASS_LIMITS["expensive-read"] + 1,
          rejectedTotal: 1,
        });
      }),
    );
  });

  it("keeps client budgets independent and releases failed work exactly once", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const admission = yield* makeWsRequestAdmission;
        const clientOne = yield* admission.acquire(1, ORCHESTRATION_WS_METHODS.getSnapshot);
        const clientTwo = yield* admission.acquire(2, ORCHESTRATION_WS_METHODS.getSnapshot);

        const failed = yield* admission
          .guard(1, WS_METHODS.gitStatus, Effect.fail("expected"))
          .pipe(Effect.exit);
        expect(failed._tag).toBe("Failure");

        yield* admission.release(clientOne);
        yield* admission.release(clientTwo);
        expect(yield* admission.snapshot).toMatchObject({
          clients: 0,
          active: 0,
          admittedTotal: 3,
          releasedTotal: 3,
        });
      }),
    );
  });

  it("releases an interrupted request lease exactly once", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const admission = yield* makeWsRequestAdmission;
        const started = yield* Deferred.make<void>();
        const fiber = yield* admission
          .guard(
            1,
            ORCHESTRATION_WS_METHODS.getSnapshot,
            Deferred.succeed(started, undefined).pipe(Effect.andThen(Effect.never)),
          )
          .pipe(Effect.forkChild);

        yield* Deferred.await(started);
        expect(yield* admission.snapshot).toMatchObject({ active: 1, releasedTotal: 0 });
        yield* Fiber.interrupt(fiber);
        expect(yield* admission.snapshot).toMatchObject({
          active: 0,
          admittedTotal: 1,
          releasedTotal: 1,
        });
      }),
    );
  });
});
