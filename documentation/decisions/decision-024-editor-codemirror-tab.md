---
type: decision
project: quack-app
created: 2026-04-02
last_verified: 2026-04-02
tags: [editor, codemirror, tab, architecture]
---

# Decision: CodeMirror Tab for Integrated Code Editor

## Context

Quack needs an integrated code editor tab so users can view, edit, and diff files without leaving the app. Two key architectural decisions were required:

1. **Editor engine**: CodeMirror 6 vs Monaco Editor
2. **Layout**: Tab-based vs split-panel

## Decision 1: CodeMirror 6

**Chosen**: CodeMirror 6

**Rationale**:
- Quack already ships 12 `@codemirror/*` packages with a mature 727-line editor component
- Monaco would add ~4 MB to the bundle size
- Monaco requires CDN or complex bundling, incompatible with Tauri's offline-first model
- CodeMirror integrates natively with our existing theme, syntax highlighting, and search infrastructure
- Only one new dependency needed: `@codemirror/merge` (~15 KB gzipped) for side-by-side diff

**Rejected**: Monaco Editor — too heavy, CDN dependency, not suited for offline desktop app.

## Decision 2: Tab-Based Layout

**Chosen**: Singleton tab pattern (same as Kanban, Automation, Office)

**Rationale**:
- Quack's tab system is a proven, consistent pattern with existing hooks (`useKanbanTab`, `useAutomationTab`, `useOfficeTab`)
- Split-panel would require significant layout rework and add complexity to an already large App.tsx
- Singleton ensures only one editor instance exists, simplifying state management
- Users can switch between chat and editor with a keyboard shortcut (Cmd+E)

**Rejected**: Split-panel — would break existing layout patterns and increase complexity.
