import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { ChatStreamEvent } from "../ai";
import type { ChatProvider, ProviderModel } from "./types";
import { getWorkspaceRoot } from "../wsRoot";
import { getJson as lsGetJson } from "../localStore";
import { flattenMessages, lastUserMessage } from "./cliPrompt";
import {
  createCliStreamJsonState,
  parseCliStderrLine,
  parseCliStreamJsonObject,
} from "./cliStreamJson";
import {
  createCursorStreamJsonState,
  parseCursorStreamJsonObject,
} from "./cursorStreamJson";

/** When true, pass --force so cursor-agent runs tools without prompts. */
export const CURSOR_FORCE_MODE_KEY = "lcp.cursorCli.forceMode";

export function getForceMode(): boolean {
  return lsGetJson<boolean>(
    CURSOR_FORCE_MODE_KEY,
    true,
    (v): v is boolean => typeof v === "boolean",
  );
}

const DEFAULT_MODEL: ProviderModel = {
  providerId: "cursor-cli",
  modelId: "default",
  displayName: "Default (no --model flag; uses Cursor configured model)",
  contextWindow: 200_000,
  supportsTools: true,
  supportsVision: true,
};

interface CursorModelEntry {
  id: string;
  display_name: string;
  is_default: boolean;
}

let modelsCache: { models: ProviderModel[]; checkedAt: number } | null = null;
const MODELS_TTL_MS = 60_000;

async function fetchModels(): Promise<ProviderModel[]> {
  const entries = await invoke<CursorModelEntry[]>("cursor_code_list_models");
  const dynamic = entries.map((e) => ({
    providerId: "cursor-cli" as const,
    modelId: e.id,
    displayName: e.display_name,
    contextWindow: 200_000,
    supportsTools: true,
    supportsVision: true,
  }));
  return [DEFAULT_MODEL, ...dynamic];
}

let availabilityCache: { ok: boolean; checkedAt: number } | null = null;
const AVAILABILITY_TTL_MS = 60_000;

async function checkAvailability(): Promise<boolean> {
  if (
    availabilityCache &&
    Date.now() - availabilityCache.checkedAt < AVAILABILITY_TTL_MS
  ) {
    return availabilityCache.ok;
  }
  try {
    await invoke<string>("cursor_code_check");
    availabilityCache = { ok: true, checkedAt: Date.now() };
    return true;
  } catch {
    availabilityCache = { ok: false, checkedAt: Date.now() };
    return false;
  }
}

export function invalidateCursorCliCache(): void {
  availabilityCache = null;
  modelsCache = null;
}

/** Full catalog — runs `cursor-agent --list-models`. Defer until picker/browser open. */
export async function refreshCursorModelsLive(
  force = false,
): Promise<ProviderModel[]> {
  if (
    !force &&
    modelsCache &&
    Date.now() - modelsCache.checkedAt < MODELS_TTL_MS
  ) {
    return modelsCache.models;
  }
  if (!(await checkAvailability())) return [DEFAULT_MODEL];
  const models = await fetchModels();
  modelsCache = { models, checkedAt: Date.now() };
  return models;
}

export const cursorCliProvider: ChatProvider = {
  id: "cursor-cli",
  displayName: "Cursor CLI (local)",
  needsApiKey: false,
  keyHelpUrl: "https://cursor.com/docs/cli/overview",

  async isAvailable() {
    return await checkAvailability();
  },

  // The picker calls this directly when the Cursor tab opens, so it must return
  // the real catalog — not just the sentinel. refreshCursorModelsLive owns the
  // TTL cache + availability gate and falls back to DEFAULT_MODEL on failure.
  async listModels(): Promise<ProviderModel[]> {
    return await refreshCursorModelsLive().catch(() => [DEFAULT_MODEL]);
  },

  async *chat({
    model,
    messages,
    signal,
    resumeSessionId,
    chatSessionId,
    cwd: cwdArg,
  }) {
    const prompt = resumeSessionId
      ? lastUserMessage(messages)
      : flattenMessages(messages);
    const cwd = cwdArg ?? getWorkspaceRoot();

    let streamId: string;
    try {
      streamId = await invoke<string>("cursor_code_chat", {
        prompt,
        cwd,
        model,
        resumeSessionId,
        chatSessionId,
        force: getForceMode(),
      });
    } catch (e) {
      throw new Error(`cursor-agent failed to spawn: ${e}`);
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
    const jsonState = createCliStreamJsonState();
    const cursorState = createCursorStreamJsonState();

    const handle = (data: { kind: string; line?: string; code?: number }) => {
      if (data.kind === "end") {
        done = true;
        wake();
        return;
      }
      if (data.kind === "stderr" && data.line) {
        queue.push({
          kind: "content",
          text: parseCliStderrLine(
            data.line,
            "cursor",
            "\n\n**Model rejected by Cursor CLI.** Open ⊕ Models and pick a different model, or use Default.",
          ),
        });
        wake();
        return;
      }
      if (data.kind !== "line" || !data.line) return;
      try {
        const obj = JSON.parse(data.line) as Record<string, unknown>;
        const cursorEvents = parseCursorStreamJsonObject(obj, cursorState);
        const ccEvents =
          cursorEvents.length > 0
            ? []
            : parseCliStreamJsonObject(obj, jsonState);
        const events = [...cursorEvents, ...ccEvents];
        if (events.length > 0) {
          queue.push(...events);
          wake();
        }
      } catch {
        /* skip non-JSON lines */
      }
    };

    let unlisten: UnlistenFn | null = null;
    try {
      unlisten = await listen<{ kind: string; line?: string; code?: number }>(
        `cursor-stream:${streamId}`,
        (e) => handle(e.payload),
      );
    } catch (e) {
      throw new Error(`failed to listen for cursor stream: ${e}`);
    }

    const onAbort = () => {
      void invoke("cursor_code_kill", { id: streamId }).catch(() => {});
      done = true;
      wake();
    };
    signal?.addEventListener("abort", onAbort);

    try {
      while (true) {
        while (queue.length > 0) {
          const ev = queue.shift()!;
          yield ev;
        }
        if (done) break;
        await new Promise<void>((resolve) => {
          waker = resolve;
        });
      }
    } finally {
      signal?.removeEventListener("abort", onAbort);
      if (unlisten) unlisten();
    }
  },
};
