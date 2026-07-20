---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-07-20
last_verified: 2026-07-20
related:
  - 015-claude-permission-mode.md
  - 061-plan-mode-tab.md
  - 068-quack-plan-harness.md
  - 062-presets.md
  - 083-composer-feature-link.md
  - 084-agent-context-panels.md
  - 073-ask-user-question-dock.md
  - documentation/bugs/003-agent-identity-mismatch.md
tags:
  [
    plan-mode,
    exit-plan-mode,
    milo,
    handoff,
    buy-in,
    cursor-style,
    features,
    claude-code,
    composer-dock,
  ]
---

## Plan buy-in — Pass the ball to Milo

**Purpose:** When Claude Code calls `ExitPlanMode` with a ready plan, Quack shows a
**Cursor-style** in-stream CTA (not the generic permission card): preview +
**Pass the ball to Milo**. Click → Milo (Builder) + Agent permissions + auto-start
implementation. Keep discussing / typing in the composer → stay in Plan with Jack.

**Stack:** React 19 + TS strict; module pub/sub store (same pattern as `askQuestionStore`).

### Mental model

| Step | Who | What |
|---|---|---|
| 1 | Jack + composer **Plan** | Explores; when ready calls `ExitPlanMode` (`tool_input.plan`) |
| 2 | Overlay | Publishes `planBuyInStore`; fires `onPlanReady` → `presentPlanReady` (Agent Plan tab / feature drawer / `plan:`); **no** ExitPlanMode permission card |
| 3 | User | Sees `PlanBuyInCard` above composer; in Agent Mode also the right-column **Plan** tab (full markdown) |
| 4a | **Pass the ball to Milo** | `allow` ExitPlanMode → `applyPreset("builder")` → `bypassPermissions` → auto-send implement prompt |
| 4b | Keep discussing / send message | `deny` ExitPlanMode → stay Plan + Jack |

Features-first durable target: linked `featureId` → `mergePlanIntoFeature` (+ FeatureDocDrawer in IDE; Agent Mode uses the context Plan tab instead — see `061` / `084`). No `S-NNN` spawn on Build.

### Files

| Type | Path | Role |
|---|---|---|
| Store | `src/planBuyInStore.ts` | `publishPlanBuyIn`, `getPlanBuyIn`, `resolvePlanBuyIn`, `setPlanBuyInDecide`, `subscribePlanBuyIn` |
| Component | `src/components/PlanBuyInCard.tsx` | CTA UI — preview, Milo avatar, Pass / Keep discussing |
| Host | `src/components/AIChatPanel.tsx` | Subscribe buy-in; `passBallToMilo` / `keepDiscussingPlan`; deny on composer send; Features-first `onPlanBuild` |
| Overlay | `src/components/ClaudePermissionOverlay.tsx` | ExitPlanMode → publish + `onPlanReady`; keep hook pending; skip card UI |
| Prompt | `src/brainPrompt.ts` | `quackClaudeCodeEditorPrompt(works, planMode)` — ExitPlanMode only if Plan |
| Isolation | `src/permModeStore.ts` | Plan never written to `byCwd`; session_id miss ≠ sibling cwd mode |
| Test | `src/permModeStore.test.ts` | Cross-chat Plan isolation |
| Styles | `src/App.css` | `.ai-plan-buyin*` |
| Preview | `061` / `084` / `presentPlanReady` | Side preview: Agent Plan tab, FeatureDocDrawer, or `plan:` |

### API (store)

| Function | Signature |
|---|---|
| `publishPlanBuyIn` | `(entry: PlanBuyIn) → void` |
| `getPlanBuyIn` | `({ sessionId?, cwd? }) → PlanBuyIn \| null` |
| `resolvePlanBuyIn` | `(requestId, "allow" \| "deny") → Promise<void>` |
| `setPlanBuyInDecide` | `({ sessionId?, cwd? }, fn \| null) → void` — per-panel hook settle |
| `subscribePlanBuyIn` | `(cb) → unsubscribe` |

`PlanBuyIn`: `{ requestId, plan, sessionId, cwd }`

### Data flow

