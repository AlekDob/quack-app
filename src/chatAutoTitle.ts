import { invoke } from "@tauri-apps/api/core";
import type { ChatMessage } from "./ai";
import type { ProviderId } from "./providers/types";
import { getProvider } from "./providers";
import { getJson, getString } from "./localStore";
import { useStore } from "./store";

// Cheap LLM auto-title, like Claude Code / Cursor. After the first turn we
// ask a fast model for a short name and write it as `autoTitled` so the
// first-line heuristic (deriveTitle) never clobbers it. A hand rename
// (titleLocked) always wins. Fire-and-forget: failures fall back silently to
// the heuristic title already on the tab.

const PREF_ENABLED = "lcp.autoTitle.enabled";
// Cursor's catalog is dynamic and has no cheap-tier mapping — leave empty to
// use the CLI default; the user can pin a cheap id (e.g. a Composer model).
const PREF_CURSOR_MODEL = "lcp.autoTitle.cursorModel";
const PREF_OPENAI_MODEL = "lcp.autoTitle.openaiModel";
const MAX_TITLE = 48;

/** Feature toggle (default ON) — Settings can flip it off. */
export function autoTitleEnabled(): boolean {
  return getJson<boolean>(PREF_ENABLED, true);
}

/** Cheap model per provider. CLI providers take a raw alias/id; direct
 *  providers take a modelId. Ollama has no cheap tier — reuse the chat's own
 *  local model (passed as fallback). */
export function titleModelFor(
  providerId: ProviderId,
  fallbackModelId?: string,
): string {
  switch (providerId) {
    case "claude-code":
      return "haiku";
    case "cursor-cli":
      return getString(PREF_CURSOR_MODEL) ?? "";
    case "anthropic":
      return "claude-haiku-4-5-20251001";
    case "openai":
      return getString(PREF_OPENAI_MODEL) ?? "gpt-4o-mini";
    case "ollama":
      return fallbackModelId ?? "";
  }
}

/** Only after the first exchange, and never over a locked/auto title. */
export function shouldAutoTitle(args: {
  messages: ChatMessage[];
  titleLocked?: boolean;
  autoTitled?: boolean;
  enabled?: boolean;
}): boolean {
  if (args.enabled === false) return false;
  if (args.titleLocked || args.autoTitled) return false;
  const hasUser = args.messages.some((m) => m.role === "user");
  const hasAsst = args.messages.some(
    (m) => m.role === "assistant" && m.content.trim().length > 0,
  );
  return hasUser && hasAsst;
}

function firstContent(messages: ChatMessage[], role: ChatMessage["role"]): string {
  return messages.find((m) => m.role === role)?.content ?? "";
}

/** Short instruction + the first user/assistant turn (truncated). */
export function buildTitlePrompt(messages: ChatMessage[]): string {
  const user = firstContent(messages, "user").slice(0, 800);
  const asst = firstContent(messages, "assistant").slice(0, 800);
  return [
    "Generate a concise chat title (3-6 words) for this conversation.",
    "Reply with ONLY the title — no quotes, no trailing punctuation, no explanation.",
    "",
    `User: ${user}`,
    asst ? `Assistant: ${asst}` : "",
  ]
    .join("\n")
    .trim();
}

/** Normalize a raw model reply into a tab-safe title, or null if unusable. */
export function sanitizeTitle(raw: string): string | null {
  let t =
    raw
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length > 0) ?? "";
  t = t.replace(/^["'`*]+|["'`*.]+$/g, "").trim();
  if (t.length < 2) return null;
  if (t.length > MAX_TITLE) t = t.slice(0, MAX_TITLE - 1).trimEnd() + "…";
  return t;
}

async function collectChat(
  providerId: ProviderId,
  prompt: string,
  model: string,
): Promise<string> {
  const ctrl = new AbortController();
  const messages: ChatMessage[] = [{ role: "user", content: prompt }];
  let out = "";
  for await (const ev of getProvider(providerId).chat({
    model,
    messages,
    signal: ctrl.signal,
  })) {
    if (ev.kind === "content") out += ev.text;
    if (out.length > 200) {
      ctrl.abort(); // titles are short — stop the stream early
      break;
    }
  }
  return out;
}

async function generateShortTitle(
  providerId: ProviderId,
  prompt: string,
  model: string,
): Promise<string> {
  if (providerId === "claude-code") {
    return invoke<string>("claude_print_title", { prompt, model });
  }
  if (providerId === "cursor-cli") {
    return invoke<string>("cursor_print_text", { prompt, model });
  }
  return collectChat(providerId, prompt, model);
}

/** Write the LLM title, re-checking the lock (user may have renamed mid-call). */
function writeAutoTitle(wsId: string, chatId: string, title: string): void {
  const fresh = useStore.getState().loaded[wsId]?.aiChats[chatId];
  if (!fresh || fresh.titleLocked) return;
  useStore.getState().setAIChatTitle(wsId, chatId, title, { auto: true });
}

/** Entry point — fire-and-forget after the first assistant turn completes. */
export async function maybeAutoTitle(args: {
  wsId: string;
  chatId: string;
  providerId: ProviderId | null;
  messages: ChatMessage[];
  fallbackModelId?: string;
}): Promise<void> {
  const { wsId, chatId, providerId, messages } = args;
  if (!providerId) return;
  const desc = useStore.getState().loaded[wsId]?.aiChats[chatId];
  if (
    !shouldAutoTitle({
      messages,
      titleLocked: desc?.titleLocked,
      autoTitled: desc?.autoTitled,
      enabled: autoTitleEnabled(),
    })
  ) {
    return;
  }
  const model = titleModelFor(providerId, args.fallbackModelId);
  try {
    const raw = await generateShortTitle(providerId, buildTitlePrompt(messages), model);
    const title = sanitizeTitle(raw);
    if (title) writeAutoTitle(wsId, chatId, title);
  } catch {
    // Silent — the deriveTitle heuristic already set a provisional title.
  }
}
