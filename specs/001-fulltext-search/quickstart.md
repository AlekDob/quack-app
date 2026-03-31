# Quickstart: Fulltext Search Implementation

**Feature**: 001-fulltext-search | **Date**: 2026-03-30

## Prerequisites

- Rust toolchain (already configured for Tauri)
- Node.js 18.17.0 + npm (already configured)
- Quack development environment running

## Implementation Order

### Step 1: Rust Backend (search command)

1. Add `ignore` crate to `src-tauri/Cargo.toml`:
   ```toml
   ignore = "0.4"
   ```

2. Add `search_in_files` command to `src-tauri/src/fs.rs`:
   - Use `ignore::WalkBuilder` (respects .gitignore)
   - Use `rayon::par_iter()` for parallel file reading
   - Binary detection: check first 8KB for null bytes
   - Collect results up to `max_results` cap

3. Register command in `src-tauri/src/lib.rs` (`generate_handler!`)

4. Verify: `cargo build` passes

### Step 2: TypeScript Types

1. Add `ContentSearchResult` and `ContentSearchResponse` to `src/types.ts`

### Step 3: React Search Panel

1. Create `src/components/FileSearchPanel.tsx`:
   - Search input with 300ms debounce
   - Results grouped by file (collapsible)
   - Match highlighting in line content
   - Click handler → `onOpenFile(entry, lineNumber)`

2. Modify `src/components/FileExplorer.tsx`:
   - Add explorerMode state ('files' | 'search')
   - Add tab switcher in header (📁 / 🔍 icons)
   - Conditionally render FileSearchPanel or file tree

### Step 4: Styles

1. Add search result styles to `src/App.css` or `FileExplorer.compact.css`

### Step 5: Wire click-to-line

1. Extend file preview mechanism to accept `lineNumber` parameter
2. Connect search result click → open file at line

## Verification

- Type a search query → results appear in <2s
- Click a result → file opens at correct line
- Binary files and .gitignore'd files are excluded
- Clearing input → results clear
- Modifying query while searching → previous search cancelled
