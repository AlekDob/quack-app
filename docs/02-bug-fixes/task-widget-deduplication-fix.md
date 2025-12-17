# TaskWidget Deduplication Fix

**Date**: 2025-12-17
**Issue**: TaskWidget not appearing for droids invoked with @mention
**Status**: Fixed

## Problem Description

When users invoked droids using `@droid-name` syntax, the TaskWidget (visual feedback showing which droid is running) would intermittently fail to appear in the chat stream.

**Symptoms**:
- Droid was successfully invoked (visible in terminal logs)
- Droid produced output correctly
- But the TaskWidget UI component did not render
- Issue was intermittent and not tied to specific droids

## Root Cause Analysis

The bug was in the **event deduplication logic** that prevents duplicate events from rendering multiple times.

### The Deduplication System

Quack has 3 layers of event deduplication to prevent duplicate messages:
1. `src/services/claudeSDK.ts` - SDK level
2. `src/hooks/useClaudeChat.ts` - App level
3. `src/components/ChatMessage.tsx` - Render level

Each layer generates an **event ID** based on event content to detect duplicates.

### The Bug

The event ID generation for `tool_use` blocks was using only:
- `block.type` (e.g., "tool_use")
- `block.name` (e.g., "Task")

**Missing**: `block.id` - the unique tool invocation ID from the SDK

```typescript
// BUG: Same ID generated for different Task tools
const contentHash = event.message?.content
  ?.map((b: any) => `${b.type}-${b.name || ''}`)  // Both @hiroshi and @kaori = "tool_use-Task"
  .join('|') || '';
```

### Why It Was Intermittent

- **Single droid**: Always worked (first event is unique)
- **Multiple droids in same message**: Second+ droids got same ID → filtered as duplicates
- **Multiple droids in separate messages**: Worked (different message.id used first)

## The Fix

Include `tool_use.id` in the event hash for tool_use blocks:

### File 1: `src/hooks/useClaudeChat.ts`

```typescript
const contentHash = event.message?.content
  ?.map((b: any) => {
    let id = `${b.type}-${b.text?.substring(0, 20) || b.name || ''}`;
    // Include tool_use.id to ensure unique IDs for each tool invocation
    if (b.type === 'tool_use' && b.id) {
      id += `-${b.id}`;
    }
    return id;
  })
  .join('|') || '';
```

### File 2: `src/services/claudeSDK.ts`

Same pattern applied to the SDK-level deduplication.

## Testing

New test cases added to `src/tests/eventDeduplication.test.ts`:

1. **Multiple Task tools with different subagent_types**: Verifies unique IDs generated
2. **Separate Task tool events**: Verifies different events get different IDs
3. **Stream with multiple droids**: Verifies all droids render (not deduplicated)
4. **Identical Task events**: Verifies true duplicates still get deduplicated

Run tests:
```bash
npm test -- --grep "Task Tool"
```

## Files Modified

1. `src/hooks/useClaudeChat.ts` - Event ID generation fix
2. `src/services/claudeSDK.ts` - Event ID generation fix
3. `src/tests/eventDeduplication.test.ts` - New test cases

## Verification

After the fix:
1. Invoke multiple droids: `@hiroshi @kaori do something`
2. Both TaskWidget components should appear
3. No "DUPLICATE DETECTED" warnings for different droids
4. True duplicates (same event arriving twice) should still be filtered

## Related Components

- `src/components/TaskWidget.tsx` - The visual component that renders droid invocations
- `src/components/StreamMessage.tsx` - Renders TaskWidget when `toolName === 'task' && input?.subagent_type`
