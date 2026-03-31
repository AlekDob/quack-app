# Implementation Plan: Fulltext Search in File Explorer

**Branch**: `001-fulltext-search` | **Date**: 2026-03-30 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-fulltext-search/spec.md`

## Summary

Add fulltext content search to Quack's File Explorer panel. A new "Search" tab alongside the existing "Files" tab lets users search inside file contents across the project directory. Results are grouped by file with line numbers, match highlights, and click-to-navigate. Backend uses Rust with `walkdir` + `rayon` for parallel filesystem search. Frontend adds a search UI component with debounced input and collapsible file groups.

## Technical Context

**Language/Version**: Rust 1.75+ (Tauri backend), TypeScript strict (React frontend)
**Primary Dependencies**: Tauri v2, walkdir, rayon, ignore (gitignore support), React 18, Zustand
**Storage**: Local filesystem (read-only search, no persistence needed)
**Testing**: Manual testing (existing project pattern), TypeScript type checking
**Target Platform**: macOS desktop (Tauri), Windows desktop (Tauri)
**Project Type**: Desktop application (Tauri + React)
**Performance Goals**: <2s for 10k files, <500ms for <1k files
**Constraints**: Max 200 results returned, skip files >10MB, skip binaries, respect .gitignore
**Scale/Scope**: Single project directory, typical codebase 1k-50k files

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. AI-First Architecture | ✅ PASS | Search enhances AI workflows — same backend can serve tool calling |
| II. Tauri + React Full-Stack | ✅ PASS | Rust command + React UI, no external dependencies |
| III. Domain-Driven Organization | ✅ PASS | Feature fits in FileExplorer domain |
| IV. Code Quality Gates | ✅ PASS | Will follow 20-line fn, 300-line file, strict TS |
| V. Knowledge-Driven Development | ✅ PASS | Will document in Brain + diary |
| VI. Simplicity Over Cleverness | ✅ PASS | Plain text search first, no regex in MVP |
| VII. User Experience First | ✅ PASS | VSCode-familiar UI pattern, instant feedback |

**Gate result: ALL PASS — proceed to Phase 0.**

## Project Structure

### Documentation (this feature)

```text
specs/001-fulltext-search/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (Tauri command interface)
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
src-tauri/src/
├── commands/
│   └── search.rs        # NEW: search_in_files Tauri command
└── lib.rs               # Register new command

src/
├── components/
│   ├── FileExplorer.tsx  # MODIFY: add Search tab switcher
│   └── FileSearchPanel.tsx  # NEW: search UI component (~250 lines)
├── types/
│   └── index.ts          # MODIFY: add SearchResult type
└── App.css               # MODIFY: search result styles
```

**Structure Decision**: Single project, extending existing FileExplorer domain. One new Rust module, one new React component, minimal modifications to existing files.

## Complexity Tracking

No constitution violations. No complexity justifications needed.
