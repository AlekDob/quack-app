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
import OpenInIDEButton from "./OpenInIDEButton";
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

  // Auto-refresh: Reload expanded directories every 10 seconds (reduced from 3s)
  useEffect(() => {
    if (!rootPath) {
      return;
    }

    const interval = setInterval(() => {
      // Reload expanded directories to detect filesystem changes
      const expandedPaths = Array.from(expanded);

      // Limit to max 5 directories per refresh to reduce load
      const pathsToRefresh = expandedPaths.slice(0, 5);

      for (const path of pathsToRefresh) {
        // Skip if already loading
        if (loadingNodes.has(path)) {
          continue;
        }
        // Reload directory silently
        void onLoadChildren(path).catch(() => {
          // Ignore errors during auto-refresh
        });
      }
    }, 10000); // Refresh every 10 seconds (increased from 3s)

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
                  <OpenInIDEButton path={entry.path} iconOnly />
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

  // State for expanded folders in search results
  const [expandedSearchFolders, setExpandedSearchFolders] = useState<Set<string>>(new Set());

  // Build hierarchical structure from search results
  const hierarchicalSearchResults = useMemo(() => {
    if (!searchResults.length || !rootPath) return [];

    // Group results by parent folder
    const folderMap = new Map<string, SearchResult[]>();

    for (const result of searchResults) {
      if (!result.relative_path) continue;

      // Extract parent folder path
      const pathParts = result.relative_path.split('/');
      const parentPath = pathParts.slice(0, -1).join('/') || '/';

      if (!folderMap.has(parentPath)) {
        folderMap.set(parentPath, []);
      }
      folderMap.get(parentPath)!.push(result);
    }

    // Sort folders by depth (shallowest first)
    const sortedFolders = Array.from(folderMap.keys()).sort((a, b) => {
      const depthA = a === '/' ? 0 : a.split('/').length;
      const depthB = b === '/' ? 0 : b.split('/').length;
      return depthA - depthB;
    });

    // Build hierarchical structure
    interface HierarchicalNode {
      type: 'folder' | 'file';
      name: string;
      path: string;
      relativePath: string;
      depth: number;
      result?: SearchResult;
      children?: SearchResult[];
    }

    const nodes: HierarchicalNode[] = [];

    for (const folderPath of sortedFolders) {
      const files = folderMap.get(folderPath)!;
      const depth = folderPath === '/' ? 0 : folderPath.split('/').filter(Boolean).length;

      // Get folder name
      const folderName = folderPath === '/'
        ? rootLabel
        : folderPath.split('/').filter(Boolean).pop() || folderPath;

      // Add folder node
      nodes.push({
        type: 'folder',
        name: folderName,
        path: folderPath,
        relativePath: folderPath,
        depth,
        children: files,
      });
    }

    return nodes;
  }, [searchResults, rootPath, rootLabel]);

  // Auto-expand all folders when search results change
  useEffect(() => {
    if (hierarchicalSearchResults.length > 0) {
      const allFolders = new Set(hierarchicalSearchResults.map(node => node.path));
      setExpandedSearchFolders(allFolders);
    } else {
      setExpandedSearchFolders(new Set());
    }
  }, [hierarchicalSearchResults]);

  const renderSearchResultHierarchy = useCallback(() => {
    if (!hierarchicalSearchResults.length) return null;

    return hierarchicalSearchResults.map((node) => {
      if (node.type === 'folder') {
        const isExpanded = expandedSearchFolders.has(node.path);
        const paddingLeft = 8 + node.depth * 10;

        return (
          <Fragment key={node.path}>
            {/* Folder header */}
            <button
              type="button"
              className="explorer-row directory"
              style={{ paddingLeft: `${paddingLeft}px` }}
              onClick={() => {
                setExpandedSearchFolders((prev) => {
                  const next = new Set(prev);
                  if (next.has(node.path)) {
                    next.delete(node.path);
                  } else {
                    next.add(node.path);
                  }
                  return next;
                });
              }}
            >
              <span
                className={`explorer-expander ${isExpanded ? 'open' : ''}`}
                aria-hidden="true"
              />
              <FileIcon
                name={node.name}
                isDirectory={true}
                isOpen={isExpanded}
                size={16}
              />
              <span className="explorer-name">{node.name}</span>
              <span className="explorer-count" aria-hidden="true">
                {node.children?.length || 0}
              </span>
            </button>

            {/* Files under this folder */}
            {isExpanded && node.children?.map((result) => {
              const isActiveFile = activeFilePath === result.path;
              const entry: DirectoryEntry = {
                name: result.name,
                path: result.path,
                is_dir: result.is_dir,
                is_symlink: result.is_symlink,
              };

              const rowClass = [
                "explorer-row",
                "file",
                isActiveFile ? "active file-open" : "",
              ]
                .filter(Boolean)
                .join(" ");

              const filePaddingLeft = 8 + (node.depth + 1) * 10;

              return (
                <button
                  key={result.path}
                  type="button"
                  className={rowClass}
                  style={{ paddingLeft: `${filePaddingLeft}px` }}
                  title={result.relative_path}
                  onClick={() => onOpenFile(entry)}
                  onContextMenu={(event) => handleContextMenu(event, entry)}
                  draggable={true}
                  onDragStart={(event) => handleDragStart(event, entry)}
                >
                  <span className="explorer-expander placeholder" aria-hidden="true" />
                  <FileIcon
                    name={result.name}
                    isDirectory={false}
                    isOpen={false}
                    size={16}
                  />
                  <span className="explorer-name">{result.name}</span>
                  <div className="explorer-file-actions">
                    <OpenInIDEButton path={result.path} iconOnly />
                    <RevealInFinderButton path={result.path} iconOnly />
                    {onMentionFile && (
                      <button
                        type="button"
                        className="explorer-mention-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onMentionFile(result.path, result.name);
                        }}
                        title="Insert @file mention in chat"
                        aria-label="Mention file in chat"
                      >
                        @
                      </button>
                    )}
                  </div>
                </button>
              );
            })}
          </Fragment>
        );
      }

      return null;
    });
  }, [
    hierarchicalSearchResults,
    expandedSearchFolders,
    activeFilePath,
    onOpenFile,
    handleContextMenu,
    handleDragStart,
    onMentionFile,
  ]);

  return (
    <aside className="file-explorer">
      {/* Header - matching other panels pattern */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-white/10">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">File Explorer</h3>
          <div className="flex items-center gap-1">
            {/* Refresh button */}
            <button
              type="button"
              onClick={() => activePath && onLoadChildren?.(activePath)}
              disabled={loading}
              className="p-1.5 text-white/50 hover:text-white hover:bg-white/5 rounded-lg transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            {/* Reveal in Finder button - larger */}
            {activePath && (
              <button
                type="button"
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    const { invoke } = await import('@tauri-apps/api/core');
                    await invoke('reveal_in_finder', { path: activePath });
                  } catch (err) {
                    console.error('Failed to reveal in Finder:', err);
                  }
                }}
                className="p-1.5 text-white/50 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                title="Reveal in Finder"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </button>
            )}
          </div>
        </div>
        <span className="explorer-path">{activePath}</span>
        {error && <span className="explorer-error">{error}</span>}

        {/* Search - with icon, matching other panels */}
        <div className="relative mt-2">
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search files or folders"
            className="w-full px-3 py-2 pl-8 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
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
                {renderSearchResultHierarchy()}
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
