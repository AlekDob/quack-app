---
type: bug_fix
project: quack-app
created: 2026-04-09
tags: [chat, slash-commands, brain, button]
---

# Fix: "Update Brain" button bypasses handleSend — slash command never expanded

## Problem

The "Update Brain" button in the SessionPopover sent `/brain` directly via `onSendMessage('/brain')`, bypassing `handleSend()`. This meant:

1. No slash command detection (regex at `handleSend` line 310)
2. No call to `expand_slash_command` in the Rust backend
3. Raw `/brain` text sent to Claude SDK, which doesn't recognize it as a native command
4. **Result: nothing happens** — no error, no response, no visible effect

## Root Cause

In `ChatView.tsx` line 1010:

```tsx
// BEFORE (broken) — bypasses slash command expansion
onBrainUpdate: () => onSendMessage('/brain'),

// AFTER (fixed) — goes through handleSend which expands /brain
onBrainUpdate: () => handleSend('/brain'),
```

`onSendMessage` is the raw SDK send function (prop from parent).
`handleSend` is the local function that intercepts slash commands, calls `expand_slash_command`, and sends the expanded content.

## Why /compact worked but /brain didn't

`/compact` at line 1020 also uses `onSendMessage('/compact')` directly — but it works because `/compact` IS a native SDK command. The SDK intercepts it internally.

`/brain` is a **Quack-specific** command defined in `QUACK_BUILTIN_COMMANDS` in `slash_commands.rs`. It requires expansion by `handleSend` → `expand_slash_command` → returns the instruction text.

## Fix

```diff
- onBrainUpdate: () => onSendMessage('/brain'),
+ onBrainUpdate: () => handleSend('/brain'),
```

## Files Changed

- `src/components/ChatView.tsx` — line 1010: route through `handleSend`

## Key Insight

Any Quack-specific slash command (non-SDK-native) triggered by a UI button MUST go through `handleSend`, not `onSendMessage`. Only SDK-native commands (`/compact`, `/cost`, `/diff`, etc.) can be sent raw.
