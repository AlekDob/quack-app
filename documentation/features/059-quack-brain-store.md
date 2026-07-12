---
type: feature
project: quack-desktop
created: 2026-07-12
last_verified: 2026-07-12
tags: [brain, store, extensions, pinky, skillopt, quack-v1]
---

# 059 — Quack Brain + Quack Store (extension model)

**Purpose:** Optional brain capabilities ship as **curated extensions** — external CLIs
with Quack UI glue only (no bundled Python/Rust runtimes). **Quack Store** is the
discover/detect/install surface; **Quack Brain** is the hub for installed segments;
chat features are **gated** on extension detect.

## Surfaces

| Surface | Tab key | Entry |
|---|---|---|
| **Quack Store** | `store:<wsId>` | Activity bar store icon, `view.quack_store`, Brain empty CTA |
| **Quack Brain** | `brain:<wsId>` | Activity bar brain icon (existing) |
| **Chat** | — | Inject/save chips + `SkillProposalChip` when extension installed |

Both tabs portal into `pane-content` like Usage / Whiteboard (`WorkspaceShell`).

## Extension contract

`QuackExtension` in `src/quackStore/types.ts`; static catalog in `catalog.ts`.

| Field | Role |
|---|---|
| `id` | Stable key (`pinky-brain`, `skill-trainer`) |
| `detect.command` | CLI basename on PATH (`pinky`, `skillopt-sleep`) |
| `install[]` | Ordered hybrid methods: `cargo`, `pip`, `external` (docs-only skip) |
| `uiSurfaces[]` | `brain-segment`, `chat-chip`, `composer-inject` |
| `tint` | Row icon tile: `knowledge` \| `skills` (token-backed) |

## Catalog v1

| id | Name | CLI | Auto-install | Brain segment | Chat |
|---|---|---|---|---|---|
| `pinky-brain` | Knowledge Search | `pinky` | `cargo install pinky` | Knowledge | pre-turn inject, BrainSave/Turn chips |
| `skill-trainer` | Skill Trainer | `skillopt-sleep` | `pip` → `skillopt` (see install pipeline) | Skills | `SkillProposalChip` |

## Quack Store UI

`QuackStorePanel` + `StoreExtensionRow` — MCP-style compact rows (no glass on scroll list).

| Area | Behavior |
|---|---|
| Toolbar | Search filter + Refresh (re-run detect) |
| **Installed** | Rows with green wash, **Open** → Brain tab |
| **Available** | **Install** + **Docs** link |
| Row layout | Flex: `[icon+dot] [name+badge+subtitle] [actions]` — text left-aligned after icon |
| Busy | Shimmer “Working…” in actions column; row `pointer-events: none` |
| Error | Warn border + message + copyable manual command pill (persists after busy clears) |

CSS: `src/App.css` — `.store-panel`, `.store-row*`, `.store-section`.

## Hybrid install pipeline

Frontend: `QuackStorePanel.runInstall` → `quackExtensions.install` → Rust
`quack_extensions_install`.

Rust `pip_install` order (PEP 668 / Homebrew safe):

1. `pipx install <package>` when `pipx` on PATH
2. `python3 -m pip install --user <package>`
3. `python3 -m pip install --user --break-system-packages <package>`
4. `pip3 install --user` / plain `pip3 install`

Manual fallback suggestion: `pipx install skillopt` (not bare `pip install`).

`cargo_install`: `cargo install <crate>` with manual fallback string.

After success, frontend re-runs `quack_extensions_status` — if CLI still not
detected, shows error: install finished but binary missing (restart Quack / run
manual command / Refresh).

## CLI detection (Rust)

`resolve_on_path(name)` checks, in order:

- `~/.local/bin/<name>` (pipx / pip --user scripts)
- `~/.cargo/bin/<name>`
- `sh -lc 'command -v <name>'`

Version via `<exe> --version`. Pinky also reports `workspace_ready` when
`brain.db` or `.mcp.json` exists under project root.

## Brain hub

