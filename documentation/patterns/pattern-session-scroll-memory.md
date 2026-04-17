---
type: pattern
project: quack-app
created: 2026-04-16
last_verified: 2026-04-16
tags: [scroll, chat, message-list, session, ux, anchor]
---

# Session Scroll Memory (Anchor-based)

## Problem
When `ChatView` remounts on session switch (its React `key` includes `activeSessionId`), the chat used to land mid-scroll. Cause: a mount-only `useEffect` with `setTimeout(100) + behavior: smooth` fired before async-loaded messages and late-mounting markdown/code/images reached their final height.

A first iteration tried to auto-restore scroll position per session (`wasAtBottom` heuristic). It was unreliable: users ended up in random spots depending on read state.

## Final solution — Opt-in anchor
- **Default**: on session open, always `scrollToBottom`. Predictable.
- **Opt-in anchor**: a small anchor icon follows the scrollbar rail. Click → anchors the message currently centered in the viewport. Next time the session is opened, chat jumps to that message.
- **Remove anchor**: hover the anchored icon → an "X" appears → click to clear.
- **Jump to anchor**: click the anchored icon itself → smooth-scroll to the anchored message.
- **Storage**: module-level `Map<sessionId, { messageId }>`, cleared on app reload. Zero store cost, zero extra re-renders.

## Files
| Path | Purpose |
|------|---------|
| `src/utils/sessionScrollMemory.ts` | Map singleton: `setSessionAnchor`, `getSessionAnchor`, `clearSessionAnchor` |
| `src/components/AnchorIndicator.tsx` | Floating anchor icon aligned with the scrollbar rail (position: fixed, computed from `scrollRef.getBoundingClientRect()`) |
| `src/components/AnchorIndicator.css` | Visual styling + hover X button |
| `src/components/MessageList.tsx` | Anchor mount logic, `data-message-id` on each message-wrapper, renders `AnchorIndicator` |
| `src/components/MessageListVirtualized.tsx` | Scroll-lock + rAF polling for `listRef.current.element` (AutoSizer defers mount). Always scroll-to-bottom; anchor UX excluded |

## Implementation sketch

### Mount effect (MessageList)
```ts
useEffect(() => {
  const el = scrollRef.current;
  if (!el || messages.length === 0) return;
  const anchor = currentSessionId ? getSessionAnchor(currentSessionId) : undefined;

  const applyTarget = () => {
    if (!scrollRef.current) return;
    if (anchor) {
      const target = scrollRef.current.querySelector<HTMLElement>(
        `[data-message-id="${CSS.escape(anchor.messageId)}"]`,
      );
      if (target) {
        scrollRef.current.scrollTop = target.offsetTop - scrollRef.current.offsetTop;
        return;
      }
    }
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  };

  applyTarget();
  const observer = new ResizeObserver(applyTarget);
  observer.observe(el);
  const stopId = window.setTimeout(() => observer.disconnect(), 500);
  return () => { window.clearTimeout(stopId); observer.disconnect(); };
}, [currentSessionId]);
```

### AnchorIndicator positioning
The indicator uses `position: fixed`. Its top/left are computed in viewport coordinates from `scrollRef.getBoundingClientRect()`:
- Vertical percentage: if anchored → position of `[data-message-id=…]` / max scroll; otherwise → `scrollTop / maxScroll` (follows the thumb).
- Updated on `scroll`, `ResizeObserver`, and `window resize` via rAF-throttled `tick`.

### Anchoring logic
Click (when not anchored):
```ts
const findCenteredMessageId = () => {
  const containerRect = el.getBoundingClientRect();
  const centerY = containerRect.top + containerRect.height / 2;
  // pick [data-message-id] closest to centerY
};
```

## Gotchas
- **Async messages re-trigger** — on session click, `messages` is often empty at first mount (loaded async from disk). Using `[currentSessionId]` alone as dep leaves the chat stuck at the top. Use `[currentSessionId, messages.length > 0]` + a `ref` flag (`appliedInitialScrollForSessionRef`) so the initial scroll runs once per session, when messages actually arrive.
- **ResizeObserver must watch `.message-list-content`, not `.message-list`** — the scroll container has `flex: 1` and a fixed outer height. Only the inner content element grows as markdown/code/images mount. Observing just the outer container means the observer never fires and scrollTop stays at 0. Observe BOTH (`el` + `el.querySelector('.message-list-content')`) for safety.
- **requestAnimationFrame fallback loop** — in addition to the ResizeObserver, schedule an 8-frame rAF loop that calls `applyTarget()` on each frame (~130ms). Catches late layout passes that RO may miss, especially for resumed sessions.
- **Sync `handleScroll` after programmatic scrollTop** — setting `scrollRef.current.scrollTop = scrollHeight` may or may not fire a native `scroll` event depending on the value change. The scroll-to-bottom button relies on `handleScroll` to update `showScrollButton`. Call `handleScroll()` manually at the end of `applyTarget` so the button state syncs even if no native event fired.
- **Position: fixed** (not `absolute`) — the indicator must not scroll with the container. `position: absolute` inside the scroll area would scroll with the content.
- **Always-visible anchor icon** — `opacity: 0` on the anchor indicator (even with `:hover` fallback) was invisible and users couldn't discover it. Default to `opacity: 0.45`, `opacity: 1` on icon hover.
- **No "scroll to previous user message" button** — the `scroll-to-top-button` (up-arrow → previous `You` message) was removed: users confused it with scroll-to-bottom because it also appeared when scrolled up. Only the `scroll-to-bottom-button` remains (down-arrow → end of chat).
- **CSS.escape** on `data-message-id` — message IDs can contain dots/slashes that break attribute selectors.
- **rAF throttle** on scroll handler — the `ResizeObserver` + `scroll` listeners can fire in rapid bursts during smooth-scroll; rAF coalesces into 1 update per frame.
- **Virtualized list exclusion** — the virtualized path (>100 messages) does NOT expose `data-message-id` on all rows (only mounted ones). Anchoring relies on DOM queries so it's disabled there. Document this limitation if extending later; probably needs an index-based approach using `listRef.scrollToRow`.
- **Virtualized `useListRef` + `AutoSizer` timing** — in `MessageListVirtualized.tsx`, `useListRef(null)` returns a ref that is populated only AFTER `<AutoSizer>` measures the container and `<List>` mounts. On session switch with >100 messages, the mount effect fires with `listRef.current === null`. An early return (`if (!listRef.current) return;`) would kill the effect permanently. **Fix**: do NOT early-return on null listRef. Start the rAF polling loop unconditionally (60 frames / ~1s). Inside `apply()`, check `list = listRef.current` each tick and skip if still null. Mark `appliedInitialScrollForSessionRef` only when apply() actually succeeds — not on effect entry. Attach ResizeObserver + scroll/wheel/touch/key listeners inside `apply()` once `list.element` is first seen (guard with `attachedEl !== el`). Also force `el.scrollTop = el.scrollHeight` as belt-and-suspenders alongside `list.scrollToRow(..., 'end')` — dynamic row heights from `useDynamicRowHeight` make scrollToRow imprecise on first call.
- **Stale anchor** — if the anchored message was removed (rewind, session reset), the querySelector returns null → fall back to scrollToBottom. No need to clear from memory immediately.

## Related
- Feature: `features/043-agent-sidebar.md` (session click → chat activation)
- Diary: `diary/2026-04-16.md`
