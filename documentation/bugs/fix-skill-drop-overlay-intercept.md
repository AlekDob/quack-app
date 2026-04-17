---
type: bug
project: quack-app
created: 2026-04-16
last_verified: 2026-04-16
tags: [drag-drop, skill, overlay, SplitDropZone, ChatInput, frozen-ui]
---

# Fix: Skill drag-drop to chat silently intercepted by SplitDropZone overlay

## Symptom
Dragging a skill from SkillsPanel to the chat input area does nothing. In some cases the app appears frozen/crashed because the SplitDropZone overlay stays visible indefinitely.

## Root Cause
When dragging a `application/quack-skill` item over the content area:

1. `handleContentDragOver` (App.tsx) detects the sidebar MIME type and sets `isDraggingSidebar = true`
2. `SplitDropZone` becomes visible as a full-area overlay, intercepting all drag events
3. The drop event hits `SplitDropZone.handleDrop` which routes it to `handleChatDrop`
4. `handleChatDrop` only handled `application/quack-file` — it early-returned for skills
5. `setIsDraggingSidebar(false)` was placed AFTER the early return, so the overlay stayed stuck

Two bugs in one:
- **Skill drop ignored**: `handleChatDrop` only processed files
- **UI freeze**: `setIsDraggingSidebar(false)` never called for non-file drops

## Fix
1. Moved `setIsDraggingSidebar(false)` to the TOP of `handleChatDrop` (unconditional)
2. Added `application/quack-skill` handling in `handleChatDrop` using `pendingSkillMention` state
3. Added `pendingSkillMention` prop drilling: App.tsx -> ChatView.tsx -> ChatInput.tsx
4. Added `useEffect` in ChatInput.tsx to insert `@skill:{name}` when `pendingSkillMention` is set

## Files Changed
- `src/App.tsx`: `handleChatDrop`, `pendingSkillMention` state, prop passing to ChatView
- `src/components/ChatView.tsx`: prop types + passthrough
- `src/components/ChatInput.tsx`: prop types, destructuring, useEffect for skill mention insertion

## Breadcrumb
`// Brain: fix-skill-drop-overlay-intercept` in handleChatDrop (App.tsx) and useEffect (ChatInput.tsx)
