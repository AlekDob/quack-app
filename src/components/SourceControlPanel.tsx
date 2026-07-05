import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  fs,
  git as gitApi,
  type GitCommit,
  type GitFile,
  type GitStash,
  type GitStatus,
} from "../ipc";
import { requestDiff } from "../editorState";
import { error as toastError, errMsg, success as toastSuccess } from "../notify";
import {
  confirm as dialogConfirm,
  prompt as dialogPrompt,
} from "../dialog";
import { langOf } from "../langDetect";
import { joinPath } from "../pathUtils";
import { useStore } from "../store";
import { useModalFocus } from "../useModalFocus";
import {
  forceGitStatusRefresh,
  getGitStatus,
  startGitStatusWatch,
  statusClass,
  statusLabel,
  subscribeGitStatus,
} from "../gitStatusStore";
import { ContextMenu, type ContextMenuItem } from "./ContextMenu";
import { FileHistoryModal } from "./FileHistoryModal";
import { Icon } from "./Icon";
import {
  GitAccordionSection,
  pickDefaultGitSection,
  type GitSectionId,
} from "./gitAccordion";

function authorInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatRelative(unixSec: number): string {
  const now = Date.now() / 1000;
  const ago = now - unixSec;
  if (ago < 60) return "just now";
  if (ago < 3600) return `${Math.floor(ago / 60)}m ago`;
  if (ago < 86400) return `${Math.floor(ago / 3600)}h ago`;
  if (ago < 86400 * 7) return `${Math.floor(ago / 86400)}d ago`;
  if (ago < 86400 * 30) return `${Math.floor(ago / (86400 * 7))}w ago`;
  return new Date(unixSec * 1000).toLocaleDateString();
}

interface Props {
  wsId: string;
  root: string;
  /** Agent-mode context column: one git section open at a time. */
  compact?: boolean;
}

// statusLabel / statusColor moved to gitStatusStore.ts so the file
// tree paints the same palette — imported above.

