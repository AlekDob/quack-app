// Tool-call / diff / interleaved-block render helpers and the small
// presentational components that consume them. Pulled out of
// AIChatPanel.tsx so that file can shrink and so the same renderers
// can in principle be reused by future AI surfaces (compose card,
// activity log, etc.) without round-tripping through the chat panel.
//
// Everything here is pure presentational React + tiny pure functions.
// No closures over chat panel state, no IPC, no localStorage. Anything
// that needs more is still in AIChatPanel.

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { ChatMessage, ToolCall } from "../ai";
import { balanceFences, splitThinking } from "../chatTextUtils";
import { MarkdownPreview } from "./MarkdownPreview";
import { Icon, type IconName } from "./Icon";
import { duckAvatarFor } from "../subagents";
import { requestToolDrawer } from "../toolDrawer";
import { requestDiff } from "../editorState";
import { langOf } from "../langDetect";
import { isImagePath } from "../imageAttach";

// Agent mode turns this on to render the chat denser: grouped tool bursts
// collapse to an icon row by default, expandable on click. The normal
// docked chat leaves it false and renders exactly as before.
export const CompactChat = createContext(false);

// Agent mode provides an opener so an edit chip can deep-link to the file
// it changed (opens the agent-mode file popup). Null elsewhere → chips
// just expand inline.
export const AgentFileOpen = createContext<((path: string) => void) | null>(
  null,
);

// The chat panel provides this so a Task (subagent) chip can open the
// subagent's full transcript in a read-only tab. The panel binds wsId +
// the current Claude Code session id; the chip supplies the Task call id
// and the agent type. Null elsewhere → the chip renders but isn't clickable.
export const SubagentOpen = createContext<
  ((toolUseId: string, agentType: string) => void) | null
>(null);

// Pull the subagent type out of a Task tool-call's input. Claude Code uses
// `subagent_type`; we fall back to a couple of aliases just in case.
export function subagentTypeOf(args: Record<string, unknown>): string {
  const v =
    args.subagent_type ?? args.subagentType ?? args.agent_type ?? args.agent;
  return typeof v === "string" ? v : "";
}

// Past-tense verb for a chip label — reads as "edited run.ts" / "ran tsc"
// rather than the raw tool name.
function toolVerb(name: string): string {
  switch (name) {
    case "Edit":
    case "MultiEdit":
      return "edited";
    case "Write":
      return "wrote";
    case "create_file":
      return "created";
    case "Read":
    case "NotebookRead":
      return "read";
    case "Grep":
    case "Glob":
    case "ToolSearch":
      return "searched";
    case "Bash":
      return "ran";
    case "WebSearch":
      return "searched web";
    case "WebFetch":
      return "fetched";
    default:
      return friendlyToolName(name).toLowerCase();
  }
}

// Small glyph per tool, for the Replit-style icon row on collapsed groups.
function toolIconName(name: string): IconName {
  switch (name) {
    case "Read":
      return "file-text";
    case "Edit":
    case "MultiEdit":
      return "edit";
    case "Write":
    case "create_file":
      return "file";
    case "Grep":
    case "Glob":
    case "ToolSearch":
      return "search";
    case "Bash":
      return "terminal";
    case "WebSearch":
    case "WebFetch":
      return "globe";
    case "TaskCreate":
    case "TaskUpdate":
      return "check-square";
    default:
      return "code";
  }
}

// ---------- Tool-name labelling ----------

// Lower-case tool names from Ollama / OpenAI / our own Codetta tools.
const TOOL_LABELS: Record<string, string> = {
  read_file: "Read",
  read: "Read",
  write_file: "Write",
  write: "Write",
  edit_file: "Edit",
  edit: "Edit",
  create_file: "Create",
  list_directory: "List",
  list_dir: "List",
  ls: "List",
  glob: "Glob",
  grep: "Grep",
  search: "Search",
  bash: "Bash",
  shell: "Bash",
  run_command: "Bash",
  run: "Bash",
  web_fetch: "Web Fetch",
  fetch: "Web Fetch",
  web_search: "Web Search",
  search_web: "Web Search",
};

// Claude Code tool names use CamelCase (Read, Edit, Bash, Glob, etc.)
// so the lowercase table above misses them entirely. These are the
// names the agent actually emits in stream-json tool_use blocks.
const CLAUDE_CODE_TOOL_LABELS: Record<string, string> = {
  Read: "Read",
  Write: "Write",
  Edit: "Edit",
  MultiEdit: "Edit",
  Bash: "Bash",
  BashOutput: "Bash output",
  KillShell: "Kill shell",
  Glob: "Glob",
  Grep: "Grep",
  WebFetch: "Web Fetch",
  WebSearch: "Web Search",
  TodoWrite: "Todos",
  NotebookEdit: "Notebook edit",
  Task: "Subagent",
  Agent: "Subagent",
  ExitPlanMode: "Exit plan mode",
};

