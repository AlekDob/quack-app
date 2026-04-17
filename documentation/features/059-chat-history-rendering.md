---
type: feature-doc
project: quack-app
stack: Tauri (Rust + React)
created: 2026-04-16
last_verified: 2026-04-16
tags: [chat, rendering, virtualization, react-window, performance]
related: [pattern-session-scroll-memory, 058-chat-scroll-ux, 055-performance-critical-refactor]
---

## Chat History Rendering
**Purpose:** Renders the chat message history with a dual implementation (eager list under 100 msgs, virtualized list above) and lazy hydration from disk per session.
**Stack:** React 18 + TypeScript (Tauri v2) + react-window
**Pattern:** `documentation/patterns/pattern-session-scroll-memory.md`

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Component | src/components/MessageList.tsx | Eager renderer for sessions with <=100 messages; maps ChatMessage per row |
| Component | src/components/MessageListVirtualized.tsx | Virtualized renderer for >100 messages using react-window List + useDynamicRowHeight |
| Component | src/components/ChatMessage.tsx | Per-message row (user/assistant/tool-call rendering, markdown, plan, question UIs) |
| Component | src/components/SkeletonMessage.tsx | Three-dot typing indicator shown while assistant response is streaming/loading |
| Component | src/components/DuckAnimation.tsx | Empty-state mascot rendered when session has zero messages |
| Component | src/components/ChatView.tsx | Threshold switch between MessageList and MessageListVirtualized (line ~901) |
| Service | src/hooks/useSessionMessageSync.ts | Syncs chatSessions message count to sessionStore after hydration |

### Data Flow
User selects session → ChatView reads chatSessions Map keyed by sessionId → if entry missing: lazy hydrate from disk (session messages JSON) → useSessionMessageSync updates session.messageCount → ChatView picks renderer: messages.length > 100 → Suspense(MessageListVirtualized) else MessageList → row render path: ChatMessage (per message) + SkeletonMessage (if loading) → empty state: DuckAnimation when messages.length === 0

### Key Functions
- `MessageList({ messages, loading, ...handlers }) → JSX` — eager list, renders all ChatMessage rows + optional SkeletonMessage trailer
- `MessageListVirtualized({ messages, loading, currentSessionId, ... }) → JSX` — wraps react-window List with dynamic row heights keyed by sessionId
- `useDynamicRowHeight({ defaultRowHeight, key }) → RowHeight` — react-window v2 hook; ResizeObserver-based row measurement, resets on session key change
- `useSessionMessageSync({ chatSessions, activeSessionId }) → void` — after hydration, pushes messageCount into sessionStore (SESSION-FIRST architecture)
- `ChatMessage({ message, ... }) → JSX` — memoized; renders role-specific layout, tool calls, markdown, plan approval, user question
- `SkeletonMessage() → JSX` — static typing indicator

### State
- `chatSessions`: Map<string, ChatMessage[]> — per-session message arrays, keyed by sessionId (global, session store / ChatView)
- `activeSessionId`: string | null — currently displayed session (global)
- `loading`: boolean — is assistant response in-flight (component, ChatView → MessageList)
- `DEFAULT_MESSAGE_HEIGHT`: number — initial row estimate before measurement (component, Virtualized)
- `prevMessagesLengthRef`: number — diff tracker to detect new-message events (component)

### External Dependencies
- react-window (List, useListRef, useDynamicRowHeight) — virtualized rendering for large sessions
- React Suspense + React.lazy — code-splits MessageListVirtualized (fallback: empty flex div)

### Config
- Virtualization threshold: 100 messages (ChatView.tsx:901, Brain: 005-performance-critical-refactor) — chosen over 50 to avoid mid-session swap during streaming; once virtualized, the session stays virtualized
- `DEFAULT_MESSAGE_HEIGHT`: initial row height estimate for react-window (MessageListVirtualized)

### Notes
- SESSION-FIRST: chatSessions keyed by session.id (not agentId) — enables parallel sessions per agent. Brain: fix-remote-team-session-tracking.
- Virtualized renderer is code-split via Suspense to keep initial bundle small.
- ChatMessage is memoized to avoid re-rendering every row on streaming updates.
- See `058-chat-scroll-ux.md` for scroll, anchor, and scroll-to-bottom behavior layered on top of this rendering pipeline.
