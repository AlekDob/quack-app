---
type: pattern
project: quack-app
created: 2026-02-24
last_verified: 2026-02-24
tags: [tab, ui, singleton, hooks, architecture]
---

# Tab System - Singleton Hook Pattern

## Overview

Quack uses a consistent pattern for adding new tab types (like Kanban, Automation, Brain). Each tab type follows the same architecture.

## The Pattern

### 1. Add tab type to TabBar union

In `src/components/TabBar.tsx`, add the new type to the tab type union.

### 2. Create singleton hook: `useXxxTab`

```ts
// src/hooks/useXxxTab.ts
// Singleton hook that returns openXxxTab() and isXxxTab()
// Follows the exact same shape as useKanbanTab
```

The hook provides:
- `openXxxTab()` — opens or focuses the tab
- `isXxxTab(tab)` — type guard to check if a tab is this type

### 3. Create tab view wrapper: `XxxTabView`

```tsx
// src/views/XxxTabView.tsx
// Thin wrapper that receives tab props and renders XxxView
```

### 4. Create main view: `XxxView`

```tsx
// src/components/xxx/XxxView.tsx
// The actual UI content of the tab
```

### 5. Integrate in App.tsx

- Import the singleton hook
- Create handler function
- Pass to ActionIcons (toolbar button)
- Render in tab content area with conditional

### 6. Add keyboard shortcut

In `src/services/shortcutsStorage.ts`, add default shortcut (e.g., Cmd+K for Kanban, Cmd+J for Automation).

### 7. Add ActionIcons button

In `src/components/ActionIcons.tsx`, add SVG icon with optional badge (e.g., running count).

## Existing Implementations

| Tab | Hook | Shortcut | Icon |
|-----|------|----------|------|
| Kanban | `useKanbanTab` | Cmd+K | Board icon |
| Automation | `useAutomationTab` | Cmd+J | Clock icon |

## Why Singleton

The hook is a singleton to ensure only one instance of the tab exists. Opening the tab again focuses the existing one instead of creating a duplicate.
