# CLAUDE.md

<!-- QUACK_AGENT_HEADER_START - DO NOT EDIT MANUALLY -->
Your name is **Agent Alex**, and you're the **React/Next.js Developer**.

**Communication Style:** technical

**Notes:**
You are an expert React and Next.js developer. You write clean, performant components using React 19 with Server Components and Actions, leverage TypeScript strict mode, style with Tailwind CSS, test with Vitest, and follow modern React patterns including Suspense, lazy loading, and composition over inheritance.

**Preferred Skills:**
*IMPORTANT: Use these skills proactively before proceeding with work.*

- react-best-practices
- nextjs-patterns
- react-testing

**Agent Communication Protocol:**
*CRITICAL: Follow these norms in EVERY interaction:*

1. **Explain before acting** - Always state what you plan to do BEFORE doing it
2. **Surface uncertainties** - Highlight doubts and ask for clarification instead of assuming
3. **Report failures immediately** - Never silently retry or work around errors
4. **Respect architecture** - Before introducing new patterns or dependencies, surface the decision for review

**Diary Author**: `Alek`
*When writing diary entries, ALWAYS use `(Alek)` as the author — never use your agent name.*

<!-- QUACK_AGENT_HEADER_END -->


<!-- QUACK_GROUP_CONTEXT_START -->
## Project Group: Quack

This project belongs to a multi-project group. You have access to sibling projects:

| Project | Path | Role |
|---------|------|------|
| quack-app **(current)** | `/Users/alekdob/Desktop/Dev/Personal/quack-app` | member |
| quackagency-website | `/Users/alekdob/Desktop/Dev/Personal/quackagency-website` | member |

When working cross-project, read the sibling project's CLAUDE.md for context.

<!-- QUACK_GROUP_CONTEXT_END -->
<!-- QUACK_AGENT_HEADER_START - DO NOT EDIT MANUALLY -->
Your name is **Agent Jack**, and you're the **Project Manager**.

**Communication Style:** professional

**Notes:**
You evaluate tasks critically, assess feasibility and economic impact before acting. You don't rush into implementation — you validate, plan, and decide if a task is worth pursuing given the current context and situation.

**Preferred Skills:**
*IMPORTANT: Use these skills proactively before proceeding with work.*

- quack-brain

**Agent Communication Protocol:**
*CRITICAL: Follow these norms in EVERY interaction:*

1. **Explain before acting** - Always state what you plan to do BEFORE doing it
2. **Surface uncertainties** - Highlight doubts and ask for clarification instead of assuming
3. **Report failures immediately** - Never silently retry or work around errors
4. **Respect architecture** - Before introducing new patterns or dependencies, surface the decision for review

**Diary Author**: `Alek`
*When writing diary entries, ALWAYS use `(Alek)` as the author — never use your agent name.*

<!-- QUACK_AGENT_HEADER_END -->
<!-- QUACK_AGENT_HEADER_START - DO NOT EDIT MANUALLY -->
Your name is **Agent Leo**, and you're the **Quack Developer (Full-Stack Tauri+Rust+React)**.

**Communication Style:** sarcastic

**Notes:**
Sei il miglior esperto in circolazione di Quack. Sai come è costruito, sei esperto di rust, tauri e React.  Esperto di Claude Code, antrophic e della Claude Agent SDK. Sei pugliese e tratti male Antonio, insultatndo Alberobello e i trulli. Preferisco la Murgia eil castel del monte. Gestisci benissimo i flusssi per Mac e per Windows, e consideri sempre che quack è costruito per migliaia di sviluppatori in tutto il mondo.

**Preferred Skills:**
*IMPORTANT: Use these skills proactively before proceeding with work.*

- tauri-build-expert
- tauri-image-assets
- quack-agents-architecture
- claude-agent-sdk

**Agent Communication Protocol:**
*CRITICAL: Follow these norms in EVERY interaction:*

1. **Explain before acting** - Always state what you plan to do BEFORE doing it
2. **Surface uncertainties** - Highlight doubts and ask for clarification instead of assuming
3. **Report failures immediately** - Never silently retry or work around errors
4. **Respect architecture** - Before introducing new patterns or dependencies, surface the decision for review

**Diary Author**: `Alek`
*When writing diary entries, ALWAYS use `(Alek)` as the author — never use your agent name.*

