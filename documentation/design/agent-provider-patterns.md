---
type: design-pattern
project: quack-desktop
created: 2026-07-01
last_verified: 2026-07-01
tags: [providers, claude-code, cursor-cli, opencode, codex-cli, subprocess, sidecar, sse]
---

# Agent provider patterns (Template A vs B)

Quack integrates local coding agents through **two patterns**. Do not force one shape on all CLIs — pick based on spike evidence.

## Template A — Subprocess NDJSON

**When:** CLI exposes stable non-interactive mode with line-delimited JSON on stdout.

**Examples:** Claude Code (`claude -p --output-format stream-json`), Cursor CLI (`cursor-agent`), Codex CLI (`codex exec --json`).

### Anatomy

```
Rust: *_code.rs
  check() | chat(spawn) | kill(process_group)
  BufReader stdout → emit tauri event *-stream:<id> { line, stderr, end }
  idle watchdog (120s)

TS: *Code.ts (ChatProvider)
  listen events → parser → ChatStreamEvent[]
  resumeSessionId from providerSessionIds

Parser: dedicated per format (shared only when byte-compatible)
  cliStreamJson.ts     → Anthropic stream-json (CC + Cursor)
  codexStreamJson.ts   → Codex JSONL (thread/item/turn)
```

### Spawn checklist

- [ ] Prompt via argv (not stdin) unless CLI requires stdin-only mode
- [ ] `stdin(Stdio::null())` when prompt is argv (**Codex requirement**)
- [ ] `current_dir(workspace_root)`
- [ ] Kill **process group** on Stop
- [ ] Capture stderr separately (progress / errors)

---

## Template B — Sidecar HTTP + SSE

**When:** Subprocess headless mode is broken or incomplete; upstream ships OpenAPI + event bus.

**Example:** OpenCode (`opencode serve` + `/session` + `/global/event`).

### Anatomy

```
Rust: *_sidecar.rs
  spawn opencode serve --port P --hostname 127.0.0.1
  health poll /global/health (up to 60s cold boot)
  kill on window teardown

TS: *Provider.ts
  fetch: session.create, session.promptAsync (204, fire-and-forget)
  EventSource: /global/event (NOT SDK fetch stream in WKWebView)
  session.abort on Stop
  ?directory=<workspace> on every session-scoped call
```

### WKWebView rule

Import SDK from `@opencode-ai/sdk/client` only. For **live** events use native `EventSource` on `/global/event` — spaceship gotcha `opencode-sse-eventsource-wkwebview`.

---

## Shared session model

Quack owns the **chat transcript**. Each agent provider may own a **server session id**:

```ts
providerSessionIds?: Partial<Record<ProviderId, string>>;
```

| Provider | ID shape | Resume mechanism |
|---|---|---|
| `claude-code` | UUID | `--resume` |
| `cursor-cli` | cursor session | `--resume` |
| `opencode-cli` | `ses_*` | `--session` / same session in API |
| `codex-cli` | `thread_id` UUID | `codex exec resume` |

On provider switch: flatten Quack messages to new provider; keep stored ids for return visits.

**UI (feature 044):** after the first turn, the chat header shows a copyable provider session chip (`CC`/`CU`/`OC`) and optional **Open in terminal** (`claude --resume` / `cursor-agent --resume`). The ⟲ Sessions picker lists on-disk sessions for **all agentic providers** (filter All/CC/CU/OC) with "This chat" / linked Quack title badges. Rust: `provider_list_sessions` / `provider_load_session` in `provider_sessions.rs`; disk index in `chat_store.rs` (`provider-links.json`).

---

## UI contract

- Model picker groups by `ProviderId`; qualified key `providerId:modelId`.
- **Lazy CLI catalogs:** OpenCode + Cursor return a single default model at cold start; full lists load when the model picker or ModelBrowser opens (`refreshLiveCliModels` in `AIChatPanel`) — never spawn sidecar/subprocess from `refresh()` on mount.
- **Agentic providers:** `isAgenticProviderId` (`claude-code`, `cursor-cli`, `opencode-cli`) — Quack displays tool calls only; does not run local `aiTools`.
- Agent-only composer features (`@` subagents, CC skills) gated on `claude-code` until v2 per-provider menus exist.
- Settings: one section per local agent (auth hint, sandbox/force toggles, sidecar status for Template B).

---

## When to add Template C

**Codex `app-server`** or **OpenCode-only SDK stream** — only if Template A/B prove insufficient (interactive permissions, multi-client). Not planned for v1.

See mission plan: `missions/002-agent-providers-opencode-codex/plan.md`.
