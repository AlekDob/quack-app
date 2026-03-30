# Implementation Plan: Telegram Bidirectional Chat Integration

**Branch**: `002-telegram-bidirectional-chat` | **Date**: 2026-03-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-telegram-bidirectional-chat/spec.md`

## Summary

Upgrade the existing Telegram bot (`@JackTheDuck_bot`) from generic notifications to a bidirectional chat system. The system subscribes to the WebSocket broadcast channel for session events, sends summarized notifications with inline keyboards (Dashboard + Stop), and routes Telegram reply-to-message responses back to the correct agent session. Includes debouncing (3s), session-to-message mapping, and a global mute toggle.

## Technical Context

**Language/Version**: Rust 1.75+ (Tauri backend), TypeScript strict (React frontend)
**Primary Dependencies**: Tauri v2, tokio (async runtime + broadcast channel), reqwest (HTTP client), serde (serialization)
**Storage**: In-memory HashMap for session-message mappings; `app-preferences.json` for mute toggle
**Testing**: Manual integration testing (Telegram Bot API requires live connection)
**Target Platform**: macOS desktop (Tauri) + Telegram mobile client
**Project Type**: Desktop app with embedded HTTP server
**Performance Goals**: Notifications delivered within 5s of agent turn completion; replies processed within 3s
**Constraints**: Telegram API rate limit 30 msg/sec; message limit 4096 chars; `telegram_central.rs` already at 483 lines (must split to stay under 300-line constitution limit)
**Scale/Scope**: Single user, 1-10 concurrent agent sessions

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. AI-First Architecture | PASS | Enhances agent monitoring and control from mobile |
| II. Tauri + React Full-Stack | PASS | All logic in Rust (Tauri backend), no new frontend components |
| III. Domain-Driven Organization | PASS | Telegram is its own domain, new module stays in `src-tauri/src/telegram_*` |
| IV. Code Quality Gates | REQUIRES ACTION | `telegram_central.rs` is 483 lines — must split into sub-modules before adding features |
| V. Knowledge-Driven Development | PASS | Will document patterns and gotchas in Brain |
| VI. Simplicity Over Cleverness | PASS | In-memory mapping, simple text truncation, no AI summarization |
| VII. User Experience First | PASS | Italian hint text, minimal UX friction via native Telegram reply |

**Gate Result**: PASS with mandatory prerequisite — split `telegram_central.rs` before implementation.

## Project Structure

### Documentation (this feature)

```text
specs/002-telegram-bidirectional-chat/
├── plan.md              # This file
├── research.md          # Phase 0: Technical decisions
├── data-model.md        # Phase 1: Data structures
├── contracts/           # Phase 1: Telegram message contracts
│   └── telegram-api.md  # Telegram Bot API payloads
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
src-tauri/src/
├── telegram_central.rs      # REFACTOR: Split into sub-modules, keep only polling core
├── telegram_types.rs        # NEW: Shared Telegram API types (Update, Message, CallbackQuery)
├── telegram_notifications.rs # NEW: WS listener → notification bridge + debounce + mapping
├── telegram_commands.rs     # EXTRACT: Command handling from telegram_central.rs
├── telegram_send.rs         # EXTRACT: Message sending helpers (text, keyboard, edit)
├── telegram_obfuscation.rs  # UNCHANGED: Token security
├── remote_ws.rs             # MODIFY: Expose WsBroadcast via app.manage()
├── preferences.rs           # MODIFY: Add telegram_mute_notifications field
├── lib.rs                   # MODIFY: Wire up notification bridge at startup, share WsBroadcast
└── notifications.rs         # UNCHANGED (legacy notification helper)
```

**Structure Decision**: Feature-scoped Telegram modules following the existing `telegram_*` naming convention. The monolithic `telegram_central.rs` (483 lines) is split into 5 focused modules, each under 300 lines. The new notification bridge (`telegram_notifications.rs`) is the core deliverable.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| 5 new/modified Telegram modules | `telegram_central.rs` is already over 300 lines; adding features without splitting would violate Constitution IV | Single file would be 600+ lines |
