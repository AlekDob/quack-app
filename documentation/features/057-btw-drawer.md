---
type: feature-doc
project: quack-app
stack: Tauri (Rust + React 18 TS)
created: 2026-04-17
last_verified: 2026-04-17
tags: [btw, side-chain, quick-chat, drawer, sdk-streaming, read-only]
---

## BTW Drawer (By The Way side-chain chat)
**Purpose:** Slide-in right-side drawer that fires ephemeral, read-only Claude queries alongside the active agent session, injecting current conversation as context so the user can ask a quick question without interrupting the main agent.
**Stack:** React 18 + TypeScript strict + Tauri v2 `invoke` + Zustand (settings) + shared SDK streaming pipeline (`send_message_via_sdk_streaming`).

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Component | src/components/btw/BTWDrawer.tsx | Drawer UI — `BTWHeader`, `BTWResponseArea`, `BTWInput`, `LoadingDots`, main `BTWDrawer` with backdrop + ESC handler + slide transform |
| Component | src/components/btw/BTWDrawer.css | Glassmorphism styling, slide-in animation, loading dots, bubble layout |
| Service | src/hooks/useBTW.ts | `useBTW({ messages })` — state machine, global shortcut, SDK streaming invoker, context injection |
| Service | src-tauri/src/btw.rs | `btw_query` legacy one-shot Messages API command (superseded by SDK streaming path; kept for fallback) |
| Service | src/services/claudeSDK.ts | `getProviderRequestFields()` — provider resolution reused by BTW |
| Service | src/services/modelService.ts | `getModelId()` — alias → model id |
| Store/State | src/stores/settingsStore.ts | `claude.btwModel` (default `haiku45`), `general.btwShortcut` (default `Ctrl+B`), v4 migration |
| Route/Page | src/components/ChatView.tsx | Hosts drawer — `const btw = useBTW({ messages })`, renders `<BTWDrawer>` with hook state |
| Config | src-tauri/src/lib.rs | Registers `btw::btw_query` command |

### Data Flow
Global `keydown` (Ctrl+B or custom) → `useBTW` toggles `isOpen` → `BTWDrawer` slides in (transform + opacity transition) → input focus → user types + Enter → `sendQuery(question)` → `buildConversationContext(messages)` builds `<conversation_context>` prefix (≤50k chars, truncates long messages to 4k) → resolves model via `getProviderRequestFields` / `getModelId` → `listen('claude-event:btw-sidechain')` attached with unique `sessionKey` → `invoke('send_message_via_sdk_streaming', { agentId: 'btw-sidechain', request: { prompt, model, permissionMode: 'bypass', allowedTools: [], sessionKey, provider... } })` → Tauri emits `claude-event:btw-sidechain` with `{ sessionKey, event }` → listener filters by `sessionKey`, `extractTextFromEvent` pulls text blocks → `setState` appends to `response` → UI renders bubble → invocation resolves, `isLoading=false`, listener torn down.

ESC or backdrop click → `onClose` → `isOpen=false` (conversation persists; only reset on next query).

### Key Functions
- `useBTW(options?: { messages?: ChatMessage[] }) → UseBTWReturn` — hook returning state + `openBTW` / `closeBTW` / `sendQuery`
- `openBTW() → void` — sets `isOpen: true`
- `closeBTW() → void` — sets `isOpen: false` (does NOT reset conversation)
- `sendQuery(question: string) → Promise<void>` — streams response via SDK, wires listener, updates state
- `buildConversationContext(messages: ChatMessage[]) → string` — walks messages backwards until 50k-char budget, wraps in `<conversation_context>` tag
- `extractTextFromEvent(evt: ClaudeEvent) → string` — filters assistant content blocks for text
- `matchesShortcut(e: KeyboardEvent, shortcut: string) → boolean` — parses `Meta|Ctrl|Alt|Shift+KEY` shortcut string
- `BTWDrawer({ isOpen, query, response, isLoading, error, model, onSendQuery, onClose }) → JSX` — controlled drawer shell
- `BTWInput({ onSend, isLoading, isOpen }) → JSX` — textarea + send button, Enter-to-send, Shift+Enter newline
- `BTWResponseArea({ query, response, isLoading, error }) → JSX` — auto-scrolling log with query/response/error bubbles
- `btw_query(model: String, prompt: String, system_context: Option<String>) → Result<String, String>` — Rust, legacy direct Messages API call

### State
- `isOpen`: boolean — drawer visibility (component)
- `query`: string — last sent question (component)
- `response`: string — accumulated streamed assistant text (component)
- `isLoading`: boolean — request in-flight (component)
- `error`: string | undefined — failure message (component)
- `model`: string — `claude.btwModel` setting (global)
- `shortcut`: string — `general.btwShortcut` setting (global)
- `messagesRef`: React ref of `ChatMessage[]` — latest session messages for context (component)
- `unlistenRef`: React ref — Tauri event listener disposer (component)
- `sessionKey`: string — per-query `btw-{Date.now()}` discriminator (request)
- `collectedText`: string — closure accumulator inside `sendQuery` (request)
- `claude.btwModel`: string — persisted alias `haiku45` | `sonnet46` | `opus46` (global, Zustand persist v4)
- `general.btwShortcut`: string — persisted keybinding (global, Zustand persist v4)

### External Dependencies
- Tauri commands: `send_message_via_sdk_streaming` (primary), `btw_query` (legacy fallback)
- Tauri event: `claude-event:btw-sidechain` — streamed assistant events
- Anthropic API (via SDK): Haiku 4.5 / Sonnet 4.6 / Opus 4.6 (configurable), OAuth / API key / Bedrock / Vertex inherited from main chat provider settings
- `useSettingsStore`: reads `claude.btwModel` + `general.btwShortcut`

### Config
- `claude.btwModel`: `haiku45` (default — fast & cheap), `sonnet46`, `opus46`, or full model id pass-through
- `general.btwShortcut`: `Ctrl+B` default, customizable via Settings
- `MAX_CONTEXT_CHARS`: `50_000` (~12k tokens — safe for Haiku 200k window)
- Per-message truncation: `4000` chars then `...[truncated]`
- `permissionMode`: `bypass` (no approval prompts)
- `allowedTools`: `[]` (read-only, no tool use — like Claude Code `/btw`)
- `BTW_AGENT_ID`: `btw-sidechain` (isolated agent id, separate event channel from main session)
- Animation: `translateX(100%)` → `translateX(0)`, `0.28s cubic-bezier(0.32, 0.72, 0, 1)`

### UI Strings
- Header: `BTW`
- Model badges: `Haiku 4.5`, `Sonnet 4.6`, `Opus 4.6`
- Placeholder (empty): `Quick question without interrupting the agent.` + `Press Enter to send`
- Input placeholder: `Ask something...`
- Bubble labels: `You`, `BTW`, `Error`
- Close tooltip: `Close (ESC)`
- aria-labels: `Close BTW drawer`, `BTW question input`, `Send question`, `BTW side-chain chat`, `Loading response`
