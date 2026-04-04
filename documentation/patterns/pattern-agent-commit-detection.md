---
type: pattern
project: quack-app
created: 2026-04-03
last_verified: 2026-04-03
tags: [changes-panel, git, commit, reconciliation, agent]
---

# Agent Commit Detection (ChangesPanel Auto-Refresh)

## Problem
The ChangesPanel reconciles its `modifiedFiles` with actual git status only on `window.focus`. When the Claude agent runs `git commit` mid-session, the panel doesn't update — committed files stay "pending" because the window never loses focus.

## Solution
Two-level signal:

### 1. Detection (ChatView.tsx)
A `useMemo` scans all assistant messages for Bash tool calls containing `git commit`:
```
messages → filter assistant → scan events → find bash tool_use with 'git commit' → lastAgentCommitTs
```
A `useEffect` calls `onAgentCommitDetected()` when `lastAgentCommitTs` changes.

### 2. Propagation (App.tsx → SidePanelAccordion → ChangesPanel)
- App.tsx: `onAgentCommitDetected` calls `refreshGitSummary()` + bumps `agentCommitTs` state
- SidePanelAccordion: passes `lastRefreshTs={agentCommitTs}` to ChangesPanel
- ChangesPanel: `useEffect` on `lastRefreshTs` triggers `reconcileWithGit()`

### 3. Reconciliation (ChangesPanel.tsx)
`reconcileWithGit()` extracted from the window focus handler into a reusable `useCallback`. Called by:
- `window.focus` event (external commits: Fork, terminal)
- `lastRefreshTs` prop change (agent commits)

Both paths invoke `git_check_files_dirty` to compare `modifiedFiles` against actual git status and move clean files to "committed".

## Key Files
| File | Role |
|------|------|
| `src/components/ChatView.tsx` | Detects `git commit` in tool events |
| `src/App.tsx` | Wires callback + manages `agentCommitTs` |
| `src/components/SidePanelAccordion.tsx` | Threads `lastRefreshTs` prop |
| `src/components/ChangesPanel.tsx` | `reconcileWithGit()` + `lastRefreshTs` effect |
