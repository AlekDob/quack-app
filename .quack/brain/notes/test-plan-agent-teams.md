---
type: note
project: quack-app
created: 2026-02-06
tags: [testing, agent-teams]
---

# Test Plan: Agent Teams Integration

Full test plan document at: `docs/03-testing/agent-teams-test-plan.md`

## Coverage

- 20 manual tests covering:
  - Feature flag toggle and persistence (Tests 1-2)
  - Create Team button visibility and conditions (Tests 3-5)
  - Team Creation Modal UX (Tests 6-12)
  - File system verification (Tests 13-14)
  - Team Status Badge (Test 15)
  - Team disbanding cleanup (Test 16)
  - Single-agent workflow regression (Test 17)
  - Roster idempotency (Test 18)
  - Default name generation (Test 19)
  - Node SDK prompt augmentation (Test 20)

## Key Files Tested

| Component | File |
|-----------|------|
| Rust backend | `src-tauri/src/teams.rs` |
| Team store | `src/stores/teamStore.ts` |
| Creation modal | `src/components/TeamCreationModal.tsx` |
| Status badge | `src/components/TeamStatusBadge.tsx` |
| Repository wiring | `src/components/RepositoryGroup.tsx` |
| Event interception | `src/App.tsx` |
| Prompt augmentation | `src-tauri/node-sdk/stream-claude.js` |
| Settings toggle | `src/components/settings/.../ClaudeCodeSettings.tsx` |
