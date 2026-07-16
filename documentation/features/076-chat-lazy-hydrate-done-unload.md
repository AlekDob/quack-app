---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-07-16
last_verified: 2026-07-16
tags: [chat, performance, hydrate, lazy-load, done, mount, ram, multitask, quack-v1]
---

## Chat lazy hydrate + DONE host unload

**Purpose:** Cut RAM and React cost when a workspace has many DONE sessions and
long transcripts — load session bodies on demand, and unmount DONE/archived
chat panels when hidden — without breaking live multitask streaming.

**Stack:** `chat_store.rs` + `chatStoreCache.ts` + `chatHostMount.ts` +
`AIChatHost` / `AgentChatHost` / `DrawerAIChatHost`

### Problem

| Cost | Before |
|---|---|
| Boot / workspace open | `chat_store_load_workspace` read **every** `*.json` body (≤30) into RAM |
| Agent Mode / editor | Hosts were **lazy-then-sticky**: first visit → mounted forever, including DONE |
| DONE rail | Already cheap (metadata + Latest 10) — not the bottleneck |

Browsing many long DONE chats left full `AIChatPanel` trees + message arrays in
memory. Boot paid disk+parse for transcripts the user never reopened.

### Policy

| Kind | Hidden host | Transcript in RAM |
|---|---|---|
| **Live** (`!doneAt && !archivedAt`) | Stay mounted (multitask / streams) | Warm at boot + stay warm while mounted |
| **DONE / archived** | Unmount when `!visible` | Cold until open; dropped on unload |
| **Visible** (any) | Mounted | Loaded via `ensureSessionLoaded` |

Helper: `shouldKeepChatHostMounted({ visible, doneAt, archivedAt })` in
`src/chatHostMount.ts`.

### Data flow

```
Boot / openWorkspace
  → hydrateChatStore(wsId, warmLiveSessionIds)
  → chat_store_load_workspace → { ids, sessions: [] }
  → for each warm id: chat_store_load → put in Map

Open / focus chat (incl. DONE)
  → AIChatPanel effect
  → ensureSessionLoaded(wsId, sessionId)
  → applyLoadedMessages

Leave DONE chat
  → host setMounted(false)  (flush via registerChatPersist unmount)
  → dropCachedSessionBody(wsId, sessionId)  // index kept
```

Warm ids come from workspace descriptors: `sessionId` of chats with neither
`doneAt` nor `archivedAt` (`warmChatIdsFromWs` in `store.ts`).

### Files

| Type | Path | Role |
|---|---|---|
| Util | `src/chatHostMount.ts` | `shouldKeepChatHostMounted` |
| Store | `src/chatStoreCache.ts` | Index hydrate, `ensureSessionLoaded`, `dropCachedSessionBody`, warm ids |
| Service | `src/chatHistory.ts` | Re-exports + `listSessionIds` |
| Store | `src/store.ts` | Passes warm ids into `hydrateChatStore` on boot / open |
| Component | `src/components/AgentModeShell.tsx` | `AgentChatHost` unload policy |
| Component | `src/components/WorkspaceShell.tsx` | `AIChatHost` unload policy |
| Component | `src/components/TabContentHost.tsx` | `DrawerAIChatHost` unload policy |
| Component | `src/components/AIChatPanel.tsx` | Awaits `ensureSessionLoaded` before messages |
| Rust | `src-tauri/src/chat_store.rs` | `chat_store_load_workspace` (ids only), `chat_store_load` (one body) |
| Rust | `src-tauri/src/lib.rs` | Registers `chat_store_load` |

### Key APIs

```ts
// Frontend
hydrateChatStore(wsId, warmIds?) → Promise<void>
ensureSessionLoaded(wsId, sessionId) → Promise<ChatSession | undefined>
dropCachedSessionBody(wsId, sessionId) → void  // RAM only; disk + index stay
loadSession / loadSessions  // sync, warm cache only
listSessionIds(wsId) → string[]  // full disk index

// Rust invoke
chat_store_load_workspace(wsId) → { ids, sessions: [] }
chat_store_load(wsId, sessionId) → ChatSession | null
```

### Gotchas

- **Sync `loadSessions` is warm-only.** Hub diffs / `AgentHubWatcher` already
  target live chats; DONE bodies may be absent until reopen.
- **Descriptor count ≠ transcript files.** Hub can show “84 Done” descriptors
  while disk keeps ≤30 session files (`MAX_SESSIONS`). Reopen past eviction →
  empty / thin row + CLI recover (`044`).
- **Unmount flush order:** dropping the body runs after `mounted=false`; panel
  unmount still flushes via `registerChatPersist` cleanup first.
- **Live sticky still wins.** Marking done mid-stream while another chat is
  focused: host unloads once hidden; do not unmount a **visible** DONE chat.
- **Message virtualization** (windowed `turns.map`) is **not** this feature —
  still the main cost for a single monster open transcript. Follow-up.

### Related

| Feature | Relation |
|---|---|
| `043-chat-transcript-persistence.md` | Disk layout + save/flush; lazy load extends hydrate |
| `001-ai-session-library.md` | Descriptors vs sessions; mount asymmetry |
| `064-agent-hub-drawer-and-chat-tab-switch.md` | Visibility stacking; DONE unload carve-out |
| `032-startup-hydration.md` | Boot calls warm hydrate |
| `009-agent-hub.md` | DONE preview 10 / search 30 (list stays metadata-only) |
| `075-chat-switch-loader.md` | Veil covers cold `ensureSessionLoaded` latency |
| `058-workspace-switch-performance.md` | Sibling: heavy UI unload for background workspaces |

### Verify

- Mark done → switch away → React host gone; reopen remounts + disk load.
- Live A streaming → switch to B → A keeps streaming (still mounted).
- Boot with many DONE + few live → only live bodies read at hydrate.
- `npm run build` + smoke Done reopen in `tauri dev`.
