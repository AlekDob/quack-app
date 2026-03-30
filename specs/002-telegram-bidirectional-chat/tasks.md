# Tasks: Telegram Bidirectional Chat Integration

**Input**: Design documents from `/specs/002-telegram-bidirectional-chat/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Not requested — manual integration testing only (Telegram Bot API requires live connection).

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Module Split)

**Purpose**: Split the monolithic `telegram_central.rs` (483 lines, violates 300-line constitution limit) into focused sub-modules. This is a mandatory prerequisite — no new features until the split is complete.

- [x] T001 Extract all Telegram API type definitions (TelegramUpdate, TelegramMessage, TelegramUser, TelegramChat, TelegramPollingState, GetUpdatesResponse) from `src-tauri/src/telegram_central.rs` into new `src-tauri/src/telegram_types.rs`. Add new types: `CallbackQuery` struct and `reply_to_message: Option<Box<TelegramMessage>>` field per data-model.md
- [x] T002 Extract message sending functions (`send_message`) from `src-tauri/src/telegram_central.rs` into new `src-tauri/src/telegram_send.rs`. Add `send_message_with_keyboard()` and `answer_callback_query()` function stubs (empty bodies returning Ok). Create a shared `reqwest::Client` instead of creating one per call
- [x] T003 Extract command handling functions (`handle_start_command`, `handle_user_command`) from `src-tauri/src/telegram_central.rs` into new `src-tauri/src/telegram_commands.rs`. Update imports to use `telegram_types` and `telegram_send`
- [x] T004 Refactor `src-tauri/src/telegram_central.rs` to import from `telegram_types`, `telegram_send`, and `telegram_commands`. Keep only: polling loop (`start_polling`, `stop_polling`, `poll_updates`, `process_update`) and Tauri commands. Verify all existing functionality unchanged
- [x] T005 Register all new modules (`telegram_types`, `telegram_send`, `telegram_commands`) in `src-tauri/src/lib.rs` with `mod` declarations. Verify compilation succeeds with `cargo check`

**Checkpoint**: `telegram_central.rs` is now under 200 lines. All existing Telegram commands (/status, /new, /stop, /chat, /screenshot, /help) work identically. No behavioral changes.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infrastructure changes that ALL user stories depend on — WsBroadcast sharing, mute toggle, and notification bridge skeleton.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T006 Share `WsBroadcast` via `app.manage()` in `src-tauri/src/lib.rs`. Clone `ws_broadcast` before passing to `WsState` and call `app.manage(ws_broadcast.clone())` so other modules can access it via `app.state::<WsBroadcast>()`
- [x] T007 [P] Add `telegram_mute_notifications: bool` field (default `false`) to `AppPreferences` struct in `src-tauri/src/preferences.rs`. Add Tauri commands `get_telegram_mute()` and `set_telegram_mute(enabled: bool)` following existing preference patterns
- [x] T008 Create `src-tauri/src/telegram_notifications.rs` with the `NotificationBridgeState` struct (per data-model.md): `app: AppHandle`, `session_to_msg: HashMap<String, i64>`, `msg_to_session: HashMap<i64, String>`, `last_event: HashMap<String, Instant>`. Add a `start_notification_bridge(app: AppHandle)` function that subscribes to `WsBroadcast` via `app.state::<WsBroadcast>().subscribe()` and spawns a tokio task with a `recv()` loop. Register module in `src-tauri/src/lib.rs`
- [x] T009 Wire up notification bridge startup in `src-tauri/src/lib.rs`. Call `telegram_notifications::start_notification_bridge(app.handle().clone())` after `WsBroadcast` is managed. Ensure it starts only when telegram is configured (check preferences), and handles the case where telegram is not configured gracefully (log and skip)

**Checkpoint**: Foundation ready. `WsBroadcast` is accessible globally. Mute toggle persists in preferences. Notification bridge is running and receiving WS events (logging them). No notifications sent yet.

---

## Phase 3: User Story 1 - Receive Conversation Summaries on Telegram (Priority: P1) 🎯 MVP

**Goal**: When any agent completes a turn, send a formatted notification to Telegram with agent name, session title, summary (max 500 chars), and inline keyboard buttons (Dashboard + Stop).

**Independent Test**: Start any agent session → verify notification arrives on Telegram within 5 seconds with correct format and working Dashboard URL button.

### Implementation for User Story 1

- [x] T010 [US1] Implement `send_message_with_keyboard()` in `src-tauri/src/telegram_send.rs`. Accept `chat_id`, `text`, and `Vec<Vec<InlineKeyboardButton>>` (keyboard rows). Build the `reply_markup` JSON per contracts/telegram-api.md. Return `Result<i64, String>` where the `i64` is the sent `message_id` extracted from the API response
- [x] T011 [US1] Implement notification formatting function `format_notification(agent_name: &str, session_title: &str, last_message: &str) -> String` in `src-tauri/src/telegram_notifications.rs`. Format: `🦆 *{agent_name}* — _{session_title}_\n\n{summary}\n\n_Usa reply per rispondere_`. Truncate `last_message` at sentence boundaries (`. ` or `.\n`) to max 500 chars. Ensure total message stays under 4096 chars
- [x] T012 [US1] Implement `build_notification_keyboard(session_id: &str, app: &AppHandle) -> Vec<Vec<InlineKeyboardButton>>` in `src-tauri/src/telegram_notifications.rs`. Build Dashboard URL button using hostname from `remote_config::get_local_hostname()` + port + token + `#session/{session_id}`. Build Stop callback button with data `stop:{session_id}`
- [x] T013 [US1] Implement per-session debounce logic in `src-tauri/src/telegram_notifications.rs`. On `WsEvent::AgentStatus { status: "idle" }`: record `last_event[agent_id] = Instant::now()`, spawn a delayed tokio task (3s sleep), then check if `last_event[agent_id]` is still the same timestamp. If yes, proceed to send notification. If newer event arrived, skip (superseded)
- [x] T014 [US1] Implement the full notification pipeline in the `recv()` loop of `src-tauri/src/telegram_notifications.rs`. On `WsEvent::AgentStatus { status: "idle", agent_id, .. }`: check mute toggle → debounce check → look up agent name and active session from `quack-agents.json` → fetch last assistant message via `sessions::get_session_details()` → format notification → send with keyboard → store `session_to_msg[session_id] = message_id` and `msg_to_session[message_id] = session_id`
- [x] T015 [US1] Implement session cleanup on `WsEvent::SessionCompleted { session_id, .. }` in `src-tauri/src/telegram_notifications.rs`. Remove entries from both `session_to_msg` and `msg_to_session` HashMaps to prevent unbounded memory growth

