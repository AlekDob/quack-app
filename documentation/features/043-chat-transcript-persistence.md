---
type: feature
project: quack-desktop
created: 2026-07-06
last_verified: 2026-07-06
tags: [chat, persistence, localStorage, transcript, multitasking, reliability, audit]
---

# 043 — Chat transcript persistence (atomic per-session storage)

**Purpose:** Keep each workspace chat's message history durable across tab
switches, parallel multitasking agents, streaming turns, and app reload —
without read-modify-write races or silent `localStorage` failures.

## Problem solved

Audit on production data (Jul 2026) found **10 open tabs** across 6 workspaces
with missing or empty transcripts while `state.json` still listed the tab.
Root causes:

| Symptom | Root cause |
|---|---|
| Messages vanish after reload / switch | `saveSession` rewrote one **monolithic** JSON array per workspace; two mounted `AIChatPanel`s saving in parallel → last write wins |
| Intermittent saves | WebKit `localStorage` WAL grew to **~7 GB** rewriting a 4+ MB Virgilio blob; `setJson` failed silently |
| Partial turn lost on switch | Assistant text lived in `streaming` state until turn end; switch did not flush |
| Composer flush wiped messages | `mergeComposerDraft` created `{ messages: [] }` when no row existed yet |
| Tab open, chat empty | Descriptor in `state.json` with no matching `ChatSession` row (eviction, failed save, or never persisted) |

## Storage model (v2)

| Key | Contents |
|---|---|
| `lcp.ollama.history.{wsId}` | **Legacy** — single JSON array; auto-migrated on first access |
| `lcp.ollama.history.{wsId}.__idx__` | `{ ids: string[] }` — session ids newest-first, max 30 |
| `lcp.ollama.history.{wsId}.s.{sessionId}` | Full `ChatSession` row (messages, knobs, composer, …) |

Each `saveSession` writes **one** session key + updates the small index —
parallel chats no longer stomp each other.

### Migration

`migrateLegacyIfNeeded(wsId)` runs once per workspace per app boot:

1. Read legacy array at `lcp.ollama.history.{wsId}`
2. Write each session to `.s.{id}`
3. Build `.__idx__`, evict beyond `MAX_SESSIONS` (30)
4. `remove` legacy key

No user action required — first `loadSessions` / `saveSession` triggers it.

## Files

| File | Role |
|---|---|
| `src/chatHistory.ts` | `loadSession`, `loadSessions`, `saveSession` → `boolean`, `patchSession`, `deleteSession`, legacy migrate |
| `src/chatPersistFlush.ts` | Module-level registry; `flushAllChatPersist()` before chat switch |
| `src/chatSwitch.ts` | `pulseChatSwitch()` calls `flushAllChatPersist()` then UI veil |
| `src/composerDraft.ts` | `mergeComposerDraft` / `mergeSessionKnobs` → `patchSession` (never clobber messages) |
| `src/components/AIChatPanel.tsx` | Register flush, streaming checkpoint, save-failure toast |
| `scripts/audit-chat-persistence.mjs` | Offline audit: open tabs vs localStorage rows |

## API

```ts
loadSession(wsId, sessionId) → ChatSession | undefined
loadSessions(wsId) → ChatSession[]          // sorted by index
saveSession(wsId, session) → boolean        // false = quota / disabled storage
patchSession(wsId, sessionId, partial) → boolean  // merge; preserves messages if omitted
deleteSession(wsId, id) → void
```

## Persist triggers (`AIChatPanel`)

| When | What |
|---|---|
| `messages` change | `persistTranscriptRef()` → immediate `saveSession` |
| Streaming active | Every **5s** checkpoint (partial assistant appended) |
| Chat switch (`pulseChatSwitch`) | `flushAllChatPersist()` on all mounted panels |
| Panel unmount | `registerChatPersist` cleanup flushes |
| `beforeunload` | Partial assistant + messages |
| `mergeComposerDraft` / knobs | `patchSession` only |

Save failure → toast (max once per 30s):

> Chat not saved — storage may be full. Copy important messages or restart Quack.

## Three concepts (unchanged)

See `001-ai-session-library.md`:

- **AIChatDescriptor** — tab in `state.json` (title, `sessionId` pointer)
- **ChatSession** — transcript in localStorage (per-session key)
- **Claude Code `.jsonl`** — separate on-disk log under `~/.claude/projects/`; not auto-synced to Quack UI

A tab can exist without a transcript row; Quack shows an empty pane. Recovery
from CC JSONL is a separate future feature.

## Audit script

```bash
node scripts/audit-chat-persistence.mjs
```

Reads WebKit `localStorage` sqlite + `~/Library/Application Support/codetta/`
workspace `state.json`. Reports `OK` / `MISSING` / `EMPTY` per open tab.
Supports legacy array and v2 per-session keys.

## Recovery from Claude Code JSONL

When a `ChatSession` has a `claude-code` provider id but **fewer assistant
messages than user messages** (incomplete Quack row), `AIChatPanel` auto-calls
`recoverSessionFromCc` on mount / history open:

1. `claudeCode.loadSession(cwd, ccSessionId)` reads `~/.claude/projects/.../*.jsonl`
2. If loaded count > saved count → replace messages, `saveSession`, toast

File: `src/chatCcRecovery.ts`. Does not run when transcript is already complete.

## Gotchas

- **`saveSession` return value** — callers must check; failures are not thrown.
- **WAL bloat** — per-session keys shrink each write; restart Quack to checkpoint a bloated WAL from the legacy era.
- **MAX_SESSIONS (30)** — evicts oldest **transcript** ids from index + deletes `.s.{id}` keys; open tabs pointing at evicted ids open empty.
- **Do not** use monolithic array writes again — always per-session keys.
- **Agent Mode** mounts one `AIChatPanel` per open chat (CSS visibility); multiple panels can save concurrently — v2 storage is required.

## Related

- Session library model: `001-ai-session-library.md`
- Composer / knobs on same row: `040-per-session-composer-state.md`
- Chat switch veil: `chatSwitch.ts`, `ChatSwitchVeil.tsx`, `useChatSwitching.ts`
- Diary: `documentation/diary/2026-07-06.md` (18:25)
