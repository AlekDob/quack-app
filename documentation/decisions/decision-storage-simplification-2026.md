---
type: decision
created: 2026-01-17
tags: [storage, architecture, simplification]
---

# Quack Storage Simplification 2026

> [!note] Some details may be outdated.

## Storage Consolidation Decision

BEFORE: 7+ JSON files (~270MB) - quack-terminals.json, quack-agent-chats.json, quack-agent-sessions.json, quack-agent-messages.json, quack-chats.json (239MB!)

AFTER: 1 unified file quack-agents.json (~50KB) + quack-kanban-tasks.json

Key insight: Claude SDK manages conversation history - no need to duplicate locally

UnifiedAgent interface: id, name, projectPath, color, avatar, personality, claudeSessionId, createdAt, lastActiveAt

Migration: legacyMigration.ts reads old files, converts to new format

FTS4 index rebuilt (FTS5 not supported by sql.js WASM)

Date: 2026-01-17
