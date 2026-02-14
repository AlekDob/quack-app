---
type: bug
created: 2026-01-17
tags: [sessions, chat, data-integrity, persistence]
---

# bug-chat-session-data-corruption

Critical bug where switching Chat → Kanban → Chat lost all formatting and sometimes mixed messages between sessions. Root cause: Rust backend fallback created messages without events field, which then overwrote rich messages with events in quack-chats.json store.

Impact: Loss of tool cards, thinking blocks, and proper message rendering. Sessions appeared corrupted with raw JSON/text.

User requirement: 'la sessione e' una cosa indipendente ed isolata da qualsiasi cosa - e' sacra - non gli devono rompere il cazzo' (sessions are sacred, must never be corrupted)

Solution: Added protection guards in loadKanbanChatSessions (lines 2568-2622) to prevent event-less messages from overwriting event-rich messages. Two-layer protection: in-memory (setChatSessions) and persistent store (quack-chats.json).

Fix details: Check if messages have events before overwriting. Only save/update if: (1) messages have events, (2) no existing data, or (3) existing data also lacks events.

Files modified: src/App.tsx lines 2568-2622 (loadKanbanChatSessions function)
