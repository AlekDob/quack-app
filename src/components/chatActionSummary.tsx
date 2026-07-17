// Cursor-style one-line action batch summaries for the chat stream.
// Present continuous while tools are in flight ("Exploring…"); past
// when the batch settles ("Explored…"). Keeps Quack tool icons + tones.

import { useContext, useState, type ReactNode } from "react";
import type { ToolCall } from "../ai";
import { requestToolDrawer } from "../toolDrawer";
import { Icon, type IconName } from "./Icon";
import {
  AgentFileOpen,
  diffStats,
  extractEditDiffs,
  friendlyToolName,
  pathOf,
  primaryToolDetail,
  shortDetail,
  toolToneOf,
} from "./chatToolRender";

const EXPLORE_NAMES = new Set([
  "Read",
  "NotebookRead",
  "Grep",
  "Glob",
  "ToolSearch",
  "WebSearch",
  "WebFetch",
]);

const EDIT_NAMES = new Set([
  "Edit",
  "MultiEdit",
  "Write",
  "create_file",
  "NotebookEdit",
  "edit_file",
  "edit",
  "write_file",
  "write",
]);

const BASH_NAMES = new Set(["Bash", "BashOutput", "KillShell", "bash", "shell"]);

export type BatchItem = { id: string; call: ToolCall };

export type BatchSummaryOpts = {
  live: boolean;
  /** When true, omit edit counts (ComposeCard owns the recap). */
  hideEdits?: boolean;
};

function isRead(name: string): boolean {
  return /Read/i.test(name) || name === "read_file" || name === "read";
}

