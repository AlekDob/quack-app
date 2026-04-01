# Implementation Tasks: Brain Hooks

## Phase 1: Foundation

- [ ] 1.1 Create hook directory structure
  - Create `~/.quack/hooks/brain/` directory
  - **Depends on**: None

- [ ] 1.2 [P] Implement shared.js utilities
  - readStdin, warn, info, getProjectDir, getDocsDir
  - parseAST, findGotchas, readSession, writeSession
  - estimateTokens, resolveBreadcrumbs
  - **Depends on**: 1.1
  - **Requirement**: All stories

## Phase 2: Core Hooks

- [ ] 2.1 Implement session-start.js
  - Create _brain-session.json
  - Count Brain entries, find last diary, check staleness
  - Emit summary on stderr
  - **Depends on**: 1.2
  - **Requirement**: Story 3

- [ ] 2.2 [P] Implement pre-read.js
  - Parse stdin, lookup AST.md, find gotchas, check session
  - Update session tracking
  - **Depends on**: 1.2
  - **Requirement**: Story 1

- [ ] 2.3 [P] Implement pre-write.js
  - Parse stdin, find gotchas, resolve breadcrumbs
  - Check Do-Not-Repeat patterns
  - **Depends on**: 1.2
  - **Requirement**: Story 2

- [ ] 2.4 Implement stop.js
  - Read session, build summary, append diary, cleanup
  - **Depends on**: 1.2
  - **Requirement**: Story 4

## Phase 3: Integration & Distribution

- [ ] 3.1 Register hooks in settings.json
  - Add hook entries to quack-app .claude/settings.json for local testing
  - Test all 4 hooks end-to-end
  - **Depends on**: 2.1, 2.2, 2.3, 2.4

- [ ] 3.2 [P] Create marketplace plugin
  - Create plugin structure in quack-marketplace repo
  - plugin.json with correct metadata
  - Copy hook scripts to plugin
  - Update marketplace.json
  - **Depends on**: 2.1, 2.2, 2.3, 2.4
  - **Requirement**: Story 5

## Phase 4: Testing & Polish

- [ ] 4.1 End-to-end testing
  - Test session-start → pre-read → pre-write → stop flow
  - Verify diary entries are created correctly
  - Test edge cases (no documentation/, empty AST.md, etc.)
  - **Depends on**: 3.1

- [ ] 4.2 Documentation
  - Update quack-brain SKILL.md with hooks info
  - Write diary entry
  - Add gotcha if any discovered
  - **Depends on**: 4.1