export function SourceControlPanel({ wsId, root, compact = false }: Props) {
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [log, setLog] = useState<string>("");
  const [ctx, setCtx] = useState<{ x: number; y: number; file: GitFile } | null>(
    null,
  );
  const [branches, setBranches] = useState<string[]>([]);
  const [branchOpen, setBranchOpen] = useState(false);
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [openCommit, setOpenCommit] = useState<GitCommit | null>(null);
  const [commitDiff, setCommitDiff] = useState<string>("");
  const [commitDiffLoading, setCommitDiffLoading] = useState(false);
  const [stashes, setStashes] = useState<GitStash[]>([]);
  const [stashesOpen, setStashesOpen] = useState(false);
  const [openSection, setOpenSection] = useState<GitSectionId | null>("changes");
  const [historyFile, setHistoryFile] = useState<string | null>(null);
  const defaultSectionPicked = useRef(false);
  const commitCardRef = useRef<HTMLDivElement | null>(null);
  useModalFocus(commitCardRef, !!openCommit);

  useEffect(() => {
    defaultSectionPicked.current = false;
  }, [wsId]);

  // Status comes from the shared gitStatusStore (one `git status` per
  // fs-event debounce window feeds this panel, the file tree's badges,
  // and the activity-bar count). refresh() forces an immediate fetch —
  // used by the Refresh button and after explicit git mutations so the
  // UI reflects the command it just ran, not the watcher's echo.
  useEffect(() => {
    const apply = () => {
      const snap = getGitStatus(wsId);
      if (snap.status) setStatus(snap.status);
      if (snap.error) {
        setStatus({
          is_repo: false,
          branch: null,
          upstream: null,
          ahead: 0,
          behind: 0,
          files: [],
        });
        setLog(snap.error);
      }
    };
    const stop = startGitStatusWatch(wsId, root);
    const unsub = subscribeGitStatus(wsId, apply);
    apply();
    return () => {
      unsub();
      stop();
    };
  }, [wsId, root]);

  useEffect(() => {
    if (!compact || !status?.is_repo || defaultSectionPicked.current) return;
    const files = status.files;
    const conflictN = files.filter((f) => f.conflicted).length;
    const stagedN = files.filter((f) => f.staged).length;
    const changeN = files.filter((f) => !f.staged && !f.conflicted).length;
    defaultSectionPicked.current = true;
    setOpenSection(pickDefaultGitSection(conflictN, stagedN, changeN));
  }, [compact, status]);

  const refresh = useCallback(async () => {
    await forceGitStatusRefresh(wsId);
  }, [wsId]);

  const run = useCallback(
    async (
      label: string,
      cmd: string,
      args: Record<string, unknown>,
    ): Promise<boolean> => {
      setBusy(label);
      setLog("");
      try {
        const out = await invoke<string>(cmd, args);
        setLog(out);
        await refresh();
        return true;
      } catch (e) {
        setLog(errMsg(e));
        return false;
      } finally {
        setBusy(null);
      }
    },
    [refresh],
  );

  const stage = (path: string) =>
    run("Staging", "git_stage", { path: root, files: [path] });
  const unstage = (path: string) =>
    run("Unstaging", "git_unstage", { path: root, files: [path] });
  const stageAll = () =>
    run("Staging all", "git_stage", {
      path: root,
      files: status?.files.map((f) => f.path) ?? [],
    });
  const commit = async () => {
    if (!message.trim()) return;
    const ok = await run("Committing", "git_commit", { path: root, message });
    // Only clear on success — a failed hook / config error used to wipe
    // the carefully-typed message along with the error.
    if (ok) setMessage("");
    else toastError("Commit failed — see the log below. Your message is preserved.");
  };
  const pull = () => run("Pulling", "git_pull", { path: root });
  const fetch_ = () => run("Fetching", "git_fetch", { path: root });
  // Push with a working "Publish" path for branches with no upstream.
  // A bare `git push` on a fresh branch fails with a raw fatal that
  // used to land unexplained in the log pane — the panel's own "New
  // branch…" flow led straight into that dead end.
  const push = useCallback(async () => {
    if (busy) return;
    const publish = async () => {
      const ok = await dialogConfirm(
        `${status?.branch ?? "This branch"} has no upstream yet. Publish it to origin?`,
        { title: "Publish branch", okLabel: "Publish", cancelLabel: "Cancel" },
      );
      if (!ok) return;
      setBusy("Publishing");
      try {
        setLog(await gitApi.push(root, true));
        toastSuccess(`Published ${status?.branch ?? "branch"} to origin`);
      } catch (e) {
        setLog(errMsg(e));
      } finally {
        setBusy(null);
        await refresh();
      }
    };
    if (status && !status.upstream) {
      await publish();
      return;
    }
    setBusy("Pushing");
    setLog("");
    try {
      setLog(await gitApi.push(root));
    } catch (e) {
      const msg = errMsg(e);
      setLog(msg);
      if (/no upstream branch/i.test(msg)) {
        setBusy(null);
        await publish();
        return;
      }
    } finally {
      setBusy(null);
      await refresh();
    }
  }, [busy, root, status, refresh]);
  // VS Code-style sync: pull then push so a single click reconciles both
  // sides of the upstream relationship. We bail on pull failure so a
  // merge conflict isn't immediately followed by a push attempt.
  const sync = useCallback(async () => {
    if (busy) return;
    setBusy("Syncing");
    setLog("");
    try {
      const pullOut = await invoke<string>("git_pull", { path: root });
      const pushOut = await invoke<string>("git_push", { path: root });
      setLog(`${pullOut}\n${pushOut}`.trim());
    } catch (e) {
      setLog(errMsg(e));
    } finally {
      setBusy(null);
      await refresh();
    }
  }, [busy, root, refresh]);

  const showDiff = useCallback(
    async (f: GitFile, staged: boolean) => {
      const abs = joinPath(root, f.path);
      try {
        const original = await gitApi.show(root, "HEAD", f.path);
        // Empty refspec → git_show builds ":path", the stage-0 index
        // entry. (":" as the refspec produced "::path", which git
        // rejects as an ambiguous argument — staged diffs were broken.)
        const modified = staged
          ? await gitApi.show(root, "", f.path)
          : await fs.readFile(abs);
        requestDiff({
          path: f.path,
          refspec: staged ? "HEAD vs index" : "HEAD vs working tree",
          originalContent: original,
          modifiedContent: modified,
          language: langOf(f.path),
        });
      } catch (e) {
        toastError(`Diff failed: ${errMsg(e)}`);
      }
    },
    [root],
  );

  const loadBranches = useCallback(async () => {
    try {
      const list = await gitApi.branches(root);
      setBranches(list);
    } catch {
      setBranches([]);
    }
  }, [root]);

  useEffect(() => {
    void loadBranches();
  }, [loadBranches, status?.branch]);

  // Load recent commits whenever the History section is expanded OR
  // any local-state change suggests history may have moved (commit /
  // pull / branch switch). Status.branch is in the deps because
  // switching branches changes which commits we list.
  const loadHistory = useCallback(async () => {
    if (!status?.is_repo) return;
    try {
      const list = await gitApi.log(root, 50);
      setCommits(list);
    } catch (e) {
      setCommits([]);
      console.warn("[git_log]", errMsg(e));
    }
  }, [root, status?.is_repo]);

  useEffect(() => {
    const visible = compact ? openSection === "history" : historyOpen;
    if (!visible) return;
    void loadHistory();
  }, [
    compact,
    openSection,
    historyOpen,
    loadHistory,
    status?.branch,
    status?.ahead,
    status?.behind,
  ]);

  const openCommitDetail = useCallback(
    async (c: GitCommit) => {
      setOpenCommit(c);
      setCommitDiff("");
      setCommitDiffLoading(true);
      try {
        const out = await gitApi.showCommit(root, c.full_hash);
        setCommitDiff(out);
      } catch (e) {
        setCommitDiff(`Failed to load diff: ${errMsg(e)}`);
      } finally {
        setCommitDiffLoading(false);
      }
    },
    [root],
  );

  // Esc closes the commit modal. Scoped to when it's actually open.
  useEffect(() => {
    if (!openCommit) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpenCommit(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openCommit]);

  // Stashes — same lazy-load pattern as History. Refreshes on
  // status mutations so newly-pushed / popped / dropped stashes
  // appear/disappear without a manual rescan.
  const loadStashes = useCallback(async () => {
    if (!status?.is_repo) return;
    try {
      const list = await gitApi.stashList(root);
      setStashes(list);
    } catch (e) {
      setStashes([]);
      console.warn("[git_stash_list]", errMsg(e));
    }
  }, [root, status?.is_repo]);

  useEffect(() => {
    const visible = compact ? openSection === "stashes" : stashesOpen;
    if (!visible) return;
    void loadStashes();
  }, [compact, openSection, stashesOpen, loadStashes, status?.files.length]);

  const stashPush = useCallback(async () => {
    const msg = await dialogPrompt(
      "Stash message (optional)",
      "",
      { title: "Stash changes", okLabel: "Stash" },
    );
    if (msg === null) return;
    try {
      const out = await gitApi.stashPush(root, msg.trim() || undefined, true);
      const trimmedOut = out.trim();
      toastSuccess(trimmedOut || "Stashed");
      await refresh();
      await loadStashes();
    } catch (e) {
      toastError(`Stash failed: ${errMsg(e)}`);
    }
  }, [root, refresh, loadStashes]);

  const stashPop = useCallback(
    async (s: GitStash) => {
      try {
        await gitApi.stashPop(root, s.ref_spec);
        toastSuccess(`Popped ${s.ref_spec}`);
        await refresh();
        await loadStashes();
      } catch (e) {
        toastError(`Pop failed: ${errMsg(e)}`);
      }
    },
    [root, refresh, loadStashes],
  );

  const stashApply = useCallback(
    async (s: GitStash) => {
      try {
        await gitApi.stashApply(root, s.ref_spec);
        toastSuccess(`Applied ${s.ref_spec} (still in stash list)`);
        await refresh();
      } catch (e) {
        toastError(`Apply failed: ${errMsg(e)}`);
      }
    },
    [root, refresh],
  );

  const stashDrop = useCallback(
    async (s: GitStash) => {
      const ok = await dialogConfirm(
        `Drop ${s.ref_spec}?\n\n"${s.message}"\n\nThe stashed changes are unrecoverable after this.`,
        {
          title: "Drop stash",
          okLabel: "Drop",
          cancelLabel: "Cancel",
          danger: true,
        },
      );
      if (!ok) return;
      try {
        await gitApi.stashDrop(root, s.ref_spec);
        toastSuccess(`Dropped ${s.ref_spec}`);
        await loadStashes();
      } catch (e) {
        toastError(`Drop failed: ${errMsg(e)}`);
      }
    },
    [root, loadStashes],
  );

  const switchBranch = useCallback(
    async (b: string) => {
      setBranchOpen(false);
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
    setBranchOpen(false);
    const name = await dialogPrompt(
      "Create branch from " + (status?.branch ?? "HEAD"),
      "",
      { title: "New branch", okLabel: "Create" },
    );
    if (!name || !name.trim()) return;
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
        {
          title: "Delete branch",
          okLabel: "Delete",
          cancelLabel: "Cancel",
          danger: true,
        },
      );
      if (!ok) return;
      try {
        await gitApi.deleteBranch(root, b, false);
        toastSuccess(`Deleted ${b}`);
      } catch (e) {
        const msg = errMsg(e);
        // git -d refuses if the branch has unmerged commits. Offer a
        // force delete instead of just surfacing the error.
        if (/not fully merged|not merged/i.test(msg)) {
          const force = await dialogConfirm(
            `${b} has unmerged commits. Force-delete it anyway?\n\nThe commits will be unreachable until the next gc.`,
            {
              title: "Force-delete branch",
              okLabel: "Force delete",
              cancelLabel: "Cancel",
              danger: true,
            },
          );
          if (!force) return;
          try {
            await gitApi.deleteBranch(root, b, true);
            toastSuccess(`Force-deleted ${b}`);
          } catch (e2) {
            toastError(`Force-delete failed: ${errMsg(e2)}`);
            return;
          }
        } else {
          toastError(`Delete failed: ${msg}`);
          return;
        }
      }
      await loadBranches();
    },
    [root, loadBranches],
  );

  const discard = useCallback(
    async (f: GitFile) => {
      // Untracked files can't be `checkout HEAD --`-ed (git has no
      // version to restore); the honest action is deleting the file,
      // so say that and route through git clean.
      const untracked = f.index_status === "?";
      const ok = await dialogConfirm(
        untracked
          ? `Delete untracked file ${f.path}?\n\nThis cannot be undone.`
          : `Discard changes to ${f.path}?\n\nThis cannot be undone.`,
        {
          title: untracked ? "Delete untracked file" : "Discard changes",
          okLabel: untracked ? "Delete" : "Discard",
          cancelLabel: "Keep",
          danger: true,
        },
      );
      if (!ok) return;
      try {
        if (untracked) {
          await gitApi.clean(root, [f.path]);
          toastSuccess(`Deleted ${f.path}`);
        } else {
          await gitApi.discard(root, [f.path]);
          toastSuccess(`Discarded changes to ${f.path}`);
        }
        await refresh();
      } catch (e) {
        toastError(
          `${untracked ? "Delete" : "Discard"} failed: ${errMsg(e)}`,
        );
      }
    },
    [root, refresh],
  );

  // Conflicted rows open the file in the editor (where the conflict
  // markers live) — a HEAD-vs-index diff is meaningless mid-merge.
  const openConflict = async (f: GitFile) => {
    await useStore.getState().openFile(wsId, joinPath(root, f.path));
  };

  const resolveConflict = async (f: GitFile, side: "ours" | "theirs") => {
    const label = side === "ours" ? "our version" : "their version";
    const ok = await dialogConfirm(
      `Resolve ${f.path} by taking ${label} wholesale?\n\nThe other side's changes to this file are discarded.`,
      { title: "Resolve conflict", okLabel: "Resolve", danger: true },
    );
    if (!ok) return;
    try {
      await gitApi.resolveConflict(root, f.path, side);
      toastSuccess(`Resolved ${f.path} (${label})`);
      await refresh();
    } catch (e) {
      toastError(`Resolve failed: ${errMsg(e)}`);
    }
  };

  if (!status) {
    return <div className="git-panel"><div className="muted" style={{padding: 12}}>Loading…</div></div>;
  }
  if (!status.is_repo) {
    return (
      <div className="git-panel">
        <div className="muted" style={{ padding: 12 }}>
          Not a git repository.
          <div style={{ marginTop: 8 }}>
            <button
              onClick={() =>
                run("Initializing", "git_init", { path: root })
              }
            >
              Initialize repo
            </button>
          </div>
        </div>
        {log && <pre className="git-log">{log}</pre>}
      </div>
    );
  }

  const conflicts = status.files.filter((f) => f.conflicted);
  const staged = status.files.filter((f) => f.staged);
  const changes = status.files.filter((f) => !f.staged && !f.conflicted);

  const toggleSection = (id: GitSectionId) => {
    setOpenSection((cur) => (cur === id ? null : id));
  };

  const wrapSection = (
    id: GitSectionId,
    title: string,
    count: number,
    body: ReactNode,
    opts?: { hint?: string; trailing?: ReactNode },
  ) => {
    if (compact) {
      return (
        <GitAccordionSection
          id={id}
          openId={openSection}
          onToggle={toggleSection}
          title={title}
          count={count}
          hint={opts?.hint}
          trailing={opts?.trailing}
        >
          {body}
        </GitAccordionSection>
      );
    }
    return (
      <>
        <div className="git-section-title">
          {title} ({count})
        </div>
        {body}
      </>
    );
  };

  return (
    <div className={`git-panel${compact ? " git-panel--compact" : ""}`}>
      <div className="git-panel-top">
      <div className="git-header">
        <div className="git-branch-row">
          <button
            className="git-branch"
            title={
              status.upstream
                ? `Tracking ${status.upstream} — click to switch branch`
                : "No upstream — click to switch branch"
            }
            onClick={() => setBranchOpen((v) => !v)}
          >
            <Icon name="git-branch" size={12} />
            <span className="git-branch-name">
              {status.branch ?? "(detached)"}
            </span>
            {status.ahead > 0 ? (
              <span className="git-ahead"> ↑{status.ahead}</span>
            ) : null}
            {status.behind > 0 ? (
              <span className="git-behind"> ↓{status.behind}</span>
            ) : null}
            <Icon name="chevron-down" size={12} className="git-branch-caret" />
          </button>
          {branchOpen && (
            <>
              <div
                className="menu-overlay"
                onMouseDown={() => setBranchOpen(false)}
              />
              <div className="git-branch-menu" role="menu">
                {branches.length === 0 && (
                  <div
                    className="menu-section-title"
                    style={{ padding: 8 }}
                  >
                    No branches
                  </div>
                )}
                {branches.map((b) => (
                  <div key={b} className="git-branch-menu-row">
                    <button
                      className={`menu-item ${
                        b === status.branch ? "active" : ""
                      }`}
                      onClick={() => void switchBranch(b)}
                    >
                      <span className="menu-item-label">{b}</span>
                      {b === status.branch && (
                        <span className="menu-item-accel">current</span>
                      )}
                    </button>
                    {b !== status.branch && (
                      <button
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
                  className="menu-item git-branch-new"
                  onClick={() => void createBranch()}
                  role="menuitem"
                >
                  <span className="menu-item-label">
                    <Icon name="plus" size={11} /> New branch…
                  </span>
                </button>
              </div>
            </>
          )}
        </div>
        <div className="git-actions">
          <button
            onClick={() => void refresh()}
            title="Refresh"
            aria-label="Refresh git status"
          >
            <Icon name="refresh" size={14} />
          </button>
          <button
            onClick={() => void fetch_()}
            disabled={!!busy}
            title="Fetch"
          >
            Fetch
          </button>
          <button
            onClick={() => void pull()}
            disabled={!!busy}
            title="Pull from upstream"
          >
            Pull
          </button>
          <button
            onClick={() => void push()}
            disabled={!!busy}
            title={
              status.upstream
                ? "Push to upstream"
                : "No upstream — publish this branch to origin"
            }
          >
            {status.upstream ? "Push" : "Publish"}
          </button>
          {(status.ahead > 0 || status.behind > 0) && status.upstream && (
            <button
              onClick={() => void sync()}
              disabled={!!busy}
              className="primary"
              title={`Sync — pull ${status.behind} then push ${status.ahead}`}
            >
              Sync
            </button>
          )}
        </div>
      </div>

      <div className="git-commit">
        <textarea
          rows={2}
          placeholder="Commit message · Ctrl+Enter to commit"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            // Match the muscle memory people bring from VS Code's source
            // control: Ctrl/Cmd+Enter inside the message box runs the
            // commit if there are staged files. Plain Enter still adds
            // a newline since most messages are >1 line.
            if (
              (e.ctrlKey || e.metaKey) &&
              e.key === "Enter" &&
              !busy &&
              message.trim() &&
              staged.length > 0
            ) {
              e.preventDefault();
              void commit();
            }
          }}
        />
        <div className="git-commit-actions">
          <button
            className="primary"
            onClick={() => void commit()}
            disabled={
              !!busy ||
              !message.trim() ||
              staged.length === 0 ||
              conflicts.length > 0
            }
            title={
              conflicts.length > 0
                ? "Resolve merge conflicts first"
                : staged.length === 0
                  ? "Stage at least one file first"
                  : !message.trim()
                    ? "Type a commit message"
                    : "Commit staged changes (Ctrl+Enter from message box)"
            }
          >
            Commit
          </button>
          <button onClick={() => void stageAll()} disabled={!!busy}>
            Stage all
          </button>
        </div>
      </div>
      </div>

      <div className={compact ? "git-panel-sections" : undefined}>
      {conflicts.length > 0 &&
        wrapSection(
          "conflicts",
          "Merge Conflicts",
          conflicts.length,
          <ul className="git-files">
            {conflicts.map((f) => (
              <li
                key={"x:" + f.path}
                tabIndex={0}
                role="button"
                aria-label={`Open conflicted file ${f.path}`}
                title="Open in editor to resolve conflict markers — right-click to accept ours/theirs"
                onClick={() => void openConflict(f)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    void openConflict(f);
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setCtx({ x: e.clientX, y: e.clientY, file: f });
                }}
              >
                <span className={`git-status-tag ${statusClass(f)}`}>
                  {statusLabel(f)}
                </span>
                <span className="git-file-path" title={f.path}>
                  {f.path}
                </span>
              </li>
            ))}
          </ul>,
        )}

      {wrapSection(
        "staged",
        "Staged",
        staged.length,
        <ul className="git-files">
          {staged.map((f) => (
            <li
              key={"s:" + f.path}
              tabIndex={0}
              role="button"
              aria-label={`View diff for staged ${f.path}`}
              onClick={() => void showDiff(f, true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  void showDiff(f, true);
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setCtx({ x: e.clientX, y: e.clientY, file: f });
              }}
            >
              <span className={`git-status-tag ${statusClass(f)}`}>
                {statusLabel(f)}
              </span>
              <span className="git-file-path" title={f.path}>
                {f.path}
              </span>
              <button
                className="git-file-action"
                onClick={(e) => {
                  e.stopPropagation();
                  void unstage(f.path);
                }}
                title="Unstage"
              >
                −
              </button>
            </li>
          ))}
        </ul>,
      )}

      {wrapSection(
        "changes",
        "Changes",
        changes.length,
        <ul className="git-files">
          {changes.map((f) => (
            <li
              key={"c:" + f.path}
              tabIndex={0}
              role="button"
              aria-label={`View diff for ${f.path}`}
              onClick={() => void showDiff(f, false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  void showDiff(f, false);
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setCtx({ x: e.clientX, y: e.clientY, file: f });
              }}
            >
              <span className={`git-status-tag ${statusClass(f)}`}>
                {statusLabel(f)}
              </span>
              <span className="git-file-path" title={f.path}>
                {f.path}
              </span>
              <button
                className="git-file-action"
                onClick={(e) => {
                  e.stopPropagation();
                  void stage(f.path);
                }}
                title="Stage"
              >
                +
              </button>
            </li>
          ))}
        </ul>,
      )}

      {compact ? (
        <GitAccordionSection
          id="history"
          openId={openSection}
          onToggle={toggleSection}
          title="History"
          hint={
            openSection === "history" && commits.length > 0
              ? `· last ${commits.length}`
              : undefined
          }
        >
          <div className="git-history-list">
            {commits.length === 0 && (
              <div className="git-history-empty">
                {status?.is_repo ? "Loading…" : "Not a git repository."}
              </div>
            )}
            {commits.map((c) => (
              <button
                key={c.full_hash}
                className="git-history-row"
                onClick={() => void openCommitDetail(c)}
                title={`${c.subject}\n\n${c.author_name} <${c.author_email}>\n${c.full_hash}`}
              >
                <span
                  className="git-history-avatar"
                  aria-hidden="true"
                  title={c.author_name}
                >
                  {authorInitials(c.author_name)}
                </span>
                <span className="git-history-meta">
                  <span className="git-history-subject">{c.subject}</span>
                  <span className="git-history-sub">
                    <span className="git-history-hash">{c.hash}</span>
                    <span className="git-history-author">{c.author_name}</span>
                    <span className="git-history-time">
                      {formatRelative(c.timestamp)}
                    </span>
                  </span>
                </span>
              </button>
            ))}
          </div>
        </GitAccordionSection>
      ) : (
        <>
          <button
            className="git-history-toggle"
            onClick={() => setHistoryOpen((v) => !v)}
            aria-expanded={historyOpen}
          >
            <Icon name={historyOpen ? "chevron-down" : "chevron-right"} size={11} />
            <span>History</span>
            {historyOpen && commits.length > 0 && (
              <span className="git-history-count">· last {commits.length}</span>
            )}
          </button>
          {historyOpen && (
            <div className="git-history-list">
              {commits.length === 0 && (
                <div className="git-history-empty">
                  {status?.is_repo ? "Loading…" : "Not a git repository."}
                </div>
              )}
              {commits.map((c) => (
                <button
                  key={c.full_hash}
                  className="git-history-row"
                  onClick={() => void openCommitDetail(c)}
                  title={`${c.subject}\n\n${c.author_name} <${c.author_email}>\n${c.full_hash}`}
                >
                  <span
                    className="git-history-avatar"
                    aria-hidden="true"
                    title={c.author_name}
                  >
                    {authorInitials(c.author_name)}
                  </span>
                  <span className="git-history-meta">
                    <span className="git-history-subject">{c.subject}</span>
                    <span className="git-history-sub">
                      <span className="git-history-hash">{c.hash}</span>
                      <span className="git-history-author">{c.author_name}</span>
                      <span className="git-history-time">
                        {formatRelative(c.timestamp)}
                      </span>
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {compact ? (
        <GitAccordionSection
          id="stashes"
          openId={openSection}
          onToggle={toggleSection}
          title="Stashes"
          hint={
            openSection === "stashes" && stashes.length > 0
              ? `· ${stashes.length}`
              : undefined
          }
          trailing={
            <span
              className="git-stash-push-shortcut"
              onClick={(e) => {
                e.stopPropagation();
                void stashPush();
              }}
              title="Stash uncommitted changes"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  e.preventDefault();
                  void stashPush();
                }
              }}
            >
              <Icon name="plus" size={11} /> Stash
            </span>
          }
        >
          <div className="git-history-list">
            {stashes.length === 0 && (
              <div className="git-history-empty">
                {status?.is_repo ? "No stashes." : "Not a git repository."}
              </div>
            )}
            {stashes.map((s) => (
              <div key={s.ref_spec} className="git-stash-row">
                <div className="git-stash-meta">
                  <span className="git-stash-message">{s.message}</span>
                  <span className="git-stash-sub">
                    <span className="git-stash-ref">{s.ref_spec}</span>
                    <span>on {s.branch}</span>
                    <span>{formatRelative(s.timestamp)}</span>
                  </span>
                </div>
                <div className="git-stash-actions">
                  <button
                    className="git-stash-btn"
                    onClick={() => void stashApply(s)}
                    title="Apply stash, keep in stash list"
                  >
                    Apply
                  </button>
                  <button
                    className="git-stash-btn"
                    onClick={() => void stashPop(s)}
                    title="Apply stash and remove from list"
                  >
                    Pop
                  </button>
                  <button
                    className="git-stash-btn git-stash-btn-danger"
                    onClick={() => void stashDrop(s)}
                    title="Discard this stash"
                  >
                    Drop
                  </button>
                </div>
              </div>
            ))}
          </div>
        </GitAccordionSection>
      ) : (
        <>
          <button
            className="git-history-toggle"
            onClick={() => setStashesOpen((v) => !v)}
            aria-expanded={stashesOpen}
          >
            <Icon name={stashesOpen ? "chevron-down" : "chevron-right"} size={11} />
            <span>Stashes</span>
            {stashesOpen && stashes.length > 0 && (
              <span className="git-history-count">· {stashes.length}</span>
            )}
            <span
              className="git-stash-push-shortcut"
              onClick={(e) => {
                e.stopPropagation();
                void stashPush();
              }}
              title="Stash uncommitted changes"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  e.preventDefault();
                  void stashPush();
                }
              }}
            >
              <Icon name="plus" size={11} /> Stash
            </span>
          </button>
          {stashesOpen && (
            <div className="git-history-list">
              {stashes.length === 0 && (
                <div className="git-history-empty">
                  {status?.is_repo ? "No stashes." : "Not a git repository."}
                </div>
              )}
              {stashes.map((s) => (
                <div key={s.ref_spec} className="git-stash-row">
                  <div className="git-stash-meta">
                    <span className="git-stash-message">{s.message}</span>
                    <span className="git-stash-sub">
                      <span className="git-stash-ref">{s.ref_spec}</span>
                      <span>on {s.branch}</span>
                      <span>{formatRelative(s.timestamp)}</span>
                    </span>
                  </div>
                  <div className="git-stash-actions">
                    <button
                      className="git-stash-btn"
                      onClick={() => void stashApply(s)}
                      title="Apply stash, keep in stash list"
                    >
                      Apply
                    </button>
                    <button
                      className="git-stash-btn"
                      onClick={() => void stashPop(s)}
                      title="Apply stash and remove from list"
                    >
                      Pop
                    </button>
                    <button
                      className="git-stash-btn git-stash-btn-danger"
                      onClick={() => void stashDrop(s)}
                      title="Discard this stash"
                    >
                      Drop
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      </div>
      {openCommit && (
        <div className="git-commit-modal" onMouseDown={() => setOpenCommit(null)}>
          <div
            ref={commitCardRef}
            tabIndex={-1}
            className="git-commit-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="git-commit-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="git-commit-card-head">
              <span className="git-commit-title" id="git-commit-title">
                <span className="git-commit-hash">{openCommit.hash}</span>
                {openCommit.subject}
              </span>
              <button
                className="git-commit-close"
                onClick={() => setOpenCommit(null)}
                aria-label="Close commit detail"
                title="Close (Esc)"
              >
                <Icon name="x" size={14} />
              </button>
            </div>
            <div className="git-commit-card-meta">
              {openCommit.author_name} &lt;{openCommit.author_email}&gt; ·{" "}
              {new Date(openCommit.timestamp * 1000).toLocaleString()}
            </div>
            <pre className="git-commit-diff">
              {commitDiffLoading ? "Loading diff…" : commitDiff}
            </pre>
          </div>
        </div>
      )}

      {historyFile && (
        <FileHistoryModal
          root={root}
          relPath={historyFile}
          onClose={() => setHistoryFile(null)}
        />
      )}
      {busy && <div className="git-busy">{busy}…</div>}
      {log && <pre className="git-log">{log}</pre>}
      {ctx && (
        <ContextMenu
          x={ctx.x}
          y={ctx.y}
          items={(() => {
            const file = ctx.file;
            const items: (ContextMenuItem | "separator")[] = [];
            if (file.conflicted) {
              items.push({
                label: "Open File (resolve markers)",
                onClick: () => void openConflict(file),
              });
              items.push("separator");
              items.push({
                label: "Accept Ours (current branch)",
                onClick: () => void resolveConflict(file, "ours"),
              });
              items.push({
                label: "Accept Theirs (incoming)",
                onClick: () => void resolveConflict(file, "theirs"),
              });
              items.push("separator");
              items.push({
                label: "Copy Path",
                onClick: async () => {
                  try {
                    await navigator.clipboard.writeText(file.path);
                  } catch {
                    /* ignore */
                  }
                },
              });
              return items;
            }
            items.push({
              label: "View Diff",
              onClick: () => showDiff(file, file.staged),
            });
            items.push({
              label: "File History…",
              onClick: () => setHistoryFile(file.path),
            });
            if (file.staged) {
              items.push({
                label: "Unstage",
                onClick: () => void unstage(file.path),
              });
            } else {
              items.push({
                label: "Stage",
                onClick: () => void stage(file.path),
              });
            }
            items.push("separator");
            items.push({
              label:
                file.index_status === "?"
                  ? "Delete Untracked File"
                  : "Discard Changes",
              danger: true,
              disabled: file.staged,
              onClick: () => discard(file),
            });
            items.push({
              label: "Copy Path",
              onClick: async () => {
                try {
                  await navigator.clipboard.writeText(file.path);
                } catch {
                  /* ignore */
                }
              },
            });
            return items;
          })()}
          onClose={() => setCtx(null)}
        />
      )}
    </div>
  );
}