export function friendlyToolName(name: string): string {
  if (TOOL_LABELS[name]) return TOOL_LABELS[name];
  if (CLAUDE_CODE_TOOL_LABELS[name]) return CLAUDE_CODE_TOOL_LABELS[name];
  // mcp__<server>__<tool> — strip the prefix and label by server.
  const mcp = /^mcp__([^_]+)__(.+)$/.exec(name);
  if (mcp) return `${mcp[1]} → ${mcp[2]}`;
  return name
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function primaryToolDetail(args: Record<string, unknown>): string {
  // TodoWrite carries an array of {content, status} — show a "3 active,
  // 2 done" summary instead of the noisy default.
  if (Array.isArray(args.todos)) {
    const total = args.todos.length;
    const done = args.todos.filter(
      (t: unknown) =>
        t && typeof t === "object" &&
        (t as Record<string, unknown>).status === "completed",
    ).length;
    return `${done}/${total} done`;
  }
  // Bash command, truncated.
  if (typeof args.command === "string" && args.command.length > 0) {
    const cmd = args.command.replace(/\s+/g, " ").trim();
    return cmd.length > 80 ? cmd.slice(0, 80) + "…" : cmd;
  }
  for (const k of [
    // `skill` first: the Skill tool names which skill it runs here, so the
    // chip reads "Skill feature-creator" instead of a bare "Skill".
    "skill",
    "path",
    "file_path",
    "url",
    "pattern",
    "query",
    "name",
  ]) {
    const v = args[k];
    if (typeof v === "string" && v.length > 0) {
      return v.length > 200 ? v.slice(0, 200) + "…" : v;
    }
  }
  return "";
}

// Compact, scannable form of a tool's detail arg. Paths collapse to their
// last two segments ("…/projects/index.html"); URLs to host + short path
// ("example.com/blog/post"); plain strings pass through. Shared by the
// live ticker (RunningToolRow) and the transcript rows (ToolCallRow) so
// both read the same way — DRY, one place to tune the truncation.
export function shortDetail(detail: string): string {
  if (!detail) return "";
  if (/^https?:\/\//i.test(detail)) {
    try {
      const u = new URL(detail);
      const path = (u.pathname + (u.search || "")).replace(/\/$/, "");
      const tail = path.length > 36 ? path.slice(0, 33) + "…" : path;
      return u.host + tail;
    } catch {
      return detail;
    }
  }
  const norm = detail.replace(/\\/g, "/");
  if (!norm.includes("/")) return norm;
  const parts = norm.split("/").filter(Boolean);
  if (parts.length <= 2) return norm;
  return "…/" + parts.slice(-2).join("/");
}

const READ_NAMES = new Set(["Read", "read_file", "read", "NotebookRead"]);
const MARKDOWN_EXT = /\.(md|mdx|markdown)$/i;

// Claude Code's Read returns its content in `cat -n` form ("   123\tline").
// Strip that gutter so a Markdown read renders as the real document instead
// of a numbered dump. Tolerant of the optional leading arrow Read prefixes
// with for long lines.
function stripReadGutter(text: string): string {
  return text.replace(/^\s*\d+\t/gm, "");
}

// A Markdown file read → render the result as formatted Markdown, not raw
// monospace. Scoped to Read+`.md` only: Bash/Grep output and code-file reads
// are NOT Markdown and must stay in the code view.
function isMarkdownRead(call: ToolCall): boolean {
  if (!READ_NAMES.has(call.function.name)) return false;
  return MARKDOWN_EXT.test(pathOf(call));
}

// Tools that point at a single openable file (vs. Grep/Glob which point at a
// pattern). Clicking such a row opens that file in a new editor tab.
const FILE_REF_NAMES = new Set([
  "Read",
  "NotebookRead",
  "read_file",
  "read",
  "Edit",
  "MultiEdit",
  "edit_file",
  "edit",
  "Write",
  "write_file",
  "create_file",
  "NotebookEdit",
]);

/** Openable file path of a file-targeted tool, or "" if it has none. */
function fileRefOf(call: ToolCall): string {
  if (!FILE_REF_NAMES.has(call.function.name)) return "";
  const p = pathOf(call);
  return p && p !== "(unknown)" ? p : "";
}

// Tools that render on their own row (NOT in the wrapping pill cloud): edits
// (own diff), Task/Agent (subagent chip), AskUserQuestion (summary). Everything
// else (Read/Grep/Bash/Web…) flows into the compact wrap. EDIT_NAMES is defined
// below; this runs at render time so it's initialised by then.
function isWrapStandalone(name: string): boolean {
  return (
    EDIT_NAMES.has(name) ||
    name === "Task" ||
    name === "Agent" ||
    name === "AskUserQuestion"
  );
}

// Shared head for every tool row (generic + edit). A content-hugging bordered
// pill: icon · name · detail on a primary button, status in a trailing cluster.
// The whole pill is one click target → `onPrimary` (open the result drawer, the
// diff modal, or the file). No inline expansion any more: detail lives in the
// right-side drawer / DiffModal, keeping the row a compact one-liner.
function ToolRowHead({
  icon,
  name,
  detail,
  detailTitle,
  extra,
  onPrimary,
  primaryTitle,
  skill,
  image,
}: {
  icon: IconName | null;
  name: string;
  detail: string;
  detailTitle?: string;
  extra?: ReactNode;
  onPrimary?: () => void;
  primaryTitle?: string;
  /** Tint the pill violet — the Skill tool, matching the `/` skill menu. */
  skill?: boolean;
  /** Tint the pill — a Read of an image attachment (distinct, identifiable). */
  image?: boolean;
}) {
  return (
    <div
      className={`ai-tcall-head${onPrimary ? " is-interactive" : ""}${
        skill ? " ai-tcall-skill" : ""
      }${image ? " ai-tcall-image" : ""}`}
    >
      <button
        type="button"
        className="ai-tcall-open"
        disabled={!onPrimary}
        onClick={onPrimary}
        title={primaryTitle}
      >
        <span className="ai-tcall-ico" aria-hidden="true">
          {icon ? <Icon name={icon} size={13} /> : <span className="ai-tcall-dot" />}
        </span>
        <span className="ai-tcall-name">{name}</span>
        {detail && (
          <span className="ai-tcall-detail" title={detailTitle ?? detail}>
            {detail}
          </span>
        )}
      </button>
      {extra && <span className="ai-tcall-trail">{extra}</span>}
    </div>
  );
}

// Pick the most-informative argument to show alongside the tool name
// in the running-tools status rows. Falls through a list of common arg
// names so this works for both Claude Code's tool catalog (file_path,
// command, url, …) and our own (path, query, …).
export function toolDetailFor(
  name: string,
  args: Record<string, unknown>,
): string {
  // AskUserQuestion carries its content in a nested questions array —
  // show the actual question text so the chip isn't a blank
  // "AskUserQuestion" row the user can't act on.
  if (name === "AskUserQuestion" && Array.isArray(args.questions)) {
    const q = args.questions[0] as Record<string, unknown> | undefined;
    if (q && typeof q.question === "string") return q.question.slice(0, 200);
  }
  for (const key of [
    // `skill` first: surface which skill the Skill tool runs, so the live
    // ticker reads "Skill feature-creator" instead of a bare "Skill".
    "skill",
    "url",
    "path",
    "file_path",
    "notebook_path",
    "pattern",
    "query",
    "prompt",
    "command",
  ]) {
    const v = args[key];
    if (typeof v === "string" && v.length > 0) {
      return key === "command" ? v.slice(0, 200) : v;
    }
  }
  return "";
}

// Per-tool-family icon. Helps the user scan a list of 6+ in-flight
// calls without reading each name. Returns null for tools we don't
// recognise — the caller renders a small bullet placeholder instead.
function toolIconFor(name: string): IconName | null {
  switch (name) {
    case "Read":
    case "Glob":
      return "file-text";
    case "Grep":
    case "WebSearch":
      return "search";
    case "Edit":
    case "MultiEdit":
      return "edit";
    case "Write":
    case "create_file":
      return "plus";
    case "Bash":
      return "terminal";
    case "WebFetch":
      return "globe";
    case "TodoWrite":
      return "check-square";
    case "NotebookEdit":
      return "file-text";
    case "Skill":
      return "zap";
    default:
      return null;
  }
}

// ---------- Diff extraction (pure) ----------

export interface EditDiff {
  oldText: string;
  newText: string;
}

/** Pull the file path out of an editing tool call. */
export function pathOf(call: ToolCall): string {
  const args = call.function.arguments as Record<string, unknown>;
  return (
    (typeof args.file_path === "string" && args.file_path) ||
    (typeof args.path === "string" && args.path) ||
    (typeof args.notebook_path === "string" && args.notebook_path) ||
    "(unknown)"
  );
}

/** Sum +/- line counts across one tool call's diffs. */
export function diffStats(diffs: EditDiff[]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const d of diffs) {
    if (d.newText) added += d.newText.split("\n").filter((l) => l.length > 0).length;
    if (d.oldText) removed += d.oldText.split("\n").filter((l) => l.length > 0).length;
  }
  return { added, removed };
}

