import { Effect, Layer, Queue, Stream } from "effect";
import {
  EventId,
  IsoDateTime,
  ThreadId,
  RuntimeRequestId,
  TurnId,
  type ProviderListModelsResult,
  type ProviderModelDescriptor,
  type ProviderRuntimeEvent,
  type ProviderSession,
} from "@synara/contracts";
import { ProviderAdapterRequestError, ProviderAdapterSessionNotFoundError } from "../Errors.ts";
import {
  DEFAULT_ASTRONAUT_URL,
  astronautApprovalReply,
  astronautChatRequest,
  astronautQuestionReply,
  createAstronautSseParser,
} from "../astronautRemote.ts";
import { AstronautAdapter, type AstronautAdapterShape } from "../Services/AstronautAdapter.ts";
import {
  PROVIDER_ADAPTER_RUNTIME_EVENT_BUFFER_CAPACITY,
  type ProviderThreadSnapshot,
} from "../Services/ProviderAdapter.ts";
import { makeBoundedCallbackIngress } from "../boundedCallbackIngress.ts";
import {
  compactProviderRuntimeEventForIngress,
  isTerminalProviderRuntimeEvent,
  PROVIDER_RUNTIME_CALLBACK_BUFFER_MAX_BYTES,
  PROVIDER_RUNTIME_CALLBACK_TERMINAL_RESERVE,
  providerRuntimeEventBytes,
} from "../providerRuntimeEventIngress.ts";

type JsonRecord = Record<string, unknown>;
type AstronautContext = {
  // Reassigned (not mutated) when the remote hands us its session id: ProviderSession is readonly.
  session: ProviderSession;
  readonly url: string;
  remoteSessionId?: string;
  abortController?: AbortController;
  turnId?: TurnId;
};

const REQUEST_TIMEOUT_MS = 10_000;
const now = (): IsoDateTime => new Date().toISOString() as IsoDateTime;
const eventId = () => EventId.makeUnsafe(crypto.randomUUID());
const asRecord = (value: unknown): JsonRecord =>
  value !== null && typeof value === "object" ? (value as JsonRecord) : {};
const stringValue = (value: unknown): string => {
  if (typeof value === "string") return value;
  const record = asRecord(value);
  return typeof record.text === "string"
    ? record.text
    : typeof record.content === "string"
      ? record.content
      : "";
};
const normalizeUrl = (value: unknown): string => {
  try {
    const url = new URL(typeof value === "string" && value.trim() ? value : DEFAULT_ASTRONAUT_URL);
    return url.toString().replace(/\/$/, "");
  } catch {
    return DEFAULT_ASTRONAUT_URL;
  }
};
const remoteIdFromCursor = (cursor: unknown): string | undefined => {
  if (typeof cursor === "string" && cursor.trim()) return cursor;
  const value = asRecord(cursor).astronautSessionId;
  return typeof value === "string" && value.trim() ? value : undefined;
};

