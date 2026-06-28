# CLAUDE.md — Quack (desktop)

> Project blueprint. Read this first. Operational/build details live in [AGENTS.md](AGENTS.md).

## What this is

A lightweight desktop code editor with first-class AI — Tauri 2 + Rust backend, React 19
frontend, ~30 MB, no telemetry. Bring-your-own-model (Claude Code CLI, Anthropic, OpenAI,
Ollama). The codebase started as **Codetta** and is being rebranded into **Quack desktop**.

**The intent (Alek)**:
1. **Full rebrand → Quack.** "Codetta" disappears from the product surface — UI, title bar,
   `productName`, icons, README all become Quack. The repo/codename may stay `codetta` during
   transition, but everything the user sees is Quack.
2. **Keep it light.** From the existing heavy `quack-app` (`~/Desktop/Dev/Personal/quack-app/`)
   we port **only the visual identity** — colors, fonts, duck mascots, tone. No heavy features,
   no code dragged over. Quack desktop stays ~30 MB and fast.
3. **Agent state at a glance.** The headline feature: in the agent list (Agent Mode + the
   right-side sessions rail) every agent must show its live status immediately — *working*,
   *waiting for input* (a pending question or a permission request), or *done & idle*. Alek
   needs to read the room fast and jump to whichever agent needs him.

## Brand — Quack Design System

Full reference: **`documentation/features/003-design-system.md`** + `decisions/002`. Summary:

- **Premium minimal**, dark-first, with a full **light** sibling theme (System/Light/Dark).
- **Cursor-style neutral chrome (decided with Alek):** the UI is monochrome — `--accent` is a
  NEUTRAL grey, **not** orange. Real color appears ONLY on **per-project workspace badges**
  (chosen palette) and on semantic states. **Primary actions are monochrome** (`--primary-bg`
  = `--fg`: near-white in dark, near-black in light). Selections = neutral `--bg-hi` + thin trace.
- **Liquid glass** (translucent + blur) on static surfaces only (topbar, dropdowns, palette,
  popovers) — never on scrollable lists.
- **Native macOS window:** `titleBarStyle: Overlay` + `hiddenTitle` (rounded + traffic lights);
  custom chrome on Win/Linux (`lib.rs` strips decorations there).
- Fonts: `General Sans`/`Inter` UI, `JetBrains Mono` code. Radii 5/8/14/20 (+999 pill, +12 window).
- **No emoji in the UI chrome** — SVG icons only. Semantic colors for **meaning only**, sparingly.
- **All visual values via CSS variables** (`src/App.css`). Never hardcode a color/radius/shadow/blur.

> The `brand-guidelines` skill documents the original orange-accent system; the live product has
> since moved to the neutral Cursor-style chrome above (color is per-project). If you reintroduce
> the orange, it's a one-line token revert — see `features/003-design-system.md`.

**Duck mascots** (port from `quack-app/public/`): `duckdroid.png`, `cyberduck.png`,
`duck.png`, and `public/images/ducks/`. Use for app icon, empty states, first-run welcome.
Branding surfaces: `index.html` (`<title>`), `src/App.tsx` (title bar),
`src-tauri/tauri.conf.json` (`productName`), `src-tauri/icons/`, `src/App.css` (tokens).

## Architecture map (where things live)

Frontend `src/` (React 19 + TypeScript + Zustand, Monaco, xterm — **no Tailwind**, plain CSS):

