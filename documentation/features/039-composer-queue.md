---
type: feature
project: quack-desktop
created: 2026-07-05
last_verified: 2026-07-20
tags: [chat, composer, queue, ux, multitasking, bugfix, presets]
---

# 039 — Composer message queue (Cursor-style)

**Purpose:** Let the user type follow-up prompts while a turn is still
in flight — without losing them, without toast spam, and with a visible
preview of what will send next. Matches Cursor Composer queue UX: in-pill
cards above the textarea, `Send follow-up` placeholder, optional parallel
dispatch via **Start Multitasking**.

## Problem solved

Before this pass:

- Follow-ups typed during streaming were queued in a ref but surfaced only
  via a generic purple banner (`ai-queue-indicator`) and a toast on every
  enqueue (`Queued (N pending)`).
- The user could not see **what** was queued, only the count.
- **Send now** and **Clear** lived in the banner; no parallel path without
  stopping the current turn.
- `requestAIPrompt` was workspace-scoped only — a new chat tab in the same
  project would steal a multitask dispatch meant for the fresh panel.

## Components & modules

| File | Role |
|---|---|
| `src/composerQueue.ts` | `QueuedComposerMessage` type, persist strip, rehydrate, drain helpers |
| `src/components/ComposerQueue.tsx` | In-pill queue cards: badge, hint, preview, image thumbs, multitask menu, remove |
| `src/components/AIChatPanel.tsx` | Queue ref + UI state, `send`/`drainQueue`/`stop`, multitask wiring |
| `src/aiBus.ts` | Optional `chatId` on `AIPromptRequest` for targeted parallel send |
| `src/App.css` | `.ai-queue-*` inside `.ai-composer-shell` (order 0, above textarea) |

## Layout (inside `.ai-composer-shell`)

CSS flex `order` stack (see `003-design-system.md`):

| order | Block |
|---|---|
| 0 | Queue cards (`.ai-queue-stack`) — only when non-empty |
| 0 | Permission overlay (same order family) |
| 1 | Textarea row (`.ai-input-row`) |
| 2 | Toolbar (`.ai-composer-meta`) |

Each queued message renders as `.ai-queue-card`:

- **Header** (first card only): `{N} Queued` · `↵ to Send` · **Start Multitasking ▾** · remove (×)
- **Body:** truncated one-line preview + **assigned-agent avatar** (right); optional **image thumb row** (`.ai-queue-thumbs`, 36px) when the item has attachments
- **Footer** (2+ cards): inline Remove on subsequent cards

Styling uses design tokens only (`--bg-alt`, `--border`, `--fg-muted`) —
no hardcoded accent purple/green from the old banner.

## User flows

### Enqueue (default)

| Condition | Action |
|---|---|
| Turn idle | Enter → send immediately (unchanged) |
| `streaming !== null` or `runningTools` | Enter → push text + attached images to queue, clear composer |
| Images attached while busy | Same enqueue path — images persist on disk and drain with the message |
| AskUserQuestion answer while busy | Same enqueue path as composer send |

Placeholder while busy: **`Send follow-up`** (was the long "Type to queue…" string).

No toast on enqueue — the card is the feedback.

### Drain (automatic)

When `sendUserText` finishes (`finally`), if `queueRef` is non-empty,
`drainQueue()` **peeks** the head `QueuedComposerMessage`, applies its
snapshotted agent knobs (preset / model / effort / thinking / permMode),
rehydrates images, and awaits a single send. The head is **shifted only
when the turn actually starts** (`onTurnStarted`, past no-model / hard-cap
early exits) so a failed start no longer drops the item or stalls the rest.
The next item drains when that follow-up turn's `finally` runs.

```
turn ends (finally)
  liveTurnRef ← false          // synchronous, before drain
  if queueRef non-empty:
    setTimeout(drainQueue, 0)
      peek head QueuedComposerMessage
      applyQueueKnobs(next)      // restore agent + effort + model
      queueImagesAsAttachments(next)
      sendUserTextRef(prompt, imgs, { onTurnStarted → shift })
      turn ends → finally → drain next item …
```

Uses `sendUserTextRef` so the stable `useCallback([])` closure always
calls the latest `sendUserText` (stale `messages`/`selected` bug fix
predates this doc). `sendUserText` returns `boolean` (`false` on early exit).

#### `liveTurnRef` vs React `streaming`

| Signal | Updated | Used for |
|---|---|---|
| `liveTurnRef` | Sync: `true` at `sendUserText` entry, `false` in `finally` / `stop()` | Defensive re-queue guard; drain eligibility |
| `streaming` (`useState`) | Async React batch | UI spinner / composer placeholder |
| `runningTools` (`useState`) | Async React batch | Tool-phase UI |

**Enqueue** paths (`send()`, `answerQuestion()`) still gate on
`streaming !== null || runningTools` — that's correct for the composer.

**Drain** paths must **not** gate on `streaming` in `sendUserText`:
between multi-round agent turns `streaming` is `""` (empty string), which
is `!== null`, so the old defensive check re-queued every drained message
immediately.

#### Production freeze (2026-07-06)

| | |
|---|---|
| **Trigger** | User queues a follow-up (`Send follow-up` / Enter while turn active); turn ends; `drainQueue` runs |
| **Symptoms** | WKWebView `WebContent` ~100% CPU, RAM climbs to many GB, whole app unresponsive; Rust main process idle |
| **Root cause** | `drainQueue` used `while (queue.length > 0)`. `sendUserText` saw stale `streaming === ""` or `runningTools` in closure → `pushQueue` + instant `return`. `shift` + `push` left length unchanged → **infinite synchronous loop** (`setQueuedMessages`, `flushSessionState`, sparse-array growth in timers) |
| **Fix** | (1) One message per `drainQueue` call. (2) Defensive guard in `sendUserText` uses `liveTurnRef.current` only. (3) `stop()` clears `liveTurnRef` synchronously |

