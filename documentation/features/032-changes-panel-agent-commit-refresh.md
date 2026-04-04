---
type: feature-doc
project: quack-app
stack: Tauri (Rust + React)
created: 2026-04-03
last_verified: 2026-04-03
tags: [changes-panel, git, commit, reconciliation, agent, auto-refresh]
---

## Changes Panel — Agent Commit Auto-Refresh
**Purpose:** Automatically reconcile the ChangesPanel when the Claude agent runs `git commit` mid-session, moving committed files from "Pending" to "Committed" without requiring a window focus event.
**Stack:** React 18, TypeScript strict, Tauri v2 invoke

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Component | src/components/ChatView.tsx | `lastAgentCommitTs` useMemo detecting `git commit` in Bash tool calls, `onAgentCommitDetected` callback |
| Component | src/components/ChangesPanel.tsx | `reconcileWithGit` useCallback (extracted), `lastRefreshTs` prop trigger |
| Component | src/components/SidePanelAccordion.tsx | Threads `lastRefreshTs` prop to ChangesPanel |
| State | src/App.tsx | `agentCommitTs` state, wires `onAgentCommitDetected` → `refreshGitSummary()` + bump |

### Data Flow

**Detection → Propagation → Reconciliation:**
```
ChatView useMemo: scan assistant events for bash 'git commit'
  → lastAgentCommitTs changes
  → useEffect calls onAgentCommitDetected()
    → App.tsx: refreshGitSummary() + setAgentCommitTs(Date.now())
      → SidePanelAccordion: lastRefreshTs={agentCommitTs}
        → ChangesPanel: useEffect triggers reconcileWithGit()
          → invoke('git_check_files_dirty') → move clean files to "committed"
```

**Two reconciliation triggers (same `reconcileWithGit` function):**
| Trigger | When | Source |
|---------|------|--------|
| `window.focus` | User switches back from Fork/terminal | External commits |
| `lastRefreshTs` prop | Agent runs `git commit` in session | In-session commits |

### Key Design Decisions
- **Extracted reconciliation**: `reconcileWithGit()` is a `useCallback` called by both triggers. Previously inline in `window.focus` handler.
- **Timestamp signal**: Using `Date.now()` bump instead of boolean toggle ensures React always detects the change.
- **No polling**: Detection is event-driven via `useMemo` on `messages`, not interval-based.

### Brain References
- `documentation/patterns/pattern-agent-commit-detection.md` — full pattern documentation
- `documentation/patterns/pattern-changes-panel.md` — existing ChangesPanel architecture
