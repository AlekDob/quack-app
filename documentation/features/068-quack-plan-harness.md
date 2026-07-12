---
type: feature
project: quack-desktop
created: 2026-07-12
last_verified: 2026-07-12
related: [054-works-layer.md, 066-works-cycles-stories.md, 061-plan-mode-tab.md, 022-chat-composer.md, 005-jack-duck-identity.md]
tags: [works, plan, story, jack, composer, claude-code, virtual-tab]
---

# 068 — Quack Plan harness

**Purpose:** Product-owned planning where the **user story (`S-NNN`) on disk** is the durable plan artifact — not ephemeral Claude Code plan RAM, not agent TodoWrite checklists. Jack PM is the default planner; any agent can execute linked work (`W-NNN`). CC `permMode: plan` + `ExitPlanMode` are optional adapters that merge into the story.

## Mental model

| Layer | Artifact | Lifetime |
|---|---|---|
| **Story** (`S-NNN`) | Acceptance checklist + narrative in `works/stories/S-NNN.md` | Durable, git-tracked |
| **Work** (`W-NNN`) | Execution task; `parentId` → story | Durable |
| **Agent TodoWrite** | Session breakdown in chat | Ephemeral — not the plan |
| **CC `plan:` tab** (`061`) | In-memory stash when chat has **no** `storyId` | Fallback only |

## Chat descriptor fields

On `AIChatDescriptor` (`store.ts`):

| Field | Meaning |
|---|---|
| `storyId` | FK to `WorkStory.id` while planning or story-linked |
| `planning` | `true` while Jack/CC plan mode is active on this chat |
| `workItemId` | FK to work item when implementing (`W-NNN`) |

Persisted with chat session; restored on app reload.

## Harness API (`quackPlanHarness.ts`)

| Function | When |
|---|---|
| `enterPlanning(wsId, chatId, root, title?)` | Composer **Plan a feature** or CC plan mode with no story yet → `ensurePlanStory`, set `storyId` + `planning`, open `StoryPlanPane` |
| `onNativePlanReady(..., storyId, planText)` | CC `ExitPlanMode` with plan body → `mergePlanIntoStory` |
| `approvePlanning(...)` | User approves plan → `approvePlanStory` (status `active`), clears `planning` |
| `exitPlanning(...)` | Exit planning without approve → clears `planning`, unlinks chat from story |
| `unlinkStoryFromChat` / `unlinkWorkFromChat` | Composer unlink; bidirectional `linkedChats` cleanup |

## Story plan panel (Cursor-style)

Virtual tab key (`storyPlanTab.ts`):

```
story:{wsId}|{chatId}|{storyId}
```

| File | Role |
|---|---|
| `src/components/StoryPlanPane.tsx` | Reads `works/stories/S-NNN.md` live via `worksWatch` |
| `src/storyPlanTab.ts` | `storyPlanKey`, `parseStoryPlanKey` |
| `WorkspaceShell.tsx`, `TabContentHost.tsx`, `PaneNode.tsx`, `AgentModeShell.tsx` | Portal + tab label ("Story plan") |

`openStoryPlanTab` forces split-right (same rationale as `061` plan tab).

## Plan merge (`planStoryMerge.ts`)

CC / pasted plan markdown → story body sections + `- [ ]` acceptance lines (`mergePlanIntoStory` in `worksCache.ts`).

## Composer (`ComposerWorkBar.tsx`)

Intent-first work menu:

| Action | Result |
|---|---|
| **Plan a feature** | `enterPlanning`, Jack picker, planning chip CSS |
| **Hotfix** | Work only (`W-NNN`), no story required |
| **Blank task** | Empty work link |
| Planning submenu | Open story panel, Start implementation, Exit planning |

Breadcrumb chip: `S-003` or `S-003 › W-008`. Chips: **N docs** (refs), **K/N** acceptance progress.

CC plan mode auto-calls `enterPlanning` when chat has no `storyId`/`workItemId`.

## AIChatPanel wiring

| Event | Story-linked chat | Legacy (work-only / no story) |
|---|---|---|
| `onPlanReady` | `onNativePlanReady` → merge + `StoryPlanPane` | `openPlanTab` (`061`) |
| `onPlanApproved` | `approvePlanning` | `approvePlanWork` (old plan-draft flow) |

Context inject (`worksTurnContext.ts`):

- `buildStoryTurnContext` when only `storyId`
- `buildSiblingSummaries` for other chats in `linkedChats` on the same story
- Work manifest unchanged when `workItemId` set (includes parent story path)

## Mentions + hub

- `@S-NNN` in composer (`MentionSuggestions.tsx`) links chat to story
- `WorkHubBadge` on `AIChatsRail`: `S-003 › W-008` or story-only when `planning`

## Story frontmatter `linkedChats`

Bidirectional link: chat descriptor `storyId` ↔ story `.md` `linkedChats: [<chatId>]`. Unlink removes from both sides (`linkChatToStory`, `unlinkChatFromStory` in `worksCache.ts`).

## Data flow

```
Composer "Plan a feature" OR CC permMode plan (no story yet)
  → enterPlanning → ensurePlanStory → S-NNN draft on disk
  → setAIChatStory + setAIChatPlanning
  → openStoryPlanTab (split right)

Jack / CC proposes plan
  → CC ExitPlanMode → onNativePlanReady → mergePlanIntoStory
  → StoryPlanPane refreshes via worksWatch

User Approve
  → approvePlanning → story status active, planning false

"Start implementation"
  → createWorkFromStory → W-NNN + parentId
  → setAIChatWorkItem, composer S › W breadcrumb
```

## Related docs

- `061-plan-mode-tab.md` — ephemeral `plan:` tab (fallback when no story)
- `066-works-cycles-stories.md` — story entity + `S-NNN` files
- `054-works-layer.md` — composer work bar, inject manifest, hub badge
- Bundled skill `quack-works` v8 — agent PM loop step 9

## Gotchas

- **TodoWrite ≠ plan** — session todos do not replace story acceptance on disk.
- **Story panel is disk-backed** — survives restart; `plan:` stash does not (`061`).
- **Jack default** — `enterPlanning` resets composer to Jack (`onPickJack`); other agents execute linked work.
- **Legacy path** — chats with `workItemId` + `origin: plan` but no `storyId` still use `PlanPane` + `approvePlanWork` until migrated manually.
