# Session ID Display Feature

## Overview

Adds a clickable session ID display in chat message headers that allows users to quickly copy Claude session IDs to the clipboard. The session ID is shown in a truncated format with the full ID visible on hover.

## Implementation Date

2026-01-08

## Components

### SessionIdDisplay Component

**Location:** `/src/components/SessionIdDisplay.tsx`

**Purpose:** Reusable component that displays a truncated session ID with click-to-copy functionality.

**Features:**
- Truncates session ID to first 8 characters + "..." for display
- Shows full session ID in tooltip on hover
- Click to copy full session ID to clipboard
- Visual feedback with checkmark icon when copied
- Toast notification on successful copy
- Subtle styling that doesn't distract from the main content

**Props:**
```typescript
interface SessionIdDisplayProps {
  sessionId: string;
  className?: string; // Optional custom classes
}
```

**Usage:**
```tsx
<SessionIdDisplay sessionId="abc123def456..." />
```

### Styling

**Location:** `/src/components/SessionIdDisplay.css`

**Design:**
- Small, monospace font (10px)
- Muted secondary color by default
- Subtle border and background on hover
- Green accent when copied (matches success color)
- Smooth transitions for all interactions
- Compact variant available for tight spaces

## Integration

### ChatMessage Component

**Modified:** `/src/components/ChatMessage.tsx`

Added session ID display to assistant message headers:
- Only shown for assistant messages (not user messages)
- Positioned after the MessageSettingsBadges
- Receives `currentSessionId` prop from parent

### MessageList Component

**Modified:** `/src/components/MessageList.tsx`

Passes session ID down to individual chat messages:
- Added `currentSessionId` prop to interface
- Forwards the prop to each `ChatMessage` component

### ChatView Component

**Modified:** `/src/components/ChatView.tsx`

Receives session ID from parent (App.tsx):
- Added `currentSessionId` prop to interface
- Passes it down to `MessageList`

### App.tsx Integration

**Modified:** `/src/App.tsx`

Provides session ID from `chatSessionIds` Map:
- For regular agent chats: `chatSessionIds.get(activeId)`
- For Kanban task chats: `activeTask?.sessionId`
- Session ID is undefined for new conversations (not yet initialized)

## Data Flow

```
useClaudeChat hook (stores sessionId in ref)
         ↓
App.tsx (chatSessionIds Map)
         ↓
ChatView (currentSessionId prop)
         ↓
MessageList (currentSessionId prop)
         ↓
ChatMessage (currentSessionId prop)
         ↓
SessionIdDisplay (renders and handles copy)
```

## User Experience

1. **Visibility:** Session ID appears in the header of every assistant message
2. **Truncation:** Shows first 8 characters + "..." to save space
3. **Hover:** Full session ID shown in native browser tooltip
4. **Click:** Copies full session ID to clipboard
5. **Feedback:**
   - Checkmark icon replaces chat bubble icon
   - Toast notification: "Session ID copied to clipboard"
   - Visual state change with green accent color
6. **Auto-reset:** Copied state resets after 2 seconds

## Testing

**Location:** `/src/components/SessionIdDisplay.test.tsx`

**Test Coverage:**
- ✓ Renders truncated session ID (first 8 chars + "...")
- ✓ Shows full session ID in title attribute
- ✓ Copies session ID to clipboard on click
- ✓ Shows checkmark icon when copied
- ✓ Handles short session IDs without truncation
- ✓ Applies custom className

**Run tests:**
```bash
npm test -- SessionIdDisplay.test.tsx
```

## Technical Details

### Session ID Source

The session ID comes from the Claude Agent SDK and is captured in the `useClaudeChat` hook:
- Stored in `claudeSessionId.current` ref
- Captured from `system.init` event during streaming
- Persisted across conversation for resume functionality

### State Management

- **Agent chats:** `chatSessionIds` Map in App.tsx (key: agentId, value: sessionId)
- **Kanban tasks:** `sessionId` field in KanbanTask object
- **New conversations:** Session ID is undefined until first message completes

### Copy Mechanism

Uses the standard Clipboard API:
```typescript
await navigator.clipboard.writeText(sessionId);
```

Includes error handling with toast notification if copy fails.

## Design Decisions

### Why truncate?
- Full session IDs are long (~40 characters)
- Truncation saves horizontal space in the header
- First 8 characters are sufficient for quick visual identification
- Full ID available on hover and via copy

### Why click-to-copy?
- Most common use case is copying for debugging/support
- One-click action is faster than select + copy
- Consistent with existing patterns in Kanban cards

### Why in the header?
- Always visible when scrolling through messages
- Natural location next to other message metadata
- Doesn't interfere with message content

### Why only assistant messages?
- Session ID is associated with Claude's responses
- User messages don't generate session IDs
- Reduces visual clutter

## Future Enhancements

Possible improvements:
1. **Session details drawer:** Click session ID to open detailed view
2. **Session history:** Show all messages in a session across tabs
3. **Session export:** Download entire session as JSON/Markdown
4. **Session resume:** Click to resume session in new terminal
5. **Session sharing:** Generate shareable link to session details

## Accessibility

- ✓ Semantic button element with proper ARIA
- ✓ Keyboard accessible (can be focused and activated)
- ✓ Clear hover states
- ✓ Descriptive title attribute for screen readers
- ✓ Visual feedback for all states

## Performance

- Lightweight component (~100 lines)
- No heavy dependencies
- Efficient re-renders (only on sessionId change)
- CSS transitions for smooth animations

## Browser Compatibility

Requires:
- Clipboard API support (modern browsers)
- CSS custom properties (modern browsers)
- Native tooltip support (all browsers)

Fallback: If Clipboard API fails, shows error toast

## Related Documentation

- [Chat View Architecture](../01-architecture.md#chat-view)
- [useClaudeChat Hook](../../src/hooks/useClaudeChat.ts)
- [Claude Agent SDK Integration](../04-build-setup/claude-agent-sdk-upgrade-0.2.1.md)

## File Changes

### New Files
- `src/components/SessionIdDisplay.tsx` - Main component
- `src/components/SessionIdDisplay.css` - Styles
- `src/components/SessionIdDisplay.test.tsx` - Tests
- `docs/05-features/session-id-display.md` - This document

### Modified Files
- `src/components/ChatMessage.tsx` - Added SessionIdDisplay import and rendering
- `src/components/MessageList.tsx` - Added currentSessionId prop
- `src/components/ChatView.tsx` - Added currentSessionId prop
- `src/App.tsx` - Pass sessionId from chatSessionIds Map
