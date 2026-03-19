---
type: pattern
project: quack-app
created: 2026-03-19
last_verified: 2026-03-19
tags: [sidebar, git, diff, codex, accordion, commit]
---
# Changes Panel (Codex-style Inline Diffs)

## Overview
First accordion section in the right sidebar (`SidePanelAccordion`). Shows real-time file diffs from the current session with per-file accept/reject and a commit modal.

## Architecture

### Data Flow
```
SDK write events → App.tsx modifiedFiles Map<string, 'created'|'modified'|'deleted'>
  → SidePanelAccordion (props) → ChangesPanel
    → lazy invoke('git_diff', { path, rootPath }) on file expand
    → invoke('git_stage'|'git_discard_file') on accept/reject
    → invoke('git_commit') on commit modal submit
    → onClearModifiedFiles callback to App.tsx after commit
```

### Key Components
| Component | File | Role |
|-----------|------|------|
| ChangesPanel | `src/components/ChangesPanel.tsx` | Main panel: file list, actions, commit modal |
| InlineDiffView | `src/components/InlineDiffView.tsx` | Shared diff renderer (also used by DiffDrawer) |

### Rust Commands
- `git_stage(path, root_path)` — stages a file (pre-existing)
- `git_discard_file(path, is_untracked, root_path)` — unstaged tracked files get `checkout --`, untracked files get `fs::remove_file`
- `git_diff(path, root_path)` — returns diff content (pre-existing)
- `git_commit(message, root_path)` — commits staged files (pre-existing)

## Key Decisions
- **Data source**: Only session `modifiedFiles`, not full worktree — keeps panel focused on current work
- **Reject on new files**: Deletes with ConfirmModal (Brain: gotcha-window-confirm-tauri-webview)
- **Auto-expand**: No — panel shows badge count only, user opens manually
- **Post-commit cleanup**: `onClearModifiedFiles` callback resets parent state to empty Map

## InlineDiffView Compact Mode
The `compact` prop reduces font size and replaces line numbers with colored indicators (green/red dots). Used in ChangesPanel sidebar context where space is limited.
