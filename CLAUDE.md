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
| Jack + CC editor system prompts | `src/brainPrompt.ts` (`jackSystemPrompt`, `quackClaudeCodeEditorPrompt`) |
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
`cursor_code.rs` (Cursor CLI bridge),
`workspace.rs` (persistent workspace state → `workspaces.json` + per-ws `state.json`),
`pty.rs`, `git.rs`, `fs_ops.rs`, `search.rs`, `watcher.rs`.

## Agent-state model (the focus area)

Per-session status is surfaced in Agent Mode sessions + `AIChatsRail` via
`agentStatusStore` + `AgentHubWatcher` (feature `009`, decision `001`). States:

| State | Meaning | Visual hint |
|---|---|---|
| `working` | streaming / running tools | animated, neutral (chrome is zero-orange now) |
| `needs-input` | pending question or permission request | `--warn`, attention |
| `idle-done` | finished, waiting for the user | `--ok` / neutral |
| `error` | run failed | `--err` |

Derive these from existing chat/streaming state — don't invent a parallel source of truth.
Pattern: `src/aiTaskStore.ts` / `src/agentStatusStore.ts` (module-level pub/sub keyed by chatId).

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
  - `004-subagent-mentions.md` — `@`-mention subagents + click a Task chip to open its read-only transcript (tab or drawer; `TranscriptTurnRows` shares main-chat markup).
  - `005-jack-duck-identity.md` — the assistant IS Jack (duck PM): persona, `AIIcon` duck mark, chat header.
  - `009-agent-hub.md` — the cross-project status hub (right rail): groups, `AgentHubWatcher`, notifications, lifecycle.
  - `064-agent-hub-drawer-and-chat-tab-switch.md` — collapsed hover drawer, chat switch perf, pane tab visibility stacking; DONE hosts unload when hidden (`076`).
  - `075-chat-switch-loader.md` — gradual translucent veil on chat/session switch (fade + min-floor + cap in `chatSwitch.ts`, `ChatSwitchVeil`); perceived-performance polish. Pairs with the `044` freeze fix.
  - `081-chat-switch-chrome-freeze.md` — during the `075` veil, freeze sidebar/agent-context paint + skip Monaco `layout()` + defer FileTree `listDir` (`deferDuringChatSwitch.ts`) so transcript paint wins; same feel as Agent Mode / collapsed explorer without a permanent layout change.
  - `082-cursor-compact-action-stream.md` — Cursor-compact stream: live/past tool summaries (`isFlatBatch` solo vs group), Worked for / Thinking→Thought for, live shimmer, status-dock soft-reduce, `batchRenderCost` vitest.
  - `038-compose-review.md` — ComposeCard Files recap; IDE `crev:` diff tabs (Undo/Keep); **Agent Mode → DiffModal** (`openComposeDiffModal`); `composeReview.ts`, `ComposeReviewPane.tsx`.
  - `076-chat-lazy-hydrate-done-unload.md` — session index + on-demand bodies; DONE/archived chat hosts unmount when hidden; live stay sticky for multitask; `memo(AIChatHost)` so creating a chat doesn't re-render all mounted panels (`[new-chat-perf]` dev timing).
  - `006-chat-tool-render.md` — drawers, ComposeCard, AskQuestion, icon tones; chronology walker feeds 082 summaries.
  - `007-native-macos-menu.md` — macOS uses the native system menu bar (built from the command registry); the in-window `TopBar` menus are hidden there, kept on Win/Linux.
  - `008-skill-slash-menu.md` — Claude Code skills in the `/` menu (lightning icon + orange, name only), loaded from `.claude/skills/`, dispatched like CC commands.
  - `010-project-dock.md` — floating always-on-top Dock window (per-project circles + counters) + native macOS Dock-icon badge.
  - `011-command-palette.md` — Ctrl/⌘P overlay (workspaces/files/commands/symbols/search), Cursor-style rows + leading icons.
  - `012-workspace-reorder.md` — drag-to-reorder the activity-bar project icons (pointer-events, NOT HTML5 DnD — broken in WKWebView; Monaco DOM-move crash gotcha).
  - `013-file-type-icons.md` — per-type icons in the file tree (`fileIconName` map); monochrome shapes only, no Seti-style color (brand rule).
  - `014-claude-code-bridge.md` — CC CLI bridge: spawn/stream/attach + Stop. **Stop kills the whole process group** (no orphaned tool children pinning the CPU); `children` map holds pids, not lockable `Child`s; dynamic model catalog (`059`).
  - `015-claude-permission-mode.md` — per-chat permission mode (Ask/Plan/Auto-edit/Auto/Bypass); `permModeStore` bridges the composer mode to `ClaudePermissionOverlay`, the single auto-allow authority.
  - `016-image-attachments.md` — paste/drag up to 10 images into agentic chats (Claude Code, Cursor CLI); temp disk storage + provider-specific delivery.
  - `017-media-preview.md` — open images + PDFs as a read-only preview tab from the file tree (replaces the "File appears to be binary" toast); `mediaKindOf` classifier, `MediaPreviewPane`, empty-sentinel buffer.
  - `018-whiteboard-organigramma.md` — Whiteboard editor tab (Jack → agents → skills tree), HTML5 DnD that writes `skills:` into the agent's `.md` frontmatter in place, operational `.md` export (`renderWhiteboardMd`, save to `.codetta/whiteboard.md`).
  - `019-usage-monitor.md` — Usage tab (live Claude Code cost/session monitor + chunked transcript viewer); opens as a tab like the whiteboard; the freeze fix (mtime gate + cache-on-success + `spawn_blocking`).
  - `020-context-optimizer.md` — Usage tab "Context" view: measures per-skill/subagent system-prompt weight (~char/4) + real invocation count (from transcripts), ranks heavy-but-unused skills, per-skill visibility toggle writing `skillOverrides` in `~/.claude/settings.json` (`name-only`/`user-invocable-only`); click a row → open its `.md` + reveal in tree via shared `openFileAndReveal`.
  - `054-pinky-brain-integration.md` — Pinky Brain: hybrid search, opt-in inject gates, `#` composer cites, MCP setup, `~/.quack/brain` → `~/.pinky/brain` migration.
  - `072-composer-mention-chips.md` — Cursor-style in-composer chips for `#` brain, `@` files/agents; features/skills inline in textarea (`083`).
  - `083-composer-feature-link.md` — composer feature pill (fuzzy + infinite scroll), inline `@slug` highlight, drawer Monaco edit; hub **Feature** badge.
  - `059-quack-brain-store.md` — Quack Store editor tab (`store:<wsId>`), optional extension detect + hybrid install (pipx/cargo), Quack Brain hub segments, SkillOpt-Sleep bridge, gated chat chips.
  - `060-activity-bar-overflow.md` — dynamic view-icons: height-driven visible count, `…` overflow + always-on customize grip, two-zone drag reorder, sidebar vs tab visual split; `lcp.activityBar.*` prefs.
  - `061-plan-mode-tab.md` — Claude Code `ExitPlanMode` plan (inline markdown, never a file) opens as a `plan:` virtual tab forced into a split next to the chat (Cursor-style), as soon as it lands, independent of approve/deny.
  - `062-presets.md` — backend-agnostic preset system (Jack + Milo/Nora/Vera/Lia + user-created): model tier/effort/mode/instructions shaping the CURRENT session (not a subagent); Team drawer edits sync to live chat via `subscribePresetSettings`; one merged composer picker (`SubagentPill`: primary agents above, delegable subagents below); create/edit agents with avatars via `AgentCreateDrawer` in the Whiteboard organigramma (`.codetta/presets/`, separate from `.claude/agents/`); custom-preset instructions labeled unverified in the prompt (injection hygiene).
  - `021-chat-nav-rail.md` — Codex-style navigation rail (minimap) in the chat's right gutter: one tick per user turn (from `data-anchor-*` on messages), hover to preview, click to jump, active tick tracks the turn in view.
  - `022-chat-composer.md` — roomier "spaceship" composer: single-row uniform toolbar, subagent target pill (`SubagentPill`, derived from `attachedAgents`), one effort+thinking popover (`EffortPopover`, slider + segmented), voice dictation (`ComposerMic` + `ComposerDictationBar`, feature 052), `+` attach, hint row, transparent flush textarea; **live turn status dock** (`.ai-status-dock`) above the composer; **per-project context dock** on the right of the same row (`ContextFilesDock`, `workspaceChatContext.ts`); **context usage ring** (CC) + drawer — `023-session-usage-panel.md`.
  - `024-resume-white-screen-recovery.md` — detect resume from macOS standby (`resumeDebug.ts`), heal the blank webview (Monaco `layout()` / xterm `fit()` + synthetic resize), log every event to console **and** a durable `localStorage` ring (`__resumeLog()`). Gotcha: a Vite compile error also blanks the page but never fires `[resume]` — check the red overlay first.
  - `025-model-selector.md` — composer chip popover (favorites + groups), full ModelBrowser catalog, ManageModelsModal visibility toggles; prefs in `lcp.modelFavorites` / `lcp.modelDisabled`; **platform pin** for agentic CLIs (`057`); instant hydrate + CC dynamic names (`059`).
  - `026-cursor-cli-bridge.md` — `cursor-agent` spawn/stream/kill; dual parsers (Composer-native + Claude-shaped); images via path-in-prompt.
  - `056-reasoning-turn-chip.md` — Thinking / Thought for chip (client clock + CC keepalives); pairs with Worked for in 082.
  - `027-editor-tab-toolbar.md` — editor tab row under breadcrumb: markdown + mermaid Edit/Split/Preview, git Changes (HEAD vs buffer), Inline/Split diff layout, Save; shared with `FileEditorPane` modals.
  - `042-mermaid-preview.md` — `.mmd` tabs: lazy `mermaid` SVG render, default Preview mode, syntax errors inline; `MermaidPreview`, `editorMermaidView.ts`.
  - `045-html-preview.md` — HTML browser preview: agent drawer + `prev:` virtual tabs + `.html` Edit/Split/Preview; sandboxed iframe (`HtmlPreviewFrame`, `htmlPreview.ts`).
  - `046-process-cleanup.md` — Task Manager (Quack-scoped process tree, Ctrl+Alt+U); PTY process-group kill on terminal close; agent stop on archive/done/close chat (`stopChatAgent`, `aiStopBus`).
  - `047-dev-build-indicator.md` — dev-only Dock icon + in-app DEV badge/border/title when running `npm run tauri dev`; debug `build.rs` icon swap via `TAURI_CONFIG`.
  - `048-background-task-wake.md` — Claude Code `-p` background Bash/subagent wake: spawn env (`PRINT_BG_WAIT_CEILING_MS`, `RESUME_INTERRUPTED_TURN`) + `backgroundWake.ts` auto `--resume` nudge when headless turn ends idle.
  - `049-markdown-renderer.md` — dependency-free Markdown → HTML for chat, editor preview, tool drawers; fenced code blocks as copyable pills (icon row underneath) + single-line shell token coloring.
  - `023-session-usage-panel.md` — composer context ring + Context Usage popover (CC): last-API `contextTokens` snapshot, Cursor-style segmented breakdown, Usage tab for plan limits + billing; `contextUsage.ts`, `contextBreakdown.ts`, `SessionUsageCircle`, `SessionUsagePopover`.
  - `050-composer-context-bar.md` — Cursor-style path + git branch inside the composer pill; portaled menus, project switch, shared `GitBranchPicker`.
  - `051-agent-commit-dock.md` — agent Bash `git commit` pill above the composer (hash, message, time, pushed/local); `agentCommitDetect.ts`, `agentCommitStore.ts`, `AgentCommitDock.tsx`.
  - `053-composer-git-actions.md` — Cursor-style changed-files + Commit & Push split control inside the composer pill; `git_diff_stat`, `ComposerGitActions.tsx`, `composerGitOps.ts`.
  - `077-fs-watcher-git-status.md` — recursive FS watch with ignore filter + shared `gitStatusStore` (one status + one numstat); stops WebKit/git CPU storms on huge dirty trees.
  - `078-works-disk-sync.md` — Works persistence + FS-watch engine (`worksCache`/`worksWatch`/`works*Files`): changed-only writes, self-write echo guard (kills the `dir`→persist→`dir` loop), debounced refresh, memoized dir-ensure; bodies stay in RAM for progress/context.
  - `079-cold-project-switch-loader.md` — full-window branded wash (project-color gradient + badge) masking the cold-mount lag on switch into a non-warm project; `workspaceSwitchLoader` (grace/min-floor/cap) + `WorkspaceSwitchVeil`; warm projects stay instant. Sibling of `075`.
  - `080-transcript-windowing.md` — long chats render only the last `TURN_WINDOW=40` turns (`windowChatTurns` in `chatScroll.ts`) + "Show earlier" pill; fixes the main-thread stall when switching into a huge transcript; vitest regression (`npm test`, first test infra).
  - `054-works-layer.md` — **Features layer** (md-first): catalog of `documentation/features/*.md`, FeatureDocDrawer (Monaco edit), timeline, composer link (`083`); Plane board soft-sunset. Tab key `works:{wsId}`.
  - `067-agent-tasks-checklist.md` — Cursor-style collapsible task checklist (`AgentTasks` in `AgentModeShell.tsx`) below the sessions list, sourced from `aiTaskStore.ts` (TodoWrite/TaskCreate items published by `AIChatPanel.tsx`); collapsed by default, resets on `chatId` change.
  - `066-works-cycles-stories.md` — auto weekly **Cycles** (progress + burndown charts), Scrum **Stories** spawning backlog work items; storage at workspace `works/` (not `.quack/`).
  - `068-quack-plan-harness.md` — product-owned plan on stories (`S-NNN`): Jack PM; chat Work chrome / `StoryPlanDrawer` retired (2026-07-17) → Works story drawer + `WorksStoryChip`; `plan:` tab (`061`) fallback without `storyId`.
  - `069-smooth-streaming.md` — smooth assistant stream: rAF-coalesced paint + light inline MD on the live tail (no typewriter / no caret); full `MarkdownPreview` on turn commit.
  - `073-ask-user-question-dock.md` — Claude Code `AskUserQuestion`: Cursor-style interactive card above composer; hook `tool_input` cache + lenient parse; deny-redirect flow (015); `quackClaudeCodeEditorPrompt()` tells all CC agents to call the tool; subagents hand off to orchestrator (004).
  - `070-workspace-doc-open.md` — resolve doc paths from chat links and Context docs; route story → drawer, features → preview drawer, Agent Mode → tab drawer (`workspaceDocOpen.ts`).
  - `071-honest-model-labels.md` — CC display labels: Codetta-style Title Case alias (`Sonnet`); stable via `ccStableDisplayName` (no static version map / dual alias-vs-resolved layer).
  - `063-surface-view-prefs.md` — per-surface tab vs drawer default (Works / Brain / Team / **subagent transcripts**); Settings → Views; nested child-drawer stack.
  - `065-works-drawer-ux.md` — catalog list, draft create, Notion editor in drawer, module picker, nested drawer stack, overlay z-index (ctx menu + confirm).
  - `052-composer-voice-dictation.md` — Cursor-style composer mic: waveform row, native macOS `SFSpeechRecognizer` + Web Speech on Windows; `dictation.ts`, `dictation.rs`, `ComposerMic.tsx`.
  - `028-opencode-bridge.md` — **archived 2026-07-17** (OpenCode sidecar dropped; see `documentation/.archive/028-opencode-bridge.md`).
  - `029-session-diff-hub.md` — Agent Hub expanded-row edit subtitles (`Edited foo.ts −N +M`); `chatDiffStore` pub/sub + `summarizeLastTurn` (deduped publish — no redundant rail re-renders).
  - `030-user-message-bar.md` — user turns as inset cards; sticky pin + Cursor-style 3-line clamp / click-to-expand (`UserTurnBar`, `useUserBarSticky.ts`).
  - `031-model-discovery-cache.md` — shared provider/model probe cache (`modelDiscoveryStore`); prefetch at splash; lazy cloud + CLI catalogs; invalidation on API-key edit / force refresh.
  - `032-startup-hydration.md` — splash gate, parallel workspace restore, overlap with model prefetch.
  - `058-workspace-switch-performance.md` — foreground-only Monaco/sidebar/tab portals (`useWorkspaceHeavyMount`) + `AIChatPanel` usage-poll gates (visible-only); `memo(WorkspaceShell)` kills O(#projects) render fanout; **Monaco warm-LRU** (`workspaceWarmSet`, last 3 projects) for instant switch-back; git snapshot kept warm across switch; multitask + terminals preserved; chat hosts `isActive`-gated → transcript flush in `043`.
  - `033-editor-color-themes.md` — VS Code bundled Monaco syntax themes; Monaco-compatible token rules (`monacoThemeRules.ts`), live `setTheme`, JetBrains Mono `fontFamily`; per-mode picker + separate light/dark persistence.
  - `034-explorer-tree.md` — file tree layout (indent guides, overflow/ellipsis), theme-aware git decorations (`--git-*`), auto-reveal on tab switch; **row `content-visibility` + per-row git subscribe** (no tree-wide tick); pairs with `013` tints and chat-switch freeze `081`.
  - `035-macos-release-notarization.md` — local signed/notarized `.dmg` pipeline (`sign-and-notarize.sh`, `.env`, Entitlements); CI macOS still unsigned.
  - `036-agent-customizations.md` — Agent Customizations footer (hub + agent mode) + tabbed modal (instructions, skills, MCP, providers, privacy).
  - `037-project-context-dock.md` — per-workspace "N files in context" pill in the composer status row (right); hover popover lists active editor attach + `@`-queued files; `workspaceChatContext.ts` + `isUnderRoot` guards prevent cross-project bleed from the global editor singleton.
  - `039-composer-queue.md` — Cursor-style follow-up queue inside the composer pill: visible preview, `Send follow-up` placeholder, Start Multitasking (new chat parallel send / send now), auto-drain on turn end; `ComposerQueue.tsx`, optional `chatId` on `aiBus`.
  - `040-per-session-composer-state.md` — per-session composer draft (input, queue, images, attach toggles), CC knobs (effort/mode/thinking), model restore; `composerDraft.ts` (`mergeComposerDraft`, `mergeSessionKnobs`), fields on `ChatSession`; legacy knob fallback + debounce-unmount flush gotchas.
  - `043-chat-transcript-persistence.md` — disk-backed per-session transcripts (`chat_store.rs`), legacy localStorage migrate, `provider-links.json` reverse index, flush on switch + streaming checkpoint, save-failure toast; concurrent-save race (unique atomic tmp + coalesce); **project-switch never-shrink** (`preferRicherSession`, flush+await before flip, `force` disk reload). Lazy body load: see `076`.
  - `044-provider-session-bridge.md` — unified CLI session bridge (CC/CU/OC): chip, multi-provider ⟲ Sessions picker, `provider_sessions.rs`, thin-row recovery via `chatProviderRecovery.ts`; **platform pin** locks model picker per chat (`057`).
  - `057-platform-pin.md` — agentic chats pin to starting CLI; model picker hard-filter + **New chat** to switch platform; `pinnedProviderId` on `ChatSession`.
  - `059-claude-code-model-catalog.md` — live CC model names (Sonnet 5, Opus 4.8…) via fast `/model` probe + background label cache; instant picker fallbacks.
  - `041-mention-file-preview.md` — Cursor-style `@` file autocomplete: basename + parent dir rows, side path tree preview, inline popover above composer, `.ai-mention-open` overflow escape (no portal).
  - `055-file-composer-drag.md` — pointer drag a file from the explorer onto the composer to cite it (`@relPath` + context queue); no HTML5 DnD (Tauri 2).
  - `038-compose-review.md` — ComposeCard Files recap; IDE `crev:` diff tabs (Undo/Keep); **Agent Mode → DiffModal** (`openComposeDiffModal`); `composeReview.ts`, `ComposeReviewPane.tsx`.
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
