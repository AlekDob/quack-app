# Quickstart: Telegram Bidirectional Chat Integration

**Branch**: `002-telegram-bidirectional-chat`

## Prerequisites

- Quack app running with Telegram bot connected (via TelegramSetup flow or manual config)
- Remote API enabled (Settings → Remote → Enable) for Dashboard button to work
- At least one agent configured

## How to Test

### 1. Verify Notifications (P1)

1. Open Quack desktop app
2. Ensure Telegram is connected (Settings → Integrations → Telegram shows "Connected")
3. Start any agent session with a prompt
4. Check Telegram — you should receive a notification within 5 seconds:
   - Format: `🦆 AgentName — Session Title` + summary + hint
   - Two buttons: [📱 Dashboard] [⏹ Stop]
5. Tap "📱 Dashboard" → should open mobile dashboard at the session

### 2. Verify Reply (P2)

1. Receive a notification as above
2. Use Telegram's native reply function on that notification message
3. Type a follow-up message and send
4. The agent should process your message (check desktop app)
5. You should receive a new notification with the agent's response

### 3. Verify Stop (P3)

1. While an agent is working, tap "⏹ Stop" on the notification
2. You should see a Telegram popup: "Sessione fermata ✅"
3. The agent session should be terminated in the desktop app

### 4. Verify Mute

1. Go to Settings → Integrations → Telegram
2. Toggle "Mute notifications"
3. Start an agent — no Telegram notifications should arrive
4. Send /status via Telegram — should still work (commands bypass mute)
5. Toggle mute off — notifications resume

### 5. Verify Edge Cases

- **Rapid updates**: Start a complex task → should receive 1 consolidated notification, not many
- **Expired session**: Reply to an old notification after session ended → should get error message
- **No Telegram**: Disconnect Telegram → agent sessions should work normally with no errors

## Key Files

| File | Role |
|------|------|
| `src-tauri/src/telegram_notifications.rs` | Core: WS listener, debounce, mapping, formatting |
| `src-tauri/src/telegram_types.rs` | Shared Telegram API types |
| `src-tauri/src/telegram_send.rs` | Message sending with keyboard support |
| `src-tauri/src/telegram_commands.rs` | Command dispatch (extracted) |
| `src-tauri/src/telegram_central.rs` | Polling loop core (refactored) |
| `src-tauri/src/remote_ws.rs` | Broadcast channel (modified for sharing) |
| `src-tauri/src/preferences.rs` | Mute toggle field |
| `src-tauri/src/lib.rs` | Wiring: share broadcast, start notification bridge |
