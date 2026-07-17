---
status: archived
archived: 2026-07-17
reason: Dropped OpenCode sidecar bridge to reduce agentic-provider complexity (roadmap lighten Quack).
---

---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-07-01
last_verified: 2026-07-11
tags: [opencode-cli, bridge, sidecar, sse, http, rust, opencode-ai, agentic, images, vision, tool-call]
---

## OpenCode Bridge (sidecar HTTP + SSE)
**Purpose:** Run OpenCode as a local HTTP sidecar (`opencode serve`), chat via `session.promptAsync`, stream turns from `/global/event` SSE, list connected-provider models, and resume `ses_*` sessions — Template B in `design/agent-provider-patterns.md`.
**Stack:** Rust (`opencode_sidecar.rs`), TS provider (`openCode.ts` + `openCodeEvents.ts`), `@opencode-ai/sdk/client` for REST only.

### Files
| Type | Path | Purpose |
|------|------|---------|
| Sidecar | `src-tauri/src/opencode_sidecar.rs` | Spawn `opencode serve`, health poll, status/restart |
| Provider | `src/providers/openCode.ts` | `ChatProvider` id `opencode-cli`; lazy catalog + live refresh; **FilePart** images |
| Mapper | `src/providers/openCodeEvents.ts` | SSE payload → `ChatStreamEvent[]` (tools + text) |
| Session | `src/providerSession.ts` | `providerSessionIds` read/write/migrate (shared with CC/Cursor) |
| Images | `src/imageAttach.ts` | `mimeForImagePath`, `fileUrlForImagePath` |
| UI | `src/components/AIChatPanel.tsx` | Vision gate before send; passes `imageAttachments` to `chatStream` |

### Tauri commands
| Command | Role |
|---|---|
| `opencode_server_check` | Resolve `opencode` binary on PATH (no spawn) |
| `opencode_server_status` | Sidecar running? + last error |
| `opencode_server_start` | Spawn if needed; poll `/global/health` up to ~60s |
| `opencode_server_restart` | Kill + respawn |

### Data Flow
**Chat:** `openCodeProvider.chat()` → `ensureSidecar()` → `session.create` (if new) → yield `{ kind: "session", id }` → native `EventSource` on `/global/event` → `parseOpencodeEvent` → `ChatStreamEvent[]` → `session.promptAsync` with `parts[]` → abort on Stop

**Prompt parts:**
```ts
parts: [
  { type: "text", text: prompt },
  ...imageAttachments.map(img => ({
    type: "file",
    mime: mimeForImagePath(img.path),
    filename: img.name,
    url: fileUrlForImagePath(img.path), // file:///abs/path
  })),
]
```

**Models (lazy):** mount → `listModels()` returns `[DEFAULT_MODEL]` unless sidecar already running or cache warm → picker/browser open → `refreshOpenCodeModelsLive()` → `client.provider.list()` → dedupe by `modelId`, `sortFreeFirst`

**Resume:** `readProviderSessionIds(session)["opencode-cli"]` → `resumeSessionId` on chat → reuse session id; prompt = last user message only (images on resumed turns: current message only via `imageAttachments` arg)

### Key Functions
- `openCodeProvider.chat({ imageAttachments })` — builds `FilePartInput` array for SDK
- `parseOpencodeEvent(raw, sessionId, state) → { events, done }` — text deltas, tool display-only, idle detection
- `ProviderModel.supportsVision` — `model.modalities?.input?.includes("image")` from catalog

### Tool SSE mapping (2026-07-11 fix)
OpenCode `message.part.updated` with `part.type === "tool"`:

| Field | Use |
|---|---|
| `part.tool` | Tool name |
| `part.callID` | Stable call id |
| `part.state.status` | `pending` / `running` / `completed` / `error` |
| `part.state.input` | Tool arguments (not the whole state blob) |
| `part.state.output` | Result text when `completed` |
| `part.state.error` | Error text when `error` |

Emit `tool_call` once per id; `tool_result` once when status is terminal (`completedToolIds` Set).

### Vision / image gate
OpenCode **strips** image parts client-side when `capabilities.input.image === false` (often missing `modalities` on custom models).

Before send, if `images.length > 0` and selected model has `supportsVision === false`, Quack toasts an error and aborts the turn.

**Fix for custom providers** — in `opencode.json`:
```json
"models": {
  "my-vision-model": {
    "modalities": {
      "input": ["text", "image"],
      "output": ["text"]
    }
  }
}
```

See OpenCode issues #20802 / #9897.

### State
- `providerSessionIds`: per-provider server session ids in `ChatSession`
- `modelsCache` / `availabilityCache`: TTL 60s in `openCode.ts`
- `ChatProvider.chat.imageAttachments`: optional `{ path, name }[]` from `AIChatPanel` → `chatStream` → provider

### External Dependencies
- Binary: `opencode` on PATH
- Auth: `opencode auth login`
- Port: `127.0.0.1:17346`
- SDK: `@opencode-ai/sdk` — import **only** from `/client`; events via native `EventSource`

### Gotchas
- **WKWebView SSE:** native `EventSource` on `/global/event` — not SDK fetch stream.
- **Agentic tools:** display-only; `isAgenticProviderId` skips Quack `aiTools` loop.
- **Startup perf:** never spawn sidecar from cold `listModels()` — defer to picker or first chat.
- **Rules injection:** OpenCode does not load `CLAUDE.md` — Quack inlines workspace rules.
- **Images need vision modality:** without `modalities.input` including `"image"`, attachments are silently dropped inside OpenCode before the HTTP request.