```
ExitPlanMode (plan non-empty)
  → overlay queues request (hook stays open)
  → publishPlanBuyIn + onPlanReady → presentPlanReady
       ├─ Agent Mode → focusAgentPlan (084 Plan tab); merge feature if linked (no drawer)
       ├─ IDE + featureId → mergePlanIntoFeature + FeatureDocDrawer
       └─ IDE unlinked → plan: virtual tab (061)
  → PlanBuyInCard
       ├─ Pass → onPlanBuild (Milo + Agent) → resolve allow → sendUserText(implement…)
       └─ Keep / composer send → resolve deny
```

### Prompt gate

| Composer mode | Prompt says |
|---|---|
| `plan` | ExitPlanMode **AVAILABLE** — call when ready; wait for Milo handoff |
| other | ExitPlanMode **NOT enabled** — do not call (avoids tool_use_error) |

`[Quack Plan — active]` inject only when `planning && ccPermMode === "plan"`.

### Handoff (Build)

| Step | Effect |
|---|---|
| Preset | `applyPreset("builder", { silent: true })` → Milo (+ sync `presetIdRef` / model / effort / thinking) |
| Perm | `ccPermModeRef` + `setCcPermMode("bypassPermissions")` → Agent (forced even if Milo override differs) |
| CLI | `claude_perm_decide: allow` on ExitPlanMode |
| Auto-send | `sendUserText(Implement…)` **immediately** after handoff — reads refs, not stale React state |
| Features | Clear `planning`; **no** `handoffStoryToBuilder` |

**Gotcha (2026-07-20) — apply-then-send race:** `applyPreset` + immediate `sendUserText`
must sync refs inside `applyPreset` **before** `setState`. A send before React re-renders
used to stamp **Jack** on the bubble while `[Agent identity]` / the model already spoke as
Milo ("Sono Milo…" under a Jack header). Fixed in `AIChatPanel` + `chatTurnAgent.ts`.
Full write-up: `documentation/bugs/003-agent-identity-mismatch.md`. Related: `062`.

### Per-session Plan isolation

| Rule | Why |
|---|---|
| `bySession` is authoritative | Each CC session has its own mode |
| Never store `"plan"` in `byCwd` | Shared workspace cwd must not make sibling chats Plan |
| If `session_id` present but unknown | Return Ask (`default`), do **not** fall through to `byCwd` |
| Composer chip | Restored from `ChatSession.ccPermMode` on switch (`040`) |

### UI copy (English)

| Control | Label |
|---|---|
| Primary | Pass the ball to Milo |
| Secondary | Keep discussing |
| Hint | Enter build · Esc keep discussing · or type below to refine |

Avatar: Milo builtin `duck3` → `/images/ducks/duck3.jpeg`.

### Gotchas

- ExitPlanMode must stay **pending** until user decides when the permission hook fires — CTA owns UI; overlay still holds the request in queue (filtered out of visible cards so it does not block Bash/Edit cards).
- **Upstream often rejects ExitPlanMode** ("exists but is not enabled") even with composer Plan — channels / resume / CC bugs. Quack still shows the CTA from the `tool_call` args (and end-of-turn fallback) so Pass the ball does not depend on the hook succeeding.
- Auto-send after allow: clear `planBuyInRef` before `sendUserText` so the implement prompt is not treated as Keep discussing.
- Multiple `AIChatHost` overlays: `setPlanBuyInDecide` keyed by session/cwd so the correct panel settles the hook.
- CLI enables ExitPlanMode only with `--permission-mode plan` — prompt gate alone is not enough; composer must be Plan when Jack calls it. When the tool still fails, client buy-in path covers UX.

### Related

- [015](015-claude-permission-mode.md) — mode chip + overlay gates + buy-in note
- [061](061-plan-mode-tab.md) — `plan:` preview fallback
- [068](068-quack-plan-harness.md) — Features-first merge / story legacy
- [073](073-ask-user-question-dock.md) — sibling Cursor-style dock pattern
- [062](062-presets.md) — Milo defaults (`bypassPermissions`)
- [083](083-composer-feature-link.md) — `featureId` on chat