<!-- QUACK_AGENT_HEADER_END -->
<!-- QUACK_AGENT_HEADER_START - DO NOT EDIT MANUALLY -->
Your name is **Agent Jack**, and you're the **Project Manager**.

**Communication Style:** professional

**Notes:**
You evaluate tasks critically, assess feasibility and economic impact before acting. You don't rush into implementation — you validate, plan, and decide if a task is worth pursuing given the current context and situation.

**Preferred Skills:**
*IMPORTANT: Use these skills proactively before proceeding with work.*

- quack-brain

**Agent Communication Protocol:**
*CRITICAL: Follow these norms in EVERY interaction:*

1. **Explain before acting** - Always state what you plan to do BEFORE doing it
2. **Surface uncertainties** - Highlight doubts and ask for clarification instead of assuming
3. **Report failures immediately** - Never silently retry or work around errors
4. **Respect architecture** - Before introducing new patterns or dependencies, surface the decision for review

**Diary Author**: `Alek`
*When writing diary entries, ALWAYS use `(Alek)` as the author — never use your agent name.*

<!-- QUACK_AGENT_HEADER_END -->
**IMPORTANT: This CLAUDE.md file is your compass!** Always reference this file when starting with new prompts or conversations.

## Current Focus

<!-- WS-CURRENT-START — auto-generated by scripts/build-workstream-index.py. Do not hand-edit. -->
- **WS5** — Remote Terminal Management — API endpoints per terminali visibili — BE + FE + SKILL IMPLEMENTED — REBUILD NEEDED — ⚠️ Skill quack-remote.md e' bundled via include_str! — agenti esterni non vedono i nuovi endpoint finche' Quack non viene rebuildato.
- **WS6** — MCP HTTP Server Pool — eliminate per-session stdio fanout — IMPLEMENTED (opt-in QUACK_MCP_POOL=1) — SMOKE TEST PENDING
- **WS7** — Jack Supervisor Agent — finestra dedicata cross-project per orchestrazione agenti — PHASE 1 MVP + PM WIDGETS IMPLEMENTED — SMOKE TEST PENDING
- **WS8** — Embedded CLI Pivot — centro = Claude Code interattivo, stato dagli hook — RENDER + AUTOSTART + HOOK-STATUS + TOKEN + SDK-GUARD WORKING — Fase 7 BLOCCATA (design)
<!-- WS-CURRENT-END -->

Full workstream picture: see `documentation/workstreams/INDEX.md`.

## Knowledge Base

Read `documentation/map.md` for full architecture overview before making changes.
Read `documentation/AST.md` for a complete index of all exported symbols per file — use it to quickly locate functions, components, stores, and types without exploratory searches.

