---
type: pattern
created: 2026-02-09
tags: [agent-bundles, notifications, ux, animations]
---

# Pattern: Bundle Export/Import Success Notification

## Overview

After successfully exporting or importing an agent bundle (`.quack` file), show a temporary success notification with auto-dismiss animation. No user action required -- message fades out after 3 seconds.

## Implementation

### 1. Hook State (`useBundleOperations.ts`)

Added `success` string to state. Set success after operation, clear with setTimeout after 3000ms.

### 2. Component UI (`AgentPersonalityCard.tsx`)

Extract `success` from hook and render `.bundle-success-compact` div below buttons.

### 3. CSS Animation (`AgentPersonalityCard.css`)

Cyan notification (`#00D9FF`) with `bundleFadeInOut` keyframe animation: fade in 0-450ms, visible 450-2250ms, fade out 2250-3000ms.

## Design Decisions

- **Auto-dismiss**: Export/import are quick actions, no action needed after success
- **3 seconds**: Long enough to read, short enough to not feel slow
- **Cyan color**: Matches Quack brand color, different from error red
- **Same position as error**: Reduces layout shift

## Files Modified

1. `src/hooks/useBundleOperations.ts` -- success state + timeouts
2. `src/components/AgentPersonalityCard.tsx` -- extract success + render div
3. `src/components/AgentPersonalityCard.css` -- success style + keyframe
