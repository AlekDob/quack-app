---
type: feature
project: quack-app
created: 2026-04-07
status: active
tags: [snippets, chat-input, productivity]
---
# 050 - Prompt Snippets

## Overview
Reusable text snippets with dynamic variable expansion. Users create snippets with a tag, then type the tag in the chat input to auto-expand the content.

## Key Files
- `src/components/SnippetModal.tsx` — CRUD modal for managing snippets
- `src/components/SnippetPopover.tsx` — Alternative popover UI (anchored to button)
- `src/hooks/useSnippets.ts` — Hook: CRUD via Tauri invoke, variable expansion, tag detection
- `src/components/ChatInput.tsx` — Tag detection + auto-expand on input change and Tab key
- `src/services/shortcutsStorage.ts` — Persistence layer (referenced)

## Architecture
- **Storage**: Rust backend via Tauri commands (`list_snippets`, `create_snippet`, `update_snippet`, `delete_snippet`, `search_snippets`, `get_snippet_by_tag`, `import_snippets`, `export_snippets`)
- **State**: `useSnippets()` hook uses local `useState` per instance (not a shared store). Each component calling the hook gets independent state.
- **Tag expansion**: Two paths:
  1. **Auto-expand on input change** (`tryAutoExpandSnippet`) — fires on every keystroke, matches current word against snippet tags
  2. **Tab key expansion** (`handleKeyDown` Tab handler) — explicit trigger via Tab when cursor is on a tag word

## Dynamic Variables
`{date}`, `{time}`, `{datetime}`, `{clipboard}`, `{cursor}`, `{project}`, `{branch}`, `{username}`

## Known Gotcha
`useSnippets()` creates independent state per instance. When `SnippetModal` creates/edits snippets, `ChatInput`'s instance doesn't see the changes until refresh. Fixed by calling `refreshSnippets()` when the modal closes (see `fix-snippet-modal-stale-tags`).
