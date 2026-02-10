---
type: bug
project: quack-app
created: 2026-01-17
migrated: true
---

# bug-session-leak-cross-project

Bug: Switching to agent in different project showed old session chat instead of SessionEmptyState

Root cause: handleSelectTerminal kept activeSessionId when agent had no sessions (App.tsx:7149)

Fix: Changed to setActiveSessionId(null) when agent has no sessions

File: src/App.tsx lines 7147-7150
