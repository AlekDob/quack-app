// Cursor-style one-line action batch summaries for the chat stream.
// Present continuous while tools are in flight ("Exploring…"); past
// when the batch settles ("Explored…" / "Edited N files +X −Y").
// Per-file edit rows expand to an inline diff snippet.

import { useContext, useState, type ReactNode } from "react";
import type { ToolCall } from "../ai";
import { requestToolDrawer } from "../toolDrawer";
import { requestDiff } from "../editorState";
import { langOf } from "../langDetect";
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
  type EditDiff,
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

function basename(path: string): string {
  if (!path || path === "(unknown)") return "";
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}

function uniqueEditPaths(edits: BatchItem[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const it of edits) {
    const p = pathOf(it.call);
    if (!p || p === "(unknown)" || seen.has(p)) continue;
    seen.add(p);
    out.push(p);
  }
  return out;
}

/** One muted sentence — Cursor order: Edited…, explored…, searches, Ran… */
export function batchSummaryLabel(
  items: BatchItem[],
  opts: BatchSummaryOpts,
): string {
  if (items.length === 0) return "";

  const explore = items.filter((it) =>
    EXPLORE_NAMES.has(it.call.function.name),
  );
  const bash = items.filter((it) => BASH_NAMES.has(it.call.function.name));
  const edits = items.filter((it) => EDIT_NAMES.has(it.call.function.name));
  const other = items.filter(
    (it) =>
      !EXPLORE_NAMES.has(it.call.function.name) &&
      !BASH_NAMES.has(it.call.function.name) &&
      !EDIT_NAMES.has(it.call.function.name),
  );

  const parts: string[] = [];
  const live = opts.live;
  const editPaths = uniqueEditPaths(edits);

  // Single-file edit batch → "Edited foo.ts" (counts live as Editing).
  if (edits.length > 0 && editPaths.length === 1 && explore.length === 0 && bash.length === 0 && other.length === 0) {
    const base = basename(editPaths[0]);
    if (live) return base ? `Editing ${base}` : "Editing 1 file";
    return base ? `Edited ${base}` : "Edited 1 file";
  }

  if (edits.length > 0) {
    const n = Math.max(editPaths.length, 1);
    parts.push(
      live
        ? `Editing ${plural(n, "file", "files")}`
        : `Edited ${plural(n, "file", "files")}`,
    );
  }

  if (explore.length > 0) {
    const reads = explore.filter((it) => isRead(it.call.function.name)).length;
    const searches = explore.filter((it) =>
      isSearch(it.call.function.name),
    ).length;
    const lead = parts.length === 0;
    if (live) {
      if (reads > 0 && searches > 0) {
        parts.push(
          lead
            ? `Exploring ${plural(reads, "file", "files")}, ${plural(searches, "search", "searches")}`
            : `exploring ${plural(reads, "file", "files")}, ${plural(searches, "search", "searches")}`,
        );
      } else if (reads > 0) {
        parts.push(
          lead
            ? `Exploring ${plural(reads, "file", "files")}`
            : `exploring ${plural(reads, "file", "files")}`,
        );
      } else if (searches > 0) {
        parts.push(
          lead
            ? `Exploring ${plural(searches, "search", "searches")}`
            : plural(searches, "search", "searches"),
        );
      } else {
        parts.push(lead ? `Exploring ${explore.length}` : `exploring ${explore.length}`);
      }
    } else if (reads > 0 && searches > 0) {
      parts.push(
        lead
          ? `Explored ${plural(reads, "file", "files")}, ${plural(searches, "search", "searches")}`
          : `explored ${plural(reads, "file", "files")}, ${plural(searches, "search", "searches")}`,
      );
    } else if (reads > 0) {
      parts.push(
        lead
          ? `Explored ${plural(reads, "file", "files")}`
          : `explored ${plural(reads, "file", "files")}`,
      );
    } else if (searches > 0) {
      parts.push(
        lead
          ? `Explored ${plural(searches, "search", "searches")}`
          : plural(searches, "search", "searches"),
      );
    } else {
      parts.push(lead ? `Explored ${explore.length}` : `explored ${explore.length}`);
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

  if (other.length > 0) {
    const verb = live ? "Running" : "Ran";
    parts.push(`${verb} ${plural(other.length, "action", "actions")}`);
  }

  return parts.join(", ");
}

/** Sum +/- across edit tools in the batch. */
export function batchDiffTotals(
  items: BatchItem[],
): { added: number; removed: number } | null {
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

/**
 * Estimate how much text the stream would mount for a tool batch.
 * Collapsed (default) = one summary line; expanded = every detail /
 * edit-diff body. Used to prove compact summaries load less than
 * expanding every tool (perceived perf — less DOM text on first paint).
 */
export function batchRenderCost(
  items: BatchItem[],
  mode: "collapsed" | "expanded",
): { chars: number; lines: number } {
  if (items.length === 0) return { chars: 0, lines: 0 };

  // Solo: always one line (no group chrome) — same cost either mode
  // for the head; expanded still adds nothing until user opens a drawer.
  if (items.length === 1) {
    const label =
      batchSummaryLabel(items, { live: false }) ||
      detailToolLabel(items[0].call);
    const diffs = batchDiffTotals(items);
    const diffTrail =
      diffs && (diffs.added > 0 || diffs.removed > 0)
        ? `+${diffs.added}−${diffs.removed}`
        : "";
    const head = label + diffTrail;
    return { chars: head.length, lines: 1 };
  }

  const head = batchSummaryLabel(items, { live: false });
  const totals = batchDiffTotals(items);
  const diffTrail =
    totals && (totals.added > 0 || totals.removed > 0)
      ? `+${totals.added}−${totals.removed}`
      : "";
  const collapsed = head + diffTrail;

  if (mode === "collapsed") {
    return { chars: collapsed.length, lines: 1 };
  }

  let chars = collapsed.length;
  let lines = 1;
  for (const it of items) {
    const detail = detailToolLabel(it.call);
    chars += detail.length;
    lines += 1;
    const diffs = extractEditDiffs(it.call);
    if (diffs) {
      for (const d of diffs) {
        // Expanded inline preview mounts old+new text (capped in UI at
        // ~14 lines, but cost here uses full args — worst-case expand).
        chars += (d.oldText?.length ?? 0) + (d.newText?.length ?? 0);
      }
    }
  }
  return { chars, lines };
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
  if (names.some((n) => EDIT_NAMES.has(n))) return "edit";
  if (names.some((n) => BASH_NAMES.has(n))) return "terminal";
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
  /** @deprecated Edits stay in the stream; ComposeCard still recaps at turn end. */
  hideEdits?: boolean;
  erroredIds?: Set<string>;
};

type FileEditGroup = {
  path: string;
  items: BatchItem[];
  diffs: EditDiff[];
  added: number;
  removed: number;
};

function groupEditsByFile(items: BatchItem[]): FileEditGroup[] {
  const map = new Map<string, BatchItem[]>();
  for (const it of items) {
    if (!EDIT_NAMES.has(it.call.function.name)) continue;
    const p = pathOf(it.call);
    if (!p || p === "(unknown)") continue;
    const arr = map.get(p);
    if (arr) arr.push(it);
    else map.set(p, [it]);
  }
  return Array.from(map.entries()).map(([path, group]) => {
    const diffs: EditDiff[] = [];
    for (const it of group) {
      const d = extractEditDiffs(it.call);
      if (d) diffs.push(...d);
    }
    const stats = diffStats(diffs);
    return {
      path,
      items: group,
      diffs,
      added: stats.added,
      removed: stats.removed,
    };
  });
}

/** One line when a batch has a single tool — no expand/group chrome. */
function SoloActionLine({
  item,
  resultsById,
  streaming,
  errored,
}: {
  item: BatchItem;
  resultsById: Map<string, string>;
  streaming: boolean;
  errored?: boolean;
}) {
  const openFile = useContext(AgentFileOpen);
  const call = item.call;
  const name = call.function.name;
  const live = streaming && !(item.id && resultsById.has(item.id));
  const editDiffs = extractEditDiffs(call);
  const path = pathOf(call);
  const base = basename(path);
  const tone = toolToneOf(name);
  const ico = detailIcon(name);

  let label: string;
  let added = 0;
  let removed = 0;
  if (editDiffs && editDiffs.length > 0) {
    const stats = diffStats(editDiffs);
    added = stats.added;
    removed = stats.removed;
    label = live
      ? base
        ? `Editing ${base}`
        : "Editing 1 file"
      : base
        ? `Edited ${base}`
        : "Edited 1 file";
  } else {
    label = live
      ? batchSummaryLabel([item], { live: true })
      : detailToolLabel(call) || batchSummaryLabel([item], { live: false });
  }

  const result = item.id ? resultsById.get(item.id) : undefined;
  const hasResult = typeof result === "string" && result.length > 0;
  const canOpenFile =
    !!openFile && !!path && path !== "(unknown)" && EDIT_NAMES.has(name);

  const onClick = () => {
    if (editDiffs && editDiffs.length > 0) {
      const original = editDiffs
        .map((d) => d.oldText)
        .filter(Boolean)
        .join("\n\n");
      const modified = editDiffs
        .map((d) => d.newText)
        .filter(Boolean)
        .join("\n\n");
      requestDiff({
        path: base || path,
        refspec: "before → after",
        originalContent: original,
        modifiedContent: modified,
        language: langOf(path),
      });
      return;
    }
    if (canOpenFile) {
      openFile!(path);
      return;
    }
    if (hasResult) {
      requestToolDrawer({
        title: friendlyToolName(name),
        subtitle:
          shortDetail(primaryToolDetail(call.function.arguments)) || undefined,
        result,
      });
    }
  };

  return (
    <div
      className={`ai-batch-summary is-solo${live ? " is-live" : ""}${errored ? " is-error" : ""}`}
    >
      <button
        type="button"
        className="ai-batch-summary-head"
        onClick={onClick}
        disabled={!editDiffs && !canOpenFile && !hasResult && !live}
      >
        <Icon name={ico} size={12} className={tone ? `ai-tool-tone-${tone}` : undefined} />
        <span
          className={`ai-batch-summary-label${live ? " ai-live-shimmer" : ""}`}
        >
          {label}
        </span>
        {!live && (added > 0 || removed > 0) && (
          <span className="ai-batch-summary-diff" aria-hidden="true">
            {added > 0 && <span className="ai-compose-add">+{added}</span>}
            {removed > 0 && <span className="ai-compose-rem">−{removed}</span>}
          </span>
        )}
      </button>
    </div>
  );
}

/** Collapsed one-line batch; expands to detail / per-file edit diffs. */
export function ActionBatchSummary({
  items,
  resultsById,
  streaming,
  erroredIds,
}: Props) {
  // One tool → flat line (no group / no nested duplicate).
  if (items.length === 1) {
    const it = items[0];
    return (
      <SoloActionLine
        item={it}
        resultsById={resultsById}
        streaming={streaming}
        errored={!!(it.id && erroredIds?.has(it.id))}
      />
    );
  }
  return (
    <BatchGroupSummary
      items={items}
      resultsById={resultsById}
      streaming={streaming}
      erroredIds={erroredIds}
    />
  );
}

function BatchGroupSummary({
  items,
  resultsById,
  streaming,
  erroredIds,
}: Props) {
  const [open, setOpen] = useState(false);
  const allDone = items.every((it) => !it.id || resultsById.has(it.id));
  const live = streaming && !allDone;
  const hasError =
    !!erroredIds && items.some((it) => it.id && erroredIds.has(it.id));
  const label = batchSummaryLabel(items, { live });
  if (!label) return null;

  const diffs = !live ? batchDiffTotals(items) : null;
  const ico = summaryIcon(items);
  const tone = summaryToneClass(items);
  const editGroups = groupEditsByFile(items);
  const nonEdits = items.filter(
    (it) => !EDIT_NAMES.has(it.call.function.name),
  );

  return (
    <div
      className={`ai-batch-summary${live ? " is-live" : ""}${hasError ? " is-error" : ""}`}
    >
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
          {editGroups.map((g) => (
            <EditFileDetail key={g.path} group={g} />
          ))}
          {nonEdits.map((it, idx) => (
            <DetailToolLine
              key={it.id || idx}
              call={it.call}
              result={it.id ? resultsById.get(it.id) : undefined}
              errored={!!(it.id && erroredIds?.has(it.id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** “Edited foo.ts +9” → expands to inline diff snippet. */
function EditFileDetail({ group }: { group: FileEditGroup }) {
  const [open, setOpen] = useState(false);
  const base = basename(group.path) || group.path;
  const original = group.diffs.map((d) => d.oldText).filter(Boolean).join("\n\n");
  const modified = group.diffs.map((d) => d.newText).filter(Boolean).join("\n\n");

  const openFullDiff = () =>
    requestDiff({
      path: base,
      refspec: "before → after",
      originalContent: original,
      modifiedContent: modified,
      language: langOf(group.path),
    });

  return (
    <div className={`ai-batch-edit-file${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="ai-batch-edit-file-head"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="ai-batch-edit-file-label">Edited {base}</span>
        <span className="ai-batch-summary-diff" aria-hidden="true">
          {group.added > 0 && (
            <span className="ai-compose-add">+{group.added}</span>
          )}
          {group.removed > 0 && (
            <span className="ai-compose-rem">−{group.removed}</span>
          )}
        </span>
        <Icon
          name="chevron-down"
          size={10}
          className={`ai-batch-summary-caret${open ? " is-open" : ""}`}
        />
      </button>
      {open && (
        <button
          type="button"
          className="ai-batch-edit-diff"
          onClick={openFullDiff}
          title={`Open full diff for ${base}`}
        >
          <InlineDiffPreview diffs={group.diffs} />
        </button>
      )}
    </div>
  );
}

const DIFF_PREVIEW_LINES = 14;

function InlineDiffPreview({ diffs }: { diffs: EditDiff[] }) {
  const lines: { kind: "add" | "del" | "ctx"; text: string }[] = [];
  for (const d of diffs) {
    if (d.oldText) {
      for (const line of d.oldText.split("\n").slice(0, 8)) {
        lines.push({ kind: "del", text: line });
      }
    }
    if (d.newText) {
      for (const line of d.newText.split("\n").slice(0, 8)) {
        lines.push({ kind: "add", text: line });
      }
    }
  }
  const shown = lines.slice(0, DIFF_PREVIEW_LINES);
  const more = lines.length - shown.length;
  return (
    <pre className="ai-batch-edit-diff-pre">
      {shown.map((l, i) => (
        <span
          key={i}
          className={
            l.kind === "add"
              ? "ai-batch-diff-add"
              : l.kind === "del"
                ? "ai-batch-diff-del"
                : undefined
          }
        >
          {l.kind === "add" ? "+" : l.kind === "del" ? "−" : " "}
          {l.text}
          {"\n"}
        </span>
      ))}
      {more > 0 && (
        <span className="ai-batch-diff-more">… {more} more lines</span>
      )}
    </pre>
  );
}

function DetailToolLine({
  call,
  result,
  errored,
}: {
  call: ToolCall;
  result?: string;
  errored?: boolean;
}) {
  const openFile = useContext(AgentFileOpen);
  const label = detailToolLabel(call);
  const tone = toolToneOf(call.function.name);
  const path = pathOf(call);
  const canOpenFile =
    !!openFile &&
    !!path &&
    path !== "(unknown)" &&
    EDIT_NAMES.has(call.function.name);
  const hasResult = typeof result === "string" && result.length > 0;

  const onClick = () => {
    if (canOpenFile) {
      openFile!(path);
      return;
    }
    if (hasResult) {
      requestToolDrawer({
        title: friendlyToolName(call.function.name),
        subtitle:
          shortDetail(primaryToolDetail(call.function.arguments)) || undefined,
        result,
      });
    }
  };

  return (
    <button
      type="button"
      className={`ai-batch-detail-line${errored ? " is-error" : ""}`}
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
