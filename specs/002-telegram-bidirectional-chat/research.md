# Research: Telegram Bidirectional Chat Integration

**Date**: 2026-03-30 | **Branch**: `002-telegram-bidirectional-chat`

## R1: How to Subscribe to Session Events from Telegram Module

**Decision**: Share `WsBroadcast` via `app.manage()` and subscribe from the notification bridge.

**Rationale**: The `WsBroadcast` (tokio broadcast channel) already carries `SessionCreated`, `SessionCompleted`, and `AgentStatus` events. Currently it's created locally in the HTTP server setup block of `lib.rs` and only passed to `WsState`. By calling `app.manage(ws_broadcast.clone())` before passing it to axum, any Rust module can access it via `app.state::<WsBroadcast>()`.

**Alternatives considered**:
- Listen to Tauri events (`external-terminal-status`, `sessions-updated`) instead of WS broadcast → Rejected: Tauri events are frontend-facing; the broadcast channel is the canonical backend event bus.
- Create a separate broadcast channel for Telegram → Rejected: Duplicates existing infrastructure, violates Simplicity principle.

---

## R2: How to Detect "Agent Turn Completed" for Notification Trigger

**Decision**: Subscribe to `WsEvent::AgentStatus` where `status == "idle"` as the primary trigger, combined with reading the last session message.

**Rationale**: When an agent completes a turn, `claude_cli.rs` sets `AGENT_STATUS` to `"idle"` and emits `external-terminal-status`. This gets bridged to `WsEvent::AgentStatus { status: "idle" }` in `lib.rs`. This is the most reliable signal that an agent turn is complete. The notification bridge then fetches the latest message via `sessions::get_session_details()`.

**Alternatives considered**:
- Hook into `claude_cli.rs` directly → Rejected: Tight coupling, would require modifying the SDK parsing layer.
- Poll session messages periodically → Rejected: Wasteful, adds latency, complex state tracking.

---

## R3: How to Handle Reply-to-Message Routing

**Decision**: Extend `TelegramMessage` struct with `reply_to_message: Option<Box<TelegramMessage>>` field. In the polling loop, detect replies and look up the session mapping.

**Rationale**: Telegram's `getUpdates` API returns `reply_to_message` as a nested `Message` object when a user replies to a message. The `message_id` from the replied-to message maps to our session via the `SessionMapping` HashMap. This is the standard Telegram pattern for conversational bots.

**Alternatives considered**:
- Use custom callback data in inline buttons → Rejected: Callback buttons can't initiate text input; we'd need ForceReply which adds UX friction.
- Track by chat thread (topics) → Rejected: Requires supergroup with topics enabled; too complex for a personal bot.

---

## R4: How to Send Messages with Inline Keyboards

**Decision**: Create a new `send_message_with_keyboard()` function that includes `reply_markup` in the Telegram sendMessage payload.

**Rationale**: The current `send_message()` only sends text with Markdown parse_mode. Telegram's `sendMessage` API supports an `reply_markup` field for `InlineKeyboardMarkup`. We need two buttons: Dashboard (URL button opening `http://{hostname}:6768/dashboard?token={token}#session/{sessionId}`) and Stop (callback button with data `stop:{sessionId}`).

**Alternatives considered**:
- Modify existing `send_message()` with optional keyboard param → Rejected: Changes existing interface used by other callers.
- Use separate `sendMessage` calls (text + edit with keyboard) → Rejected: Extra API call, flickering UX.

---

## R5: Debounce Strategy for Rapid Updates

**Decision**: Per-session debounce using `tokio::time::sleep` with cancellation via `tokio::sync::Notify` or simple `HashMap<String, Instant>` tracking.

**Rationale**: When multiple `AgentStatus { idle }` events fire rapidly for the same session (e.g., multi-step tool use), we want to coalesce into one notification. A simple approach: on each event, record `last_event_time[session_id] = Instant::now()`. Before sending, spawn a delayed task that checks if 3 seconds have passed since last event. If a newer event arrived, the older task is superseded.

**Alternatives considered**:
- Global debounce (all sessions share one timer) → Rejected: Would delay notifications for unrelated sessions.
- No debounce, rely on Telegram client grouping → Rejected: Still generates API calls and potential rate limits.

---

## R6: Callback Query Handling for Stop Button

**Decision**: Extend `TelegramUpdate` with `callback_query: Option<CallbackQuery>` and handle in `process_update`. Callback data format: `stop:{session_id}`.

**Rationale**: Currently `TelegramUpdate` only has `message`. Telegram sends callback queries as a separate field when inline buttons are tapped. The polling loop must check for `callback_query` in addition to `message`. After processing, must call `answerCallbackQuery` to dismiss the loading indicator.

**Alternatives considered**:
- Use URL buttons for Stop (redirect to dashboard) → Rejected: Adds a step; user has to confirm stop in dashboard.
- Ignore Stop button, keep only /stop command → Rejected: Contradicts spec requirement FR-002.

---

## R7: Module Split Strategy for telegram_central.rs

**Decision**: Split into 5 modules following domain boundaries.

| New Module | Content | Est. Lines |
|------------|---------|-----------|
| `telegram_types.rs` | All struct definitions (Update, Message, User, Chat, CallbackQuery, PollingState) | ~80 |
| `telegram_send.rs` | `send_message()`, `send_message_with_keyboard()`, `answer_callback_query()`, shared reqwest client | ~100 |
| `telegram_commands.rs` | `handle_start_command()`, `handle_user_command()`, command dispatch | ~120 |
| `telegram_central.rs` | Polling loop core, `process_update()` dispatch, Tauri commands | ~150 |
| `telegram_notifications.rs` | WS subscriber, debounce, session mapping, notification formatting | ~200 |

**Rationale**: Each module stays under 300 lines. The split follows single-responsibility: types, I/O, command logic, orchestration, notification bridge.

---

## R8: Mute Toggle Storage

**Decision**: Add `telegram_mute_notifications: bool` field to `AppPreferences` struct. Default: `false` (notifications enabled).

**Rationale**: Follows existing pattern — `enable_mobile_notifications` already exists in preferences. The notification bridge checks this flag before sending. Existing commands (/status, /new, etc.) bypass the mute check since they're user-initiated.

**Alternatives considered**:
- In-memory-only toggle (lost on restart) → Rejected: User expectation is that mute persists.
- Per-session mute → Rejected: Spec clarification chose global toggle for v1 simplicity.
