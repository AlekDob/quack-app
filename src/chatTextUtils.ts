// Pure text utilities used by the AI chat surface. Pulled out of
// AIChatPanel so they can be unit-testable in isolation and so the
// chat panel doesn't have to re-define `balanceFences` (it was
// previously declared once in AIChatPanel and again in chatToolRender).
//
// All functions here are pure: input string(s) → output string(s) or
// arrays. No DOM, no IPC, no React. Anything that touches Monaco or
// the editor stays in AIChatPanel itself.

import type { ChatMessage, ToolCall } from "./ai";

// ---------- Fenced code blocks ----------

/**
 * Pull all fenced code blocks out of a message body. Returns the raw
 * inner text of each block (no fences). Falls back to an empty array
 * if no fences are present.
 */
export function extractCodeBlocks(text: string): string[] {
  const out: string[] = [];
  const re = /```[a-zA-Z0-9_+-]*\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push(m[1].replace(/\n$/, ""));
  }
  return out;
}

/** Same as extractCodeBlocks but also captures the language tag. */
export function extractTaggedCodeBlocks(
  text: string,
): { lang: string; code: string }[] {
  const out: { lang: string; code: string }[] = [];
  const re = /```([a-zA-Z0-9_+-]*)\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({
      lang: (m[1] ?? "").toLowerCase(),
      code: m[2].replace(/\n$/, ""),
    });
  }
  return out;
}

const SHELL_LANGS = new Set([
  "bash",
  "sh",
  "shell",
  "zsh",
  "fish",
  "powershell",
  "ps1",
  "pwsh",
  "cmd",
  "bat",
  "console",
]);

export function isShellLang(lang: string): boolean {
  return SHELL_LANGS.has(lang);
}

/**
 * While streaming, the model may have an unclosed ``` fence. The
 * markdown renderer expects balanced fences, so synthesize a closing
 * one when there's an odd count.
 */
