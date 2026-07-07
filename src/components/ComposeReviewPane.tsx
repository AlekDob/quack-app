// Conductor-style agent edit review — inline diff tab with Undo / Keep.

import { useCallback, useEffect, useRef, useState } from "react";
import type { editor } from "monaco-editor";
import type { ToolCall } from "../ai";
import { basename } from "../pathUtils";
import { fs } from "../ipc";
import { useStore } from "../store";
import {
  composeOriginalContent,
  composeReviewCalls,
  parseComposeReviewKey,
} from "../composeReview";
import { dropSnapshot, lookupSnapshot } from "../composeSnapshots";
import { DiffView } from "./DiffView";
import { Icon } from "./Icon";
import { error as toastError, errMsg, success as toastSuccess } from "../notify";

interface Props {
  wsId: string;
  tabKey: string;
  visible: boolean;
}

export function ComposeReviewPane({ wsId, tabKey, visible }: Props) {
  const parsed = parseComposeReviewKey(tabKey);
  const diffRef = useRef<editor.IStandaloneDiffEditor | null>(null);
  const [modified, setModified] = useState<string | null>(null);
  const [hunkIdx, setHunkIdx] = useState(0);
  const [hunkTotal, setHunkTotal] = useState(0);
  const [reverted, setReverted] = useState(false);

  const path = parsed?.path ?? "";
  const calls = composeReviewCalls(tabKey);
  const original = parsed
    ? composeOriginalContent(
        parsed.wsId,
        parsed.chatId,
        parsed.msgIndex,
        path,
        calls,
      )
    : "";

  const syncHunks = useCallback(() => {
    const ed = diffRef.current;
    if (!ed) return;
    const changes = ed.getLineChanges() ?? [];
    setHunkTotal(changes.length);
    setHunkIdx((i) =>
      changes.length === 0 ? 0 : Math.min(i, changes.length - 1),
    );
  }, []);

  useEffect(() => {
    if (!parsed || !visible) return;
    let alive = true;
    void fs.readFile(path).then(
      (text) => {
        if (alive) setModified(text);
      },
      () => {
        if (alive) setModified("");
      },
    );
    return () => {
      alive = false;
    };
  }, [parsed, path, visible]);

  const closeTab = useCallback(() => {
    useStore.getState().closeTab(wsId, tabKey);
  }, [wsId, tabKey]);

  const onKeep = useCallback(() => {
    closeTab();
    toastSuccess(`Kept changes in ${basename(path)}`);
  }, [closeTab, path]);

  const onUndo = useCallback(async () => {
    if (!parsed || reverted) return;
    const snap = lookupSnapshot(parsed.wsId, parsed.chatId, parsed.msgIndex);
    const before = snap?.files.get(path);
    try {
      const restore = before !== undefined ? before : (original ?? "");
      await fs.writeFile(path, restore);
      useStore.getState().updateFileContents(wsId, path, restore);
      setReverted(true);
      setModified(restore);
      dropSnapshot(parsed.wsId, parsed.chatId, parsed.msgIndex);
      toastSuccess(`Reverted ${basename(path)}`);
      closeTab();
    } catch (e) {
      toastError(`Revert failed: ${errMsg(e)}`);
    }
  }, [parsed, reverted, path, original, wsId, closeTab]);

  useEffect(() => {
    if (!visible) return;
    requestAnimationFrame(() => diffRef.current?.layout());
  }, [visible, modified]);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (!e.metaKey && !e.ctrlKey) return;
      if (e.key === "y") {
        e.preventDefault();
        onKeep();
      } else if (e.key === "n") {
        e.preventDefault();
        void onUndo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, onKeep, onUndo]);

  const goHunk = (dir: "next" | "previous") => {
    diffRef.current?.goToDiff(dir);
    setHunkIdx((i) => {
      const max = Math.max(0, hunkTotal - 1);
      if (dir === "next") return Math.min(i + 1, max);
      return Math.max(i - 1, 0);
    });
  };

  if (!parsed || modified === null) return null;

  const name = basename(path);
  const hasHunks = hunkTotal > 0;

  return (
    <div
      className="compose-review-host"
      style={{ display: visible ? "flex" : "none" }}
    >
      <div className="compose-review-head">
        <Icon name="git-compare" size={14} />
        <span className="compose-review-title">{name}</span>
        <span className="compose-review-ref">before → after</span>
        <button
          type="button"
          className="compose-review-close"
          onClick={closeTab}
          title="Close review"
          aria-label="Close review"
        >
          <Icon name="x" size={14} />
        </button>
      </div>
      <div className="compose-review-body">
        <DiffView
          originalContent={original}
          modifiedContent={modified}
          path={path}
          sideBySide={false}
          onDiffMount={(ed) => {
            diffRef.current = ed;
            ed.onDidUpdateDiff(() => syncHunks());
            syncHunks();
            ed.revealFirstDiff();
          }}
        />
      </div>
      <div className="compose-review-dock">
        <div className="compose-review-nav">
          <button
            type="button"
            className="compose-review-nav-btn"
            disabled={!hasHunks}
            onClick={() => goHunk("previous")}
            title="Previous change"
          >
            <Icon name="chevron-up" size={12} />
          </button>
          <span className="compose-review-nav-label">
            {hasHunks
              ? `${hunkIdx + 1} of ${hunkTotal}`
              : reverted
                ? "Reverted"
                : "No diff"}
          </span>
          <button
            type="button"
            className="compose-review-nav-btn"
            disabled={!hasHunks}
            onClick={() => goHunk("next")}
            title="Next change"
          >
            <Icon name="chevron-down" size={12} />
          </button>
        </div>
        <div className="compose-review-actions">
          <button
            type="button"
            className="compose-review-undo"
            disabled={reverted}
            onClick={() => void onUndo()}
            title="Revert this file to pre-turn state (⌘N)"
          >
            Undo
            <kbd>⌘N</kbd>
          </button>
          <button
            type="button"
            className="compose-review-keep"
            onClick={onKeep}
            title="Accept and close review (⌘Y)"
          >
            Keep
            <kbd>⌘Y</kbd>
          </button>
        </div>
      </div>
    </div>
  );
}

export function openComposeReviewTab(
  wsId: string,
  chatId: string | undefined,
  msgIndex: number,
  path: string,
  calls: ToolCall[],
): void {
  useStore.getState().openComposeReview(wsId, chatId, msgIndex, path, calls);
}
