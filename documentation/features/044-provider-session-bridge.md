---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-07-07
last_verified: 2026-07-07
tags: [sessions, claude-code, cursor-cli, resume, terminal, provider-session, bridge, quack-v1]
---

## Provider session bridge (Quack ↔ CLI session ids)

**Purpose:** Make the **provider server session id** visible and actionable so users can correlate Quack chats with on-disk Claude Code / Cursor CLI sessions and with interactive terminal runs (Ghostty, iTerm, etc.). Quack already stored `providerSessionIds` and resumed headlessly via `--resume`; this feature surfaces that id in the UI and adds a one-click path to continue the same session in the bottom terminal.

### Three ids (do not conflate)

| Id | Example | Meaning |
|---|---|---|
| Quack `ChatSession.id` | `s_abc…` | Transcript key in localStorage |
| Quack `AIChatDescriptor.id` | `c_xyz…` | Open tab / rail row |
| Provider session id | `4678eec3-…` (CC UUID) | On-disk JSONL + CLI `--resume` target |

The provider id is persisted on `ChatSession` as:

```ts
providerSessionIds?: Partial<Record<ProviderId, string>>;
// legacy alias: claudeSessionId === providerSessionIds["claude-code"]
```

On-disk path (Claude Code): `~/.claude/projects/<encoded-cwd>/<uuid>.jsonl`.

### Where it lives

| Concern | File |
|---|---|
| Chip (copy + terminal) | `src/providerSessionChrome.tsx` → `ProviderSessionChip` |
| Terminal resume command | `src/providerSessionTerminal.ts` → `resumeProviderInTerminal`, `cliResumeCommand` |
| CC session picker (enhanced) | `src/components/chatPanelChrome.tsx` → `ClaudeSessionsButton` |
| Wiring | `src/components/AIChatPanel.tsx` (header + resume hydrate) |
| Id read/write | `src/providerSession.ts` |
| CC list/load (backend) | `src-tauri/src/claude_code.rs` → `claude_code_list_sessions`, `claude_code_load_session` |
| Styles | `src/App.css` → `.ai-provider-session-*`, `.ai-cc-session-row`, badges |

### UI

#### Provider session chip (chat header)

Shown after the first streamed turn assigns a provider session id (agentic providers only).

- **Label:** `CC` / `CU` / `OC` by provider
- **Truncated id:** first 8 chars + `…`
- **Click chip:** copy full uuid to clipboard
- **Terminal icon** (CC + Cursor only): spawn or reuse bottom PTY, write `cd '<root>' && claude --resume <id>` (or `cursor-agent --resume`)

Chip is hidden until `providerSessionIds[provider]` is set.

#### ⟲ Sessions picker (Claude Code toolbar)

Pre-existing picker; enhanced rows:

| Element | Meaning |
|---|---|
| **This chat** badge | Row id matches current chat's `claudeSessionId` |
| **Linked title** badge | Another Quack chat already points at this CC session |
| **Id prefix** | `4678eec3…` in meta row |
| **Terminal icon** | Same as chip — resume in bottom terminal without switching Quack transcript |

Picker still calls `onResume`: sets `providerSessionIds`, hydrates transcript from `claude_code_load_session`, next user turn uses headless `--resume`.

### Data flow

```
CC stream-json init/result
  → AIChatPanel sets providerSessionIds["claude-code"]
  → saveSession (ChatSession row)

User clicks ⟲ Sessions row
  → setProviderSessionId + loadSession(JSONL) → setMessages
  → subsequent chat() passes resumeSessionId to Rust spawn

User clicks terminal icon
  → addTerminal(bottom) if needed
  → poll for ptyId → pty.write("cd … && claude --resume …\r")
```

### Terminal resume commands

| Provider | Command written to PTY |
|---|---|
| `claude-code` | `cd '<cwd>' && claude --resume <uuid>` |
| `cursor-cli` | `cd '<cwd>' && cursor-agent --resume <id>` |
| `opencode-cli` | not supported (Template B HTTP sidecar) |

Paths are single-quote shell escaped (`'` → `'\''`).

### Related features

- Session library concepts: `001-ai-session-library.md`
- CC bridge spawn/resume: `014-claude-code-bridge.md`
- Provider patterns: `design/agent-provider-patterns.md`
- CC transcript recovery when Quack row is thin: `chatCcRecovery.ts`
- Usage tab lists CC sessions by uuid (no Quack link yet — future: "Open in Quack")

### Gotchas

- **Ghostty / external terminal sessions** are separate processes — Quack cannot see them until you link via ⟲ Sessions or paste the uuid from the chip.
- **Chip appears only after first turn** — no `session_id` until CC emits it in stream-json.
- **Interactive CLI ≠ headless bridge** — Quack chat uses subprocess `-p`; terminal button starts an interactive TUI in the PTY. Both can `--resume` the same uuid but only one should be actively streaming at a time.
- **Multiple Quack chats** can theoretically point at the same CC id if the user resumes the same JSONL in two tabs — badges help surface that; last writer wins on next send.
- **PTY readiness** — terminal button polls up to ~4s for `ptyId` after `addTerminal`; fails with toast if shell not ready.

### Future (not implemented)

- Usage tab row → "Open in Quack" when `claudeSessionId` matches
- External CLI detector (warn when `claude` pid runs outside Quack tree for same cwd)
- OpenCode / Codex terminal resume where CLI supports it
