---
type: feature
project: quack-desktop
created: 2026-07-05
last_verified: 2026-07-05
tags: [chat, composer, session, persistence, effort, draft, queue, model]
---

# 040 — Per-session composer state

**Purpose:** Every open chat session keeps its own composer UI state — draft
prompt, follow-up queue, Claude Code knobs (effort / mode / thinking), model
picker, attach toggles, subagent targets, and staged images. Switching
sessions (Agent Mode rail, editor tabs, history dropdown, app restart) must
not bleed settings or half-written text from one chat into another.

## Problem solved

Before this pass:

| Symptom | Root cause |
|---|---|
| Effort / mode changed in chat A appeared in chat B | `ccEffort` + `ccPermMode` written to global `localStorage` only; panels seeded from storage on first mount |
| Half-written prompt lost on session switch | `setInput("")` in hydration / `openSession`; Agent Mode **remounts** `AIChatPanel` on every pick (`key={wsId:activeChatId}`) |
| Follow-up queue lost on tab switch | `queueRef` was in-memory only; remount wiped it |
| Wrong model after returning to a session | `setSelected((cur) => cur \|\| session.model)` kept the global last model when `cur` was already set |

Global `localStorage` keys (`lcp.claudeCode.effort`, `lcp.claudeCode.permMode`)
now seed **brand-new** chats only — not restored sessions.

## Components & modules

| File | Role |
|---|---|
| `src/chatHistory.ts` | `ChatSession` extended with `ccEffort`, `ccPermMode`, `ccThinking`, `composer` |
| `src/composerDraft.ts` | `ChatComposerDraft` type, `draftFromSession`, `mergeComposerDraft` |
| `src/imageAttach.ts` | `rehydrateAttachment()` — rebuild thumb from on-disk path on restore |
| `src/components/AIChatPanel.tsx` | Restore on load/switch; flush on change, debounce, unmount, sessionId change |
| `src/permModeStore.ts` | Unchanged — still bridges live mode to permission overlay by CC session id |

## ChatSession fields (transcript row)

Stored in `localStorage` `lcp.ollama.history.{wsId}` (max 30). Written by
`saveSession` on message change, composer change, and `beforeunload`.

| Field | Type | Purpose |
|---|---|---|
| `ccEffort` | `string?` | Claude Code `--effort` for this chat |
| `ccPermMode` | `string \| null?` | Permission mode; absent/`null` = Ask |
| `ccThinking` | `boolean \| null?` | Extended thinking: `null` = CLI auto |
| `composer` | `ChatComposerDraft?` | Ephemeral composer UI (see below) |

Legacy sessions without these fields fall back to global defaults for knobs
and empty composer on first restore.

## ChatComposerDraft (`composer` on session)

| Field | Type | Purpose |
|---|---|---|
| `input` | `string?` | Textarea draft (unsent prompt) |
| `queue` | `string[]?` | Follow-up queue while turn in flight |
| `attachTree` | `boolean?` | `/tree` attach toggle |
| `attachTerminal` | `boolean?` | Terminal output attach toggle |
| `attachedAgents` | `string[]?` | `@` subagent delegation targets |
| `attachedImages` | `{id, path, name}[]?` | Staged images (paths on disk; thumbs rebuilt) |

Empty draft objects are omitted from storage (`composer` undefined).

## Data flow

### Restore (session becomes active)

```
loadSessions(wsId) → find row by descriptor.sessionId
  → sessionKnobsFrom(session)     → ccEffort / ccThinking / ccPermMode
  → draftFromSession(session)     → applyComposerDraft (input, queue, toggles, images)
  → session.model                 → setSelected(model)  [no cur || guard]
```

Triggers: hydration `useEffect([wsId, aiChatId])`, `openSession(id)`,
Agent Mode panel mount after rail pick.

### Persist (session stops being active or draft changes)

```
composerPersistRef (latest snap)
  → draftFromComposerSnap()
  → mergeComposerDraft(wsId, sessionId, draft)
```

| When | Mechanism |
|---|---|
| Keystroke / toggle / queue change | Debounced 400ms `flushComposerDraft(sessionId)` |
| `sessionId` changes (`/new`, history) | `prevSessionIdRef` effect flushes **previous** id |
| Panel unmount (Agent Mode switch) | Cleanup effect — immediate flush |
| Messages saved | `saveSession` row includes `composer` + knobs from ref |
| `beforeunload` | Same row shape as message persist |

### New / cleared chat

`startNewChat`, delete active session, empty workspace list →
`defaultSessionKnobs()` + `applyComposerDraft({})`.

Branch (`branchFromHere`) copies current knobs + composer snap into the new
`ChatSession` row.

## Agent Mode gotcha

`AgentModeShell` renders:

```tsx
<AIChatPanel key={`${wsId}:${activeChatId}`} … />
```

Every rail pick **destroys and recreates** the panel. In-memory React state
never survives a switch — persistence on `ChatSession` + unmount flush is
**required**, not optional.

Editor mode (`WorkspaceShell` `AIChatHost`) keeps panels mounted after first
show; restore still runs on hydration but unmount flush is less critical.

## What stays per-workspace (not per session)

| State | Module | Why |
|---|---|---|
| Context files dock (`N files in context`) | `workspaceChatContext.ts` | Per-project attach policy — see `037-project-context-dock.md` |
| `permModeStore` Maps | `permModeStore.ts` | Runtime bridge keyed by CC **server** session id + cwd; fed from per-chat `ccPermMode` on each panel mount |

## Related

- Composer UI: `022-chat-composer.md`
- Follow-up queue UX: `039-composer-queue.md` (queue now persisted)
- Permission modes: `015-claude-permission-mode.md`
- CC spawn flags: `014-claude-code-bridge.md`
- Session library model: `001-ai-session-library.md`
- Diary: `documentation/diary/2026-07-05.md` (15:20 + 15:45 entries)

## Gotchas

- Do **not** call `setInput("")` on session switch — use `applyComposerDraft`.
- Do **not** restore model with `setSelected((cur) => cur || q)` — overwrites session model with global default.
- Image thumbs are **not** stored in localStorage — only paths; missing files on disk are dropped on rehydrate.
- Global `lcp.claudeCode.effort` / `permMode` still update on every change (defaults for **new** chats); they are not the source of truth for existing sessions.