`BrainPanel` loads installed set → `brainSegmentExtensions(catalog)` → pill tabs
(Knowledge / Skills). Panels extracted:

| Segment | Panel | Extension |
|---|---|---|
| Knowledge | `BrainKnowledgePanel` | `pinky-brain` — search, dashboard, setup (see `054`) |
| Skills | `BrainSkillPanel` | `skill-trainer` — SkillOpt status, dry-run, adopt |

Empty hub: CTA “Open Quack Store”. Per-workspace active segment in module
`viewByWs` map.

## Chat gating

| Mechanism | File | Rule |
|---|---|---|
| `isExtensionInstalled(root, id)` | `extensionGate.ts` | 30s TTL cache over `quack_extensions_status` |
| Pre-turn Pinky inject | `AIChatPanel` | `pinky-brain` installed |
| Brain save chips | `BrainSaveChip`, `brainPrompt.ts` | `pinky-brain` |
| Skill proposal chip | `SkillProposalChip` | `skill-trainer` + foreground poll |

`invalidateExtensionCache()` after install/adopt.

## Rust commands (`quack_modules.rs`)

| Command | Args | Returns |
|---|---|---|
| `quack_extensions_status` | `root` | `ExtensionStatusRow[]` |
| `quack_extensions_install` | `{ kind: pip\|cargo, package\|crate_name }` | `InstallResult` |
| `skillopt_sleep_status` | — | `SkillOptSleepStatus` |
| `skillopt_sleep_dry_run` | — | `SkillOptRunResult` |
| `skillopt_sleep_adopt` | — | `SkillOptRunResult` |

Registered in `lib.rs`. Long work on `spawn_blocking`.

## TypeScript IPC

| Module | Role |
|---|---|
| `quackExtensions.ts` | `status`, `install`, `statusMap`, `installedIds` |
| `skilloptSleep.ts` | Thin wrappers for sleep commands |
| `brainPrompt.ts` | Jack prompt block when Pinky extension present |

## State / commands

| Key | Location |
|---|---|
| `storeKey(wsId)` → `store:<wsId>` | `store.ts` |
| `storeOpen(wsId)` | Opens/focuses store tab in active pane |
| `view.quack_store` | `actions.ts` — palette + menu |

## Gotchas

| Issue | Mitigation |
|---|---|
| macOS PEP 668 blocks `pip install --user` | Prefer `pipx`; Rust tries pipx first |
| Install click “does nothing” | Was: error phase cleared when `busyId` reset — fixed: `rowPhase()` reads `phases[id]` when not busy; error block shows whenever `errorMsg` set |
| Grid row layout misaligned text | Replaced with single flex row + one subtitle line |
| GUI app PATH ≠ terminal | Detect uses explicit `~/.local/bin` + `~/.cargo/bin`, not only `PATH` |
| `external` install method | Skipped in auto loop — docs link only |

## Files

| Concern | Path |
|---|---|
| Types + catalog | `src/quackStore/types.ts`, `catalog.ts` |
| IPC (TS) | `src/quackExtensions.ts`, `src/skilloptSleep.ts` |
| Extension gate | `src/extensionGate.ts` |
| Jack prompt gate | `src/brainPrompt.ts` |
| Rust bridge | `src-tauri/src/quack_modules.rs` |
| Store UI | `src/components/QuackStorePanel.tsx`, `StoreExtensionRow.tsx` |
| Brain hub | `src/components/BrainPanel.tsx`, `BrainKnowledgePanel.tsx`, `BrainSkillPanel.tsx` |
| Chat chip | `src/components/SkillProposalChip.tsx` |
| Tab wiring | `store.ts`, `WorkspaceShell.tsx`, `PaneNode.tsx`, `ActivityBar.tsx` |
| Styles | `src/App.css` (`.store-*`, `.brain-hub-*`) |

## Related

- `054-pinky-brain-integration.md` — Pinky CLI bridge (Knowledge segment internals)
- `020-context-optimizer.md` — context cache invalidated on skill adopt
- `015-claude-permission-mode.md` — SkillOpt proposals reviewed before adopt (user click)
