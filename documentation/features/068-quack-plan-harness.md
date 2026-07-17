---
type: feature
project: quack-desktop
created: 2026-07-12
last_verified: 2026-07-17
related: [054-works-layer.md, 066-works-cycles-stories.md, 061-plan-mode-tab.md, 022-chat-composer.md, 005-jack-duck-identity.md, 064-agent-hub-drawer-and-chat-tab-switch.md]
tags: [works, plan, story, jack, composer, claude-code, drawer, click-open]
---

# 068 — Quack Plan harness

**Purpose:** Product-owned planning where the **user story (`S-NNN`) on disk** is the durable plan artifact — not ephemeral Claude Code plan RAM, not agent TodoWrite checklists. Jack PM is the default planner; any agent can execute linked work (`W-NNN`). CC `permMode: plan` + `ExitPlanMode` are optional adapters that merge into the story.

> **2026-07-17 — Features pivot:** Preferred durable plan target is the linked **feature** `.md` (`featureId` on chat). `onNativePlanReady` merges into the feature via `planFeatureMerge` when linked; otherwise falls back to story `S-NNN`. Composer Work cluster remains retired; use `ComposerFeaturePill` instead.

> **2026-07-17 — chat chrome retired (perf):** Composer Work cluster (`ComposerWorkBar` / docs / acceptance chips) and chat-column `StoryPlanDrawer` were removed. Planning without a linked `storyId` uses the CC `plan:` tab (`061`). Opening a story goes to the Works **story drawer**. Works inject defaults **off**; no post-turn auto-apply of Works directives; no `afterWorksSaved` chat auto-link. FS watch for `works/` starts when the Works pane or a Works drawer opens (`078`), not at app boot.

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
| `handoffStoryToBuilder(...)` | **Build** path — approve draft story (if needed), `createWorkFromStory`, `linkWorkToChat`; caller switches preset to Milo + Agent mode |
| `exitPlanning(...)` | Exit planning without approve → clears `planning`, unlinks chat from story |
| `unlinkStoryFromChat` / `unlinkWorkFromChat` | Composer unlink; bidirectional `linkedChats` cleanup |

## Story UI (chat chrome retired 2026-07-17)

Chat-column `StoryPlanDrawer` + composer Work cluster were **deleted**. Stories
open in the Works **story drawer** (`065`); agent `[Works new-story]` cards use
`WorksStoryChip`.

| Path | Behaviour |
|---|---|
| `store.openStoryPlan` | → `openStoryDrawer({ wsId, root, storyId })` |
| `WorksStoryChip` | Click → Works story drawer; optional apply directives |
| `WorkHubBadge` | Metadata-only (no live Works hydrate) |
| CC `plan:` tab | Fallback when chat has **no** `storyId` (`061`) |

### Legacy `story:` editor tab

`story:{wsId}|{chatId}|{storyId}` tabs still portal from `WorkspaceShell` /
`TabContentHost` if present in a saved layout; new opens never create them.

| File | Role |
|---|---|
| `src/components/StoryPlanPane.tsx` | Markdown body from `works/stories/S-NNN.md` |
| `src/storyPlanTab.ts` | Key parse/build |
| `src/components/WorksStoryChip.tsx` | In-chat story card → Works drawer |
| (deleted) | `StoryPlanDrawer.tsx`, `ComposerWorkBar.tsx`, `ComposerDocsChip.tsx`, … |

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
| Planning submenu | Open story panel, **Build with Milo**, Exit planning, switch linked work/story |

**Segmented cluster** (Cursor-style): `S-003 › W-008` | `N docs` | `K/N` in one pill (`ai-composer-work-cluster`).

**Link panel** — when the chat has no `workItemId` / `storyId`, the Work chip menu offers quick actions (`ComposerWorkQuickActions`) + searchable stories/work (`ComposerWorkLinkPanel`, `.ai-composer-ctx-menu--work-link`): filter by id/title, pick story or work item, excludes current link. Panel mounts only while the menu is open. Icon rows (`+ New work item`, `Open Works board`) use `.menu-item-label` `inline-flex` — `Icon` SVGs are block-level and stack vertically without it (`022`).

**Works pub/sub:** `ComposerWorkBar` subscribes to `worksCache` for chip label, docs, acceptance. `AIChatPanel` does **not** duplicate that subscription — `@` mention hydrates works lazily (`mentionWorksSnap`) so agent disk writes do not re-render the 7k-line panel.

**Context docs chip** — `ComposerDocsChip.tsx`: hover popover (liquid glass) listing Brain refs by Module / Story / Related / Added; file-type icons + basename + parent path. Row click → `openBrainRef` (`070`): story file opens **Story drawer**, feature paths open **feature preview drawer**, other docs open editor tab (or **tab drawer** in Agent Mode). No full-screen overlay (prevents flicker); 280ms leave debounce; slight overlap with anchor. See `054-works-layer.md`.

**Story drawer Build button (2026-07-13):** when `planning` is true, `StoryPlanDrawer` panel head shows a primary **Build** control (`.story-drawer-build`) — same handoff as the `ExitPlanMode` card without waiting for CC to call `ExitPlanMode` again. Useful when the story body already merged from a prior `onPlanReady`.

