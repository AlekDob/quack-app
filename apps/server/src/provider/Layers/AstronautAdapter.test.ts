import { ThreadId } from "@synara/contracts";
import { Effect, Fiber, Stream } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import { makeAstronautAdapter } from "./AstronautAdapter";

describe("AstronautAdapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("publishes Companion SSE tokens as assistant runtime events", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            [
              'event: session\ndata: {"sessionId":"remote-session"}',
              'event: token\ndata: {"text":"Ciao da Companion"}',
              "event: done\ndata: {}",
              "",
            ].join("\n\n"),
            { headers: { "content-type": "text/event-stream" } },
          ),
      ),
    );

    const events = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const adapter = yield* makeAstronautAdapter;
          const threadId = ThreadId.makeUnsafe("thread-companion");
          const eventsFiber = yield* Stream.runCollect(Stream.take(adapter.streamEvents, 5)).pipe(
            Effect.forkChild,
          );
          yield* adapter.startSession({
            threadId,
            provider: "astronaut",
            modelSelection: {
              provider: "astronaut",
              model: "opencode/deepseek-v4-flash-free",
            },
            providerOptions: { astronaut: { serverUrl: "http://companion.test" } },
            runtimeMode: "full-access",
          });
          yield* adapter.sendTurn({ threadId, input: "ciao" });
          return Array.from(yield* Fiber.join(eventsFiber));
        }),
      ),
    );

    expect(events).toMatchObject([
      { type: "session.started" },
      { type: "turn.started" },
      { type: "session.configured" },
      {
        type: "content.delta",
        payload: { streamKind: "assistant_text", delta: "Ciao da Companion" },
      },
      { type: "turn.completed", payload: { state: "completed" } },
    ]);
  });
});
