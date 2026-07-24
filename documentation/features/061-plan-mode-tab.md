---
type: feature-doc
project: quack-desktop
stack: React 19, Zustand store (split-pane layout)
created: 2026-07-12
last_verified: 2026-07-24
tags: [chat, plan-mode, claude-code, virtual-tab, split, permission-overlay, build-handoff, features]
related:
  - 088-plan-milo-handoff.md
  - 084-agent-context-panels.md
  - 068-quack-plan-harness.md
  - 015-claude-permission-mode.md
  - documentation/bugs/008-plan-buyin-cross-session.md
---

## Claude Code plan mode — side-by-side plan tab

**Purpose:** when Claude Code is in plan mode it calls `ExitPlanMode` with the
proposed plan as inline markdown (`tool_input.plan`) — never a file on disk.
Quack opens a preview the moment the plan lands, and shows an in-stream
**PlanBuyInCard** CTA (**Open Plan** / **Pass the ball to Milo** / Keep discussing)
— independent of approve/deny.

> **Features-first (2026-07-17 / 2026-07-20):** when the chat has `featureId`
> set, plan text merges into the feature `.md` via `planFeatureMerge` and opens
> **FeatureDocDrawer** (IDE). Ephemeral `plan:` tab is the fallback when no feature
> is linked. **Agent Mode:** skips drawer / `plan:` split and focuses the right-column
> **Plan** context tab instead (`084`). Story (`S-NNN`) merge is legacy — not the Build happy path.

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Service | `src/plan.ts` | `planKey`, `parsePlanKey`, in-memory stash (`stashPlan`/`planPayload`) |
| Component | `src/components/PlanPane.tsx` | `PlanPane` / `AgentPlanPane`; `openPlanTab` / `presentPlanReady` |
| Store | `src/planBuyInStore.ts` | Pending ExitPlanMode → stream CTA + Agent Plan tab (**per `chatId`**) |
| Test | `src/planBuyInStore.test.ts` | No cross-session cwd leak (bug `008`) |
| Component | `src/components/PlanBuyInCard.tsx` | **Open Plan** / **Pass the ball to Milo** / Keep discussing |
| Component | `src/components/ClaudePermissionOverlay.tsx` | `ownerChatId` + `onPlanReady` + publish buy-in; ExitPlanMode card suppressed |
| Component | `src/components/AIChatPanel.tsx` | Wires preview + Milo handoff + auto-send + Open Plan |
| Component | `src/components/AgentContextColumn.tsx` | On-demand Plan tab (Agent Mode); lookup by `activeChatId` |
| Store | `src/agentContextNav.ts` | `focusAgentPlan` |
| Component | `src/components/WorkspaceShell.tsx` | Portals `PlanPane` for open `plan:` keys |
| Component | `src/components/PaneNode.tsx` | Tab label ("Plan") + `check-square` icon for `plan:` tabs |
| Store | `src/store.ts` | `parseKey` → `plan`; `openPlan()` |
| Config | `src/App.css` | `.plan-pane`, `.ai-plan-buyin*` |

### Surfaces (where the plan appears)

| Mode | Full-read surface | Durable merge | Buy-in CTA |
|------|-------------------|---------------|------------|
| **Agent Mode** | Right-column **Plan** tab (`AgentPlanPane`) | `mergePlanIntoFeature` if `featureId` | `PlanBuyInCard` (composer) |
| **IDE** + `featureId` | `FeatureDocDrawer` | same | same |
| **IDE** unlinked | Ephemeral `plan:` editor split | none (RAM stash) | same |

`presentPlanReady(wsId, chatId, root, planId, plan)` is the single router — called from
`AIChatPanel` (`onPlanReady` + end-of-turn ExitPlanMode fallback + **Open Plan**).

### Virtual tab keys (`plan:`)
Pattern mirrors `prev:` HTML preview tabs:

```
plan:{wsId}|{chatId}|{planId}
```

- `planId` — the permission request's `request_id`.
- Payload (`{ plan: string }`) stashed in a module-level `Map`, never written to disk.

### Why it always forces a split
`openPlan()` does **not** reuse the "find an alt pane, else fall back to the
active pane" logic from `openComposeReview`/`openHtmlPreview`. A plan is meant
to be read while the chat stays visible, so it always calls `dropTabAt(root,
targetPaneId, "right", key)` to guarantee a real horizontal split even when no
other pane is open yet.

### Data flow
```
ExitPlanMode permission request arrives (tool_input.plan non-empty)
  → ClaudePermissionOverlay publishes planBuyInStore (chatId) + onPlanReady
  → presentPlanReady:
       Agent Mode → merge feature (if linked) + focusAgentPlan (context Plan tab)
       IDE → featureId? FeatureDocDrawer : openPlanTab
  → PlanBuyInCard (Open Plan / Pass the ball to Milo / Keep discussing)
       Open Plan → presentPlanReady again (re-focus only)
  → Build: Milo + Agent + allow ExitPlanMode + auto-send implement prompt
```

### Gotchas
- **In-memory stash only:** restarting Quack loses the plan text for any
  `plan:` tab restored from a saved layout — the pane shows "Plan is no longer
  available." (same limitation as `prev:` tabs, see `045-html-preview.md`).
- **Dedup key is `request_id`**, not plan content — a brand-new plan proposed
  later in the same turn gets its own tab; re-renders of the same request
  don't reopen/refocus the tab repeatedly.
- **Approval (2026-07-20):** ExitPlanMode permission card replaced by in-stream
  **Pass the ball to Milo** (`PlanBuyInCard`). Keep discussing / composer send
  denies; Build allows + Milo + Agent + auto-send. Plan text display
  (`onPlanReady`) unchanged — feature merge / `plan:` tab still before decide.
- **Open Plan (2026-07-24):** tertiary CTA re-focuses the side preview after the
  user switched to Changes/Files/Terminal (or IDE drawer closed). Does not
  allow/deny ExitPlanMode.
- **Agent Mode Plan tab (2026-07-20):** right-column Plan tab is the full-read
  surface; FeatureDocDrawer / `plan:` editor split are skipped. Linked features
  still merge to disk. Tab hides when buy-in clears **or** active chat changes
  to one without a pending buy-in.
- **Cross-session isolation (2026-07-24, bug `008`):** buy-in lookup is by Quack
  `chatId` (session id secondary). A former **cwd fallback** made every Agent
  Mode session in the same project show another chat’s Plan ready card — removed.
- **Plan explore permissions (2026-07-14):** parallel `Task` subagents in Plan mode auto-allow via `parent_tool_use_id` sidechain routing + `PLAN_READ_TOOLS` — see [015-claude-permission-mode.md](015-claude-permission-mode.md). Generic permission cards in Plan show **Allow exploration** (stays Plan) instead of **Allow all** (would flip to Auto).

### Related docs
- `088-plan-milo-handoff.md` — Pass the ball to Milo CTA (primary Build UX)
- `068-quack-plan-harness.md` — Features-first plan (primary when `featureId` set)
- `084-agent-context-panels.md` — Agent Mode right-column Plan tab + resize
- `015-claude-permission-mode.md` — overlay + buy-in store + Plan isolation
- `045-html-preview.md` — `prev:` virtual-tab pattern this clones
- `038-compose-review.md` — original `crev:` virtual-tab registration pattern
- `documentation/bugs/008-plan-buyin-cross-session.md` — cwd leak
