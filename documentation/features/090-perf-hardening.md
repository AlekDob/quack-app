---
type: feature-doc
project: quack-desktop
stack: Tauri + React
created: 2026-07-22
startDate: 2026-07-22
endDate: 2026-07-22
last_verified: 2026-07-22
status: active
tags: [performance, startup, bundle, monaco, xterm, streaming, re-render, spawn_blocking, lazy]
related:
  - 032-startup-hydration.md
  - 058-workspace-switch-performance.md
  - 069-smooth-streaming.md
  - 076-chat-lazy-hydrate-done-unload.md
  - 077-fs-watcher-git-status.md
  - 086-perf-audit-window.md
  - 019-usage-monitor.md
---

## Perf hardening (2026-07-22)

**Purpose:** Remove the residual set of things that still made the window slow or
frozen after the earlier perf work (windowing 080, warm-mount 058, rAF 069,
watcher 077). Four independent phases, each reusing an existing in-repo pattern.

### Phase 1 — Backend freezes (Rust: async + `spawn_blocking`)

Tauri dispatches non-`async` `#[tauri::command]` on the MAIN thread. Pattern reused:
`git.rs::off_thread`.

| Command(s) | File | Was blocking on | 
|---|---|---|
| `claude_usage_limits`, `claude_auth_status` | `claude_usage.rs` | HTTP (ureq, 10s×3) polled 30/60s → ~30s freeze offline |
| `claude_code_list_sessions`, `claude_code_load_session`, `claude_session_context_usage`, `claude_code_load_subagent` | `claude_code.rs` | full JSONL parse |
| `claude_session_load_turns`, `claude_session_drawer_stats` | `claude_sessions.rs` | full parse; drawer polled 12s |
| `list_dir`, `read_image_data_url` | `fs_ops.rs` | `read_dir`+per-entry stat / binary read+base64 |

- `drawer_stats` also now reads the file ONCE: new `summarise_jsonl_str` +
  `last_context_snap_str` (`session_jsonl.rs`) share one `read_to_string`.
- No frontend change — `invoke()` is identical for async commands.

### Phase 2 — Startup + bundle

| Change | File | Effect |
|---|---|---|
| React.lazy wrappers for EditorPane / DiffView / SimpleMonacoEditor / FileEditorPane / TerminalCore | new `components/lazyHeavy.tsx` | Monaco (4.3MB) + xterm (333KB) leave the boot chunk |
| Isolate `react` chunk BEFORE monaco/mermaid (+ `vite/preload-helper`) | `vite.config.ts` | else Rollup hoists React runtime into monaco → entry statically imports it |
| Active-first hydrate | `store.ts` `hydrate` | read only the active ws (files+chat) before splash; rest in bg |
| Splash floor 700→350ms | `App.tsx` | gate stays adaptive upward |

**KEY INSIGHT:** `manualChunks` only *splits where code lands* — it does NOT defer.
The `modulepreload` drops only when (a) no static import chain from the entry
reaches the leaf AND (b) React is in its own chunk. Result: `index.html` preloads
only `react`; main `index` chunk 1.68MB → 1.13MB.

Leaf→leaf imports (EditorPane→DiffView, FileEditorPane→SimpleMonacoEditor) stay
static — those leaves are reached only via the dynamic boundaries. Lazy is
orthogonal to the Monaco DOM-move gotcha (012): it does not move DOM nodes.

### Phase 3 — Streaming

| Change | File |
|---|---|
| `tokensPerSec` / `lastStreamEventAt`: state → **ref** | `AIChatPanel.tsx` |
| Per-message memoized row derivation | new `chatRowDerive.ts` |
| `memo(InterleavedBlocks)` | `chatToolRender.tsx` |

- **Refs:** as state they fired a full render PER content delta, defeating the
  069 rAF painter. `TurnStreamStatus` reads them on the existing 1-Hz `nowTick`.
- **`deriveRow(m)` / `deriveToolMaps(m)`** (`chatRowDerive.ts`): the row renderer
  ran a batch of regex/parse passes (strip brain-save + works blocks, extract
  code + tagged blocks, split `<think>`, parse proposals) AND rebuilt three
  lookup Maps for EVERY windowed message on every streaming frame. Both are now
  memoized by message-object identity + content (WeakMap) → O(1) per frame (only
  the still-growing streaming message recomputes); committed rows hit the cache.
  Pure memo layer — same values, cached, so behavior is unchanged.
- **`memo(InterleavedBlocks)`**: with the stable-ref maps above, a committed
  assistant row's block subtree bails out instead of re-walking its blocks each
  frame. The streaming row (`streaming=true`, growing blocks) still re-renders.
- Vitest: `chatRowDerive.test.ts` (7 cases — cache identity + map building).

### Phase 4 — Fan-out re-renders + idle drains

| Change | File |
|---|---|
| `useChatHostLiveStatus` → `useSyncExternalStore` (per-chat snapshot bail-out) | `chatHostMount.ts` |
| `publishTasks` dedupe identical lists (`sameTasks`) | `aiTaskStore.ts` |
| Pause 1.5s hub poll when `document.hidden`; catch up on visibilitychange | `AgentHubWatcher.tsx` |
| PTY flusher blocks on `recv()` when idle (was 1ms busy-poll) | `pty.rs` |
| Memoize `TreeFilterContext` value | `FileTree.tsx` |

`agentStatusStore.notify()` stays unkeyed — the `useSyncExternalStore` snapshot
gives the bail-out without a store-signature change (safer vs concurrent WIP).

### Deferred (need in-app profiling / deeper study)

| Item | Why deferred |
|---|---|
| Cap `StreamBuffer.lines` (ring/byte budget or drop-on-attach) | Feeds live re-attach replay (`claude_code.rs`); a naive cap risks a gap in a long single turn after refresh — needs attach-flow study. |
| Keyed `agentStatusStore.notify(chatId)` + scope WorkspaceShell/AgentModeShell ticks | Marginal after the `useSyncExternalStore` fix; touches files under active WIP. |

> **Done since first draft:** the per-frame regex/map cost (originally deferred as
> "extract `renderAt` → memo") was instead solved with a WeakMap memo layer
> (`chatRowDerive`) + `memo(InterleavedBlocks)` — same win, far less risk than
> threading ~20 props out of the 8k-line closure. Confirm the render-count drop
> with the React Profiler / Perf Audit in the running app.

### Verification

`cargo check`; `tsc`; `npm run build` (inspect `dist/index.html` → only `react`
preloaded, no monaco/xterm/mermaid); `npm test` (163 passed). Cross-check CPU/RAM +
switch timings via the Perf Audit window (`086`).
