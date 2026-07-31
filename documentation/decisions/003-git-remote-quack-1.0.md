---
type: decision
project: quack-desktop
created: 2026-07-01
last_verified: 2026-07-31
tags: [git, branching, remote, quack-1.0, main, fork, superseded]
---

# Git remote: push desktop work to `quack-1.0`, leave `main` alone

> **SUPERSEDED 2026-07-31 — `main` is now the desktop integration branch.**
> Alek's call: desktop work pushes to **`origin/main`**. Because the old
> `origin/main` (embedded-cli line) shared **no common ancestor** with the
> desktop history, aligning it required a force push:
>
> ```bash
> git push --force-with-lease origin main:main
> #  + 55f0e16f...4fa15fa5 main -> main (forced update)
> ```
>
> That discarded `55f0e16f` (`chore: squash history into single clean snapshot`,
> 2026-07-22) from the branch — no backup branch was kept, by explicit choice.
> `origin/main` and `origin/quack-1.0` now both point at the desktop line and are
> pushed together; `quack-1.0` stays as a mirror until we decide to retire it.
> Everything below describes the **previous** layout and is kept for history.

## Context

This workspace (`codetta` on disk) is the **Quack desktop** Tauri editor (Codetta fork,
rebrand in progress). It lives in the GitHub repo **`AlekDob/quack-app`**, which also
hosts other product lines on different branches.

| Remote branch | What it is | Desktop team action |
|---|---|---|
| **`quack-1.0`** | **Integration branch for Quack desktop** — same history as local `main` | **Push here** after merge/review |
| **`main`** (default on GitHub) | Separate line (embedded-cli / SDK experiments) — **unrelated history** | **Do not push desktop work here** (for now) |
| `feat/*` | Short-lived topic branches | Open, PR optional, merge into local `main` then push `quack-1.0` |

Local `main` tracks `origin/quack-1.0` after the 2026-07-01 alignment.

## Decision

1. **Desktop integration remote = `origin/quack-1.0`.** All shipped desktop work lands there.
2. **Leave `origin/main` untouched** until an explicit consolidation plan exists — fast-forward
   or force-push would overwrite the embedded-cli line; unrelated-history merge produces mass conflicts.
3. **Local workflow:** topic branch → merge/fast-forward into **`main`** → `git push origin main:quack-1.0`
   (or `git push origin quack-1.0` if `main` tracks it).

## Commands (cheat sheet)

```bash
# After work on a feature branch:
git checkout main
git merge feat/my-topic          # or: git merge --ff-only feat/my-topic
git push origin main:quack-1.0   # publishes desktop line

# Set upstream once (already done on Alek's machine):
git branch -u origin/quack-1.0 main
# Then simply:
git push
```

## Consequences

- GitHub's default branch (`main`) may not reflect the latest desktop build — clone for desktop
  work should use `quack-1.0`: `git clone -b quack-1.0 …`
- PRs for desktop can target `quack-1.0` instead of `main`.
- Upstream Codetta (`getcodetta/codetta`) `main` remains the reference for **upstream** contributions;
  this fork's remote layout is independent.

## When to revisit

- If embedded-cli and desktop are merged into one product line.
- If GitHub default branch should switch to `quack-1.0` for releases.
