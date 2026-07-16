---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-07-11
last_verified: 2026-07-16
tags: [workspace, switch, performance, monaco, tabs, multitask, mount-asymmetry]
---

## Workspace Switch Performance
**Purpose:** Keep project switching snappy when multiple workspaces are open and/or many editor tabs are pinned — gate heavy UI and background polls to the foreground workspace without breaking multitask agents, terminals, or file buffers.
**Stack:** `App.tsx` stacked shells, `WorkspaceShell`, `AIChatPanel`, Zustand `activeId`

### Problem (2026-07-11)
| Symptom | Root cause |
|---|---|
| Slow ActivityBar project switch with 3+ open workspaces | Each background `WorkspaceShell` kept sidebar + Monaco + tab portals mounted (`display:none` only) |
| Slow switch into a project with many open tabs | Same shell weight + all non-active special-tab portals mounted (`sub:`, `crev:`) + synchronous Monaco layout blocking tab chrome |
| Background CPU/IPC after first perf pass | Every mounted `AIChatPanel` polled CC JSONL (`listSessions` + `drawerStats`), plan limits, Ollama, model discovery — not Pinky Brain (pre-turn only) |

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Hook | `src/useWorkspaceHeavyMount.ts` | `useWorkspaceHeavyMount(isActive) → { showHeavy, editorsReady }` |
| Component | `src/components/WorkspaceShell.tsx` | Stacked shell; gates sidebar, editors, tab portals on `showHeavy` / `editorsReady` |
| Component | `src/components/AIChatPanel.tsx` | `wsActive = activeId === wsId`; gates usage/discovery polls |
| Store | `src/store.ts` | `setActiveWorkspace(id)` — `clearEditorState()` + `persistIdx` (200 ms debounce) |
| Component | `src/App.tsx` | `shellOrder` stable DOM order; `isActive={id === activeId}` per shell |

### Data Flow
**Project switch (ActivityBar / hub / palette):** click → `setActiveWorkspace(wsId)` → `activeId` update → previously active shell `isActive: false`, incoming `isActive: true` → `useWorkspaceHeavyMount` on each shell

**Foreground shell (`isActive: true`):** `showHeavy: true` immediately → tab bar + `PaneNode` paint → 2× `requestAnimationFrame` → `editorsReady: true` → `EditorPane` / media portals mount → catch-up usage polls in `AIChatPanel`

**Background shell (`isActive: false`):** `editorsReady: false` immediately → after **300 ms** `showHeavy: false` → sidebar, Monaco, tab portals unmount; shell wrapper + tab bar DOM + pane containers stay (terminals)

**AI multitask (unchanged):** side-panel `AIChatPanel` stays mounted per open workspace; stream + `persistTranscript` (5 s while streaming) run in background; `AIChatHost` tab rows still gated `isActive &&` only

### `useWorkspaceHeavyMount` contract
| Flag | When true | Gated surfaces |
|---|---|---|
| `showHeavy` | `isActive` or within 300 ms grace after blur | `SidebarStack`, all tab-portal walks (`sub:`, `crev:`, `prev:`, `wb:`, `sess:`, `usage:`, `brain:`), terminal `visible` bit |
| `editorsReady` | `isActive` && after 2× rAF | `EditorPane`, `MediaPreviewPane` file editors only |

Constants: `UNMOUNT_DELAY_MS = 300`.

### `WorkspaceShell` gates (`showHeavy` / `editorsReady`)
| Surface | Gate | Intentionally NOT gated |
|---|---|---|
| `SidebarStack` | `showHeavy` | — |
| File `EditorPane` / `MediaPreviewPane` | `showHeavy && editorsReady` | — |
| `AIChatHost` (editor AI tabs) | `isActive` (immediate) | — |
| Side `AIChatPanel` | — | background agent streams |
| `TerminalCore` | `visible` includes `showHeavy` | component stays mounted; pane containers preserved |
| `SubagentTranscriptView` | `showHeavy && visible` (active tab only) | was mounting all open `sub:` keys |
| `ComposeReviewPane` | `showHeavy && visible` | was mounting all open `crev:` keys |
| `PaneNode` / tab bar | always | user sees tab strip on switch-in |

### `AIChatPanel` foreground gates (`wsActive` **+ `chatVisible`**)
The three CC disk/usage/auth polls now also gate on `chatVisible`, so only the
**foreground visible** chat polls — hidden multitask tabs in the active
workspace stay mounted (fast switch) but go quiet (was: every mounted CC panel
in the active workspace ran its own trio).

| Effect | Interval / trigger | Gated? |
|---|---|---|
| Disk JSONL hydrate (`guessClaudeSessionId`, `drawerStats`) | 12 s + on activate | yes — `wsActive && chatVisible`, catch-up on switch-back |
| Plan limits (`claude_usage_limits`) | 30 s | yes — `wsActive && chatVisible` |
| Claude auth probe | 60 s | yes — `wsActive && chatVisible` |
| Ollama auto-retry loop | 4 s → 30 s backoff | yes |
| Model discovery `refresh({ force: false })` | on `wsActive` | yes; global `subscribeModelDiscovery` stays |
| Rules file probe | on `root` change | yes |
| `setWorkspaceRoot` global | on focus | yes — fixes wrong cwd when multiple panels mounted |
| Streaming transcript checkpoint | 5 s while streaming | **no** — multitask |
| `registerChatPersist` | debounced saves | **no** |

### Key Functions
- `useWorkspaceHeavyMount(isActive: boolean) → WorkspaceHeavyMount` — heavy UI lifecycle
- `setActiveWorkspace(id) → Promise<void>` — focus switch + `clearEditorState()`
- `wsActive` in `AIChatPanel` — `useStore(s => s.activeId === wsId)`

### State
- `activeId`: string | null — foreground workspace (global)
- `showHeavy` / `editorsReady`: per-`WorkspaceShell` instance (component)
- `wsActive`: per-`AIChatPanel` derived (component)
- Monaco text models: global per path — survive editor unmount via `keepCurrentModel` (`editorState.ts`)

### Gotchas
- **Do not unmount `PaneNode` / bottom panel** on blur — `TerminalCore` portals need stable `pane-content` refs; see comment in `WorkspaceShell.tsx` (same class of bug as xterm re-open).
- **Do not gate side `AIChatPanel`** on `showHeavy` — user can multitask agents across projects; only polls are gated.
- **Pinky Brain is unrelated** to switch slowness — `pinky.search` runs pre-turn on send; `BrainPanel` only when `brain:` tab active + `showHeavy && visible`.
- **Many tabs still cost tab-bar DOM** — one `EditorPane` per pane (active file only); further win = tab-bar virtualization (not done).
- **300 ms unmount delay** — brief overlap if user rapid-fires project icons; incoming shell paints first by design.
- **Monaco DOM order** — `App.tsx` `shellOrder` append-only; never reorder shells on drag-reorder (`012-workspace-reorder.md`).

### Related
- Startup + inactive shell note (updated): `032-startup-hydration.md`
- Session usage polls + JSONL hydrate: `023-session-usage-panel.md`
- Workspace icon reorder (stable shell mount): `012-workspace-reorder.md`
- Chat panel mount asymmetry: `001-ai-session-library.md`
- Process cleanup (PTY survives tab unmount): `046-process-cleanup.md`
- Diary: `documentation/diary/2026-07-11.md`
