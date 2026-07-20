---
type: feature-doc
project: quack-desktop
stack: React 19, Zustand store (split-pane layout)
created: 2026-07-12
last_verified: 2026-07-20
tags: [chat, plan-mode, claude-code, virtual-tab, split, permission-overlay, build-handoff, features]
---

## Claude Code plan mode — side-by-side plan tab

**Purpose:** when Claude Code is in plan mode it calls `ExitPlanMode` with the
proposed plan as inline markdown (`tool_input.plan`) — never a file on disk.
Quack opens a preview the moment the plan lands, and shows an in-stream
**Pass the ball to Milo** CTA (`PlanBuyInCard`) — independent of approve/deny.

> **Features-first (2026-07-17 / 2026-07-20):** when the chat has `featureId`
> set, plan text merges into the feature `.md` via `planFeatureMerge` and opens
> **FeatureDocDrawer**. Ephemeral `plan:` tab is the fallback when no feature
> is linked. Story (`S-NNN`) merge is legacy — not the Build happy path.

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Service | `src/plan.ts` | `planKey`, `parsePlanKey`, in-memory stash (`stashPlan`/`planPayload`) |
| Component | `src/components/PlanPane.tsx` | Body for `plan:` virtual tabs (`MarkdownPreview`); `openPlanTab()` helper |
| Store | `src/planBuyInStore.ts` | Pending ExitPlanMode → stream CTA |
| Component | `src/components/PlanBuyInCard.tsx` | **Pass the ball to Milo** / Keep discussing |
| Component | `src/components/ClaudePermissionOverlay.tsx` | `onPlanReady` + publish buy-in; ExitPlanMode card suppressed |
| Component | `src/components/AIChatPanel.tsx` | Wires preview + Milo handoff + auto-send |
| Component | `src/components/WorkspaceShell.tsx` | Portals `PlanPane` for open `plan:` keys |
| Component | `src/components/PaneNode.tsx` | Tab label ("Plan") + `check-square` icon for `plan:` tabs |
| Store | `src/store.ts` | `parseKey` → `plan`; `openPlan()` |
| Config | `src/App.css` | `.plan-pane`, `.ai-plan-buyin` |

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
  → ClaudePermissionOverlay publishes planBuyInStore + onPlanReady
  → featureId? mergePlanIntoFeature + FeatureDocDrawer : openPlanTab
  → PlanBuyInCard (Pass the ball to Milo / Keep discussing)
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
- **Plan explore permissions (2026-07-14):** parallel `Task` subagents in Plan mode auto-allow via `parent_tool_use_id` sidechain routing + `PLAN_READ_TOOLS` — see [015-claude-permission-mode.md](015-claude-permission-mode.md). Generic permission cards in Plan show **Allow exploration** (stays Plan) instead of **Allow all** (would flip to Auto).

### Related docs
- `088-plan-milo-handoff.md` — Pass the ball to Milo CTA (primary Build UX)
- `068-quack-plan-harness.md` — Features-first plan (primary when `featureId` set)
- `015-claude-permission-mode.md` — overlay + buy-in store + Plan isolation
- `045-html-preview.md` — `prev:` virtual-tab pattern this clones
- `038-compose-review.md` — original `crev:` virtual-tab registration pattern
