// Changed-files recap — Cursor-style panel at the end of a turn (≥1 edit).
// Neutral chrome: one bar (count + Undo / Keep / Review), expandable file list.

import { useMemo, useState } from "react";
import type { ToolCall } from "../ai";
import { useAgentMode } from "../agentMode";
import { fileIconName } from "../fileIcons";
import {
  diffStats,
  extractEditDiffs,
  pathOf,
} from "./chatToolRender";
import { dropSnapshot, lookupSnapshot } from "../composeSnapshots";
import { confirm as dialogConfirm } from "../dialog";
import { fs } from "../ipc";
import {
  error as toastError,
  errMsg,
  success as toastSuccess,
} from "../notify";
import { useStore } from "../store";
import { openComposeReviewTab } from "./ComposeReviewPane";
import { Icon } from "./Icon";
import { isHtmlPath } from "../htmlPreview";
import { openPathSmart } from "../smartFileOpen";

function basename(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

function composeFileStats(fileCalls: ToolCall[]) {
  return fileCalls.reduce(
    (acc, c) => {
      const d = extractEditDiffs(c);
      if (!d) return acc;
      const s = diffStats(d);
      return { added: acc.added + s.added, removed: acc.removed + s.removed };
    },
    { added: 0, removed: 0 },
  );
}

function ComposeUndoButton({
  wsId,
  chatId,
  msgIndex,
  touchedPaths,
}: {
  wsId: string;
  chatId: string | undefined;
  msgIndex: number;
  touchedPaths: string[];
}) {
  const [reverted, setReverted] = useState(false);
  const snap = lookupSnapshot(wsId, chatId, msgIndex);
  const restorable = snap
    ? touchedPaths.filter((p) => snap.files.has(p))
    : [];
  const eligible = restorable.length;
  const canUndo = !reverted && eligible > 0;

  const onClick = async () => {
    if (!snap || eligible === 0) return;
    const ok = await dialogConfirm(
      `Revert ${eligible} file${eligible === 1 ? "" : "s"} back to the pre-turn state? Local edits made AFTER the agent's turn will also be discarded.`,
      {
        title: "Undo all changes",
        okLabel: "Undo all",
        cancelLabel: "Cancel",
        danger: true,
      },
    );
    if (!ok) return;
    let okCount = 0;
    const failures: string[] = [];
    for (const path of restorable) {
      try {
        const before = snap.files.get(path);
        if (before === undefined) continue;
        await fs.writeFile(path, before);
        useStore.setState((s) => {
          const w = s.loaded[wsId];
          if (!w?.files[path]) return s;
          return {
            loaded: {
              ...s.loaded,
              [wsId]: {
                ...w,
                files: {
                  ...w.files,
                  [path]: { contents: before, original: before },
                },
              },
            },
          };
        });
        okCount++;
      } catch (e) {
        failures.push(
          `${path.split(/[\\/]/).pop()}: ${errMsg(e)}`,
        );
      }
    }
    setReverted(true);
    dropSnapshot(wsId, chatId, msgIndex);
    if (failures.length === 0) {
      toastSuccess(`Reverted ${okCount} file${okCount === 1 ? "" : "s"}`);
    } else {
      toastError(
        `Reverted ${okCount}/${restorable.length}; ${failures.length} failed (see console)`,
      );
      console.warn("Compose revert failures:", failures);
    }
  };

  if (reverted) {
    return (
      <span className="ai-compose-undone" title="Files restored to pre-turn state">
        Undone
      </span>
    );
  }
  return (
    <button
      type="button"
      className="ai-compose-ghost"
      disabled={!canUndo}
      onClick={() => void onClick()}
      title={
        canUndo
          ? `Roll ${eligible} file${eligible === 1 ? "" : "s"} back to pre-turn state`
          : snap
            ? "No restorable files in the pre-turn snapshot"
            : "No pre-turn snapshot available"
      }
    >
      Undo All
    </button>
  );
}

export function ComposeCard({
  wsId,
  chatId,
  msgIndex,
  calls,
  streaming = false,
}: {
  wsId: string;
  chatId: string | undefined;
  msgIndex: number;
  calls: ToolCall[];
  /** True while the turn is still in flight — list grows live. */
  streaming?: boolean;
}) {
  const agentMode = useAgentMode();
  const [collapsed, setCollapsed] = useState(true);
  const { byPath, totals } = useMemo(() => {
    const m = new Map<string, ToolCall[]>();
    for (const c of calls) {
      const p = pathOf(c);
      const arr = m.get(p);
      if (arr) arr.push(c);
      else m.set(p, [c]);
    }
    const entries = Array.from(m.entries()).map(([path, fileCalls]) => ({
      path,
      fileCalls,
      stats: composeFileStats(fileCalls),
    }));
    const totals = entries.reduce(
      (acc, e) => ({
        added: acc.added + e.stats.added,
        removed: acc.removed + e.stats.removed,
      }),
      { added: 0, removed: 0 },
    );
    return { byPath: entries, totals };
  }, [calls]);

  const openReview = (path: string) => {
    openComposeReviewTab(wsId, chatId, msgIndex, path, calls);
  };

  const openRow = (path: string) => {
    if (isHtmlPath(path)) {
      void openPathSmart(path, { wsId });
      return;
    }
    openReview(path);
  };

  const openAll = () => {
    if (byPath.length === 0) return;
    // Agent Mode: one DiffModal — expand list + open first file.
    if (agentMode) {
      if (byPath.length > 1) setCollapsed(false);
      openReview(byPath[0].path);
      return;
    }
    for (const { path } of byPath) openReview(path);
  };

  const n = byPath.length;
  const label = streaming
    ? `${n} File${n === 1 ? "" : "s"} · editing…`
    : `${n} File${n === 1 ? "" : "s"}`;
  const showRecap = totals.added > 0 || totals.removed > 0;

  return (
    <div
      className={`ai-compose-cursor${collapsed ? "" : " is-open"}${streaming ? " is-streaming" : ""}`}
    >
      <div className="ai-compose-bar">
        <div className="ai-compose-bar-main">
          <button
            type="button"
            className="ai-compose-bar-left"
            onClick={() => setCollapsed((c) => !c)}
            aria-expanded={!collapsed}
            title={collapsed ? "Show changed files" : "Collapse"}
          >
            {streaming ? (
              <span className="ai-spinner ai-spinner-sm" aria-hidden="true" />
            ) : (
              <Icon
                name={collapsed ? "chevron-right" : "chevron-down"}
                size={14}
              />
            )}
            <span>{label}</span>
          </button>
          {showRecap && (
            <span
              className="ai-compose-bar-recap"
              aria-label={`${totals.added} lines added, ${totals.removed} lines removed`}
            >
              {totals.added > 0 && (
                <span className="ai-compose-add">+{totals.added}</span>
              )}
              {totals.removed > 0 && (
                <span className="ai-compose-rem">−{totals.removed}</span>
              )}
            </span>
          )}
        </div>
        <div className="ai-compose-bar-actions">
          {!streaming && (
            <ComposeUndoButton
              wsId={wsId}
              chatId={chatId}
              msgIndex={msgIndex}
              touchedPaths={byPath.map(({ path }) => path)}
            />
          )}
          {!streaming && (
            <button
              type="button"
              className="ai-compose-ghost"
              onClick={() => setCollapsed(true)}
              title="Collapse — changes are already saved"
            >
              Keep All
            </button>
          )}
          <button
            type="button"
            className="ai-compose-review"
            onClick={() => void openAll()}
            title={
              agentMode
                ? "Open the first file in a diff modal"
                : "Open every modified file in diff review tabs"
            }
          >
            Review
          </button>
        </div>
      </div>
      {!collapsed && (
        <ul className="ai-compose-list">
          {byPath.map(({ path, stats }) => {
            const name = basename(path);
            return (
              <li key={path}>
                <button
                  type="button"
                  className="ai-compose-row"
                  onClick={() => openRow(path)}
                  title={isHtmlPath(path) ? `Open ${name} in preview` : path}
                >
                  <span className="ai-compose-row-icon" aria-hidden>
                    <Icon name={fileIconName(name)} size={14} />
                  </span>
                  <span className="ai-compose-row-name">{name}</span>
                  <span className="ai-compose-row-stats">
                    <span className="ai-compose-add">+{stats.added}</span>
                    <span className="ai-compose-rem">−{stats.removed}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
