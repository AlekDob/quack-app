---
type: diary
project: codetta
date: 2026-07-10
---

- [08:25] (Alek) **Sticky user bar collapse on tall prompts.** Problem: Cursor-style `position: sticky` on `.ai-msg-user` hides assistant replies when the user paste is taller than the viewport (same bug class as VS Code `.stickyHeader`). Fix: `useUserBarSticky` — zero-height `.ai-user-bar-sentinel` sibling + `IntersectionObserver` (stuck) + `ResizeObserver` (>100px tall). While stuck+tall: `.is-compact` clamps to `min(35vh, 160px)` with bottom fade; chevron toggles `.is-expanded` (`min(60vh, 420px)` scroll); resets on unstuck. `UserTurnBar` owns sentinel+wrapper; `AIChatPanel` switched from inline markup. Docs: full rewrite `030`, cross-ref `021`, `AGENTS.md`, `CLAUDE.md`. Files: `hooks/useUserBarSticky.ts`, `UserMessageBar.tsx`, `AIChatPanel.tsx` (turn render only), `App.css`.
