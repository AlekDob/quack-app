import { invoke } from "@tauri-apps/api/core";
import { createOpencodeClient } from "@opencode-ai/sdk/client";
import type { ChatStreamEvent } from "../ai";
import type { ChatProvider, ProviderModel } from "./types";
import { getWorkspaceRoot } from "../wsRoot";
import { fileUrlForImagePath, mimeForImagePath } from "../imageAttach";
import { lastUserMessage, splitCliPrompt } from "./cliPrompt";
import {
  createOpencodeEventState,
  parseOpencodeEvent,
} from "./openCodeEvents";

interface OpencodeServerStatus {
  running: boolean;
  url: string;
  message?: string | null;
}

const DEFAULT_MODEL: ProviderModel = {
  providerId: "opencode-cli",
  modelId: "opencode/big-pickle",
  displayName: "big-pickle (OpenCode Zen, free)",
  contextWindow: 128_000,
  supportsTools: true,
  supportsVision: true,
  isFree: true,
};

function opencodeModelIsFree(m: {
  id?: string;
  name?: string;
  cost?: { input?: number; output?: number };
}): boolean {
  if (m.cost?.input === 0 && m.cost?.output === 0) return true;
  const hay = `${m.id ?? ""} ${m.name ?? ""}`.toLowerCase();
  return hay.includes("free");
}

let availabilityCache: { ok: boolean; checkedAt: number } | null = null;
let modelsCache: { models: ProviderModel[]; checkedAt: number } | null = null;
const AVAILABILITY_TTL_MS = 60_000;
const MODELS_TTL_MS = 60_000;

async function ensureSidecar(): Promise<string> {
  const status = await invoke<OpencodeServerStatus>("opencode_server_start");
  if (!status.running) {
    throw new Error(status.message ?? "OpenCode server failed to start");
  }
  return status.url;
}

async function sidecarIsRunning(): Promise<boolean> {
  try {
    const status = await invoke<OpencodeServerStatus>("opencode_server_status");
    return status.running;
  } catch {
    return false;
  }
}

function parseOpencodeModel(model: string): {
  providerID: string;
  modelID: string;
} {
  const slash = model.indexOf("/");
  if (slash <= 0) {
    return { providerID: "opencode", modelID: model };
  }
  return {
    providerID: model.slice(0, slash),
    modelID: model.slice(slash + 1),
  };
}

async function checkAvailability(): Promise<boolean> {
  if (
    availabilityCache &&
    Date.now() - availabilityCache.checkedAt < AVAILABILITY_TTL_MS
  ) {
    return availabilityCache.ok;
  }
  try {
    await invoke<string>("opencode_server_check");
    availabilityCache = { ok: true, checkedAt: Date.now() };
    return true;
  } catch {
    availabilityCache = { ok: false, checkedAt: Date.now() };
    return false;
  }
}

async function fetchModels(): Promise<ProviderModel[]> {
  const baseUrl = await ensureSidecar();
  const client = createOpencodeClient({ baseUrl });
  const prov = await client.provider.list();
  const all = prov.data?.all ?? [];
  const connected = new Set(prov.data?.connected ?? []);
  const models: ProviderModel[] = [];
  const seen = new Map<string, ProviderModel>();
  for (const p of all) {
    if (!connected.has(p.id)) continue;
    for (const m of Object.values(p.models ?? {})) {
      const modelId = `${p.id}/${m.id}`;
      const entry: ProviderModel = {
        providerId: "opencode-cli",
        modelId,
        displayName: m.name ?? modelId,
        contextWindow: m.limit?.context ?? 128_000,
        supportsTools: m.tool_call !== false,
        supportsVision: m.modalities?.input?.includes("image") ?? false,
        isFree: opencodeModelIsFree(m),
      };
      const prev = seen.get(modelId);
      if (!prev || (entry.isFree && !prev.isFree)) {
        seen.set(modelId, entry);
      }
    }
  }
  for (const entry of seen.values()) models.push(entry);
  return models.length > 0 ? sortFreeFirst(models) : [DEFAULT_MODEL];
}

/** Surface zero-cost models at the top of OpenCode lists. */
function sortFreeFirst(models: ProviderModel[]): ProviderModel[] {
  return [...models].sort((a, b) => {
    const af = a.isFree ? 0 : 1;
    const bf = b.isFree ? 0 : 1;
    if (af !== bf) return af - bf;
    return a.displayName.localeCompare(b.displayName);
  });
}

