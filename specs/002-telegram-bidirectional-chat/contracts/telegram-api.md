# Telegram Bot API Contracts

**Date**: 2026-03-30 | **Feature**: 002-telegram-bidirectional-chat

## Outbound: Notification Message

### POST sendMessage (with inline keyboard)

```json
{
  "chat_id": 123456789,
  "text": "🦆 *AgentName* — _Session Title_\n\nLast assistant message summary truncated at sentence boundary, max 500 chars...\n\n_Usa reply per rispondere_",
  "parse_mode": "Markdown",
  "reply_markup": {
    "inline_keyboard": [
      [
        {
          "text": "📱 Dashboard",
          "url": "http://hostname.local:6768/dashboard?token=abc123#session/session-xyz"
        },
        {
          "text": "⏹ Stop",
          "callback_data": "stop:session-xyz"
        }
      ]
    ]
  }
}
```

**Response** (used to extract message_id for mapping):
```json
{
  "ok": true,
  "result": {
    "message_id": 42,
    "chat": { "id": 123456789 },
    "text": "..."
  }
}
```

## Outbound: Answer Callback Query

### POST answerCallbackQuery

Called after processing a Stop button tap to dismiss the loading indicator.

```json
{
  "callback_query_id": "unique-callback-id",
  "text": "Sessione fermata ✅",
  "show_alert": false
}
```

## Outbound: Error Messages

### Session Expired Reply
```json
{
  "chat_id": 123456789,
  "text": "⚠️ Questa sessione non è più attiva. Usa /status per vedere le sessioni correnti.",
  "parse_mode": "Markdown"
}
```

### Session Already Ended (Stop Button)
```json
{
  "callback_query_id": "unique-callback-id",
  "text": "Sessione già terminata",
  "show_alert": true
}
```

## Inbound: Reply-to-Message (via getUpdates)

```json
{
  "update_id": 999,
  "message": {
    "message_id": 55,
    "from": { "id": 123456789, "first_name": "Alek" },
    "chat": { "id": 123456789, "type": "private" },
    "text": "User's reply text here",
    "reply_to_message": {
      "message_id": 42,
      "chat": { "id": 123456789, "type": "private" },
      "text": "🦆 *AgentName* — _Session Title_..."
    }
  }
}
```

**Routing**: `reply_to_message.message_id` (42) → lookup in `msg_to_session` → found `session-xyz` → emit `remote-send-message` event.

## Inbound: Callback Query (via getUpdates)

```json
{
  "update_id": 1000,
  "callback_query": {
    "id": "unique-callback-id",
    "from": { "id": 123456789, "first_name": "Alek" },
    "message": {
      "message_id": 42,
      "chat": { "id": 123456789, "type": "private" }
    },
    "data": "stop:session-xyz"
  }
}
```

**Routing**: Parse `data` → `stop:session-xyz` → emit `telegram-command-stop` with session_id → answer callback query.

## Internal Events (Tauri)

### remote-send-message (reused existing)

Emitted when a Telegram reply is routed to an agent session.

```json
{
  "sessionId": "session-xyz",
  "message": "User's reply text",
  "source": "telegram"
}
```

### telegram-command-stop (reused existing)

Emitted when Stop button is tapped on a notification.

```json
{
  "sessionId": "session-xyz",
  "source": "telegram"
}
```
