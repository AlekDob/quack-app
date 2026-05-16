---
type: gotcha
project: quack-app
created: 2026-05-15
last_verified: 2026-05-15
tags: [subagent-driven-development, git, worktree, harness, orchestration]
---
# Subagent implementer commits land in an isolated worktree on a stale base

## Symptom

When dispatching an implementer subagent (Agent tool, `subagent_type: claude`,
typically with write tools) the harness may auto-create an isolated git
worktree under `.claude/worktrees/agent-<id>/` on its own branch
(`worktree-agent-<id>`). The subagent's commit then does NOT appear on the
working branch (`038-codex-backend-m1`): `git log` on the main checkout does
not show it, and the edited file is absent from the main working tree
(`grep -c <new symbol> src/App.tsx` → 0). Worse, the worktree was observed to
branch from a STALE base commit (e.g. `daec7fd`, the old B2 baseline) — so it
does not contain prior tasks' commits, and the subagent's own `tsc`/test runs
can be misleading because they ran against the wrong tree.

This happened 3× during Codex M1 E4 Step 2 (Task 2a, the Task 2b attempt, C1).
It is NOT triggered by passing `isolation: "worktree"` (that flag was never
set) — it is harness behavior for some `claude` subagent dispatches. Read-only
reviewer subagents (`code-explorer`, `code-reviewer`) did NOT auto-worktree.

## Why it matters

The orchestrator's two-stage review and the zero-Claude-regression gate run
against the MAIN checkout. If a subagent commit silently lives on a stale-base
worktree branch, you would review/verify the wrong (or absent) code, and the
work would be lost on branch cleanup.

## How to handle (orchestrator playbook)

1. **Add an env guard to every implementer prompt**: have the subagent run
   `git rev-parse --abbrev-ref HEAD` and `pwd` FIRST and report them; if `pwd`
   is under `.claude/worktrees/`, it must say so explicitly (do not silently
   work there assuming it is the main checkout). This caught the case before
   the subagent edited the wrong tree.
2. **Pre-authorize the worktree path**: tell the subagent it MAY commit in the
   worktree (it is a valid checkout of the same branch) and to report the
   worktree path + commit SHA + `git branch --contains HEAD` so the controller
   can integrate.
3. **Always independently verify after every implementer task**, before
   review: `git log --oneline -3`, `git merge-base --is-ancestor <sha> HEAD`,
   and grep the main working tree for the new symbol. Do not trust the
   subagent's "committed on <branch>" claim.
4. **Integrate via cherry-pick** when the commit is on a worktree branch:
   `git cherry-pick <sha>`. If the change is in a region untouched by the
   diverged commits (verify with `git diff <stale-base> <038-head> -- <file>`),
   the cherry-pick applies cleanly even from a stale base (proven for Task 2a:
   App.tsx was identical between `daec7fd` and 038 HEAD around the changed
   region).
5. **Clean up**: `git worktree prune`; `git worktree remove -f -f
   .claude/worktrees/agent-<id>`; `git branch -D worktree-agent-<id>`. A
   worktree may be `locked` while its agent process is alive — remove after the
   agent reports DONE.

## Breadcrumb

No production code change; this is an orchestration gotcha. Referenced from the
2026-05-15 diary (E4 Step 2 entry).