export const makeAstronautAdapter = Effect.gen(function* () {
  const queue = yield* Queue.bounded<ProviderRuntimeEvent>(
    PROVIDER_ADAPTER_RUNTIME_EVENT_BUFFER_CAPACITY,
  );
  const eventIngress = yield* makeBoundedCallbackIngress<ProviderRuntimeEvent, never, never>(
    (event) => Queue.offer(queue, event).pipe(Effect.asVoid),
    {
      capacity: PROVIDER_ADAPTER_RUNTIME_EVENT_BUFFER_CAPACITY,
      maxBufferedBytes: PROVIDER_RUNTIME_CALLBACK_BUFFER_MAX_BYTES,
      terminalReserve: PROVIDER_RUNTIME_CALLBACK_TERMINAL_RESERVE,
      isTerminal: isTerminalProviderRuntimeEvent,
      sizeOf: providerRuntimeEventBytes,
    },
  );
  const sessions = new Map<ThreadId, AstronautContext>();

  const emit = (
    context: AstronautContext,
    type: ProviderRuntimeEvent["type"],
    payload: unknown,
    extra: Partial<ProviderRuntimeEvent> = {},
  ) => {
    eventIngress.offer(
      compactProviderRuntimeEventForIngress({
        eventId: eventId(),
        provider: "astronaut",
        threadId: context.session.threadId,
        createdAt: now(),
        ...(context.turnId ? { turnId: context.turnId } : {}),
        type,
        payload,
        ...extra,
      } as ProviderRuntimeEvent),
    );
  };
  const error = (method: string, cause: unknown) =>
    new ProviderAdapterRequestError({
      provider: "astronaut",
      method,
      detail: cause instanceof Error ? cause.message : String(cause),
      cause,
    });
  const contextFor = (threadId: ThreadId): AstronautContext => {
    const context = sessions.get(threadId);
    if (!context)
      throw new ProviderAdapterSessionNotFoundError({ provider: "astronaut", threadId });
    return context;
  };
  const fetchUrl = (url: string, path: string, init: RequestInit = {}) =>
    Effect.tryPromise({
      try: async () => {
        const timeout = new AbortController();
        const timer = setTimeout(() => timeout.abort(), REQUEST_TIMEOUT_MS);
        const signal = init.signal;
        const abort = () => timeout.abort();
        signal?.addEventListener("abort", abort, { once: true });
        try {
          const response = await fetch(`${url}${path}`, { ...init, signal: timeout.signal });
          if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
          return response;
        } finally {
          clearTimeout(timer);
          signal?.removeEventListener("abort", abort);
        }
      },
      catch: (cause) => error(path, cause),
    });
  const json = (response: Response, method: string) =>
    Effect.tryPromise({
      try: () => response.json() as Promise<unknown>,
      catch: (cause) => error(method, cause),
    });

  const startSession: AstronautAdapterShape["startSession"] = (input) =>
    Effect.sync(() => {
      const previous = sessions.get(input.threadId);
      const remoteSessionId = remoteIdFromCursor(input.resumeCursor);
      const session: ProviderSession = {
        provider: "astronaut",
        status: "ready",
        runtimeMode: input.runtimeMode,
        threadId: input.threadId,
        ...(input.cwd ? { cwd: input.cwd } : {}),
        ...(input.modelSelection?.provider === "astronaut"
          ? { model: input.modelSelection.model }
          : {}),
        ...(remoteSessionId ? { resumeCursor: { astronautSessionId: remoteSessionId } } : {}),
        createdAt: previous?.session.createdAt ?? now(),
        updatedAt: now(),
      };
      const context: AstronautContext = {
        session,
        url: normalizeUrl(input.providerOptions?.astronaut?.serverUrl),
        ...(remoteSessionId ? { remoteSessionId } : {}),
      };
      sessions.set(input.threadId, context);
      emit(context, "session.started", { resumeCursor: session.resumeCursor });
      return session;
    });

  const sendTurn: AstronautAdapterShape["sendTurn"] = (input) =>
    Effect.gen(function* () {
      const context = contextFor(input.threadId);
      const turnId = TurnId.makeUnsafe(crypto.randomUUID());
      context.turnId = turnId;
      context.abortController?.abort();
      context.abortController = new AbortController();
      emit(context, "turn.started", { model: context.session.model });
      const model =
        input.modelSelection?.provider === "astronaut"
          ? input.modelSelection.model
          : context.session.model;
      const request = astronautChatRequest(context.url, {
        message: input.input ?? "",
        ...(context.remoteSessionId ? { sessionId: context.remoteSessionId } : {}),
        ...(model ? { model } : {}),
      });
      const response = yield* fetchUrl(context.url, "/chat", {
        ...request.init,
        signal: context.abortController.signal,
      });
      let sessionSeen = Boolean(context.remoteSessionId);
      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const parser = createAstronautSseParser((event) => {
          const data = asRecord(event.data);
          const kind = event.type || (typeof data.type === "string" ? data.type : "message");
          const value = data.data ?? event.data;
          const id = data.sessionId ?? data.session_id ?? data.remoteSessionId;
          if (typeof id === "string" && id) {
            context.remoteSessionId = id;
            context.session = { ...context.session, resumeCursor: { astronautSessionId: id } };
            sessionSeen = true;
            emit(context, "session.configured", { astronautSessionId: id });
          }
          const requestId = data.requestId ?? data.request_id ?? data.id;
          if (kind === "token" || kind === "text" || kind === "message")
            emit(context, "content.delta", {
              streamKind: "assistant_text",
              delta: stringValue(value),
            });
          else if (kind === "reasoning")
            emit(context, "content.delta", {
              streamKind: "reasoning_text",
              delta: stringValue(value),
            });
          else if (kind === "tool")
            emit(context, "tool.progress", { detail: stringValue(value), data: value });
          else if (kind === "permission")
            emit(
              context,
              "request.opened",
              { requestType: "permissions", detail: stringValue(value), args: value },
              typeof requestId === "string"
                ? { requestId: RuntimeRequestId.makeUnsafe(requestId) }
                : {},
            );
          else if (kind === "question")
            emit(
              context,
              "user-input.requested",
              { questions: data.questions ?? value },
              typeof requestId === "string"
                ? { requestId: RuntimeRequestId.makeUnsafe(requestId) }
                : {},
            );
          else if (kind === "interaction-resolved")
            emit(
              context,
              "request.resolved",
              { requestType: data.requestType ?? "permissions", resolution: value },
              typeof requestId === "string"
                ? { requestId: RuntimeRequestId.makeUnsafe(requestId) }
                : {},
            );
          else if (kind === "done")
            emit(context, "turn.completed", {
              state: "completed",
              stopReason: data.stopReason ?? null,
            });
          else if (kind === "error")
            emit(context, "runtime.error", {
              message: stringValue(value) || "Astronaut request failed.",
            });
        });
        try {
          for (;;) {
            const part = yield* Effect.tryPromise({
              try: () => reader.read(),
              catch: (cause) => error("/chat", cause),
            });
            if (part.done) break;
            parser.push(decoder.decode(part.value, { stream: true }));
          }
          parser.end();
        } finally {
          reader.releaseLock();
        }
      }
      return {
        threadId: input.threadId,
        turnId,
        ...(sessionSeen ? { resumeCursor: { astronautSessionId: context.remoteSessionId } } : {}),
      };
    });

  const readExternalThread: NonNullable<AstronautAdapterShape["readExternalThread"]> = (input) =>
    Effect.gen(function* () {
      const url = normalizeUrl(undefined);
      const response = yield* fetchUrl(
        url,
        `/sessions/${encodeURIComponent(input.externalThreadId)}/messages`,
      );
      const raw = asRecord(yield* json(response, "/messages"));
      const messages = Array.isArray(raw.messages)
        ? raw.messages
        : Array.isArray(yield* Effect.succeed(raw.data))
          ? (raw.data as unknown[])
          : [];
      const turns = messages.flatMap((message, index) => {
        const item = asRecord(message);
        const role = item.role === "user" ? "user" : "assistant";
        const content = stringValue(item.content ?? item.text ?? item.message);
        return content
          ? [
              {
                id: TurnId.makeUnsafe(`astronaut:${input.externalThreadId}:${index}`),
                items: [
                  {
                    type: "factoryMessage",
                    id: typeof item.id === "string" ? item.id : String(index),
                    role,
                    text: content,
                  },
                ],
              },
            ]
          : [];
      });
      return {
        threadId: ThreadId.makeUnsafe(input.externalThreadId),
        ...(input.cwd ? { cwd: input.cwd } : {}),
        turns,
      } satisfies ProviderThreadSnapshot;
    });
  const readThread: AstronautAdapterShape["readThread"] = (threadId) =>
    Effect.gen(function* () {
      const context = contextFor(threadId);
      if (!context.remoteSessionId) return { threadId, turns: [] };
      return yield* readExternalThread({
        externalThreadId: context.remoteSessionId,
        ...(context.session.cwd ? { cwd: context.session.cwd } : {}),
      });
    });
  const listModels: NonNullable<AstronautAdapterShape["listModels"]> = (input) =>
    Effect.gen(function* () {
      const response = yield* fetchUrl(normalizeUrl(input.apiEndpoint), "/models");
      const raw = yield* json(response, "/models");
      const entries = Array.isArray(raw)
        ? raw
        : Array.isArray(asRecord(raw).models)
          ? (asRecord(raw).models as unknown[])
          : [];
      const models: ProviderModelDescriptor[] = entries.flatMap((entry) => {
        const value = typeof entry === "string" ? entry : asRecord(entry);
        const slug = typeof value === "string" ? value : (value.slug ?? value.id ?? value.name);
        if (typeof slug !== "string" || !slug.trim()) return [];
        return [
          {
            slug,
            name:
              typeof value === "string"
                ? value
                : typeof value.name === "string"
                  ? value.name
                  : slug,
          },
        ];
      });
      return { models, source: "astronaut", cached: false } satisfies ProviderListModelsResult;
    });

  const adapter: AstronautAdapterShape = {
    provider: "astronaut",
    capabilities: { sessionModelSwitch: "in-session", supportsRuntimeModelList: true },
    startSession,
    sendTurn,
    interruptTurn: (threadId) =>
      Effect.gen(function* () {
        const context = contextFor(threadId);
        context.abortController?.abort();
        if (context.remoteSessionId)
          yield* fetchUrl(
            context.url,
            `/sessions/${encodeURIComponent(context.remoteSessionId)}/abort`,
            { method: "POST" },
          ).pipe(Effect.asVoid);
      }),
    respondToRequest: (threadId, requestId, decision) => {
      const context = contextFor(threadId);
      const reply =
        decision === "accept" ? "once" : decision === "acceptForSession" ? "always" : "reject";
      return fetchUrl(
        context.url,
        `/permission/${encodeURIComponent(requestId)}/reply`,
        astronautApprovalReply(context.url, requestId, reply).init,
      ).pipe(Effect.asVoid);
    },
    respondToUserInput: (threadId, requestId, answers) => {
      const context = contextFor(threadId);
      const selected = Object.values(answers)
        .flatMap((answer) => (Array.isArray(answer) ? answer.map(String) : [String(answer)]))
        .filter(Boolean);
      return selected.length
        ? fetchUrl(
            context.url,
            `/question/${encodeURIComponent(requestId)}/reply`,
            astronautQuestionReply(context.url, requestId, [selected]).init,
          ).pipe(Effect.asVoid)
        : fetchUrl(context.url, `/question/${encodeURIComponent(requestId)}/reject`, {
            method: "POST",
          }).pipe(Effect.asVoid);
    },
    stopSession: (threadId) =>
      Effect.sync(() => {
        const context = sessions.get(threadId);
        context?.abortController?.abort();
        if (context) {
          emit(context, "session.exited", { reason: "stopped", exitKind: "graceful" });
          sessions.delete(threadId);
        }
      }),
    listSessions: () => Effect.sync(() => [...sessions.values()].map(({ session }) => session)),
    hasSession: (threadId) => Effect.sync(() => sessions.has(threadId)),
    readThread,
    readExternalThread,
    rollbackThread: () =>
      Effect.fail(error("rollback", new Error("Astronaut does not support rollback."))),
    stopAll: () =>
      Effect.sync(() => {
        for (const context of sessions.values()) context.abortController?.abort();
        sessions.clear();
      }),
    streamEvents: Stream.fromQueue(queue),
    listModels,
    getComposerCapabilities: () =>
      Effect.succeed({
        provider: "astronaut",
        supportsSkillMentions: false,
        supportsSkillDiscovery: false,
        supportsNativeSlashCommandDiscovery: false,
        supportsPluginMentions: false,
        supportsPluginDiscovery: false,
        supportsRuntimeModelList: true,
        supportsThreadCompaction: false,
        supportsThreadImport: true,
      }),
  };
  return adapter;
});

export const AstronautAdapterLive = Layer.effect(AstronautAdapter, makeAstronautAdapter);
