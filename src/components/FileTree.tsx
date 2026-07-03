import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { fs, type DirEntry } from "../ipc";
import { fsBus, pathsEqual } from "../fsBus";
import { findTabsPaneByTab, useStore } from "../store";
import { ContextMenu, type ContextMenuItem } from "./ContextMenu";
import {
  error as toastError,
  errMsg,
  success as toastSuccess,
} from "../notify";
import {
  confirm as dialogConfirm,
  prompt as dialogPrompt,
} from "../dialog";
import {
  getActiveSftp,
  lookupRemoteLink,
  rememberRemoteLink,
  subscribeActiveSftp,
} from "../sftpLinks";
import { findSftpProfile, profileToConn } from "../sftpProfiles";
import { pushLinkedFile, suppressNextAutoPush } from "../sftpPush";
import { appendDeployLog } from "../deployLog";
import { REVEAL_IN_TREE_EVENT } from "../revealInTree";
import { basename, dirname, joinPath, relPath } from "../pathUtils";
import { dropRecentFile } from "../recentFiles";
import {
  isBookmarked,
  removeBookmark,
  addBookmark,
  renameBookmark,
} from "../bookmarks";
import {
  getGitStatus,
  normalizeGitPath,
  startGitStatusWatch,
  statusClass,
  subscribeGitStatus,
  treeBadge,
} from "../gitStatusStore";
import { FileHistoryModal } from "./FileHistoryModal";
import { Icon } from "./Icon";
import { fileIconName, fileIconTint } from "../fileIcons";

interface MenuTarget {
  x: number;
  y: number;
  entry: DirEntry | null; // null = root background
}

// When provided, file (non-directory) clicks call this instead of the
// store's openFile. Agent mode uses it to open files in a popup viewer,
// since it has no editor pane. Directories still toggle normally.
export const FileOpenOverride = createContext<
  ((wsId: string, path: string) => void) | null
>(null);

interface NodeProps {
  wsId: string;
  entry: DirEntry;
  depth: number;
  onContext: (target: MenuTarget) => void;
}

