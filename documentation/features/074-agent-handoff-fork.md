---
type: feature-doc
project: quack-app
stack: Tauri (Rust + React)
created: 2026-05-27
last_verified: 2026-05-27
tags: [handoff, session-fork, agent-switch, sidebar, slash-commands]
---

## Agent Handoff (Session Fork)

**Purpose:** Switch a running conversation from one agent to another without losing context — the source session is summarized via AI, a new session is created on the target agent with that summary as bootstrap, and the new session appears indented under the parent in the sidebar.

**Stack:** Tauri v2 (Rust backend) + React 18 + TypeScript strict + Zustand + Claude Agent SDK

### Files

| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Service | `src/services/handoffService.ts` | `generateHandoffSummary`, `executeHandoff` |
| Service | `src/services/sendMessageBridge.ts` | `registerSendMessageForTargetAgent`, `getSendMessageForTargetAgent` |
| Store/State | `src/stores/handoffDialogStore.ts` | Zustand store: `isOpen`, `sessionId`, `open`, `close` |
| Component | `src/components/HandoffDialog.tsx` | Modal: agent picker → AI summary generation → editable textarea → confirm |
| Component | `src/components/HandoffDialog.css` | Modal styles (glassmorphism, animations) |
| Component | `src/components/chat/SessionPopover.tsx` | Trigger: "Handoff to..." button in chat header popover |
| Component | `src/components/AgentSessionItem.tsx` | Sidebar item: `depth` prop + connector line for forked sessions |
| Component | `src/components/AgentSessionList.tsx` | Fork tree logic: find parent, build depth, recursive render (clamp depth=2) |
| Component | `src/components/chat/UnifiedActionBar.tsx` | Prop pass-through: `onHandoff` from ChatView to SessionPopover |
| Component | `src/components/ChatView.tsx` | Dialog render + slash interceptor `/handoff @agent` |
| Model/Type | `src/types.ts` | `parentSessionId?: string` on `AgentSession` (line 499) |
| Middleware | `src-tauri/src/slash_commands.rs` | `QUACK_BUILTIN_COMMANDS`: `/handoff` entry |

### Data Flow

```
User clicks "Handoff to..." or types /handoff @agent
  → useHandoffDialogStore.open(sessionId, agentId?)
    → HandoffDialog opens (stage: 'pick')
      → User picks target agent
        → generateHandoffSummary(messages, fromAgent, toAgent)
          → streamClaudeMessage(prompt, model=sonnet, bypass permissions)
            → AI summary returned
        → User edits textarea (optional)
        → handleConfirm()
          → executeHandoff({ fromSession, targetAgentId, summary, ... })
            → useSessionStore.createSession({ ..., parentSessionId: fromSession.id, initialPromptConsumed: true })
            → useSessionStore.selectSession(newSession.id)
            → getSendMessageForTargetAgent()(newSession.id, wrappedSummary)
              → sendMessageBridge fires sendMessage programmatically
                → Target agent receives bootstrap prompt → starts working
  → AgentSessionList: parent detected → depth calculated → indented render (depth ≤ 2)
```

### Key Functions

- `generateHandoffSummary(messages, fromAgent, toAgent, opts?) → Promise<string>` — AI summary via SDK stream; falls back to `createLocalSummary` on error (service)
- `executeHandoff(args) → Promise<AgentSession>` — create + select session, fire bootstrap prompt via bridge (service)
- `registerSendMessageForTargetAgent(fn)` — App.tsx registers the bound `sendMessageForTargetAgent` on mount (bridge)
- `getSendMessageForTargetAgent() → fn | null` — service/bridge access outside React tree (bridge)
- `open(sessionId, initialTargetAgentId?)` — store action: opens dialog with pre-selected session and optional agent (store)
- `buildSnapshots(agents, sessions, colorMap)` — aggregates agent/session data for Jack supervisor (hook)

### State

- `isOpen`: boolean — dialog visibility (global)
- `sessionId`: string | null — session being handed off (global)
- `initialTargetAgentId`: string | undefined — pre-select agent in picker (global)
- `stage`: 'pick' | 'generating' | 'review' | 'submitting' — dialog phase (dialog-local)
- `targetAgentId`: string | null — chosen destination agent (dialog-local)
- `summary`: string — AI-generated editable text (dialog-local)

### External Dependencies

- Claude Agent SDK (`streamClaudeMessage`): AI summary generation
- Tauri Store (`Store.load`): persist agent data for Jack refresh hook
- Tauri event bus (`listen`): `sessions-updated`, `external-terminal-status` triggers for Jack refresh

### Config

- `MAX_MESSAGES_FOR_SUMMARY = 80`: max messages passed to summary prompt
- `SUMMARY_TIMEOUT_MS = 90_000`: AI generation timeout (ms)

### i18n Keys

All UI strings are inline (not externalized). Italian-only for now.

- `"Handoff sessione"` — dialog title
- `"Scegli l'agente di destinazione"` — picker section label
- `"Nessun agente disponibile in questo progetto."` — empty state
- `"Generazione sunto in corso..."` — loading spinner label
- `"Sto leggendo la conversazione e preparando il bootstrap per il nuovo agente."` — loading hint
- `"Sunto per {target} (modificabile)"` — review section label
- `"Annulla"` — cancel button
- `"Handoff"` — confirm button
- `"In corso..."` — submitting button