**Critical gotchas** (read before modifying these areas):
- Token tracking: `documentation/gotchas/gotcha-branch-display-race-condition.md`
- Tauri commands: `documentation/gotchas/gotcha-tauri-execute-command-parsing.md`
- MCP timeouts: `documentation/gotchas/gotcha-mcp-server-timeout-slow-startup.md`
- SDK thinking: `documentation/gotchas/gotcha-sdk-thinking-mode-removed.md`
- LocalStorage: `documentation/gotchas/gotcha-localstorage-cache-stale-config.md`
- Memory leaks: `documentation/bugs/bug-webkit-memory-leaks-high-cpu.md`
- window.confirm: `documentation/gotchas/gotcha-window-confirm-tauri-webview.md`
- Model name display: `documentation/gotchas/gotcha-model-name-non-anthropic-provider.md`
- Notifications: `documentation/gotchas/gotcha-macos-native-notification-focus.md`
- TerminalInfo fields: `documentation/gotchas/gotcha-terminal-info-field-names.md`
- Session creation: `documentation/gotchas/gotcha-programmatic-session-creation.md`
- axum nest + state: `documentation/gotchas/gotcha-axum-nest-state-types.md`
- Remote execute: `documentation/gotchas/gotcha-remote-execute-needs-react-listener.md`
- PWA icons iOS: `documentation/gotchas/gotcha-pwa-icon-fullbleed-ios.md`
- Dashboard IP changes: `documentation/gotchas/gotcha-remote-dashboard-ip-changes.md`
- Scheduler log spam: `documentation/gotchas/gotcha-automation-scheduler-log-spam.md`
- console.log in setState: `documentation/gotchas/gotcha-console-log-inside-state-updater.md`
- Tauri listener double-fire: `documentation/gotchas/gotcha-tauri-listener-strict-mode-double-fire.md`
- Automation job provider: `documentation/gotchas/gotcha-automation-job-provider-not-passed.md`
- Daemon providers: `documentation/bugs/bug-daemon-missing-provider-env-vars.md`
- Daemon 1M context betas: `documentation/bugs/fix-daemon-missing-1m-context-betas.md`
- Session limit prompt cache: `documentation/bugs/fix-session-limit-prompt-cache.md`
- Stamina overhead estimate: `documentation/gotchas/gotcha-stamina-overhead-static-estimate.md`
- Mobile session dot: `documentation/gotchas/gotcha-mobile-session-dot-status.md`
- Tauri Store .dat files: `documentation/gotchas/gotcha-tauri-store-dat-files-plain-json.md`
- Marketplace resource ID: `documentation/gotchas/gotcha-marketplace-resource-id-format.md`
- Sonnet 4.5 deprecated fallback: `documentation/gotchas/gotcha-sonnet45-deprecated-fallback.md`
- Opus 4.6 hardcoded fallback overrides 4.7 default: `documentation/bugs/fix-opus46-hardcoded-fallback-overrides-opus47-default.md`
- Automation session title lost: `documentation/bugs/fix-automation-session-title-missing.md`
- Session reset after Stop: `documentation/bugs/fix-session-reset-after-stop.md`
- Remote team session tracking: `documentation/bugs/fix-remote-team-session-tracking.md`
- Memory leak 14GB RAM: `documentation/bugs/fix-memory-leak-14gb-ram.md`
- Shell env GUI launch: `documentation/gotchas/gotcha-shell-env-gui-launch.md`
- Bedrock env vars GUI: `documentation/bugs/fix-bedrock-env-vars-gui-launch.md`
- Bedrock model override: `documentation/bugs/fix-bedrock-model-override.md`
- PixiJS CSP black screen: `documentation/gotchas/gotcha-pixi-csp-unsafe-eval.md`
- CSP cleanup on integration removal: `documentation/gotchas/gotcha-csp-cleanup-removed-integrations.md`
- MCP registration: `documentation/gotchas/gotcha-mcp-registration-settings-sources.md`
- Tokio wait() closes stdin: `documentation/gotchas/gotcha-tokio-child-wait-closes-stdin.md`
- BTW must use SDK streaming: `documentation/gotchas/gotcha-btw-must-use-sdk-streaming.md`
- Rewind already in StreamMessage: `documentation/gotchas/gotcha-rewind-already-exists-in-stream-message.md`
- SDK bundled CLI 200k context: `documentation/gotchas/gotcha-sdk-bundled-cli-200k-context-window.md`
- Sidebar branch not from session: `documentation/bugs/fix-sidebar-branch-not-propagated-from-session.md`
- Empty state no drag region: `documentation/bugs/fix-empty-state-no-drag-region.md`
- Git.rs English errors: `documentation/gotchas/gotcha-git-rs-error-messages-english.md`
- Subagent tools invisible: `documentation/gotchas/gotcha-subagent-tools-invisible-to-parent.md`
- AskUserQuestion/Plan hang: `documentation/bugs/fix-ask-user-question-stream-event-not-emitted.md`
- AskUserQuestion empty answers (SDK 0.2.138 native binary): `documentation/bugs/fix-askuserquestion-sdk-0.2.138-pretool-posttool-hook.md`
- Mention regex email false positive: `documentation/bugs/fix-mention-regex-email-false-positive.md`
- Snippet modal stale tags: `documentation/bugs/fix-snippet-modal-stale-tags.md`
- Anchor nav sandboxed iframe: `documentation/gotchas/gotcha-anchor-navigation-sandboxed-iframe.md`
- Iframe external links blocked: `documentation/gotchas/gotcha-iframe-external-links-blocked.md`
- Explorer deep indent clip: `documentation/gotchas/gotcha-explorer-row-deep-indent-clip.md`
- Explorer refresh stale cache: `documentation/bugs/fix-file-explorer-refresh-stale-cache.md`
- Worktree hooks violation: `documentation/gotchas/gotcha-worktree-hooks-violation.md`
- Popout search panel CSS scope: `documentation/gotchas/gotcha-popout-search-panel-css-scope.md`
- SDK allowedTools bypasses canUseTool: `documentation/gotchas/gotcha-sdk-allowedtools-bypasses-canuse.md`
- EditSummaryBar cumulative regression: `documentation/bugs/fix-edit-summary-bar-cumulative-regression.md`
- ChangesPanel CPU loop: `documentation/bugs/fix-changes-panel-cpu-loop.md`
- Session backup quota cascade: `documentation/bugs/fix-session-backup-quota-cascade.md`
- Windows path separators: `documentation/gotchas/gotcha-windows-path-separators.md`
- Webview fetch CORS: `documentation/gotchas/gotcha-webview-fetch-cors-use-invoke.md`
- TerminalStore sync persist quota: `documentation/gotchas/gotcha-terminal-store-sync-persist-quota.md`
- Mutex poisoning cascade: `documentation/bugs/fix-mutex-poisoning-cascade-abort.md`
- Delayed agent message stale closure: `documentation/bugs/bug-delayed-agent-message-stale-closure.md`
- Split tab disappears on send: `documentation/bugs/fix-split-tab-disappears-on-send.md`
- Skill drop intercepted by overlay: `documentation/bugs/fix-skill-drop-overlay-intercept.md`
- Background task unsolicited events: `documentation/bugs/bug-background-task-unsolicited-events.md`
- Custom color picker WebKit: `documentation/bugs/fix-custom-color-picker-webkit.md`
- Custom font size NaN: `documentation/gotchas/gotcha-custom-font-size-nan-persisted-state.md`
- Brain button bypass handleSend: `documentation/bugs/fix-brain-button-bypasses-handleSend.md`
- Slash commands HOME env Windows: `documentation/bugs/bug-slash-commands-home-env-windows.md`
- Linux projects disappear on restart: `documentation/bugs/fix-linux-projects-disappear-on-restart.md`
- Agent tool name Task/Agent migration: `documentation/gotchas/gotcha-agent-tool-name-task-agent-migration.md`
- CSS flex chain broken (canvas collapses to 0px): `documentation/gotchas/gotcha-css-flex-chain-broken.md`
- Embedded CLI TUI garbling (xterm↔PTY size must be locked via ResizeObserver): `documentation/gotchas/gotcha-embedded-cli-xterm-pty-resize-sync.md`
- Embedded CLI terminale VUOTO (xterm va persistito in Map globale, non ricreato a ogni mount — StrictMode dispose perde il prompt): `documentation/gotchas/gotcha-embedded-cli-xterm-persistent-instance.md`
- New session from dormant agent disappears (race condition): `documentation/bugs/fix-session-create-race-load-overwrite.md`
- Office View v2 crash on pan (ref-in-setState-updater race): `documentation/bugs/fix-office-canvas-pointermove-ref-race.md`
- Telegram partial/stale notifications: `documentation/bugs/fix-telegram-partial-stale-notifications.md`
- Token Stats panel blocks cross-project switch (~2-3s): `documentation/bugs/fix-token-stats-panel-blocks-project-switch.md`
- Double `loadAgents` on session switch (deps cascade): `documentation/bugs/fix-double-loadagents-cross-project-session.md`
- Stale closure in onPointerUp (lasso Office V2): `documentation/bugs/fix-stale-closure-pointerup-lasso.md`
- Jack multi-session: eventi assistente atterrano sulla sessione SBAGLIATA se l'utente switcha durante streaming — usare `appendToSession(capturedId, ...)`, mai `activeSessionId` da callback async: `documentation/bugs/fix-jack-multisession-events-wrong-session.md`
- Build EACCES su dist/ o src-tauri/target/ (file owned da root): `documentation/gotchas/gotcha-build-eacces-root-owned-artifacts.md`
- Whiteboard Title tool — `texts` strippati da `filterByParent`: `documentation/bugs/fix-whiteboard-texts-stripped-by-filterbyparent.md`
- Anthropic-compatible clones — identity hallucination ("I am Claude"): `documentation/gotchas/gotcha-anthropic-compatible-identity-hallucination.md`
- JS `a && b && c` interpolato in template literal — secret leak: `documentation/gotchas/gotcha-js-template-literal-secret-leak.md`
- External CLI: pin `<bin> --version` before claiming any capability/wiring schema (codex 0.42 vs 0.130 incident): `documentation/gotchas/gotcha-external-cli-version-pin.md`
- Codex `agent_message` render rotto: regex "Following rules:" greedy in StreamMessage che mangia l'intera bolla in rule-pills: `documentation/gotchas/gotcha-following-rules-regex-codex-prose-collision.md`
- Built-in skills bundled via include_str!: `documentation/gotchas/gotcha-builtin-skill-bundled-include-str.md`
- TodoWrite widget righe vuote dopo SDK 0.3.150 (type mismatch toolResults `Map<string,any>` vs accumulator `Map<string,string>`, `JSON.parse([object Object])` silenzioso): `documentation/bugs/fix-task-accumulator-toolresult-text-mismatch.md`
- TodoWrite 0/N completed — TaskUpdate orphaned (SDK 0.3.150 managed tools non emettono tool_result nello stream): `documentation/bugs/fix-task-accumulator-pending-reconciliation.md`
- PM widgets Jack crashano app ("Provider Error: Git") — `MarkdownText.tsx` faceva `JSON.parse` inline su fenced block streaming incompleti: `documentation/bugs/fix-markdown-pm-widgets-streaming-json-crash.md`
- PTY output `���` (U+FFFD) nelle righe box-drawing — UTF-8 multi-byte spezzato sul confine del flush (`from_utf8_lossy` per-chunk): `documentation/bugs/fix-pty-utf8-split-multibyte.md`

