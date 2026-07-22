---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-07-07
last_verified: 2026-07-20
tags: [sessions, claude-code, cursor-cli, opencode-cli, resume, terminal, provider-session, bridge, disk, quack-v1, performance]
---

## Provider session bridge (Quack ↔ CLI session ids)

**Purpose:** Correlate Quack chats with on-disk CLI sessions across **Claude Code,
Cursor CLI, and OpenCode** — visible ids, unified ⟲ Sessions picker, terminal
resume, thin-transcript recovery, and a global reverse index on disk.

### Three ids (do not conflate)

| Id | Example | Meaning |
|---|---|---|
| Quack `ChatSession.id` | `c_abc…` | Transcript key on disk (`chats/{wsId}/{id}.json`) |
| Quack `AIChatDescriptor.id` | tab id | Open tab / rail row in `state.json` |
| Provider session id | UUID / `ses_*` | CLI on-disk session + `--resume` target |

The provider id is persisted on `ChatSession` as:

```ts
providerSessionIds?: Partial<Record<ProviderId, string>>;
// legacy alias: claudeSessionId === providerSessionIds["claude-code"]
```

### On-disk CLI layouts

| Provider | Session id shape | Transcript path |
|---|---|---|
| `claude-code` | UUID | `~/.claude/projects/<encoded-cwd>/<uuid>.jsonl` |
| `cursor-cli` | UUID | `~/.cursor/projects/<encoded-cwd>/agent-transcripts/<uuid>/<uuid>.jsonl` |
| `opencode-cli` | `ses_*` | `~/.local/share/opencode/storage/session/<hash>/ses_*.json` (+ message shards) |

`<encoded-cwd>` = `encode_project_path(cwd)` — lowercase drive letter (Windows),
then non-alphanumeric → `-`. Shared in `provider_path.rs`.

### Reverse index (Quack disk)

`~/Library/Application Support/codetta/chats/provider-links.json`:

```json
{
  "links": {
    "claude-code:4678eec3-…": {
      "ws_id": "ws_…",
      "quack_session_id": "c_…",
      "title": "Plane so stories"
    }
  }
}
```

Updated on every `chat_store_save`; removed on delete/evict.
Lookup: `chat_store_lookup_link(provider, cliSessionId)`.

### Where it lives

| Concern | File |
|---|---|
| Chip (copy + terminal) | `src/providerSessionChrome.tsx` → `ProviderSessionChip`, `allProviderLinkedTitles` |
| Terminal resume command | `src/providerSessionTerminal.ts` |
| ⟲ Sessions picker (multi-provider) | `src/components/chatPanelChrome.tsx` → `ProviderSessionsButton` |
| Legacy CC-only picker | `chatPanelChrome.tsx` → `ClaudeSessionsButton` (kept, unused in header) |
| Wiring | `src/components/AIChatPanel.tsx` |
| Id read/write | `src/providerSession.ts` (`mergeProviderSessionIds`, read/write) |
| First-turn flatten + image wire hint | `src/providers/cliPrompt.ts` (`wireUserContent`, `flattenMessages`) |
| Unified list/load (Rust) | `src-tauri/src/provider_sessions.rs` → `provider_list_sessions`, `provider_load_session` (both **async + `spawn_blocking`**, per-file summary cache) |
| Disk-hydrate poll (usage / ring from JSONL) | `src/components/AIChatPanel.tsx` (diskHydrate effect), `src/sessionDiskHydrate.ts` (`drawerStats` helpers) — **no** turn-count session-id guess |
| JSONL parser (shared) | `src-tauri/src/session_jsonl.rs` |
| CC list/load (legacy invoke) | `claude_code_list_sessions`, `claude_code_load_session` — still available |
| Thin-row recovery | `src/chatProviderRecovery.ts` (+ `cleanStaleToolMessages` strip) |
| User-message sanitization | `src/chatTextUtils.ts` → `stripEditorContextPrefix`, `stripCliFlattenScaffold`, `sanitizeUserMessageContent`, `cleanStaleToolMessages` |
| Tests | `src/chatTextUtils.test.ts`, `src/providers/cliPrompt.test.ts`, `src/chatStoreCache.test.ts` (link merge) |
| Platform pin (model picker) | `src/chatPinnedProvider.ts`, `src/components/modelPickerPlatform.tsx` — see **`057-platform-pin.md`** |
| Styles | `src/App.css` → `.ai-provider-session-*`, `.model-picker-platform-*`, session rows |

