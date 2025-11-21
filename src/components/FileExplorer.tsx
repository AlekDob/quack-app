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
import RevealInFinderButton from "./RevealInFinderButton";
import FileIcon from "./FileIcon";
import "./FileExplorer.compact.css";

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

import type { DirectoryEntry, GitStatusEntry, SearchResult } from "../types";
import { invoke } from "@tauri-apps/api/core";

interface FileExplorerProps {
  rootPath: string | null;
  tree: Record<string, DirectoryEntry[]>;
  loading: boolean;
  error: string | null;
  activePath: string;
  activeFilePath: string | null;
  onOpenFile: (entry: DirectoryEntry) => void;
  onLoadChildren: (path: string) => Promise<DirectoryEntry[]>;
  onMentionFile?: (filePath: string, fileName: string) => void;
  modifiedFiles?: Map<string, 'created' | 'modified' | 'deleted'>; // NEW: Track modified files
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
  onMentionFile,
  modifiedFiles, // NEW: Modified files tracking
}: FileExplorerProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loadingNodes, setLoadingNodes] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    position: { x: number; y: number };
    entry: DirectoryEntry;
  } | null>(null);
  const prefetchedDirectoriesRef = useRef<Set<string>>(new Set());
  const loadingNodesRef = useRef<Set<string>>(new Set());
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // Auto-refresh: Reload expanded directories every 3 seconds
  useEffect(() => {
    if (!rootPath) {
      return;
    }

    const interval = setInterval(() => {
      // Reload all expanded directories to detect filesystem changes
      const expandedPaths = Array.from(expanded);
      for (const path of expandedPaths) {
        // Skip if already loading
        if (loadingNodes.has(path)) {
          continue;
        }
        // Reload directory silently
        void onLoadChildren(path).catch(() => {
          // Ignore errors during auto-refresh
        });
      }
    }, 3000); // Refresh every 3 seconds

    return () => clearInterval(interval);
  }, [rootPath, expanded, loadingNodes, onLoadChildren]);

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

  // Recursive search effect
  useEffect(() => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // If query is empty, clear results
    if (!query.trim() || !rootPath) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    // Debounce search by 300ms
    searchTimeoutRef.current = setTimeout(() => {
      setIsSearching(true);

      invoke<SearchResult[]>("search_files_recursive", {
        path: rootPath,
        query: query.trim(),
        maxResults: 100,
        maxDepth: 10,
      })
        .then((results) => {
          setSearchResults(results);
        })
        .catch((err) => {
          console.error("Search error:", err);
          setSearchResults([]);
        })
        .finally(() => {
          setIsSearching(false);
        });
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query, rootPath]);

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
    (entries: DirectoryEntry[], depth = 0) =>
      entries
        .filter((entry) => {
          // Filtra per query search
          if (!fuzzyMatch(query, entry.name)) return false;
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
          const paddingLeft = 8 + depth * 10; // Reduced from 12 + depth * 14 for compact VSCode style

          // Add modified file background class
          const modificationStatus = !isDirectory && modifiedFiles?.has(entry.path)
            ? modifiedFiles.get(entry.path)
            : null;

          const rowClass = [
            "explorer-row",
            isDirectory ? "directory" : "file",
            isActiveDirectory || isActiveFile ? "active" : "",
            isActiveFile ? "file-open" : "",
            modificationStatus ? `file-modified-${modificationStatus}` : "",
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
                draggable={!isDirectory}
                onDragStart={(event) => handleDragStart(event, entry)}
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
                <FileIcon
                  name={entry.name}
                  isDirectory={isDirectory}
                  isOpen={isExpanded}
                  size={16}
                />
                {/* Show modification indicator for files */}
                {!isDirectory && modifiedFiles?.has(entry.path) && (
                  <span
                    className={`file-modified-indicator file-modified-indicator-${modifiedFiles.get(entry.path)}`}
                    title={`File ${modifiedFiles.get(entry.path)}`}
                  />
                )}
                <span className="explorer-name">{entry.name}</span>
                {isDirectory && displayCount !== null && (
                  <span className="explorer-count" aria-hidden="true">
                    {displayCount}
                  </span>
                )}
                {/* Show actions for both files AND directories */}
                <div className="explorer-file-actions">
                  <RevealInFinderButton path={entry.path} iconOnly />
                  {onMentionFile && (
                    <button
                      type="button"
                      className="explorer-mention-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMentionFile(entry.path, entry.name);
                      }}
                      title={isDirectory ? "Insert @folder mention in chat" : "Insert @file mention in chat"}
                      aria-label={isDirectory ? "Mention folder in chat" : "Mention file in chat"}
                    >
                      @
                    </button>
                  )}
                </div>
              </button>
              {isDirectory &&
                isExpanded &&
                tree[entry.path] &&
                tree[entry.path].length > 0 &&
                renderEntries(tree[entry.path], depth + 1)}
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
      modifiedFiles, // NEW: Include modifiedFiles for reactivity
      onOpenFile,
      prefetchDirectory,
      query,
      tree,
    ]
  );

  const handleDragStart = useCallback((event: React.DragEvent, entry: DirectoryEntry) => {
    // Only allow dragging files, not directories
    if (entry.is_dir) {
      event.preventDefault();
      return;
    }

    // Set the file data for drag & drop
    const fileData = JSON.stringify({
      type: 'file',
      name: entry.name,
      path: entry.path,
    });

    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('application/quack-file', fileData);
    event.dataTransfer.setData('text/plain', entry.path); // Fallback
  }, []);

  const renderSearchResult = useCallback(
    (result: SearchResult) => {
      const isActiveFile = activeFilePath === result.path;

      // Convert SearchResult to DirectoryEntry for compatibility
      const entry: DirectoryEntry = {
        name: result.name,
        path: result.path,
        is_dir: result.is_dir,
        is_symlink: result.is_symlink,
      };

      const rowClass = [
        "explorer-row",
        result.is_dir ? "directory" : "file",
        isActiveFile ? "active file-open" : "",
      ]
        .filter(Boolean)
        .join(" ");

      // Search results - minimal padding for breathing room
      const paddingLeft = 4;

      return (
        <button
          key={result.path}
          type="button"
          className={rowClass}
          style={{ paddingLeft: `${paddingLeft}px` }}
          title={result.relative_path}
          onClick={() => onOpenFile(entry)}
          onContextMenu={(event) => handleContextMenu(event, entry)}
          draggable={!result.is_dir}
          onDragStart={(event) => handleDragStart(event, entry)}
        >
          {/* No expander placeholder for search results - saves space */}
          <FileIcon
            name={result.name}
            isDirectory={result.is_dir}
            isOpen={false}
            size={16}
          />
          <div className="explorer-file-info">
            <span className="explorer-name">{result.name}</span>
            <span className="explorer-path-hint" title={result.relative_path}>
              {result.relative_path}
            </span>
          </div>
          {/* Show actions for both files AND directories */}
          <div className="explorer-file-actions">
            <RevealInFinderButton path={result.path} iconOnly />
            {onMentionFile && (
              <button
                type="button"
                className="explorer-mention-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onMentionFile(result.path, result.name);
                }}
                title={result.is_dir ? "Insert @folder mention in chat" : "Insert @file mention in chat"}
                aria-label={result.is_dir ? "Mention folder in chat" : "Mention file in chat"}
              >
                @
              </button>
            )}
          </div>
        </button>
      );
    },
    [activeFilePath, handleContextMenu, onOpenFile, handleDragStart, onMentionFile]
  );

  return (
    <aside className="file-explorer">
      <div className="explorer-header">
        <div className="explorer-header-top">
          <h2 className="explorer-title">File Explorer</h2>
          {activePath && <RevealInFinderButton path={activePath} iconOnly />}
        </div>
        <span className="explorer-path">{activePath}</span>
        {error && <span className="explorer-error">{error}</span>}
        <input
          className="explorer-search"
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search files or folders"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
      </div>

      <div className={`explorer-content ${loading || isSearching ? "loading" : ""}`}>
        {rootPath && <div className="explorer-root-label">{rootLabel}</div>}

        {/* Show search results when query is active */}
        {query.trim() && searchResults.length > 0 && (
          <div className="explorer-tree">
            <div className="explorer-section search-results-section">
              <div className="explorer-section-header">
                <span className="explorer-section-title">
                  Search Results
                </span>
                <span className="explorer-section-count">
                  {searchResults.length}
                </span>
              </div>
              <div className="explorer-section-content">
                {searchResults.map((result) => renderSearchResult(result))}
              </div>
            </div>
          </div>
        )}

        {/* Show "no results" message when searching but nothing found */}
        {query.trim() && searchResults.length === 0 && !isSearching && (
          <div className="empty-state">No files matching "{query}"</div>
        )}

        {/* Show regular tree when NOT searching */}
        {!query.trim() && (
          <>
            {(!rootEntries || rootEntries.length === 0) && !loading ? (
              <div className="empty-state">Empty folder</div>
            ) : (
              <div className="explorer-tree">
                {/* Normal Files Tree */}
                {rootEntries && rootEntries.length > 0 && (
                  <div className="explorer-section">
                    {rootEntries && renderEntries(rootEntries, 0)}
                  </div>
                )}
              </div>
            )}
          </>
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
  // Re-render solo se tree, activePath o activeFilePath cambiano
  if (prevProps.rootPath !== nextProps.rootPath) return false
  if (prevProps.loading !== nextProps.loading) return false
  if (prevProps.error !== nextProps.error) return false
  if (prevProps.activePath !== nextProps.activePath) return false
  if (prevProps.activeFilePath !== nextProps.activeFilePath) return false

  // Check tree shallow (keys changed?)
  const prevKeys = Object.keys(prevProps.tree)
  const nextKeys = Object.keys(nextProps.tree)
  if (prevKeys.length !== nextKeys.length) return false

  // Callbacks stabili da App.tsx
  return true
})
