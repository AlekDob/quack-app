# Implementation Plan: Changes Panel — Branch Info & Commit History Tab

**Branch**: `003-changes-panel-branch-commits` | **Date**: 2026-03-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-changes-panel-branch-commits/spec.md`

## Summary

Add a persistent "context bar" above the tab row in ChangesPanel showing the current branch/worktree, and add a third "History" tab that reuses the GitTimelineItem component (currently inline in GitPanel.tsx) to display commit history without duplicating code.

## Technical Context

**Language/Version**: TypeScript strict (React 18 frontend), Rust 1.75+ (Tauri v2 backend)
**Primary Dependencies**: React 18, Zustand, Tauri v2 invoke API
**Storage**: N/A (reads from Git via Tauri commands)
**Testing**: Manual testing (Quack standard for UI features)
**Target Platform**: macOS / Windows (Tauri desktop)
**Project Type**: Desktop app (Tauri + React)
**Performance Goals**: Branch display < 1s, history load < 3s for 500 commits
**Constraints**: Files < 300 lines, functions < 20 lines, no code duplication
**Scale/Scope**: Single panel enhancement, ~4 files modified/created

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. AI-First Architecture | ✅ PASS | Enhances agent workflow visibility |
| II. Tauri + React Full-Stack | ✅ PASS | React frontend, Tauri invoke for git |
| III. Domain-Driven Organization | ✅ PASS | Changes in components/ (shared UI domain) |
| IV. Code Quality Gates | ✅ PASS | Will extract shared component, enforce size limits |
| V. Knowledge-Driven Development | ✅ PASS | Will add diary entry + Brain breadcrumbs |
| VI. Simplicity Over Cleverness | ✅ PASS | Reusing existing component, prop-passing pattern |
| VII. User Experience First | ✅ PASS | Branch context prevents wrong-branch commits |

**Gate result**: ALL PASS — proceeding to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/003-changes-panel-branch-commits/
├── spec.md
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
src/
├── components/
│   ├── ChangesPanel.tsx       # MODIFY: add context bar + history tab + new props
│   ├── ChangesPanel.css       # MODIFY: add context-bar + history styles
│   ├── GitTimelineItem.tsx    # CREATE: extract from GitPanel.tsx into shared module
│   └── GitPanel.tsx           # MODIFY: import GitTimelineItem from new shared module
└── types.ts                   # NO CHANGE: GitCommitEntry already exported
```

**Structure Decision**: Minimal change footprint. Extract `GitTimelineItem` as the only new file. Modify 3 existing files. No new directories needed.

## Complexity Tracking

No constitution violations. No complexity justification needed.