### UI

#### Provider session chip (chat header)

Shown after the first streamed turn assigns a provider session id (agentic providers only).

- **Label:** `CC` / `CU` / `OC`
- **Truncated id:** first 8 chars + `…`
- **Click chip:** copy full id
- **Terminal icon** (CC + Cursor): always spawns a **new** PTY, then runs `claude --resume` / `cursor-agent --resume`. IDE → bottom tab; Agent Mode → selects the new `term:<id>` tab in the right column (`setAgentContextPanel`)

#### ⟲ Sessions picker (all agentic providers)

Shown when the active model is `claude-code`, `cursor-cli`, or `opencode-cli`.

| Element | Meaning |
|---|---|
| **Filter pills** | All / CC / CU / OC |
| **Provider badge** | Row source CLI |
| **This chat** badge | Row id matches this chat's `providerSessionIds[provider]` |
| **Linked title** badge | Another Quack chat already points at this CLI session |
| **Terminal icon** | CC + Cursor only |

`onResume(provider, id)`: sets `providerSessionIds`, hydrates from
`provider_load_session` (CC + Cursor JSONL; OpenCode resume-only for now),
then runs `cleanStaleToolMessages` / `applyLoadedMessages` so wire prefixes
never land in the visible transcript.

### Data flow

```
Agentic stream emits session_id
  → AIChatPanel: providerSessionIdsRef + setState
  → patchSession IMMEDIATELY (id on disk before project-switch flush)
  → later saveSession / messages effect also writes provider-links upsert

User clicks ⟲ Sessions row
  → setProviderSessionId + provider_load_session
  → cleanStaleToolMessages / applyLoadedMessages → setMessages
  → next turn passes resumeSessionId from providerSessionIdsRef

Mount with thin / short Quack row
  → recoverSessionFromAnyProvider → first richer CLI transcript wins
  → toChatMessages already runs cleanStaleToolMessages (wire prefixes stripped)
  → thin = assistants < users OR ≤16 Quack messages with a linked CLI id
    (covers vite-only / restart truncations where assistants ≥ users)
  → does NOT auto-pick orphan sibling JSONLs (see bug 004)
```

### Gotchas (cross-project)

| Symptom | Cause | Mitigation |
|---|---|---|
| New CC UUID after workspace switch | Resume id missing on send / wiped on disk merge | `providerSessionIdsRef` + immediate patch; `preferRicherSession` keeps links |
| “No images” after follow-up | Lost-resume flatten dropped `message.images` | `wireUserContent` in `cliPrompt.ts` |
| Two CLI links → one Quack chat | Fork already happened; upsert is additive | ⟲ Sessions re-link; no auto-merge |
| Quack thin, CLI rich (same id) | Mid-run save / vite-only | `recoverSessionFromAnyProvider` on mount |
### Session identity safety (2026-07-20)

