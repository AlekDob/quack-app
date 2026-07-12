---
type: feature
project: quack-desktop
created: 2026-07-12
last_verified: 2026-07-12
related: [054-works-layer.md, 066-works-cycles-stories.md, 061-plan-mode-tab.md, 022-chat-composer.md, 005-jack-duck-identity.md, 064-agent-hub-drawer-and-chat-tab-switch.md]
tags: [works, plan, story, jack, composer, claude-code, drawer, hover-peek]
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
| `enterPlanning(wsId, chatId, root, title?)` | Composer **Plan a feature** or CC plan mode with no story yet → `ensurePlanStory`, set `storyId` + `planning`, pin story drawer |
| `onNativePlanReady(..., storyId, planText)` | CC `ExitPlanMode` with plan body → `mergePlanIntoStory` |
| `approvePlanning(...)` | User approves plan → `approvePlanStory` (status `active`), clears `planning` |
| `exitPlanning(...)` | Exit planning without approve → clears `planning`, unlinks chat from story |
| `unlinkStoryFromChat` / `unlinkWorkFromChat` | Composer unlink; bidirectional `linkedChats` cleanup |

## Story plan drawer (hover soffietto)

Anchored to the **chat column** — not an editor split tab. Same peek model as Agent Hub (`064`): overlay, zero layout shift.

| State | Behaviour |
|---|---|
| **Strip** (44px) | Right edge of chat when `storyId` set; icon + vertical `S‑NNN` + `K/N` acceptance (`space-evenly` along strip height) |
| **Hover peek** | Panel **440px** overlays chat to the left |
| **Pinned** | Click strip or chevron in panel head; `storyPlanDrawerStore` per `wsId\|chatId` |
| **Open from menu** | Composer **Open story panel** → `pinStoryPlanDrawer` |

| File | Role |
|---|---|
| `src/components/StoryPlanDrawer.tsx` | Strip + peek panel; embeds `StoryPlanPane` (`embedded` — no duplicate header) |
| `src/storyPlanDrawerStore.ts` | In-memory pin state (`pin` / `unpin` / `toggle` / `subscribe`) |
| `src/components/AIChatPanel.tsx` | `.ai-chat-with-story` wrapper mounts drawer beside `.ai-panel` |
| `src/store.ts` | `openStoryPlan` → `pinStoryPlanDrawer` only (no `dropTabAt`) |

**Strip typography:** `writing-mode: vertical-rl` per label slot; non-breaking hyphen in `S‑NNN` so the id never wraps. Planning state tints id with `--warn`.

**Agent Mode:** drawer lives in the chat column; story no longer opens in `agent-main-review` side split.

### Legacy `story:` editor tab

`story:{wsId}|{chatId}|{storyId}` tabs still portal from `WorkspaceShell` / `TabContentHost` if present in a saved layout, but new opens never create them.

| File | Role |
|---|---|
| `src/components/StoryPlanPane.tsx` | Markdown body from `works/stories/S-NNN.md` via `worksWatch` |
| `src/storyPlanTab.ts` | Key parse/build |

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

**Segmented cluster** (Cursor-style): `S-003 › W-008` | `N docs` | `K/N` in one pill (`ai-composer-work-cluster`).

**Context docs chip** — `ComposerDocsChip.tsx`: hover popover (liquid glass) listing Brain refs by Feature / Story / Related / Added; file-type icons + basename + parent path. No full-screen overlay (prevents flicker); 280ms leave debounce; slight overlap with anchor. See `054-works-layer.md`.

CC plan mode auto-calls `enterPlanning` when chat has no `storyId`/`workItemId`.

## AIChatPanel wiring

| Event | Story-linked chat | Legacy (work-only / no story) |
|---|---|---|
| `onPlanReady` | `onNativePlanReady` → merge + refresh drawer | `openPlanTab` (`061`) |
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
  → pinStoryPlanDrawer → StoryPlanDrawer strip visible

Jack / CC proposes plan
  → CC ExitPlanMode → onNativePlanReady → mergePlanIntoStory
  → StoryPlanPane in drawer refreshes via worksWatch

User Approve
  → approvePlanning → story status active, planning false

"Start implementation"
  → createWorkFromStory → W-NNN + parentId
  → setAIChatWorkItem, composer S › W breadcrumb
```

## Related docs

- `061-plan-mode-tab.md` — ephemeral `plan:` tab (fallback when no story)
- `066-works-cycles-stories.md` — story entity + `S-NNN` files
- `054-works-layer.md` — composer work bar, docs chip, inject manifest
- `064-agent-hub-drawer-and-chat-tab-switch.md` — hover peek pattern this clones
- Bundled skill `quack-works` v8 — agent PM loop step 9

## Gotchas

- **TodoWrite ≠ plan** — session todos do not replace story acceptance on disk.
- **Story drawer is disk-backed** — survives restart; `plan:` stash does not (`061`).
- **Hover + pin** — peek alone is not enough for long reads; pin via strip click or panel chevron.
- **Docs popover** — no `ai-flag-menu-overlay` on hover; overlay caused flicker crossing the gap to the popover.
- **Jack default** — `enterPlanning` resets composer to Jack (`onPickJack`); other agents execute linked work.
- **Legacy path** — chats with `workItemId` + `origin: plan` but no `storyId` still use `PlanPane` + `approvePlanWork` until migrated manually.
