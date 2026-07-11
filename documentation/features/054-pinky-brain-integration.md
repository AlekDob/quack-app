---
type: feature
project: quack-desktop
created: 2026-07-10
last_verified: 2026-07-10
tags: [brain, pinky, knowledge, mcp, search, integration, dashboard, quack-v1]
---

# 054 — Pinky Brain integration

**Purpose:** Native Quack integration for [Pinky Brain](https://pinkybrain.dev) —
hybrid local knowledge search (BM25 + vector) over `documentation/` + global
`~/.pinky/brain/`, with a Brain editor tab, animated dashboard, Cursor-style
search, pre-turn chat injection, and Quack Brain → Pinky global path migration.

Pinky is a Rust fork/evolution of the Quack Brain skill model (markdown-as-truth,
two-level store). Quack wraps the `pinky` CLI — it does not reimplement search.

## UI surfaces

| Surface | Location | Role |
|---|---|---|
| `BrainPanel` | Editor tab `brain:<wsId>` (activity bar) | Search, dashboard, setup, reindex, inject toggle |
| `BrainDashboard` | Empty state inside Brain tab | Animated charts + telemetry |
| `BrainSearchResults` | After Search | Cursor-style rows, shimmer skeleton, highlights |
| `BrainTurnChip` | Below user message in chat | Quiet recap: Brain · N hits · ms + slim linked rows |
| `BrainSaveChip` | Below Jack reply (amber) | Proposed `pinky save` — Save / Dismiss |
| Pre-turn inject | `AIChatPanel.sendUserText` | Top-3 hits in user turn (CC-safe) |
| MCP catalog | `McpServerBrowser` | One-click `pinky-mcp` in `.mcp.json` |

## Rust bridge (`pinky.rs`)

| Command | Role |
|---|---|
| `pinky_available` | CLI on PATH? + version |
| `pinky_workspace_status` | MCP/rule/db flags + entry counts + migration flag |
| `pinky_search` | `pinky search --json` in workspace cwd |
| `pinky_setup` | `pinky init --no-model --no-hooks` + write `.mcp.json` + reindex |
| `pinky_reindex` | `pinky reindex documentation` |
| `pinky_migrate_global_brain` | Symlink `~/.pinky/brain` → `~/.quack/brain` when needed |
| `pinky_stats_value` | `pinky stats --value --json` (dashboard) |
| `pinky_telemetry` | `pinky telemetry --json` (most retrieved) |
| `pinky_save` | `pinky save` stdin body → `documentation/<type>/` + index |

Env on every CLI call: `PINKY_DB=brain.db`, `PINKY_SAVE_DIR=documentation`.

## Brain self-improvement (`BrainSaveChip`)

When Jack discovers something hard-won (many greps, scattered config) not well
documented, he appends a structured block at the **end** of his reply:

```
[Brain save]
title: Coolify studio-staging env vars
type: gotcha
tags: coolify, deploy, studio
reason: Env vars scattered across Docker + inbox note
---
## Env vars chiave
…markdown body…
[/Brain save]
```

- Block is **stripped** from rendered prose; `BrainSaveChip` shows amber UI
- **Save** → `pinky_save` IPC → `documentation/<type>/` + auto-index
- **Dismiss** hides the chip (persisted on `ChatMessage.brain_save`)
- Jack system prompt documents the format; Quack does not auto-write without click

## Richer pre-turn inject

When Pinky snippets are thin (&lt;320 chars), Quack **reads the `.md`** for the
top 1–2 hits (up to ~2.2k chars on #1) and adds:
`Prefer Read documentation/<path> before broad Explore/Grep.`

## Brain tab layout

Portal pattern matches Usage / Whiteboard (`WorkspaceShell` → `pane-content`).

```
.brain-panel          flex fill, position:absolute in pane
  .brain-panel-inner  scroll + container queries (NEVER on outer panel)
    header + status chips + search bar
    BrainDashboard    when no settled search
    BrainSearchResults when searching / settled
```

**Responsive gotcha:** `container-type: inline-size` on `.brain-panel` itself
collapses the flex child to ~20px (inline-size containment). Container queries
live on `.brain-panel-inner` only.

Breakpoints via `@container brain-panel`: stacked bar charts ≤480px, compact
padding ≤360px, 3-column hero ≥900px. Hero grid uses `auto-fit` +
`minmax(min(100%, 240px), 1fr)`.

## Search UX (`BrainSearchResults.tsx`)

| State | UI |
|---|---|
| Typing, no Search yet | Dashboard stays visible — no premature “No matches” |
| Searching | “Searching knowledge…” shimmer label + 5 skeleton rows with sweep |
| Results | Staggered fade-in rows; query terms highlighted (`brainHighlight.ts`) |
| Settled, 0 hits | Centered empty state |
| Reindex running | Toast + header shimmer + skeleton rows + banner copy |
| No `brain.db` yet | Dashed callout — click Reindex |
| Row hover | File path slides in (hidden by default for cleaner list) |

**Open file:** `openBrainDoc()` focuses the pane that owns the Brain tab, then
`openFileAndReveal()` with `documentation/<path>`. Fixes split-pane opens landing
in the wrong pane.

Search bar: pill input + icon, shimmer label while busy, separate `searching`
vs `busyKind` (`setup` | `reindex` | idle).

## Setup & reindex UX (`BrainPanel.tsx`)

First `pinky reindex` loads the ONNX embed model (~60s on a cold machine). Until
`brain.db` exists, entry/chunk counts stay at 0 and the dashboard is hidden — easy
to misread as “nothing indexed” if there is no progress UI.

| Phase | UI |
|---|---|
| No `brain.db`, docs present | Dashed callout: “No index yet — click **Reindex**” |
| Setup (`busyKind=setup`) | Toast info + setup banner; `pinky init --no-model --no-hooks` |
| Reindex (`busyKind=reindex`) | Toast info + header shimmer + skeleton rows + banner |
| Done | Success toast + `refresh()` → chips + dashboard populate |

**Non-blocking IPC:** all `pinky_*` commands are `async` + `spawn_blocking`; the
user can keep using the app during setup/reindex. Every CLI spawn sets
`stdin(Stdio::null())` so Pinky cannot block on interactive prompts.

## Dashboard (`BrainDashboard` + `BrainCharts.tsx`)

Zero extra chart deps — SVG + CSS keyframes + `useCountUp.ts`.

| Widget | Data |
|---|---|
| Coverage donut | active vs dormant entries |
| Retrieval pulse | hits, served, sessions, useful + signal-quality bar |
| Savings rings | cumulative Quack inject tokens/ms (when >0 turns) |
| By type | horizontal bars from `stats --value` `by_type` |
| Most retrieved | telemetry top 8, clickable |

## Pre-turn injection (`brainInject.ts`)

- Toggle: `lcp.brain.inject.<wsId>` (default **on**)
- **Claude Code:** appended to `ccTurnContext` (survives `--resume`)
- **API providers:** appended to `sysParts`
- Skips queries &lt;8 chars; top 3 hits; ~280 char snippets
- Persists `brain_usage` on `ChatMessage` for `BrainTurnChip` render

## Savings estimates (`brainSavings.ts` + `brainUsageStore.ts`)

Heuristic vs classic Grep + Read tool loops (not provider billing):

- 1 Grep round (~900 tok, ~2.4s) + N file reads (~2.8k tok + ~2.4s each)
- Compared to inject payload size + measured local search ms
- Cumulative per workspace: `lcp.brain.cum.<wsId>`

## Deep merge (L3)

1. **Global path:** first `pinky_workspace_status` migrates `~/.quack/brain` →
   `~/.pinky/brain` (symlink on Unix)
2. **Setup:** `pinky setup` → `pinky init --no-model --no-hooks` + `.mcp.json` + reindex
3. **MCP:** `.mcp.json` `pinky-mcp` entry (Virgilio-compatible env)
4. **CC rule:** `.claude/rules/use-pinky-brain.md` via `pinky init` (gitignored)
5. **Legacy skill:** `~/.claude/skills/quack-brain` remains for manual invoke;
   prefer Brain tab + MCP for indexed search

## File map

| File | Role |
|---|---|
| `src-tauri/src/pinky.rs` | CLI bridge |
| `src/pinky.ts` | IPC types + API |
| `src/brainInject.ts` | Pre-turn inject, `openBrainDoc`, path helper |
| `src/brainHighlight.ts` | Query term highlight in search rows |
| `src/brainSavings.ts` | Token/time savings heuristics |
| `src/brainUsageStore.ts` | Cumulative inject savings |
| `src/hooks/useCountUp.ts` | Animated dashboard numbers |
| `src/components/BrainPanel.tsx` | Tab shell |
| `src/components/BrainDashboard.tsx` | Dashboard layout |
| `src/components/brain/BrainCharts.tsx` | Donut, bars, rings |
| `src/components/brain/BrainSearchResults.tsx` | Search rows + skeleton |
| `src/components/BrainTurnChip.tsx` | Chat stream chip |
| `src/components/AIChatPanel.tsx` | Injection hook |
| `src/components/McpServerBrowser.tsx` | MCP catalog card |
| `src/store.ts` | `brainKey`, `brainOpen` |
| `src/ai.ts` | `BrainUsageMeta` on `ChatMessage` |
| `src/App.css` | `.brain-*` styles |

## Gotchas

- **UI freeze on setup (fixed):** sync Tauri commands ran `pinky reindex` on the main
  thread; first index loads the embed model (~60s) and froze the whole window.
  All `pinky_*` commands now use `spawn_blocking` (same as `git.rs` / `search.rs`).
- **`pinky init` interactive prompt (fixed):** without `--no-hooks`, init asks to install
  CC hooks on stdin and hangs when spawned from Quack. Setup uses
  `pinky init --no-model --no-hooks` (Quack already owns CC permission hooks).
  All spawns also pass `stdin(Stdio::null())` as a belt-and-suspenders guard.
- **Silent reindex (fixed):** reindex showed 0 entries / no dashboard with no
  loader until completion. `busyKind` drives toast, header shimmer, skeleton, and
  empty-index callout.
- Pinky CLI installed separately (pinkybrain.dev) — not bundled (~21 MB)
- `brain.db`, `.fastembed_cache/` gitignored; index is local per workspace
- `pinky init --no-model --no-hooks` in setup skips ONNX download and interactive hook prompt
- Pre-turn inject + MCP `brain_search` can overlap on CC turns — complementary
- `prefers-reduced-motion`: chart/search animations disabled
- Pinky search paths are relative to `documentation/` — never open without
  `brainDocAbsPath()` / `openBrainDoc()`
- **Cross-workspace open (fixed):** `openPathSmart` could resolve
  `documentation/README.md` in a sibling project and switch workspace.
  `openBrainDoc` now always uses `ws.meta.root` from the chat's `wsId` and
  `openFile` in-place. Chip shows workspace name (`Kyron · 3 hits`).

## Related

- Virgilio: `.claude/rules/use-pinky-brain.md`
- Legacy: `~/.claude/skills/quack-brain/SKILL.md`
- Context optimizer: `020-context-optimizer.md`
- Usage tab pattern: `019-usage-monitor.md`
