---
type: gotcha
tags: [tauri, webview, window-confirm, modal, ux]
created: 2026-02-17
---

# window.confirm() is Unreliable in Tauri WebView

## Problem

`window.confirm()` does not block the JavaScript event loop reliably in Tauri's WebView (WKWebView on macOS, WebView2 on Windows). This causes the UI to behave as if the user already confirmed before they actually interact with the dialog — resulting in items being deleted before the confirmation dialog is answered.

## Root Cause

Tauri uses platform-native WebView engines, not Chromium. WKWebView on macOS handles synchronous JS dialogs (`alert`, `confirm`, `prompt`) differently from Chrome/Firefox — they may not fully block the JS thread, allowing React state updates and re-renders to proceed.

## Solution

Replace all `window.confirm()` calls with a React-based `ConfirmModal` component:

```typescript
// BAD — unreliable in Tauri WebView
const handleDelete = async (item: Item) => {
  const confirmed = window.confirm(`Delete "${item.name}"?`);
  if (!confirmed) return;
  await deleteItem(item); // May execute before user responds!
};

// GOOD — React modal, fully controlled
const [itemToDelete, setItemToDelete] = useState<Item | null>(null);

const handleDelete = (item: Item) => {
  setItemToDelete(item); // Just show modal, don't delete yet
};

const handleConfirmDelete = async () => {
  if (!itemToDelete) return;
  await deleteItem(itemToDelete);
  setItemToDelete(null);
};
```

## Affected Components

- `RulesPanel.tsx` — rule deletion (fixed 2026-02-17)
- `AgentsPanel.tsx` — droid deletion (implemented with ConfirmModal from start)

## Key File

`src/components/ConfirmModal.tsx` — reusable confirmation modal for all destructive actions.

## Rule

Never use `window.confirm()`, `window.alert()`, or `window.prompt()` in Tauri apps. Always use React-based modals.
