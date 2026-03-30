# Data Model: Telegram Bidirectional Chat Integration

**Date**: 2026-03-30 | **Branch**: `002-telegram-bidirectional-chat`

## Telegram API Types (telegram_types.rs)

### TelegramUpdate (extended)

| Field | Type | Description |
|-------|------|-------------|
| update_id | i64 | Unique update identifier |
| message | Option\<TelegramMessage\> | New incoming message |
| callback_query | Option\<CallbackQuery\> | **NEW**: Callback from inline button tap |

### TelegramMessage (extended)

| Field | Type | Description |
|-------|------|-------------|
| message_id | i64 | Unique message identifier |
| from | Option\<TelegramUser\> | Sender info |
| chat | TelegramChat | Chat info |
| text | Option\<String\> | Message text |
| reply_to_message | Option\<Box\<TelegramMessage\>\> | **NEW**: Original message being replied to |

### CallbackQuery (new)

| Field | Type | Description |
|-------|------|-------------|
| id | String | Unique callback ID (needed for answerCallbackQuery) |
| from | TelegramUser | User who pressed the button |
| message | Option\<TelegramMessage\> | Message with the button that was pressed |
| data | Option\<String\> | Callback data (e.g., `"stop:session-abc123"`) |

### TelegramUser (unchanged)

| Field | Type | Description |
|-------|------|-------------|
| id | i64 | Unique user ID |
| first_name | String | First name |
| username | Option\<String\> | Username |

### TelegramChat (unchanged)

| Field | Type | Description |
|-------|------|-------------|
| id | i64 | Chat ID |
| chat_type | String | Chat type ("private", "group", etc.) |

## Notification Bridge State (telegram_notifications.rs)

### NotificationBridgeState

| Field | Type | Description |
|-------|------|-------------|
| app | AppHandle | Tauri app handle for preferences access |
| broadcast_rx | broadcast::Receiver\<WsEvent\> | Subscribed receiver for session events |
| session_to_msg | HashMap\<String, i64\> | Maps session_id → Telegram message_id (last notification) |
| msg_to_session | HashMap\<i64, String\> | Reverse map: Telegram message_id → session_id |
| last_event | HashMap\<String, Instant\> | Per-session debounce tracker |
| debounce_ms | u64 | Debounce window (default: 3000ms) |

### Lifecycle

```
Session Event (WsEvent::AgentStatus idle)
    │
    ├── Check: telegram configured? mute enabled? → skip if yes
    │
    ├── Check: debounce (last_event[session_id] < 3s ago?) → defer
    │
    ├── Fetch last assistant message from session
    │
    ├── Format notification (emoji + agent name + title + summary)
    │
    ├── Send via send_message_with_keyboard()
    │
    ├── Store mapping: session_to_msg[session_id] = message_id
    │                   msg_to_session[message_id] = session_id
    │
    └── On WsEvent::SessionCompleted → clean up both maps
```

## Inline Keyboard Layout

### Notification Message Keyboard

```
[ 📱 Dashboard ]  [ ⏹ Stop ]
```

- **Dashboard**: URL button → `http://{hostname}:{port}/dashboard?token={token}#session/{sessionId}`
- **Stop**: Callback button → data: `stop:{sessionId}`

### Callback Data Format

| Pattern | Action | Handler |
|---------|--------|---------|
| `stop:{session_id}` | Stop the agent session | Emit `telegram-command-stop` event |

## Preferences Extension

### AppPreferences (modified)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| telegram_mute_notifications | bool | false | **NEW**: Global mute for outbound notifications |

All other telegram-related fields remain unchanged.

## Reply Routing Flow

```
User replies to Telegram notification
    │
    ├── poll_updates() receives message with reply_to_message
    │
    ├── Extract reply_to_message.message_id
    │
    ├── Look up msg_to_session[message_id]
    │      │
    │      ├── Found → extract session_id
    │      │      │
    │      │      ├── Session active? → emit "remote-send-message" event
    │      │      │
    │      │      └── Session ended? → send error message to Telegram
    │      │
    │      └── Not found → send "Session expired" error to Telegram
    │
    └── New notification arrives when agent responds (loop continues)
```
