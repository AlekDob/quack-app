// FILE: ComposerActivityStrip.logic.ts
// Purpose: Derives every "what is running right now" row of the composer strip:
// subagents (from enriched work log entries, mirroring the active-task-list scoping
// where the live turn wins and a prior set stays visible while someone still works)
// plus background activity (browser automation, running agent commands).
// Layer: Chat composer logic
// Exports: deriveComposerActivityStripRows, activityStripHeaderLabel and the row types

import { ThreadId, type ThreadBrowserState, type TurnId } from "@synara/contracts";
import { pluralize } from "@synara/shared/text";

import type { WorkLogEntry, WorkLogSubagent } from "../../session-logic";
import {
  formatSubagentModelLabel,
  humanizeSubagentStatus,
  normalizeSubagentStatusKind,
  resolveSubagentPresentation,
  type SubagentStatusKind,
} from "../../lib/subagentPresentation";

export interface ComposerActivityStripSubagentItem {
  kind: "subagent";
  key: string;
  threadId: ThreadId;
  // Task tool_use_id: the handle for per-run task control (background/stop).
  providerThreadId: string;
  primaryLabel: string;
  /** Canonical duck seed shared with the timeline rows and the subagent's own stream. */
  avatarSeed: string;
  fullLabel: string;
  role: string | null;
  modelLabel: string | undefined;
  statusLabel: string | undefined;
  statusKind: SubagentStatusKind | null;
  isActive: boolean;
  // True when this row is the thread currently open in the chat pane (viewing a
  // sibling from inside a subagent thread).
  isViewed: boolean;
  isBackground: boolean;
  accentColor: string;
}

// Leading "back to the main thread" row shown while a subagent thread is open.
export interface ComposerActivityStripParentItem {
  kind: "parent";
  key: string;
  threadId: ThreadId;
  label: string;
}

/** Background work that is not a subagent: browser automation and agent commands. */
export interface ComposerActivityStripBackgroundItem {
  kind: "activity";
  activityKind: "browser" | "command";
  key: string;
  label: string;
  /** Secondary hint next to the label (tab host, command detail). */
  secondary: string | undefined;
  statusKind: SubagentStatusKind;
  statusLabel: string;
  isActive: boolean;
}

export type ComposerActivityStripRow =
  | ComposerActivityStripSubagentItem
  | ComposerActivityStripParentItem
  | ComposerActivityStripBackgroundItem;

// The provider thread id is present on every snapshot of a subagent, unlike
// resolvedThreadId/agentId which can appear only once resolution catches up.
function subagentKey(subagent: WorkLogSubagent): string {
  return subagent.threadId;
}

// Later snapshots carry the freshest status, but may omit identity fields the spawn
// snapshot had; keep identity via fallback while taking the status fields verbatim.
function mergeSubagentSnapshots(previous: WorkLogSubagent, next: WorkLogSubagent): WorkLogSubagent {
  return {
    threadId: next.threadId ?? previous.threadId,
    providerThreadId: next.providerThreadId ?? previous.providerThreadId,
    resolvedThreadId: next.resolvedThreadId ?? previous.resolvedThreadId,
    agentId: next.agentId ?? previous.agentId,
    nickname: next.nickname ?? previous.nickname,
    role: next.role ?? previous.role,
    model: next.model ?? previous.model,
    effort: next.effort ?? previous.effort,
    background: next.background ?? previous.background,
    prompt: next.prompt ?? previous.prompt,
    title: next.title ?? previous.title,
    latestUpdate: next.latestUpdate ?? previous.latestUpdate,
    rawStatus: next.rawStatus,
    statusLabel: next.statusLabel,
    isActive: next.isActive,
  };
}

function toStripItem(
  key: string,
  subagent: WorkLogSubagent,
  backgroundedThreadIds: ReadonlySet<string>,
  viewedThreadId: ThreadId | null,
): ComposerActivityStripSubagentItem {
  const presentation = resolveSubagentPresentation({
    nickname: subagent.nickname,
    role: subagent.role,
    title: subagent.title,
    fallbackId: subagent.threadId,
  });
  const statusLabel =
    subagent.statusLabel ?? humanizeSubagentStatus(subagent.rawStatus, subagent.isActive);
  const statusKind = normalizeSubagentStatusKind(
    statusLabel ?? subagent.rawStatus,
    subagent.isActive,
  );
  const modelLabel = formatSubagentModelLabel(subagent.model);
  const threadId = ThreadId.makeUnsafe(subagent.resolvedThreadId ?? subagent.threadId);

  return {
    kind: "subagent",
    key,
    threadId,
    providerThreadId: subagent.providerThreadId ?? subagent.threadId,
    primaryLabel: presentation.nickname ?? presentation.primaryLabel,
    avatarSeed: presentation.avatarSeed,
    fullLabel: presentation.fullLabel,
    role: presentation.role,
    modelLabel:
      modelLabel && subagent.effort
        ? `${modelLabel} · ${subagent.effort}`
        : (modelLabel ?? subagent.effort),
    statusLabel,
    statusKind,
    isActive: statusKind === "running",
    isViewed: viewedThreadId !== null && threadId === viewedThreadId,
    // Confirmed patches key by the Task tool_use_id — the same handle the
    // background command dispatches with — which can differ from the row key.
    isBackground:
      subagent.background === true ||
      backgroundedThreadIds.has(subagent.providerThreadId ?? subagent.threadId),
    accentColor: presentation.accentColor,
  };
}

