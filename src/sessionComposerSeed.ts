import type { ChatMessage } from "./ai";
import type { ChatSession } from "./chatHistory";
import { getCachedSession } from "./chatStoreCache";
import {
  backfillAssistantAgentIds,
  sessionAgentFromStored,
} from "./chatTurnAgent";
import {
  CC_EFFORT_DEFAULT,
  normalizeCcEffort,
} from "./components/EffortPopover";
import {
  makeQualifiedModel,
  parseQualifiedModel,
} from "./providers/types";

/** Warm-cache seed so remounts don't flash / persist another chat's knobs. */
export interface SessionComposerSeed {
  presetId: string | null;
  messages: ChatMessage[];
  /** Qualified model id, or "" when the row has none. */
  model: string;
  effort: string;
  thinking: boolean | null;
  permMode: string | null;
}

export function qualifyStoredModel(model: string): string {
  return parseQualifiedModel(model)
    ? model
    : makeQualifiedModel("ollama", model);
}

/** Knob restore for an existing session row (never reads global last-used). */
export function knobsFromSessionRow(session: ChatSession): {
  effort: string;
  thinking: boolean | null;
  permMode: string | null;
} {
  return {
    effort: session.ccEffort
      ? normalizeCcEffort(session.ccEffort)
      : CC_EFFORT_DEFAULT,
    thinking: session.ccThinking ?? null,
    permMode: session.ccPermMode !== undefined ? session.ccPermMode : null,
  };
}

export function loadSessionComposerSeed(
  wsId: string,
  aiChatId: string | undefined,
  resolveSessionId: (chatId: string) => string | undefined,
): SessionComposerSeed | null {
  if (!aiChatId) return null;
  const sid = resolveSessionId(aiChatId);
  if (!sid) return null;
  const cached = getCachedSession(wsId, sid);
  if (!cached) return null;
  const presetId = sessionAgentFromStored(cached.presetId);
  const knobs = knobsFromSessionRow(cached);
  return {
    presetId,
    messages: backfillAssistantAgentIds(cached.messages, presetId),
    model: cached.model ? qualifyStoredModel(cached.model) : "",
    ...knobs,
  };
}

/**
 * Model-discovery must not stamp the global last-used model onto a chat
 * that is still hydrating — that race used to rewrite every remounted
 * session to whichever chat last wrote `lcp.ollama.lastModel`.
 */
export function nextSelectedAfterDiscovery(opts: {
  current: string;
  sessionReady: boolean;
  isPresent: (q: string) => boolean;
  migrate: (q: string) => string;
  globalStored: string | null;
  qualifyStored: (raw: string) => string;
  firstAggregate: string | null;
}): string {
  const migrated = opts.current ? opts.migrate(opts.current) : opts.current;
  if (migrated && opts.isPresent(migrated)) return migrated;
  // Wait for per-session hydrate before falling back to global last-used.
  if (!opts.sessionReady) return opts.current;
  if (opts.globalStored) {
    const preferred = opts.qualifyStored(opts.globalStored);
    const migratedStored = opts.migrate(preferred);
    if (opts.isPresent(migratedStored)) return migratedStored;
  }
  return opts.firstAggregate ?? opts.current;
}