export function extractEditDiffs(call: ToolCall): EditDiff[] | null {
  const name = call.function.name;
  const args = call.function.arguments as Record<string, unknown>;
  // Edit (Claude Code) — single old/new pair.
  if (name === "Edit" || name === "edit_file" || name === "edit") {
    const oldText =
      typeof args.old_string === "string"
        ? args.old_string
        : typeof args.old_text === "string"
          ? args.old_text
          : "";
    const newText =
      typeof args.new_string === "string"
        ? args.new_string
        : typeof args.new_text === "string"
          ? args.new_text
          : "";
    if (!oldText && !newText) return null;
    return [{ oldText, newText }];
  }
  // MultiEdit — array of {old_string, new_string}.
  if (name === "MultiEdit") {
    const edits = Array.isArray(args.edits) ? args.edits : null;
    if (!edits) return null;
    const out: EditDiff[] = [];
    for (const e of edits) {
      if (!e || typeof e !== "object") continue;
      const eo = e as Record<string, unknown>;
      out.push({
        oldText: typeof eo.old_string === "string" ? eo.old_string : "",
        newText: typeof eo.new_string === "string" ? eo.new_string : "",
      });
    }
    return out.length > 0 ? out : null;
  }
  // Write / create_file — full new content. Render as add-only diff.
  if (name === "Write" || name === "write_file" || name === "create_file") {
    const content =
      typeof args.content === "string"
        ? args.content
        : typeof args.text === "string"
          ? args.text
          : "";
    if (!content) return null;
    return [{ oldText: "", newText: content }];
  }
  return null;
}

// ---------- Components ----------

/** Live tool list for the in-flight turn. Past a handful of rows the
 *  OLDEST finished ones collapse behind a count toggle — ten expanded
 *  Read rows were pushing the whole conversation off-screen. Running
 *  and errored rows always stay visible. */
export function RunningToolList({
  entries,
}: {
  entries: Array<{
    id?: string;
    name: string;
    detail: string;
    preview?: string;
    status?: "running" | "done" | "error";
  }>;
}) {
  const [expanded, setExpanded] = useState(false);
  const MAX_VISIBLE = 4;
  if (entries.length <= MAX_VISIBLE || expanded) {
    return (
      <>
        {entries.map((t, i) => (
          <RunningToolRow key={t.id ?? i} entry={t} />
        ))}
        {expanded && entries.length > MAX_VISIBLE && (
          <button
            className="ai-running-collapse"
            onClick={() => setExpanded(false)}
          >
            Show fewer
          </button>
        )}
      </>
    );
  }
  // Hide the oldest DONE rows until only MAX_VISIBLE remain;
  // running/error rows are never hidden.
  const hidden = new Set<number>();
  let toHide = entries.length - MAX_VISIBLE;
  for (let i = 0; i < entries.length && toHide > 0; i++) {
    if ((entries[i].status ?? "running") === "done") {
      hidden.add(i);
      toHide--;
    }
  }
  if (hidden.size === 0) {
    return (
      <>
        {entries.map((t, i) => (
          <RunningToolRow key={t.id ?? i} entry={t} />
        ))}
      </>
    );
  }
  return (
    <>
      <button
        className="ai-running-collapse"
        onClick={() => setExpanded(true)}
        title="Show all tool calls from this turn"
      >
        ✓ {hidden.size} earlier tool call{hidden.size === 1 ? "" : "s"}
      </button>
      {entries.map((t, i) =>
        hidden.has(i) ? null : <RunningToolRow key={t.id ?? i} entry={t} />,
      )}
    </>
  );
}

export function RunningToolRow({
  entry,
}: {
  entry: {
    name: string;
    detail: string;
    preview?: string;
    status?: "running" | "done" | "error";
  };
}) {
  // In compact (agent) mode, drop the bulky tool-output preview — the live
  // list stays a tight one-line-per-tool ticker instead of dumping file
  // contents / command output mid-stream.
  const compact = useContext(CompactChat);
  const niceDetail = shortDetail(entry.detail);
  const previewLines = entry.preview
    ? entry.preview.split("\n").slice(0, 6).join("\n").trim()
    : "";
  const previewTruncated =
    entry.preview && entry.preview.split("\n").length > 6;
  const icon = toolIconFor(entry.name);
  const status = entry.status ?? "running";
  return (
    <div className={`ai-running-row ai-running-row-${status}`}>
      <div className="ai-running-row-head">
        <span className="ai-running-row-icon" aria-hidden>
          {icon ? <Icon name={icon} size={12} /> : "•"}
        </span>
        <span className="ai-running-row-name">{entry.name}</span>
        {niceDetail && (
          <span
            className="ai-running-row-detail"
            title={entry.detail}
          >
            {niceDetail}
          </span>
        )}
        {status === "running" && (
          <span className="ai-spinner ai-spinner-sm ai-running-row-spinner" />
        )}
        {status === "done" && (
          <span className="ai-running-row-check" title="Finished">
            <Icon name="check" size={11} />
          </span>
        )}
        {status === "error" && (
          <span className="ai-running-row-x" title="Errored">
            <Icon name="x" size={11} />
          </span>
        )}
      </div>
      {!compact && previewLines && (
        <pre className="ai-running-row-preview">
          {previewLines}
          {previewTruncated ? "\n…" : ""}
        </pre>
      )}
    </div>
  );
}

