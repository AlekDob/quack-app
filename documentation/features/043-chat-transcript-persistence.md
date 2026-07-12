---
type: feature
project: quack-desktop
created: 2026-07-06
last_verified: 2026-07-12
tags: [chat, persistence, disk, rust, transcript, multitasking, reliability, provider-links, audit]
---

# 043 — Chat transcript persistence (disk-backed per-session storage)

**Purpose:** Keep each workspace chat's message history durable across tab
switches, parallel multitasking agents, streaming turns, and app reload —
without read-modify-write races, WebKit `localStorage` quota failures, or silent
save drops.

## Problem solved

Audit on production data (Jul 2026) found **10 open tabs** across 6 workspaces
with missing or empty transcripts while `state.json` still listed the tab.
Root causes (v1/v2):

| Symptom | Root cause |
|---|---|
| Messages vanish after reload / switch | Monolithic `localStorage` array; parallel `AIChatPanel`s → last write wins |
| Intermittent saves | WebKit WAL bloat rewriting 4+ MB blobs; `setJson` failed at ~5 MB quota |
| Partial turn lost on switch | Assistant text in `streaming` until turn end; switch did not flush |
| Composer flush wiped messages | `mergeComposerDraft` created `{ messages: [] }` when no row existed yet |
| Tab open, chat empty | Descriptor in `state.json` with no matching `ChatSession` row |

**v3 fix (Jul 2026):** move transcripts to **Rust disk storage** (no quota).
Auto-migrate from legacy `localStorage` on first boot hydrate per workspace.

## Storage model (v3 — current)

| Path | Contents |
|---|---|
| `~/Library/Application Support/codetta/chats/{wsId}/__idx__.json` | `{ ids: string[] }` — session ids newest-first, max 30 |
| `~/Library/Application Support/codetta/chats/{wsId}/{sessionId}.json` | Full `ChatSession` row (messages, knobs, composer, `providerSessionIds`, `pinnedProviderId`, …) |
| `~/Library/Application Support/codetta/chats/provider-links.json` | Reverse index: `"provider:cliSessionId"` → `{ ws_id, quack_session_id, title }` |

Each `chat_store_save` writes **one** session file atomically (`atomic::write`)
+ updates the small index + upserts provider link rows.

### Legacy (v1/v2 — auto-migrated)

| Key | Contents |
|---|---|
| `lcp.ollama.history.{wsId}` | Monolithic JSON array |
| `lcp.ollama.history.{wsId}.__idx__` | Per-session index in `localStorage` |
| `lcp.ollama.history.{wsId}.s.{sessionId}` | Per-session row in `localStorage` |

On first `hydrateChatStore(wsId)`: if disk is empty, read legacy keys, write each
session via `chat_store_save`, then `remove` legacy keys.

### In-memory cache (frontend)

`chatStoreCache.ts` holds a per-workspace `Map<sessionId, ChatSession>` hydrated
from disk at boot. `chatHistory.ts` APIs remain **sync** against this cache;
disk writes are async fire-and-forget with failure toast via `registerChatSaveFailed`.

## Files

| File | Role |
|---|---|
| `src-tauri/src/chat_store.rs` | `chat_store_load_workspace`, `chat_store_save`, `chat_store_delete`, `chat_store_lookup_link`, `chat_store_all_links` |
| `src-tauri/src/provider_sessions.rs` | Unified CLI list/load — see `044-provider-session-bridge.md` |
| `src-tauri/src/session_jsonl.rs` | Shared JSONL parser (CC + Cursor agent-transcripts) |
| `src-tauri/src/provider_path.rs` | `encode_project_path` — same slug as CC/Cursor on-disk dirs |
| `src/chatStoreCache.ts` | Hydrate, migrate, in-memory cache, async disk flush |
| `src/chatHistory.ts` | Public API: `loadSession`, `saveSession`, `patchSession`, `deleteSession` |
| `src/chatProviderRecovery.ts` | Hydrate thin Quack rows from CLI on-disk transcripts (all agentic providers) |
| `src/chatCcRecovery.ts` | Thin wrapper → `chatProviderRecovery` (CC-only compat) |
| `src/chatPersistFlush.ts` | `flushAllChatPersist()` / `flushWorkspaceChatPersist(wsId)` before chat switch |
| `src/chatSwitch.ts` | `pulseChatSwitch({ veil?, flushWsId? })`, `endChatSwitch()` on hydrate |
| `src/composerDraft.ts` | `mergeComposerDraft` / `mergeSessionKnobs` → `patchSession` |
| `src/components/AIChatPanel.tsx` | Register flush, streaming checkpoint, save-failure toast |
| `src/store.ts` | `hydrate()` calls `hydrateChatStore(wsId)` for every open workspace |
| `scripts/audit-chat-persistence.mjs` | Offline audit — **still reads WebKit localStorage**; use disk paths above for v3 rows until script is updated |

