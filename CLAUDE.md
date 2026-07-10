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
| Per-provider agent session ids (resume) | `src/providerSession.ts` |
| Agent Mode toggle (localStorage) | `src/agentMode.ts` |
| Main chat panel — streaming, tool calls, todos, status | `src/components/AIChatPanel.tsx` |
| Editor tab toolbar — md/mmd Edit/Split/Preview, git Changes, Save | `src/components/EditorTabToolbar.tsx`, `EditorPane.tsx`, `editorMdView.ts`, `editorMermaidView.ts`, `MermaidPreview.tsx`, `editorGitDiff.ts` |
| Editor color themes (Monaco syntax, per light/dark) | `src/editorColorThemes.ts`, `src/monacoThemeRules.ts`, `src/vscodeThemeBundles.ts`, `src/editorMonoFont.ts`, `src/useResolvedEditorColorTheme.ts` |
| Tool-call rendering (chips, diffs, running/done state) | `src/components/chatToolRender.tsx` |
| Markdown renderer + copyable code blocks | `src/markdown.ts`, `src/components/MarkdownPreview.tsx`, `src/chatFileLinks.ts` |
| Agent-centric layout (rail + sessions + tasks) | `src/components/AgentModeShell.tsx` |
| Right-side sessions list ("library") | `src/components/AIChatsRail.tsx` |
| Workspace picker / library entry | `src/components/WorkspacePicker.tsx` |
| Design tokens + all component styles | `src/App.css` |
| Theme (System/Light/Dark) + `data-os` at boot | `src/theme.ts` |
| Per-project workspace colors (palette + persistence) | `src/workspaceColors.ts` |
| Workspace color popover (right-click) | `src/components/WorkspaceColorPopover.tsx` |
| Subagent discovery + `skills:`/`path` parsing | `src/subagents.ts` |
| Skill discovery | `src/skills.ts` |
| Model picker / browser / visibility | `src/components/ModelPickerPopover.tsx`, `ModelBrowser.tsx`, `ManageModelsModal.tsx`, `src/modelPrefs.ts` |
| Whiteboard tab — organigramma + DnD + .md export | `src/components/WhiteboardPane.tsx`, `src/components/WhiteboardOrganigramma.tsx`, `src/whiteboardMd.ts`, `src/frontmatter.ts` |

Backend `src-tauri/src/`: `lib.rs` (command registration), `claude_code.rs` (CC bridge),
`cursor_code.rs` (Cursor CLI bridge), `opencode_sidecar.rs` (OpenCode HTTP sidecar),
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
- **This app's UI is in ENGLISH.** EVERY user-facing string the app renders — button
  labels, tab names, dropdown options, tooltips/`title`, empty/loading/error states,
  summary labels, placeholders — MUST be in English. This OVERRIDES the global
  "Italian-first" default: Quack desktop (Codetta) ships English UI. Never write
  Italian UI copy here. (Code, identifiers, comments and docs are English too.)
- Conventional commits (EN), DCO sign-off (`git commit -s`) — upstream Codetta requires it.

## Knowledge Base (documentation/)