**Checkpoint**: User Story 1 complete. Start any agent → notification appears on Telegram with summary + Dashboard + Stop buttons. Rapid updates debounced to single notification. Mute toggle silences notifications. No Telegram = no errors.

---

## Phase 4: User Story 2 - Reply to Agents via Telegram (Priority: P2)

**Goal**: User replies to a Telegram notification message → reply text is routed to the corresponding agent session via `remote-send-message` event.

**Independent Test**: Receive a notification → use Telegram's native reply → verify the reply appears in the agent session in the desktop app, and a new notification arrives with the agent's response.

### Implementation for User Story 2

- [x] T016 [US2] Extend `process_update()` in `src-tauri/src/telegram_central.rs` to detect reply-to-message. When `message.reply_to_message` is `Some`, extract `reply_to_message.message_id` and delegate to a new function `handle_reply_message()` instead of the normal command dispatch path
- [x] T017 [US2] Make `NotificationBridgeState` mappings (`session_to_msg`, `msg_to_session`) accessible from the polling module. Wrap them in `Arc<Mutex<...>>` and store in `app.manage()` as a `TelegramSessionMappings` struct so both the notification bridge and the polling loop can access them
- [x] T018 [US2] Implement `handle_reply_message(app: &AppHandle, chat_id: i64, text: &str, reply_to_message_id: i64)` in `src-tauri/src/telegram_commands.rs`. Look up `msg_to_session[reply_to_message_id]` from the shared `TelegramSessionMappings`. If found: check if session is still active (read from `quack-agents.json`). If active: emit `remote-send-message` event with `{ sessionId, message: text, source: "telegram" }`. If expired: send error message "Questa sessione non è più attiva" to Telegram
- [x] T019 [US2] Handle "not found" case in `handle_reply_message()` — when `reply_to_message_id` has no mapping in `msg_to_session`. Send "Sessione scaduta" error message to Telegram. This covers the edge case of replying to very old notifications whose mappings were cleaned up

**Checkpoint**: User Story 2 complete. Reply to any notification → message arrives in agent session. Reply to expired session → Italian error message. Back-and-forth conversation flow works (reply → notification → reply → ...).

---

## Phase 5: User Story 3 - Stop Agent from Telegram (Priority: P3)

**Goal**: Tapping the "Stop" inline button on a notification terminates the corresponding agent session.

**Independent Test**: Receive notification while agent is working → tap Stop button → agent terminates and Telegram shows confirmation.

### Implementation for User Story 3

- [x] T020 [US3] Extend `process_update()` in `src-tauri/src/telegram_central.rs` to handle callback queries. When `update.callback_query` is `Some`, delegate to a new function `handle_callback_query()` instead of the message processing path
- [x] T021 [US3] Implement `answer_callback_query(callback_id: &str, text: &str, show_alert: bool)` in `src-tauri/src/telegram_send.rs`. POST to Telegram's `answerCallbackQuery` endpoint per contracts/telegram-api.md
- [x] T022 [US3] Implement `handle_callback_query(app: &AppHandle, query: &CallbackQuery)` in `src-tauri/src/telegram_commands.rs`. Parse `query.data` — if starts with `"stop:"`, extract `session_id`. Check if session is active. If active: emit `telegram-command-stop` event with `{ sessionId, source: "telegram" }` and answer callback with "Sessione fermata ✅". If already ended: answer callback with "Sessione già terminata" and `show_alert: true`