export function balanceFences(text: string): string {
  const fences = (text.match(/```/g) ?? []).length;
  return fences % 2 === 0 ? text : text + "\n```";
}

// ---------- <think>…</think> ----------

/**
 * Split assistant content into thinking blocks + visible reply.
 * Models like DeepSeek, qwen3 emit <think>...</think> tags during
 * reasoning; we render those in a separate collapsed details block.
 */
export function splitThinking(content: string): {
  thinking: string;
  visible: string;
} {
  const thinkParts: string[] = [];
  let visible = content;
  const extract = (re: RegExp) => {
    visible = visible.replace(re, (_full, inner: string) => {
      const t = (inner ?? "").trim();
      if (t) thinkParts.push(t);
      return "";
    });
  };
  extract(/<think>([\s\S]*?)<\/redacted_thinking>\s*/gi);
  const thinkOpen = "<" + "think>";
  const thinkClose = "</" + "think>";
  extract(new RegExp(`${thinkOpen}([\\s\\S]*?)${thinkClose}\\s*`, "gi"));
  const seen = new Set<string>();
  const unique = thinkParts.filter((p) => {
    if (seen.has(p)) return false;
    seen.add(p);
    return true;
  });
  return { thinking: unique.join("\n\n"), visible };
}

// ---------- Stored-history sanitization ----------

/**
 * Undo the first-turn flatten (`flattenMessages` in providers/cliPrompt +
 * claudeCode). The CLI stores the whole `[System]\n…\n\n[User]\n…` packet as
 * its first user message; when we re-import that transcript on recovery the
 * system prompt would otherwise render as a giant user bubble. Keep only the
 * real `[User]` text — later `[Assistant]`/`[Tool result]` sections are
 * rebuilt as their own messages from the transcript, so we cut them off here.
 */
export function stripCliFlattenScaffold(content: string): string {
  if (!content.startsWith("[System]\n")) return content;
  const marker = "\n[User]\n";
  const at = content.indexOf(marker);
  if (at === -1) return content;
  let rest = content.slice(at + marker.length);
  for (const later of ["\n[Assistant]\n", "\n[Tool result]\n"]) {
    const cut = rest.indexOf(later);
    if (cut !== -1) rest = rest.slice(0, cut);
  }
  return rest.trimEnd();
}

/**
 * Strip messages that should never be rendered or replayed from a
 * persisted chat session:
 *   - role:"system" rows (older versions stored the rebuilt system
 *     prompt inside the saved messages, so reopening an old chat
 *     would show "[System]\nYou are a helpful coding assistant…" as a
 *     chat bubble). The system prompt is rebuilt fresh on every send,
 *     so dropping these is always safe.
 *   - "Unknown tool: X" tool rows from before we learned to skip the
 *     local tool-execution loop for agentic providers.
 *   - Consecutive assistant messages with identical text. A refresh
 *     during/after a Claude Code turn used to re-commit the replayed
 *     stream on every reload, so polluted sessions hold 2-5 copies of
 *     the same answer back to back. Two identical adjacent assistant
 *     turns never occur legitimately (there's always a user/tool row
 *     between real turns), so collapsing them is safe — and it heals
 *     already-corrupted sessions on next load. The richer copy (the
 *     one carrying a blocks log) wins.
 */
export function cleanStaleToolMessages(messages: ChatMessage[]): ChatMessage[] {
  const filtered = messages
    .filter((m) => {
      if (m.role === "system") return false;
      if (m.role !== "tool") return true;
      if (/^Unknown tool:/i.test(m.content)) return false;
      return true;
    })
    // Heal recovered CLI transcripts whose first user turn still carries the
    // flattened `[System]…[User]…` prompt (would render as a giant bubble).
    .map((m) =>
      m.role === "user"
        ? { ...m, content: stripCliFlattenScaffold(m.content) }
        : m,
    );
  const out: ChatMessage[] = [];
  for (const m of filtered) {
    const prev = out[out.length - 1];
    if (
      prev &&
      m.role === "assistant" &&
      prev.role === "assistant" &&
      prev.content.trim() === m.content.trim()
    ) {
      // Keep whichever copy has the chronological blocks log.
      if (!prev.blocks && m.blocks) out[out.length - 1] = m;
      continue;
    }
    out.push(m);
  }
  return out;
}

// ---------- Investigation-plan priorities ----------

/**
 * Best-guess "if you had to read 6 files to grok this codebase, which?"
 * Picks manifests, entry points, central state/store files, and any
 * README. Used by the investigation-plan path that fires when a user
 * asks broad codebase questions on a non-agentic provider.
 */
export function pickPriorityFiles(allFiles: string[]): string[] {
  const norm = (p: string) => p.replace(/\\/g, "/");
  const files = allFiles.map(norm);
  const picked: string[] = [];
  const tryAdd = (p: string | undefined) => {
    if (p && !picked.includes(p)) picked.push(p);
  };
  const find = (re: RegExp) => files.find((f) => re.test(f));
  const findAll = (re: RegExp) => files.filter((f) => re.test(f));

  // Manifests / build configs
  tryAdd(find(/^package\.json$/));
  tryAdd(find(/^Cargo\.toml$/));
  tryAdd(find(/^pyproject\.toml$/));
  tryAdd(find(/^go\.mod$/));
  // README
  tryAdd(find(/^README(\.md)?$/i));
  // Frontend entry points
  tryAdd(find(/^src\/main\.(tsx?|jsx?)$/));
  tryAdd(find(/^src\/index\.(tsx?|jsx?)$/));
  tryAdd(find(/^src\/App\.(tsx?|jsx?)$/));
  // Build configs
  tryAdd(find(/^vite\.config\.(ts|js)$/));
  tryAdd(find(/^next\.config\.(ts|js|mjs)$/));
  // State / store
  tryAdd(find(/^src\/store(\.(ts|js))?$/));
  tryAdd(find(/^src\/store\/index\.(ts|js)$/));
  // Backend entry points
  tryAdd(find(/^src-tauri\/src\/main\.rs$/));
  tryAdd(find(/^src-tauri\/src\/lib\.rs$/));
  tryAdd(find(/^src-tauri\/tauri\.conf\.json$/));
  // If we still have room, pull a couple of top-level src files.
  if (picked.length < 8) {
    for (const f of findAll(/^src\/[^/]+\.(tsx?|jsx?)$/)) {
      if (picked.length >= 8) break;
      tryAdd(f);
    }
  }
  return picked;
}

// ---------- Inline tool-call extraction ----------

/**
 * Fallback: some models emit tool calls as plain JSON in the content
 * stream instead of using Ollama's native `tool_calls` field. Detect
 * that pattern, extract the calls, and return them along with the
 * cleaned-up content. Bracket-walks the string so it handles nested
 * objects, escaped strings, and arbitrary key naming
 * ({name:…, tool:…, function:…} all accepted).
 */
export function parseInlineToolCalls(
  content: string,
  knownTools: Set<string>,
): { calls: ToolCall[]; remaining: string } {
  const calls: ToolCall[] = [];
  let remaining = content;

  // Strip optional ```json fences and <tool_call>...</tool_call> wrappers.
  remaining = remaining.replace(
    /```(?:json|tool[a-z_]*)?\n([\s\S]*?)```/gi,
    (_m, body) => body,
  );
  remaining = remaining.replace(
    /<tool_call>([\s\S]*?)<\/tool_call>/gi,
    (_m, body) => body,
  );

  // Extra-loose fallback for small models that emit just the bare tool
  // name (e.g. "list_files" on its own line, or "list_files()" /
  // "list_files{}"). Replace those with a real JSON tool call so the
  // brace walker below picks them up. Only applied for known
  // argument-less tools to limit false hits.
  const NULLARY = ["list_files", "read_terminal"];
  for (const name of NULLARY) {
    if (!knownTools.has(name)) continue;
    const re = new RegExp(
      `(^|\\n)\\s*${name}\\s*(?:\\(\\s*\\)|\\{\\s*\\})?\\s*(?=\\n|$)`,
      "gi",
    );
    remaining = remaining.replace(
      re,
      `\n{"name":"${name}","arguments":{}}\n`,
    );
  }

  // Match JSON objects of shape {"name":"...","arguments":{...}} and
  // {"tool":"...","arguments":{...}} and
  // {"function":"...","parameters":{...}}. We scan the string for `{`
  // and try to parse from there to the matching `}`.
  const out: string[] = [];
  let i = 0;
  while (i < remaining.length) {
    const ch = remaining[i];
    if (ch !== "{") {
      out.push(ch);
      i++;
      continue;
    }
    // Try to find the matching closing brace, tracking strings/escapes.
    let depth = 0;
    let j = i;
    let inStr = false;
    let escape = false;
    while (j < remaining.length) {
      const c = remaining[j];
      if (escape) {
        escape = false;
      } else if (c === "\\") {
        escape = true;
      } else if (inStr) {
        if (c === '"') inStr = false;
      } else if (c === '"') {
        inStr = true;
      } else if (c === "{") {
        depth++;
      } else if (c === "}") {
        depth--;
        if (depth === 0) {
          j++;
          break;
        }
      }
      j++;
    }
    if (depth !== 0) {
      // No matching brace — bail out, keep rest as text.
      out.push(remaining.slice(i));
      break;
    }
    const candidate = remaining.slice(i, j);
    try {
      const obj = JSON.parse(candidate) as Record<string, unknown>;
      const fnName =
        typeof obj.name === "string"
          ? obj.name
          : typeof obj.tool === "string"
            ? obj.tool
            : typeof obj.function === "string"
              ? obj.function
              : null;
      if (fnName && knownTools.has(fnName)) {
        const rawArgs =
          (obj.arguments as unknown) ??
          (obj.parameters as unknown) ??
          (obj.input as unknown) ??
          {};
        let args: Record<string, unknown> = {};
        if (rawArgs && typeof rawArgs === "object" && !Array.isArray(rawArgs)) {
          args = rawArgs as Record<string, unknown>;
        } else if (typeof rawArgs === "string") {
          try {
            const parsed = JSON.parse(rawArgs);
            if (parsed && typeof parsed === "object")
              args = parsed as Record<string, unknown>;
          } catch {
            /* keep empty */
          }
        }
        calls.push({ function: { name: fnName, arguments: args } });
        i = j; // skip the JSON
        continue;
      }
    } catch {
      /* not JSON — fall through */
    }
    // Not a tool call — emit the brace and keep scanning.
    out.push(ch);
    i++;
  }
  return { calls, remaining: out.join("").trim() };
}