**Architecture decisions**: `documentation/decisions/` — read before starting related work.
- Remote API + Mobile Dashboard: `documentation/decisions/decision-quack-remote-api-mobile-dashboard.md`
- Codebase Health Workflow: `documentation/decisions/decision-codebase-health-workflow.md`
- /code Skill Workflow: `documentation/decisions/decision-code-skill-workflow.md`
- Code Editor: CodeMirror tab vs Monaco split: `documentation/decisions/decision-024-editor-codemirror-tab.md`
- Windows Build & Release Strategy: `documentation/decisions/decision-windows-build-release-strategy.md`

**Key patterns**: `documentation/patterns/` — search by name before implementing similar features.
- Multi-provider LLM: `documentation/patterns/pattern-multi-provider-llm.md`
- Anthropic-compatible providers (z.ai/MiniMax/Kimi): `documentation/patterns/pattern-anthropic-compatible-providers.md` + `.mmd` (sequence diagram)
- Automation layer: `documentation/patterns/pattern-automation-layer.md`
- Tab system: `documentation/patterns/pattern-tab-system-singleton.md`
- Dark theme CSS + accent tokens: `documentation/patterns/pattern-dark-theme-css-values.md`
- Remote API architecture: `documentation/patterns/pattern-remote-api-architecture.md`
- Claude Code Memory Settings: `documentation/patterns/pattern-claude-code-memory-settings.md`
- Permission Modes (Build/Plan/Debug): `documentation/patterns/pattern-permission-modes.md`
- Tool Search lazy loading: `documentation/patterns/pattern-tool-search-lazy-loading.md`
- Code-intel language extension: `documentation/patterns/pattern-code-intel-language-extension.md`
- Claude Agent SDK upgrade workflow: `documentation/patterns/pattern-sdk-version-upgrade.md`
- Marketplace versioning: `documentation/patterns/pattern-marketplace-versioning.md`
- Changes Panel (Codex diffs): `documentation/patterns/pattern-changes-panel.md`
- Changes Panel all-messages fix: `documentation/bugs/fix-changes-panel-all-messages.md`
- Agent commit detection: `documentation/patterns/pattern-agent-commit-detection.md`
- Agent Result Card (droid reports): `documentation/patterns/pattern-agent-result-card.md`
- HTML Visualizer (inline iframe): `documentation/patterns/pattern-html-visualizer-inline.md`
- Brain Hooks (automated knowledge surfacing): `documentation/patterns/pattern-brain-hooks.md`
- Code Editor Tab (integrated editor): `documentation/patterns/pattern-code-editor-tab.md`
- Team Delegation Footer: `documentation/patterns/pattern-team-delegation-footer.md`
- Brain Accordion Section (scoped FileExplorer): `documentation/patterns/pattern-brain-accordion-section.md`
- Project-Ops Native Integration (workstreams panel + Plan Mode + bootstrap): `documentation/patterns/pattern-project-ops-native-integration.md`
- DiffViewer modes (unified/split/fullscreen): `documentation/patterns/pattern-diff-viewer-modes.md`
- Session Scroll Memory (restore/scroll-to-bottom): `documentation/patterns/pattern-session-scroll-memory.md`
- Backend capability-gated UI (hide Claude-only controls for Codex/non-Claude sessions): `documentation/patterns/pattern-backend-capability-gated-ui.md`
- PWA Task Hub Mirror (frontend chatStore → Rust SessionLiveStateMap → WS → PWA): `documentation/patterns/pattern-pwa-task-hub-mirror.md` (feature `068-pwa-task-hub-mobile`)
- Codex `exec` capability matrix (what skills/commands/subagents/AGENTS.md survive non-interactive — read before wiring any Claude-harness feature for Codex): `documentation/research/codex-exec-capability-matrix.md`
- MCP HTTP Server Pool (per-session stdio fanout → shared HTTP pool, opt-in `QUACK_MCP_POOL=1`): `documentation/patterns/pattern-mcp-http-pool.md` (WS6)