**Checkpoint**: All 3 user stories complete. Stop button works from notification. Already-ended sessions show appropriate error.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Edge case hardening, graceful degradation, and documentation.

- [x] T023 [P] Add graceful error handling for Telegram API failures in `src-tauri/src/telegram_send.rs`. All send functions must catch network errors, log them, and return `Err` without panicking or blocking agent execution. Add timeout (5s) to the shared reqwest client
- [x] T024 [P] Add graceful degradation check at the top of the notification bridge loop in `src-tauri/src/telegram_notifications.rs`. Before each notification: verify telegram is configured (bot_token + chat_id present). If not configured, log once and skip. Handle preference changes dynamically (re-read on each cycle)
- [x] T025 Verify backward compatibility of all existing Telegram commands (/status, /new, /stop, /chat, /screenshot, /help) after the module split. Manually test each command via Telegram and confirm identical behavior
- [x] T026 [P] Add Brain diary entry in `documentation/diary/2026-03-30.md` documenting the Telegram bidirectional chat feature, module split pattern, and key architectural decisions
- [x] T027 Run quickstart.md validation — follow all 5 test scenarios in `specs/002-telegram-bidirectional-chat/quickstart.md` and verify each passes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately. MUST complete before Phase 2
- **Foundational (Phase 2)**: Depends on Phase 1 (module split). BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Phase 2. BLOCKS User Story 2 (needs mappings to exist)
- **User Story 2 (Phase 4)**: Depends on Phase 3 (notification mappings must be populated)
- **User Story 3 (Phase 5)**: Depends on Phase 2 only (callback queries are independent of notifications)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Depends on Foundational → Can start after T009
- **User Story 2 (P2)**: Depends on US1 → needs `session_to_msg` / `msg_to_session` populated by T014-T015
- **User Story 3 (P3)**: Depends on Foundational only → Can start after T009, in parallel with US1

### Within Each Phase

```
Phase 1: T001 → T002 → T003 → T004 → T005 (sequential — each depends on previous extractions)
Phase 2: T006 → T008 → T009 (sequential), T007 can run in parallel with T006
Phase 3: T010 + T011 + T012 (parallel) → T013 → T014 → T015
Phase 4: T017 → T016 → T018 → T019
Phase 5: T020 + T021 (parallel) → T022
Phase 6: T023 + T024 + T026 (parallel) → T025 → T027
```

### Parallel Opportunities

**Phase 2**: T007 (preferences) can run in parallel with T006 (WsBroadcast sharing)

**Phase 3 (US1)**: T010, T011, T012 are all different functions in different files — can be implemented in parallel

**Phase 5 (US3)**: Can run in parallel with Phase 3 (US1) after Phase 2 completes — different code paths, no shared state. However, Stop button UX improves when combined with notifications.

**Phase 6**: T023, T024, T026 touch different files — can run in parallel

---

## Parallel Example: User Story 1

```bash
# After Phase 2 completes, launch in parallel:
Task: "T010 - Implement send_message_with_keyboard() in src-tauri/src/telegram_send.rs"
Task: "T011 - Implement format_notification() in src-tauri/src/telegram_notifications.rs"
Task: "T012 - Implement build_notification_keyboard() in src-tauri/src/telegram_notifications.rs"

# Then sequentially:
Task: "T013 - Implement debounce logic"
Task: "T014 - Wire up full notification pipeline"
Task: "T015 - Implement session cleanup"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Module Split (mandatory cleanup)
2. Complete Phase 2: Foundational (WsBroadcast sharing + mute toggle)
3. Complete Phase 3: User Story 1 (notifications with keyboard)
4. **STOP and VALIDATE**: Test notifications manually via Telegram
5. This alone delivers 70% of the feature value — monitoring agents from mobile

### Incremental Delivery

1. Phase 1 + 2 → Module split + foundation ready
2. Add US1 (Phase 3) → Notifications working → **Immediate value** (MVP!)
3. Add US2 (Phase 4) → Reply working → **Full bidirectional loop**
4. Add US3 (Phase 5) → Stop button working → **Safety control complete**
5. Phase 6 → Hardened and documented

### Single Agent Strategy (Recommended)

Since all changes are in the Rust backend (`src-tauri/src/telegram_*.rs`) with interconnected logic across ≤8 files, this is best executed as a **Single Agent** task following the sequential dependency chain.

---

## Notes

- All file paths relative to `src-tauri/src/` unless otherwise specified
- No frontend (React/TypeScript) changes required — all Tauri event listeners already exist
- No automated tests — Telegram Bot API requires live connection for verification
- Commit after each phase completion for clean rollback points
- The module split (Phase 1) is a pure refactor — no behavioral changes, easy to verify