/**
 * Render an assistant message in the EXACT order the provider emitted it:
 * text fragment → tool call → text fragment → tool call → … This replaces
 * the old "all text first, then all tool rows" layout that made the
 * conversation feel scrambled (the model would say "let me check X" but
 * the X tool row appeared above the sentence). Falls back silently for
 * messages with no recorded blocks log (older sessions, non-agentic
 * providers) — the parent picks the legacy renderer in that case.
 */
export function InterleavedBlocks({
  blocks,
  callsById,
  resultsById,
  erroredIds,
  streaming = false,
}: {
  blocks: NonNullable<ChatMessage["blocks"]>;
  callsById: Map<string, ToolCall>;
  resultsById: Map<string, string>;
  /** Tool ids whose result was an error (for outcome-aware chips). */
  erroredIds?: Set<string>;
  /** True while this message is the in-flight turn (drives the live
   *  "working now" pulse on the last unfinished chip). */
  streaming?: boolean;
}) {
  const compact = useContext(CompactChat);
  // Compact (agent) mode: a distinct, inline render — narration prose with
  // runs of tool calls collapsed into a row of icon chips (grouped by type)
  // that reveal their target on hover and expand on click. Task tools are
  // omitted (the sidebar owns them).
  if (compact) {
    return (
      <CompactBlocks
        blocks={blocks}
        callsById={callsById}
        resultsById={resultsById}
        erroredIds={erroredIds ?? EMPTY_ID_SET}
        streaming={streaming}
      />
    );
  }
  // Claude sometimes retries AskUserQuestion after the redirect deny,
  // which would render two identical question cards back to back.
  // Keep only the LAST occurrence of each identical question set.
  const askDupSkip = new Set<number>();
  {
    const seen = new Map<string, number>();
    blocks.forEach((b, i) => {
      if (b.kind !== "tool_call") return;
      const call = callsById.get(b.callId);
      if (!call || call.function.name !== "AskUserQuestion") return;
      const sig = JSON.stringify(call.function.arguments?.questions ?? null);
      const prev = seen.get(sig);
      if (prev !== undefined) askDupSkip.add(prev);
      seen.set(sig, i);
    });
  }
  // Drop re-emitted tool_use blocks (same callId twice) — some providers
  // surface a tool call in both a partial and the final message, which
  // otherwise renders every row twice. Also covers transcripts saved
  // before the stream-level dedup landed.
  const dupCallSkip = new Set<number>();
  {
    const seenIds = new Set<string>();
    blocks.forEach((b, i) => {
      if (b.kind !== "tool_call") return;
      if (seenIds.has(b.callId)) dupCallSkip.add(i);
      else seenIds.add(b.callId);
    });
  }
  // Lay consecutive read-ish tool calls out as a wrapping row of compact pills
  // ("Read · Glob · Grep" side by side, flowing onto the next line) instead of
  // a tall stack. Edits and Tasks break out onto their own row — they're
  // actions that change code / spawn agents, so they stay prominent.
  const wrapAt = new Map<number, number[]>();
  const inWrap = new Set<number>();
  {
    let run: number[] = [];
    const flush = () => {
      if (run.length) {
        wrapAt.set(run[0], [...run]);
        for (const k of run.slice(1)) inWrap.add(k);
      }
      run = [];
    };
    blocks.forEach((b, i) => {
      const name =
        b.kind === "tool_call" ? callsById.get(b.callId)?.function.name ?? "" : "";
      const wrappable =
        b.kind === "tool_call" &&
        !askDupSkip.has(i) &&
        !dupCallSkip.has(i) &&
        !isWrapStandalone(name);
      if (wrappable) {
        run.push(i);
        return;
      }
      // Empty text and skipped dup blocks don't break a run; real text and
      // standalone tools (edits/tasks) do.
      if (b.kind === "text" && !b.text) return;
      if (b.kind === "tool_call" && (askDupSkip.has(i) || dupCallSkip.has(i)))
        return;
      flush();
    });
    flush();
  }
  return (
    <>
      {blocks.map((b, i) => {
        if (b.kind === "text") {
          if (!b.text) return null;
          return (
            <MarkdownPreview
              key={`t${i}`}
              content={balanceFences(b.text)}
            />
          );
        }
        if (askDupSkip.has(i) || dupCallSkip.has(i) || inWrap.has(i))
          return null;
        const wrap = wrapAt.get(i);
        if (wrap) {
          const items = wrap
            .map((k) => {
              const blk = blocks[k];
              return blk.kind === "tool_call"
                ? { id: blk.callId, call: callsById.get(blk.callId) }
                : null;
            })
            .filter(
              (c): c is { id: string; call: ToolCall } => !!c && !!c.call,
            );
          if (items.length === 0) return null;
          return (
            <div key={`w${i}`} className="ai-tcall-wrap">
              {items.map((it) => (
                <ToolCallRow
                  key={it.id}
                  call={it.call}
                  result={resultsById.get(it.id)}
                />
              ))}
            </div>
          );
        }
        const call = callsById.get(b.callId);
        if (!call) return null;
        return (
          <div key={`c${i}`} className="ai-tcalls ai-tcalls-inline">
            <ToolCallRow
              call={call}
              result={resultsById.get(b.callId)}
            />
          </div>
        );
      })}
    </>
  );
}

const EMPTY_ID_SET: Set<string> = new Set();

/** Last path segment of an editing tool's target, or its primary detail
 *  (search query, bash command) for non-file tools. */
function shortTarget(call: ToolCall): string {
  const path = pathOf(call);
  if (path && path !== "(unknown)")
    return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
  return primaryToolDetail(call.function.arguments);
}

/** Full file path of an editing tool, or "" if it isn't file-targeted. */
function fullPathOf(call: ToolCall): string {
  if (!EDIT_NAMES.has(call.function.name)) return "";
  const p = pathOf(call);
  return p && p !== "(unknown)" ? p : "";
}

// Read-only "looking around" tools. They get collapsed into ONE muted
// summary chip so they don't compete with the actions that actually
// changed something.
const EXPLORE_NAMES = new Set([
  "Read",
  "NotebookRead",
  "Grep",
  "Glob",
  "ToolSearch",
  "WebSearch",
  "WebFetch",
]);

