---
type: bug
project: quack-app
created: 2026-01-17
migrated: true
---

# bug-agent-session-cross-project-leak

**Bug**: When switching to an agent in a different project with no active sessions, the app showed the chat from the previous agent's session instead of showing SessionEmptyState.

**Root Cause**: In `handleSelectTerminal` (App.tsx:7146-7150), when an agent had no sessions, `activeSessionId` was NOT cleared. It kept the old session ID from the previous agent, causing the wrong chat to display.

**Solution**: Changed line 7149 from `keeping current activeSessionId` to `setActiveSessionId(null)`. This ensures SessionEmptyState is shown when an agent has no sessions.

**Architecture Reminder**: Agents are grouping layers, NOT chat containers. Each AgentSession is an independent chat. Sessions are project-scoped (have `projectPath` and `projectName`).

**Test Case**: 1) Create session in project A, move to Done. 2) Click agent in project B. 3) Expected: SessionEmptyState with 'Create new session'. 4) Actual (before fix): Chat from project A session. 5) After fix: SessionEmptyState ✅

**File Modified**: `src/App.tsx:7147-7150`
