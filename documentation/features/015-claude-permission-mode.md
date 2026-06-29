---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-06-29
last_verified: 2026-06-29
tags: [claude-code, permissions, permission-mode, overlay, auto-allow, store, slash-command]
---

## Claude Code Permission Mode (Ask / Plan / Auto-edit / Auto / Bypass)

**Purpose:** Let the user pick, per chat, how much Claude Code is allowed to do without confirming — from "card on every edit" to "run everything". The chosen mode is the SINGLE driver of auto-allow: the frontend permission overlay enforces it, because the CLI's own `--permission-mode` is inert while the PreToolUse hook intercepts every call.

**Stack:** React 19 + TS strict, module-level store (pub/sub-free, keyed Maps), localStorage persistence.

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Bridge store | `src/permModeStore.ts` | `setPermMode(opts, mode)`, `getPermModeFor(req)` — mode keyed by CC session id (+ cwd fallback) |
| Enforcer | `src/components/ClaudePermissionOverlay.tsx` | `modeAutoAllow(req)` + `WRITE_TOOLS`; auto-allows after the safety gates |
| Producer | `src/components/AIChatPanel.tsx` | `ccPermMode` state, `/mode` handler, mode menu; publishes via `setPermMode` |
| Slash hint | `src/slashCommands.ts` | `/mode ask\|plan\|auto-edit\|auto\|bypass` |

### Modes
| UI label | Stored value | Effect |
|---|---|---|
| Ask (default) | `null` | card on every gated tool; the safe default a fresh install gets |
| Plan | `plan` | plan only, no edits; Read/Grep/Glob auto + **read-only Bash auto** (ls/cat/grep/git status…); writing Bash still cards |
| Auto-edit | `acceptEdits` | auto-allow file-edit tools (`Edit`/`MultiEdit`/`Write`/`NotebookEdit`); Bash & rest still card |
| Auto | `auto` | auto-allow everything (Bash included); privacy gate + AskUserQuestion redirect still apply |
| Bypass | `bypassPermissions` | backend runs with the hook OFF → no cards, no privacy gate at all |

### Data Flow
- `AIChatPanel` holds `ccPermMode` (seeded from `localStorage["lcp.claudeCode.permMode"]`). A `useEffect` persists it and calls `setPermMode({ sessionId, cwd: root }, mode)` on every change.
- `permModeStore` records the mode in `bySession` (by CC session id) and `byCwd` (normalized root) — the cwd fallback covers the first tool call of a fresh chat before its session id has streamed back.
- A `claude:permission-request` arrives → `ClaudePermissionOverlay` runs its gates **in order**: privacy exclusion → read-only allow → `modeAutoAllow(req)` → (in Plan mode: stop, show card) → saved/always-allow rules → show card.
- `modeAutoAllow` calls `getPermModeFor(req)` (session id, then cwd, else `"default"`): `auto` → allow all; `acceptEdits` → allow only `WRITE_TOOLS`; `plan` → allow Bash only when `isReadOnlyBash` (head ∈ `READ_ONLY_BASH`, or `git` + read-only subcommand, and no chain/redirect/pipe/subshell via `BASH_CHAIN_RE`); else → no mode-based allow.

### State
| Where | What | Lifetime |
|---|---|---|
| `permModeStore` module Maps | `bySession`, `byCwd` | app session (in-memory) |
| `localStorage` `lcp.claudeCode.permMode` | last chosen mode | across restarts |
| `AIChatPanel` `ccPermMode` | per-chat React state | component |

### Notes / gotchas
- **Why a module store, not a prop:** the overlay registers its `claude:permission-request` listener once and lives for the whole app — it can't read a panel's React state without closure-staleness. Pattern cloned from `aiTaskStore.ts`.
- **Order matters:** mode auto-allow runs AFTER the privacy gate and read-only allow so those safety checks always win, and BEFORE saved always-allow rules since the mode is the broader intent.
- **`bypassPermissions` never reaches the overlay:** the backend runs that mode with the hook off, so no card events fire — `modeAutoAllow` only ever sees `auto`/`acceptEdits`/`default`.
- **Plan mode ignores saved always-allow rules:** otherwise a persisted "always allow Edit on .ts" would slip an edit past plan mode (the hook's `allow` overrides the CLI's plan block). In plan mode only read-only allows fire; everything else cards.
- **Plan-mode read-only Bash:** the safelist is intentionally tight — runners (`env`/`xargs`/`sudo`), in-place editors (`sed -i`), and `git branch/tag/config/remote` (mutating forms exist) are excluded; any `>`/`|`/`;`/`` ` ``/`$(` rejects the command (`BASH_CHAIN_RE`). Read/Grep/Glob never reach `modeAutoAllow` — they auto-allow upstream as `READ_ONLY_HOOK_TOOLS`.
- **`/mode off` resets to Ask (`null`)**, not to a permissive default — the safe direction.
- Mode is normalized: `default` is stored as `null` (Ask) so "no mode set" and "explicitly Ask" are the same state.
- The overlay/cards themselves are documented alongside the bridge — see [014-claude-code-bridge.md](014-claude-code-bridge.md).
