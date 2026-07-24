---
type: bug-report
project: quack-desktop
created: 2026-07-24
status: fixed
related:
  - 088-plan-milo-handoff.md
  - 084-agent-context-panels.md
  - 061-plan-mode-tab.md
tags: [plan-mode, cross-session, agent-mode, planBuyInStore]
---

## Plan ready card leaked across Agent Mode sessions

**Symptom:** After ExitPlanMode in chat A (e.g. Price Guard / “010 - orders
module”), switching to chat B in the same project (e.g. `/graphify`) still showed
A’s **Plan ready** card above the composer and A’s plan markdown in the right
**Plan** tab.

**Root cause:** `getPlanBuyIn({ sessionId, cwd })` fell back to “any pending
buy-in with this workspace cwd” when the active chat’s Claude session id missed
or differed. All Agent Mode chats share one project root → every session saw A’s
plan.

**Fix (2026-07-24):**
| Change | Detail |
|---|---|
| Ownership key | Quack `chatId` → `chat:{id}` (dual-index `s:{sessionId}` when both set) |
| Lookup | `chatId` → `sessionId` only — **no cwd match** |
| Publish sites | `AIChatPanel` stream + end-of-turn; overlay with `ownerChatId` |
| Consumers | `AIChatPanel` (`aiChatId`); `AgentContextColumn` (`activeChatId`) |
| Decide map | Keyed by chatId/session — dropped “any decide” last resort |

**Regression:** `src/planBuyInStore.test.ts` — sibling chatId + shared cwd must
stay null.

**Files:** `src/planBuyInStore.ts`, `AIChatPanel.tsx`, `ClaudePermissionOverlay.tsx`,
`AgentContextColumn.tsx`, features `088` / `084` / `061`.