// A run of consecutive tool calls, rendered with hierarchy: all the
// read/search "exploration" collapses into one quiet chip ("read 16
// files"), while changes (edits/writes) and commands stand out as their
// own prominent chips. Clicking an edit chip opens that file; any chip
// expands its full detail inline.
function InlineActionRow({
  items,
  resultsById,
  erroredIds,
  streaming,
}: {
  items: { id: string; call: ToolCall }[];
  resultsById: Map<string, string>;
  erroredIds: Set<string>;
  streaming: boolean;
}) {
  const onOpenFile = useContext(AgentFileOpen);
  const [open, setOpen] = useState<string | null>(null);

  const explore = items.filter((it) =>
    EXPLORE_NAMES.has(it.call.function.name),
  );
  const actionItems = items.filter(
    (it) => !EXPLORE_NAMES.has(it.call.function.name),
  );
  // Merge consecutive same-tool action calls into one chip.
  const groups: { name: string; calls: { id: string; call: ToolCall }[] }[] = [];
  for (const it of actionItems) {
    const last = groups[groups.length - 1];
    if (last && last.name === it.call.function.name) last.calls.push(it);
    else groups.push({ name: it.call.function.name, calls: [it] });
  }

  const statusOf = (calls: { id: string; call: ToolCall }[]) => {
    if (calls.some((c) => erroredIds.has(c.id))) return "error";
    if (streaming && !calls.every((c) => resultsById.has(c.id)))
      return "pending";
    return "ok";
  };

  // Quiet exploration summary chip.
  const reads = explore.filter((it) =>
    /Read/.test(it.call.function.name),
  ).length;
  const searches = explore.length - reads;
  const exLabel =
    searches === 0
      ? `read ${reads} file${reads === 1 ? "" : "s"}`
      : reads === 0
        ? `${searches} search${searches === 1 ? "" : "es"}`
        : `explored ${explore.length}`;

  return (
    <div className="ai-iarow">
      <div className="ai-iarow-chips">
        {explore.length > 0 && (
          <button
            className={`ai-ichip tone-muted status-${statusOf(explore)} ${open === "explore" ? "active" : ""}`}
            title={`${reads} read · ${searches} search`}
            aria-expanded={open === "explore"}
            onClick={() => setOpen(open === "explore" ? null : "explore")}
          >
            <span className="ai-ichip-dot" aria-hidden="true" />
            <Icon name="search" size={12} />
            <span className="ai-ichip-label">{exLabel}</span>
          </button>
        )}
        {groups.map((g, gi) => {
          const n = g.calls.length;
          const verb = toolVerb(g.name);
          const targets = [
            ...new Set(g.calls.map((c) => shortTarget(c.call)).filter(Boolean)),
          ];
          const label =
            targets.length === 1
              ? `${verb} ${targets[0]}${n > 1 ? ` ×${n}` : ""}`
              : verb;
          const key = `a${gi}`;
          const tone = EDIT_NAMES.has(g.name) ? "tone-edit" : "tone-action";
          const file = targets.length === 1 ? fullPathOf(g.calls[0].call) : "";
          const canOpen = !!onOpenFile && !!file;
          return (
            <button
              key={key}
              className={`ai-ichip ${tone} status-${statusOf(g.calls)} ${open === key ? "active" : ""}`}
              title={`${verb} ${targets.join(", ")}`}
              aria-expanded={open === key}
              onClick={() => {
                if (canOpen) onOpenFile!(file);
                else setOpen(open === key ? null : key);
              }}
            >
              <span className="ai-ichip-dot" aria-hidden="true" />
              <Icon name={toolIconName(g.name)} size={13} />
              {targets.length > 1 && n > 1 && (
                <span className="ai-ichip-count">{n}</span>
              )}
              <span className="ai-ichip-label">{label}</span>
            </button>
          );
        })}
      </div>
      {open !== null &&
        (() => {
          const calls =
            open === "explore"
              ? explore
              : (groups[parseInt(open.slice(1), 10)]?.calls ?? []);
          if (calls.length === 0) return null;
          return (
            <div className="ai-iaction-detail">
              {calls.map((it, idx) => (
                <ToolCallRow
                  key={it.id ?? idx}
                  call={it.call}
                  result={it.id ? resultsById.get(it.id) : undefined}
                />
              ))}
            </div>
          );
        })()}
    </div>
  );
}

// Foldable extended-thinking block, rendered inline in the compact chat
// where the model reasoned. Collapsed by default (the answer matters more
// than the scratch work) but one click away.
function ThinkingBlock({ text }: { text: string }) {
  return (
    <details className="ai-think-block ai-think-inline">
      <summary>
        <span>💭</span> Reasoning
      </summary>
      <div className="ai-think-body">{text}</div>
    </details>
  );
}

// Compact-mode walk of an assistant turn's blocks: prose between runs of
// icon chips, in chronological order, so narration stays attached to the
// actions it introduces. Skips task tools + AskUserQuestion (surfaced in
// the sidebar / question dock) and de-duplicates re-emitted tool ids.
function CompactBlocks({
  blocks,
  callsById,
  resultsById,
  erroredIds,
  streaming,
}: {
  blocks: NonNullable<ChatMessage["blocks"]>;
  callsById: Map<string, ToolCall>;
  resultsById: Map<string, string>;
  erroredIds: Set<string>;
  streaming: boolean;
}) {
  const seen = new Set<string>();
  const out: ReactNode[] = [];
  let run: { id: string; call: ToolCall }[] = [];
  let runKey = 0;
  const flush = () => {
    if (run.length) {
      out.push(
        <InlineActionRow
          key={`r${runKey++}`}
          items={run}
          resultsById={resultsById}
          erroredIds={erroredIds}
          streaming={streaming}
        />,
      );
      run = [];
    }
  };
  blocks.forEach((b, i) => {
    if (b.kind === "text") {
      flush();
      if (b.text) {
        // Pull extended-thinking (<think>…</think>) out of the text and
        // render it as a foldable Reasoning block in place — otherwise it
        // either leaks as raw tags or gets dropped in the compact layout.
        const { thinking, visible } = splitThinking(b.text);
        if (thinking.trim())
          out.push(<ThinkingBlock key={`tk${i}`} text={thinking} />);
        if (visible.trim())
          out.push(
            <MarkdownPreview key={`t${i}`} content={balanceFences(visible)} />,
          );
      }
      return;
    }
    if (seen.has(b.callId)) return;
    seen.add(b.callId);
    const call = callsById.get(b.callId);
    if (!call) return;
    if (TASK_NAMES.has(call.function.name)) return; // tasks live in the sidebar
    run.push({ id: b.callId, call });
  });
  flush();
  return <>{out}</>;
}

