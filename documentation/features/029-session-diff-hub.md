---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-07-03
last_verified: 2026-07-16
tags: [agent-hub, session-diff, edit-stats, chatDiffStore, hub-subtitle, performance]
---

## Session diff subtitles (Agent Hub)

**Purpose:** When the Agent Hub rail is expanded, each chat row can show a
**second line** summarizing file edits from the agent's latest turn — Cursor-style
`Edited foo.ts −12 +34` or `+N −M · K files`. Gives Alek at-a-glance "what did
this agent change?" without opening the chat.

**Stack:** module-level pub/sub (same pattern as `aiTaskStore` / `agentStatusStore`),
derived from existing `extractEditDiffs` / `diffStats` in `chatToolRender.tsx`.

### Data model

`SessionDiffSummary` (`sessionDiffStats.ts`):

| Field | Meaning |
|---|---|
| `added` | Total `+` lines across Edit/Write/MultiEdit in scope |
| `removed` | Total `−` lines |
| `files` | Unique paths touched |

Two scopes:

- **`summarizeLastTurn(messages)`** — edits after the last user message (latest
  agent turn). Used for hub subtitles and live publish.
- **`summarizeEdits(messages)`** — all edits in the full transcript (exported,
  not wired to UI yet).

### Producer / consumer

| Role | File |
|---|---|
| Live publish (mounted chat) | `AIChatPanel` → `publishChatDiff(aiChatId, summarizeLastTurn(messages))` on every `messages` change — **deduped**: `notify()` fires only when `{added,removed,files}` actually changed, so a no-op republish doesn't re-render the whole rail (`029` subtitle + every row + `WorkHubBadge`) |
| Hydrate (background chats) | `AIChatsRail` → `hydrateChatDiff(chatId, wsId, sessionId)` reads `loadSessions` once per chat |
| Store (pub/sub) | `chatDiffStore.ts` — `getChatDiff`, `subscribeChatDiff`, `clearChatDiff` |
| Hub UI | `AIChatsRail` → `HubDiffLine` + `DiffCounts` when `expanded` |
| Cleanup | `store.ts` → `clearChatDiff(id)` when a chat tab is closed |

### Hub row layout

When expanded **and** a summary exists:

```
[dot] [badge]  Chat title
              Edited App.css −3 +41     ← single file
              −12 +34 · 3 files         ← multiple files
```

- Row gets `.has-diff`; title + subtitle stack in `.agent-hub-row-body`.
- `+` = `.agent-hub-diff-add` (`--ok`), `−` = `.agent-hub-diff-del` (`--err`).
- Collapsed hub still shows title only (no diff line — saves horizontal space).

### Gotchas

- **Mount-asymmetry:** only the mounted `AIChatPanel` publishes live updates;
  background chats rely on `hydrateChatDiff` from persisted `chatHistory`. Re-hydrate
  happens when hub entry set changes (`totalChats`, `activeId`, `loaded`).
- **ComposeCard overlap:** when a turn has edits, `ComposeCard` is the canonical
  recap in the chat stream; per-file edit pills are hidden via `hideEdits` on
  `InterleavedBlocks` (see feature 006). Hub subtitle still counts those edits.
- **Threshold:** subtitle appears whenever `summarizeLastTurn` returns non-null
  (≥1 edit with path or line stats). No minimum file count.
