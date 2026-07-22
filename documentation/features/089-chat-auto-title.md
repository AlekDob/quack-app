---
type: feature-doc
project: quack-desktop
stack: Tauri + React
created: 2026-07-22
startDate: 2026-07-22
endDate: 2026-07-22
last_verified: 2026-07-22
status: active
tags: [chat, auto-title, llm, haiku, claude-code, cursor, provider, persistence]
related:
  - 043-chat-transcript-persistence.md
  - 057-platform-pin.md
  - 059-claude-code-model-catalog.md
  - 062-presets.md
  - 087-new-chat-perf.md
---

## Chat auto-title (cheap LLM)

**Purpose:** When the user never names a chat, generate a short, human title with
a **cheap model** after the first turn — like Claude Code / Cursor. Replaces the
raw first-line heuristic (`deriveTitle`) as the displayed name, per provider.

**Stack:** `src/chatAutoTitle.ts` (orchestration) + a trigger effect in
`AIChatPanel.tsx` + two thin Rust one-shot print commands.

### Title precedence

| Source | Flag | Wins over |
|---|---|---|
| Hand rename (rail / empty-state) | `titleLocked` | everything |
| Cheap LLM auto-title | `autoTitled` | heuristic |
| First-line heuristic (`deriveTitle`) | — | placeholder only |

`preferredTitle(desc, messages)` (`chatHistory.ts`) keeps a `titleLocked` /
`autoTitled` title on every persist; otherwise it derives. Both persist paths in
`AIChatPanel.tsx` (`persistTranscriptRef` + `beforeunload`) use it, so the LLM
title survives flushes and stays in sync between `AIChatDescriptor.title` (store)
and `ChatSession.title` (disk).

### Per-provider cheap call (`generateShortTitle`)

| Chat provider (pin, 057) | Mechanism | Model (`titleModelFor`) |
|---|---|---|
| `claude-code` | `invoke("claude_print_title")` → `claude -p … --output-format text --model` | `haiku` |
| `cursor-cli` | `invoke("cursor_print_text")` → `cursor-agent -p … --output-format text [--model]` | pref `lcp.autoTitle.cursorModel`, else CLI default |
| `anthropic` | `getProvider().chat()` accumulated (`collectChat`, aborts at ~200 chars) | `claude-haiku-4-5-20251001` |
| `openai` | same accumulate path | pref `lcp.autoTitle.openaiModel`, else `gpt-4o-mini` |
| `ollama` | same accumulate path | chat's own local model (fallback id) |

Backend: `claude_print_title` / `cursor_print_text` are `#[tauri::command]`
wrappers over the existing `run_claude_print` / `run_cursor_output` primitives
(registered in `lib.rs`). CC print gained an optional `--model` arg.

### Trigger + guards

- Effect fires when `streaming === null` and ≥1 non-empty assistant message;
  `autoTitledChatRef` (keyed `wsId:chatId`) limits it to once per chat per session.
- `maybeAutoTitle` re-applies `shouldAutoTitle` guards: skip if `titleLocked`,
  `autoTitled`, no user+assistant pair, or pref `lcp.autoTitle.enabled === false`.
- Fire-and-forget: any CLI/API failure is swallowed — the heuristic title already
  on the tab remains. Lock re-checked after the async call (user may rename mid-flight).

### Prefs

| Key | Default | Meaning |
|---|---|---|
| `lcp.autoTitle.enabled` | `true` | Master toggle |
| `lcp.autoTitle.cursorModel` | `""` | Pin a cheap Cursor model id |
| `lcp.autoTitle.openaiModel` | `gpt-4o-mini` | Cheap OpenAI title model |

### Files

- New: `src/chatAutoTitle.ts`, `src/chatAutoTitle.test.ts`
- Modified: `src/components/AIChatPanel.tsx`, `src/store.ts`, `src/chatHistory.ts`,
  `src-tauri/src/claude_code.rs`, `src-tauri/src/cursor_code.rs`, `src-tauri/src/lib.rs`

### Tests

`chatAutoTitle.test.ts` (vitest, 10 cases): `sanitizeTitle`, `shouldAutoTitle`,
`titleModelFor`, `buildTitlePrompt`, `preferredTitle`.
