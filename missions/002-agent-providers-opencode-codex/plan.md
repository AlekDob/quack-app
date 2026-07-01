---
type: mission
slug: agent-providers-opencode-codex
status: planned
updated: 2026-07-01
tags: [opencode, codex-cli, providers, sidecar, subprocess, plan]
---

# Mission: OpenCode + Codex CLI providers (Quack desktop)

## Executive summary

Extend Quack’s local-agent lineup beyond **Claude Code** and **Cursor CLI** with two new providers:

| Provider | Integration pattern | Spike result | Priority |
|---|---|---|---|
| **OpenCode** | `opencode serve` sidecar (Rust) + HTTP/SSE client (TS) | Path A (`opencode run --json`) **failed**; Path B (API) **passed** | **1** |
| **Codex CLI** | `codex exec --json` subprocess (Rust), fork of `cursor_code.rs` | JSONL wire format **OK** (stdin must be closed) | **2** |

Shared prerequisite: **`providerSessionIds`** in chat persistence so users can switch provider mid-conversation and resume server-side context when returning to a provider.

**Not in scope for v1:** OpenCode/Codex slash commands, skills, subagents in the composer (Claude Code–only today). Documented as v2 under [Feature parity matrix](#feature-parity-matrix).

---

## Current state (baseline)

### Providers today

```
ollama          → local HTTP
anthropic       → API key
openai          → API key (NOT Codex CLI / ChatGPT subscription)
claude-code     → subprocess, stream-json, full agent UX
cursor-cli      → subprocess, stream-json (recent)
```

### Two integration templates (do not unify)

```
Template A — subprocess NDJSON          Template B — sidecar HTTP/SSE
─────────────────────────────          ─────────────────────────────
claude_code.rs                         (none today)
cursor_code.rs                         opencode (planned)
codex_code.rs (planned)                optional: codex app-server (later)
         │                                      │
cliStreamJson.ts (CC/Cursor)           openCodeEvents.ts (new)
codexStreamJson.ts (new)               EventSource /global/event
```

**Rule:** CC + Cursor + Codex share spawn/kill mechanics; only parsers differ. OpenCode is intentionally different because its non-interactive CLI is unreliable.

---

## Spike findings (2026-07-01)

### OpenCode

| Test | Result |
|---|---|
| `opencode run --format json` (standalone) | Hung at `init`, **zero JSON** after 3+ min |
| `opencode run --attach` warm server | 60–90s, **empty stdout** |
| HTTP `POST /session` + `prompt_async` + poll | **OK** (~8s, `SPIKE_OK`) |
| Fresh `opencode serve` + HTTP poll | **OK** (healthy ~1s, response ~6s) |
| SDK `promptAsync` + `global.event` stream | **OK** (`SPIKE_B_OK`, deltas, resume, abort) |
| SDK SSE on cold server only | Hung (use HTTP poll fallback or warm sidecar) |

Scripts: `scripts/opencode-spike-b.mjs`, `scripts/opencode-spike-cold-poll.sh`.

**Reference implementation:** `~/Desktop/Dev/Personal/spaceship-ai` — `sidecar.rs`, `agent-client.ts`, `use-agent-events.ts`, `engine/gotchas/opencode-*`.

### Codex CLI

| Test | Result |
|---|---|
| `codex exec --json` piped to `head` | Hung — **“Reading additional input from stdin…”** |
| `codex exec --json` with `stdin` closed | **OK** — `thread.started`, `turn.started`, events |
| Turn completion | Failed on **quota** / bad model name (wire format validated) |

**Gotcha:** Rust spawn **must** use `stdin(Stdio::null())` when prompt is passed as argv.

---

## Architecture

### OpenCode (Path B)

```
┌─ Quack webview (React) ─────────────────────────────────────┐
│  openCodeProvider.chat()                                     │
│    createOpencodeClient({ baseUrl })  — import /client only   │
│    OR raw fetch + EventSource (preferred in WKWebView)         │
│    session.create({ query: { directory: cwd } })               │
│    session.promptAsync({ path, body: { model, parts } })     │
│    EventSource → /global/event → map to ChatStreamEvent[]    │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP/SSE
┌──────────────────────────▼──────────────────────────────────┐
│  Rust sidecar (new: opencode_sidecar.rs)                      │
│  spawn: opencode serve --port <P> --hostname 127.0.0.1        │
│  kill on app/window teardown                                  │
│  Tauri: opencode_server_start | status | restart              │
└───────────────────────────────────────────────────────────────┘
```

**WKWebView note (from spaceship):** use native **`EventSource`** on `/global/event`, not SDK `fetch` stream — incremental delivery breaks in Tauri webview. SDK still useful for typed `promptAsync`, `provider.list`, `session.abort`.

**Workspace routing:** every session-scoped call needs `?directory=<absolute workspace path>`.

### Codex CLI (Path A)

```
User message → codexCodeProvider.chat()
  → codex_code_chat (Rust)
  → codex exec --json [--sandbox …] [-m model] [resume subcmd]
  → stdout JSONL lines → codexStreamJson.ts → ChatStreamEvent[]
  → Tauri events codex-stream:<id>
```

**Resume:** capture `thread_id` from `thread.started`; next turn `codex exec resume <id> "<last user msg>"` (only last user message when resuming — same pattern as CC/Cursor).

**Auth:** separate from `openai` API provider — `codex login` (ChatGPT) or `CODEX_API_KEY` for `exec` only.

**Git:** Codex requires a git repo by default; pass `--skip-git-repo-check` when workspace isn’t a repo (or document requirement).

---

## Shared: `providerSessionIds`

### Problem today

`ChatSession` only stores `claudeSessionId`. `AIChatPanel` passes `resumeSessionId` only when `selectedProvider === "claude-code"`. Cursor resume works in backend but UI doesn’t wire it.

### Target schema

```ts
// chatHistory.ts
export interface ChatSession {
  // …existing fields…
  /** Per-provider server-side session ids for resume. */
  providerSessionIds?: Partial<Record<ProviderId, string>>;
  // claudeSessionId → migrate/read fallback, then deprecate
}
```

### Send logic (`AIChatPanel`)

```ts
const resumeSessionId = session.providerSessionIds?.[selectedProvider];
```

On `{ kind: "session", id }` stream event → merge into `providerSessionIds[selectedProvider]`.

### Cross-provider switch behaviour

| Action | Behaviour |
|---|---|
| Same provider, different model | Resume server session (cache preserved) |
| Provider A → B | `flattenMessages(messages)` to B; A’s id kept in `providerSessionIds` |
| B → A again | Resume A’s stored id |
| Transcript in UI | Always shared (Quack-owned) |
| CC `@` / skills / subagents | Hidden when not `claude-code` (unchanged) |

---

## OpenCode implementation phases

### Phase O0 — Sidecar + health (Rust)

- [ ] `opencode_sidecar.rs`: spawn `opencode serve`, port file or fixed port with collision handling
- [ ] Commands: `opencode_server_start`, `opencode_server_status`, `opencode_server_restart`
- [ ] Poll `/global/health` up to 60s on cold boot (spaceship gotcha)
- [ ] Register in `lib.rs`; kill on window destroy

### Phase O1 — Provider skeleton (TS)

- [ ] Add `@opencode-ai/sdk` — import **only** from `@opencode-ai/sdk/client`
- [ ] `ProviderId`: `"opencode-cli"`
- [ ] `openCode.ts`: `isAvailable`, `listModels` via `provider.list()`
- [ ] Model id format: `providerID/modelID` → Quack `modelId` stores full string

### Phase O2 — Chat streaming

- [ ] `openCodeEvents.ts`: map SSE payload → `ChatStreamEvent`
  - `message.part.updated` (text, tool states)
  - `session.idle` → turn done
  - `session.error`, `permission.updated` (v1: auto-deny or settings flag)
- [ ] `promptAsync` + EventSource loop (abort via `session.abort`)
- [ ] `providerSessionIds` for `ses_*`

### Phase O3 — UI

- [ ] ModelBrowser / ModelPicker group “OpenCode (local)”
- [ ] Settings: sidecar status, skip-permissions equivalent (`--dangerously-skip-permissions` on exec only — for serve use config or prompt flags)
- [ ] Settings link: `opencode auth login`

### Phase O4 — Docs + verify

- [ ] `documentation/features/027-opencode-bridge.md`
- [ ] Update `CLAUDE.md` architecture map
- [ ] Diary entry
- [ ] `npm run build` + `npm run tauri dev` smoke (prompt → stream → stop → resume)

**Estimate:** ~1.5–2 days (sidecar + SSE mapping + permissions edge cases).

---

## Codex CLI implementation phases

### Phase C0 — Backend (Rust)

- [ ] Fork `cursor_code.rs` → `codex_code.rs`
- [ ] `codex_code_check` — `codex --version`, npm global path
- [ ] `codex_code_chat` — `codex exec --json`, **`stdin(Stdio::null())`**, prompt as arg
- [ ] Resume: `codex exec resume <thread_id> <prompt>` or build argv accordingly
- [ ] `codex_code_kill` — process group
- [ ] Flags: `--sandbox workspace-write`, bypass toggle, `--skip-git-repo-check`, `-m`

### Phase C1 — Parser (TS)

- [ ] `codexStreamJson.ts` — JSONL event types:
  - `thread.started` → session
  - `item.completed` + `agent_message` → content
  - `item.*` + `command_execution` / file changes → tool chips
  - `turn.completed` → usage
  - `turn.failed` / `error` → error surface

### Phase C2 — Provider + UI

- [ ] `codexCode.ts` + `codexCodeSettings.tsx` (sandbox / yolo toggle)
- [ ] Model list: config/default + `-m` passthrough (no dynamic list in v1 unless `codex models` exists)
- [ ] ModelBrowser group “Codex CLI (local)”
- [ ] **Distinct** from `openai` API — no shared API key UI

### Phase C3 — Docs + verify

- [ ] `documentation/features/028-codex-cli-bridge.md`
- [ ] Spike script `scripts/codex-spike.mjs` (stdin closed, document in doc)
- [ ] Smoke in `tauri dev`

**Estimate:** ~1 day.

---

## Feature parity matrix

| Feature | Claude Code | Cursor CLI | OpenCode v1 | OpenCode v2 | Codex v1 |
|---|---|---|---|---|---|
| Chat + stream | ✅ | ✅ | ✅ | ✅ | ✅ |
| Model picker | ✅ | ✅ dynamic | ✅ `provider.list` | ✅ | ✅ `-m` / default |
| Session resume | ✅ | ✅ backend, UI partial | ✅ `ses_*` | ✅ | ✅ `thread_id` |
| Kill / Stop | ✅ | ✅ | ✅ `session.abort` | ✅ | ✅ kill PG |
| Permission UI | ✅ overlay | `--force` | skip flag / v2 overlay | ✅ SSE | sandbox flags |
| Slash `/` local (Quack) | ✅ | ✅ | ✅ | ✅ | ✅ |
| CC custom commands | ✅ | ❌ | ❌ | ❌ | ❌ |
| CC skills menu | ✅ | ❌ | ❌ | v2 (`GET /command`, not skill template) | ❌ |
| CC `@` subagents | ✅ | ❌ | ❌ | v2 (`GET /agent`) | ❌ |
| Effort / thinking | ✅ | ❌ | variant top-level (SDK) | ✅ | ❌ |
| Usage / cost in footer | ✅ | partial | ✅ `turn.completed` / step_finish | ✅ | ✅ `turn.completed` |

### OpenCode v2 (after v1 ships)

- `GET /command` → `/` menu (filter `source !== "skill"`)
- `GET /agent` → `@` menu (`build`, `plan`, custom)
- Skills via tool `skill`, **not** `/command` (spaceship gotcha: expands full SKILL.md into user bubble)
- Permission overlay via `permission.updated` + `POST /permission/{id}/reply`

---

## Recommended implementation order

```
1. providerSessionIds refactor + Cursor resume UI fix     (~2h)
2. OpenCode sidecar (Rust)                                 (~3h)
3. OpenCode provider + EventSource mapper                  (~6h)
4. OpenCode UI + docs + smoke                              (~3h)
5. Codex Rust bridge                                       (~4h)
6. Codex parser + provider + UI + docs + smoke             (~4h)
```

**Total:** ~3–4 dev days for both providers + shared session model.

---

## Files to create / touch (checklist)

### New files

| Path | Purpose |
|---|---|
| `src-tauri/src/opencode_sidecar.rs` | serve lifecycle |
| `src-tauri/src/codex_code.rs` | exec spawn/kill |
| `src/providers/openCode.ts` | OpenCode ChatProvider |
| `src/providers/openCodeEvents.ts` | SSE → ChatStreamEvent |
| `src/providers/codexCode.ts` | Codex ChatProvider |
| `src/providers/codexStreamJson.ts` | JSONL parser |
| `src/components/openCodeSettings.tsx` | sidecar + permissions |
| `src/components/codexCodeSettings.tsx` | sandbox / bypass |
| `documentation/features/027-opencode-bridge.md` | feature doc |
| `documentation/features/028-codex-cli-bridge.md` | feature doc |
| `documentation/design/agent-provider-patterns.md` | Template A vs B contract |

### Modified files

| Path | Change |
|---|---|
| `src/chatHistory.ts` | `providerSessionIds` |
| `src/components/AIChatPanel.tsx` | resume map, session capture for all agent providers |
| `src/providers/types.ts` | `ProviderId` union |
| `src/providers/index.ts` | registry |
| `src-tauri/src/lib.rs` | command registration |
| `src/components/ModelBrowser.tsx` | new groups |
| `src/components/SettingsModal.tsx` | new tabs |
| `package.json` | `@opencode-ai/sdk` |
| `CLAUDE.md` | architecture map |

---

## Dependencies & auth

| Provider | User setup | Quack stores |
|---|---|---|
| OpenCode | `opencode` on PATH; `opencode auth login` | Nothing (uses `~/.local/share/opencode/auth.json`) |
| Codex CLI | `npm i -g @openai/codex`; `codex login` or `CODEX_API_KEY` | Nothing (uses `~/.codex/auth.json`) |

Keep Quack **~30 MB** — do not bundle binaries; probe PATH like CC/Cursor.

---

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| OpenCode sidecar cold boot >10s | 60s health poll; show “Starting OpenCode…” in Settings |
| WKWebView SSE broken | EventSource native (spaceship-proven); avoid SDK fetch stream |
| `opencode run` regressions | Do not use subprocess path for OpenCode |
| Codex stdin hang | `Stdio::null()` always |
| Codex non-git workspace | `--skip-git-repo-check` or surface clear error |
| Provider proliferation UX | Model picker groups; `providerSessionIds` for clean switch |
| SDK version drift | Pin `@opencode-ai/sdk` to installed `opencode` version |
| File size limits | Keep parsers in separate files ≤600 lines |

---

## Testing plan

### OpenCode

1. Sidecar starts on app launch; health green in Settings
2. Select `opencode/…` model → send message → text streams live
3. Tool call shows running → completed
4. Stop mid-turn → `session.abort` → idle
5. Second turn resumes `ses_*` (token usage drops vs cold)
6. Switch to `claude-code` → back to OpenCode → resume works
7. Light + dark theme; workspace switch passes correct `directory`

### Codex

1. `codex_code_check` with/without binary
2. `codex exec --json` in repo → `thread.started` → assistant text
3. Stop kills process group
4. Resume with `thread_id`
5. Sandbox toggle changes flags
6. Provider distinct from OpenAI API in Settings

---

## Out of scope (explicit)

- Bundling `opencode` / `codex` in the installer
- `codex app-server` WebSocket client (unless exec proves insufficient)
- Replacing Claude Code permission overlay with Codex/OpenCode equivalents in v1
- Telemetry, cloud sync
- Upstreaming to `getcodetta/codetta` (fork stays `quack-app` until rebrand merge)

---

## References

| Resource | Path / URL |
|---|---|
| Cursor bridge (template A) | `documentation/features/026-cursor-cli-bridge.md` |
| Claude bridge | `documentation/features/014-claude-code-bridge.md` |
| Spaceship OpenCode SDK notes | `spaceship-ai/engine/opencode-sdk-notes.md` |
| Spaceship sidecar | `spaceship-ai/app/src-tauri/src/sidecar.rs` |
| Spaceship agent client | `spaceship-ai/app/src-tauri/src/agent-client.ts` |
| OpenCode CLI docs | https://opencode.ai/docs/cli |
| OpenCode server API | https://opencode.ai/docs/server |
| Codex exec docs | https://developers.openai.com/codex/noninteractive |
| Codex CLI reference | https://developers.openai.com/codex/cli/reference |
| Spike scripts | `scripts/opencode-spike-b.mjs`, `opencode-spike-cold-poll.sh` |

---

## Decision log

| Date | Decision | Rationale |
|---|---|---|
| 2026-07-01 | OpenCode: Path B (serve), not subprocess | `opencode run --json` failed all spike attempts |
| 2026-07-01 | Codex: subprocess (`codex exec --json`) | JSONL works; closer to Cursor than OpenCode |
| 2026-07-01 | Do not fork from `claude_code.rs` for new CLIs | Use `cursor_code.rs` distillate (~600 lines vs ~1600) |
| 2026-07-01 | `providerSessionIds` before new providers | Enables mid-chat provider switch + resume |
| 2026-07-01 | EventSource over SDK stream in webview | spaceship gotcha `opencode-sse-eventsource-wkwebview` |
| 2026-07-01 | OpenCode before Codex | Higher provider breadth; spaceship patterns ready |
| 2026-07-01 | CC skills/commands/subagents stay CC-only in v1 | Different invocation models; OpenCode v2 documented |