function collectStripItems(
  entries: ReadonlyArray<WorkLogEntry>,
  backgroundedThreadIds: ReadonlySet<string>,
  viewedThreadId: ThreadId | null,
): ComposerActivityStripSubagentItem[] {
  const subagentByKey = new Map<string, WorkLogSubagent>();
  for (const entry of entries) {
    for (const subagent of entry.subagents ?? []) {
      const key = subagentKey(subagent);
      const previous = subagentByKey.get(key);
      subagentByKey.set(key, previous ? mergeSubagentSnapshots(previous, subagent) : subagent);
    }
  }
  return [...subagentByKey.entries()].map(([key, subagent]) =>
    toStripItem(key, subagent, backgroundedThreadIds, viewedThreadId),
  );
}

// Rows the header stop-all control targets: running subagent rows only.
export function collectRunningSubagentStripItems(
  rows: ReadonlyArray<ComposerActivityStripRow>,
): ComposerActivityStripSubagentItem[] {
  return rows.filter(
    (row): row is ComposerActivityStripSubagentItem => row.kind === "subagent" && row.isActive,
  );
}

// Rows the per-row background action and Ctrl+B target: running rows not yet
// backgrounded by either the spawn hint or a confirmed task_updated patch.
export function collectForegroundRunningSubagentStripItems(
  rows: ReadonlyArray<ComposerActivityStripRow>,
): ComposerActivityStripSubagentItem[] {
  return collectRunningSubagentStripItems(rows).filter((row) => !row.isBackground);
}

const NO_BACKGROUNDED_THREAD_IDS: ReadonlySet<string> = new Set();

function withParentRow(
  items: ComposerActivityStripRow[],
  parentRow: { threadId: ThreadId; label: string | null } | null | undefined,
): ComposerActivityStripRow[] {
  if (items.length === 0 || !parentRow) {
    return items;
  }
  return [
    {
      kind: "parent",
      key: `parent:${parentRow.threadId}`,
      threadId: parentRow.threadId,
      label: parentRow.label ?? "Main thread",
    },
    ...items,
  ];
}

function collectSubagentRows(input: {
  workEntries: ReadonlyArray<WorkLogEntry>;
  liveTurnId: TurnId | null;
  backgroundedProviderThreadIds?: ReadonlySet<string>;
  viewedThreadId?: ThreadId | null;
}): ComposerActivityStripSubagentItem[] {
  const entriesWithSubagents = input.workEntries.filter(
    (entry) => (entry.subagents?.length ?? 0) > 0,
  );
  if (entriesWithSubagents.length === 0) {
    return [];
  }

  const backgroundedThreadIds = input.backgroundedProviderThreadIds ?? NO_BACKGROUNDED_THREAD_IDS;
  const viewedThreadId = input.viewedThreadId ?? null;
  const liveTurnEntries = input.liveTurnId
    ? entriesWithSubagents.filter((entry) => entry.turnId === input.liveTurnId)
    : [];
  if (liveTurnEntries.length > 0) {
    const liveTurnProviderThreadIds = new Set(
      collectStripItems(liveTurnEntries, backgroundedThreadIds, viewedThreadId).map(
        (item) => item.providerThreadId,
      ),
    );
    const visibleItems = collectStripItems(
      entriesWithSubagents,
      backgroundedThreadIds,
      viewedThreadId,
    ).filter(
      (item) =>
        liveTurnProviderThreadIds.has(item.providerThreadId) ||
        item.statusKind === "running" ||
        item.statusKind === "queued",
    );
    return visibleItems;
  }

  // No subagents spawned by the live turn: keep the latest known set visible only
  // while some subagent is still running or queued, then let the rows retire.
  const items = collectStripItems(entriesWithSubagents, backgroundedThreadIds, viewedThreadId);
  return items.some((item) => item.statusKind === "running" || item.statusKind === "queued")
    ? items
    : [];
}

// Why the reason drives the label: "attention-required" alone tells the user
// nothing about what to do; the reason is the whole actionable part.
const BROWSER_ATTENTION_LABELS: Record<
  NonNullable<NonNullable<ThreadBrowserState["automation"]>["reason"]>,
  string