| Rule | Why |
|---|---|
| **Never invent** `providerSessionIds` from turn_count / list heuristics | Two CC JSONL files often share the same turn count → wrong `--resume` + recovery overwrites Quack history with another chat |
| Sid sources | (1) stream-json `session_id` on first agentic turn, (2) explicit ⟲ Sessions pick |
| **Persist sid immediately** on `session` / CC init | Project switch mid-turn used to flush a row without the id → next follow-up spawn a **new** JSONL and overwrite the Quack link (seen: astronaut `1b9e6e56` then `f136f591` on the same chat) |
| **`providerSessionIdsRef` on send** | `chatStream` resume id comes from the ref, not a stale React closure after remount |
| **`preferRicherSession` keeps CLI links** | Thin remount/`{}` must not wipe `providerSessionIds`; next wins only when it sets a provider |
| Display vs wire | Send keeps `displayUserMsg` (bare text) in Quack state; `ccPrefix` (`[Editor context]…`) goes only to the CLI |
| **Flatten reinjects `message.images`** | Lost-resume first-turn flatten reads path metadata via `wireUserContent` in `cliPrompt.ts` so the CLI still gets Read hints |
| Wire cadence | `ccWirePrompt.ts`: skip prefix for **any** CC slash (`/compact`, `/init`, `/review`, custom commands); reinject static QUACK EDITOR + Agent identity only on first CC wire / agent·Plan change / turn after slash; ephemeral hints (files, images, brain) still per-turn when present |
| Re-import sanitization | `sanitizeUserMessageContent` = `stripCliFlattenScaffold` then `stripEditorContextPrefix` — used by `cleanStaleToolMessages` on load / recover / ⟲ resume |
| Already-wrong / forked links | Not auto-merged; user re-links via ⟲ Sessions. Orphan richer JSONLs stay on disk. Polluted bubbles heal on next open via strip |

### Platform pin (one CLI per chat)

Once a chat has started on an **agentic** provider (`claude-code`, `cursor-cli`,
`opencode-cli`), Quack **pins** that platform:

| Field | `ChatSession.pinnedProviderId` — set on first agentic user turn |
| Resolve | `resolvePinnedPlatform()` — falls back to model / `providerSessionIds` for legacy rows |
| Picker | `ModelPickerPopover` filters to pinned platform; banner + confirm on cross-platform switch |
| Persist | Saved with transcript; cleared on **New chat** |

Cross-platform model picks show a Cursor-style warning: Quack keeps the transcript,
but each CLI owns a separate server-side session — tool context does not transfer.
Confirming a switch updates `pinnedProviderId` to the new platform.

### Terminal resume commands

`resumeProviderInTerminal` always calls `addTerminal` (never reuses an existing tab).

| Provider | Command written to PTY |
|---|---|
| `claude-code` | `cd '<cwd>' && claude --resume <uuid>` |
| `cursor-cli` | `cd '<cwd>' && cursor-agent --resume <id>` |
| `opencode-cli` | not supported (HTTP sidecar) |

### Tauri commands

```ts
provider_list_sessions(provider, cwd) → CliSessionSummary[]   // async, spawn_blocking
provider_load_session(provider, cwd, sessionId, maxMessages?) → LoadedMessage[]  // async, spawn_blocking; default cap 120
// provider: "claude-code" | "cursor-cli" | "opencode-cli"
// maxMessages: omit/undefined → 120; 0 → uncapped
```

`CliSessionSummary` adds a `provider` field vs legacy `ClaudeSession`.

### Performance — the JSONL-parse freeze fix (2026-07-16)

`provider_list_sessions` summarizes a provider's session dir by **parsing every
JSONL line-by-line** (`summarize_jsonl`: turn_count, first/last user text, cost).
A heavy Claude Code project holds hundreds of MB (single files ~100 MB seen;
`~/.claude/projects` was 1.1 GB / 1298 files). Three problems caused a **100% CPU
main-thread freeze on launch and on chat switch**:

| Problem | Fix |
|---|---|
| Command ran **synchronously on the Tauri main thread** → blocked the webview IPC pump → JS timers drifted ~1 s, UI froze | `provider_list_sessions` + `provider_load_session` → `async` + `tauri::async_runtime::spawn_blocking` |
| Re-parsed the **whole dir on every call** | Per-file summary cache in `summarize_jsonl`, gated on **(mtime, size)** — inactive JSONL parsed once ever; only the live session re-parses (one small file) |
| Frontend used to call `guessClaudeSessionId` from the 12 s disk-hydrate poll whenever a chat had no saved sid — re-parsed the project dir and could link the **wrong** CC JSONL by turn_count | **Removed** (2026-07-20). Sid comes only from stream-json `session_id` or an explicit ⟲ Sessions pick; poll skips JSONL stats when sid is absent |

