/**
 * AnalyticsServiceLive - Anonymous PostHog telemetry layer.
 *
 * Persists a random installation-scoped anonymous id to state dir, buffers
 * events in memory, and flushes batches to PostHog over Effect HttpClient.
 *
 * @module AnalyticsServiceLive
 */

import { Config, DateTime, Effect, Layer, Ref } from "effect";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http";

import { ServerConfig } from "../../config.ts";
import { AnalyticsService, type AnalyticsServiceShape } from "../Services/AnalyticsService.ts";
import { getTelemetryIdentifier } from "../Identify.ts";
import { version } from "../../../package.json" with { type: "json" };

interface BufferedAnalyticsEvent {
  readonly event: string;
  readonly properties?: Readonly<Record<string, unknown>>;
  readonly capturedAt: string;
}

const FLUSH_INTERVAL_MS = 1_000;
const MAX_FLUSH_BACKOFF_MS = 300_000;
/** Log the first failure of a streak, then one in ten. */
const FLUSH_FAILURE_LOG_EVERY = 10;

/**
 * Backoff between flush attempts. Without it a dead PostHog endpoint is retried
 * every second forever, and each failure prints a ~2.5KB stack: the server log
 * grows ~10MB per hour and buries every real diagnostic under it.
 */
export function telemetryFlushDelayMs(consecutiveFailures: number): number {
  if (consecutiveFailures <= 0) {
    return FLUSH_INTERVAL_MS;
  }
  return Math.min(FLUSH_INTERVAL_MS * 2 ** consecutiveFailures, MAX_FLUSH_BACKOFF_MS);
}

export function shouldLogTelemetryFlushFailure(consecutiveFailures: number): boolean {
  return consecutiveFailures === 1 || consecutiveFailures % FLUSH_FAILURE_LOG_EVERY === 0;
}

const TelemetryEnvConfig = Config.all({
  posthogKey: Config.string("SYNARA_POSTHOG_KEY").pipe(
    Config.withDefault("phc_XAkRh21xG4XgQXT81heC39RYx5UnPHQHXYyyzIy4eC7"),
  ),
  posthogHost: Config.string("SYNARA_POSTHOG_HOST").pipe(
    Config.withDefault("https://eu.i.posthog.com"),
  ),
  enabled: Config.boolean("SYNARA_TELEMETRY_ENABLED").pipe(Config.withDefault(true)),
  flushBatchSize: Config.number("SYNARA_TELEMETRY_FLUSH_BATCH_SIZE").pipe(Config.withDefault(20)),
  maxBufferedEvents: Config.number("SYNARA_TELEMETRY_MAX_BUFFERED_EVENTS").pipe(
    Config.withDefault(1_000),
  ),
});

const makeAnalyticsService = Effect.gen(function* () {
  const telemetryConfig = yield* TelemetryEnvConfig.asEffect();
  const httpClient = yield* HttpClient.HttpClient;
  const serverConfig = yield* ServerConfig;
  const identifier = yield* getTelemetryIdentifier;
  const bufferRef = yield* Ref.make<ReadonlyArray<BufferedAnalyticsEvent>>([]);
  const clientType = serverConfig.mode === "desktop" ? "desktop-app" : "cli-web-client";

  const enqueueBufferedEvent = (event: string, properties?: Readonly<Record<string, unknown>>) =>
    Effect.flatMap(DateTime.now, (now) =>
      Ref.modify(bufferRef, (current) => {
        const appended = [
          ...current,
          {
            event,
            ...(properties ? { properties } : {}),
            capturedAt: DateTime.formatIso(now),
          } satisfies BufferedAnalyticsEvent,
        ];

        const next =
          appended.length > telemetryConfig.maxBufferedEvents
            ? appended.slice(appended.length - telemetryConfig.maxBufferedEvents)
            : appended;

        return [
          {
            size: next.length,
            dropped: next.length !== appended.length,
          } as const,
          next,
        ] as const;
      }),
    );

  const sendBatch = (events: ReadonlyArray<BufferedAnalyticsEvent>) =>
    Effect.gen(function* () {
      if (!telemetryConfig.enabled || !identifier) return;

      const payload = {
        api_key: telemetryConfig.posthogKey,
        batch: events.map((event) => ({
          event: event.event,
          distinct_id: identifier,
          properties: {
            ...event.properties,
            $process_person_profile: false,
            platform: process.platform,
            wsl: process.env.WSL_DISTRO_NAME,
            arch: process.arch,
            synaraCodeVersion: version,
            clientType,
          },
          timestamp: event.capturedAt,
        })),
      };

      yield* HttpClientRequest.post(`${telemetryConfig.posthogHost}/batch/`).pipe(
        HttpClientRequest.bodyJson(payload),
        Effect.flatMap(httpClient.execute),
        Effect.flatMap(HttpClientResponse.filterStatusOk),
      );
    });

  const flushOnce = Effect.gen(function* () {
    while (true) {
      const batch = yield* Ref.modify(bufferRef, (current) => {
        if (current.length === 0) {
          return [[] as ReadonlyArray<BufferedAnalyticsEvent>, current] as const;
        }
        const nextBatch = current.slice(0, telemetryConfig.flushBatchSize);
        const remaining = current.slice(nextBatch.length);
        return [nextBatch, remaining] as const;
      });

      if (batch.length === 0) {
        return;
      }

      yield* sendBatch(batch).pipe(
        Effect.catch((error) =>
          Ref.update(bufferRef, (current) => [...batch, ...current]).pipe(
            Effect.flatMap(() => Effect.fail(error)),
          ),
        ),
      );
    }
  });

  const flush: AnalyticsServiceShape["flush"] = flushOnce.pipe(
    Effect.catch((cause) => Effect.logError("Failed to flush telemetry", { cause })),
  );

  const record: AnalyticsServiceShape["record"] = Effect.fnUntraced(function* (event, properties) {
    if (!telemetryConfig.enabled || !identifier) return;

    const enqueueResult = yield* enqueueBufferedEvent(event, properties);
    if (enqueueResult.dropped) {
      yield* Effect.logDebug("analytics buffer full; dropping oldest event", {
        size: enqueueResult.size,
        event,
      });
    }
  });

  const consecutiveFlushFailuresRef = yield* Ref.make(0);

  const recordFlushFailure = (cause: unknown) =>
    Ref.modify(consecutiveFlushFailuresRef, (current) => {
      const next = current + 1;
      return [next, next] as const;
    }).pipe(
      Effect.flatMap((failures) =>
        shouldLogTelemetryFlushFailure(failures)
          ? Effect.logError("Failed to flush telemetry", {
              cause,
              consecutiveFailures: failures,
            })
          : Effect.void,
      ),
    );

  const flushWithBackoff = Effect.gen(function* () {
    const failures = yield* Ref.get(consecutiveFlushFailuresRef);
    yield* Effect.sleep(telemetryFlushDelayMs(failures));
    yield* flushOnce.pipe(
      Effect.flatMap(() => Ref.set(consecutiveFlushFailuresRef, 0)),
      Effect.catch(recordFlushFailure),
    );
  });

  yield* Effect.forever(flushWithBackoff, { disableYield: true }).pipe(Effect.forkScoped);

  yield* Effect.addFinalizer(() => flush);

  return {
    record,
    flush,
  } satisfies AnalyticsServiceShape;
});

export const AnalyticsServiceLayerLive = Layer.effect(AnalyticsService, makeAnalyticsService);
