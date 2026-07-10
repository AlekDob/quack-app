---
type: feature
project: quack-desktop
created: 2026-07-10
last_verified: 2026-07-10
---

# 051 — Agent commit dock (composer)

**Purpose:** Cursor-style indicator **immediately above** the composer pill when the
agent runs `git commit` via the Bash tool. Shows short hash, commit message, relative
time, and whether the commit has been pushed — without opening Source Control.

Parent composer doc: **`022-chat-composer.md`**.

## Components

| File | Role |
|---|---|
| `src/components/AgentCommitDock.tsx` | Pill UI: hash · message · time · push badge |
| `src/agentCommitDetect.ts` | Parse Bash `git commit` / `git push`; live + hydrate from transcript |
| `src/agentCommitStore.ts` | Per-session pub/sub cache (`wsId:sessionId` key) |
| `src/components/AIChatPanel.tsx` | `inspectBashToolResult` on `tool_result`; mount dock; hydrate on session load |
| `src/gitStatusStore.ts` | Shared `ahead` / `upstream` for push inference + 8s poll while unpushed |
| `src/App.css` | `.ai-commit-dock`, `.ai-commit-dock-pill`, `.ai-commit-dock-push` |

## Layout

```
.ai-panel (composer column)
  .ai-status-dock          ← turn status + context files (022 / 037)
  .ai-commit-dock          ← THIS feature (when last agent commit exists)
  .ai-composer-shell
    ComposerContextBar      ← path + branch (050)
    …
```

Visible **after the turn ends** (unlike `TurnStreamStatus`). Not gated by
`showComposerDock`. Renders `null` when no agent commit is tracked for the current
`sessionId`.

## Detection (live)

| Trigger | Handler |
|---|---|
| Bash `tool_result` (stream) | `inspectBashToolResult` in `AIChatPanel` — looks up matching `activeToolLabels` row by `tool_use_id`, reads `preview` (the command) |
| Bash `tool_result` (CC attach replay) | Same helper in the attach/resume loop |
| `git commit` success | `noteAgentBashOutcome` → `buildCommitSnap` → `publishAgentCommit` |
| `git push` success | `markAgentCommitPushed` on the same session key |

**Command parsing** (`agentCommitDetect.ts`):

- Commit: `\bgit\s+commit\b`
- Push: `\bgit\s+push\b`
- Message: `-m "…"` / `-m '…'` / HEREDOC body in `git commit -m "$(cat <<'EOF' …)"`
- Hash from stdout: `[branch abc1234]` pattern; fallback `git log -1` for subject + hash

Errors (`is_error`) are ignored — failed commits do not surface the dock.

## Push state

| Source | Effect |
|---|---|
| Successful Bash `git push` after commit | `pushed: true` immediately |
| `git status`: `upstream` set and `ahead === 0` | Inferred pushed (`AgentCommitDock` + `markAgentCommitPushed`) |
| `upstream` missing | Badge **Local** (tooltip: no upstream) |
| `ahead > 0` | Badge **↑N** (unpushed count) |
| Unpushed commit visible | Poll `forceGitStatusRefresh` every **8s** until pushed |

Icons: `upload-cloud` + `--ok` tint when pushed; `cloud` + neutral when local/unpushed.

## Hydration (session restore)

On workspace switch, `openSession`, and tab restore, `hydrateAgentCommitFromMessages`:

1. Walk transcript backwards for the **last successful** Bash `git commit` (+ paired `tool_result`).
2. Rebuild snapshot via `buildCommitSnap` (may call `git log`).
3. If any successful `git push` appears **after** that commit's assistant message index → `pushed: true`.

Not persisted to disk separately — derived from transcript + live git head on load.

## Lifecycle / clear

| Event | Behaviour |
|---|---|
| Agent `git commit` | Publish / replace snapshot for `commitKey(wsId, sessionId)` |
| **New chat** | `clearAgentCommit` for old `sessionId` before rotating id |
| `/clear` | `clearAgentCommit` for current session |
| Switch session / tab | Dock follows new key (no explicit clear) |

## UI copy (English)

| Element | Text |
|---|---|
| Time | `just now`, `Nm ago`, `Nh ago`, or locale time |
| Pushed | `Pushed` |
| Unpushed (ahead) | `↑{ahead}` |
| No upstream | `Local` |

## Related

| Doc | Link |
|---|---|
| Composer shell + status dock | `022-chat-composer.md` |
| Branch / ahead in composer | `050-composer-context-bar.md` |
| Git status cache | `gitStatusStore.ts`, Source Control `027` / panel |
| Bash tool streaming | `006-chat-tool-render.md`, `014-claude-code-bridge.md` |

## Verify

1. Agent runs `git commit -m "test"` → pill appears above composer with hash, message, `just now`, **Local** or **↑1**.
2. Agent runs `git push` → badge flips to **Pushed** (green `upload-cloud`).
3. Reload app / reopen session → same commit restored from transcript.
4. New chat / `/clear` → pill disappears.
5. Failed commit (non-zero) → no pill.

## Gotchas

- **Bash only** — commits via the UI Source Control panel or non-Bash tools are not tracked here.
- Detection uses the **command string** on the tool label (`preview`), not a separate git IPC event.
- `buildCommitSnap` always reads `git log -1` after commit — if another writer commits concurrently, hash/message may not match the agent's output (rare).
- Push inference via `ahead === 0` requires a configured **upstream**; detached or no-remote repos stay **Local**.
- Store is in-memory per app session — hydration re-derives from saved `tool_results` on load.
