---
type: gotcha
project: quack-app
created: 2026-03-11
last_verified: 2026-03-11
tags: [rewind, duplicate, stream-message, file-checkpoint]
---
# Rewind already exists in StreamMessage — don't re-implement

## Trigger
Any spec or task asking to implement "Rewind UI", "file checkpoint timeline", or "undo file changes".

## Problem
Spec-004 (SDK Updates 2026) defined Rewind as a new feature (Phase 4) with:
- `useFileCheckpoints.ts` hook
- `RewindTimeline.tsx` sidebar
- `RewindPreviewModal.tsx` modal

These were implemented but are **duplicates**. The rewind system already exists:

## Existing implementation
- **`StreamMessage.tsx`** — "Undo" button (`div.tool-rewind-row > button.rewind-button`) appears inline on every assistant message that has file changes
- **`src/services/claudeSDK.ts`** — `rewindFiles(sessionId, userMessageId, dryRun)` invokes `rewind_files` Tauri command
- **`src-tauri/node-sdk/rewind-files.js`** — Node.js script that calls SDK's file rewind API

## Action
The spec-004 Rewind components should be removed:
- `src/hooks/useFileCheckpoints.ts` — dead code
- `src/components/rewind/RewindTimeline.tsx` — dead code
- `src/components/rewind/RewindPreviewModal.tsx` — dead code
- Remove imports and integration from `ChatView.tsx`