**Agent handoff:** Build never leaves Jack implementing. `AIChatPanel.handoffToMiloBuilder()` → `applyPreset("builder")` + `setCcPermMode("bypassPermissions")` (Milo's shipped default). Toast: "Handed off to Milo — build from your next message". User sends the implementation prompt; linked `W-NNN` + work context inject ride along (`worksTurnContext.ts`).

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
| `onPlanBuild` | `handoffStoryToBuilder` + Milo preset + Agent mode | `approvePlanWork` + Milo handoff |

`onPlanBuild` replaces the old `onPlanApproved` → `approvePlanning` only path on the `ExitPlanMode` card. Approving without building is no longer a first-class button — use **Keep discussing** to iterate with Jack, then **Build** when ready.

## Build handoff flow (Cursor-style, 2026-07-13)

```
Jack in Plan mode explores (Task/subagent auto-allowed — see 015)
  → ExitPlanMode lands → onPlanReady merges into S-NNN + drawer updates

User reads plan in drawer / card
  ├─ Keep discussing → deny ExitPlanMode → Jack stays in Plan
  └─ Build (card, drawer, or Work menu "Build with Milo")
        → handoffStoryToBuilder
             → approvePlanning (draft → active) if needed
             → createWorkFromStory → W-NNN linked
        → applyPreset("builder") + bypassPermissions
        → allow ExitPlanMode (card path only) so CC exits plan mode
  → User messages Milo to implement W-NNN
```

| Surface | File | Trigger |
|---|---|---|
| `ExitPlanMode` card | `ClaudePermissionOverlay.tsx` | **Build** / Enter |
| Story drawer head | `StoryPlanDrawer.tsx` | **Build** when `planning` |
| Work chip menu | `ComposerWorkBar.tsx` | **Build with Milo** |

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
Composer / harness "Plan a feature" (explicit)
  → enterPlanning → ensurePlanStory → S-NNN draft on disk
  → setAIChatStory + setAIChatPlanning
  → openStoryDrawer (Works story drawer)

Jack / CC proposes plan
  → CC ExitPlanMode → onNativePlanReady → mergePlanIntoStory
  → Works story drawer refreshes via worksWatch (when open)

User Build
  → handoffStoryToBuilder → W-NNN + parentId
  → setAIChatWorkItem
  → Milo · Agent preset active
```

## Related docs

- `061-plan-mode-tab.md` — ephemeral `plan:` tab (fallback when no story)
- `066-works-cycles-stories.md` — story entity + `S-NNN` files
- `054-works-layer.md` — Works board; chat Work chrome retired
- `065-works-drawer-ux.md` — story / work item drawers
- `078-works-disk-sync.md` — FS watch starts on Works pane/drawer open only
- Bundled skill `quack-works` v11 — agent PM loop step 9; AskUserQuestion orchestrator-only note

## CC tools in Quack Plan (2026-07-14)

The story-on-disk harness does **not** replace Claude Code's interactive tools in the parent chat:

| Tool | Orchestrator (this chat) | Subagent sidechain |
|---|---|---|
| `AskUserQuestion` | Call for multiple-choice — Quack dock (`073`) | ❌ return question in final report |
| `ExitPlanMode` | Call when plan ready — merges into `S-NNN` | N/A (parent only) |

System prompt: `quackClaudeCodeEditorPrompt()` in `brainPrompt.ts`, injected every CC turn via `AIChatPanel`.

## Gotchas

- **TodoWrite ≠ plan** — session todos do not replace story acceptance on disk.
- **Story drawer is disk-backed** — Works drawer / `S-NNN.md` survives restart; `plan:` stash does not (`061`).
- **No chat-column story strip** — use Works drawer / `WorksStoryChip`; do not reintroduce `StoryPlanDrawer` without a perf budget.
- **Jack default** — `enterPlanning` resets composer to Jack (`onPickJack`); other agents execute linked work.
- **No auto-story** — CC plan mode and orphan draft stories do not open the harness; see **Explicit planning gate** above.
- **Legacy path** — chats with `workItemId` + `origin: plan` but no `storyId` still use `PlanPane` + `approvePlanWork` on Build until migrated manually.
- **Don't use Allow all during planning** — flips Plan → Auto and Jack may skip `ExitPlanMode`; use per-tool "This session" if a specific Bash prefix keeps carding (see `015`).
- **Harness ≠ no CC tools** — story-on-disk is the durable artifact, but Jack still calls `AskUserQuestion` (choices) and `ExitPlanMode` (plan merge) in the parent chat (`073`, `quackClaudeCodeEditorPrompt`).
- **Duplicate S-NNN rows (2026-07-16)** — plan mode could show every active story twice on the timeline when (a) Jack emitted `[Works new-story]` while the chat already had `storyId` from **Plan a feature**, spawning parallel stories, and/or (b) `createStory` raced `importOrphanStoryFiles` after an agent wrote `works/stories/S-NNN.md` on disk. Fixes: `dedupeStoriesByShortId` on hydrate/save; `applyWorksDirectives` merges `new-story` into the linked story; works-directive apply waits until the turn finishes (`!streaming && !runningTools`); `ensurePlanStory` reuses any chat-linked story (not draft-only). **Manual cleanup:** Works toolbar **Merge N dupes** (visible when duplicates exist) or palette **Merge Duplicate Stories** — `mergeDuplicateStories()` reparents child work items and repoints linked chats.
