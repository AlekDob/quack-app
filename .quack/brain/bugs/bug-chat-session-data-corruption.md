---
type: bug
project: quack-app
created: 2026-01-17
migrated: true
---

# bug-chat-session-data-corruption

[2026-01-17] Critical bug where switching Chat → Kanban → Chat lost all formatting and sometimes mixed messages between sessions. Root cause: Rust backend fallback created messages without events field, which then overwrote rich messages with events in quack-chats.json store.

[2026-01-17] Impact: Loss of tool cards, thinking blocks, and proper message rendering. Sessions appeared corrupted with raw JSON/text.

[2026-01-17] User requirement: 'la sessione è una cosa indipendente ed isolata da qualsiasi cosa - è sacra - non gli devono rompere il cazzo' (sessions are sacred, must never be corrupted)

[2026-01-17] Solution: Added protection guards in loadKanbanChatSessions (lines 2568-2622) to prevent event-less messages from overwriting event-rich messages. Two-layer protection: in-memory (setChatSessions) and persistent store (quack-chats.json).

[2026-01-17] Fix details: Check if messages have events before overwriting. Only save/update if: (1) messages have events, (2) no existing data, or (3) existing data also lacks events. Log 🛡️ PROTECTED when skipping overwrites.

[2026-01-17] Files modified: src/App.tsx lines 2568-2622 (loadKanbanChatSessions function)