function isSearch(name: string): boolean {
  return (
    name === "Grep" ||
    name === "Glob" ||
    name === "ToolSearch" ||
    name === "WebSearch" ||
    name === "WebFetch" ||
    name === "grep" ||
    name === "glob" ||
    name === "search"
  );
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** One muted sentence for a consecutive tool run. */
export function batchSummaryLabel(
  items: BatchItem[],
  opts: BatchSummaryOpts,
): string {
  const visible = opts.hideEdits
    ? items.filter((it) => !EDIT_NAMES.has(it.call.function.name))
    : items;
  if (visible.length === 0) return "";

  const explore = visible.filter((it) =>
    EXPLORE_NAMES.has(it.call.function.name),
  );
  const bash = visible.filter((it) => BASH_NAMES.has(it.call.function.name));
  const edits = visible.filter((it) => EDIT_NAMES.has(it.call.function.name));
  const other = visible.filter(
    (it) =>
      !EXPLORE_NAMES.has(it.call.function.name) &&
      !BASH_NAMES.has(it.call.function.name) &&
      !EDIT_NAMES.has(it.call.function.name),
  );

  const parts: string[] = [];
  const live = opts.live;

  if (explore.length > 0) {
    const reads = explore.filter((it) => isRead(it.call.function.name)).length;
    const searches = explore.filter((it) =>
      isSearch(it.call.function.name),
    ).length;
    const rest = explore.length - reads - searches;
    if (live) {
      if (reads > 0 && searches > 0) {
        parts.push(
          `Exploring ${plural(reads, "file", "files")}, ${plural(searches, "search", "searches")}`,
        );
      } else if (reads > 0) {
        parts.push(`Exploring ${plural(reads, "file", "files")}`);
      } else if (searches > 0) {
        parts.push(`Exploring ${plural(searches, "search", "searches")}`);
      } else {
        parts.push(`Exploring ${explore.length}`);
      }
    } else if (reads > 0 && searches > 0) {
      parts.push(
        `Explored ${plural(reads, "file", "files")}, ${plural(searches, "search", "searches")}`,
      );
    } else if (reads > 0) {
      parts.push(`Explored ${plural(reads, "file", "files")}`);
    } else if (searches > 0) {
      parts.push(`Explored ${plural(searches, "search", "searches")}`);
    } else if (rest > 0) {
      parts.push(`Explored ${explore.length}`);
    }
  }

  if (bash.length > 0) {
    if (live) {
      parts.push(
        bash.length === 1
          ? "Running 1 command"
          : `Running ${bash.length} commands`,
      );
    } else if (bash.length === 1) {
      const target = shortDetail(
        primaryToolDetail(bash[0].call.function.arguments),
      );
      parts.push(target ? `Ran ${target}` : "Ran 1 command");
    } else {
      parts.push(`Ran ${bash.length} commands`);
    }
  }

  if (edits.length > 0 && !opts.hideEdits) {
    if (live) {
      parts.push(`Editing ${plural(edits.length, "file", "files")}`);
    } else {
      parts.push(`Edited ${plural(edits.length, "file", "files")}`);
    }
  }

  if (other.length > 0) {
    const verb = live ? "Running" : "Ran";
    parts.push(
      `${verb} ${plural(other.length, "action", "actions")}`,
    );
  }

  return parts.join(", ");
}

/** Sum +/- across edit tools in the batch (empty when hideEdits). */
export function batchDiffTotals(
  items: BatchItem[],
  hideEdits?: boolean,
): { added: number; removed: number } | null {
  if (hideEdits) return null;
  let added = 0;
  let removed = 0;
  let any = false;
  for (const it of items) {
    const diffs = extractEditDiffs(it.call);
    if (!diffs) continue;
    any = true;
    const s = diffStats(diffs);
    added += s.added;
    removed += s.removed;
  }
  return any ? { added, removed } : null;
}

/** Read tool line range from offset/limit args when present. */
export function readLineRange(args: Record<string, unknown>): string {
  const offset =
    typeof args.offset === "number"
      ? args.offset
      : typeof args.offset === "string"
        ? Number(args.offset)
        : NaN;
  const limit =
    typeof args.limit === "number"
      ? args.limit
      : typeof args.limit === "string"
        ? Number(args.limit)
        : NaN;
  if (!Number.isFinite(offset) || !Number.isFinite(limit) || limit <= 0) {
    return "";
  }
  const start = Math.max(1, Math.floor(offset));
  const end = start + Math.floor(limit) - 1;
  return `L${start}-${end}`;
}

function basename(path: string): string {
  if (!path || path === "(unknown)") return "";
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}

/** Verb-first detail label for an expanded tool row. */
export function detailToolLabel(call: ToolCall): string {
  const name = call.function.name;
  const args = call.function.arguments;
  const path = pathOf(call);
  const base = basename(path);
  const detail = shortDetail(primaryToolDetail(args));

  if (name === "Grep" || name === "grep" || name === "search") {
    const pat =
      typeof args.pattern === "string"
        ? args.pattern
        : typeof args.query === "string"
          ? args.query
          : detail;
    const where =
      typeof args.path === "string"
        ? args.path
        : typeof args.glob === "string"
          ? args.glob
          : "";
    if (pat && where) return `Grepped ${pat} in ${where}`;
    if (pat) return `Grepped ${pat}`;
    return "Grepped";
  }
  if (isRead(name)) {
    const range = readLineRange(args);
    if (base && range) return `Read ${base} ${range}`;
    if (base) return `Read ${base}`;
    return "Read";
  }
  if (BASH_NAMES.has(name)) {
    return detail ? `Ran ${detail}` : "Ran command";
  }
  if (EDIT_NAMES.has(name)) {
    return base ? `Edited ${base}` : "Edited file";
  }
  if (name === "Glob" || name === "glob") {
    return detail ? `Globbed ${detail}` : "Globbed";
  }
  if (name === "WebSearch" || name === "WebFetch") {
    return detail
      ? `${friendlyToolName(name)} ${detail}`
      : friendlyToolName(name);
  }
  const label = friendlyToolName(name);
  return detail ? `${label} ${detail}` : label;
}

function summaryIcon(items: BatchItem[]): IconName {
  const names = items.map((it) => it.call.function.name);
  if (names.some((n) => BASH_NAMES.has(n))) return "terminal";
  if (names.some((n) => EDIT_NAMES.has(n))) return "edit";
  if (names.some((n) => isSearch(n))) return "search";
  if (names.some((n) => isRead(n))) return "file-text";
  return "code";
}

function summaryToneClass(items: BatchItem[]): string {
  for (const it of items) {
    const tone = toolToneOf(it.call.function.name);
    if (tone) return `ai-tool-tone-${tone}`;
  }
  return "";
}

function detailIcon(name: string): IconName {
  if (BASH_NAMES.has(name)) return "terminal";
  if (EDIT_NAMES.has(name)) return "edit";
  if (isSearch(name)) return "search";
  if (isRead(name)) return "file-text";
  if (name === "WebSearch" || name === "WebFetch") return "globe";
  return "code";
}

type Props = {
  items: BatchItem[];
  resultsById: Map<string, string>;
  streaming: boolean;
  hideEdits?: boolean;
};

/** Collapsed one-line batch; expands to detail rows (or ToolCallRow). */
export function ActionBatchSummary({
  items,
  resultsById,
  streaming,
  hideEdits = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const allDone = items.every((it) => !it.id || resultsById.has(it.id));
  const live = streaming && !allDone;
  const label = batchSummaryLabel(items, { live, hideEdits });
  if (!label) return null;

  const diffs = !live ? batchDiffTotals(items, hideEdits) : null;
  const ico = summaryIcon(items);
  const tone = summaryToneClass(items);

  return (
    <div className={`ai-batch-summary${live ? " is-live" : ""}`}>
      <button
        type="button"
        className="ai-batch-summary-head"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <Icon name={ico} size={12} className={tone || undefined} />
        <span
          className={`ai-batch-summary-label${live ? " ai-live-shimmer" : ""}`}
        >
          {label}
        </span>
        {diffs && (diffs.added > 0 || diffs.removed > 0) && (
          <span className="ai-batch-summary-diff" aria-hidden="true">
            {diffs.added > 0 && (
              <span className="ai-compose-add">+{diffs.added}</span>
            )}
            {diffs.removed > 0 && (
              <span className="ai-compose-rem">−{diffs.removed}</span>
            )}
          </span>
        )}
        <Icon
          name="chevron-down"
          size={10}
          className={`ai-batch-summary-caret${open ? " is-open" : ""}`}
        />
      </button>
      {open && (
        <div className="ai-batch-summary-detail">
          {items.map((it, idx) => (
            <DetailToolLine
              key={it.id || idx}
              call={it.call}
              result={it.id ? resultsById.get(it.id) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DetailToolLine({
  call,
  result,
}: {
  call: ToolCall;
  result?: string;
}) {
  const openFile = useContext(AgentFileOpen);
  const label = detailToolLabel(call);
  const tone = toolToneOf(call.function.name);
  const path = pathOf(call);
  const canOpenFile =
    !!openFile && !!path && path !== "(unknown)" && EDIT_NAMES.has(call.function.name);
  const hasResult = typeof result === "string" && result.length > 0;

  const onClick = () => {
    if (canOpenFile) {
      openFile!(path);
      return;
    }
    if (hasResult) {
      requestToolDrawer({
        title: friendlyToolName(call.function.name),
        subtitle: shortDetail(primaryToolDetail(call.function.arguments)) || undefined,
        result,
      });
    }
  };

  return (
    <button
      type="button"
      className="ai-batch-detail-line"
      onClick={onClick}
      disabled={!canOpenFile && !hasResult}
    >
      <Icon
        name={detailIcon(call.function.name)}
        size={11}
        className={tone ? `ai-tool-tone-${tone}` : undefined}
      />
      <span className="ai-batch-detail-label">{label}</span>
    </button>
  );
}

/** Solo tool uses the same summary chrome (no bordered standalone row). */
export function SoloActionSummary(props: Props): ReactNode {
  return <ActionBatchSummary {...props} />;
}
