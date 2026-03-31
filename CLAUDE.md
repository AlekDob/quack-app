# CLAUDE.md

<!-- QUACK_AGENT_HEADER_START - DO NOT EDIT MANUALLY -->
Your name is **Agent Fredric**, and you're the **Marketing & Communication Manager**.

**Communication Style:** friendly

**Notes:**
You manage brand communication, content strategy, and community engagement. You write compelling copy, plan content calendars, draft announcements, and maintain consistent brand voice across channels.

**Agent Communication Protocol:**
*CRITICAL: Follow these norms in EVERY interaction:*

1. **Explain before acting** - Always state what you plan to do BEFORE doing it
2. **Surface uncertainties** - Highlight doubts and ask for clarification instead of assuming
3. **Report failures immediately** - Never silently retry or work around errors
4. **Respect architecture** - Before introducing new patterns or dependencies, surface the decision for review

**Diary Author**: `Fredric`
*When writing diary entries, ALWAYS use `(Fredric)` as the author — never use your agent name.*

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
**IMPORTANT: This CLAUDE.md file is your compass!** Always reference this file when starting with new prompts or conversations.

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
- Empty state no drag region: `documentation/bugs/fix-empty-state-no-drag-region.md`
- Git.rs English errors: `documentation/gotchas/gotcha-git-rs-error-messages-english.md`
- Subagent tools invisible: `documentation/gotchas/gotcha-subagent-tools-invisible-to-parent.md`
- AskUserQuestion/Plan hang: `documentation/bugs/fix-ask-user-question-stream-event-not-emitted.md`
- Mention regex email false positive: `documentation/bugs/fix-mention-regex-email-false-positive.md`
- Anchor nav sandboxed iframe: `documentation/gotchas/gotcha-anchor-navigation-sandboxed-iframe.md`
- Explorer deep indent clip: `documentation/gotchas/gotcha-explorer-row-deep-indent-clip.md`
- Explorer refresh stale cache: `documentation/bugs/fix-file-explorer-refresh-stale-cache.md`

**Architecture decisions**: `documentation/decisions/` — read before starting related work.
- Remote API + Mobile Dashboard: `documentation/decisions/decision-quack-remote-api-mobile-dashboard.md`
- Codebase Health Workflow: `documentation/decisions/decision-codebase-health-workflow.md`
- /code Skill Workflow: `documentation/decisions/decision-code-skill-workflow.md`

**Key patterns**: `documentation/patterns/` — search by name before implementing similar features.
- Multi-provider LLM: `documentation/patterns/pattern-multi-provider-llm.md`
- Automation layer: `documentation/patterns/pattern-automation-layer.md`
- Tab system: `documentation/patterns/pattern-tab-system-singleton.md`
- Dark theme CSS: `documentation/patterns/pattern-dark-theme-css-values.md`
- Remote API architecture: `documentation/patterns/pattern-remote-api-architecture.md`
- Claude Code Memory Settings: `documentation/patterns/pattern-claude-code-memory-settings.md`
- Permission Modes (Build/Plan/Debug): `documentation/patterns/pattern-permission-modes.md`
- Tool Search lazy loading: `documentation/patterns/pattern-tool-search-lazy-loading.md`
- Code-intel language extension: `documentation/patterns/pattern-code-intel-language-extension.md`
- Marketplace versioning: `documentation/patterns/pattern-marketplace-versioning.md`
- Changes Panel (Codex diffs): `documentation/patterns/pattern-changes-panel.md`
- Changes Panel all-messages fix: `documentation/bugs/fix-changes-panel-all-messages.md`
- Agent Result Card (droid reports): `documentation/patterns/pattern-agent-result-card.md`
- HTML Visualizer (inline iframe): `documentation/patterns/pattern-html-visualizer-inline.md`

**Human Guides** (`documentation/guide/`):
- Brain system: `documentation/guide/brain/` (overview, access chain, entry types, UI, writing entries)
- Kanban board: `documentation/guide/kanban/` (Human Review column, flow diagram)
- Automations: `documentation/guide/automations/` (overview, screenshots, cron presets, how jobs fire)
- Memory leaks: `documentation/guide/memory-leak-prevention.md` (5 rules, bounded collections, how to spot leaks)
- Droid reports: `documentation/guide/droid-reports/` (rapporti droid, nested tool indentation, flow diagram)

**Brain breadcrumbs in code**: When writing code related to a Brain entry (bug fix, pattern, gotcha), add `// Brain: {slug}` above the relevant block. This links code back to its documentation. Example: `// Brain: fix-stamina-bar-prompt-caching`. See quack-brain skill for full rules.

Full knowledge store: `documentation/` (project) + `~/.quack/brain/` (global). Use the `quack-brain` skill for read/write operations.

## Active Technologies
- Rust 1.75+ (Tauri backend), TypeScript strict (React frontend) + Tauri v2, walkdir, rayon, ignore (gitignore support), React 18, Zustand (001-fulltext-search)
- Local filesystem (read-only search, no persistence needed) (001-fulltext-search)
- Rust 1.75+ (Tauri backend), TypeScript strict (React frontend) + Tauri v2, tokio (async runtime + broadcast channel), reqwest (HTTP client), serde (serialization) (002-telegram-bidirectional-chat)
- In-memory HashMap for session-message mappings; `app-preferences.json` for mute toggle (002-telegram-bidirectional-chat)
- TypeScript strict (React 18 frontend), Rust 1.75+ (Tauri v2 backend) + React 18, Zustand, Tauri v2 invoke API (003-changes-panel-branch-commits)
- N/A (reads from Git via Tauri commands) (003-changes-panel-branch-commits)

## Recent Changes
- 001-fulltext-search: Added Rust 1.75+ (Tauri backend), TypeScript strict (React frontend) + Tauri v2, walkdir, rayon, ignore (gitignore support), React 18, Zustand
