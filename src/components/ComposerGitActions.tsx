import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { basename } from "../pathUtils";
import {
  runComposerGitAction,
  type ComposerGitAction,
} from "../composerGitOps";
import {
  getGitStatus,
  startGitStatusWatch,
  subscribeGitStatus,
} from "../gitStatusStore";
import { git, type GitDiffStat, type GitStatus } from "../ipc";
import { ComposerCtxMenu } from "../composerCtxMenu";
import { Icon } from "./Icon";

const VISIBLE_FILES = 2;

type Props = {
  wsId: string;
  root: string;
  /** Prefill the commit-message prompt when the composer has draft text. */
  suggestedMessage?: string;
};

type FileRow = {
  path: string;
  insertions: number;
  deletions: number;
  untracked: boolean;
};

function buildFileRows(status: GitStatus, diff: GitDiffStat | null): FileRow[] {
  const byPath = new Map(
    (diff?.files ?? []).map((f) => [f.path, f] as const),
  );
  return status.files
    .filter((f) => !f.conflicted)
    .map((f) => {
      const stat = byPath.get(f.path);
      const untracked = f.index_status === "?" && f.worktree_status === "?";
      return {
        path: f.path,
        insertions: stat?.insertions ?? 0,
        deletions: stat?.deletions ?? 0,
        untracked,
      };
    });
}

function primaryLabel(hasChanges: boolean, ahead: number): string {
  if (hasChanges) return "Commit & Push";
  if (ahead > 0) return "Push";
  return "Commit & Push";
}

function primaryAction(
  hasChanges: boolean,
  ahead: number,
): ComposerGitAction {
  if (hasChanges) return "commit-push";
  if (ahead > 0) return "push";
  return "commit-push";
}

export function ComposerGitActions({
  wsId,
  root,
  suggestedMessage,
}: Props) {
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [diff, setDiff] = useState<GitDiffStat | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  const refreshDiff = useCallback(async () => {
    try {
      setDiff(await git.diffStat(root));
    } catch {
      setDiff(null);
    }
  }, [root]);

  useEffect(() => {
    const apply = () => {
      const snap = getGitStatus(wsId);
      setStatus(snap.status);
    };
    const stop = startGitStatusWatch(wsId, root);
    const unsub = subscribeGitStatus(wsId, () => {
      apply();
      void refreshDiff();
    });
    apply();
    void refreshDiff();
    return () => {
      unsub();
      stop();
    };
  }, [wsId, root, refreshDiff]);

  const fileRows = useMemo(
    () => (status ? buildFileRows(status, diff) : []),
    [status, diff],
  );
  const hasChanges = fileRows.length > 0;
  const ahead = status?.ahead ?? 0;
  const show =
    status?.is_repo && (hasChanges || ahead > 0 || (diff?.insertions ?? 0) > 0);

  const run = async (action: ComposerGitAction) => {
    if (!status || busy) return;
    setMenuOpen(false);
    setBusy(true);
    try {
      await runComposerGitAction({
        wsId,
        root,
        status,
        action,
        suggestedMessage: suggestedMessage?.trim() || undefined,
      });
      await refreshDiff();
    } finally {
      setBusy(false);
    }
  };

  if (!show || !status) return null;

  const hiddenN = Math.max(0, fileRows.length - VISIBLE_FILES);
  const visibleRows = expanded ? fileRows : fileRows.slice(0, VISIBLE_FILES);
  const ins = diff?.insertions ?? 0;
  const del = diff?.deletions ?? 0;

  const menuItems: { id: ComposerGitAction; label: string; disabled?: boolean }[] =
    [
      { id: "branch-commit", label: "Create Branch & Commit" },
      { id: "branch-commit-push", label: "Create Branch, Commit & Push" },
      { id: "commit", label: "Commit", disabled: !hasChanges },
      { id: "commit-push", label: "Commit & Push", disabled: !hasChanges },
      { id: "push", label: "Push", disabled: ahead === 0 && !hasChanges },
    ];

  return (
    <div className="ai-composer-git">
      {fileRows.length > 0 && (
        <ul className="ai-composer-git-files">
          {visibleRows.map((f) => (
            <li key={f.path} className="ai-composer-git-file" title={f.path}>
              <span className="ai-composer-git-file-name">{basename(f.path)}</span>
              <span className="ai-composer-git-file-stats">
                {f.untracked ? (
                  <span className="ai-composer-git-untracked">new</span>
                ) : (
                  <>
                    {f.insertions > 0 && (
                      <span className="ai-composer-git-add">+{f.insertions}</span>
                    )}
                    {f.deletions > 0 && (
                      <span className="ai-composer-git-del">−{f.deletions}</span>
                    )}
                  </>
                )}
              </span>
            </li>
          ))}
          {hiddenN > 0 && !expanded && (
            <li>
              <button
                type="button"
                className="ai-composer-git-more"
                onClick={() => setExpanded(true)}
              >
                Show {hiddenN} more
              </button>
            </li>
          )}
        </ul>
      )}
      <div className="ai-composer-git-actions">
        {(hasChanges || ins > 0 || del > 0) && (
          <span className="ai-composer-git-changes">
            <span className="ai-composer-git-changes-label">Changes</span>
            {ins > 0 && <span className="ai-composer-git-add">+{ins}</span>}
            {del > 0 && <span className="ai-composer-git-del">−{del}</span>}
          </span>
        )}
        <div className="ai-composer-git-split">
          <button
            type="button"
            className="ai-composer-git-main"
            disabled={busy}
            onClick={() => void run(primaryAction(hasChanges, ahead))}
          >
            {busy ? "Working…" : primaryLabel(hasChanges, ahead)}
          </button>
          <button
            ref={btnRef}
            type="button"
            className="ai-composer-git-menu-btn"
            disabled={busy}
            aria-expanded={menuOpen}
            aria-label="More git actions"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <Icon name="chevron-down" size={12} />
          </button>
          <ComposerCtxMenu
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            anchorRef={btnRef}
            estimateHeight={200}
          >
            {menuItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className="menu-item"
                disabled={item.disabled}
                role="menuitem"
                onClick={() => void run(item.id)}
              >
                <span className="menu-item-label">{item.label}</span>
              </button>
            ))}
          </ComposerCtxMenu>
        </div>
      </div>
    </div>
  );
}
