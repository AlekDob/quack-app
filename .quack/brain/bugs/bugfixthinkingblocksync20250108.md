---
type: bug_fix
project: quack-app
created: 2026-01-08
migrated: true
---

# bugfix_thinking_block_sync_2025_01_08

[2025-01-08] Fixed ThinkingBlock trapped state when cycling thinking modes with Tab key

Root cause: ThinkingBlock used uncontrolled useState that didn't sync with parent

Solution: Added resetKey prop that triggers re-expansion when thinking mode changes

Components modified: ThinkingBlock.tsx, ChatMessage.tsx, MessageList.tsx, ChatView.tsx

ChatView increments a counter on Tab key press, counter flows down as resetKey

Default state changed to expanded=true for better UX

7 tests added in thinkingBlockSync.test.ts

Documentation: docs/02-bug-fixes/thinking-block-sync-fix.md
