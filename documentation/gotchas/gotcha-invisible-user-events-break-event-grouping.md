---
type: gotcha
created: 2026-02-17
tags: [claude-sdk, event-stream, streaming, message-rendering, grouping]
---

# Gotcha: Invisible `user` events in Claude SDK stream break naive "previous event" checks

## The Problem

In the Claude Agent SDK event stream, `user` events (carrying tool_result data) always sit between `assistant` events, but they render as `null` in StreamMessage.tsx. Any feature that checks the "immediately previous event" to determine context (e.g., grouping consecutive assistant messages) will always find a `user` event instead of the expected `assistant` event, breaking the logic silently.

### Broken Sequence

1. Live agent produces: `assistant` → `user` (tool_result) → `assistant` → `user` (tool_result) → `assistant` → result
2. Feature code: `check events[index - 1].type` to detect "is previous event also assistant?"
3. Result: Always finds `'user'` type instead
4. Grouping/batching never activates beyond the first pair

## The Root Cause

The `user` events carry tool_result data but are rendered inline with the corresponding tool_use in the previous assistant event, so they return `null` from StreamMessage (lines 788-791):

```tsx
// StreamMessage.tsx - user events return null
if (event.type === 'user') {
  return null;
}
```

This creates a mismatch: the events array contains `user` events, but the rendered output skips them.

## The Fix Pattern

Scan backwards past invisible event types to find the last visible event:

```tsx
let prevVisibleType: string | null = null;
for (let i = eventIndex - 1; i >= 0; i--) {
  const e = events[i];
  if (e.type !== 'user') {
    prevVisibleType = e.type;
    break;
  }
}
```

Then use `prevVisibleType` instead of checking `events[index - 1].type`.

## Two Rendering Paths

1. **Restored sessions:** `MessageList → ChatMessage` — no events array, grouping by `message.role` (safe)
2. **Live sessions:** `ChatMessage → StreamMessage` events loop — events array present, **must skip invisible `user` events**

Only live sessions hit this gotcha.

## Related Code

- `src/components/ChatMessage.tsx:452-461` — the backwards scan fix
- `src/components/StreamMessage.tsx:788-791` — where `user` events return `null`
- Commit: fc0bdc9 ("feat: group consecutive agent messages, show header only on first")

## Key Insight

When working with event streams that have invisible/filtered events, **always scan backwards past them** rather than checking `[index - 1]` directly.
