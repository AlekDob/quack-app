---
type: pattern
project: quack-app
created: 2026-04-16
last_verified: 2026-04-16
tags: [scroll, chat, message-list, session, ux]
---

# Session Scroll Memory

## Problem
When `ChatView` remounts on session switch (its React `key` includes `activeSessionId`), the chat used to land mid-scroll. Cause: a mount-only `useEffect` with `setTimeout(..., 100)` + `behavior: 'smooth'` fired before async-loaded messages and late-mounting markdown / code blocks / images had reached their final height. The scroll target was computed against a partial `scrollHeight`.

Additionally there was no way to "come back where I left": every session switch tried to go to the bottom, even if the user had scrolled up to read history.

## Solution
A module-level `Map<sessionId, { scrollTop, wasAtBottom }>` singleton + a `ResizeObserver` that keeps the target aligned while content stabilizes.

### Rule
- User was NOT at the bottom when leaving → **restore exact `scrollTop`** on return.
- User was at the bottom (or session was auto-scrolling) → **scroll to bottom** on return.

### Cost
- ~30-line utility module, zero dependencies.
- ~40 bytes per session in memory, cleared on app reload.
- No store, no subscriptions, zero extra re-renders.

## Files
| Path | Purpose |
|------|---------|
| `src/utils/sessionScrollMemory.ts` | Map singleton: `saveSessionScroll`, `getSessionScroll`, `clearSessionScroll` |
| `src/components/MessageList.tsx` | Effect keyed on `currentSessionId`: apply target + `ResizeObserver` (500ms) + save on unmount |
| `src/components/MessageListVirtualized.tsx` | Same pattern against `listRef.current.element` |

## Implementation sketch
```ts
useEffect(() => {
  const el = scrollRef.current;
  if (!el || messages.length === 0) return;

  const saved = currentSessionId ? getSessionScroll(currentSessionId) : undefined;
  const restore = saved && !saved.wasAtBottom;

  const applyTarget = () => {
    if (!scrollRef.current) return;
    if (restore) {
      scrollRef.current.scrollTop = Math.min(
        saved!.scrollTop,
        scrollRef.current.scrollHeight - scrollRef.current.clientHeight,
      );
    } else {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  applyTarget();
  const observer = new ResizeObserver(applyTarget);
  observer.observe(el);
  const stopId = window.setTimeout(() => observer.disconnect(), 500);

  return () => {
    window.clearTimeout(stopId);
    observer.disconnect();
    if (scrollRef.current && currentSessionId) {
      saveSessionScroll(currentSessionId, {
        scrollTop: scrollRef.current.scrollTop,
        wasAtBottom: checkIfAtBottom(),
      });
    }
  };
}, [currentSessionId]);
```

## Gotchas
- Use `behavior: 'auto'` (instant) on restore. `smooth` on a mount animation toward a moving target looks janky and can leave the user mid-scroll if images load during the animation.
- `ResizeObserver` must be disconnected (500ms cap) to avoid permanent cost while streaming in long sessions — after the first paint + layout settles, `onScroll` handlers are enough.
- For the virtualized list, save/restore raw `scrollTop` on `listRef.current.element`. Computing virtualized row indices is fragile with dynamic heights.
- Clamp `scrollTop` to `scrollHeight - clientHeight` on restore in case the session shrank (e.g. rewind).

## Related
- Feature: `features/043-agent-sidebar.md` (session click → chat activation)
- Diary: `diary/2026-04-16.md` (fix entry)
