---
type: bug-fix
project: quack-app
component: chat
date: 2026-02-11
severity: medium
user-impact: high
status: fixed
---

# Fix: Auto-scroll during streaming prevented user from reading previous messages

## Problem

When an agent streams a response in the chat, the auto-scroll forced the view to the bottom on every content update. If the user scrolled up to read earlier content or review the conversation, the auto-scroll immediately pulled them back down — making it impossible to review previous messages during streaming.

**User Report:** Discord user "meaning" reported this exact behavior on 2026-02-08.

## Root Cause

In `src/components/MessageList.tsx` (lines 184-188), the streaming auto-scroll logic **always** forced scroll, ignoring user scroll position:

```typescript
} else if (loading) {
  // During streaming, ALWAYS scroll to keep up with new content
  shouldAutoScroll = true; // ← BUG: ignores user position
}
```

This meant:
- Agent starts streaming → `loading = true`
- User scrolls up to read → ignored, still `shouldAutoScroll = true`
- Every content update → forced scroll to bottom
- User stuck at bottom, can't review conversation

## Solution

Added `userHasScrolledUpRef` to track whether the user has **intentionally scrolled away** from the bottom during streaming. The auto-scroll now respects this flag.

### Changes to `src/components/MessageList.tsx`

1. **Added new ref** (line 46):
   ```typescript
   const userHasScrolledUpRef = useRef(false);
   ```

2. **Updated `handleScroll` callback** (lines 66-72): Detects when user scrolls up during streaming
   ```typescript
   if (loading) {
     if (!isAtBottom) {
       userHasScrolledUpRef.current = true;  // User scrolled up
     } else {
       userHasScrolledUpRef.current = false; // User back at bottom
     }
   }
   ```

3. **Fixed streaming auto-scroll condition** (lines 194-196):
   ```typescript
   } else if (loading) {
     // During streaming, only auto-scroll if user hasn't scrolled up
     shouldAutoScroll = !userHasScrolledUpRef.current && isAtBottom;
   }
   ```

4. **Reset ref on user message** (lines 192-195): New message → reset lock
   ```typescript
   if (lastMessage?.role === 'user') {
     userHasScrolledUpRef.current = false;
   }
   ```

5. **Reset ref when streaming ends** (lines 219-223): New useEffect
   ```typescript
   useEffect(() => {
     if (!loading) {
       userHasScrolledUpRef.current = false;
     }
   }, [loading]);
   ```

## Behavior Flow

```
User sends message → ref = false → auto-scroll ON
Agent starts streaming → isAtBottom? → continues scrolling
User scrolls up → ref = true → auto-scroll OFF
User clicks "Scroll to bottom" button → ref = false → auto-scroll ON
Streaming ends → ref = false → ready for next interaction
```

## Files Modified

- `src/components/MessageList.tsx` — single file, ~20 lines modified

## Verification

✅ TypeScript compiles without errors
✅ Existing tests pass (49 failing tests are pre-existing kanban issues, unrelated)
✅ Manual testing:
   1. Start chat, send message that triggers long agent response
   2. While streaming: scroll up → content does NOT jump back down ✓
   3. While streaming: click "Scroll to bottom" → resumes auto-scroll ✓
   4. After streaming ends: send new message → auto-scroll works normally ✓
   5. Lazy hydration (switching chats) still works correctly ✓

## Impact

- **User satisfaction:** Users can now review conversation during streaming
- **UX improvement:** "Scroll to bottom" button already existed, now serves as escape hatch
- **No regressions:** Existing lazy hydration and user message auto-scroll unchanged
- **Performance:** Minimal overhead (single ref check per scroll event)

## Related

- Discord feedback: user "meaning" (2026-02-08, 15:40)
- Component: `MessageList.tsx` (primary scroll controller)
- Related UX: "Scroll to bottom" button, "Scroll to previous user message" button
