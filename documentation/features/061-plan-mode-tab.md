---
type: feature-doc
project: quack-desktop
stack: React 19, Zustand store (split-pane layout)
created: 2026-07-12
last_verified: 2026-07-13
tags: [chat, plan-mode, claude-code, virtual-tab, split, permission-overlay, build-handoff]
---

## Claude Code plan mode — side-by-side plan tab

**Purpose:** when Claude Code is in plan mode it calls `ExitPlanMode` with the
proposed plan as inline markdown (`tool_input.plan`) — never a file on disk.
Before this feature the plan text was only visible inside the small permission
card (`ClaudePermissionOverlay`). This opens it as a real editor tab, forced
into a split next to the chat (Cursor-style), the moment the plan lands —
independent of approve/deny.

> **Since `068-quack-plan-harness`:** when the chat has `storyId` set, plan text
> merges into `works/stories/S-NNN.md` and opens **`StoryPlanPane`** (`story:`)
> instead. The ephemeral `plan:` tab below is the **fallback** for chats without a
> linked story (legacy work-only plan drafts).

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Service | `src/plan.ts` | `planKey`, `parsePlanKey`, in-memory stash (`stashPlan`/`planPayload`) |
| Component | `src/components/PlanPane.tsx` | Body for `plan:` virtual tabs (`MarkdownPreview`); `openPlanTab()` helper |
| Component | `src/components/ClaudePermissionOverlay.tsx` | `onPlanReady(requestId, plan)` — fires once per `ExitPlanMode` request as soon as `tool_input.plan` is non-empty; **`onPlanBuild`** on user Build — see [068-quack-plan-harness.md](068-quack-plan-harness.md) |
| Component | `src/components/AIChatPanel.tsx` | Wires `onPlanReady` → `openPlanHandler`; `onPlanBuild` → `handoffStoryToBuilder` + Milo |
| Component | `src/components/WorkspaceShell.tsx` | Portals `PlanPane` for open `plan:` keys |
| Component | `src/components/PaneNode.tsx` | Tab label ("Plan") + `check-square` icon for `plan:` tabs |
| Store | `src/store.ts` | `parseKey` → `plan`; `openPlan()` |
| Config | `src/App.css` | `.plan-pane`, `.plan-pane-head`, `.plan-pane-body` |

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
  → ClaudePermissionOverlay useEffect (dedup by request_id)
  → onPlanReady(requestId, plan)
  → AIChatPanel.openPlanHandler → openPlanTab(wsId, chatId, requestId, plan)
  → store.openPlan → stashPlan + dropTabAt(..., "right", plan:key)
  → WorkspaceShell portal → PlanPane → MarkdownPreview
```

### Gotchas
- **In-memory stash only:** restarting Quack loses the plan text for any
  `plan:` tab restored from a saved layout — the pane shows "Plan is no longer
  available." (same limitation as `prev:` tabs, see `045-html-preview.md`).
- **Dedup key is `request_id`**, not plan content — a brand-new plan proposed
  later in the same turn gets its own tab; re-renders of the same request
  don't reopen/refocus the tab repeatedly.
- **Approval (2026-07-13):** the `ExitPlanMode` card no longer offers "Approve & start" (Jack implementing). **Keep discussing** denies; **Build** approves + hands off to Milo via `onPlanBuild` then `claude_perm_decide: allow`. Plan text display (`onPlanReady`) is unchanged — merge into story/drawer still happens before the user decides.

### Related docs
- `068-quack-plan-harness.md` — story-owned plan (primary path when `storyId` set)
- `045-html-preview.md` — `prev:` virtual tab pattern this clones
- `038-compose-review.md` — original `crev:` virtual-tab registration pattern
- `015-claude-permission-mode.md` — `ClaudePermissionOverlay` / permission flow