- `documentation/features/` — map of the product's durable parts (one doc per component).
  - `001-ai-session-library.md` — sessions/agents lists, persistence, mount-asymmetry gotcha.
  - `002-workspace-colors.md` — per-project color (right-click popover + palette); title-bar ambient wash when active project has a color.
  - `003-design-system.md` — tokens, themes, neutral chrome, liquid glass, native window, composer, pill tabs.
  - `004-subagent-mentions.md` — `@`-mention subagents + click a Task chip to open its read-only transcript tab.
  - `005-jack-duck-identity.md` — the assistant IS Jack (duck PM): persona, `AIIcon` duck mark, chat header.
  - `009-agent-hub.md` — the cross-project status hub (right rail): groups, `AgentHubWatcher`, notifications, lifecycle.
  - `006-chat-tool-render.md` — chat tool-call rendering (pills, result drawer, diff modal).
  - `007-native-macos-menu.md` — macOS uses the native system menu bar (built from the command registry); the in-window `TopBar` menus are hidden there, kept on Win/Linux.
  - `008-skill-slash-menu.md` — Claude Code skills in the `/` menu (lightning icon + orange, name only), loaded from `.claude/skills/`, dispatched like CC commands.
  - `010-project-dock.md` — floating always-on-top Dock window (per-project circles + counters) + native macOS Dock-icon badge.
  - `011-command-palette.md` — Ctrl/⌘P overlay (workspaces/files/commands/symbols/search), Cursor-style rows + leading icons.
  - `012-workspace-reorder.md` — drag-to-reorder the activity-bar project icons (pointer-events, NOT HTML5 DnD — broken in WKWebView; Monaco DOM-move crash gotcha).
  - `013-file-type-icons.md` — per-type icons in the file tree (`fileIconName` map); monochrome shapes only, no Seti-style color (brand rule).
  - `014-claude-code-bridge.md` — CC CLI bridge: spawn/stream/attach + Stop. **Stop kills the whole process group** (no orphaned tool children pinning the CPU); `children` map holds pids, not lockable `Child`s.
  - `015-claude-permission-mode.md` — per-chat permission mode (Ask/Plan/Auto-edit/Auto/Bypass); `permModeStore` bridges the composer mode to `ClaudePermissionOverlay`, the single auto-allow authority.
  - `016-image-attachments.md` — paste/drag up to 10 images into a Claude Code chat; client-side compression, on-disk temp storage, path inlined for CC's Read tool, in-message thumbnails + zoom modal.
  - `017-media-preview.md` — open images + PDFs as a read-only preview tab from the file tree (replaces the "File appears to be binary" toast); `mediaKindOf` classifier, `MediaPreviewPane`, empty-sentinel buffer.
  - `018-whiteboard-organigramma.md` — Whiteboard editor tab (Jack → agents → skills tree), HTML5 DnD that writes `skills:` into the agent's `.md` frontmatter in place, operational `.md` export (`renderWhiteboardMd`, save to `.codetta/whiteboard.md`).
  - `019-usage-monitor.md` — Usage tab (live Claude Code cost/session monitor + chunked transcript viewer); opens as a tab like the whiteboard; the freeze fix (mtime gate + cache-on-success + `spawn_blocking`).
  - `020-context-optimizer.md` — Usage tab "Context" view: measures per-skill/subagent system-prompt weight (~char/4) + real invocation count (from transcripts), ranks heavy-but-unused skills, per-skill visibility toggle writing `skillOverrides` in `~/.claude/settings.json` (`name-only`/`user-invocable-only`); click a row → open its `.md` + reveal in tree via shared `openFileAndReveal`.
  - `054-pinky-brain-integration.md` — Pinky Brain tab + Rust CLI bridge: hybrid `brain_search`, pre-turn chat injection, MCP setup, `~/.quack/brain` → `~/.pinky/brain` migration.
  - `021-chat-nav-rail.md` — Codex-style navigation rail (minimap) in the chat's right gutter: one tick per user turn (from `data-anchor-*` on messages), hover to preview, click to jump, active tick tracks the turn in view.
  - `022-chat-composer.md` — roomier "spaceship" composer: single-row uniform toolbar, subagent target pill (`SubagentPill`, derived from `attachedAgents`), one effort+thinking popover (`EffortPopover`, slider + segmented), voice dictation (`ComposerMic` + `ComposerDictationBar`, feature 052), `+` attach, hint row, transparent flush textarea; **live turn status dock** (`.ai-status-dock`) above the composer; **per-project context dock** on the right of the same row (`ContextFilesDock`, `workspaceChatContext.ts`); **context usage ring** (CC) + drawer — `023-session-usage-panel.md`.
  - `024-resume-white-screen-recovery.md` — detect resume from macOS standby (`resumeDebug.ts`), heal the blank webview (Monaco `layout()` / xterm `fit()` + synthetic resize), log every event to console **and** a durable `localStorage` ring (`__resumeLog()`). Gotcha: a Vite compile error also blanks the page but never fires `[resume]` — check the red overlay first.
  - `025-model-selector.md` — composer chip popover (favorites + groups), full ModelBrowser catalog, ManageModelsModal visibility toggles; prefs in `lcp.modelFavorites` / `lcp.modelDisabled`.
  - `026-cursor-cli-bridge.md` — `cursor-agent` spawn/stream/kill + lazy `--list-models`; shared `cliStreamJson` parser.
  - `027-editor-tab-toolbar.md` — editor tab row under breadcrumb: markdown + mermaid Edit/Split/Preview, git Changes (HEAD vs buffer), Inline/Split diff layout, Save; shared with `FileEditorPane` modals.
  - `042-mermaid-preview.md` — `.mmd` tabs: lazy `mermaid` SVG render, default Preview mode, syntax errors inline; `MermaidPreview`, `editorMermaidView.ts`.
  - `045-html-preview.md` — HTML browser preview: agent drawer + `prev:` virtual tabs + `.html` Edit/Split/Preview; sandboxed iframe (`HtmlPreviewFrame`, `htmlPreview.ts`).
  - `046-process-cleanup.md` — Task Manager (Quack-scoped process tree, Ctrl+Alt+U); PTY process-group kill on terminal close; agent stop on archive/done/close chat (`stopChatAgent`, `aiStopBus`).
  - `047-dev-build-indicator.md` — dev-only Dock icon + in-app DEV badge/border/title when running `npm run tauri dev`; debug `build.rs` icon swap via `TAURI_CONFIG`.
  - `048-background-task-wake.md` — Claude Code `-p` background Bash/subagent wake: spawn env (`PRINT_BG_WAIT_CEILING_MS`, `RESUME_INTERRUPTED_TURN`) + `backgroundWake.ts` auto `--resume` nudge when headless turn ends idle.
  - `049-markdown-renderer.md` — dependency-free Markdown → HTML for chat, editor preview, tool drawers; fenced code blocks as copyable pills (icon row underneath) + single-line shell token coloring.
  - `023-session-usage-panel.md` — composer context ring + Context & Usage drawer (CC): last-API `contextTokens` snapshot vs turn-total billing; plan limits poll; `contextUsage.ts`, `SessionUsageCircle`, `SessionUsageDrawer`.
  - `050-composer-context-bar.md` — Cursor-style path + git branch inside the composer pill; portaled menus, project switch, shared `GitBranchPicker`.
  - `051-agent-commit-dock.md` — agent Bash `git commit` pill above the composer (hash, message, time, pushed/local); `agentCommitDetect.ts`, `agentCommitStore.ts`, `AgentCommitDock.tsx`.
  - `053-composer-git-actions.md` — Cursor-style changed-files + Commit & Push split control inside the composer pill; `git_diff_stat`, `ComposerGitActions.tsx`, `composerGitOps.ts`.
  - `052-composer-voice-dictation.md` — Cursor-style composer mic: waveform row, native macOS `SFSpeechRecognizer` + Web Speech on Windows; `dictation.ts`, `dictation.rs`, `ComposerMic.tsx`.
  - `028-opencode-bridge.md` — `opencode serve` sidecar (port 17346), SSE `/global/event`, `providerSessionIds`, lazy startup catalog.
  - `029-session-diff-hub.md` — Agent Hub expanded-row edit subtitles (`Edited foo.ts −N +M`); `chatDiffStore` pub/sub + `summarizeLastTurn`.
  - `030-user-message-bar.md` — user turns as inset cards; sticky pin per turn + tall-prompt collapse while stuck (`UserTurnBar`, `useUserBarSticky.ts`).
  - `031-model-discovery-cache.md` — shared provider/model probe cache (`modelDiscoveryStore`); prefetch at splash; lazy cloud + CLI catalogs; invalidation on API-key edit / force refresh.
  - `032-startup-hydration.md` — splash gate, parallel workspace restore, overlap with model prefetch.
  - `033-editor-color-themes.md` — VS Code bundled Monaco syntax themes; Monaco-compatible token rules (`monacoThemeRules.ts`), live `setTheme`, JetBrains Mono `fontFamily`; per-mode picker + separate light/dark persistence.
  - `034-explorer-tree.md` — file tree layout (indent guides, overflow/ellipsis), theme-aware git decorations (`--git-*`), auto-reveal on tab switch; pairs with `013-file-type-icons.md` tints.
  - `035-macos-release-notarization.md` — local signed/notarized `.dmg` pipeline (`sign-and-notarize.sh`, `.env`, Entitlements); CI macOS still unsigned.
  - `036-agent-customizations.md` — Agent Customizations footer (hub + agent mode) + tabbed modal (instructions, skills, MCP, providers, privacy).
  - `037-project-context-dock.md` — per-workspace "N files in context" pill in the composer status row (right); hover popover lists active editor attach + `@`-queued files; `workspaceChatContext.ts` + `isUnderRoot` guards prevent cross-project bleed from the global editor singleton.
  - `039-composer-queue.md` — Cursor-style follow-up queue inside the composer pill: visible preview, `Send follow-up` placeholder, Start Multitasking (new chat parallel send / send now), auto-drain on turn end; `ComposerQueue.tsx`, optional `chatId` on `aiBus`.
  - `040-per-session-composer-state.md` — per-session composer draft (input, queue, images, attach toggles), CC knobs (effort/mode/thinking), model restore; `composerDraft.ts` (`mergeComposerDraft`, `mergeSessionKnobs`), fields on `ChatSession`; legacy knob fallback + debounce-unmount flush gotchas.
  - `043-chat-transcript-persistence.md` — disk-backed per-session transcripts (`chat_store.rs`), legacy localStorage migrate, `provider-links.json` reverse index, flush on switch + streaming checkpoint, save-failure toast.
  - `044-provider-session-bridge.md` — unified CLI session bridge (CC/CU/OC): chip, multi-provider ⟲ Sessions picker, `provider_sessions.rs`, thin-row recovery via `chatProviderRecovery.ts`.
  - `041-mention-file-preview.md` — Cursor-style `@` file autocomplete: basename + parent dir rows, side path tree preview, inline popover above composer, `.ai-mention-open` overflow escape (no portal).
  - `038-compose-review.md` — Conductor-style agent edit review: live ComposeCard recap, `crev:` diff tabs (inline Monaco + Undo/Keep), editor pane + Agent Mode 50/50 split; `composeReview.ts`, `ComposeReviewPane.tsx`.
- `documentation/design/` — UI style contracts beyond tokens.
  - `directives.md` — hard rules (no emoji, tokens-only, neutral chrome).
  - `model-modal-pattern.md` — shared shell for Choose a model + Manage models (liquid glass, pill controls, light/dark surfaces).
- `documentation/decisions/` — architectural rationales.
  - `001-agent-status-indicators.md` — the per-session agent-status design (the focus feature).
  - `002-ui-styling-rebrand-not-rewrite.md` — why CSS-token rebrand, not Tailwind/shadcn.
  - `003-git-remote-quack-1.0.md` — desktop pushes to `origin/quack-1.0`; leave GitHub `main` alone (unrelated embedded-cli history).
- `documentation/diary/YYYY-MM-DD.md` — daily changelog. Append after non-trivial work.

## Working agreement

- **APATR-D**: Analyze → Plan → Act → Test → Review → Document. Investigate before editing.
- Simplicity first, surgical changes — touch only what the task needs; keep Quack light.
- After non-trivial work, add a diary entry under `documentation/diary/YYYY-MM-DD.md`.
- Keep this file evergreen — no volatile line numbers; point at files, not lines.
@.claude/rules/use-pinky-brain.md