> = {
  oauth: "Sign-in needed",
  download: "Approval needed",
  popup: "Popup blocked",
  error: "Failed",
};

function tabHost(browserState: ThreadBrowserState, tabId: string | null): string | undefined {
  const tab =
    browserState.tabs.find((candidate) => candidate.id === (tabId ?? browserState.activeTabId)) ??
    undefined;
  if (!tab?.url) {
    return undefined;
  }
  try {
    return new URL(tab.url).host || undefined;
  } catch {
    return undefined;
  }
}

function browserAutomationRow(
  browserState: ThreadBrowserState | undefined,
): ComposerActivityStripBackgroundItem | null {
  const automation = browserState?.automation;
  if (!browserState || !automation || automation.phase === "idle") {
    return null;
  }
  const needsAttention = automation.phase === "attention-required";
  return {
    kind: "activity",
    activityKind: "browser",
    key: `browser:${browserState.threadId}`,
    label: "Browser automation",
    secondary: tabHost(browserState, automation.tabId),
    statusKind: needsAttention ? "attention" : "running",
    statusLabel: needsAttention
      ? (BROWSER_ATTENTION_LABELS[automation.reason ?? "error"] ?? "Needs you")
      : "Running",
    isActive: true,
  };
}

// ponytail: a short foreground command can flash in the strip for a second or two.
// If that reads as noise, gate on liveActivity.startedAt age instead.
function runningCommandRows(
  workEntries: ReadonlyArray<WorkLogEntry>,
): ComposerActivityStripBackgroundItem[] {
  const rowsByKey = new Map<string, ComposerActivityStripBackgroundItem>();
  for (const entry of workEntries) {
    if (entry.itemType !== "command_execution" || entry.toolStatus !== "running") {
      continue;
    }
    const key = `command:${entry.toolCallId ?? entry.id}`;
    rowsByKey.set(key, {
      kind: "activity",
      activityKind: "command",
      key,
      label: entry.command ?? entry.toolTitle ?? entry.label,
      secondary: undefined,
      statusKind: "running",
      statusLabel: "Running",
      isActive: true,
    });
  }
  return [...rowsByKey.values()];
}

export function deriveComposerBackgroundActivityRows(input: {
  workEntries: ReadonlyArray<WorkLogEntry>;
  browserState?: ThreadBrowserState | undefined;
}): ComposerActivityStripBackgroundItem[] {
  const browserRow = browserAutomationRow(input.browserState);
  return [...(browserRow ? [browserRow] : []), ...runningCommandRows(input.workEntries)];
}

export function deriveComposerActivityStripRows(input: {
  workEntries: ReadonlyArray<WorkLogEntry>;
  liveTurnId: TurnId | null;
  // Task tool_use_ids the provider confirmed as backgrounded (task_updated patches).
  backgroundedProviderThreadIds?: ReadonlySet<string>;
  // The open thread when it is one of the subagents (marks its row as viewed).
  viewedThreadId?: ThreadId | null;
  // Present while a subagent thread is open: prepends a row back to the parent.
  parentRow?: { threadId: ThreadId; label: string | null } | null;
  // Desktop browser runtime state for this thread (background automation rows).
  browserState?: ThreadBrowserState | undefined;
}): ComposerActivityStripRow[] {
  const subagentRows = collectSubagentRows(input);
  const backgroundRows = deriveComposerBackgroundActivityRows(input);
  if (subagentRows.length === 0 && backgroundRows.length === 0) {
    return [];
  }
  // Attention first: it is the only row the user has to act on.
  return withParentRow(
    [
      ...backgroundRows.filter((row) => row.statusKind === "attention"),
      ...subagentRows,
      ...backgroundRows.filter((row) => row.statusKind !== "attention"),
    ],
    input.parentRow,
  );
}

// One counter for the whole strip, but the noun still names what is in it, so a
// subagents-only strip reads exactly as it did before background rows existed.
export function activityStripHeaderLabel(rows: ReadonlyArray<ComposerActivityStripRow>): string {
  const subagentCount = rows.filter((row) => row.kind === "subagent").length;
  const backgroundCount = rows.filter((row) => row.kind === "activity").length;
  const total = subagentCount + backgroundCount;
  const runningCount = rows.filter(
    (row) => (row.kind === "subagent" || row.kind === "activity") && row.isActive,
  ).length;

  if (backgroundCount === 0) {
    return runningCount > 0
      ? `${runningCount} of ${total} ${pluralize(total, "subagent")} running`
      : `${total} ${pluralize(total, "subagent")}`;
  }
  if (subagentCount === 0) {
    return `${total} background ${pluralize(total, "activity", "activities")}`;
  }
  return `${runningCount} of ${total} running`;
}