export function invalidateOpenCodeCache(): void {
  availabilityCache = null;
  modelsCache = null;
}

/** Full catalog — spawns the sidecar if needed. Use on model browser / picker open. */
export async function refreshOpenCodeModelsLive(
  force = false,
): Promise<ProviderModel[]> {
  if (
    !force &&
    modelsCache &&
    Date.now() - modelsCache.checkedAt < MODELS_TTL_MS
  ) {
    return modelsCache.models;
  }
  const models = await fetchModels();
  modelsCache = { models, checkedAt: Date.now() };
  return models;
}

export const openCodeProvider: ChatProvider = {
  id: "opencode-cli",
  displayName: "OpenCode (local)",
  needsApiKey: false,
  keyHelpUrl: "https://opencode.ai/docs",

  async isAvailable() {
    return await checkAvailability();
  },

  async listModels(): Promise<ProviderModel[]> {
    if (modelsCache && Date.now() - modelsCache.checkedAt < MODELS_TTL_MS) {
      return modelsCache.models;
    }
    if (!(await checkAvailability())) return [DEFAULT_MODEL];
    // Avoid spawning `opencode serve` during app startup — default is enough.
    if (!(await sidecarIsRunning())) return [DEFAULT_MODEL];
    try {
      const models = await fetchModels();
      modelsCache = { models, checkedAt: Date.now() };
      return models;
    } catch {
      return [DEFAULT_MODEL];
    }
  },

  async *chat({
    model,
    messages,
    signal,
    resumeSessionId,
    cwd: cwdArg,
    imageAttachments,
  }) {
    const baseUrl = await ensureSidecar();
    const client = createOpencodeClient({ baseUrl });
    const cwd = cwdArg ?? getWorkspaceRoot();
    const ocModel = parseOpencodeModel(model);
    const { system, prompt } = resumeSessionId
      ? { system: "", prompt: lastUserMessage(messages) }
      : splitCliPrompt(messages);

    let sessionId = resumeSessionId;
    if (!sessionId) {
      const created = await client.session.create({
        query: { directory: cwd },
        body: { title: "Quack chat" },
      });
      sessionId = created.data?.id;
      if (!sessionId) {
        throw new Error("OpenCode failed to create a session");
      }
      yield { kind: "session", id: sessionId };
    }

    const queue: ChatStreamEvent[] = [];
    let done = false;
    let waker: (() => void) | null = null;
    const wake = () => {
      if (waker) {
        const fn = waker;
        waker = null;
        fn();
      }
    };
    const eventState = createOpencodeEventState();

    const es = new EventSource(`${baseUrl}/global/event`);
    es.onmessage = (msg) => {
      try {
        const raw = JSON.parse(msg.data) as { payload?: unknown };
        const payload = raw?.payload ?? raw;
        const { events, done: turnDone } = parseOpencodeEvent(
          payload,
          sessionId!,
          eventState,
        );
        if (events.length > 0) {
          queue.push(...events);
          wake();
        }
        if (turnDone) {
          done = true;
          wake();
        }
      } catch {
        /* ignore malformed SSE frames */
      }
    };
    es.onerror = () => {
      if (!done) {
        done = true;
        wake();
      }
    };

    const onAbort = () => {
      void client.session
        .abort({ path: { id: sessionId! }, query: { directory: cwd } })
        .catch(() => {});
      es.close();
      done = true;
      wake();
    };
    signal?.addEventListener("abort", onAbort);

    try {
      const parts: Array<
        | { type: "text"; text: string }
        | { type: "file"; mime: string; filename?: string; url: string }
      > = [{ type: "text", text: prompt }];
      for (const img of imageAttachments ?? []) {
        parts.push({
          type: "file",
          mime: mimeForImagePath(img.path),
          filename: img.name,
          url: fileUrlForImagePath(img.path),
        });
      }

      await client.session.promptAsync({
        path: { id: sessionId },
        query: { directory: cwd },
        body: {
          model: ocModel,
          ...(system ? { system } : {}),
          parts,
        },
      });

      while (true) {
        while (queue.length > 0) {
          yield queue.shift()!;
        }
        if (done) break;
        await new Promise<void>((resolve) => {
          waker = resolve;
        });
      }
    } finally {
      signal?.removeEventListener("abort", onAbort);
      es.close();
    }
  },
};