function Node({ wsId, entry, depth, onContext }: NodeProps) {
  // Normalize-aware match: reveal-in-tree stores forward-slash paths
  // while entry.path is OS-native (backslashes on Windows). Exact
  // string compare made "Reveal in Explorer" a silent no-op there.
  const expanded = useStore((s) =>
    (s.loaded[wsId]?.layout.expandedDirs ?? []).some((d) =>
      pathsEqual(d, entry.path),
    ),
  );
  const toggleDir = useStore((s) => s.toggleDir);
  const openFile = useStore((s) => s.openFile);
  const isActive = useStore((s) => {
    if (entry.is_dir) return false;
    const layout = s.loaded[wsId]?.layout;
    if (!layout) return false;
    const key = "file:" + entry.path;
    const ePane = findTabsPaneByTab(layout.editorRoot, key);
    if (ePane && ePane.active === key) return true;
    if (
      layout.bottomRoot &&
      findTabsPaneByTab(layout.bottomRoot, key)?.active === key
    ) {
      return true;
    }
    return false;
  });
  const [children, setChildren] = useState<DirEntry[] | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    if (!entry.is_dir) return;
    setLoading(true);
    fs.listDir(entry.path)
      .then((c) => setChildren(c))
      .catch(() => setChildren([]))
      .finally(() => setLoading(false));
  }, [entry]);

  useEffect(() => {
    if (entry.is_dir && expanded && children === null && !loading) {
      refresh();
    }
  }, [expanded, entry, children, loading, refresh]);

  useEffect(() => {
    if (!entry.is_dir) return;
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent).detail as {
        wsId: string;
        dir: string;
      };
      if (detail.wsId !== wsId) return;
      if (pathsEqual(detail.dir, entry.path)) {
        if (expanded) refresh();
        else setChildren(null);
      }
    };
    fsBus.addEventListener("dir", handler);
    return () => fsBus.removeEventListener("dir", handler);
  }, [entry, wsId, expanded, refresh]);

  const openOverride = useContext(FileOpenOverride);
  const onClick = () => {
    if (entry.is_dir) toggleDir(wsId, entry.path);
    else if (openOverride) openOverride(wsId, entry.path);
    else void openFile(wsId, entry.path);
  };

  const renameInPlace = async () => {
    const next = await dialogPrompt("Rename to", basename(entry.path), {
      title: "Rename",
      okLabel: "Rename",
    });
    if (!next || next === basename(entry.path)) return;
    const newPath = joinPath(dirname(entry.path), next);
    try {
      await fs.rename(entry.path, newPath);
      // Re-key any open buffers/tabs so Ctrl+S writes to the NEW path
      // (a dir rename re-keys every open child).
      useStore.getState().handlePathRenamed(wsId, entry.path, newPath);
      if (!entry.is_dir) {
        dropRecentFile(wsId, entry.path);
        renameBookmark(wsId, entry.path, newPath);
      }
    } catch (err) {
      toastError(`Failed to rename: ${errMsg(err)}`);
    }
  };

  const deleteInPlace = async () => {
    const message = entry.is_dir
      ? `Delete folder ${basename(entry.path)} and ALL its contents?\n\nThis is recursive and cannot be undone.`
      : `Delete ${basename(entry.path)}?\n\nThis cannot be undone.`;
    const ok = await dialogConfirm(message, {
      title: entry.is_dir ? "Delete folder" : "Delete file",
      okLabel: "Delete",
      cancelLabel: "Cancel",
      danger: true,
    });
    if (!ok) return;
    try {
      await fs.delete(entry.path);
      if (!entry.is_dir) {
        dropRecentFile(wsId, entry.path);
        removeBookmark(wsId, entry.path);
      }
    } catch (err) {
      toastError(`Failed to delete: ${errMsg(err)}`);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    } else if (e.key === "ArrowRight" && entry.is_dir && !expanded) {
      e.preventDefault();
      toggleDir(wsId, entry.path);
    } else if (e.key === "ArrowLeft" && entry.is_dir && expanded) {
      e.preventDefault();
      toggleDir(wsId, entry.path);
    } else if (e.key === "F2") {
      // Standard rename shortcut. Same dialog as the context menu —
      // the keyboard route just skips the right-click.
      e.preventDefault();
      void renameInPlace();
    } else if (e.key === "Delete" || e.key === "Backspace") {
      // Confirm-then-delete via the same path as the context menu.
      // Backspace is a Mac-friendly alternative since the Mac
      // delete-key glyph confuses some users.
      e.preventDefault();
      void deleteInPlace();
    } else if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) {
      // Synthesize a context-menu event at the row's bounding box so
      // keyboard users can reach the right-click actions.
      e.preventDefault();
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      onContext({ x: rect.left + 16, y: rect.bottom, entry });
    }
  };

  // Git decoration: files get a colored status letter on the right
  // edge; folders get a muted dot when anything under them changed.
  // Read on-demand from the shared cache — the parent FileTree
  // re-renders the whole tree on every published status, so Node
  // doesn't need its own subscription.
  const gitSnap = getGitStatus(wsId);
  const gitFile = entry.is_dir
    ? undefined
    : gitSnap.byPath.get(normalizeGitPath(entry.path));
  const gitDirDot =
    entry.is_dir && gitSnap.changedDirs.has(normalizeGitPath(entry.path));

  const rowStyle = { "--tree-depth": depth } as React.CSSProperties;

  return (
    <>
      <div
        className={`tree-row ${isActive ? "active" : ""}`}
        style={rowStyle}
        data-path={entry.path}
        data-depth={depth}
        tabIndex={0}
        role={entry.is_dir ? "treeitem" : "button"}
        aria-expanded={entry.is_dir ? expanded : undefined}
        aria-label={entry.is_dir ? `${entry.name} folder` : entry.name}
        onClick={onClick}
        onKeyDown={onKeyDown}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onContext({ x: e.clientX, y: e.clientY, entry });
        }}
        title={entry.path}
      >
        <span className="tree-caret">
          {entry.is_dir && (
            <Icon name={expanded ? "chevron-down" : "chevron-right"} size={10} />
          )}
        </span>
        <span className={`tree-icon tree-icon--${fileIconTint(entry.name, entry.is_dir)}`}>
          <Icon
            name={entry.is_dir ? "folder" : fileIconName(entry.name)}
            size={14}
          />
        </span>
        <span
          className={[
            "tree-name",
            gitFile ? statusClass(gitFile) : "",
            gitDirDot ? "tree-name--dirty-dir" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {entry.name}
        </span>
        {gitFile && (
          <span
            className={`tree-git-badge ${statusClass(gitFile)}`}
            aria-hidden="true"
            title={`Git: ${gitFile.index_status}${gitFile.worktree_status}`}
          >
            {treeBadge(gitFile)}
          </span>
        )}
        {gitDirDot && <span className="tree-git-dot" aria-hidden="true" />}
      </div>
      {entry.is_dir && expanded && children && (
        <>
          {children.map((c) => (
            <Node
              key={c.path}
              wsId={wsId}
              entry={c}
              depth={depth + 1}
              onContext={onContext}
            />
          ))}
        </>
      )}
    </>
  );
}

