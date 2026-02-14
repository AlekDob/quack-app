---
type: pattern
created: 2026-01-17
---

# Session Data Protection

Pattern for protecting session data integrity: Always check if messages have events before overwriting existing data.

## Implementation

Two-layer protection:
1. In-memory Map check before setChatSessions
2. Persistent store check before saving to quack-chats.json

## Logic

Only overwrite if new data is richer (has events) OR no existing data exists OR both are poor quality (neither has events).

## Key Principle

Sessions are SACRED -- never allow poor quality data (without events) to corrupt rich data (with events).

Used in: loadKanbanChatSessions function (src/App.tsx) to prevent Rust backend fallback from corrupting streaming data.

Related to: bug-chat-session-data-corruption
