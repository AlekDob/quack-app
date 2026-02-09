---
type: pattern
project: quack-app
created: 2026-02-09
tags: [agent-bundles, notifications, ux, animations]
---

# Pattern: Bundle Export/Import Success Notification

## Overview

After successfully exporting or importing an agent bundle (`.quack` file), show a temporary success notification with auto-dismiss animation. No user action required — message fades out after 3 seconds.

## Implementation

### 1. Hook State (`useBundleOperations.ts`)

Added `success` string to state:

```typescript
interface BundleOperationsState {
  exporting: boolean;
  importing: boolean;
  error: string | null;
  success: string | null;  // NEW
}
```

Set success after successful operation:

```typescript
// Export success (line 138)
await invoke('write_binary_file', { path: savePath, data: Array.from(zipData) });
setState((prev) => ({ ...prev, exporting: false, success: 'Agent bundle exported successfully' }));
setTimeout(() => setState((prev) => ({ ...prev, success: null })), 3000);

// Import success (line 226)
saveAgent({ ... });
setState((prev) => ({ ...prev, importing: false, success: 'Agent bundle imported successfully' }));
setTimeout(() => setState((prev) => ({ ...prev, success: null })), 3000);
```

### 2. Component UI (`AgentPersonalityCard.tsx`)

Extract `success` from hook and render below buttons:

```typescript
const { exporting, importing, error, success, exportAgent, importBundle, clearError } = useBundleOperations();

return (
  {error && (
    <div className="bundle-error-compact" onClick={clearError}>
      {error}
    </div>
  )}
  {success && (
    <div className="bundle-success-compact">
      {success}
    </div>
  )}
);
```

### 3. CSS Animation (`AgentPersonalityCard.css`)

Cyan notification with fade-in/out keyframe:

```css
.bundle-success-compact {
  margin-top: 4px;
  padding: 3px 6px;
  font-size: 9px;
  color: #00D9FF;
  background: rgba(0, 217, 255, 0.1);
  border-radius: 3px;
  animation: bundleFadeInOut 3s ease-in-out forwards;
}

@keyframes bundleFadeInOut {
  0% { opacity: 0; transform: translateY(-2px); }
  15% { opacity: 1; transform: translateY(0); }
  75% { opacity: 1; }
  100% { opacity: 0; }
}
```

## Timing Breakdown

- **0-450ms**: Fade in + slide up
- **450-2250ms**: Fully visible (1.8s)
- **2250-3000ms**: Fade out
- **After 3000ms**: State cleared, element removed from DOM

## Design Decisions

### Why auto-dismiss?
- Export/import are quick actions (1-2s total)
- User already sees file save dialog as feedback
- No action needed after success — just confirmation
- Persistent notifications would clutter compact sidebar UI

### Why 3 seconds?
- Long enough to read (2 words = ~500ms read time + 1.3s buffer)
- Short enough to not feel slow
- Standard for "success toast" patterns (2-4s range)

### Why cyan color?
- Matches Quack brand color (`#00D9FF`)
- Different from error red (`#ff6b6b`) — clear visual distinction
- Consistent with "Get" button and active states in Quack Store

### Why same position as error?
- Reduces layout shift (both occupy same space, never shown together)
- User expects feedback in same location
- Compact sidebar has limited real estate

## User Experience Flow

1. User clicks "Export" button
2. Native save dialog appears → user chooses location
3. Export completes (100-500ms)
4. Success message fades in below buttons
5. Message stays visible for 1.8s
6. Message fades out
7. Message removed from DOM

## Files Modified

1. `src/hooks/useBundleOperations.ts` — +3 lines (success state + timeouts)
2. `src/components/AgentPersonalityCard.tsx` — +5 lines (extract success + render div)
3. `src/components/AgentPersonalityCard.css` — +15 lines (success style + keyframe)

Total: 23 lines added.

## Future Enhancements (Not Implemented)

- Sound effect on success (optional user preference)
- Show file path in success message (but would be too long for compact UI)
- Global toast system (overkill for single use case)
- Undo import action (complex, requires state rollback)

## Related Patterns

- Error notification: `.bundle-error-compact` (red, dismissible with click, no timeout)
- Install success in Quack Store: No notification yet (could use similar pattern)
- Terminal command success: No visual feedback (just output in terminal)
