---
type: feature
project: quack-desktop
created: 2026-07-05
last_verified: 2026-07-21
tags: [chat, composer, session, persistence, effort, draft, queue, model, isolation]
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

### Remount isolation (fix 2026-07-21 — bug `005`)

Idle Agent/IDE hosts **unload** when hidden (`shouldKeepChatHostMounted` —
only visible + working/needs-input stay mounted). That remount race broke
isolation again:

| Symptom | Root cause |
|---|---|
| Model/effort/mode from chat A appear on chat B after switch | Remount seeded knobs from **global** last-used; discovery stamped `lcp.ollama.lastModel` before hydrate; persist rewrote B's row |
| Team drawer edit reset every mounted chat's model | `subscribePresetSettings` called `applyPreset` on **all** hosts |

## Components & modules

| File | Role |
|---|---|
| `src/chatHistory.ts` | `ChatSession` fields; `patchSession` for partial writes |
| `src/composerDraft.ts` | `mergeComposerDraft` / `mergeSessionKnobs` → `patchSession` |
| `src/sessionComposerSeed.ts` | Warm-cache seed + `nextSelectedAfterDiscovery` (isolation helpers) |
| `src/sessionComposerSeed.test.ts` | Vitest: knobs-from-row, discovery gate |
| `src/chatPersistFlush.ts` | `flushAllChatPersist` before chat switch |
| `src/chatHostMount.ts` | When hosts stay mounted vs unload (feeds remount path) |
| `src/imageAttach.ts` | `rehydrateAttachment()` — rebuild thumb from on-disk path on restore |
| `src/components/AIChatPanel.tsx` | Seed, `sessionReady`, restore, refs, gated flush |
| `src/permModeStore.ts` | Runtime bridge to permission overlay by CC session id |

## ChatSession fields (transcript row)

Stored per session — see `043-chat-transcript-persistence.md`.

| Field | Type | Purpose |
|---|---|---|
| `model` | `string?` | Qualified picker id (e.g. `claude-code:opus`) — per chat |
| `ccEffort` | `string?` | Claude Code `--effort` for this chat |
| `ccPermMode` | `string \| null?` | Permission mode; absent/`null` = Ask |
| `ccThinking` | `boolean \| null?` | Extended thinking: `null` = CLI auto |
| `presetId` | `string?` | Active Team agent shaping this session |
| `composer` | `ChatComposerDraft?` | Ephemeral composer UI (see below) |

### Knob restore rules (`sessionKnobsFrom` / `knobsFromSessionRow`)

| Session row | Effort | Mode | Thinking | Model |
|---|---|---|---|---|
| **No row** (`found` undefined) | `readEffort()` global | `readDefaultPermMode()` global | `null` | discovery / preset after `sessionReady` |
| **Row exists**, field missing (legacy) | `CC_EFFORT_DEFAULT` (**medium**) | `null` (Ask) | `null` | leave unset → empty hydrate may apply preset |
| **Row exists**, field set | saved value | saved value | saved value | saved qualified id |

Global `localStorage` (`lcp.claudeCode.effort`, `lcp.claudeCode.permMode`,
`lcp.ollama.lastModel`) still updates **after** `sessionReady` — seeds
**brand-new** chats only. Never read global when restoring an existing row;
never write global / persist until hydrate has painted this chat.

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

### Mount / remount seed (before async hydrate)

```
loadSessionComposerSeed(wsId, aiChatId)
  → warm ChatSession cache (if any)
  → useState initial: model, effort, thinking, permMode, presetId, messages
```

Avoids flashing another chat's Opus/Auto while disk hydrate is in flight.

### Restore (hydrate paints bound session)

```
ensureSessionLoaded → paintSession
  → sessionKnobsFrom(found) / applyPreset (empty seed)
  → found.model → setSelected (qualifyStoredModel)
  → sessionReady = true   ← persist + global last-used unlock
```

Triggers: hydration `useEffect([wsId, aiChatId])`, `openSession(id)`,
Agent Mode host remount after rail pick.

### Persist (only when `sessionReady`)

Two merge helpers in `composerDraft.ts` — both call `patchSession` so
**messages are never reset** when only composer/knobs change:

| Helper | Writes |
|---|---|
| `mergeComposerDraft(wsId, sessionId, draft)` | `composer` only |
| `mergeSessionKnobs(wsId, sessionId, knobs)` | `ccEffort`, `ccPermMode`, `ccThinking`, `presetId`, **`model`** |

`AIChatPanel` keeps live snapshots in refs (updated every render via
`useLayoutEffect`):

| Ref | Contents |
|---|---|
| `composerPersistRef` | `sessionId`, `input`, queue, attach toggles, images |
| `knobsPersistRef` | `ccEffort`, `ccThinking`, `ccPermMode`, `presetId`, `model` |

`flushSessionState(sid)` = `mergeComposerDraft` + `mergeSessionKnobs` from refs.

