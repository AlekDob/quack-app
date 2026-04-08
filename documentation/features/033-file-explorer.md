---
type: feature-doc
project: quack-app
stack: Tauri (Rust + React 18)
created: 2026-04-03
last_verified: 2026-04-08
tags: [file-explorer, file-tree, search, context-menu, drag-drop, mention, modified-files, sort-by-modified, folder-drag]
---

## File Explorer
**Purpose:** Interactive file tree browser with recursive search, context menu, drag-and-drop to chat, @mention support, modified file indicators, auto-refresh, and configurable sort order (name or modification date).
**Stack:** React 18, TypeScript strict, Tauri v2 invoke API, vscode-icons-js

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Component | `src/components/FileExplorer.tsx` | Main tree browser with search, expand/collapse, drag-drop, modified indicators (863 lines) |
| Component | `src/components/FileContextMenu.tsx` | Right-click context menu: Open in IDE, Reveal in Finder, Copy Path (145 lines) |
| Component | `src/components/FileIcon.tsx` | VSCode-style file/folder icons via vscode-icons-js CDN (41 lines) |
| Component | `src/components/RevealInFinderButton.tsx` | Cross-platform "Reveal in Finder/Explorer" button (54 lines) |
| Component | `src/components/OpenInIDEButton.tsx` | "Open in IDE" button, hidden when no IDE configured (60 lines) |
| Config | `src/components/FileExplorer.compact.css` | VSCode-style compact theme, modified file indicators, tree indent guides (315 lines) |
| Model/Type | `src/types.ts` | `DirectoryEntry`, `SearchResult`, `GitStatusEntry`, `DirectoryListing` |
| Store/State | `src/stores/ideStore.ts` | `useIDEStore` — preferred IDE config, `openFileInIDE()`, `selectHasPreferredIDE` |
| Util | `src/utils/platform.ts` | `cleanPath()`, `getFileManagerName()` — cross-platform path/OS helpers |
| Service (Rust) | `src-tauri/src/fs.rs` | `list_directory()`, `search_files_recursive()`, `list_directory_files()` — filesystem commands |
| Service (Rust) | `src-tauri/src/reveal.rs` | `reveal_in_finder()`, `open_external_url()` — OS-native file reveal |
| Route/Page | `src/App.tsx` | Hosts FileExplorer, provides `fetchDirectoryChildren`, `handleMentionFile`, `modifiedFiles` state |

### Data Flow
- **Tree browsing:** `App.tsx (rootPath)` → `invoke('list_directory')` → `fs.rs` → `DirectoryEntry[]` → `FileExplorer tree state`
- **Recursive search:** `FileExplorer (query, debounce 300ms)` → `invoke('search_files_recursive')` → `fs.rs` → `SearchResult[]` → hierarchical grouping → render
- **Context menu:** `Right-click on row` → `FileContextMenu (portal)` → `invoke('reveal_in_finder')` / `ideStore.openFileInIDE()` / `navigator.clipboard`
- **Drag-and-drop:** `File/folder row dragStart` → `application/quack-file` JSON (includes `isDir` flag) + `text/plain` fallback → `SplitDropZone` (Left/Right/Chat) or `ChatInput drop handler`
- **@mention:** `FileExplorer (@button click)` → `onMentionFile(path, name, isDir)` → `App.tsx handleMentionFile` → inserts into chat input
- **Modified files:** `App.tsx modifiedFiles Map` → `FileExplorer` → colored dot indicator + row background highlight (green/blue/red)
- **Auto-refresh:** `setInterval(10s)` → reload up to 5 expanded directories → `onLoadChildren()` silently