### Performance — giant JSONL / WebKit RAM (2026-07-17)

| Problem | Fix |
|---|---|
| Cold list still line-parsed every file, including 10–90 MB JSONL | Files **≥ 8 MB** get a **light summary** (mtime/size stub title) on list; full parse only on load |
| Recovery / resume pulled entire multi-10MB transcripts into JS | `provider_load_session` defaults to **last 120 messages** (`PROVIDER_LOAD_MESSAGE_CAP`); pass `0` to uncap |
| Task Manager hid the real hog (`com.apple.WebKit.WebContent`) | Related WebKit rows in `process_stats` (see `046`) |

**Diagnosis note:** on macOS the Tauri webview is a **separate process**
(`com.apple.WebKit.WebContent`). When the Rust `Quack` process itself pegs a core,
the culprit is backend / IPC, not React — a JS render/effect probe correctly shows
nothing. `sample <pid>` on the Rust process is the fastest locator.

### Related features

- Disk transcript store: `043-chat-transcript-persistence.md`
- Session library: `001-ai-session-library.md`
- CC bridge: `014-claude-code-bridge.md`
- Cursor bridge: `026-cursor-cli-bridge.md`
- OpenCode bridge: `028-opencode-bridge.md`
- Platform pin (model picker): `057-platform-pin.md`
- Provider patterns: `design/agent-provider-patterns.md`

### Gotchas

- **OpenCode load** — list works from `ses_*.json` metadata; full transcript load from shards not yet implemented (resume via HTTP API works).
- **Ghostty / external terminal** — Quack cannot see them until linked via ⟲ Sessions or chip copy.
- **Chip after first turn** — no `session_id` until the CLI emits it.
- **Interactive CLI ≠ headless bridge** — only one should stream at a time.
- **Duplicate CLI id across Quack tabs** — linked-title badges surface it; last writer wins on next send.
- **Platform pin** — switching CLI mid-chat starts a fresh server-side session; use "Change platform…" only when you mean it.
- **Flattened first-turn prompt on recovery** — the CLI stores the whole `[System]…[User]…` first-turn `-p` packet as its first user message; recovery would render it as a giant `[System]…` user bubble. `stripCliFlattenScaffold` (`chatTextUtils.ts`, via `sanitizeUserMessageContent` / `cleanStaleToolMessages`) unwraps it to the real user text on load, healing old + new sessions.
- **Editor context prefix on recovery** — Quack sends `[Editor context]…[/Editor context]` (QUACK EDITOR, Agent identity, attachments) only on the CC wire; the Quack row stores bare user text. Re-importing CLI JSONL without stripping showed that block as a user bubble. `stripEditorContextPrefix` runs on every load/recover/⟲ resume.
- **Never invent a CC session id from turn_count** — the old `guessClaudeSessionId` helper mixed Quack chats with unrelated JSONL when two sessions shared a turn count. Link only via stream-json or ⟲ Sessions.
- **Never call `provider_list_sessions` synchronously per-render/per-poll** — it parses potentially hundreds of MB of JSONL. It is `spawn_blocking` + cached now, but a caller that fires it on a tight loop still spins disk I/O. Prefer a saved `providerSessionIds[provider]`; do not guess.
- **watcher.rs recursive, no ignore list** (separate, tracked follow-up) — `fs_watch_start` watches each root `RecursiveMode::Recursive` with no `target/`/`node_modules/`/`.git` exclusion, so build/dev-server churn floods `fs:event` → per-workspace `git status` + tree rescans. Not part of this fix.

### Future

- OpenCode transcript load from `storage/message/` + `storage/part/` shards
- Usage tab row → "Open in Quack" via `provider-links.json`
- Update `audit-chat-persistence.mjs` to read disk `chats/` tree
- OpenCode / Codex terminal resume where CLI supports it