// ── Action strip (compact / agent chat) ────────────────────────────
// Non-edit, non-task tool calls collapse to categorized chips ("6 reads ·
// 2 searches · ➜ tsc"). Clicking a chip expands its rows. Edits are NOT
// here — they roll into the ComposeCard; tasks live in the sidebar.
const ACTION_CATS: {
  key: string;
  icon: IconName;
  sing: string;
  plur: string;
  names: string[];
}[] = [
  { key: "read", icon: "file-text", sing: "read", plur: "reads", names: ["Read", "NotebookRead"] },
  { key: "search", icon: "search", sing: "search", plur: "searches", names: ["Grep", "Glob", "ToolSearch"] },
  { key: "run", icon: "terminal", sing: "command", plur: "commands", names: ["Bash", "BashOutput", "KillShell"] },
  { key: "web", icon: "globe", sing: "web call", plur: "web calls", names: ["WebSearch", "WebFetch"] },
];
const EDIT_NAMES = new Set(["Edit", "MultiEdit", "Write", "create_file", "NotebookEdit"]);
const TASK_NAMES = new Set([
  "TaskCreate",
  "TaskUpdate",
  "TaskList",
  "TodoWrite",
  "AskUserQuestion",
]);

function actionCategoryKey(name: string): string {
  for (const c of ACTION_CATS) if (c.names.includes(name)) return c.key;
  return "other";
}