## API

### TypeScript (sync, cache-backed)

```ts
hydrateChatStore(wsId) → Promise<void>   // boot; migrates legacy localStorage once
loadSession(wsId, sessionId) → ChatSession | undefined
loadSessions(wsId) → ChatSession[]
saveSession(wsId, session) → boolean      // cache always ok; disk fail → toast
patchSession(wsId, sessionId, partial) → boolean
deleteSession(wsId, id) → void
```

### Rust (Tauri invoke)

```ts
chat_store_load_workspace(wsId) → { ids, sessions }
chat_store_save(wsId, session) → void
chat_store_delete(wsId, sessionId) → void
chat_store_lookup_link(provider, cliSessionId) → ProviderLink | null
```

## Persist triggers (`AIChatPanel`)

| When | What |
|---|---|
| `messages` change | `persistTranscriptRef()` → `saveSession` → disk |
| Streaming active | Every **5s** checkpoint (partial assistant appended) |
| Chat switch (`pulseChatSwitch`) | `flushWorkspaceChatPersist` when `flushWsId` set; else all mounted panels. Veil optional — see `064`. |
| Panel unmount | `registerChatPersist` cleanup flushes |
| `beforeunload` | Partial assistant + messages |
| `mergeComposerDraft` / knobs | `patchSession` only |

Save failure → toast (max once per 30s via `registerChatSaveFailed`):

> Chat not saved — disk write failed. Copy important messages or restart Quack.

## Three concepts (unchanged)

See `001-ai-session-library.md`:

- **AIChatDescriptor** — tab in `state.json` (title, `sessionId` pointer)
- **ChatSession** — transcript on disk (`chats/{wsId}/{sessionId}.json`)
- **CLI on-disk session** — authoritative agentic transcript per provider; linked via `providerSessionIds` — see `044`

A tab can exist without a transcript row; Quack shows an empty pane.

## Recovery from CLI on-disk transcripts

When a `ChatSession` has a provider id but **fewer assistant messages than user
messages** (incomplete Quack row), `AIChatPanel` auto-calls
`recoverSessionFromAnyProvider` on mount / history open:

1. For each linked agentic provider (`claude-code`, `cursor-cli`; OpenCode TBD)
2. `provider_load_session(cwd, provider, cliId)` reads CLI JSONL / transcript
3. If loaded count > saved count → replace messages, `saveSession`, toast

Files: `src/chatProviderRecovery.ts`, `src-tauri/src/provider_sessions.rs`.

## Boot hydrate + on-demand hydrate

`store.hydrate()` after workspace disk load, for the workspaces open at boot:

```
Promise.all(survivingIds.map(hydrateChatStore))
```

Splash phase: **"Loading chat history…"** (~92% progress).

**On-demand:** a project opened *after* boot (picker / activity bar / command
palette / Agent Mode / `actions.ts`) goes through `store.openWorkspace`, which
`await hydrateChatStore(meta.id)` **before** the `set(...)` that mounts its
`AIChatHost` panels. Without this the panels mount against a cold cache →
`loadSessions` returns `[]` → empty transcripts, and the next `saveSession`
overwrites the real on-disk row. Idempotent (`hydrated` guard) → no cost when
the workspace was already warmed at boot.

## Gotchas

- **Disk is source of truth** — `localStorage` is legacy only; do not add new chat keys there.
- **Always hydrate before mounting a panel** — every code path that makes a workspace live (boot `hydrate()` AND `openWorkspace`) must `await hydrateChatStore(wsId)` first. A panel mounted against a cold cache shows an empty transcript and can overwrite the disk row on its next save.
- **`saveSession` return value** — always `true` for cache; disk failures surface via toast callback.
- **MAX_SESSIONS (30)** — evicts oldest transcript files + provider-link cleanup for evicted rows.
- **Do not** use monolithic array writes — always per-session files.
- **Agent Mode** mounts one `AIChatPanel` per open chat; parallel saves are safe (separate files).
- **Vite-only dev** (`npm run dev` without Tauri) — `hydrateChatStore` falls back to legacy `localStorage` read.
- **Audit script** — `audit-chat-persistence.mjs` predates v3; inspect `~/Library/Application Support/codetta/chats/` for ground truth.

## Related

- Session library model: `001-ai-session-library.md`
- Provider session bridge: `044-provider-session-bridge.md`
- Composer / knobs on same row: `040-per-session-composer-state.md`
- Startup hydrate: `032-startup-hydration.md`
- Chat switch veil: `chatSwitch.ts`, `ChatSwitchVeil.tsx`, `useChatSwitching.ts`
- Diary: `documentation/diary/2026-07-06.md` (v2), `2026-07-08.md` (v3 disk)
