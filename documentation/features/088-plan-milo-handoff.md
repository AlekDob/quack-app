---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-07-20
last_verified: 2026-07-29
related:
  - 015-claude-permission-mode.md
  - 061-plan-mode-tab.md
  - 068-quack-plan-harness.md
  - 062-presets.md
  - 083-composer-feature-link.md
  - 084-agent-context-panels.md
  - 073-ask-user-question-dock.md
  - documentation/bugs/003-agent-identity-mismatch.md
  - documentation/bugs/008-plan-buyin-cross-session.md
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
compact in-stream **Pass the ball to Milo** chip (full plan markdown lives only in
the right Plan tab / IDE preview — not in the chat card). Hidden while an
`AskUserQuestion` questionnaire is docked. Click Pass → Milo (Builder) + Agent
permissions + auto-start implementation. Esc / typing in the composer → stay in
Plan with Jack (deny ExitPlanMode).

**Stack:** React 19 + TS strict; module pub/sub store (same pattern as `askQuestionStore`).

### Mental model

| Step | Who | What |
|---|---|---|
| 1 | Jack + composer **Plan** | Explores; when ready calls `ExitPlanMode` (`tool_input.plan`) |
| 2 | Overlay / stream | Publishes `planBuyInStore` **keyed by Quack `chatId`**; fires `onPlanReady` → `presentPlanReady` (Agent Plan tab / feature drawer / `plan:`); **no** ExitPlanMode permission card |
| 3 | User | Sees Milo chip above composer (owning chat only; **hidden if AskUserQuestion docked**); full markdown only in Agent **Plan** tab / IDE preview |
| 4a | **Pass the ball to Milo** | `allow` ExitPlanMode → `applyPreset("builder")` → `bypassPermissions` → auto-send implement prompt |
| 4b | Esc / send message | `deny` ExitPlanMode → stay Plan + Jack |

Features-first durable target: linked `featureId` → `mergePlanIntoFeature` (+ FeatureDocDrawer in IDE; Agent Mode uses the context Plan tab instead — see `061` / `084`). No `S-NNN` spawn on Build.

### Files

| Type | Path | Role |
|---|---|---|
| Store | `src/planBuyInStore.ts` | `publishPlanBuyIn`, `getPlanBuyIn`, `resolvePlanBuyIn`, `setPlanBuyInDecide`, `subscribePlanBuyIn` — ownership by `chatId` |
| Test | `src/planBuyInStore.test.ts` | Cross-session isolation (no cwd leak — bug `008`) |
| Component | `src/components/PlanBuyInCard.tsx` | Milo chip only (Enter = build, Esc = keep discussing) |
| Host | `src/components/AIChatPanel.tsx` | Subscribe by `aiChatId`; hide chip when `dockedAskCall`; `passBallToMilo` / `keepDiscussingPlan`; deny on composer send; Features-first `onPlanBuild` |
| Overlay | `src/components/ClaudePermissionOverlay.tsx` | `ownerChatId` + ExitPlanMode → publish + `onPlanReady`; keep hook pending; skip card UI |
| Prompt | `src/brainPrompt.ts` | `quackClaudeCodeEditorPrompt(works, planMode)` — ExitPlanMode only if Plan |
| Isolation | `src/permModeStore.ts` | Plan never written to `byCwd`; session_id miss ≠ sibling cwd mode |
| Test | `src/permModeStore.test.ts` | Cross-chat Plan **mode** isolation |
| Styles | `src/App.css` | `.ai-plan-buyin`, `.ai-plan-buyin-build`, `.ai-plan-buyin-avatar` |
| Preview | `061` / `084` / `presentPlanReady` | **Sole** full-read surface: Agent Plan tab, FeatureDocDrawer, or `plan:` |

### API (store)

| Function | Signature |
|---|---|
| `publishPlanBuyIn` | `(entry: PlanBuyIn) → void` — keys `chat:{chatId}` (+ dual `s:{sessionId}` when both set) |
| `getPlanBuyIn` | `({ chatId?, sessionId? }) → PlanBuyIn \| null` — **never cwd** (bug `008`) |
| `resolvePlanBuyIn` | `(requestId, "allow" \| "deny") → Promise<void>` |
| `setPlanBuyInDecide` | `({ chatId?, sessionId? }, fn \| null) → void` — per-panel hook settle |
| `subscribePlanBuyIn` | `(cb) → unsubscribe` |
| `clearPlanBuyIn` | `({ chatId?, sessionId?, requestId? }) → void` |

`PlanBuyIn`: `{ requestId, plan, chatId, sessionId, cwd }` — **display ownership is `chatId`**. `cwd` is diagnostics only.

### Data flow

