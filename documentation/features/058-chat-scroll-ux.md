---
type: feature-doc
project: quack-app
stack: Tauri (Rust + React)
created: 2026-04-16
last_verified: 2026-04-16
tags: [chat, scroll, anchor, session-switch, ux, react]
related: [pattern-session-scroll-memory, 059-chat-history-rendering]
---

## Chat Scroll UX
**Purpose:** Controls all chat scroll behavior: session-switch scroll-to-bottom with scroll-lock, opt-in anchor-based scroll memory, and scroll-to-bottom arrow placement.
**Stack:** React 18 + TypeScript (Tauri v2)
**Pattern:** `documentation/patterns/pattern-session-scroll-memory.md`

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Component | src/components/MessageList.tsx | Non-virtualized list (<=100 msgs); hosts scrollRef, scroll-to-bottom button, anchor integration |
| Component | src/components/MessageListVirtualized.tsx | Virtualized list (>100 msgs) using react-window + useDynamicRowHeight; implements scroll-lock on session switch |
| Component | src/components/AnchorIndicator.tsx | Floating anchor icon aligned to scrollbar rail; sets/jumps/removes session anchor |
| Component | src/components/AnchorIndicator.css | Anchor icon positioning and hover/remove styles |
| Component | src/components/MessageList.css | Message-list wrapper (position: relative), empty state, scroll-button styles |
| Util | src/utils/sessionScrollMemory.ts | Module-level anchor memory per session (no store, no re-renders) |

### Data Flow
Session switch → ChatView mounts MessageList/MessageListVirtualized with currentSessionId → effect resets scroll target → getSessionAnchor(sessionId) → if anchor: scrollToMessage(messageId), else: scrollToBottom (with scroll-lock on virtualized path until user wheel/touch/keydown) → user clicks AnchorIndicator → findCenteredMessageId → setSessionAnchor(sessionId, messageId) → AnchorIndicator pins to anchored message offset

### Key Functions
- `setSessionAnchor(sessionId: string, messageId: string) → void` — stores anchor in module-level Map
- `getSessionAnchor(sessionId: string) → SessionAnchorState | undefined` — reads anchor on session open
- `clearSessionAnchor(sessionId: string) → void` — removes anchor when user clicks remove (X)
- `AnchorIndicator({ scrollRef, sessionId, anchoredMessageId, onAnchor, onRemove, onJumpToAnchor }) → JSX` — scrollbar-aligned anchor UI
- `findCenteredMessageId() → string | null` — picks the message nearest the viewport center (via `[data-message-id]` query)
- `updateAnchorPercent() → void` — computes anchored target vertical offset ratio for icon pin
- `updateThumbPercent() → void` — mirrors scroll thumb position when not anchored
- `scrollToBottom() → void` — in MessageList: smooth scrollTo(scrollHeight); in virtualized: `listRef.scrollToRow({ index: last, align: 'end' })`
- `checkIfAtBottom() → boolean` — scrollHeight − scrollTop − clientHeight < 100 threshold for showing scroll-to-bottom button

### State
- `anchorMemory`: Map<string, SessionAnchorState> — anchor store, cleared on app reload (global, module-level)
- `thumbPercent`: number — current scroll thumb ratio (component, AnchorIndicator)
- `anchorPercent`: number | null — anchored message offset ratio (component, AnchorIndicator)
- `hovered`: boolean — reveals remove (X) button (component, AnchorIndicator)
- `showScrollButton`: boolean — floating scroll-to-bottom visibility (component, MessageList/Virtualized)
- `showScrollToTopButton`: boolean — navigate-previous-user-message button (component)
- `appliedInitialScrollForSessionRef`: string | null — guards one-time initial scroll per session (component, Virtualized)
- `scrollLockedRef`: boolean — keeps forcing scrollToBottom until user interaction (component, Virtualized)

### External Dependencies
- react-window (List, useListRef, useDynamicRowHeight) — virtualized rendering and dynamic row measurement
- ResizeObserver (browser) — triggers anchor/thumb reposition on layout change

### Config
- Scroll-bottom detection threshold: 100px from bottom (hardcoded in `checkIfAtBottom`)
- Virtualization switch threshold: 100 messages (ChatView.tsx:901)

### Notes
- Anchor is opt-in: default is scroll-to-bottom on every session open.
- Virtualized path does not use anchor UX (dynamic row heights make offset targeting unreliable during initial measurement).
- Scroll-lock pattern mitigates `useDynamicRowHeight` measurement drift: target rows expand after initial layout, pushing the intended bottom down.
