---
type: feature
project: quack-desktop
created: 2026-07-05
last_verified: 2026-07-05
tags: [chat, composer, queue, ux, multitasking]
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
| `src/components/ComposerQueue.tsx` | In-pill queue cards: badge, hint, preview, multitask menu, remove |
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
- **Body:** truncated one-line preview of the message text
- **Footer** (2+ cards): inline Remove on subsequent cards

Styling uses design tokens only (`--bg-alt`, `--border`, `--fg-muted`) —
no hardcoded accent purple/green from the old banner.

## User flows

### Enqueue (default)

| Condition | Action |
|---|---|
| Turn idle | Enter → send immediately (unchanged) |
| `streaming !== null` or `runningTools` | Enter → push text to queue, clear input, show card(s) |
| Images attached while busy | Block with toast — queue is **text-only** |
| AskUserQuestion answer while busy | Same enqueue path as composer send |

Placeholder while busy: **`Send follow-up`** (was the long "Type to queue…" string).

No toast on enqueue — the card is the feedback.

### Drain (automatic)

When `sendUserText` finishes (`finally`), if `queueRef` is non-empty,
`drainQueue()` shifts messages one at a time and awaits each send.
Uses `sendUserTextRef` so the stable `useCallback([])` closure always
calls the latest `sendUserText` (stale `messages`/`selected` bug fix
predates this doc).

### Send now

**Start Multitasking → Send now** (or programmatic `sendQueuedNow`):

1. `abortRef.current?.abort()` — stop current turn **without** calling
   `stop()` (which would clear the queue).
2. `sendUserText` `finally` runs → `drainQueue()` sends the next item.

### Start Multitasking → New chat

Parallel path (Cursor-style bypass):

1. Shift first queued message off the ref.
2. `addAIChat(wsId)` + `focusAIChat(wsId, newChatId)`.
3. `requestAIPrompt({ wsId, chatId: newChatId, text, send: true })`.
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
| `queueRef` (`string[]`) | Per chat session | Source of truth for drain logic |
| `queuedMessages` (`useState`) | Mirror of ref | Drives `ComposerQueue` render |
| `ChatSession.composer.queue` | Persisted | Restored on tab/history switch — see `040-per-session-composer-state.md` |
| `pushQueue` / `removeQueueAt` / `clearQueue` / `syncQueueUi` | Helpers | Keep ref + state in sync |

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
- Multitask **New chat** only sends the **first** queued message; the rest
  stay on the busy panel and drain when that turn ends.
- `sendUserText` defensive re-queue (if called while busy) uses `pushQueue`
  silently — callers should prefer `send()` which clears input first.
