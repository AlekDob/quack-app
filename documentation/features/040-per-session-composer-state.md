---
type: feature
project: quack-desktop
created: 2026-07-05
last_verified: 2026-07-17
tags: [chat, composer, session, persistence, effort, draft, queue, model]
---

# 040 — Per-session composer state

**Purpose:** Every open chat session keeps its own composer UI state — draft
prompt, follow-up queue, Claude Code knobs (effort / mode / thinking), model
picker, attach toggles, subagent targets, and staged images. Switching
sessions (Agent Mode rail, editor tabs, history dropdown, app restart) must
not bleed settings or half-written text from one chat into another.

## Problem solved

### Initial pass (feat `85010484`)

| Symptom | Root cause |
|---|---|
| Effort / mode changed in chat A appeared in chat B | `ccEffort` + `ccPermMode` written to global `localStorage` only; panels seeded from storage on first mount |
| Half-written prompt lost on session switch | `setInput("")` in hydration / `openSession`; Agent Mode **remounts** `AIChatPanel` on every pick (`key={wsId:activeChatId}`) |
| Follow-up queue lost on tab switch | `queueRef` was in-memory only; remount wiped it |
| Wrong model after returning to a session | `setSelected((cur) => cur \|\| session.model)` kept the global last model when `cur` was already set |

### Follow-up fix (fix `7e72a1a4`) — still broken after first ship

| Symptom | Root cause |
|---|---|
| Effort still “global” on older chats | `sessionKnobsFrom` fell back to `readEffort()` / `readDefaultPermMode()` when the row existed but lacked `ccEffort` — global keys had just been overwritten by another session |
| Draft lost when switching quickly | Debounce effect `return () => clearTimeout(t)` **cancelled** the pending save; Agent Mode unmount left nothing on disk if switch happened within 400ms |

### Transcript loss (fix Jul 2026 — see `043-chat-transcript-persistence.md`)

| Symptom | Root cause |
|---|---|
| Messages missing after switch / reload | Monolithic `saveSession` array — parallel mounted panels overwrote each other |
| Streaming turn lost on switch | Partial assistant only in React state until turn end |
| Composer created empty rows | `mergeComposerDraft` wrote `messages: []` when row missing |

## Components & modules

| File | Role |
|---|---|
| `src/chatHistory.ts` | `ChatSession` fields; `patchSession` for partial writes |
| `src/composerDraft.ts` | `mergeComposerDraft` / `mergeSessionKnobs` → `patchSession` |
| `src/chatPersistFlush.ts` | `flushAllChatPersist` before chat switch |
| `src/imageAttach.ts` | `rehydrateAttachment()` — rebuild thumb from on-disk path on restore |
| `src/components/AIChatPanel.tsx` | Restore, `sessionKnobsFrom`, refs, flush on change / switch / unmount |
| `src/permModeStore.ts` | Unchanged — runtime bridge to permission overlay by CC session id |

## ChatSession fields (transcript row)

Stored per session key `lcp.ollama.history.{wsId}.s.{sessionId}` (index max 30) — see `043-chat-transcript-persistence.md`.

| Field | Type | Purpose |
|---|---|---|
| `ccEffort` | `string?` | Claude Code `--effort` for this chat |
| `ccPermMode` | `string \| null?` | Permission mode; absent/`null` = Ask |
| `ccThinking` | `boolean \| null?` | Extended thinking: `null` = CLI auto |
| `composer` | `ChatComposerDraft?` | Ephemeral composer UI (see below) |

### Knob restore rules (`sessionKnobsFrom`)

| Session row | Effort | Mode | Thinking |
|---|---|---|---|
| **No row** (`found` undefined) | `readEffort()` global | `readDefaultPermMode()` global | `null` |
| **Row exists**, field missing (legacy) | `CC_EFFORT_DEFAULT` (**medium**) | `null` (Ask) | `null` |
| **Row exists**, field set | saved value | saved value | saved value |

