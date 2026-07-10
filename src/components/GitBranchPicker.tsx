import { useCallback, useEffect, useRef, useState } from "react";
import { git as gitApi } from "../ipc";
import { ComposerCtxMenu } from "../composerCtxMenu";
import {
  forceGitStatusRefresh,
  getGitStatus,
  startGitStatusWatch,
  subscribeGitStatus,
} from "../gitStatusStore";
import { confirm as dialogConfirm, prompt as dialogPrompt } from "../dialog";
import { error as toastError, errMsg, success as toastSuccess } from "../notify";
import { Icon } from "./Icon";

interface GitBranchPickerProps {
  wsId: string;
  root: string;
  variant?: "panel" | "composer";
}

export function GitBranchPicker({
  wsId,
  root,
  variant = "panel",
}: GitBranchPickerProps) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [branches, setBranches] = useState<string[]>([]);
  const [status, setStatus] = useState(getGitStatus(wsId).status);

  useEffect(() => {
    const apply = () => setStatus(getGitStatus(wsId).status);
    const stop = startGitStatusWatch(wsId, root);
    const unsub = subscribeGitStatus(wsId, apply);
    apply();
    return () => {
      unsub();
      stop();
    };
  }, [wsId, root]);

  const loadBranches = useCallback(async () => {
    try {
      setBranches(await gitApi.branches(root));
    } catch {
      setBranches([]);
    }
  }, [root]);

  useEffect(() => {
    void loadBranches();
  }, [loadBranches, status?.branch]);

  const refresh = useCallback(async () => {
    await forceGitStatusRefresh(wsId);
  }, [wsId]);

  const switchBranch = useCallback(
    async (b: string) => {
      setOpen(false);
      try {
        await gitApi.checkoutBranch(root, b);
        toastSuccess(`Switched to ${b}`);
        await refresh();
      } catch (e) {
        toastError(`Checkout failed: ${errMsg(e)}`);
      }
    },
    [root, refresh],
  );

  const createBranch = useCallback(async () => {
    setOpen(false);
    const name = await dialogPrompt(
      `Create branch from ${status?.branch ?? "HEAD"}`,
      "",
      { title: "New branch", okLabel: "Create" },
    );
    if (!name?.trim()) return;
    try {
      await gitApi.createBranch(root, name.trim(), undefined, true);
      toastSuccess(`Created branch ${name.trim()} and switched to it`);
      await refresh();
      await loadBranches();
    } catch (e) {
      toastError(`Create branch failed: ${errMsg(e)}`);
    }
  }, [root, status?.branch, refresh, loadBranches]);

  const deleteBranch = useCallback(
    async (b: string) => {
      const ok = await dialogConfirm(
        `Delete branch ${b}?\n\nIf the branch has commits not merged into HEAD, you'll be asked to confirm a force-delete next.`,
        { title: "Delete branch", okLabel: "Delete", danger: true },
      );
      if (!ok) return;
      try {
        await gitApi.deleteBranch(root, b, false);
        toastSuccess(`Deleted ${b}`);
      } catch (e) {
        const msg = errMsg(e);
        if (!/not fully merged|not merged/i.test(msg)) {
          toastError(`Delete failed: ${msg}`);
          return;
        }
        const force = await dialogConfirm(
          `${b} has unmerged commits. Force-delete it anyway?`,
          { title: "Force-delete branch", okLabel: "Force delete", danger: true },
        );
        if (!force) return;
        try {
          await gitApi.deleteBranch(root, b, true);
          toastSuccess(`Force-deleted ${b}`);
        } catch (e2) {
          toastError(`Force-delete failed: ${errMsg(e2)}`);
          return;
        }
      }
      await loadBranches();
    },
    [root, loadBranches],
  );

  if (!status?.is_repo) {
    if (variant === "composer") return null;
    return (
      <span className="git-branch git-branch--disabled" title="Not a git repository">
        <Icon name="git-branch" size={12} />
        <span className="git-branch-name">No git repo</span>
      </span>
    );
  }

  const branchLabel = status.branch ?? "(detached)";
  const title = status.upstream
    ? `Tracking ${status.upstream} — click to switch branch`
    : "No upstream — click to switch branch";

  const branchMenuBody = (
    <>
      {branches.length === 0 && (
        <div className="menu-section-title" style={{ padding: 8 }}>
          No branches
        </div>
      )}
      {branches.map((b) => (
        <div key={b} className="git-branch-menu-row">
          <button
            type="button"
            className={`menu-item ${b === status?.branch ? "active" : ""}`}
            onClick={() => void switchBranch(b)}
          >
            <span className="menu-item-label">{b}</span>
            {b === status?.branch && (
              <span className="menu-item-accel">current</span>
            )}
          </button>
          {b !== status?.branch && (
            <button
              type="button"
              className="git-branch-menu-delete"
              onClick={(e) => {
                e.stopPropagation();
                void deleteBranch(b);
              }}
              title={`Delete branch ${b}`}
              aria-label={`Delete branch ${b}`}
            >
              <Icon name="x" size={11} />
            </button>
          )}
        </div>
      ))}
      <div className="menu-separator" role="separator" />
      <button
        type="button"
        className="menu-item git-branch-new"
        onClick={() => void createBranch()}
        role="menuitem"
      >
        <span className="menu-item-label">
          <Icon name="plus" size={11} /> New branch…
        </span>
      </button>
    </>
  );

  const panelMenu = open ? (
    <>
      <div className="menu-overlay" onMouseDown={() => setOpen(false)} />
      <div className="git-branch-menu" role="menu">
        {branchMenuBody}
      </div>
    </>
  ) : null;

  if (variant === "composer") {
    return (
      <div className="ai-composer-ctx-seg-wrap">
        <button
          ref={btnRef}
          type="button"
          className="ai-composer-ctx-seg"
          title={title}
          onClick={() => setOpen((v) => !v)}
        >
          <Icon name="git-branch" size={11} />
          <span className="ai-composer-ctx-label">{branchLabel}</span>
          {status.ahead > 0 ? (
            <span className="git-ahead">↑{status.ahead}</span>
          ) : null}
          {status.behind > 0 ? (
            <span className="git-behind">↓{status.behind}</span>
          ) : null}
          <Icon name="chevron-down" size={10} className="ai-composer-ctx-caret" />
        </button>
        <ComposerCtxMenu
          open={open}
          onClose={() => setOpen(false)}
          anchorRef={btnRef}
          estimateHeight={branches.length * 32 + 48}
        >
          {branchMenuBody}
        </ComposerCtxMenu>
      </div>
    );
  }

  return (
    <div className="git-branch-row">
      <button
        type="button"
        className="git-branch"
        title={title}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name="git-branch" size={12} />
        <span className="git-branch-name">{branchLabel}</span>
        {status.ahead > 0 ? <span className="git-ahead"> ↑{status.ahead}</span> : null}
        {status.behind > 0 ? (
          <span className="git-behind"> ↓{status.behind}</span>
        ) : null}
        <Icon name="chevron-down" size={12} className="git-branch-caret" />
      </button>
      {panelMenu}
    </div>
  );
}
