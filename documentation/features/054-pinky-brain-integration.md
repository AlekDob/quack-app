---
type: feature
project: quack-desktop
created: 2026-07-10
last_verified: 2026-07-13
tags: [brain, pinky, knowledge, mcp, search, integration, dashboard, quack-v1, composer-mention, inject-gates]
---

# 054 — Pinky Brain integration

**Purpose:** Native Quack integration for [Pinky Brain](https://pinkybrain.dev) —
hybrid local knowledge search (BM25 + vector) over `documentation/` + global
`~/.pinky/brain/`. Surfaced as the **Knowledge** segment inside **Quack Brain**
(editor tab) when the `pinky-brain` extension is installed via **Quack Store**
(see `059-quack-brain-store.md`).

Pinky is a Rust fork/evolution of the Quack Brain skill model (markdown-as-truth,
two-level store). Quack wraps the `pinky` CLI — it does not reimplement search.

## UI surfaces

| Surface | Location | Role |
|---|---|---|
| `BrainPanel` | Editor tab `brain:<wsId>` (activity bar) | Quack Brain hub — Knowledge segment when `pinky-brain` installed |
| `BrainDashboard` | Empty state inside Brain tab | Animated charts + telemetry |
| `BrainSearchResults` | After Search | Cursor-style rows, shimmer skeleton, highlights, **brain icon** per row |
| `BrainTurnChip` | Below user message in chat | Quiet recap: Brain · N hits · ms + slim linked rows |
| `BrainSaveChip` | Below Jack reply (amber) | Proposed `pinky save` — Save / Dismiss |
| `BrainMentionSuggestions` | Above composer on `#` | Debounced Pinky search popover; brain-icon rows |
| `ComposerMentionChips` | Inside composer input row | Colored **brain** chips for explicit `#` cites — see **`072`** |
| `BrainInjectGates` | Brain tab toolbar | Auto-inject toggle + score / intent / thread gates |
| Pre-turn inject | `AIChatPanel.sendUserText` | Opt-in auto search with configurable gates |
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

## `#` composer citations (explicit)

User types `#` (after whitespace or at line start) → `parseBrainMention` →
`BrainMentionSuggestions` above the composer shell.

| Query | Popover content |
|---|---|
| `#` only (empty query) | Telemetry `most_used` (top 8) |
| `# localhost cors` | Debounced `pinky.search` (~200ms), 8 hits |

On pick:

1. **Chip** in `.composer-mention-chips` (human title, brain icon, `--info-bg`)
2. Path queued in `attachedBrainHits` — **not** inserted as `#text` in textarea
3. On send → `fetchBrainContextForPaths` reads `.md` snippets and injects
   `[Pinky Brain — cited documentation]` block
4. Bypasses auto-inject toggle and all gates

Full chip styling for brain + file + agent + skill: **`072-composer-mention-chips.md`**.

## Pre-turn injection (`brainInject.ts` + `brainGates.ts`)

**Default off** — every user message is no longer treated as a semantic search query.

### Master toggle

- `lcp.brain.inject.<wsId>` — default **`false`**
- UI: Brain tab → **Pre-turn inject** pill (`BrainKnowledgePanel`)

### Gates (individually disable-able)

| Pref | Default | Role |
|---|---|---|
| `lcp.brain.gate.score.<wsId>` | `{enabled: true, min: 0.035}` | Drop hits below min `PinkySearchHit.score` |
| `lcp.brain.gate.intent.<wsId>` | `{enabled: true}` | Skip status updates / short confirmations |
| `lcp.brain.gate.thread.<wsId>` | `{enabled: false, turns: 3}` | Build query from last N user turns + current message |

**Intent gate** (no LLM): inject when message has `?`, work keywords
(`why|how|fix|error|…`), and is not a conversational opener (`ok`, `grazie`,
`ho riavviato`, `sono su`, …).

### Send flow

```
sendUserText
  ├─ attachedBrainHits? → fetchBrainContextForPaths (always)
  └─ else if inject ON → shouldAutoInjectBrain → score filter → pinky.search
       → ccTurnContext (CC) or sysParts (API)
```

- Skips auto queries &lt;8 chars; top 3 hits; ~280 char snippets
- Persists `brain_usage` on `ChatMessage` for `BrainTurnChip`
- Jack prompt: explicit `#` cites = read those paths; auto-hits = suggestions only

## Brain tab layout

Portal pattern matches Usage / Whiteboard (`WorkspaceShell` → `pane-content`).

```
.brain-panel          flex fill, position:absolute in pane
  .brain-panel-inner  scroll + container queries (NEVER on outer panel)
    header + status chips + search bar
    BrainDashboard    when no settled search
    BrainSearchResults when searching / settled
    BrainInjectGates  when inject ON — gate toggles
```

**Responsive gotcha:** `container-type: inline-size` on `.brain-panel` itself
collapses the flex child to ~20px (inline-size containment). Container queries
live on `.brain-panel-inner` only.

## Search UX (`BrainSearchResults.tsx`)

| State | UI |
|---|---|
| Typing, no Search yet | Dashboard stays visible — no premature “No matches” |
| Searching | “Searching knowledge…” shimmer label + 5 skeleton rows with sweep |
| Results | Staggered fade-in rows; query terms highlighted (`brainHighlight.ts`) |
| Settled, 0 hits | Centered empty state |
| Reindex running | Toast + header shimmer + skeleton rows + banner copy |
| No `brain.db` yet | Dashed callout — click Reindex |
| Row icon | `brain` (not generic file) |

**Open file:** `openBrainDoc()` focuses the pane that owns the Brain tab, then
`openFileAndReveal()` with `documentation/<path>`.

## Setup & reindex UX (`BrainPanel.tsx`)

First `pinky reindex` loads the ONNX embed model (~60s on a cold machine). Until
`brain.db` exists, entry/chunk counts stay at 0 and the dashboard is hidden.

**Non-blocking IPC:** all `pinky_*` commands are `async` + `spawn_blocking`.
Every CLI spawn sets `stdin(Stdio::null())` so Pinky cannot block on prompts.

## Dashboard (`BrainDashboard` + `BrainCharts.tsx`)

| Widget | Data |
|---|---|
| Coverage donut | active vs dormant entries |
| Retrieval pulse | hits, served, sessions, useful + signal-quality bar |
| Savings rings | cumulative Quack inject tokens/ms (when >0 turns) |
| By type | horizontal bars from `stats --value` `by_type` |
| Most retrieved | telemetry top 8, clickable |

## Savings estimates (`brainSavings.ts` + `brainUsageStore.ts`)

Heuristic vs classic Grep + Read tool loops (not provider billing).
Cumulative per workspace: `lcp.brain.cum.<wsId>`.

## File map

| File | Role |
|---|---|
| `src-tauri/src/pinky.rs` | CLI bridge |
| `src/pinky.ts` | IPC types + API |
| `src/brainInject.ts` | Auto + explicit inject, `openBrainDoc`, score filter |
| `src/brainGates.ts` | Gate prefs + intent / thread / score helpers |
| `src/brainMention.ts` | `#` parser + `AttachedBrainHit` types |
| `src/useBrainMentionSearch.ts` | Debounced search for `#` popover |
| `src/components/BrainMentionSuggestions.tsx` | `#` popover UI |
| `src/components/ComposerMentionChips.tsx` | In-composer chips (brain + shared) |
| `src/components/BrainInjectGates.tsx` | Gate settings in Brain tab |
| `src/components/brain/BrainSearchResults.tsx` | Search rows + brain icon |
| `src/components/BrainTurnChip.tsx` | Post-send recap chip |
| `src/components/AIChatPanel.tsx` | Send assembly + popover wiring |
| `src/composerDraft.ts` | `attachedBrainHits` persistence |
| `src/brainPrompt.ts` | Jack brain instructions |
| `src/App.css` | `.brain-*`, `.composer-mention-chip--*` |

## Gotchas

- **Auto-inject noise (fixed Jul 2026):** default ON + raw message as query
  pulled irrelevant gotchas on status updates. Now opt-in + intent/score gates;
  prefer explicit `#` cites for precision.
- **Chip placement (fixed Jul 2026):** brain cites briefly rendered above the
  composer shell; moved into `.ai-input-row` as `ComposerMentionChips` (072).
- Pinky CLI installed separately (pinkybrain.dev) — not bundled (~21 MB)
- `brain.db` gitignored; index is local per workspace
- Pre-turn inject + MCP `brain_search` can overlap on CC turns — complementary
- Pinky search paths are relative to `documentation/` — use `brainDocAbsPath()`
- **Cross-workspace open (fixed):** `openBrainDoc` uses chat `wsId` root
- **Project `.mcp.json` (2026-07-20):** Quack desktop does **not** ship a
  committed Pinky MCP config. Brain → Setup / `pinky_setup` still writes
  `pinky` → `pinky-mcp` locally — that process can cost ~1 GB+ under Claude
  Code. Prefer `documentation/features/` + diary unless you explicitly want
  Pinky MCP. Agent rule `.claude/rules/use-pinky-brain.md` was removed from
  this repo; CLAUDE.md no longer `@`-includes it.

## Related

- Composer mention chips: **`072-composer-mention-chips.md`**
- Quack Store: `059-quack-brain-store.md`
- Context optimizer: `020-context-optimizer.md`
- Perf / process footprint: `086-perf-audit-window.md`, `046-process-cleanup.md`