Global `localStorage` (`lcp.claudeCode.effort`, `lcp.claudeCode.permMode`) still
updates on every knob change — but only seeds **brand-new** chats via
`defaultSessionKnobs()`. Never read global when restoring an existing row.

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
  → sessionKnobsFrom(found)       → ccEffort / ccThinking / ccPermMode
  → draftFromSession(found)       → applyComposerDraft (input, queue, toggles, images)
  → found.model                   → setSelected(model)  [no cur || guard]
```

Triggers: hydration `useEffect([wsId, aiChatId])`, `openSession(id)`,
Agent Mode panel mount after rail pick.

### Persist (session leaves focus or draft/knobs change)

Two merge helpers in `composerDraft.ts` — both call `patchSession` so
**messages are never reset** when only composer/knobs change:

| Helper | Writes |
|---|---|
| `mergeComposerDraft(wsId, sessionId, draft)` | `composer` only |
| `mergeSessionKnobs(wsId, sessionId, knobs)` | `ccEffort`, `ccPermMode`, `ccThinking` |

`AIChatPanel` keeps live snapshots in refs (updated every render via
`useLayoutEffect`):

| Ref | Contents |
|---|---|
| `composerPersistRef` | `sessionId`, `input`, queue, attach toggles, images |
| `knobsPersistRef` | `ccEffort`, `ccThinking`, `ccPermMode` |

`flushSessionState(sid)` = `mergeComposerDraft` + `mergeSessionKnobs` from refs.

| When | Mechanism |
|---|---|
| Keystroke / toggle / queue / knob change | Debounced 400ms `flushSessionState`; cleanup **only** `clearTimeout` (flushing on cleanup re-ran a full `chat_store_save` on every keystroke — CPU/RAM spike) |
| `sessionId` changes (`/new`, history) | `prevSessionIdRef` effect → `flushSessionState(previous)` |
| Panel unmount / chat switch | `useLayoutEffect` cleanup + `registerChatPersist` / `pulseChatSwitch` → `flushAllChatPersist` |
| Messages saved / `beforeunload` / streaming (5s) | Full `saveSession`; toast if `false` |

### New / cleared chat

`startNewChat`, delete active session, empty workspace list →
`defaultSessionKnobs()` + `applyComposerDraft({})`.

Branch (`branchFromHere`) copies current knobs + composer snap into the new
`ChatSession` row.

## Agent Mode gotcha

`AgentModeShell` renders one `AgentChatHost` per open chat (CSS `display`
toggle). Panels **stay mounted** — same as editor `AIChatHost`. Persistence
on `ChatSession` + `flushAllChatPersist` on switch is **required**.

Editor mode (`WorkspaceShell` `AIChatHost`) uses the same mount-once pattern.

**Requires app reload** after deploying this feature — `npm run tauri dev`
(not Vite-only `npm run dev` if testing the desktop shell).

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
- Transcript storage / audit: `043-chat-transcript-persistence.md`
- Diary: `documentation/diary/2026-07-05.md` (15:20, 15:45, 15:55), `2026-07-06.md` (18:25)

## Gotchas

- Do **not** call `setInput("")` on session switch — use `applyComposerDraft`.
- Do **not** restore model with `setSelected((cur) => cur || q)`.
- Do **not** use `readEffort()` / `readDefaultPermMode()` when a `ChatSession` row exists but lacks knob fields — use `CC_EFFORT_DEFAULT` + Ask.
- Debounce cleanup must **only** `clearTimeout`. Flush on unmount / `sessionId` change via dedicated effects — never flush inside the debounce cleanup (that wrote the full session JSON on every keystroke).
- Image thumbs are **not** stored in localStorage — only paths; missing files on disk are dropped on rehydrate.
- First time a legacy chat gets a custom effort, the value is written to its row — until then it shows **medium**, not whatever another chat last set globally.