export function ActionStrip({
  calls,
  resultsById,
}: {
  calls: ToolCall[];
  resultsById: Map<string, string>;
}) {
  const [open, setOpen] = useState<string | null>(null);
  // Keep only the "activity" tools — edits and tasks are surfaced
  // elsewhere (Changes card / sidebar), so they don't belong here.
  const activity = calls.filter(
    (c) => !EDIT_NAMES.has(c.function.name) && !TASK_NAMES.has(c.function.name),
  );
  if (activity.length === 0) return null;

  const groups = new Map<string, ToolCall[]>();
  for (const c of activity) {
    const k = actionCategoryKey(c.function.name);
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(c);
  }
  // Stable order: defined categories first, then "other".
  const ordered = [
    ...ACTION_CATS.filter((c) => groups.has(c.key)).map((c) => ({
      key: c.key,
      icon: c.icon,
      label: (n: number) => `${n} ${n === 1 ? c.sing : c.plur}`,
      items: groups.get(c.key)!,
    })),
    ...(groups.has("other")
      ? [
          {
            key: "other",
            icon: "code" as IconName,
            label: (n: number) => `${n} ${n === 1 ? "action" : "actions"}`,
            items: groups.get("other")!,
          },
        ]
      : []),
  ];

  const openItems = ordered.find((g) => g.key === open)?.items;

  return (
    <div className="ai-actionstrip">
      <div className="ai-actionstrip-chips">
        {ordered.map((g) => (
          <button
            key={g.key}
            className={`ai-chip ${open === g.key ? "active" : ""}`}
            onClick={() => setOpen(open === g.key ? null : g.key)}
            aria-expanded={open === g.key}
          >
            <Icon name={g.icon} size={12} />
            <span>{g.label(g.items.length)}</span>
          </button>
        ))}
      </div>
      {openItems && (
        <div className="ai-actionstrip-detail">
          {openItems.map((c, i) => (
            <ToolCallRow
              key={c.id ?? i}
              call={c}
              result={c.id ? resultsById.get(c.id) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface AskQuestionSpec {
  question: string;
  header?: string;
  multiSelect: boolean;
  options: { label: string; description?: string }[];
}

/** Defensive parse of AskUserQuestion's tool input. */
function parseAskQuestions(args: Record<string, unknown>): AskQuestionSpec[] {
  if (!Array.isArray(args.questions)) return [];
  const out: AskQuestionSpec[] = [];
  for (const raw of args.questions) {
    if (!raw || typeof raw !== "object") continue;
    const q = raw as Record<string, unknown>;
    if (typeof q.question !== "string" || !Array.isArray(q.options)) continue;
    const options = q.options
      .map((o) => {
        if (typeof o === "string") return { label: o };
        if (o && typeof o === "object") {
          const oo = o as Record<string, unknown>;
          if (typeof oo.label === "string") {
            return {
              label: oo.label,
              description:
                typeof oo.description === "string"
                  ? oo.description
                  : undefined,
            };
          }
        }
        return null;
      })
      .filter((o): o is { label: string; description?: string } => !!o);
    if (options.length === 0) continue;
    out.push({
      question: q.question,
      header: typeof q.header === "string" ? q.header : undefined,
      multiSelect: q.multiSelect === true,
      options,
    });
  }
  return out;
}

/** Interactive question card for Claude Code's AskUserQuestion. The
 *  hook can only allow/deny (it can't feed an ANSWER back to a waiting
 *  tool call), so the flow is: the overlay denies the call telling the
 *  model the user sees clickable options and to wait; this card renders
 *  those options; a click sends the selection as the next user message,
 *  which resumes the session. Single-choice questions send on click;
 *  multi-select / multi-question cards collect then send. */
export function AskQuestionCard({
  call,
  onAnswer,
  onOther,
  onDismiss,
}: {
  call: ToolCall;
  onAnswer?: (text: string) => void;
  /** "Other…" picked — host should focus the chat input so the user
   *  types a free-form answer instead. */
  onOther?: () => void;
  /** ✕ / Esc — hide the card and let the user just keep chatting. */
  onDismiss?: () => void;
}) {
  const questions = parseAskQuestions(call.function.arguments);
  const [picked, setPicked] = useState<Map<number, Set<string>>>(new Map());
  const [activeIdx, setActiveIdx] = useState(0);
  const [sent, setSent] = useState(false);
  const interactive = !!onAnswer && !sent;

  // Esc dismisses the docked card — unless the user is typing in an
  // input (the composer's own Esc behavior wins there).
  useEffect(() => {
    if (!onDismiss || !interactive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      )
        return;
      e.preventDefault();
      onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss, interactive]);

  if (questions.length === 0) {
    // Args still streaming in (or unexpected shape) — placeholder row.
    return (
      <div className="ai-tcall">
        <div className="ai-tcall-head">
          <span className="ai-tcall-dot" />
          <span className="ai-tcall-name">Question</span>
          <span className="ai-tcall-pending">
            <span className="ai-spinner" />
          </span>
        </div>
      </div>
    );
  }

  const answered = (i: number) => (picked.get(i)?.size ?? 0) > 0;
  const allAnswered = questions.every((_, i) => answered(i));

  const answerText = (sel: Map<number, Set<string>>) =>
    questions
      .map((q, i) => {
        const chosen = [...(sel.get(i) ?? [])];
        const prefix = q.header ?? q.question;
        return `${prefix}: ${chosen.join(", ")}`;
      })
      .join("\n");

  // Jump to the next unanswered question, wrapping; stay put when
  // everything is answered (Send is enabled by then).
  const advance = (from: number, sel: Map<number, Set<string>>) => {
    for (let step = 1; step <= questions.length; step++) {
      const idx = (from + step) % questions.length;
      if ((sel.get(idx)?.size ?? 0) === 0) {
        setActiveIdx(idx);
        return;
      }
    }
  };

  const choose = (qi: number, label: string) => {
    if (!interactive) return;
    const q = questions[qi];
    const next = new Map(picked);
    const cur = new Set(next.get(qi) ?? []);
    if (q.multiSelect) {
      if (cur.has(label)) cur.delete(label);
      else cur.add(label);
    } else {
      cur.clear();
      cur.add(label);
    }
    next.set(qi, cur);
    setPicked(next);
    if (!q.multiSelect) {
      if (questions.length === 1) {
        // Single question, single choice → no extra Send step.
        setSent(true);
        onAnswer!(answerText(next));
      } else {
        // Radio answered → flow straight to the next open question.
        advance(qi, next);
      }
    }
  };

  const needsSendButton =
    questions.length > 1 || questions.some((q) => q.multiSelect);
  const idx = Math.min(activeIdx, questions.length - 1);
  const q = questions[idx];

  return (
    <div className={`ai-ask-card ${sent ? "ai-ask-card-sent" : ""}`}>
      <div className="ai-ask-title">
        <span className="ai-ask-title-icon" aria-hidden="true">
          ?
        </span>
        {questions.length === 1
          ? "Claude needs your input"
          : `Claude needs your input — ${
              questions.filter((_, i) => answered(i)).length
            }/${questions.length} answered`}
        {onDismiss && interactive && (
          <button
            type="button"
            className="ai-ask-close"
            onClick={onDismiss}
            title="Dismiss (Esc) — you can still answer in the message box"
            aria-label="Dismiss question card"
          >
            ✕
          </button>
        )}
      </div>
      {questions.length > 1 && (
        <div className="ai-ask-tabs" role="tablist">
          {questions.map((tq, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === idx}
              className={`ai-ask-tab ${i === idx ? "active" : ""} ${
                answered(i) ? "answered" : ""
              }`}
              onClick={() => setActiveIdx(i)}
            >
              {answered(i) && <span aria-hidden="true">✓ </span>}
              {tq.header ?? `Q${i + 1}`}
            </button>
          ))}
        </div>
      )}
      <div className="ai-ask-question">
        <div className="ai-ask-qtext">
          {questions.length === 1 && q.header && (
            <span className="ai-ask-header">{q.header}</span>
          )}
          {q.question}
          {q.multiSelect && (
            <span className="ai-ask-multi">select all that apply</span>
          )}
        </div>
        <div
          className="ai-ask-options"
          role={q.multiSelect ? "group" : "radiogroup"}
        >
          {q.options.map((o) => {
            const isPicked = picked.get(idx)?.has(o.label) ?? false;
            return (
              <button
                key={o.label}
                type="button"
                role={q.multiSelect ? "checkbox" : "radio"}
                aria-checked={isPicked}
                className={`ai-ask-option ${isPicked ? "picked" : ""}`}
                disabled={!interactive}
                onClick={() => choose(idx, o.label)}
                title={o.description}
              >
                <span
                  className={`ai-ask-ind ${
                    q.multiSelect ? "ai-ask-ind-check" : "ai-ask-ind-radio"
                  } ${isPicked ? "on" : ""}`}
                  aria-hidden="true"
                />
                <span className="ai-ask-option-text">
                  <span className="ai-ask-option-label">{o.label}</span>
                  {o.description && (
                    <span className="ai-ask-option-desc">
                      {o.description}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
          {interactive && onOther && (
            <button
              type="button"
              className="ai-ask-option ai-ask-option-other"
              onClick={onOther}
              title="Answer in your own words in the message box"
            >
              <span
                className={`ai-ask-ind ${
                  q.multiSelect ? "ai-ask-ind-check" : "ai-ask-ind-radio"
                }`}
                aria-hidden="true"
              />
              <span className="ai-ask-option-text">
                <span className="ai-ask-option-label">Other…</span>
              </span>
            </button>
          )}
        </div>
        {interactive &&
          q.multiSelect &&
          questions.length > 1 &&
          answered(idx) &&
          !allAnswered && (
            <button
              type="button"
              className="ai-ask-next"
              onClick={() => advance(idx, picked)}
            >
              Next question →
            </button>
          )}
      </div>
      <div className="ai-ask-foot">
        {interactive && needsSendButton && (
          <button
            type="button"
            className="ai-ask-send"
            disabled={!allAnswered}
            onClick={() => {
              setSent(true);
              onAnswer!(answerText(picked));
            }}
          >
            Send answer{questions.length > 1 ? "s" : ""}
          </button>
        )}
        {interactive && (
          <span className="ai-ask-hint">
            …or just reply in the message box below.
            {onDismiss ? " Esc to dismiss." : ""}
          </span>
        )}
        {sent && <span className="ai-ask-hint">Answer sent.</span>}
      </div>
    </div>
  );
}

export function ToolCallRow({
  call,
  result,
}: {
  call: ToolCall;
  result: string | undefined;
}) {
  // Hook before the edit-card early return — a row whose args stream in
  // can flip between the generic and diff renders across re-renders.
  const openSubagent = useContext(SubagentOpen);
  const openFile = useContext(AgentFileOpen);
  // A subagent run. Newer Claude Code names this tool "Agent"; older
  // versions / other providers use "Task". Render it as a duck-avatar chip
  // that opens the subagent's read-only transcript on click (the transcript
  // lands on disk once the run finishes, linked by this call's id).
  if (call.function.name === "Task" || call.function.name === "Agent") {
    const agentType = subagentTypeOf(call.function.arguments);
    const desc =
      typeof call.function.arguments.description === "string"
        ? call.function.arguments.description
        : "";
    const canOpen = !!openSubagent && !!call.id;
    return (
      <div className="ai-tcall ai-tcall-subagent">
        <button
          type="button"
          className="ai-tcall-head ai-subagent-head"
          disabled={!canOpen}
          onClick={
            canOpen
              ? () => openSubagent!(call.id!, agentType)
              : undefined
          }
          title={
            canOpen
              ? "Open this subagent's transcript (read-only)"
              : "Subagent"
          }
        >
          <img
            className="ai-subagent-avatar"
            src={duckAvatarFor(agentType)}
            alt=""
            aria-hidden="true"
          />
          <span className="ai-tcall-name">{agentType || "Subagent"}</span>
          {desc && <span className="ai-tcall-detail">{desc}</span>}
          {typeof result !== "string" && (
            <span className="ai-tcall-pending">
              <span className="ai-spinner" />
            </span>
          )}
        </button>
      </div>
    );
  }
  // AskUserQuestion: a compact one-line record in the transcript. The
  // INTERACTIVE card renders docked above the composer (AIChatPanel's
  // ask-dock) while the question is pending — rendering full option
  // lists here too duplicated the whole card. The deny reason in
  // `result` is plumbing (the redirect instruction), never shown.
  if (call.function.name === "AskUserQuestion") {
    const qs = parseAskQuestions(call.function.arguments);
    const summary =
      qs.map((q) => q.header ?? q.question).join(" · ") || "question";
    return (
      <div className="ai-tcall">
        <div className="ai-tcall-head">
          <span className="ai-tcall-dot" />
          <span className="ai-tcall-name">Question</span>
          <span className="ai-tcall-detail" title={summary}>
            {summary}
          </span>
        </div>
      </div>
    );
  }
  // Edit / Write / MultiEdit get a richer view that shows the actual
  // diff inline, since the bare args summary ("file_path foo.ts") tells
  // the user nothing about *what changed*. Falls through to the generic
  // row for all other tools.
  const editDiffs = extractEditDiffs(call);
  if (editDiffs && editDiffs.length > 0) {
    return <EditDiffCard call={call} diffs={editDiffs} result={result} />;
  }
  const label = friendlyToolName(call.function.name);
  const detail = primaryToolDetail(call.function.arguments);
  // A Read of an image attachment gets its own icon/tint, and the drawer
  // shows the picture instead of the textual "[image]" placeholder.
  const imageRef =
    READ_NAMES.has(call.function.name) && (() => {
      const p = fileRefOf(call);
      return p && isImagePath(p) ? p : "";
    })();
  const icon = imageRef ? "image" : toolIconFor(call.function.name);
  const hasResult = typeof result === "string";
  // Tools like ToolSearch / TaskUpdate legitimately return no text —
  // their effect is the side channel, not the output. A quiet check says
  // "done" instead of an empty "(empty)" row that read like a failure.
  const resultIsEmpty = hasResult && result!.trim().length === 0;
  const canShow = hasResult && !resultIsEmpty;
  const fileRef = fileRefOf(call);
  const markdown = isMarkdownRead(call);
  const onOpenFile = openFile && fileRef ? () => openFile(fileRef) : undefined;
  // Clicking the pill opens the right-side result drawer (read/bash/search
  // output). With no output but a file path it just opens the file in a tab.
  // An image read still has a (placeholder) result, so canShow is true and
  // clicking the pill opens the drawer — where imagePath shows the picture.
  const onPrimary =
    canShow || imageRef
      ? () =>
          requestToolDrawer({
            title: label,
            subtitle: detail || undefined,
            result: markdown ? stripReadGutter(result ?? "") : (result ?? ""),
            markdown,
            imagePath: imageRef || undefined,
            onOpenFile,
          })
      : onOpenFile;
  const primaryTitle = imageRef
    ? "Show image"
    : canShow
      ? "Show output"
      : fileRef
        ? `Open ${fileRef} in a new tab`
        : undefined;
  return (
    <div className="ai-tcall">
      <ToolRowHead
        icon={icon}
        name={label}
        detail={shortDetail(detail)}
        detailTitle={detail}
        onPrimary={onPrimary}
        primaryTitle={primaryTitle}
        skill={call.function.name === "Skill"}
        image={!!imageRef}
        extra={
          !hasResult ? (
            <span className="ai-spinner ai-spinner-sm" />
          ) : resultIsEmpty ? (
            <span className="ai-tcall-done" title="Done">
              <Icon name="check" size={12} />
            </span>
          ) : undefined
        }
      />
    </div>
  );
}

interface EditDiffCardProps {
  call: ToolCall;
  diffs: EditDiff[];
  result: string | undefined;
}

function EditDiffCard({ call, diffs, result }: EditDiffCardProps) {
  const args = call.function.arguments as Record<string, unknown>;
  const path =
    (typeof args.file_path === "string" && args.file_path) ||
    (typeof args.path === "string" && args.path) ||
    "(unknown file)";
  // Past-tense verb + basename, Cursor-style ("Edited test.md") — full path in
  // the tooltip. Clicking opens the real before/after in the centered DiffModal
  // (Monaco), the same surface the source-control panel uses.
  const verb = toolVerb(call.function.name);
  const label = verb.charAt(0).toUpperCase() + verb.slice(1);
  const base = path.split(/[\\/]/).filter(Boolean).pop() ?? path;
  const icon = toolIconFor(call.function.name);
  const { added, removed } = diffStats(diffs);
  const isError =
    typeof result === "string" && /^Error|error:/i.test(result.trim());
  // Join the edit fragments into one original/modified pair for the diff view.
  // Write/create → empty original → renders as all-added.
  const original = diffs.map((d) => d.oldText).filter(Boolean).join("\n\n");
  const modified = diffs.map((d) => d.newText).filter(Boolean).join("\n\n");
  const openDiff = () =>
    requestDiff({
      path: base,
      refspec: "before → after",
      originalContent: original,
      modifiedContent: modified,
      language: langOf(path),
    });
  return (
    <div className={`ai-tcall ai-tcall-edit ${isError ? "errored" : ""}`}>
      <ToolRowHead
        icon={icon}
        name={label}
        detail={base}
        detailTitle={path}
        onPrimary={openDiff}
        primaryTitle={`Open the diff for ${base}`}
        extra={
          <>
            {removed > 0 && (
              <span className="ai-tcall-edit-rm">−{removed}</span>
            )}
            {added > 0 && <span className="ai-tcall-edit-add">+{added}</span>}
          </>
        }
      />
    </div>
  );
}