| Concern | File |
|---|---|
| Global state (workspaces, panes, files, terminals) | `src/store.ts` |
| AI types — `ToolCall`, `ChatMessage`, `ChatStreamEvent` | `src/ai.ts` |
| Chat session model + localStorage persistence | `src/chatHistory.ts` |
| Agent Mode toggle (localStorage) | `src/agentMode.ts` |
| Main chat panel — streaming, tool calls, todos, status | `src/components/AIChatPanel.tsx` |
| Tool-call rendering (chips, diffs, running/done state) | `src/components/chatToolRender.tsx` |
| Agent-centric layout (rail + sessions + tasks) | `src/components/AgentModeShell.tsx` |
| Right-side sessions list ("library") | `src/components/AIChatsRail.tsx` |
| Workspace picker / library entry | `src/components/WorkspacePicker.tsx` |
| Design tokens + all component styles | `src/App.css` |
| Theme (System/Light/Dark) + `data-os` at boot | `src/theme.ts` |
| Per-project workspace colors (palette + persistence) | `src/workspaceColors.ts` |
| Workspace color popover (right-click) | `src/components/WorkspaceColorPopover.tsx` |

Backend `src-tauri/src/`: `lib.rs` (command registration), `claude_code.rs` (CC bridge),
`workspace.rs` (persistent workspace state → `workspaces.json` + per-ws `state.json`),
`pty.rs`, `git.rs`, `fs_ops.rs`, `search.rs`, `watcher.rs`.

## Agent-state model (the focus area)

Today the per-tool status exists inside the chat (`AIChatPanel` → `activeToolLabels` with
`status: "running" | "done" | "error"`; live todos in `AgentModeShell.AgentTasks`). What's
**missing** is a per-**session** status surfaced in the agent lists (Agent Mode sessions +
`AIChatsRail`). Target states, mapped to brand semantics:

| State | Meaning | Visual hint |
|---|---|---|
| `working` | streaming / running tools | animated, neutral (chrome is zero-orange now) |
| `needs-input` | pending question or permission request | `--warn`, attention |
| `idle-done` | finished, waiting for the user | `--ok` / neutral |
| `error` | run failed | `--err` |

Derive these from existing chat/streaming state — don't invent a parallel source of truth.
Pattern to clone: `src/aiTaskStore.ts` (module-level pub/sub keyed by chatId). Design:
`decisions/001-agent-status-indicators.md`. Still TODO (the headline feature).

## Conventions (The 4 Laws)

1. Functions ≤ 20 lines. 2. Files ≤ 600 lines. 3. Domain-driven organization (by feature).
4. Self-documenting names (`verbNoun`, `PascalCase`, `UPPER_SNAKE`).

- TypeScript strict, **no `any`**. CSS variables only (no hardcoded visual values).
- DRY: extract repeated logic/markup into functions/components/constants. Reuse before writing.
- Comments explain the **why** (intent, constraint, gotcha): IT for business, EN for tech.
- Docs & code in English; UI copy Italian-first (English planned).
- Conventional commits (EN), DCO sign-off (`git commit -s`) — upstream Codetta requires it.

## Knowledge Base (documentation/)

- `documentation/features/` — map of the product's durable parts (one doc per component).
  - `001-ai-session-library.md` — sessions/agents lists, persistence, mount-asymmetry gotcha.
  - `002-workspace-colors.md` — per-project color (right-click popover + palette).
  - `003-design-system.md` — tokens, themes, neutral chrome, liquid glass, native window, composer, pill tabs.
  - `004-subagent-mentions.md` — `@`-mention subagents + click a Task chip to open its read-only transcript tab.
  - `005-jack-duck-identity.md` — the assistant IS Jack (duck PM): persona, `AIIcon` duck mark, chat header.
- `documentation/decisions/` — architectural rationales.
  - `001-agent-status-indicators.md` — the per-session agent-status design (the focus feature).
  - `002-ui-styling-rebrand-not-rewrite.md` — why CSS-token rebrand, not Tailwind/shadcn.
- `documentation/diary/YYYY-MM-DD.md` — daily changelog. Append after non-trivial work.

## Working agreement

- **APATR-D**: Analyze → Plan → Act → Test → Review → Document. Investigate before editing.
- Simplicity first, surgical changes — touch only what the task needs; keep Quack light.
- After non-trivial work, add a diary entry under `documentation/diary/YYYY-MM-DD.md`.
- Keep this file evergreen — no volatile line numbers; point at files, not lines.