**Human Guides** (`documentation/guide/`):
- Brain system: `documentation/guide/brain/` (overview, access chain, entry types, UI, writing entries)
- Kanban board: `documentation/guide/kanban/` (Human Review column, flow diagram)
- Automations: `documentation/guide/automations/` (overview, screenshots, cron presets, how jobs fire)
- Memory leaks: `documentation/guide/memory-leak-prevention.md` (5 rules, bounded collections, how to spot leaks)
- Droid reports: `documentation/guide/droid-reports/` (rapporti droid, nested tool indentation, flow diagram)
- Nested components: `documentation/guide/whiteboard-nested-components/` (matryoshka whiteboards, node assignments, drag-assign/eject, flow diagram)

**Brain breadcrumbs in code**: When writing code related to a Brain entry (bug fix, pattern, gotcha), add `// Brain: {slug}` above the relevant block. This links code back to its documentation. Example: `// Brain: fix-stamina-bar-prompt-caching`. See quack-brain skill for full rules.

Full knowledge store: `documentation/` (project) + `~/.quack/brain/` (global). Use the `quack-brain` skill for read/write operations.

## Active Technologies
- Rust 1.75+ (Tauri backend), TypeScript strict (React frontend) + Tauri v2, walkdir, rayon, ignore (gitignore support), React 18, Zustand (001-fulltext-search)
- Local filesystem (read-only search, no persistence needed) (001-fulltext-search)
- Rust 1.75+ (Tauri backend), TypeScript strict (React frontend) + Tauri v2, tokio (async runtime + broadcast channel), reqwest (HTTP client), serde (serialization) (002-telegram-bidirectional-chat)
- In-memory HashMap for session-message mappings; `app-preferences.json` for mute toggle (002-telegram-bidirectional-chat)
- TypeScript strict (React 18 frontend), Rust 1.75+ (Tauri v2 backend) + React 18, Zustand, Tauri v2 invoke API (003-changes-panel-branch-commits)
- N/A (reads from Git via Tauri commands) (003-changes-panel-branch-commits)
- TypeScript strict (React 18 frontend), Rust 1.75+ (Tauri v2 backend), Node.js 18.17.0 (SDK bridge) + Tauri v2, Zustand (settings store), `@anthropic-ai/claude-agent-sdk`, Tauri Store plugin, Tauri secure storage (existing `save_api_key`) (037-anthropic-compatible-providers)
- OS-level secure storage via Tauri (API keys, namespaced `provider:<id>`); localStorage via Zustand persist (`settings-storage` v11→v12) per provider metadata + default; nessun nuovo file (037-anthropic-compatible-providers)

## Recent Changes
- 004-feature-map-whiteboard: Added TypeScript strict (React 18 frontend) + PixiJS (@pixi/react), Tauri v2 invoke API (list_directory, read_file_content)
- 001-fulltext-search: Added Rust 1.75+ (Tauri backend), TypeScript strict (React frontend) + Tauri v2, walkdir, rayon, ignore (gitignore support), React 18, Zustand
