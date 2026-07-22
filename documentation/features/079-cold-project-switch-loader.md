---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-07-17
last_verified: 2026-07-21
status: removed
tags: [workspace-switch, loader, perceived-performance, workspace-colors, veil, branding, removed]
---

## Cold project-switch loader — REMOVED

**Removed 2026-07-21.** The full-window branded wash on cold project switches
felt like it cost more time than it saved: once revealed, `MIN_VISIBLE_MS` (320)
kept the veil up even after editors were ready, plus fade-in/out (~220ms).
Warm LRU (`workspaceWarmSet`, last 3) already makes recent switches instant;
masking the rest with a floor was net-negative for perceived speed.

Deleted: `src/workspaceSwitchLoader.ts`, `src/components/WorkspaceSwitchVeil.tsx`,
`.ws-switch-veil*` CSS, begin/end hooks in `store.ts` / `WorkspaceShell.tsx` /
`App.tsx`. Switch-perf instrumentation (`switchPerf.ts`, `[switch-perf]` logs)
stays — useful to measure real cold-mount cost without a mask.

### Was

Mask cold-mount lag (Monaco + file-tree) with a project-colored full-window
wash. Sibling of `075-chat-switch-loader.md` (chat/session veil — still active).

Timing that caused the false wait: `SHOW_DELAY` 90 → reveal; `MIN_VISIBLE` 320
floor after reveal; `CAP` 2500.

### Related

| Doc | Link |
|---|---|
| Chat/session switch loader (still live) | `075-chat-switch-loader.md` |
| Switch performance (memo, warm-LRU) | `058-workspace-switch-performance.md` |
| Per-project colors | `002-workspace-colors.md` |
