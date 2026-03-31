# Feature Specification: Fulltext Search in File Explorer

**Feature Branch**: `001-fulltext-search`
**Created**: 2026-03-30
**Status**: Draft
**Input**: User description: "Fulltext search nel File Explorer di Quack. L'utente vuole cercare dentro il contenuto dei file (non solo il nome), con UI simile a VSCode. Stack: Tauri (Rust backend con walkdir + rayon) + React frontend."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Basic Content Search (Priority: P1)

As a developer using Quack, I want to search inside the contents of all files in my project directory so that I can quickly find where a specific string or pattern appears across my codebase.

**Why this priority**: This is the core value proposition — searching file contents is the fundamental capability. Without this, no other search feature matters.

**Independent Test**: Can be fully tested by typing a search query in the search input and verifying that matching file results appear with line numbers and content previews.

**Acceptance Scenarios**:

1. **Given** a project with multiple files open in the File Explorer, **When** the user switches to the Search tab and types a query (e.g., "loadDirectory"), **Then** results appear grouped by file, showing matching line numbers and content snippets with the match highlighted.
2. **Given** a search query is entered, **When** the user waits 300ms after typing (debounce), **Then** the search executes automatically without requiring a button press.
3. **Given** a search query that matches content in deeply nested subdirectories, **When** results are displayed, **Then** files from all directory depths are included in the results.
4. **Given** a search query that produces no matches, **When** results are displayed, **Then** a "No results found" message is shown.

---

### User Story 2 - Navigate to Match (Priority: P1)

As a developer, I want to click on a search result and have the file open at the exact matching line so that I can immediately see the code in context.

**Why this priority**: Search results are useless without the ability to jump to them. This is tightly coupled with P1 and essential for a complete search experience.

**Independent Test**: Can be tested by performing a search, clicking a result, and verifying the file opens at the correct line.

**Acceptance Scenarios**:

1. **Given** a list of search results, **When** the user clicks on a specific result line, **Then** the file opens in the file viewer/editor at that exact line number.
2. **Given** a search result for a file already open, **When** the user clicks the result, **Then** the viewer scrolls to the matching line.

---

### User Story 3 - Search Performance and Filtering (Priority: P2)

As a developer working on a large project (10,000+ files), I want the search to be fast and to automatically skip irrelevant files (binaries, node_modules, .git) so that results are relevant and appear quickly.

**Why this priority**: Performance and smart filtering make the difference between a usable and unusable search. Important for daily use but not required for an initial working prototype.

**Independent Test**: Can be tested by searching in a large project directory and verifying results appear quickly without binary file matches or .gitignore'd file matches.

**Acceptance Scenarios**:

1. **Given** a project with 10,000 files, **When** a search query is executed, **Then** results appear within 2 seconds.
2. **Given** a project with a .gitignore file, **When** a search is performed, **Then** files matching .gitignore patterns are excluded from results.
3. **Given** a project containing binary files (images, compiled files), **When** a search is performed, **Then** binary files are automatically skipped.
4. **Given** a search that would produce thousands of matches, **When** results are displayed, **Then** a maximum of 200 results are shown with an indicator that more exist.

---

### User Story 4 - Cancel and Update Search (Priority: P2)

As a developer, I want to be able to modify my search query while a search is running and have the previous search cancelled so that I always see results for my latest query.

**Why this priority**: Important for usability but can work without it in MVP by waiting for searches to complete.

**Independent Test**: Can be tested by typing a query, then immediately modifying it, and verifying only the latest query's results are shown.

**Acceptance Scenarios**:

1. **Given** a search is currently running, **When** the user modifies the query, **Then** the previous search is cancelled and a new search begins.
2. **Given** a search is running, **When** the user clears the search input, **Then** the search is cancelled and results are cleared.

---

### Edge Cases

- What happens when a file is too large to search efficiently (>10MB)? Large files are skipped with no error shown to the user.
- What happens when a file has encoding issues (non-UTF-8)? Non-UTF-8 files are silently skipped.
- What happens when the search query is a single character? A minimum query length of 2 characters is required before search executes.
- What happens when files change during a search? The search operates on a point-in-time snapshot; changed files may show stale results until the next search.
- What happens when the project directory is on a slow network drive? A loading indicator is shown and a reasonable timeout (10 seconds) is applied.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a "Search" tab alongside the existing "Files" tab in the File Explorer panel.
- **FR-002**: System MUST search inside file contents (not just file names) across the entire project directory tree.
- **FR-003**: System MUST display results grouped by file path, with each match showing the line number and line content.
- **FR-004**: System MUST visually highlight the matching portion of text within each result line.
- **FR-005**: System MUST debounce search input with a 300ms delay to avoid excessive searches while typing.
- **FR-006**: System MUST allow users to click a result to open the file at the matching line.
- **FR-007**: System MUST respect .gitignore rules when scanning files.
- **FR-008**: System MUST skip binary files automatically.
- **FR-009**: System MUST cap results at 200 matches to prevent UI overload, showing an indicator when more results exist.
- **FR-010**: System MUST cancel the previous search when the user modifies the query.
- **FR-011**: System MUST show a loading indicator while search is in progress.
- **FR-012**: System MUST require a minimum query length of 2 characters before executing a search.
- **FR-013**: System MUST skip files larger than 10MB.
- **FR-014**: System MUST show a "No results found" message when the query matches nothing.

### Key Entities

- **SearchResult**: A single match within a file — contains the file path (relative to project root), line number, line content text, and the start/end offsets of the match within the line.
- **SearchQuery**: The user's input text and associated state (loading, cancellation, result count).
- **FileGroup**: A grouping of SearchResults by file path for display purposes, showing the file name/path as a collapsible header with match count.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can find a known string across 10,000 files in under 2 seconds.
- **SC-002**: Search results appear within 500ms for projects under 1,000 files.
- **SC-003**: Clicking a search result opens the file at the correct line within 200ms.
- **SC-004**: 100% of binary files and .gitignore'd files are excluded from results.
- **SC-005**: Users can perform a search-and-navigate workflow (type query → click result → view code) in under 5 seconds.

## Assumptions

- The File Explorer panel already has a header area where a tab switcher (Files / Search) can be added.
- The application already has a file viewer/preview mechanism that supports opening files at a specific line.
- The search is case-insensitive by default (matching VSCode behavior).
- The search is plain text by default (no regex support in MVP; can be added later).
- Results show one line of context per match (the matching line only, no surrounding lines in MVP).
