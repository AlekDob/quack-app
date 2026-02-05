---
type: pattern
project: quack-app
created: 2026-01-17
migrated: true
---

# pattern-session-data-protection

[2026-01-17] Pattern for protecting session data integrity: Always check if messages have events before overwriting existing data.

[2026-01-17] Implementation: Two-layer protection: (1) in-memory Map check before setChatSessions, (2) persistent store check before saving to quack-chats.json

[2026-01-17] Logic: Only overwrite if new data is richer (has events) OR no existing data exists OR both are poor quality (neither has events)

[2026-01-17] Key principle: Sessions are SACRED - never allow poor quality data (without events) to corrupt rich data (with events)

[2026-01-17] Console logging: Use 🛡️ PROTECTED emoji when skipping overwrites to signal data protection in action

[2026-01-17] Used in: loadKanbanChatSessions function (src/App.tsx lines 2568-2622) to prevent Rust backend fallback from corrupting streaming data

[2026-01-17] Related to: [[bug-chat-session-data-corruption]] - the bug this pattern solves