```
ExitPlanMode (plan non-empty)
  → overlay / tool_call / end-of-turn fallback
  → publishPlanBuyIn({ chatId, sessionId, … }) + onPlanReady → presentPlanReady
       ├─ Agent Mode → focusAgentPlan (084 Plan tab); merge feature if linked (no drawer)
       ├─ IDE + featureId → mergePlanIntoFeature + FeatureDocDrawer
       └─ IDE unlinked → plan: virtual tab (061)
  → PlanBuyInCard chip (if getPlanBuyIn hits AND no docked AskUserQuestion)
       ├─ Pass → onPlanBuild (Milo + Agent) → resolve allow → sendUserText(implement…)
       └─ Esc / composer send → resolve deny
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
| Perm | `ccPermModeRef` + `setCcPermMode("bypassPermissions")` → Agent (forced even if Milo override differs); sets `skipPermModeDefaultRef` so this one-off Agent switch does **not** become the new-chat global default (see gotcha) |
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
| Buy-in keyed by Quack `chatId` | Sibling Agent Mode chats share one cwd — cwd lookup leaked Plan ready (bug `008`) |
| `bySession` is authoritative for **perm mode** | Each CC session has its own mode (`015`) |
| Never store `"plan"` in `byCwd` | Shared workspace cwd must not make sibling chats Plan |
| If `session_id` present but unknown | Return Ask (`default`), do **not** fall through to `byCwd` |
| Composer chip | Restored from `ChatSession.ccPermMode` on switch (`040`) |

### UI copy (English)

| Control | Label | Surface |
|---|---|---|
| Primary chip | Pass the ball to Milo | Above composer (hidden if AskUserQuestion docked) |
| Keyboard | Enter = build · Esc = keep discussing (deny) | No on-chip hint row |

Avatar: Milo builtin `duck3` → `/images/ducks/duck3.jpeg`.

**Not in chat (2026-07-29):** plan markdown preview, feature label, **Open Plan**,
**Keep discussing** button, and the hint row were removed from `PlanBuyInCard`.
Full plan = right Plan tab / IDE only. Deny still via Esc or free-form composer send.

### Layout split (chat vs side)

| Surface | Shows |
|---|---|
| Right Plan tab / FeatureDocDrawer / `plan:` | Full plan markdown (`AgentPlanPane` / drawer / tab) |
| Above composer | Milo chip only (`planBuyIn && !dockedAskCall`) |
| Transcript `ExitPlanMode` row | Compact one-liner “Plan ready” + first-line preview (`chatToolRender`) — not the full plan |

### Gotchas

- ExitPlanMode must stay **pending** until user decides when the permission hook fires — CTA owns UI; overlay still holds the request in queue (filtered out of visible cards so it does not block Bash/Edit cards).
- **Upstream often rejects ExitPlanMode** ("exists but is not enabled") even with composer Plan — channels / resume / CC bugs. Quack still shows the CTA from the `tool_call` args (and end-of-turn fallback) so Pass the ball does not depend on the hook succeeding.
- Auto-send after allow: clear `planBuyInRef` before `sendUserText` so the implement prompt is not treated as Keep discussing.
- Multiple `AIChatHost` overlays: `setPlanBuyInDecide` keyed by chatId/session so the correct panel settles the hook. **Never match buy-in by cwd** — that showed Plan ready on sibling Agent Mode sessions (bug `008`).
- CLI enables ExitPlanMode only with `--permission-mode plan` — prompt gate alone is not enough; composer must be Plan when Jack calls it. When the tool still fails, client buy-in path covers UX.
- **Handoff must not poison the new-chat default (bug fix 2026-07-22):** `handoffToMiloBuilder` force-sets Agent (`bypassPermissions`) for the current chat, but the mode-persistence effect (`AIChatPanel.tsx`) writes `ccPermMode` into the global `PERM_MODE_KEY` default that seeds **new** chats. Without a guard, one "Pass the ball" flipped every future new chat to Agent → they never started in Plan, so Jack saw a non-plan session and (correctly, per the prompt gate) said "ExitPlanMode is not active" and fell back to `~/.claude/plans/*` scratch files. Fix: `skipPermModeDefaultRef` set by `handoffToMiloBuilder` makes the effect skip the global-default write for that one transition; the per-session `setPermMode` bridge still updates.
- **AskUserQuestion owns the dock (2026-07-29):** while `dockedAskCall` is set, the Milo chip is **not rendered** — questionnaire first. Buy-in stays in `planBuyInStore`; chip returns after answer/dismiss.
- **Answering AskUserQuestion must not deny the buy-in (bug fix 2026-07-22):** `sendUserText` opens with a "user typed instead of clicking Pass the ball → resolve deny" guard. `answerQuestion` (073) passes `opts.keepPlanBuyIn` so answering does not clear `planBuyIn` — after the question docks away, the Milo chip can reappear. Only free-form composer sends still deny.

### Related

- [015](015-claude-permission-mode.md) — mode chip + overlay gates + buy-in note
- [061](061-plan-mode-tab.md) — `plan:` preview fallback
- [068](068-quack-plan-harness.md) — Features-first merge / story legacy
- [073](073-ask-user-question-dock.md) — sibling Cursor-style dock pattern
- [062](062-presets.md) — Milo defaults (`bypassPermissions`)
- [083](083-composer-feature-link.md) — `featureId` on chat
- [084](084-agent-context-panels.md) — Agent Mode Plan tab + resizable column
- [008](../bugs/008-plan-buyin-cross-session.md) — cwd leak fix