**Do not** reintroduce a `while` drain loop or a `streaming !== null` guard
inside `sendUserText` for the drain path.

### Send now

**Start Multitasking → Send now** (or programmatic `sendQueuedNow`):

1. `abortRef.current?.abort()` — stop current turn **without** calling
   `stop()` (which would clear the queue).
2. `sendUserText` `finally` runs → `drainQueue()` sends the next item.

### Start Multitasking → New chat

Parallel path (Cursor-style bypass):

1. Shift first queued message off the ref.
2. `addAIChat(wsId)` + `focusAIChat(wsId, newChatId)`.
3. `requestAIPrompt({ wsId, chatId: newChatId, text, images?, send: true })`.
4. Current turn keeps running in the original tab.

`AIChatPanel` filters bus events: `req.chatId && req.chatId !== aiChatId`
→ ignore. Panels without a matching `chatId` still accept legacy requests
(no `chatId` field).

### Stop / Esc

`stop()` clears the **entire** queue then aborts — intentional "change
direction now", not "send my follow-ups after abort". Differs from Send now.

### Remove

- × on the first card, or **Remove** on stacked cards → `removeQueueAt(i)`.
- No undo; user can re-type.

## State model

| Store | Scope | Notes |
|---|---|---|
| `queueRef` (`QueuedComposerMessage[]`) | Per chat session | Source of truth for drain logic |
| `queuedMessages` (`useState`) | Mirror of ref | Drives `ComposerQueue` render |
| `QueuedComposerMessage` | `{ text, images?, presetId, model, effort?, thinking?, permMode? }` | Agent knobs snapshotted at enqueue; thumbs stripped before persist |
| `liveTurnRef` (`boolean`) | Per `AIChatPanel` mount | Sync turn-in-flight flag; `false` before drain |
| `ChatSession.composer.queue` | Persisted | `QueuedComposerMessage[]`; legacy `string[]` normalized on load |
| `pushQueue(text, images?, knobs?)` | Helper | Builds item via `queueItemFromSend` + live refs; no-op if empty |
| `removeQueueAt` / `clearQueue` / `syncQueueUi` | Helpers | Keep ref + state in sync |
| `drainQueue` / `sendUserTextRef` | Drain pipeline | Peek → apply knobs → send; shift on `onTurnStarted` |

### Agent snapshot (2026-07-20)

Each queued follow-up carries the **composer agent at enqueue time**
(SubagentPill preset + live model / effort / thinking / permMode). Changing
the pill after enqueue does **not** retarget items already in the queue.
Drain restores those knobs onto refs before send (same ref-sync pattern as
Pass-the-ball). Multitask **New chat** forwards `AIPromptRequest.knobs` so
the parallel tab sends as the assigned agent. Queue cards show the agent
avatar via `resolveAvatar` (legacy items without knobs fall back to the
live session agent).

Vitest: `src/composerQueue.test.ts`.

### Image queue (2026-07-13)

Previously the queue was **text-only**: attaching images during an active turn
showed an Italian toast and dropped the send. Now images ride along:

| Step | Behaviour |
|---|---|
| Enqueue | `pushQueue(text, attachedImages)` — copies disk paths + inline thumbs |
| Persist | `stripQueueForPersist` — only `{ id, path, name }` on `ChatSession.composer.queue` |
| Restore | `normalizeQueuedDraft` accepts legacy `string[]`; `rehydrateQueue` rebuilds thumbs |
| Drain | `queueImagesAsAttachments` → `sendUserText(prompt, messages, imgs)` |
| Multitask | `AIPromptRequest.images` + optional `knobs` → target panel applies agent then sends |

Images-only follow-ups use prompt `"See the attached images."` (same as immediate send).

Queue is persisted on the session row (with the composer draft). Agent Mode
remounts the panel on every rail pick — without persistence, queued
follow-ups would be lost on switch.

## Related

- Composer shell layout: `022-chat-composer.md`
- Cross-component prompt bus: `src/aiBus.ts` (editor "Ask AI" actions)
- Permission cards stack above queue in the same order slot: `015-claude-permission-mode.md`
- New chat tab creation: `store.addAIChat` / `001-ai-session-library.md`
- Per-session persistence: `040-per-session-composer-state.md`

## Gotchas

- **Do not** call `stop()` from Send now — it wipes the queue.
- **Do not** reintroduce enqueue toasts; the card is the affordance.
- **Do not** drain the queue in a `while` loop — see **Production freeze** above.
- **Do not** use React `streaming` / `runningTools` inside `sendUserText` to
  decide whether to re-queue when `drainQueue` calls in — use `liveTurnRef`.
- **Do not** shift the queue head before `sendUserText` past early exits —
  peek + `onTurnStarted` shift; otherwise no-model / hard-cap drops the item
  and stalls remaining auto-drain.
- **Do not** call `applyPreset()` alone on drain — that resets effort/model
  to preset defaults and wipes user tweaks snapshotted on the item.
- Multitask **New chat** only sends the **first** queued message; the rest
  stay on the busy panel and drain when that turn ends.
- Queue + draft persist on `ChatSession.composer` — see `040-per-session-composer-state.md`.
- `sendUserText` defensive re-queue (if called while `liveTurnRef` is true)
  uses `pushQueue(text, images)` silently — callers should prefer `send()` which
  clears input first.
- **Do not** block image enqueue during an active turn — the queue card is the
  feedback; there is no toast.
