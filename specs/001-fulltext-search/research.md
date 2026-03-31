# Research: Fulltext Search in File Explorer

**Feature**: 001-fulltext-search | **Date**: 2026-03-30

## Key Findings

### 1. Existing Search Infrastructure

**Decision**: Extend `src-tauri/src/fs.rs` with a new `search_in_files` command alongside the existing `search_files_recursive`.

**Rationale**: `fs.rs` already has a `search_files_recursive` command that does filename-based fuzzy search using `walkdir`. The pattern (public command → `_impl` function → `Result<T, String>`) is well established. Adding content search follows the same pattern.

**Alternatives considered**:
- New `search.rs` module → rejected, `fs.rs` owns all filesystem operations
- Reusing `search_files_recursive` → rejected, it does filename matching not content search

### 2. Dependencies Already Available

**Decision**: Use `walkdir` (already in Cargo.toml) + `rayon` (already in Cargo.toml). Add `ignore` crate for .gitignore support.

**Rationale**: Two of three needed crates are already dependencies. The `ignore` crate (from BurntSushi, same author as ripgrep) provides WalkBuilder that combines directory walking with .gitignore filtering in one step — it replaces `walkdir` for this use case.

**Alternatives considered**:
- Shell out to `rg` binary → rejected, external dependency, may not be installed
- Manual .gitignore parsing → rejected, complex and error-prone
- Keep `walkdir` only → rejected, no built-in gitignore support

### 3. TypeScript Types

**Decision**: Add `ContentSearchResult` type to `src/types.ts` (distinct from existing `SearchResult` which is for filename search).

**Rationale**: Existing `SearchResult` extends `DirectoryEntry` and is designed for filename matching with `score` and `depth`. Content search needs `line_number`, `line_content`, `match_start`, `match_end` — different enough to warrant a separate type.

### 4. UI Component Placement

**Decision**: Add a simple tab switcher (Files/Search) inside FileExplorer header. Search panel is a new `FileSearchPanel.tsx` component rendered when search tab is active.

**Rationale**: FileExplorer doesn't have tabs yet. The app-level TabBar manages main content tabs. A simple inline toggle in the explorer header (not a full tab bar) keeps it lightweight — like VSCode's sidebar activity bar icons.

### 5. Tab Switcher vs Search Input

**Decision**: Two-state toggle in explorer header: 📁 Files | 🔍 Search. When Search is active, show search input + results instead of file tree.

**Rationale**: VSCode uses sidebar icons to switch between file explorer and search. A simple toggle is simpler than a full tab system and fits the existing panel layout.

### 6. File Opening at Line

**Decision**: Extend existing `onOpenFile` callback to accept an optional `lineNumber` parameter. The file viewer/preview will scroll to that line.

**Rationale**: The file preview mechanism already exists. Adding line number support is a minor enhancement.
