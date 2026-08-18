import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, describe, it } from "@effect/vitest";
import { ConfigProvider, Effect, Layer } from "effect";
import * as HttpServer from "effect/unstable/http/HttpServer";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";

import { ServerConfig } from "../../config.ts";
import { getTelemetryIdentifier } from "../Identify.ts";
import { AnalyticsService } from "../Services/AnalyticsService.ts";
import {
  AnalyticsServiceLayerLive,
  shouldLogTelemetryFlushFailure,
  telemetryFlushDelayMs,
} from "./AnalyticsService.ts";

// Regression: a dead PostHog endpoint used to be retried every second forever,
// printing a ~2.5KB stack each time. One incident log held 4149 of them and
// buried every real diagnostic under the noise.
describe("telemetry flush retry pacing", () => {
  it("backs off after consecutive failures and caps the delay", () => {
    assert.equal(telemetryFlushDelayMs(0), 1_000);
    assert.equal(telemetryFlushDelayMs(1), 2_000);
    assert.equal(telemetryFlushDelayMs(4), 16_000);
    assert.equal(telemetryFlushDelayMs(99), 300_000);
  });

  it("logs the first failure then one in ten", () => {
    assert.equal(shouldLogTelemetryFlushFailure(1), true);
    assert.equal(shouldLogTelemetryFlushFailure(2), false);
    assert.equal(shouldLogTelemetryFlushFailure(9), false);
    assert.equal(shouldLogTelemetryFlushFailure(10), true);
  });
});

interface RecordedBatchRequest {
  readonly path: string;
  readonly body: {
    readonly batch?: ReadonlyArray<{
      readonly event?: string;
      readonly properties?: {
        readonly index?: number;
        readonly clientType?: string;
      };
    }>;
  } | null;
}

interface RecordedBatchBody {
  readonly batch: ReadonlyArray<{
    readonly event?: string;
    readonly properties?: {
      readonly index?: number;
      readonly clientType?: string;
    };
  }>;
}

it.layer(NodeServices.layer)("AnalyticsService test", (it) => {
  it.effect("flush drains all buffered events across multiple batches", () =>
    Effect.gen(function* () {
      const capturedRequests: Array<RecordedBatchRequest> = [];
      const serverConfigLayer = ServerConfig.layerTest(process.cwd(), {
        prefix: "synara-telemetry-base-",
      });

      const telemetryLayer = AnalyticsServiceLayerLive.pipe(Layer.provideMerge(serverConfigLayer));
      const configLayer = ConfigProvider.layer(
        ConfigProvider.fromUnknown({
          SYNARA_TELEMETRY_ENABLED: true,
          SYNARA_POSTHOG_KEY: "phc_test_key",
          SYNARA_POSTHOG_HOST: "",
          SYNARA_TELEMETRY_FLUSH_BATCH_SIZE: 20,
        }),
      );
      const batchServerLayer = HttpServer.serve(
        Effect.gen(function* () {
          const request = yield* HttpServerRequest.HttpServerRequest;
          if (request.method !== "POST") {
            return HttpServerResponse.empty({ status: 404 });
          }

          const payload = yield* request.json.pipe(
            Effect.map((body) => body as RecordedBatchRequest["body"]),
            Effect.catch(() => Effect.succeed(null)),
          );

          capturedRequests.push({ path: request.url, body: payload });

          return HttpServerResponse.jsonUnsafe({});
        }),
      );
      const runtimeLayer = telemetryLayer.pipe(
        Layer.provide(configLayer),
        Layer.provideMerge(NodeHttpServer.layerTest),
      );

      yield* Effect.gen(function* () {
        yield* Layer.launch(batchServerLayer).pipe(Effect.forkScoped);
        const telemetryIdentifier = yield* getTelemetryIdentifier;
        assert.equal(telemetryIdentifier !== null, true);
        const analytics = yield* AnalyticsService;

        for (let index = 0; index < 45; index += 1) {
          yield* analytics.record("test.flush.drain", { index });
        }

        yield* analytics.flush;
      }).pipe(Effect.provide(runtimeLayer));

      const batchRequests = capturedRequests.filter(
        (request): request is RecordedBatchRequest & { readonly body: RecordedBatchBody } =>
          Array.isArray(request.body?.batch),
      );
      assert.equal(batchRequests.length, 3);
      assert.equal(
        batchRequests.every((request) => request.path === "/batch/" || request.path === "/batch"),
        true,
      );
      const deliveredIndexes = batchRequests.flatMap((request) =>
        request.body.batch
          .filter((event) => event.event === "test.flush.drain")
          .map((event) => event.properties?.index)
          .filter((index): index is number => typeof index === "number"),
      );

      const sorted = deliveredIndexes.toSorted((a, b) => a - b);
      assert.equal(sorted.length, 45);
      assert.deepEqual(
        sorted,
        Array.from({ length: 45 }, (_, index) => index),
      );
      assert.equal(
        batchRequests.every((request) =>
          request.body.batch.every((event) => event.properties?.clientType === "cli-web-client"),
        ),
        true,
      );
    }),
  );

  it.effect("sends nothing when no telemetry env vars are set", () =>
    Effect.gen(function* () {
      const capturedRequests: Array<RecordedBatchRequest> = [];
      const serverConfigLayer = ServerConfig.layerTest(process.cwd(), {
        prefix: "synara-telemetry-optin-",
      });

      const telemetryLayer = AnalyticsServiceLayerLive.pipe(Layer.provideMerge(serverConfigLayer));
      // Empty provider: telemetry must stay off on a plain checkout.
      const configLayer = ConfigProvider.layer(ConfigProvider.fromUnknown({}));
      const batchServerLayer = HttpServer.serve(
        Effect.gen(function* () {
          const request = yield* HttpServerRequest.HttpServerRequest;
          capturedRequests.push({ path: request.url, body: null });
          return HttpServerResponse.jsonUnsafe({});
        }),
      );
      const runtimeLayer = telemetryLayer.pipe(
        Layer.provide(configLayer),
        Layer.provideMerge(NodeHttpServer.layerTest),
      );

      yield* Effect.gen(function* () {
        yield* Layer.launch(batchServerLayer).pipe(Effect.forkScoped);
        const analytics = yield* AnalyticsService;
        yield* analytics.record("test.optin.off", {});
        yield* analytics.flush;
      }).pipe(Effect.provide(runtimeLayer));

      assert.equal(capturedRequests.length, 0);
    }),
  );
});
