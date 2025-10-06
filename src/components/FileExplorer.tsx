import {
  Fragment,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import FileContextMenu from "./FileContextMenu";

const normalize = (value: string) => value.toLowerCase();
const normalizePathValue = (value: string) =>
  value.replace(/\\/g, "/").replace(/\//g, "/");
const stripTrailingSlash = (value: string) => value.replace(/\/+$/, "");
const concatPath = (base: string, relative: string) => {
  const normalizedBase = normalizePathValue(base);
  const normalizedRelative = normalizePathValue(relative);
  const trimmedBase = normalizedBase.endsWith("/")
    ? stripTrailingSlash(normalizedBase)
    : normalizedBase;
  const trimmedRelative = normalizedRelative.replace(/^\/+/, "");

  if (!trimmedBase) {
    return trimmedRelative;
  }

  if (trimmedBase === "/") {
    return `/${trimmedRelative}`;
  }

  return `${trimmedBase}/${trimmedRelative}`;
};
const fuzzyMatch = (query: string, target: string) => {
  if (!query) {
    return true;
  }
  const normalizedQuery = normalize(query);
  const normalizedTarget = normalize(target);
  let queryIndex = 0;
  let targetIndex = 0;
  while (
    queryIndex < normalizedQuery.length &&
    targetIndex < normalizedTarget.length
  ) {
    if (normalizedQuery[queryIndex] === normalizedTarget[targetIndex]) {
      queryIndex += 1;
    }
    targetIndex += 1;
  }
  return queryIndex === normalizedQuery.length;
};

import type { DirectoryEntry, GitStatusEntry } from "../types";

interface FileExplorerProps {
  rootPath: string | null;
  tree: Record<string, DirectoryEntry[]>;
  loading: boolean;
  error: string | null;
  activePath: string;
  activeFilePath: string | null;
  onOpenFile: (entry: DirectoryEntry) => void;
  onLoadChildren: (path: string) => Promise<DirectoryEntry[]>;
  modifiedEntries: GitStatusEntry[] | null;
  gitRootPath: string | null;
}

function FileExplorer({
  rootPath,
  tree,
  loading,
  error,
  activePath,
  activeFilePath,
  onOpenFile,
  onLoadChildren,
  modifiedEntries,
  gitRootPath,
}: FileExplorerProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loadingNodes, setLoadingNodes] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [contextMenu, setContextMenu] = useState<{
    position: { x: number; y: number };
    entry: DirectoryEntry;
  } | null>(null);
  const prefetchedDirectoriesRef = useRef<Set<string>>(new Set());
  const loadingNodesRef = useRef<Set<string>>(new Set());

  const rootEntries = useMemo(() => {
    if (!rootPath) {
      return [];
    }
    return tree[rootPath] ?? [];
  }, [rootPath, tree]);

  const rootLabel = useMemo(() => {
    if (!rootPath) {
      return "—";
    }
    const normalized = rootPath.replace(/\\/g, "/");
    const segments = normalized.split("/");
    const candidate = segments.filter(Boolean).pop();
    return candidate ?? normalized;
  }, [rootPath]);

  // Mappa dei file modificati per path (usa path relativo come chiave)
  const modifiedFilesMap = useMemo(() => {
    if (!modifiedEntries || !gitRootPath)
      return new Map<string, GitStatusEntry>();

    const map = new Map<string, GitStatusEntry>();
    for (const entry of modifiedEntries) {
      const fullPath = concatPath(gitRootPath, entry.path);
      map.set(fullPath, entry);
    }
    return map;
  }, [modifiedEntries, gitRootPath]);

  const allModifiedFiles = useMemo(() => {
    if (!modifiedEntries || !gitRootPath) {
      return [] as Array<{
        entry: DirectoryEntry;
        gitEntry: GitStatusEntry;
        displayPath: string;
      }>;
    }

    return modifiedEntries.map((gitEntry) => {
        const fullPath = concatPath(gitRootPath, gitEntry.path);
        const displayPath = gitEntry.path;
        const name = displayPath.split("/").filter(Boolean).pop() ?? displayPath;

        const entry: DirectoryEntry = {
          name,
          path: fullPath,
          is_dir: false,
          is_symlink: false,
        };

        return {
          entry,
          gitEntry,
          displayPath,
        };
      });
  }, [gitRootPath, modifiedEntries]);

  useEffect(() => {
    if (!rootPath) {
      return;
    }
    setExpanded((previous) => {
      if (previous.has(rootPath)) {
        return previous;
      }
      const next = new Set(previous);
      next.add(rootPath);
      return next;
    });
  }, [rootPath]);

  const ensureExpanded = useCallback((path: string) => {
    setExpanded((previous) => {
      if (previous.has(path)) {
        return previous;
      }
      const next = new Set(previous);
      next.add(path);
      return next;
    });
  }, []);

  useEffect(() => {
    loadingNodesRef.current = loadingNodes;
  }, [loadingNodes]);

  useEffect(() => {
    for (const key of Object.keys(tree)) {
      prefetchedDirectoriesRef.current.add(key);
    }
  }, [tree]);

  useEffect(() => {
    if (!activePath) {
      return;
    }
    const normalized = activePath.replace(/\\/g, "/");
    const segments = normalized
      .split("/")
      .filter((segment) => segment.length > 0);

    let accumulator = "";
    if (normalized.startsWith("/")) {
      accumulator = "/";
      if (tree[accumulator]) {
        ensureExpanded(accumulator);
      }
    } else if (segments[0]?.includes(":")) {
      accumulator = segments.shift() ?? "";
      if (accumulator && tree[accumulator]) {
        ensureExpanded(accumulator);
      }
    }

    for (const segment of segments) {
      if (accumulator === "" || accumulator === "/") {
        accumulator = accumulator === "/" ? `/${segment}` : segment;
      } else {
        accumulator = `${accumulator}/${segment}`;
      }
      if (tree[accumulator]) {
        ensureExpanded(accumulator);
      }
    }
  }, [activePath, ensureExpanded, tree]);

  const handleContextMenu = useCallback(
    (event: MouseEvent, entry: DirectoryEntry) => {
      event.preventDefault();
      event.stopPropagation();
      setContextMenu({
        position: { x: event.clientX, y: event.clientY },
        entry,
      });
    },
    []
  );

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const prefetchDirectory = useCallback(
    (path: string) => {
      if (prefetchedDirectoriesRef.current.has(path)) {
        return;
      }
      if (loadingNodesRef.current.has(path)) {
        return;
      }
      prefetchedDirectoriesRef.current.add(path);
      setLoadingNodes((prev) => {
        const next = new Set(prev);
        next.add(path);
        return next;
      });
      void onLoadChildren(path)
        .catch(() => {
          prefetchedDirectoriesRef.current.delete(path);
        })
        .finally(() => {
          setLoadingNodes((prev) => {
            const next = new Set(prev);
            next.delete(path);
            return next;
          });
        });
    },
    [onLoadChildren]
  );

  const handleToggleDirectory = useCallback(
    async (entry: DirectoryEntry) => {
      if (!entry.is_dir) {
        return;
      }
      const path = entry.path;

      if (expanded.has(path)) {
        setExpanded((previous) => {
          if (!previous.has(path)) {
            return previous;
          }
          const next = new Set(previous);
          next.delete(path);
          return next;
        });
        return;
      }

      ensureExpanded(path);

      if (!tree[path]) {
        setLoadingNodes((prev) => {
          const next = new Set(prev);
          next.add(path);
          return next;
        });
        await onLoadChildren(path);
        setLoadingNodes((prev) => {
          const next = new Set(prev);
          next.delete(path);
          return next;
        });
      }
    },
    [ensureExpanded, expanded, onLoadChildren, tree]
  );

  const renderEntries = useCallback(
    (entries: DirectoryEntry[], depth = 0, skipModified = false) =>
      entries
        .filter((entry) => {
          // Filtra per query search
          if (!fuzzyMatch(query, entry.name)) return false;
          // Se skipModified è true, nascondi i file modificati (già mostrati sopra)
          if (skipModified && !entry.is_dir && modifiedFilesMap.has(entry.path))
            return false;
          return true;
        })
        .map((entry) => {
          const isDirectory = entry.is_dir;
          const isExpanded = expanded.has(entry.path);
          const isLoadingNode = loadingNodes.has(entry.path);
          const isActiveDirectory = activePath === entry.path;
          const isActiveFile = activeFilePath === entry.path;
          const childEntries = isDirectory ? tree[entry.path] : undefined;
          if (isDirectory && !childEntries) {
            prefetchDirectory(entry.path);
          }
          const fileCount = childEntries
            ? childEntries.reduce(
                (count, child) => (child.is_dir ? count : count + 1),
                0
              )
            : null;
          const displayCount = childEntries
            ? fileCount
            : isDirectory && isLoadingNode
              ? "…"
              : null;
          const paddingLeft = 12 + depth * 14;

          const rowClass = [
            "explorer-row",
            isDirectory ? "directory" : "file",
            isActiveDirectory || isActiveFile ? "active" : "",
            isActiveFile ? "file-open" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <Fragment key={entry.path}>
              <button
                type="button"
                className={rowClass}
                style={{ paddingLeft: `${paddingLeft}px` }}
                title={entry.name}
                onClick={() => {
                  if (isDirectory) {
                    void handleToggleDirectory(entry);
                  } else {
                    onOpenFile(entry);
                  }
                }}
                onContextMenu={(event) => handleContextMenu(event, entry)}
              >
                <span
                  className={`explorer-expander ${
                    isDirectory ? (isExpanded ? "open" : "") : "placeholder"
                  } ${isLoadingNode ? "loading" : ""}`}
                  onClick={(event) => {
                    if (!isDirectory) {
                      return;
                    }
                    event.stopPropagation();
                    void handleToggleDirectory(entry);
                  }}
                  aria-hidden="true"
                />
                <span
                  className={`explorer-icon ${
                    isDirectory
                      ? "folder"
                      : entry.is_symlink
                        ? "symlink"
                        : "file"
                  }`}
                  aria-hidden="true"
                />
                <span className="explorer-name">{entry.name}</span>
                {isDirectory && displayCount !== null && (
                  <span className="explorer-count" aria-hidden="true">
                    {displayCount}
                  </span>
                )}
              </button>
              {isDirectory &&
                isExpanded &&
                tree[entry.path] &&
                tree[entry.path].length > 0 &&
                renderEntries(tree[entry.path], depth + 1, skipModified)}
            </Fragment>
          );
        }),
    [
      activeFilePath,
      activePath,
      expanded,
      handleContextMenu,
      handleToggleDirectory,
      loadingNodes,
      modifiedFilesMap,
      onOpenFile,
      prefetchDirectory,
      query,
      tree,
    ]
  );

  const renderModifiedFile = useCallback(
    (item: {
      entry: DirectoryEntry;
      gitEntry: GitStatusEntry;
      displayPath: string;
    }) => {
      const { entry, gitEntry, displayPath } = item;
      const isActiveFile = activeFilePath === entry.path;
      const additions = gitEntry.additions ?? 0;
      const deletions = gitEntry.deletions ?? 0;
      const hasStats = additions > 0 || deletions > 0;
      const isNewFile = gitEntry.is_untracked;

      const rowClass = [
        "explorer-row",
        "file",
        isNewFile ? "new-file" : "modified",
        isActiveFile ? "active file-open" : "",
      ]
        .filter(Boolean)
        .join(" ");

      const iconClass = isNewFile ? "explorer-icon file-new" : "explorer-icon file-modified";

      return (
        <button
          key={entry.path}
          type="button"
          className={rowClass}
          style={{ paddingLeft: "12px" }}
          title={displayPath}
          onClick={() => onOpenFile(entry)}
          onContextMenu={(event) => handleContextMenu(event, entry)}
        >
          <span className="explorer-expander placeholder" aria-hidden="true" />
          <span className={iconClass} aria-hidden="true" />
          <span className="explorer-name">{displayPath}</span>
          {hasStats && (
            <span className="explorer-git-stats">
              {additions > 0 && <span className="additions">+{additions}</span>}
              {deletions > 0 && <span className="deletions">-{deletions}</span>}
            </span>
          )}
        </button>
      );
    },
    [activeFilePath, handleContextMenu, onOpenFile]
  );

  return (
    <aside className="file-explorer">
      <div className="explorer-header">
        <h2 className="explorer-title">Esplora file</h2>
        <span className="explorer-path">{activePath}</span>
        {error && <span className="explorer-error">{error}</span>}
        <input
          className="explorer-search"
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cerca file o cartelle"
        />
      </div>

      <div className={`explorer-content ${loading ? "loading" : ""}`}>
        {rootPath && <div className="explorer-root-label">{rootLabel}</div>}
        {(!rootEntries || rootEntries.length === 0) && !loading ? (
          <div className="empty-state">Cartella vuota</div>
        ) : (
          <div className="explorer-tree">
            {/* Modified Files Group */}
            {allModifiedFiles.length > 0 && (
              <div className="explorer-section modified-files-section">
                <div className="explorer-section-header">
                  <span className="explorer-section-title">
                    File modificati
                  </span>
                  <span className="explorer-section-count">
                    {allModifiedFiles.length}
                  </span>
                </div>
                <div className="explorer-section-content">
                  {allModifiedFiles
                    .filter((item) => fuzzyMatch(query, item.displayPath))
                    .map((item) => renderModifiedFile(item))}
                </div>
              </div>
            )}

            {/* Normal Files Tree */}
            {rootEntries && rootEntries.length > 0 && (
              <div className="explorer-section">
                {rootEntries && renderEntries(rootEntries, 0, true)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <FileContextMenu
          position={contextMenu.position}
          entry={contextMenu.entry}
          onClose={closeContextMenu}
        />
      )}
    </aside>
  );
}

// Performance: Memo per evitare re-render quando cambiano solo terminali/git status
export default memo(FileExplorer, (prevProps, nextProps) => {
  // Re-render solo se tree, modifiedEntries, activePath o activeFilePath cambiano
  if (prevProps.rootPath !== nextProps.rootPath) return false
  if (prevProps.loading !== nextProps.loading) return false
  if (prevProps.error !== nextProps.error) return false
  if (prevProps.activePath !== nextProps.activePath) return false
  if (prevProps.activeFilePath !== nextProps.activeFilePath) return false
  if (prevProps.gitRootPath !== nextProps.gitRootPath) return false

  // Check tree shallow (keys changed?)
  const prevKeys = Object.keys(prevProps.tree)
  const nextKeys = Object.keys(nextProps.tree)
  if (prevKeys.length !== nextKeys.length) return false

  // Performance: Check array identity invece di length (molto più efficace)
  // Con stableModifiedEntries da App.tsx, reference cambia solo quando entries cambiano davvero
  if (prevProps.modifiedEntries !== nextProps.modifiedEntries) return false

  // Callbacks stabili da App.tsx
  return true
})
