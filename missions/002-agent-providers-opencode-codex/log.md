---
type: mission-log
slug: agent-providers-opencode-codex
updated: 2026-07-01
---

# Log — agent-providers-opencode-codex

## 2026-07-01

- Plan authored (`plan.md`) after spike sessions for OpenCode (subprocess failed, HTTP/SSE passed) and Codex (`codex exec --json` OK with stdin closed).
- Cursor CLI integration (mission 001) complete; serves as Template A reference.
- Next: user summary/compaction, then implementation starting with `providerSessionIds` + OpenCode sidecar.

## 2026-07-01 (implementation)

- **Phase 0 — `providerSessionIds`**: `src/providerSession.ts`, `chatHistory.ts` schema, `AIChatPanel` resume for all agentic providers (Cursor + OpenCode + CC).
- **Phase O0–O2 — OpenCode v1**: `opencode_sidecar.rs` (port 17346, health poll), `openCode.ts` + `openCodeEvents.ts`, ModelBrowser group, `@opencode-ai/sdk/client` dep.
- **UX fixes**: `isAgenticProviderId` (display-only tools), free-model badges (`isFree` + `.tag-free`), favorites star always visible, OpenCode model dedupe + `session.idle` handling.
- **Startup perf**: lazy CLI catalogs — `isAvailable` = binary check only; `listModels` = default row until picker/browser; `refreshLiveCliModels`; parallel `listAllModels` / `refresh()`.
- **Docs**: feature `028-opencode-bridge.md`; updated `025`, `026`, `agent-provider-patterns.md`, `CLAUDE.md`.
- Build: `npm run build` + `cargo check` pass.
- **Next**: Codex CLI (`codex_code.rs` fork of `cursor_code.rs`), smoke in `tauri dev`.
