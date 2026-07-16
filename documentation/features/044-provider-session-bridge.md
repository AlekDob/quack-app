---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-07-07
last_verified: 2026-07-16
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
| Id read/write | `src/providerSession.ts` |
| Unified list/load (Rust) | `src-tauri/src/provider_sessions.rs` → `provider_list_sessions`, `provider_load_session` (both **async + `spawn_blocking`**, per-file summary cache) |
| Disk-hydrate poll + session-id guess | `src/components/AIChatPanel.tsx` (diskHydrate effect), `src/sessionDiskHydrate.ts` → `guessClaudeSessionId` |
| JSONL parser (shared) | `src-tauri/src/session_jsonl.rs` |
| CC list/load (legacy invoke) | `claude_code_list_sessions`, `claude_code_load_session` — still available |
| Thin-row recovery | `src/chatProviderRecovery.ts` |
| Platform pin (model picker) | `src/chatPinnedProvider.ts`, `src/components/modelPickerPlatform.tsx` — see **`057-platform-pin.md`** |
| Styles | `src/App.css` → `.ai-provider-session-*`, `.model-picker-platform-*`, session rows |

### UI

#### Provider session chip (chat header)

Shown after the first streamed turn assigns a provider session id (agentic providers only).

- **Label:** `CC` / `CU` / `OC`
- **Truncated id:** first 8 chars + `…`
- **Click chip:** copy full id
- **Terminal icon** (CC + Cursor): `claude --resume` / `cursor-agent --resume` in bottom PTY

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
`provider_load_session` (CC + Cursor JSONL; OpenCode resume-only for now).

### Data flow

```
Agentic stream emits session_id
  → AIChatPanel sets providerSessionIds[provider]
  → saveSession → chat_store_save + provider-links upsert

User clicks ⟲ Sessions row
  → setProviderSessionId + provider_load_session → setMessages
  → next turn passes resumeSessionId to provider chat()

Mount with thin Quack row (users > assistants)
  → recoverSessionFromAnyProvider → first richer CLI transcript wins
```

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

| Provider | Command written to PTY |
|---|---|
| `claude-code` | `cd '<cwd>' && claude --resume <uuid>` |
| `cursor-cli` | `cd '<cwd>' && cursor-agent --resume <id>` |
| `opencode-cli` | not supported (HTTP sidecar) |

### Tauri commands

```ts
provider_list_sessions(provider, cwd) → CliSessionSummary[]   // async, spawn_blocking
provider_load_session(provider, cwd, sessionId) → LoadedMessage[]  // async, spawn_blocking
// provider: "claude-code" | "cursor-cli" | "opencode-cli"
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
| Frontend `guessClaudeSessionId` (in the 12 s disk-hydrate poll) re-ran the full parse **every tick** when a chat had no saved `claudeSessionId` | `guessAttemptRef` in `AIChatPanel` — the guess runs once per distinct assistant-turn count, not every poll |

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
- **Flattened first-turn prompt on recovery** — the CLI stores the whole `[System]…[User]…` first-turn `-p` packet as its first user message; recovery would render it as a giant `[System]…` user bubble. `stripCliFlattenScaffold` (`chatTextUtils.ts`, called from `cleanStaleToolMessages`) unwraps it to the real user text on load, healing old + new sessions.
- **Never call `provider_list_sessions` synchronously per-render/per-poll** — it parses potentially hundreds of MB of JSONL. It is `spawn_blocking` + cached now, but a caller that fires it on a tight loop still spins disk I/O. Attempt session-id guesses once per turn-count (see the freeze-fix table), and prefer a saved `providerSessionIds[provider]` over guessing.
- **watcher.rs recursive, no ignore list** (separate, tracked follow-up) — `fs_watch_start` watches each root `RecursiveMode::Recursive` with no `target/`/`node_modules/`/`.git` exclusion, so build/dev-server churn floods `fs:event` → per-workspace `git status` + tree rescans. Not part of this fix.

### Future

- OpenCode transcript load from `storage/message/` + `storage/part/` shards
- Usage tab row → "Open in Quack" via `provider-links.json`
- Update `audit-chat-persistence.mjs` to read disk `chats/` tree
- OpenCode / Codex terminal resume where CLI supports it