interface Props {
  wsId: string;
  root: string;
  /** Override file clicks (e.g. agent mode opens files in a popup). */
  onOpenFile?: (wsId: string, path: string) => void;
}

export function FileTree({ wsId, root, onOpenFile }: Props) {
  const [entries, setEntries] = useState<DirEntry[]>([]);
  const [menu, setMenu] = useState<MenuTarget | null>(null);
  const [historyFile, setHistoryFile] = useState<string | null>(null);
  const treeRef = useRef<HTMLDivElement | null>(null);

  // Shared git status: one watcher feeds every Node's badge. The tick
  // only forces a re-render — Nodes read the cache directly.
  const [, setGitTick] = useState(0);
  useEffect(() => {
    const stop = startGitStatusWatch(wsId, root);
    const unsub = subscribeGitStatus(wsId, () => setGitTick((n) => n + 1));
    return () => {
      unsub();
      stop();
    };
  }, [wsId, root]);

  // Scroll-into-view half of reveal-in-tree. Lazily-loaded levels need
  // one listDir round trip each before the row exists, so retry on a
  // short timer instead of assuming a single fixed delay is enough.
  useEffect(() => {
    let timer: number | null = null;
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent).detail as {
        wsId: string;
        path: string;
      };
      if (detail.wsId !== wsId) return;
      let attempts = 0;
      const tryScroll = () => {
        attempts++;
        const rows =
          treeRef.current?.querySelectorAll<HTMLElement>("[data-path]") ?? [];
        for (const row of rows) {
          if (pathsEqual(row.dataset.path ?? "", detail.path)) {
            row.scrollIntoView({ block: "nearest", inline: "nearest" });
            row.focus();
            return;
          }
        }
        if (attempts < 25) timer = window.setTimeout(tryScroll, 80);
      };
      tryScroll();
    };
    window.addEventListener(REVEAL_IN_TREE_EVENT, handler);
    return () => {
      window.removeEventListener(REVEAL_IN_TREE_EVENT, handler);
      if (timer) window.clearTimeout(timer);
    };
  }, [wsId]);
  // Subscribe to the active SFTP session so the right-click menu can
  // light up "Push" / "Upload to remote" entries when a connection is
  // live. Stored as a tick counter — we only need to re-render, the
  // real value is read on-demand inside the menu builder via getActiveSftp.
  const [, setSftpTick] = useState(0);
  useEffect(() => {
    return subscribeActiveSftp(wsId, () => setSftpTick((n) => n + 1));
  }, [wsId]);

  const refresh = useCallback(() => {
    fs.listDir(root)
      .then((e) => setEntries(e))
      .catch(() => setEntries([]));
  }, [root]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent).detail as {
        wsId: string;
        dir: string;
      };
      if (detail.wsId !== wsId) return;
      if (pathsEqual(detail.dir, root)) refresh();
    };
    fsBus.addEventListener("dir", handler);
    return () => fsBus.removeEventListener("dir", handler);
  }, [wsId, root, refresh]);

  const items: (ContextMenuItem | "separator")[] = (() => {
    const target = menu?.entry ?? null;
    const parentPath =
      target == null ? root : target.is_dir ? target.path : dirname(target.path);

    const out: (ContextMenuItem | "separator")[] = [];
    out.push({
      label: "New File…",
      onClick: async () => {
        const name = await dialogPrompt("New file name", "", {
          title: "New file",
          okLabel: "Create",
        });
        if (!name) return;
        const p = joinPath(parentPath, name);
        try {
          await fs.createFile(p);
          await useStore.getState().openFile(wsId, p);
        } catch (e) {
          toastError(`Failed to create file: ${errMsg(e)}`);
        }
      },
    });
    out.push({
      label: "New Folder…",
      onClick: async () => {
        const name = await dialogPrompt("New folder name", "", {
          title: "New folder",
          okLabel: "Create",
        });
        if (!name) return;
        const p = joinPath(parentPath, name);
        try {
          await fs.createDir(p);
        } catch (e) {
          toastError(`Failed to create folder: ${errMsg(e)}`);
        }
      },
    });
    if (target) {
      out.push("separator");
      out.push({
        label: "Rename…",
        onClick: async () => {
          const next = await dialogPrompt(
            "Rename to",
            basename(target.path),
            { title: "Rename", okLabel: "Rename" },
          );
          if (!next || next === basename(target.path)) return;
          const newPath = joinPath(dirname(target.path), next);
          try {
            await fs.rename(target.path, newPath);
            // Drop the old path from the per-workspace recent-files
            // stack so Ctrl+Tab doesn't try to reopen a path that no
            // longer exists. The Monaco editor for the open buffer
            // will follow the rename via its own buffer-key change.
            if (!target.is_dir) {
              dropRecentFile(wsId, target.path);
              renameBookmark(wsId, target.path, newPath);
            }
          } catch (e) {
            toastError(`Failed to rename: ${errMsg(e)}`);
          }
        },
      });
      out.push({
        label: "Delete",
        danger: true,
        onClick: async () => {
          // The Rust delete_path does remove_dir_all for directories,
          // which is a recursive nuke — surface that explicitly so a
          // stray right-click on a folder can't silently take out a
          // big subtree.
          const message = target.is_dir
            ? `Delete folder ${basename(target.path)} and ALL its contents?\n\nThis is recursive and cannot be undone.`
            : `Delete ${basename(target.path)}?\n\nThis cannot be undone.`;
          const ok = await dialogConfirm(message, {
            title: target.is_dir ? "Delete folder" : "Delete file",
            okLabel: "Delete",
            cancelLabel: "Cancel",
            danger: true,
          });
          if (!ok) return;
          try {
            await fs.delete(target.path);
            // Drop from per-workspace recent-files stack so Ctrl+Tab
            // doesn't surface a deleted path. For folders we'd need to
            // crawl the watched scrollback to find children that were
            // recents — skipping that since the Ctrl+Tab opener will
            // fall through with a "file not found" toast for any
            // child that's gone, which is acceptable degraded behavior.
            if (!target.is_dir) {
              dropRecentFile(wsId, target.path);
              removeBookmark(wsId, target.path);
            }
          } catch (e) {
            toastError(`Failed to delete: ${errMsg(e)}`);
          }
        },
      });
      out.push("separator");
      if (!target.is_dir) {
        const pinned = isBookmarked(wsId, target.path);
        out.push({
          label: pinned ? "Unpin from bookmarks" : "Pin to bookmarks",
          onClick: () => {
            if (pinned) removeBookmark(wsId, target.path);
            else addBookmark(wsId, target.path);
          },
        });
        out.push({
          label: "File History…",
          onClick: () => setHistoryFile(relPath(target.path, root)),
        });
      }
      out.push({
        label: "Reveal in File Explorer",
        onClick: async () => {
          try {
            await revealItemInDir(target.path);
          } catch (e) {
            console.error(e);
          }
        },
      });
      out.push({
        label: "Copy Path",
        onClick: async () => {
          try {
            await navigator.clipboard.writeText(target.path);
          } catch {
            /* ignore */
          }
        },
      });
      out.push({
        label: "Copy Relative Path",
        onClick: async () => {
          // Workspace-relative path with forward slashes — what most
          // tools (grep, git pathspec, AI prompts pasted into chat)
          // expect when you say "the foo/bar.ts file." Mirrors VS
          // Code's same-named entry. Falls back to absolute if the
          // file somehow sits outside root.
          const norm = target.path.replace(/\\/g, "/");
          const r = root.replace(/\\/g, "/").replace(/\/+$/, "") + "/";
          const rel = norm.startsWith(r) ? norm.slice(r.length) : norm;
          try {
            await navigator.clipboard.writeText(rel);
            toastSuccess(`Copied: ${rel}`);
          } catch {
            /* ignore */
          }
        },
      });

      // SFTP actions. Files get push/upload/auto-push toggle; folders
      // get a recursive upload entry. Both kinds light up only when a
      // session is connected (via the active-SFTP registry).
      if (target.is_dir) {
        const active = getActiveSftp(wsId);
        if (active) {
          out.push("separator");
          out.push({
            label: `Upload folder to remote (${active.cwd})…`,
            onClick: async () => {
              const suggestedRemote = `${active.cwd.replace(/\/$/, "")}/${basename(target.path)}`;
              const remotePath = await dialogPrompt(
                "Remote target folder",
                suggestedRemote,
                {
                  title: "Upload folder (recursive)",
                  okLabel: "Upload",
                },
              );
              if (!remotePath) return;
              const ok = await dialogConfirm(
                `Upload contents of:\n  ${target.path}\n→ remote:\n  ${remotePath}\n\nHeavy dirs (.git, node_modules, dist…) are skipped.`,
                {
                  title: "Confirm upload",
                  okLabel: "Upload",
                  cancelLabel: "Cancel",
                },
              );
              if (!ok) return;
              try {
                const result = await invoke<{
                  files: number;
                  bytes: number;
                  failed: string[];
                }>("sftp_upload_dir", {
                  args: {
                    ...active.conn,
                    local_path: target.path,
                    remote_path: remotePath,
                  },
                });
                const mb = (result.bytes / 1024 / 1024).toFixed(2);
                if (result.failed.length === 0) {
                  toastSuccess(
                    `Uploaded ${result.files} files (${mb} MB) → ${remotePath}`,
                  );
                } else {
                  toastError(
                    `Uploaded ${result.files}/${
                      result.files + result.failed.length
                    } files. ${result.failed.length} failed — see console.`,
                  );
                  console.warn(
                    "sftp_upload_dir failures:",
                    result.failed,
                  );
                }
              } catch (e) {
                toastError(
                  `Upload failed: ${errMsg(e)}`,
                );
              }
            },
          });
        }
      } else {
        const link = lookupRemoteLink(wsId, target.path);
        const active = getActiveSftp(wsId);
        if (link || active) {
          out.push("separator");
        }
        if (link) {
          out.push({
            label: link.autoPush
              ? "Disable auto-push on save"
              : "Enable auto-push on save",
            onClick: () => {
              rememberRemoteLink(wsId, target.path, {
                ...link,
                autoPush: !link.autoPush,
              });
              toastSuccess(
                link.autoPush
                  ? `Auto-push disabled for ${basename(target.path)}`
                  : `Auto-push ON for ${basename(target.path)} → saves push to ${link.remotePath}`,
              );
            },
          });
          out.push({
            label: `Push to remote (${link.remotePath})`,
            onClick: async () => {
              try {
                // Prefer the live session's connection; otherwise fall
                // back to the saved profile this file was downloaded
                // from. (Spreading null here used to send an invoke
                // with no host/user at all, which surfaced as a
                // cryptic "missing field" deserialization error.)
                const conn =
                  active?.profileId === link.profileId
                    ? active.conn
                    : (() => {
                        const p = findSftpProfile(link.profileId);
                        return p ? profileToConn(p) : null;
                      })();
                if (!conn) {
                  toastError(
                    "The SFTP profile this file came from no longer exists. Re-download it from the Remote panel.",
                  );
                  return;
                }
                // Flush any open dirty buffer so we push what the user
                // sees, not the last on-disk save. Abort on a failed
                // save (deploying stale content under a success toast),
                // and stand the auto-push down so autoPush files aren't
                // uploaded twice.
                const buf = useStore.getState().loaded[wsId]?.files[
                  target.path
                ];
                if (buf && buf.contents !== buf.original) {
                  if (link.autoPush) suppressNextAutoPush(target.path);
                  if (
                    !(await useStore.getState().saveFile(wsId, target.path))
                  ) {
                    return;
                  }
                }
                const sent = await pushLinkedFile({
                  wsId,
                  conn,
                  localPath: target.path,
                  link,
                  mode: "interactive",
                });
                if (sent) toastSuccess(`Pushed → ${link.remotePath}`);
              } catch (e) {
                toastError(
                  `Push failed: ${errMsg(e)}`,
                );
              }
            },
          });
        }
        if (active) {
          out.push({
            label: `Upload to remote (${active.cwd})…`,
            onClick: async () => {
              const suggested = `${active.cwd.replace(/\/$/, "")}/${basename(target.path)}`;
              const remotePath = await dialogPrompt(
                "Remote target path",
                suggested,
                { title: "Upload to remote", okLabel: "Upload" },
              );
              if (!remotePath) return;
              try {
                let bytes: number;
                try {
                  bytes = await invoke<number>("sftp_upload_from_disk", {
                    args: {
                      ...active.conn,
                      remotePath,
                      localPath: target.path,
                    },
                  });
                } catch (e) {
                  appendDeployLog(wsId, {
                    op: "upload",
                    profileId: active.profileId,
                    remotePath,
                    localPath: target.path,
                    status: "fail",
                    detail: errMsg(e),
                  });
                  throw e;
                }
                appendDeployLog(wsId, {
                  op: "upload",
                  profileId: active.profileId,
                  remotePath,
                  localPath: target.path,
                  bytes,
                  status: "ok",
                });
                rememberRemoteLink(wsId, target.path, {
                  profileId: active.profileId,
                  remotePath,
                  downloadedAt: Date.now(),
                });
                toastSuccess(`Uploaded → ${remotePath}`);
              } catch (e) {
                toastError(
                  `Upload failed: ${errMsg(e)}`,
                );
              }
            },
          });
        }
      }
    }
    return out;
  })();

  return (
    <FileOpenOverride.Provider value={onOpenFile ?? null}>
    <div
      ref={treeRef}
      className="tree"
      role="tree"
      onContextMenu={(e) => {
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY, entry: null });
      }}
    >
      {entries.length === 0 ? (
        <div className="tree-empty">
          Empty folder. Right-click to create a file or folder.
        </div>
      ) : (
        entries.map((e) => (
          <Node
            key={e.path}
            wsId={wsId}
            entry={e}
            depth={0}
            onContext={(t) => setMenu(t)}
          />
        ))
      )}
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={items}
          onClose={() => setMenu(null)}
        />
      )}
      {historyFile && (
        <FileHistoryModal
          root={root}
          relPath={historyFile}
          onClose={() => setHistoryFile(null)}
        />
      )}
    </div>
    </FileOpenOverride.Provider>
  );
}
