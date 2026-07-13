---
type: feature
project: quack-desktop
created: 2026-07-12
last_verified: 2026-07-13
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
| `enterPlanning(wsId, chatId, root, title?)` | Composer **Plan a feature** (explicit) → `ensurePlanStory`, set `storyId` + `planning`, pin story drawer |
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
| **Link existing…** | `ComposerWorkLinkPanel` — searchable stories + work items (`linkStoryToChat`, `linkWorkToChat`) |
| Planning submenu | Open story panel, Start implementation, Exit planning, switch linked work/story |

**Segmented cluster** (Cursor-style): `S-003 › W-008` | `N docs` | `K/N` in one pill (`ai-composer-work-cluster`).

**Link panel** — when the chat has no `workItemId` / `storyId`, the Work chip menu offers **Link existing…** → portaled `ComposerWorkLinkPanel` (`.ai-composer-ctx-menu--work-link`): filter by id/title, pick story or work item, excludes current link. When already linked, menu can switch to another ticket.

**Context docs chip** — `ComposerDocsChip.tsx`: hover popover (liquid glass) listing Brain refs by Feature / Story / Related / Added; file-type icons + basename + parent path. Opens via `openBrainRef` (`070`). No full-screen overlay (prevents flicker); 280ms leave debounce; slight overlap with anchor. See `054-works-layer.md`.

CC plan mode no longer auto-calls `enterPlanning` — story opens only via **Plan a feature** or explicit `linkedChats` / `@S-NNN`.

## Explicit planning gate (2026-07-13)

**Problem:** A fresh Jack chat could open with `S-NNN` "Untitled plan" and the story drawer before the user said anything — felt like Jack always started in PM mode.

**Root causes (fixed):**

| Trigger (removed / narrowed) | What it did |
|---|---|
| `ComposerWorkBar` `useEffect` on `ccPermMode === "plan"` | On new chat with Jack configured for CC Plan mode → immediate `enterPlanning` |
| `worksChatAutoLink` orphan import for **draft** stories | Jack writes `works/stories/S-NNN.md` → auto-linked to focused/working chat → drawer + planning chip |

**Intended behaviour now:**

| Situation | Story / drawer |
|---|---|
| New chat, quick Q&A, hotfix, exploration | No story; chat-only |
| User clicks **Plan a feature** | `enterPlanning` → draft `S-NNN` + drawer |
| User `@S-NNN` or picks story in link panel | `linkStoryToChat`; `planning` only if story `status === "draft"` |
| Agent sets `linkedChats: [<chatId>]` in story frontmatter | Mirrored on save (`syncLinkedChatsToStore`) |
| Jack creates draft story on disk without `linkedChats` | **Not** auto-linked — stays orphan until explicit link |
| Jack creates `W-NNN` on disk (no `linkedChats`) | Still auto-links to focused/working chat |
| CC Plan mode without `storyId` | Native CC plan behaviour; `ExitPlanMode` → legacy `plan:` tab (`061`) or merge if story already linked |

**Jack system prompt** (`brainPrompt.ts`) and bundled **`quack-works`** skill both state: do not create stories at conversation start; plan only when scope is multi-step and planning is agreed.

**CC Plan vs Quack Plan:** CC `permMode: plan` is an optional CLI adapter. It no longer implies a Quack story artifact. Decouple: user can run CC in plan mode for a one-off design discussion without spawning `S-NNN`.

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

### Auto-select in composer (2026-07-13)

When an agent creates or updates `works/stories/S-NNN.md` or `works/items/W-NNN.md`, Quack keeps the **Work chip** in sync without manual linking.

| Trigger | Behaviour |
|---|---|
| `linkedChats` in frontmatter | `worksChatAutoLink.ts` mirrors onto `storyId` / `workItemId` on every `saveWorks` |
| **New** story/work file (orphan import) | Auto-link **work items** to focused/working chat; **draft stories** skip auto-link (planning is explicit) |
| Chat already linked | Never overridden — skip if `storyId` / `workItemId` already set |
| Work with `parentId` | Links `W-NNN` and keeps `S-NNN` when parent matches the chat's story |
| Bulk hydrate | Guard: no mass auto-link when many artifacts appear at once with an empty prior snapshot |

Files: `worksChatAutoLink.ts` (hooked from `saveWorks` + `refreshWorksFromDisk`). Same persistence path as **Plan a feature** (`linkStoryToChat` / `linkWorkToChat`).

Agents may still set `linkedChats: [<chat-uuid>]` explicitly in frontmatter; auto-link is a fallback when the session is clearly active.

## Data flow

```
Composer "Plan a feature" (explicit user action)
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
- Bundled skill `quack-works` v10 — agent PM loop step 9

## Gotchas

- **TodoWrite ≠ plan** — session todos do not replace story acceptance on disk.
- **Story drawer is disk-backed** — survives restart; `plan:` stash does not (`061`).
- **Hover + pin** — peek alone is not enough for long reads; pin via strip click or panel chevron.
- **Docs popover** — no `ai-flag-menu-overlay` on hover; overlay caused flicker crossing the gap to the popover.
- **Jack default** — `enterPlanning` resets composer to Jack (`onPickJack`); other agents execute linked work.
- **No auto-story** — CC plan mode and orphan draft stories do not open the harness; see **Explicit planning gate** above.
- **Legacy path** — chats with `workItemId` + `origin: plan` but no `storyId` still use `PlanPane` + `approvePlanWork` until migrated manually.
