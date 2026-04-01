# Feature Specification: Brain Hooks

## Problem Statement

Quack Brain has 219+ knowledge entries (gotchas, patterns, bugs, decisions) but the system is entirely **manual**. Agents must remember to check the Brain before acting, and knowledge is never surfaced proactively. OpenWolf demonstrated that 6 lightweight hooks can reduce token waste by 65-80% and prevent repeated mistakes automatically.

The Brain is also distributed via the Quack Marketplace — any improvement must be packaged as an installable plugin for all users.

## User Stories

### Story 1: Pre-Read Intelligence

As an AI agent working in a Quack-enabled project,
I want to see relevant Brain context before reading a file,
So that I can skip unnecessary reads or approach the file with critical context.

**Acceptance Criteria:**
- [ ] Before reading a file, the hook shows its AST.md entry (description + token estimate)
- [ ] If gotchas/bugs exist for that file, they are surfaced via stderr
- [ ] If the file was already read in this session, a warning is shown with token cost
- [ ] Hook completes in <5 seconds and never blocks (exit 0 always)

### Story 2: Pre-Write Safety

As an AI agent about to modify code,
I want to be warned about known gotchas and Do-Not-Repeat patterns for the target file,
So that I avoid reintroducing known bugs.

**Acceptance Criteria:**
- [ ] Before writing/editing, the hook checks gotchas/ and bugs/ for entries mentioning the file
- [ ] Code breadcrumbs (`// Brain: {slug}`) in the file are resolved to their Brain entries
- [ ] Matching entries are shown via stderr as warnings
- [ ] Hook completes in <5 seconds and never blocks

### Story 3: Session Context

As an AI agent starting a new session,
I want to receive a summary of the Brain's most relevant entries,
So that I begin with project awareness.

**Acceptance Criteria:**
- [ ] On session start, the hook shows: number of Brain entries, last diary date, stale entries count
- [ ] If cerebrum/gotchas haven't been reviewed in 7+ days, a reminder is shown
- [ ] A session tracking file is created to track reads/writes during the session

### Story 4: Session Summary

As a developer reviewing AI work,
I want an automatic session summary appended to the diary,
So that knowledge capture happens without manual effort.

**Acceptance Criteria:**
- [ ] On stop, the hook generates a summary of files read/written during the session
- [ ] Token usage estimates are included
- [ ] If any file was read 3+ times, it's flagged as potential waste
- [ ] Summary is appended to `documentation/diary/YYYY-MM-DD.md`

### Story 5: Marketplace Distribution

As a Quack user,
I want to install Brain Hooks from the Quack Store,
So that I get automated Brain integration without manual setup.

**Acceptance Criteria:**
- [ ] Brain Hooks is a standalone plugin in the marketplace
- [ ] Installation adds hooks to `.claude/settings.json` automatically
- [ ] Hooks work with any project that has a `documentation/` folder
- [ ] Users can enable/disable individual hooks from the Hooks panel

## Non-Functional Requirements

- **Performance**: Each hook must complete in <5 seconds (Claude Code timeout)
- **Reliability**: Hooks must NEVER block. Always exit(0), errors go to stderr as warnings
- **Portability**: Pure Node.js, zero external dependencies, works on macOS/Linux/Windows
- **Privacy**: No network calls, all data stays local
- **Compatibility**: Works with any project structure that follows Quack Brain conventions

## Success Metrics

- Repeated file reads reduced by 50%+
- Gotcha violations prevented (pre-write catches known issues)
- Diary entries increase (auto-generated session summaries)
- Marketplace installs (user adoption)

## Out of Scope

- Token ledger / waste detector dashboard (future feature)
- Daemon / cron-based cleanup (Quack already has automations)
- Design QC screenshots (not relevant to Brain)
- Auto-updating AST.md on write (too complex for v1, would need Rust code-intel)

## Clarifications

### Q1: Where do the hook scripts live after marketplace installation?

**Context**: Hooks need actual JS files on disk to execute.
**Answer**: Scripts are installed to `~/.quack/hooks/brain/` (global, shared across projects). The `.claude/settings.json` entries reference these paths.

### Q2: How do hooks discover the project's documentation/ folder?

**Context**: Each project may have docs in different locations.
**Answer**: Use `$CLAUDE_PROJECT_DIR` env var (provided by Claude Code hook system) + look for `documentation/` or read CLAUDE.md for the path.

### Q3: Should hooks modify Brain entries or only read them?

**Answer**: v1 is read-only + append-only diary. No modifications to existing entries. The stop hook only appends to diary.

### Q4: How does the session tracker persist across hooks?

**Answer**: A `_brain-session.json` file in `$CLAUDE_PROJECT_DIR/.claude/` tracks the current session's reads, writes, and timestamps. Created by session-start, read/updated by pre-read and post-write, consumed by stop.
