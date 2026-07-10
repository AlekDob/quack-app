# AGENTS.md — Quack (desktop)

Operational guide for any AI agent or contributor working in this repo. For project vision,
brand, and architecture, read **[CLAUDE.md](CLAUDE.md)** first — this file is the short,
do-this/not-that companion.

## TL;DR

A ~30 MB Tauri 2 desktop code editor with first-class AI, being rebranded **Codetta → Quack**.
Stack: Rust backend (`src-tauri/`) + React 19 / TypeScript / Zustand frontend (`src/`), Monaco
editor, xterm terminals, **plain CSS with variables (no Tailwind)**. BYOK AI: Claude Code CLI,
Anthropic, OpenAI, Ollama.

## Setup & commands

Prereqs: Node 18+, Rust 1.77+ stable, Tauri OS prerequisites.

| Command | What it does |
|---|---|
| `npm install` | Install frontend deps |
| `npm run tauri dev` | Full app, Rust backend + hot reload (use this to verify changes) |
| `npm run dev` | Vite only (no Tauri shell) — fast UI iteration, no Rust commands |
| `npm run build` | Type-check + build frontend (catches TS errors) |
| `npm run tauri build` | Production installers → `src-tauri/target/release/bundle/` |
| `npm run build:mac:release:universal` | Signed + notarized universal `.dmg` (local; needs `.env`) |

macOS signing/notarization: see **[README-MAC.md](README-MAC.md)** and
`documentation/features/035-macos-release-notarization.md`.

Verify a change by running `npm run tauri dev` (or `npm run build` for a quick TS gate).

## Git / remote (Quack desktop fork)

Remote: `https://github.com/AlekDob/quack-app.git`

| Branch | Role |
|---|---|
| **Local `main`** | Desktop integration branch (merge topic work here) |
| **`origin/quack-1.0`** | **Push target** for desktop — tracks local `main` |
| **`origin/main`** | Other product line — **do not push desktop here** |

```bash
git checkout main && git merge feat/my-topic
git push origin main:quack-1.0   # or `git push` if upstream is quack-1.0
```

Full rationale: `documentation/decisions/003-git-remote-quack-1.0.md`.

## Where to work

| Task | Start here |
|---|---|
| Chat / streaming / tool calls | `src/components/AIChatPanel.tsx`, `src/components/chatToolRender.tsx`, `src/components/UserMessageBar.tsx`, `src/hooks/useUserBarSticky.ts` |
| Agent Mode layout & tasks | `src/components/AgentModeShell.tsx`, `src/agentMode.ts` |
| Sessions list / "library" | `src/components/AIChatsRail.tsx`, `src/chatHistory.ts`, `src/chatStoreCache.ts` |
| Chat disk persistence | `src-tauri/src/chat_store.rs`, `src/chatStoreCache.ts` — see `043` |
| CLI session bridge (CC/CU/OC) | `src-tauri/src/provider_sessions.rs`, `src/chatProviderRecovery.ts` — see `044` |
| Global state | `src/store.ts` |
| AI types / contracts | `src/ai.ts` |
| Theme & brand tokens | `src/App.css` |
| Dev vs production visual delta | `src/devMode.ts`, `src-tauri/build.rs`, `documentation/features/047-dev-build-indicator.md` |
| Rust commands / CC bridge | `src-tauri/src/lib.rs`, `src-tauri/src/claude_code.rs`, `src-tauri/src/sysmon.rs`, `src-tauri/src/pty.rs` |
| Workspace persistence | `src-tauri/src/workspace.rs` |
| Product name / icons | `index.html`, `src/App.tsx`, `src-tauri/tauri.conf.json`, `src-tauri/icons/` |

## Rules (hard constraints)

1. **Brand via the `brand-guidelines` skill** — invoke it before any visual change. Dark-first,
   monochrome + one accent `#f28c52`, liquid glass on static surfaces, no emoji in UI chrome.
2. **CSS variables only** — never hardcode a color/radius/shadow/blur. Tokens live in `App.css`.
3. **TypeScript strict, no `any`.** Files ≤ 600 lines, functions ≤ 20 lines.
4. **Keep it light** — don't pull heavy deps or features from `quack-app`; only visual identity.
5. **DRY & reuse** — extend existing components/CSS classes before adding new ones.
6. **Surgical diffs** — change only what the task needs; preserve surrounding style.
7. **Derive agent state from existing chat/stream state** — no parallel source of truth.
8. Conventional commits, DCO sign-off (`git commit -s`).

## Don't

- Don't introduce Tailwind, CSS-in-JS, or a second styling system.
- Don't hardcode the old VS-Code blue (`#007acc`) or any non-token color.
- Don't add telemetry, cloud sync, or a generic extension API (out of scope — see README).
- Don't leave "Codetta" strings in user-facing surfaces once rebranding a given area.