**Isolation gate (`sessionReady`):**

| Gated until ready | Why |
|---|---|
| Transcript / empty-chat `patchSession` | Don't rewrite sibling rows with global knobs |
| Debounced `flushSessionState` + unmount merge | Same |
| `lcp.ollama.lastModel` / effort / permMode globals | Don't poison the next remount's seed |
| Rail `setAIChatModel` | Don't flash wrong badge on other chats |
| Discovery → global last-used fallback | `nextSelectedAfterDiscovery(..., sessionReady: false)` keeps `current` |

After ready, if picker is still empty → one discovery pass fills from global /
catalog (brand-new chats only).

| When | Mechanism |
|---|---|
| Keystroke / toggle / queue / knob change | Debounced 400ms `flushSessionState`; cleanup **only** `clearTimeout` |
| `sessionId` changes (`/new`, history) | `prevSessionIdRef` effect → `flushSessionState(previous)` |
| Panel unmount / chat switch | `useLayoutEffect` cleanup (if ready) + `registerChatPersist` / `pulseChatSwitch` → `flushAllChatPersist` |
| Messages saved / `beforeunload` / streaming (5s) | Full `saveSession`; toast if `false` |

**ComposerShell (2026-07-17):** `input` state lives in [`ComposerShell.tsx`](../../src/components/ComposerShell.tsx) so keystrokes do **not** re-render `AIChatPanel`’s transcript. Parent reads/writes via imperative handle (`getInput` / `setInput`); draft debounce watches `draftEpoch` from `onInputChange`.

### New / cleared chat

`startNewChat`, delete active session, empty workspace list →
`defaultSessionKnobs()` + `applyComposerDraft({})` (after ready).

Branch (`branchFromHere`) copies current knobs + composer snap into the new
`ChatSession` row.

## Agent Mode / host mount

`AgentModeShell` / `WorkspaceShell` keep **visible** hosts + live
working/needs-input hosts mounted (`chatHostMount.ts`, feature `076`).
Idle and DONE hosts **unmount** → every return to an idle chat is a remount
and **must** go through seed + `sessionReady` (bug `005`).

Persistence on `ChatSession` + `flushAllChatPersist` on switch remains
required for the hosts that stay warm.

**Requires app reload** after deploying — `npm run tauri dev`
(not Vite-only `npm run dev` if testing the desktop shell).

## What stays per-workspace (not per session)

| State | Module | Why |
|---|---|---|
| Context files dock (`N files in context`) | `workspaceChatContext.ts` | Per-project attach policy — see `037-project-context-dock.md` |
| `permModeStore` Maps | `permModeStore.ts` | Runtime bridge keyed by CC **server** session id + cwd; fed from per-chat `ccPermMode` on each panel mount |
| Global last-used model/effort/mode keys | `localStorage` | Seed **new** chats only — written only after `sessionReady` |

## Related

- Bug record: `005-session-knobs-bleed.md`
- Composer UI: `022-chat-composer.md`
- Model picker: `025-model-selector.md`
- Follow-up queue UX: `039-composer-queue.md`
- Permission modes: `015-claude-permission-mode.md`
- CC spawn flags: `014-claude-code-bridge.md`
- Session library: `001-ai-session-library.md`
- Transcript storage: `043-chat-transcript-persistence.md`
- Host unload: `076-chat-lazy-hydrate-done-unload.md`
- Presets / Team sync: `062-presets.md`
- Diary: `2026-07-05.md`, `2026-07-06.md`, `2026-07-21.md`

## Gotchas

- Do **not** call `setInput("")` on session switch — use `applyComposerDraft`.
- Do **not** restore model with `setSelected((cur) => cur || q)`.
- Do **not** use `readEffort()` / `readDefaultPermMode()` when a `ChatSession` row exists but lacks knob fields — use `CC_EFFORT_DEFAULT` + Ask.
- Debounce cleanup must **only** `clearTimeout`. Flush on unmount / `sessionId` change via dedicated effects — never flush inside the debounce cleanup.
- **Do not** invent a transcript via `patchSession` when the cache body is missing — return `false` unless `patch.messages` is non-empty (`043`).
- Unmount composer flush is safe only because `preferRicherSession` + `setActiveWorkspace` flush-before-flip (`043`, `058`).
- Image thumbs are **not** stored in localStorage — only paths; missing files on disk are dropped on rehydrate.
- First time a legacy chat gets a custom effort, the value is written to its row — until then it shows **medium**, not whatever another chat last set globally.
- **Remount isolation (bug `005`):** do **not** seed from global last-used or persist until `sessionReady`. Seed from warm cache via `loadSessionComposerSeed`. Discovery must not apply `lcp.ollama.lastModel` while `!sessionReady`.
- Team `subscribePresetSettings` must `applyPreset` only when `chatVisible` — otherwise every warm host resets to the edited preset's model/effort/mode.
