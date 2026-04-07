---
type: bug
project: quack-app
created: 2026-04-07
last_verified: 2026-04-07
tags: [snippets, state-sync, useSnippets]
---
# fix-snippet-modal-stale-tags

## Symptom
After creating/editing snippets in SnippetModal, typing the tag in ChatInput does nothing. App restart fixes it.

## Root Cause
`useSnippets()` hook uses local `useState` — each component gets an independent copy. `SnippetModal` and `ChatInput` both call `useSnippets()`, creating two separate snippet lists. When the modal creates a snippet, only its own state updates; `ChatInput`'s list stays stale.

## Fix
Added `refreshSnippets()` call in `ChatInput` when `showSnippetPopover` transitions from `true` to `false`. Uses a `useRef` to track the previous value and triggers reload from Rust backend on modal close.

## Files Changed
- `src/components/ChatInput.tsx` — destructure `refresh` from `useSnippets()`, added `useEffect` with `prevShowSnippetRef`

## Prevention
If `useSnippets` is ever used in more than 2 components simultaneously, consider migrating to a Zustand store for shared state.
