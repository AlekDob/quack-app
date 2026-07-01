---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-07-01
last_verified: 2026-07-01
tags: [opencode-cli, bridge, sidecar, sse, http, rust, opencode-ai, agentic]
---

## OpenCode Bridge (sidecar HTTP + SSE)
**Purpose:** Run OpenCode as a local HTTP sidecar (`opencode serve`), chat via `session.promptAsync`, stream turns from `/global/event` SSE, list connected-provider models, and resume `ses_*` sessions — Template B in `design/agent-provider-patterns.md`.
**Stack:** Rust (`opencode_sidecar.rs`), TS provider (`openCode.ts` + `openCodeEvents.ts`), `@opencode-ai/sdk/client` for REST only.

### Files
| Type | Path | Purpose |
|------|------|---------|
| Sidecar | `src-tauri/src/opencode_sidecar.rs` | Spawn `opencode serve`, health poll, status/restart |
| Provider | `src/providers/openCode.ts` | `ChatProvider` id `opencode-cli`; lazy catalog + live refresh |
| Mapper | `src/providers/openCodeEvents.ts` | SSE payload → `ChatStreamEvent[]` |
| Session | `src/providerSession.ts` | `providerSessionIds` read/write/migrate (shared with CC/Cursor) |
| Registry | `src/providers/index.ts` | `listAllModels` / `listAllCloudModels` parallelized |
| UI | `src/components/ModelBrowser.tsx` | OpenCode provider group + install hint |
| UI | `src/components/AIChatPanel.tsx` | Agentic gating, resume id, `refreshLiveCliModels` |

### Tauri commands
| Command | Role |
|---|---|
| `opencode_server_check` | Resolve `opencode` binary on PATH (no spawn) |
| `opencode_server_status` | Sidecar running? + last error |
| `opencode_server_start` | Spawn if needed; poll `/global/health` up to ~60s |
| `opencode_server_restart` | Kill + respawn |

### Data Flow
**Chat:** `openCodeProvider.chat()` → `ensureSidecar()` → `session.create` (if new) → yield `{ kind: "session", id }` → native `EventSource` on `/global/event` → `parseOpencodeEvent` → `ChatStreamEvent[]` → `session.promptAsync` (204) → abort on Stop

**Models (lazy):** mount → `listModels()` returns `[DEFAULT_MODEL]` unless sidecar already running or cache warm → picker/browser open → `refreshOpenCodeModelsLive()` → `client.provider.list()` → dedupe by `modelId`, `sortFreeFirst`

**Resume:** `readProviderSessionIds(session)["opencode-cli"]` → `resumeSessionId` on chat → reuse session id; prompt = last user message only

### Key Functions
- `openCodeProvider.isAvailable() → boolean` — `opencode_server_check` only (binary on PATH; **no sidecar spawn**)
- `openCodeProvider.listModels() → ProviderModel[]` — lightweight default until sidecar up or cache warm
- `refreshOpenCodeModelsLive() → ProviderModel[]` — full catalog; spawns sidecar if needed
- `parseOpencodeEvent(raw, sessionId, state) → { events, done }` — text deltas, tool display-only, `session.idle` / `session.status` idle
- `readProviderSessionIds(session) → Partial<Record<ProviderId, string>>` — merges legacy `claudeSessionId`
- `isAgenticProviderId(id) → boolean` — `claude-code` \| `cursor-cli` \| `opencode-cli` (Quack never runs local `aiTools`)

### State
- `providerSessionIds`: `Partial<Record<ProviderId, string>>` — per-provider server session ids in `ChatSession` (localStorage)
- `modelsCache` / `availabilityCache`: in-module TTL in `openCode.ts` (60s)
- Sidecar child pid: `OpencodeSidecarState` (Rust, app lifetime)

### External Dependencies
- Binary: `opencode` on PATH (`npm i -g opencode-ai` or https://opencode.ai/install)
- Auth: `opencode auth login` (outside Quack)
- Port: `127.0.0.1:17346` (spaceship uses 17345 — intentional offset)
- SDK: `@opencode-ai/sdk` — import **only** from `/client`; events via native `EventSource`

### Config
- Default model: `opencode-cli:opencode/big-pickle` (free tier placeholder)
- `ProviderModel.isFree`: `cost.input === 0 && cost.output === 0`, or id/name contains `free`

### Gotchas
- **WKWebView SSE:** use native `EventSource` on `/global/event`, not SDK fetch stream — see `design/agent-provider-patterns.md`.
- **Session id field:** SSE payloads may put `sessionID` under `properties`, not top-level — mapper checks both.
- **Agentic tools:** OpenCode tool calls are display-only; `isAgenticProviderId` skips Quack `aiTools` loop (fixes "Preparing tool call…" hang).
- **Startup perf:** never call `opencode_server_start` from `isAvailable()` or cold `listModels()` — defer to first chat or `refreshOpenCodeModelsLive()` (picker/browser). See `025-model-selector.md`.
- **Workspace scoping:** pass `?directory=<cwd>` on every session API call.
- **Rules injection:** OpenCode does not load `CLAUDE.md` natively — `AIChatPanel` still inlines workspace rules for this provider.
- **Smoke test pending:** mission w11 — live chat, stop, resume, favorites in `npm run tauri dev`.
