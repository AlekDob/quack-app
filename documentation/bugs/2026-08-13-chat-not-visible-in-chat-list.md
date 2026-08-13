---
type: bug
project: synara
created: 2026-08-13
last_verified: 2026-08-13
status: fixed
tags: [sidebar, chats, drafts, regression]
---

## New chat missing from the Chats list

### Symptom

After starting a new Home chat, the conversation opened correctly but the loading row was not visible in the sidebar. The row appeared only after opening the `Chats` section manually.

### Root cause

New conversations start as local drafts. The sidebar renders a temporary skeleton until the server creates the durable thread. The existing effect expanded the destination project for every draft. Home chats use a hidden chat container and are rendered under the separate `Chats` disclosure, so expanding the project did nothing.

### Fix

`Sidebar.tsx` now checks the pending draft's project with `isHomeChatContainerProject`:

- Home chat: open `Chats`.
- Ordinary project thread: expand that project.

The same pending-draft behavior is preserved for Studio and ordinary project folders.

### Verification

- `bun run test -- src/components/Sidebar.logic.test.ts` from `apps/web`
- Result: 1 file passed, 111 tests passed.
