---
type: feature
project: quack-desktop
created: 2026-07-10
last_verified: 2026-07-10
---

# 053 — Composer git actions (Cursor-style)

**Purpose:** Cursor-style **changed-files list** + **Changes +N −M** pill + **Commit & Push**
split button inside the composer pill — commit/push from chat without opening Source
Control. Complements **`051-agent-commit-dock.md`** (agent Bash commits above the pill).

Parent composer doc: **`022-chat-composer.md`**.

## Components

| File | Role |
|---|---|
| `src/components/ComposerGitActions.tsx` | File rows, diff stats, primary button, chevron menu |
| `src/gitFileDiff.ts` | `openGitFileDiff` → global `DiffModal` (shared with Source Control) |
| `src/composerGitOps.ts` | Stage-all → commit prompt → push/publish orchestration |
| `src-tauri/src/git.rs` | `git_diff_stat` — `git diff HEAD --numstat` aggregate + per-file |
| `src/ipc.ts` | `GitDiffStat`, `git.diffStat`, `git.stage`, `git.commit` |
| `src/gitStatusStore.ts` | Shared status watch (same cache as Source Control) |
| `src/composerCtxMenu.tsx` | Portaled dropdown (escapes `.ai-panel overflow:hidden`) |
| `src/components/AIChatPanel.tsx` | Mounts bar; passes composer `input` as suggested commit message |
| `src/App.css` | `.ai-composer-git*` |

## Layout

```
.ai-composer-shell
  .ai-composer-context-bar     (050, order -1)
  .ai-composer-git             (THIS, order 0)
    .ai-composer-git-files     ← per-file +/− (max 2, “Show N more”)
    .ai-composer-git-actions
      .ai-composer-git-changes ← “Changes +781 −91”
      .ai-composer-git-split   ← primary + chevron menu
  .ai-input-row                (order 1)
  .ai-composer-meta            (order 2)
```

Visible when workspace is a git repo **and** there are local changes, diff stats, or
`ahead > 0` (unpushed commits).

## UI

| Element | Behaviour |
|---|---|
| Compact (default) | Single bar: `Changes +N −M` · `N files ▾` · **Commit & Push** — no file list |
| Expand | Click `N files` → scrollable list; **click a row** → `DiffModal` (`openGitFileDiff`, same as Source Control) |
| Collapse | Click **Less ▴** — returns to compact bar |
| Changes pill | Total insertions/deletions from `git_diff_stat` |
| Primary button | **Commit & Push** when dirty; **Push** when only `ahead > 0` |
| Chevron menu | Create Branch & Commit · Create Branch, Commit & Push · Commit · Commit & Push · Push |

Primary button uses monochrome `--primary-bg` (Cursor-style), not orange.

## Actions (`composerGitOps.ts`)

All commit paths **stage all non-conflicted files** first (`git stage`), then prompt
for message (prefilled from composer draft text when non-empty).

| Action | Steps |
|---|---|
| `commit` | stage → commit |
| `commit-push` | stage → commit → push (publish if no upstream) |
| `push` | push only |
| `branch-commit` | create branch → stage → commit |
| `branch-commit-push` | create branch → stage → commit → push |

Push reuses Source Control’s **publish** flow: confirm dialog + `git push -u origin`
when upstream is missing.

## Backend — `git_diff_stat`

```text
git diff HEAD --numstat
```

Returns `{ insertions, deletions, files: [{ path, insertions, deletions }] }`.
Binary files report `-` columns as zero. Untracked-only paths come from `git status`
file list (no line counts until staged).

## Related

| Doc | Link |
|---|---|
| Composer shell | `022-chat-composer.md` |
| Path + branch bar | `050-composer-context-bar.md` |
| Agent commit indicator (above pill) | `051-agent-commit-dock.md` |
| Source Control panel | `SourceControlPanel.tsx` |

## Verify

1. Edit files in a git repo → composer shows file rows + **Changes +N −M**.
2. Primary **Commit & Push** → stage-all, message prompt (composer text prefilled), commit, push.
3. Chevron → **Create Branch & Commit** works; publish dialog on branch without upstream.
4. Only unpushed commits (`ahead > 0`, clean tree) → bar shows **Push** only.
5. Non-repo workspace → bar hidden.

## Gotchas

- **No “Create PR”** in v1 — menu stops at push (no `gh` integration in composer).
- Stage-all is intentional (Cursor parity); partial staging still lives in Source Control.
- Menu must stay **portaled** via `ComposerCtxMenu` — do not inline absolute menus in the pill.
- `git diff HEAD --numstat` ignores untracked line counts; rows show `new` until staged.
