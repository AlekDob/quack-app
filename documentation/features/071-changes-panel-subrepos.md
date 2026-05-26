---
type: feature-doc
project: quack-app
stack: Tauri (Rust + React)
created: 2026-05-26
last_verified: 2026-05-26
tags: [changes-panel, git, subrepos, multi-repo, container-project]
---

## ChangesPanel — Sub-repos Section
**Purpose:** Show nested git repos found at depth-1 inside a container project root (e.g. `Kyron/` with `cms/`, `ecommerce/`, `studio-server/`) directly in the ChangesPanel, with read-only status (branch, dirty counts, ahead/behind) and click-to-switch in-place context.
**Stack:** Rust (CLI git via `run_git`), React 18, TypeScript strict, Tauri v2 invoke

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Backend | `src-tauri/src/git.rs` | `git_scan_subrepos(root_path)` → `Vec<SubRepoStatus>`. Depth-1 scan; CLI git for branch/counts/ahead-behind/last commit. |
| Backend reg | `src-tauri/src/lib.rs` | Register `git_scan_subrepos` in `tauri::generate_handler!` |
| Types | `src/types/index.ts` | `SubRepoStatus` interface |
| Component | `src/components/SubReposSection.tsx` | Accordion list, autohide when count=0, click row → `onSelect(path)` |
| Component | `src/components/PendingTab.tsx` | Renders `<SubReposSection>` at top when not in sub-repo override mode |
| Component | `src/components/ChangesPanel.tsx` | `subRepoOverride` state, `effectiveRootPath`, breadcrumb back-button; forces `activeTab='pending'` when override active |
| Styles | `src/components/ChangesPanel.css` | `.subrepos-section`, `.subrepo-row`, `.subrepo-breadcrumb` |

### Data Flow

```
ChangesPanel mounts (rootPath = container project)
  → PendingTab renders SubReposSection
    → invoke('git_scan_subrepos', { rootPath })
      → Rust: read_dir depth 1 → for each entry with .git, run git status/rev-list/log
        → returns SubRepoStatus[]
    → autohide if length 0
  → user clicks row
    → ChangesPanel.setSubRepoOverride(path)
      → effectiveRootPath = path
      → useChangesPanelState re-runs for sub-repo
      → breadcrumb shown: 'parent › subrepo ←'
  → user clicks back
    → setSubRepoOverride(null) → restores parent context
```

### Design Decisions

- **CLI over git2**: keeps consistency with rest of `git.rs` (which uses `run_git` shell-out). Avoids adding `git2` as dependency just for one feature.
- **Depth 1 only**: prevents recursive scans on huge monorepos. Container projects (Kyron pattern) are flat by convention.
- **Cache**: a single-shot scan per UI refresh. No persistent cache server-side in v1 — backend is fast enough (<200ms for 5 sub-repos on SSD). Add cache later if it becomes a bottleneck.
- **Read-only**: no commit/push/pull on sub-repos in v1. Pure visualization + context switch.
- **Tabs disabled during override**: when `subRepoOverride` is active, only the Pending tab is meaningful (history/branches/worktrees of the sub-repo are out of scope). Other tabs are visually disabled.
- **Autohide**: section is rendered only if scan returns ≥1 sub-repo. Single-repo projects see no UI change.

### Brain References
- `documentation/workstreams/02-changes-panel-subrepos.md` — workstream
- `documentation/patterns/pattern-changes-panel.md` — host panel pattern
- `documentation/patterns/pattern-brain-accordion-section.md` — accordion layout reference
