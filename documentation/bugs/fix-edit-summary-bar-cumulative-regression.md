---
type: bug
project: quack-app
created: 2026-04-03
last_verified: 2026-04-03
tags: [edit-summary-bar, file-edits, per-turn, regression]
---

# Fix: EditSummaryBar showing cumulative edits instead of per-turn

## Symptom
The EditSummaryBar (inline in chat, below the message list) shows ALL file edits from the entire session instead of just the files modified in the last assistant turn. This makes it impossible to see what changed in the most recent response.

## Root Cause
Commit `283ef86` ("changes panel all-messages scan") changed the `useMemo` in `ChatView.tsx` from scanning only `lastAssistantMessage` to scanning ALL assistant messages. This was necessary to fix the ChangesPanel (sidebar) which was losing files on session restore/tab switch. But EditSummaryBar inherited the cumulative behavior as collateral damage.

## Fix
Refactored the `useMemo` to compute **two separate sets**:
- `allFileEdits` / `allFileDeletes` — scans ALL assistant messages → feeds `onEditsChange` → ChangesPanel (cumulative)
- `lastTurnFileEdits` / `lastTurnFileDeletes` — scans ONLY the last assistant message → feeds EditSummaryBar (per-turn)

Extracted scanning logic into reusable `scanMessagesForEdits()` helper to avoid code duplication.

## Files Changed
- `src/components/ChatView.tsx` — dual tracking useMemo + helper extraction

## Breadcrumb
`// Brain: fix-changes-panel-all-messages` (updated comment in ChatView.tsx)
