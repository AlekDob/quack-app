---
type: gotcha
project: quack-app
created: 2026-02-24
last_verified: 2026-02-24
tags: [macos, notification, toast, sendNotification, focus, stale-closure]
---

# Gotcha: macOS Native Notifications Invisible When App Is in Focus

## Trigger

Using `sendNotification()` from `@tauri-apps/plugin-notification` to alert the user about events that happen while the app is open (e.g., AskUserQuestion, PlanApproval).

## Problem

macOS suppresses native notification banners when the originating app is in the foreground. Since the user is typically looking at Quack when an agent asks a question or needs plan approval, the native notification is never shown.

Additionally, global Tauri event listeners set up in `useEffect` capture state variables (like `agentChats`) at setup time. If these variables change later, the listener still has the stale initial value — a classic React stale closure problem.

## Rule

**Always pair `sendNotification()` with `showProjectToast()`** for any event that may fire while the user is actively using the app. The in-app toast is always visible regardless of OS focus state.

For agent context inside global listeners, **use refs** (`terminalsRef`) instead of state variables (`agentChats`, `terminals`) to avoid stale closures.

## Pattern

```typescript
// In global useEffect listeners:
const terminal = terminalsRef.current.find((t) => t.id === agentId);
const agentName = terminal?.label || 'Agent';

// 1. In-app toast (always visible)
showProjectToast({
  projectName,
  projectColor: '#FF6B35',
  agentName,
  agentAvatar,
  message: 'Needs your input',
  type: 'warning',
}, 8000);

// 2. Native notification (visible when app is NOT in focus)
await sendNotification({
  id: Number(Date.now() % 2147483647),
  title: `${agentName} needs your input`,
  body: 'The agent has a question for you',
});
```

## Affected Areas

- `App.tsx` — global listeners for `ask-user-question` and `plan-approval-request`
- Any future global listener that needs to notify the user of agent events

## See Also

- `fix-notification-badge-on-app-startup.md` — related notification bug at startup
- `bug-duplicate-plan-approval.md` — plan mode re-entry bug fixed in same session
