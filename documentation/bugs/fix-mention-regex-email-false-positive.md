---
type: bug_fix
project: quack-app
created: 2026-03-26
last_verified: 2026-03-26
tags: [regex, mentions, email, ui]
---

# Fix: @mention regex false positive on email addresses

## Problem

The `@mention` regex in `src/utils/agentMentions.ts` was `/@([\w-]+)/g`, which matched the `@` character inside email addresses (e.g., `user@cec.com`). This caused the email domain portion to be rendered as an `AgentMentionChip` component with an avatar, creating visible gaps in user message bubbles.

## Solution

Changed all 3 regex patterns in `src/utils/agentMentions.ts` to use a negative lookbehind assertion:

**Pattern:** `(?<!\w)@([\w-]+)`

This ensures `@` is only matched when it is **NOT** preceded by a word character, which:
- Skips `@` inside email addresses (preceded by alphanumeric characters)
- Still matches standalone `@agent` mentions at word boundaries

**Files changed:**
1. `parseAgentMentions()` — line ~45
2. `stripMentions()` — line ~60
3. `hasMentions()` — line ~75

## Key Insight

Negative lookbehind `(?<!\w)` is essential for distinguishing between:
- Email addresses: `user@domain.com` (skip the `@`)
- Agent mentions: `Hello @agent` (match the `@`)

The condition "word character must NOT precede @" filters out emails while preserving mention detection at message boundaries.

## Verification

Tested with:
- Messages containing email addresses (e.g., "contact us at support@quack.com") — no false chip rendering
- Messages with agent mentions (e.g., "Hey @agent, help me") — mentions still detected and rendered
