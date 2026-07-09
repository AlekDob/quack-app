---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-07-07
last_verified: 2026-07-08
tags: [sessions, claude-code, cursor-cli, opencode-cli, resume, terminal, provider-session, bridge, disk, quack-v1]
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
| Unified list/load (Rust) | `src-tauri/src/provider_sessions.rs` → `provider_list_sessions`, `provider_load_session` |
| JSONL parser (shared) | `src-tauri/src/session_jsonl.rs` |
| CC list/load (legacy invoke) | `claude_code_list_sessions`, `claude_code_load_session` — still available |
| Thin-row recovery | `src/chatProviderRecovery.ts` |
| Styles | `src/App.css` → `.ai-provider-session-*`, `.ai-cc-sessions-filter`, session rows |

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

### Terminal resume commands

| Provider | Command written to PTY |
|---|---|
| `claude-code` | `cd '<cwd>' && claude --resume <uuid>` |
| `cursor-cli` | `cd '<cwd>' && cursor-agent --resume <id>` |
| `opencode-cli` | not supported (HTTP sidecar) |

### Tauri commands

```ts
provider_list_sessions(provider, cwd) → CliSessionSummary[]
provider_load_session(provider, cwd, sessionId) → LoadedMessage[]
// provider: "claude-code" | "cursor-cli" | "opencode-cli"
```

`CliSessionSummary` adds a `provider` field vs legacy `ClaudeSession`.

### Related features

- Disk transcript store: `043-chat-transcript-persistence.md`
- Session library: `001-ai-session-library.md`
- CC bridge: `014-claude-code-bridge.md`
- Cursor bridge: `026-cursor-cli-bridge.md`
- OpenCode bridge: `028-opencode-bridge.md`
- Provider patterns: `design/agent-provider-patterns.md`

### Gotchas

- **OpenCode load** — list works from `ses_*.json` metadata; full transcript load from shards not yet implemented (resume via HTTP API works).
- **Ghostty / external terminal** — Quack cannot see them until linked via ⟲ Sessions or chip copy.
- **Chip after first turn** — no `session_id` until the CLI emits it.
- **Interactive CLI ≠ headless bridge** — only one should stream at a time.
- **Duplicate CLI id across Quack tabs** — linked-title badges surface it; last writer wins on next send.
- **Flattened first-turn prompt on recovery** — the CLI stores the whole `[System]…[User]…` first-turn `-p` packet as its first user message; recovery would render it as a giant `[System]…` user bubble. `stripCliFlattenScaffold` (`chatTextUtils.ts`, called from `cleanStaleToolMessages`) unwraps it to the real user text on load, healing old + new sessions.

### Future

- OpenCode transcript load from `storage/message/` + `storage/part/` shards
- Usage tab row → "Open in Quack" via `provider-links.json`
- Update `audit-chat-persistence.mjs` to read disk `chats/` tree
- OpenCode / Codex terminal resume where CLI supports it