### Key Functions
- `FileExplorer(props: FileExplorerProps) → JSX` — main component with tree rendering, search, expand/collapse, configurable sort
- `sortEntries(entries: DirectoryEntry[]) → DirectoryEntry[]` — sorts entries by name (default) or modified_at descending; dirs always first
- `fuzzyMatch(query: string, target: string) → boolean` — character-by-character fuzzy matching for local filter
- `concatPath(base: string, relative: string) → string` — cross-platform path concatenation with normalization
- `prefetchDirectory(path: string) → void` — eagerly loads directory children on first visibility
- `handleToggleDirectory(entry: DirectoryEntry) → void` — expand/collapse with lazy loading
- `handleDragStart(event: DragEvent, entry: DirectoryEntry) → void` — sets `application/quack-file` drag data with `{ type, name, path, isDir }` JSON payload; works for both files and directories
- `renderEntries(entries: DirectoryEntry[], depth: number) → JSX[]` — recursive tree renderer with indent guides
- `renderSearchResultHierarchy() → JSX` — groups search results by parent folder with collapsible headers
- `list_directory(path: Option<String>) → Result<DirectoryListing>` — Rust: reads directory entries sorted (dirs first), includes `modified_at` epoch seconds
- `search_files_recursive(path, query, max_results, max_depth) → Result<Vec<SearchResult>>` — Rust: recursive filename search with scoring
- `reveal_in_finder(path: String) → Result<()>` — Rust: OS-native file manager reveal (macOS `open -R`, Windows `explorer /select,`)

### State
- `expanded`: `Set<string>` — currently expanded directory paths (component)
- `loadingNodes`: `Set<string>` — directories being loaded (component)
- `query`: `string` — search input value (component)
- `searchResults`: `SearchResult[]` — results from Rust backend search (component)
- `isSearching`: `boolean` — search in progress flag (component)
- `contextMenu`: `{ position, entry } | null` — right-click menu state (component)
- `expandedSearchFolders`: `Set<string>` — expanded folders in search results view (component)
- `prefetchedDirectoriesRef`: `Set<string>` — tracks already-prefetched dirs to avoid duplicate loads (component)
- `modifiedFiles`: `Map<string, 'created' | 'modified' | 'deleted'>` — file change tracking from parent (global)
- `tree`: `Record<string, DirectoryEntry[]>` — cached directory listings from App.tsx (global)

### External Dependencies
- `vscode-icons-js`: file/folder icon resolution by filename → CDN URL (`cdn.jsdelivr.net`)
- `@tauri-apps/api/core`: `invoke()` for Rust command calls
- `sonner`: toast notifications on reveal failures
- `react-dom`: `createPortal` for context menu overlay

### Props
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `rootPath` | `string \| null` | -- | Root directory to explore |
| `tree` | `Record<string, DirectoryEntry[]>` | -- | Cached directory tree (path-keyed) |
| `loading` | `boolean` | -- | Loading indicator |
| `error` | `string \| null` | -- | Error message |
| `activePath` | `string` | -- | Currently active directory |
| `activeFilePath` | `string \| null` | -- | Currently open file |
| `onOpenFile` | `(entry: DirectoryEntry) => void` | -- | File open callback |
| `onLoadChildren` | `(path: string) => Promise<DirectoryEntry[]>` | -- | Load directory contents |
| `onMentionFile` | `(path, name, isDir) => void` | -- | @mention callback (optional) |
| `modifiedFiles` | `Map<string, status>` | -- | Modified file indicators (optional) |
| `sortBy` | `'name' \| 'modified'` | `'name'` | Sort order: alphabetical or newest-first |

### DirectoryEntry (Rust → TypeScript)
| Field | Rust | TypeScript | Description |
|-------|------|------------|-------------|
| `name` | `String` | `string` | File/folder display name |
| `path` | `String` | `string` | Full absolute path |
| `is_dir` | `bool` | `boolean` | Is directory flag |
| `is_symlink` | `bool` | `boolean` | Is symlink flag |
| `modified_at` | `Option<u64>` | `number?` | Seconds since UNIX epoch (mtime) |

### Config
- `AUTO_REFRESH_INTERVAL`: 10 seconds (hardcoded in FileExplorer useEffect)
- `MAX_REFRESH_DIRS`: 5 directories per refresh cycle
- `SEARCH_DEBOUNCE`: 300ms debounce before invoking Rust search
- `SEARCH_MAX_RESULTS`: 100 results cap
- `SEARCH_MAX_DEPTH`: 10 directory levels deep
